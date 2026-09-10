import React, { useState, useEffect, useRef } from 'react';
import { 
  Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle2, 
  Clock, ShieldAlert, Send, FileText, CheckSquare, 
  Layers, PlusCircle, Camera, Check, X, ArrowLeft,
  ChevronRight, LogIn, Key, Sparkles, UserCheck, AlertCircle
} from 'lucide-react';
import api, { authService, mobileService } from '../services/api';
import { offlineQueue, generateUUID } from '../services/offlineQueue';

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueStats, setQueueStats] = useState(offlineQueue.getStats());
  const [showSyncCenter, setShowSyncCenter] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [showAppUpdateModal, setShowAppUpdateModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  // User & Projects
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const u = localStorage.getItem('erp_user');
      return u ? JSON.parse(u) : { id: 1, full_name: 'Field Engineer', role: localStorage.getItem('erp_role') || 'site_engineer' };
    } catch {
      return { id: 1, full_name: 'Field Engineer', role: 'site_engineer' };
    }
  });
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [wbsTasks, setWbsTasks] = useState([]);

  // Dashboard Data
  const [dashboardData, setDashboardData] = useState({
    actionQueue: [],
    approvalsPending: [],
    scheduleSnapshot: null,
    costSnapshot: null
  });
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dateRange, setDateRange] = useState('full_contract');

  // e-MB State
  const [embEntries, setEmbEntries] = useState([]);
  const [showNewEmbModal, setShowNewEmbModal] = useState(false);
  const [embForm, setEmbForm] = useState({
    wbs_node_id: '',
    description: '',
    measurement_method: 'LBH', // LBH or DIRECT
    length: '',
    breadth: '',
    height: '',
    direct_quantity: '',
    unit: 'm³',
    location_zone: '',
    photo_url: '',
    contractor_rep_signed: false,
    je_signed: false
  });

  // Hindrance State
  const [hindrances, setHindrances] = useState([]);
  const [showNewHindranceModal, setShowNewHindranceModal] = useState(false);
  const [hindranceForm, setHindranceForm] = useState({
    wbs_node_id: '',
    hindrance_type: 'Land non-availability',
    date_occurred: new Date().toISOString().split('T')[0],
    description: '',
    evidence_file_name: '',
    evidence_base64: ''
  });

  // Task Status State
  const [assignedTasks, setAssignedTasks] = useState([]);

  // Approvals State
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [approvalActionModal, setApprovalActionModal] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');

  // Reauth form
  const [reauthUsername, setReauthUsername] = useState('site');
  const [reauthPassword, setReauthPassword] = useState('site123');

  // Canvas refs for signatures
  const contractorCanvasRef = useRef(null);
  const jeCanvasRef = useRef(null);

  // Network listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerAutoSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial load
    loadBootstrapData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update queue stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setQueueStats(offlineQueue.getStats());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const triggerAutoSync = async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    setSyncStatusMsg('Syncing queued items...');
    try {
      const res = await offlineQueue.syncAll(
        api,
        () => setShowReauthModal(true),
        () => setShowAppUpdateModal(true)
      );
      setQueueStats(offlineQueue.getStats());
      if (res.synced > 0) {
        setSyncStatusMsg(`Successfully synced ${res.synced} item(s)`);
        loadEmbEntries();
        loadHindrances();
        loadDashboardData();
      } else if (res.conflicts > 0) {
        setSyncStatusMsg(`Sync completed with ${res.conflicts} conflict(s)`);
      } else {
        setSyncStatusMsg('All records synced');
      }
    } catch (e) {
      setSyncStatusMsg('Sync failed. Will retry.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(''), 4000);
    }
  };

  const loadBootstrapData = async () => {
    try {
      if (navigator.onLine) {
        const res = await mobileService.getBootstrapData();
        const data = res.data;
        if (data.projects && data.projects.length > 0) {
          setProjects(data.projects);
          setSelectedProjectId(data.projects[0].id);
          offlineQueue.setCache('projects', data.projects);
        }
        if (data.wbs_tasks) {
          setWbsTasks(data.wbs_tasks);
          offlineQueue.setCache('wbs_tasks', data.wbs_tasks);
        }
        if (data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('erp_user', JSON.stringify(data.user));
          if (data.user.role) {
            localStorage.setItem('erp_role', data.user.role);
          }
        }
      } else {
        // Load from cache
        const cachedProjects = offlineQueue.getCache('projects');
        if (cachedProjects) {
          setProjects(cachedProjects);
          setSelectedProjectId(cachedProjects[0]?.id);
        }
        const cachedWbs = offlineQueue.getCache('wbs_tasks');
        if (cachedWbs) {
          setWbsTasks(cachedWbs);
        }
      }
    } catch (e) {
      console.warn('Bootstrap API failed, falling back to cache:', e);
      const cachedProjects = offlineQueue.getCache('projects');
      if (cachedProjects) {
        setProjects(cachedProjects);
        setSelectedProjectId(cachedProjects[0]?.id);
      }
    }
  };

  // Load module data when project changes
  useEffect(() => {
    if (selectedProjectId) {
      loadDashboardData();
      loadEmbEntries();
      loadHindrances();
      loadTasks();
      loadApprovals();
    }
  }, [selectedProjectId, dateRange]);

  const loadDashboardData = async () => {
    if (!selectedProjectId) return;
    setLoadingDashboard(true);
    const cacheKey = `dashboard_${selectedProjectId}_${dateRange}`;

    if (!navigator.onLine) {
      const cached = offlineQueue.getCache(cacheKey);
      if (cached) {
        setDashboardData(cached);
      }
      setLoadingDashboard(false);
      return;
    }

    try {
      const [aqRes, apRes, schedRes, costRes] = await Promise.allSettled([
        api.get(`/dashboard/project/${selectedProjectId}/action-queue`),
        api.get(`/dashboard/project/${selectedProjectId}/approvals-pending`),
        api.get(`/dashboard/project/${selectedProjectId}/schedule-snapshot`, { params: { date_range: dateRange } }),
        api.get(`/dashboard/project/${selectedProjectId}/cost-snapshot`)
      ]);

      const newData = {
        actionQueue: aqRes.status === 'fulfilled' ? (aqRes.value.data?.items || []) : [],
        approvalsPending: apRes.status === 'fulfilled' ? (apRes.value.data?.items || []) : [],
        scheduleSnapshot: schedRes.status === 'fulfilled' ? schedRes.value.data : null,
        costSnapshot: costRes.status === 'fulfilled' ? costRes.value.data : null
      };

      setDashboardData(newData);
      offlineQueue.setCache(cacheKey, newData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const loadEmbEntries = async () => {
    if (!selectedProjectId) return;
    const cacheKey = `emb_${selectedProjectId}`;
    try {
      if (navigator.onLine) {
        const res = await api.get(`/boq-mb/emb/project/${selectedProjectId}`);
        setEmbEntries(res.data || []);
        offlineQueue.setCache(cacheKey, res.data || []);
      } else {
        const cached = offlineQueue.getCache(cacheKey);
        if (cached) setEmbEntries(cached);
      }
    } catch (e) {
      const cached = offlineQueue.getCache(cacheKey);
      if (cached) setEmbEntries(cached);
    }
  };

  const loadHindrances = async () => {
    if (!selectedProjectId) return;
    const cacheKey = `hindrances_${selectedProjectId}`;
    try {
      if (navigator.onLine) {
        const res = await api.get('/hindrances', { params: { project_id: selectedProjectId } });
        setHindrances(res.data || []);
        offlineQueue.setCache(cacheKey, res.data || []);
      } else {
        const cached = offlineQueue.getCache(cacheKey);
        if (cached) setHindrances(cached);
      }
    } catch (e) {
      const cached = offlineQueue.getCache(cacheKey);
      if (cached) setHindrances(cached);
    }
  };

  const loadTasks = async () => {
    if (!selectedProjectId) return;
    const cacheKey = `tasks_${selectedProjectId}`;
    try {
      if (navigator.onLine) {
        const res = await api.get('/wbs/tasks', { params: { project_id: selectedProjectId } });
        setAssignedTasks(res.data || []);
        offlineQueue.setCache(cacheKey, res.data || []);
      } else {
        const cached = offlineQueue.getCache(cacheKey);
        if (cached) setAssignedTasks(cached);
      }
    } catch (e) {
      const cached = offlineQueue.getCache(cacheKey);
      if (cached) setAssignedTasks(cached);
    }
  };

  const loadApprovals = async () => {
    const cacheKey = 'approvals_list';
    try {
      if (navigator.onLine) {
        const res = await api.get('/approvals/tasks', { params: { status_filter: 'pending' } });
        setPendingApprovals(res.data || []);
        offlineQueue.setCache(cacheKey, res.data || []);
      } else {
        const cached = offlineQueue.getCache(cacheKey);
        if (cached) setPendingApprovals(cached);
      }
    } catch (e) {
      const cached = offlineQueue.getCache(cacheKey);
      if (cached) setPendingApprovals(cached);
    }
  };

  // Computed Quantity Helper for e-MB
  const computeEmbQuantity = () => {
    if (embForm.measurement_method === 'DIRECT') {
      return parseFloat(embForm.direct_quantity) || 0.0;
    }
    const l = parseFloat(embForm.length) || 0.0;
    const b = parseFloat(embForm.breadth) || 0.0;
    const h = parseFloat(embForm.height) || 0.0;
    return Math.round(l * b * h * 1000) / 1000;
  };

  // Submit e-MB (Online or Offline Queue)
  const handleSaveEmb = async (e) => {
    e.preventDefault();
    const computedQty = computeEmbQuantity();

    if (computedQty <= 0) {
      alert('Calculated or entered quantity must be greater than 0');
      return;
    }

    const clientUuid = generateUUID();
    const payload = {
      client_uuid: clientUuid,
      project_id: selectedProjectId,
      wbs_node_id: parseInt(embForm.wbs_node_id),
      description: embForm.description,
      measurement_method: embForm.measurement_method,
      length: embForm.measurement_method === 'LBH' ? parseFloat(embForm.length) : null,
      breadth: embForm.measurement_method === 'LBH' ? parseFloat(embForm.breadth) : null,
      height: embForm.measurement_method === 'LBH' ? parseFloat(embForm.height) : null,
      direct_quantity: embForm.measurement_method === 'DIRECT' ? parseFloat(embForm.direct_quantity) : null,
      computed_quantity: computedQty,
      unit: embForm.unit,
      location_zone: embForm.location_zone,
      photo_url: embForm.photo_url || null,
      contractor_rep_signer_id: embForm.contractor_rep_signed ? currentUser.id : null,
      contractor_rep_signature_reference: embForm.contractor_rep_signed ? `MOB-SIG-CREP-${currentUser.id}` : null,
      je_signer_id: embForm.je_signed ? currentUser.id : null,
      je_signature_reference: embForm.je_signed ? `MOB-SIG-JE-${currentUser.id}` : null
    };

    if (!navigator.onLine) {
      // OFFLINE: Queue entry
      offlineQueue.enqueue('EMB', payload);
      setQueueStats(offlineQueue.getStats());
      alert('Device is offline. e-MB measurement queued safely in local storage.');
      setShowNewEmbModal(false);
      resetEmbForm();
      return;
    }

    try {
      // ONLINE: Direct Submission
      await api.post('/boq-mb/emb', payload);
      alert('e-MB entry created successfully.');
      setShowNewEmbModal(false);
      resetEmbForm();
      loadEmbEntries();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      if (err.response?.status === 426 || (typeof detail === 'string' && detail.includes('Please update the app'))) {
        setShowAppUpdateModal(true);
        offlineQueue.enqueue('EMB', payload);
        return;
      }
      // If network dropped mid-call, enqueue safely
      offlineQueue.enqueue('EMB', payload);
      setQueueStats(offlineQueue.getStats());
      alert(`Network error: ${detail}. e-MB saved to offline queue.`);
      setShowNewEmbModal(false);
      resetEmbForm();
    }
  };

  const resetEmbForm = () => {
    setEmbForm({
      wbs_node_id: '',
      description: '',
      measurement_method: 'LBH',
      length: '',
      breadth: '',
      height: '',
      direct_quantity: '',
      unit: 'm³',
      location_zone: '',
      photo_url: '',
      contractor_rep_signed: false,
      je_signed: false
    });
  };

  // Submit Hindrance (Online or Offline Queue)
  const handleSaveHindrance = async (e) => {
    e.preventDefault();
    if (!hindranceForm.description || hindranceForm.description.length < 20) {
      alert('Description must be at least 20 characters.');
      return;
    }

    const clientUuid = generateUUID();
    const payload = {
      client_uuid: clientUuid,
      project_id: selectedProjectId,
      wbs_node_id: parseInt(hindranceForm.wbs_node_id),
      hindrance_type: hindranceForm.hindrance_type,
      date_occurred: hindranceForm.date_occurred,
      description: hindranceForm.description,
      evidence_file_name: hindranceForm.evidence_file_name || 'site_photo.jpg',
      evidence_file_size: 1024,
      evidence_base64: hindranceForm.evidence_base64 || null
    };

    if (!navigator.onLine) {
      // OFFLINE: Queue entry
      offlineQueue.enqueue('HINDRANCE', payload);
      setQueueStats(offlineQueue.getStats());
      alert('Device is offline. Hindrance queued safely in local storage.');
      setShowNewHindranceModal(false);
      resetHindranceForm();
      return;
    }

    try {
      await api.post('/hindrances', payload);
      alert('Hindrance logged successfully.');
      setShowNewHindranceModal(false);
      resetHindranceForm();
      loadHindrances();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      if (err.response?.status === 426 || (typeof detail === 'string' && detail.includes('Please update the app'))) {
        setShowAppUpdateModal(true);
        offlineQueue.enqueue('HINDRANCE', payload);
        return;
      }
      offlineQueue.enqueue('HINDRANCE', payload);
      setQueueStats(offlineQueue.getStats());
      alert(`Network error: ${detail}. Hindrance saved to offline queue.`);
      setShowNewHindranceModal(false);
      resetHindranceForm();
    }
  };

  const resetHindranceForm = () => {
    setHindranceForm({
      wbs_node_id: '',
      hindrance_type: 'Land non-availability',
      date_occurred: new Date().toISOString().split('T')[0],
      description: '',
      evidence_file_name: '',
      evidence_base64: ''
    });
  };

  // Task Status Update from Mobile
  const handleUpdateTaskStatus = async (taskId, newProgress) => {
    try {
      await api.put(`/wbs/tasks/${taskId}/progress`, null, {
        params: { progress_pct: newProgress }
      });
      alert(`Task progress updated to ${newProgress}%`);
      loadTasks();
    } catch (err) {
      alert(`Failed to update task: ${err.response?.data?.detail || err.message}`);
    }
  };

  // Approval Action Execution
  const handleApprovalAction = async (action) => {
    if (!selectedApproval) return;
    try {
      await api.post(`/approvals/tasks/${selectedApproval.id}/action`, {
        action,
        comments: approvalComments
      });
      alert(`Approval task ${action}ed successfully.`);
      setApprovalActionModal(false);
      setSelectedApproval(null);
      setApprovalComments('');
      loadApprovals();
      loadDashboardData();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      alert(`Approval Action Rejected: ${detail}`);
    }
  };

  // Re-authentication handler
  const handleReauthenticate = async (e) => {
    e.preventDefault();
    try {
      const res = await authService.login({
        username_or_email: reauthUsername,
        password: reauthPassword
      });
      const data = res.data;
      if (data.token) {
        localStorage.setItem('erp_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('erp_user', JSON.stringify(data.user));
        localStorage.setItem('erp_role', data.user.role);
        setCurrentUser(data.user);
      }
      setShowReauthModal(false);
      alert('Authentication refreshed. Resuming sync...');
      triggerAutoSync();
    } catch (err) {
      alert(`Login failed: ${err.response?.data?.detail || err.message}`);
    }
  };

  // Filter WBS tasks for current project
  const currentProjectWbs = wbsTasks.filter(w => w.project_id === selectedProjectId);

  // Queued items
  const queuedItems = offlineQueue.getQueue();

  return (
    <div style={{
      maxWidth: '500px',
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      paddingBottom: '80px',
      boxShadow: '0 0 40px rgba(0,0,0,0.8)'
    }}>
      {/* Top Mobile Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(99, 102, 241, 0.5)'
          }}>
            <Sparkles size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.02em', color: '#fff' }}>
              Project Flow
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>v2.0.0</span>
              <span>•</span>
              <span style={{ color: isOnline ? '#10b981' : '#f59e0b' }}>
                {isOnline ? '● Online' : '○ Offline Mode'}
              </span>
            </div>
          </div>
        </div>

        {/* Sync Status Button */}
        <button 
          onClick={() => setShowSyncCenter(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: queueStats.queued > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.15)',
            color: queueStats.queued > 0 ? '#fbbf24' : '#818cf8',
            border: queueStats.queued > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)'
          }}
        >
          {isSyncing ? (
            <RefreshCw size={14} className="spin-animation" />
          ) : queueStats.queued > 0 ? (
            <AlertTriangle size={14} />
          ) : (
            <CheckCircle2 size={14} />
          )}
          <span>
            {isSyncing ? 'Syncing...' : queueStats.queued > 0 ? `${queueStats.queued} Queued` : 'Synced'}
          </span>
        </button>
      </header>

      {/* Network Alert Banner */}
      {!isOnline && (
        <div style={{
          backgroundColor: '#b45309',
          color: '#fff',
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <WifiOff size={14} />
            <span>Working offline. New records saved locally.</span>
          </div>
          <span style={{ opacity: 0.8 }}>{queueStats.queued} pending</span>
        </div>
      )}

      {/* Project Selector Bar */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Project:</label>
        <select
          value={selectedProjectId || ''}
          onChange={(e) => setSelectedProjectId(parseInt(e.target.value))}
          style={{
            flex: 1,
            backgroundColor: '#1e293b',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '13px',
            outline: 'none'
          }}
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.code ? `[${p.code}] ` : ''}{p.name}
            </option>
          ))}
        </select>
        <button
          onClick={loadDashboardData}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px'
          }}
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Main Content Area */}
      <main style={{ padding: '16px' }}>

        {/* ----------------- TAB 1: DASHBOARD (READ PARITY) ----------------- */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Action Queue Widget */}
            <div style={{
              backgroundColor: '#131b2e',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
                  Action Queue
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: dashboardData.actionQueue.length > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: dashboardData.actionQueue.length > 0 ? '#f87171' : '#34d399',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {dashboardData.actionQueue.length} Pending
                </span>
              </div>

              {dashboardData.actionQueue.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '12px 0' }}>
                  No pending action items for this project.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dashboardData.actionQueue.slice(0, 4).map(item => (
                    <div 
                      key={item.id}
                      onClick={() => {
                        setSelectedApproval(item);
                        setApprovalActionModal(true);
                      }}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#1a243b',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{item.title}</span>
                        <span style={{ fontSize: '10px', color: '#6366f1', fontWeight: 600 }}>{item.category}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                        <span>Stage: {item.current_stage}</span>
                        <span>{item.submitted_date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Approvals Pending Widget */}
            <div style={{
              backgroundColor: '#131b2e',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
                  Approvals Pending
                </h3>
                <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>
                  {dashboardData.approvalsPending.length} items
                </span>
              </div>
              {dashboardData.approvalsPending.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '12px 0' }}>
                  ✓ All approvals up to date
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dashboardData.approvalsPending.slice(0, 3).map(app => (
                    <div 
                      key={app.id}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#1a243b',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0' }}>{app.title}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Stage: {app.current_stage}</div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedApproval(app);
                          setApprovalActionModal(true);
                        }}
                        style={{
                          backgroundColor: '#6366f1',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Schedule Snapshot Widget */}
            <div style={{
              backgroundColor: '#131b2e',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
                  Schedule Snapshot
                </h3>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#94a3b8',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    fontSize: '11px',
                    padding: '2px 6px'
                  }}
                >
                  <option value="full_contract">Contract</option>
                  <option value="this_month">This Month</option>
                  <option value="this_week">This Week</option>
                </select>
              </div>

              {dashboardData.scheduleSnapshot ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#1a243b', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Planned Tasks</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9' }}>
                      {dashboardData.scheduleSnapshot.planned_count || 0}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#1a243b', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Completed</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981' }}>
                      {dashboardData.scheduleSnapshot.completed_count || 0}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#1a243b', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>In Progress</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8' }}>
                      {dashboardData.scheduleSnapshot.in_progress_count || 0}
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#1a243b', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>Delayed</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#f43f5e' }}>
                      {dashboardData.scheduleSnapshot.delayed_count || 0}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>Loading schedule...</div>
              )}
            </div>

            {/* Cost Snapshot Widget */}
            <div style={{
              backgroundColor: '#131b2e',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', marginBottom: '12px' }}>
                Cost Snapshot
              </h3>
              {dashboardData.costSnapshot ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#94a3b8' }}>Budget Utilization</span>
                    <span style={{ fontWeight: 600, color: '#818cf8' }}>
                      {dashboardData.costSnapshot.billed_percentage || 0}%
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                    <div style={{
                      width: `${Math.min(100, dashboardData.costSnapshot.billed_percentage || 0)}%`,
                      height: '100%',
                      backgroundColor: '#6366f1'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '10px' }}>Total Sanction</div>
                      <div style={{ fontWeight: 600 }}>₹{(dashboardData.costSnapshot.estimate_total || 0).toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '10px' }}>Billed Amount</div>
                      <div style={{ fontWeight: 600, color: '#10b981' }}>₹{(dashboardData.costSnapshot.billed_total || 0).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>Loading cost data...</div>
              )}
            </div>
          </div>
        )}

        {/* ----------------- TAB 2: DIGITAL e-MB (FULL PARITY) ----------------- */}
        {activeTab === 'emb' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Digital e-MB</h2>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Electronic Measurement Book</div>
              </div>
              <button
                onClick={() => setShowNewEmbModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <PlusCircle size={16} />
                <span>New Entry</span>
              </button>
            </div>

            {/* Offline Queued Entries Alert */}
            {queuedItems.filter(q => q.entity_type === 'EMB').length > 0 && (
              <div style={{
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '12px',
                fontSize: '12px',
                color: '#fbbf24',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{queuedItems.filter(q => q.entity_type === 'EMB').length} e-MB record(s) queued locally</span>
                <button
                  onClick={triggerAutoSync}
                  style={{
                    background: '#f59e0b',
                    color: '#000',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Sync
                </button>
              </div>
            )}

            {/* List of Entries */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {embEntries.length === 0 && queuedItems.filter(q => q.entity_type === 'EMB').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b', fontSize: '13px' }}>
                  No measurement entries recorded yet for this project.
                </div>
              ) : (
                <>
                  {/* Queued local items first */}
                  {queuedItems.filter(q => q.entity_type === 'EMB').map(q => (
                    <div
                      key={q.client_uuid}
                      style={{
                        backgroundColor: '#1b233a',
                        border: '1px dashed #f59e0b',
                        borderRadius: '10px',
                        padding: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                          {q.payload.description}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                          QUEUED FOR SYNC
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Qty: {q.payload.computed_quantity} {q.payload.unit}</span>
                        <span>Method: {q.payload.measurement_method}</span>
                      </div>
                    </div>
                  ))}

                  {/* Synced server entries */}
                  {embEntries.map(entry => (
                    <div
                      key={entry.id}
                      style={{
                        backgroundColor: '#131b2e',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        padding: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                          {entry.description}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: entry.status === 'FULLY SIGNED / SUBMITTED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: entry.status === 'FULLY SIGNED / SUBMITTED' ? '#34d399' : '#fbbf24'
                        }}>
                          {entry.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                        WBS: {entry.wbs_node_name || 'Site Work'} • Zone: {entry.location_zone || 'General'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                        <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                          Qty: {entry.computed_quantity} {entry.unit}
                        </span>
                        <span>
                          {entry.contractor_rep_signed_at ? '✓ Contractor' : '○ Contractor'} • {entry.je_signed_at ? '✓ JE' : '○ JE'}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ----------------- TAB 3: HINDRANCES (FULL PARITY) ----------------- */}
        {activeTab === 'hindrances' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Hindrance Log</h2>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Site Delays & 4-Day SLA Workflow</div>
              </div>
              <button
                onClick={() => setShowNewHindranceModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#f59e0b',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <PlusCircle size={16} />
                <span>Log Delay</span>
              </button>
            </div>

            {/* Offline Queued Hindrances Alert */}
            {queuedItems.filter(q => q.entity_type === 'HINDRANCE').length > 0 && (
              <div style={{
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '12px',
                fontSize: '12px',
                color: '#fbbf24',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{queuedItems.filter(q => q.entity_type === 'HINDRANCE').length} hindrance(s) queued locally</span>
                <button
                  onClick={triggerAutoSync}
                  style={{
                    background: '#f59e0b',
                    color: '#000',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Sync
                </button>
              </div>
            )}

            {/* Hindrances List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {hindrances.length === 0 && queuedItems.filter(q => q.entity_type === 'HINDRANCE').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b', fontSize: '13px' }}>
                  No hindrances reported for this project.
                </div>
              ) : (
                <>
                  {queuedItems.filter(q => q.entity_type === 'HINDRANCE').map(q => (
                    <div
                      key={q.client_uuid}
                      style={{
                        backgroundColor: '#1b233a',
                        border: '1px dashed #f59e0b',
                        borderRadius: '10px',
                        padding: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                          {q.payload.hindrance_type}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                          QUEUED FOR SYNC
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                        {q.payload.description}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        Occurred: {q.payload.date_occurred}
                      </div>
                    </div>
                  ))}

                  {hindrances.map(h => (
                    <div
                      key={h.id}
                      style={{
                        backgroundColor: '#131b2e',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        padding: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                          {h.hindrance_type}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: h.current_status === 'ACCEPTED' ? 'rgba(16, 185, 129, 0.2)' : h.current_status === 'REJECTED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: h.current_status === 'ACCEPTED' ? '#34d399' : h.current_status === 'REJECTED' ? '#f87171' : '#fbbf24'
                        }}>
                          {h.current_status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>
                        {h.description}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                        <span>WBS: {h.wbs_node_name || 'Node'}</span>
                        <span>Occurred: {h.date_occurred}</span>
                      </div>
                      {h.ee_decision && (
                        <div style={{ marginTop: '8px', padding: '6px 8px', backgroundColor: '#1a243b', borderRadius: '6px', fontSize: '11px', color: '#94a3b8' }}>
                          <span style={{ fontWeight: 600, color: '#e2e8f0' }}>EE Decision:</span> {h.ee_decision} ({h.ee_remarks || 'No remarks'})
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ----------------- TAB 4: TASK STATUS UPDATES ----------------- */}
        {activeTab === 'tasks' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Task Progress</h2>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Update execution progress & task status</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {assignedTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b', fontSize: '13px' }}>
                  No tasks assigned to this project.
                </div>
              ) : (
                assignedTasks.map(task => (
                  <div
                    key={task.id}
                    style={{
                      backgroundColor: '#131b2e',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '10px',
                      padding: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                        {task.wbs_code ? `[${task.wbs_code}] ` : ''}{task.title}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: task.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                        color: task.status === 'completed' ? '#34d399' : '#38bdf8'
                      }}>
                        {(task.status || 'not_started').toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                      <span>Level: {task.task_level || 'Task'}</span>
                      <span>Progress: {task.progress_pct || 0}%</span>
                    </div>

                    {/* Progress Slider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={task.progress_pct || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setAssignedTasks(assignedTasks.map(t => t.id === task.id ? { ...t, progress_pct: val } : t));
                        }}
                        style={{ flex: 1, accentColor: '#6366f1' }}
                      />
                      <button
                        onClick={() => handleUpdateTaskStatus(task.id, task.progress_pct || 0)}
                        style={{
                          backgroundColor: '#1e293b',
                          color: '#818cf8',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ----------------- TAB 5: APPROVALS (FULL PARITY) ----------------- */}
        {activeTab === 'approvals' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Pending Approvals</h2>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Authorized actions for AE / EE / Accountant</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendingApprovals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b', fontSize: '13px' }}>
                  No pending approvals in queue.
                </div>
              ) : (
                pendingApprovals.map(app => (
                  <div
                    key={app.id}
                    onClick={() => {
                      setSelectedApproval(app);
                      setApprovalActionModal(true);
                    }}
                    style={{
                      backgroundColor: '#131b2e',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '10px',
                      padding: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                        {app.title}
                      </span>
                      <span style={{ fontSize: '10px', color: '#6366f1', fontWeight: 600 }}>
                        {app.requestType || app.category}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                      <span>Stage: {app.current_stage || app.currentApprovalStage}</span>
                      <span>{app.projectName}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>

      {/* ----------------- NEW e-MB MODAL ----------------- */}
      {showNewEmbModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            padding: '20px',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Record e-MB Measurement</h3>
              <button 
                onClick={() => setShowNewEmbModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEmb} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* WBS Node */}
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  WBS Node *
                </label>
                <select
                  required
                  value={embForm.wbs_node_id}
                  onChange={(e) => setEmbForm({ ...embForm, wbs_node_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                >
                  <option value="">Select WBS Node</option>
                  {currentProjectWbs.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.wbs_code ? `[${w.wbs_code}] ` : ''}{w.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Measurement Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Raft Concrete Pouring Zone B"
                  value={embForm.description}
                  onChange={(e) => setEmbForm({ ...embForm, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                />
              </div>

              {/* Measurement Method Toggle */}
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Calculation Method
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setEmbForm({ ...embForm, measurement_method: 'LBH' })}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: embForm.measurement_method === 'LBH' ? '#6366f1' : '#1e293b',
                      color: '#fff'
                    }}
                  >
                    Structured Dimensions (L × B × H)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmbForm({ ...embForm, measurement_method: 'DIRECT' })}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: embForm.measurement_method === 'DIRECT' ? '#6366f1' : '#1e293b',
                      color: '#fff'
                    }}
                  >
                    Direct Quantity
                  </button>
                </div>
              </div>

              {/* Structured Dimensions Inputs */}
              {embForm.measurement_method === 'LBH' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8' }}>Length (m) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="10.0"
                      value={embForm.length}
                      onChange={(e) => setEmbForm({ ...embForm, length: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        backgroundColor: '#1e293b',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8' }}>Breadth (m) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="5.0"
                      value={embForm.breadth}
                      onChange={(e) => setEmbForm({ ...embForm, breadth: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        backgroundColor: '#1e293b',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#94a3b8' }}>Height (m) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="2.0"
                      value={embForm.height}
                      onChange={(e) => setEmbForm({ ...embForm, height: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        backgroundColor: '#1e293b',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px'
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Direct Quantity *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Enter measured quantity"
                    value={embForm.direct_quantity}
                    onChange={(e) => setEmbForm({ ...embForm, direct_quantity: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: '#1e293b',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px'
                    }}
                  />
                </div>
              )}

              {/* Live Computed Quantity */}
              <div style={{
                backgroundColor: '#1a243b',
                padding: '10px 14px',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Read-only Computed Quantity:</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#38bdf8' }}>
                  {computeEmbQuantity()} {embForm.unit}
                </span>
              </div>

              {/* Digital Signatures Capture */}
              <div style={{ backgroundColor: '#131b2e', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>
                  Digital Signatures
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={embForm.contractor_rep_signed}
                      onChange={(e) => setEmbForm({ ...embForm, contractor_rep_signed: e.target.checked })}
                      style={{ accentColor: '#6366f1', width: '16px', height: '16px' }}
                    />
                    <span>Capture Contractor Representative Signature</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={embForm.je_signed}
                      onChange={(e) => setEmbForm({ ...embForm, je_signed: e.target.checked })}
                      style={{ accentColor: '#6366f1', width: '16px', height: '16px' }}
                    />
                    <span>Capture Junior Engineer (JE) Signature</span>
                  </label>
                </div>

                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
                  {embForm.contractor_rep_signed && embForm.je_signed 
                    ? 'Dual signatures applied → Will be billable upon completion'
                    : 'Single signature → Will enter PENDING CO-SIGN'}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                style={{
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '8px'
                }}
              >
                {isOnline ? 'Submit Measurement' : 'Queue Measurement (Offline)'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- NEW HINDRANCE MODAL ----------------- */}
      {showNewHindranceModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            padding: '20px',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Log Hindrance / Site Delay</h3>
              <button 
                onClick={() => setShowNewHindranceModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveHindrance} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Hindrance Type *
                </label>
                <select
                  value={hindranceForm.hindrance_type}
                  onChange={(e) => setHindranceForm({ ...hindranceForm, hindrance_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                >
                  <option value="Land non-availability">Land non-availability</option>
                  <option value="Design pending">Design pending</option>
                  <option value="Utility shifting">Utility shifting</option>
                  <option value="Weather">Weather</option>
                  <option value="Force majeure">Force majeure</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  WBS Node *
                </label>
                <select
                  required
                  value={hindranceForm.wbs_node_id}
                  onChange={(e) => setHindranceForm({ ...hindranceForm, wbs_node_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                >
                  <option value="">Select WBS Node</option>
                  {currentProjectWbs.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.wbs_code ? `[${w.wbs_code}] ` : ''}{w.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Date Occurred *
                </label>
                <input
                  type="date"
                  required
                  value={hindranceForm.date_occurred}
                  onChange={(e) => setHindranceForm({ ...hindranceForm, date_occurred: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                  Description (Min 20 characters) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detailed description of site delay or obstruction..."
                  value={hindranceForm.description}
                  onChange={(e) => setHindranceForm({ ...hindranceForm, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#fbbf24'
              }}>
                ℹ️ 4-Day SLA will be automatically assigned and monitored by the server.
              </div>

              <button
                type="submit"
                style={{
                  backgroundColor: '#f59e0b',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '8px'
                }}
              >
                {isOnline ? 'Log Hindrance' : 'Queue Hindrance (Offline)'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- APPROVAL ACTION MODAL ----------------- */}
      {approvalActionModal && selectedApproval && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            padding: '20px',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Review Approval Task</h3>
              <button onClick={() => setApprovalActionModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                {selectedApproval.title}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Stage: {selectedApproval.current_stage || selectedApproval.currentApprovalStage}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                Remarks / Comments:
              </label>
              <textarea
                rows={2}
                placeholder="Optional approval/rejection remarks..."
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#1e293b',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  resize: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <button
                onClick={() => handleApprovalAction('approve')}
                style={{
                  backgroundColor: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Approve
              </button>
              <button
                onClick={() => handleApprovalAction('reject')}
                style={{
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Reject
              </button>
              <button
                onClick={() => handleApprovalAction('send_back')}
                style={{
                  backgroundColor: '#64748b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Send Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- SYNC CENTER MODAL ----------------- */}
      {showSyncCenter && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 110,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            padding: '20px',
            maxHeight: '85vh',
            overflowY: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Sync Center</h3>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Offline queue status & conflict resolution</div>
              </div>
              <button onClick={() => setShowSyncCenter(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Sync summary banner */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#1e293b',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{queueStats.total} Total Queued Records</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {queueStats.queued} ready • {queueStats.conflict} conflicts • {queueStats.requires_reauth} need re-auth
                </div>
              </div>
              <button
                onClick={triggerAutoSync}
                disabled={isSyncing || !isOnline}
                style={{
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: (isSyncing || !isOnline) ? 'not-allowed' : 'pointer',
                  opacity: (isSyncing || !isOnline) ? 0.6 : 1
                }}
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>

            {/* Queue items list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '50vh', overflowY: 'auto' }}>
              {queuedItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '13px' }}>
                  ✓ No offline items queued. All data is synchronized.
                </div>
              ) : (
                queuedItems.map(item => (
                  <div
                    key={item.client_uuid}
                    style={{
                      backgroundColor: '#131b2e',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9' }}>
                        {item.entity_type}: {item.payload.description?.slice(0, 30)}...
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: item.status === 'SYNCED' ? 'rgba(16, 185, 129, 0.2)' : item.status === 'CONFLICT' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: item.status === 'SYNCED' ? '#34d399' : item.status === 'CONFLICT' ? '#f87171' : '#fbbf24'
                      }}>
                        {item.status}
                      </span>
                    </div>
                    {item.conflict_reason && (
                      <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>
                        ⚠️ Conflict: {item.conflict_reason}
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                      UUID: {item.client_uuid.slice(0, 8)}... • Retries: {item.retry_count || 0}
                    </div>
                  </div>
                ))
              )}
            </div>

            {queuedItems.some(q => q.status === 'SYNCED') && (
              <button
                onClick={() => {
                  offlineQueue.clearSynced();
                  setQueueStats(offlineQueue.getStats());
                }}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Clear Synced Records
              </button>
            )}
          </div>
        </div>
      )}

      {/* ----------------- RE-AUTH MODAL (SESSION EXPIRED) ----------------- */}
      {showReauthModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)',
          zIndex: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            borderRadius: '16px',
            padding: '20px',
            width: '100%',
            maxWidth: '380px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <Key size={32} color="#6366f1" style={{ marginBottom: '8px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Session Expired</h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                Your offline records are safe. Sign in to resume synchronization.
              </p>
            </div>

            <form onSubmit={handleReauthenticate} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                required
                placeholder="Username or email"
                value={reauthUsername}
                onChange={(e) => setReauthUsername(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#1e293b',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
              />
              <input
                type="password"
                required
                placeholder="Password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#1e293b',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
              />
              <button
                type="submit"
                style={{
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '6px'
                }}
              >
                Sign In & Sync
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- INCOMPATIBLE APP VERSION MODAL ----------------- */}
      {showAppUpdateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)',
          zIndex: 130,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '380px',
            textAlign: 'center',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            <ShieldAlert size={40} color="#ef4444" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
              Please update the app
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '8px 0 16px 0' }}>
              A mandatory system update is required. Your queued offline data has been preserved locally and will sync after updating.
            </p>
            <button
              onClick={() => {
                localStorage.setItem('erp_client_version', '2.0.0');
                localStorage.setItem('erp_schema_version', '2');
                setShowAppUpdateModal(false);
                alert('App updated to v2.0.0. Resuming sync...');
                triggerAutoSync();
              }}
              style={{
                backgroundColor: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Update Now
            </button>
          </div>
        </div>
      )}

      {/* ----------------- BOTTOM NAVIGATION BAR ----------------- */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '500px',
        backgroundColor: 'rgba(15, 23, 42, 0.98)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 0 12px 0',
        zIndex: 50
      }}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Layers },
          { id: 'emb', label: 'e-MB', icon: FileText },
          { id: 'hindrances', label: 'Delays', icon: AlertTriangle },
          { id: 'tasks', label: 'Tasks', icon: CheckSquare },
          { id: 'approvals', label: 'Approvals', icon: UserCheck },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                color: isActive ? '#818cf8' : '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
