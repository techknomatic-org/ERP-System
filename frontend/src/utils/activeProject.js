/**
 * Shared Global Active Project Context Helper
 * 
 * Manages the canonical active project selection across all ERP modules
 * via localStorage key 'active_project_id'.
 */

export const STORAGE_KEY_ACTIVE_PROJECT = 'active_project_id';

/**
 * Returns the currently active project ID.
 * If a projectList is provided, verifies that the stored project ID actually
 * exists in that list; if not or if uninitialized, selects a sensible default
 * (preferring Metro Tower ID 29, then any ACTIVE project, then the first project).
 */
export function getActiveProjectId(projectList = null) {
  const storedId = localStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT);

  if (!projectList || !Array.isArray(projectList) || projectList.length === 0) {
    return storedId || '';
  }

  // Check if storedId exists in projectList
  if (storedId && projectList.some(p => String(p.id) === String(storedId))) {
    return String(storedId);
  }

  // Fallback: prefer Metro Tower (id 29) or first active project
  const metroProj = projectList.find(p => p.id === 29 || String(p.code || '').includes('PRV01-A'));
  const activeProj = metroProj || projectList.find(p => ['ACTIVE', 'IN_PROGRESS'].includes((p.status || '').toUpperCase())) || projectList[0];

  const defaultId = String(activeProj.id);
  localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, defaultId);
  return defaultId;
}

/**
 * Sets the active project ID in localStorage and dispatches a notification event.
 */
export function setActiveProjectId(projectId) {
  if (!projectId) return;
  const strId = String(projectId);
  localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, strId);
  try {
    window.dispatchEvent(new CustomEvent('active_project_changed', { detail: { projectId: strId } }));
  } catch (e) {
    // SSR / test safety
  }
}
