// Single Robust Offline Queue Architecture for Project Flow Mobile Parity (INT-05)

const STORAGE_KEY = 'erp_mobile_offline_queue';
const CACHE_KEY_PREFIX = 'erp_mobile_cache_';

export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const offlineQueue = {
  getQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error reading offline queue:', e);
      return [];
    }
  },

  saveQueue(queue) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Error saving offline queue:', e);
    }
  },

  enqueue(entityType, payload, operationType = 'CREATE') {
    const queue = this.getQueue();
    const client_uuid = payload.client_uuid || generateUUID();
    const record = {
      client_uuid,
      entity_type: entityType, // 'EMB' | 'HINDRANCE'
      operation_type: operationType,
      payload: { ...payload, client_uuid },
      created_at: new Date().toISOString(),
      status: 'QUEUED', // QUEUED, SYNCING, SYNCED, CONFLICT, FAILED, REQUIRES_REAUTH
      retry_count: 0,
      last_sync_attempt: null,
      server_id: null,
      conflict_reason: null,
      error_message: null
    };

    queue.unshift(record);
    this.saveQueue(queue);
    return record;
  },

  updateItem(client_uuid, patch) {
    const queue = this.getQueue();
    const idx = queue.findIndex(item => item.client_uuid === client_uuid);
    if (idx !== -1) {
      queue[idx] = { ...queue[idx], ...patch, updated_at: new Date().toISOString() };
      this.saveQueue(queue);
      return queue[idx];
    }
    return null;
  },

  removeItem(client_uuid) {
    const queue = this.getQueue().filter(item => item.client_uuid !== client_uuid);
    this.saveQueue(queue);
  },

  clearSynced() {
    const queue = this.getQueue().filter(item => item.status !== 'SYNCED');
    this.saveQueue(queue);
  },

  getStats() {
    const queue = this.getQueue();
    return {
      total: queue.length,
      queued: queue.filter(q => q.status === 'QUEUED').length,
      syncing: queue.filter(q => q.status === 'SYNCING').length,
      synced: queue.filter(q => q.status === 'SYNCED').length,
      conflict: queue.filter(q => q.status === 'CONFLICT').length,
      failed: queue.filter(q => q.status === 'FAILED').length,
      requires_reauth: queue.filter(q => q.status === 'REQUIRES_REAUTH').length,
    };
  },

  // Cache storage for offline read parity
  setCache(key, data) {
    try {
      localStorage.setItem(`${CACHE_KEY_PREFIX}${key}`, JSON.stringify({
        timestamp: Date.now(),
        data
      }));
    } catch (e) {
      console.error('Failed to write offline cache', e);
    }
  },

  getCache(key, maxAgeMs = null) {
    try {
      const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${key}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (maxAgeMs && (Date.now() - parsed.timestamp > maxAgeMs)) {
        return null;
      }
      return parsed.data;
    } catch (e) {
      return null;
    }
  },

  // Sync a single queued entry against backend API
  async syncItem(item, api) {
    this.updateItem(item.client_uuid, {
      status: 'SYNCING',
      last_sync_attempt: new Date().toISOString(),
      retry_count: (item.retry_count || 0) + 1
    });

    try {
      if (item.entity_type === 'EMB') {
        const res = await api.post('/api/boq-mb/emb/sync', {
          items: [item.payload]
        });

        const syncedList = res.data?.synced || [];
        const conflictList = res.data?.conflicts || [];

        if (syncedList.length > 0) {
          const syncedItem = syncedList[0];
          this.updateItem(item.client_uuid, {
            status: 'SYNCED',
            server_id: syncedItem.id,
            conflict_reason: null,
            error_message: null
          });
          return { success: true, item: syncedItem };
        } else if (conflictList.length > 0) {
          const conflict = conflictList[0];
          this.updateItem(item.client_uuid, {
            status: 'CONFLICT',
            conflict_reason: conflict.reason || 'Server conflict detected'
          });
          return { success: false, conflict: conflict.reason };
        }
      } else if (item.entity_type === 'HINDRANCE') {
        const res = await api.post('/api/hindrances/sync', {
          items: [item.payload]
        });

        const syncedList = res.data?.synced || [];
        const conflictList = res.data?.conflicts || [];

        if (syncedList.length > 0) {
          const syncedItem = syncedList[0];
          this.updateItem(item.client_uuid, {
            status: 'SYNCED',
            server_id: syncedItem.id,
            conflict_reason: null,
            error_message: null
          });
          return { success: true, item: syncedItem };
        } else if (conflictList.length > 0) {
          const conflict = conflictList[0];
          this.updateItem(item.client_uuid, {
            status: 'CONFLICT',
            conflict_reason: conflict.reason || 'Server conflict detected'
          });
          return { success: false, conflict: conflict.reason };
        }
      }

      return { success: false, error: 'Unknown entity type' };
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 401) {
        this.updateItem(item.client_uuid, {
          status: 'REQUIRES_REAUTH',
          error_message: 'Session expired. Please sign in again to sync.'
        });
        return { success: false, reauth: true };
      } else if (status === 426 || (typeof detail === 'string' && detail.includes('Please update the app'))) {
        this.updateItem(item.client_uuid, {
          status: 'FAILED',
          error_message: 'Please update the app'
        });
        return { success: false, appUpdateRequired: true };
      } else {
        this.updateItem(item.client_uuid, {
          status: 'FAILED',
          error_message: detail || err.message || 'Sync failed. Will retry when connected.'
        });
        return { success: false, error: detail || err.message };
      }
    }
  },

  // Sync entire queue
  async syncAll(api, onReauthRequired = null, onAppUpdateRequired = null) {
    const queue = this.getQueue();
    const pendingItems = queue.filter(q => q.status === 'QUEUED' || q.status === 'FAILED');

    const results = {
      total: pendingItems.length,
      synced: 0,
      conflicts: 0,
      failed: 0,
      requires_reauth: 0,
      app_update_required: false
    };

    for (const item of pendingItems) {
      const outcome = await this.syncItem(item, api);
      if (outcome.success) {
        results.synced += 1;
      } else if (outcome.conflict) {
        results.conflicts += 1;
      } else if (outcome.reauth) {
        results.requires_reauth += 1;
        if (onReauthRequired) onReauthRequired();
        break; // Stop sync until reauthenticated
      } else if (outcome.appUpdateRequired) {
        results.failed += 1;
        results.app_update_required = true;
        if (onAppUpdateRequired) onAppUpdateRequired();
        break; // Stop sync until app is updated
      } else {
        results.failed += 1;
      }
    }

    return results;
  }
};
