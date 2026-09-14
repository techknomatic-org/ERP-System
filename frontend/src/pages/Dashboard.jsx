import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, ShieldCheck, CheckSquare, HardHat, Building2, Key, DollarSign, 
  AlertTriangle, RefreshCw, Activity, Sliders, Plus, 
  UserCog, CheckCircle2, Filter, Layers, ClipboardList, ShoppingCart, Calculator, 
  FileText, TrendingUp, Sparkles, Truck, ShieldAlert, Package, Briefcase,
  ChevronDown, ChevronRight, Calendar, Clock, Eye, ArrowRight, AlertOctagon
} from 'lucide-react';
import KpiCard from '../components/KpiCard';
import ProjectHealthBadge from '../components/ProjectHealthBadge';
import { dashboardService, projectService, propertyService, auditService, authService } from '../services/api';
import { getActiveProjectId, setActiveProjectId } from '../utils/activeProject';

const DASHBOARD_POLLING_INTERVAL_MS = 60000;
const RETRY_INTERVAL_MS = 10000;

export default function Dashboard() {
  const navigate = useNavigate();

  const [userRole, setUserRole] = useState(localStorage.getItem('erp_role') || 'admin');

  // Multi-Project Context State
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(getActiveProjectId() || '');
  const [projectsLoading, setProjectsLoading] = useState(true);
  
  // Date Range Filter State ('this_week' | 'this_month' | 'full_contract')
  const [dateRange, setDateRange] = useState('full_contract');

  // Independent Widget State (Decoupled, Fault-Tolerant)
  const [actionQueue, setActionQueue] = useState({
    loading: true,
    error: null,
    count: 0,
    items: []
  });

  const [scheduleSnapshot, setScheduleSnapshot] = useState({
    loading: true,
    error: null,
    data: {
      wbs_progress_pct: 0,
      total_wbs_nodes: 0,
      active_wbs_nodes: 0,
      completed_wbs_nodes: 0,
      delayed_wbs_nodes: 0,
      total_milestones: 0,
      completed_milestones: 0,
      upcoming_milestones: 0,
      delayed_milestones: 0,
      milestone_items: []
    }
  });

  const [costSnapshot, setCostSnapshot] = useState({
    loading: true,
    error: null,
    data: {
      estimate_total: 0,
      billed_total: 0,
      remaining_amount: 0,
      billed_percentage: 0
    }
  });

  const [approvalsPending, setApprovalsPending] = useState({
    loading: true,
    error: null,
    pending_count: 0,
    items: []
  });

  // Full Modules Expansion Section State (COLLAPSED BY DEFAULT)
  const [isFullModulesExpanded, setIsFullModulesExpanded] = useState(false);

  // Legacy System Summary State (for Full Modules and System Stats)
  const [summaryData, setSummaryData] = useState(null);
  const [recentAuditLogs, setRecentAuditLogs] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0);

  // Independent Widget Fetch Callbacks (Requirement 5, 6, 7 & 13)
  const loadActionQueue = useCallback(async (projId) => {
    if (!projId || projId === 'undefined' || projId === 'null') {
      setActionQueue(prev => ({ ...prev, loading: false }));
      return;
    }
    setActionQueue(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await dashboardService.getActionQueue(projId);
      setActionQueue({
        loading: false,
        error: null,
        count: res.data?.count ?? 0,
        items: res.data?.items || []
      });
    } catch (err) {
      console.error("Action Queue widget failed:", err);
      setActionQueue(prev => ({
        ...prev,
        loading: false,
        error: "Data unavailable, retrying…"
      }));
    }
  }, []);

  const loadScheduleSnapshot = useCallback(async (projId, dRange) => {
    if (!projId || projId === 'undefined' || projId === 'null') {
      setScheduleSnapshot(prev => ({ ...prev, loading: false }));
      return;
    }
    setScheduleSnapshot(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await dashboardService.getScheduleSnapshot(projId, dRange);
      setScheduleSnapshot({
        loading: false,
        error: null,
        data: res.data || {}
      });
    } catch (err) {
      console.error("Schedule Snapshot widget failed:", err);
      setScheduleSnapshot(prev => ({
        ...prev,
        loading: false,
        error: "Data unavailable, retrying…"
      }));
    }
  }, []);

  const loadCostSnapshot = useCallback(async (projId) => {
    if (!projId || projId === 'undefined' || projId === 'null') {
      setCostSnapshot(prev => ({ ...prev, loading: false }));
      return;
    }
    setCostSnapshot(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await dashboardService.getCostSnapshot(projId);
      setCostSnapshot({
        loading: false,
        error: null,
        data: res.data || {}
      });
    } catch (err) {
      console.error("Cost Snapshot widget failed:", err);
      setCostSnapshot(prev => ({
        ...prev,
        loading: false,
        error: "Data unavailable, retrying…"
      }));
    }
  }, []);

  const loadApprovalsPending = useCallback(async (projId) => {
    if (!projId || projId === 'undefined' || projId === 'null') {
      setApprovalsPending(prev => ({ ...prev, loading: false }));
      return;
    }
    setApprovalsPending(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await dashboardService.getApprovalsPending(projId);
      setApprovalsPending({
        loading: false,
        error: null,
        pending_count: res.data?.pending_count ?? 0,
        items: res.data?.items || []
      });
    } catch (err) {
      console.error("Approvals Pending widget failed:", err);
      setApprovalsPending(prev => ({
        ...prev,
        loading: false,
        error: "Data unavailable, retrying…"
      }));
    }
  }, []);

  // Consolidate widget execution — widgets run concurrently and never block one another (Requirement 6 & 13)
  const loadAllWidgets = useCallback(async (projId, dRange) => {
    if (!projId || projId === 'undefined' || projId === 'null') {
      setActionQueue(prev => ({ ...prev, loading: false }));
      setScheduleSnapshot(prev => ({ ...prev, loading: false }));
      setCostSnapshot(prev => ({ ...prev, loading: false }));
      setApprovalsPending(prev => ({ ...prev, loading: false }));
      return;
    }

    await Promise.allSettled([
      loadActionQueue(projId),
      loadScheduleSnapshot(projId, dRange),
      loadCostSnapshot(projId),
      loadApprovalsPending(projId)
    ]);
  }, [loadActionQueue, loadScheduleSnapshot, loadCostSnapshot, loadApprovalsPending]);

  // Fetch Projects and set default project safely (Requirement 8)
  const loadUserProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      let projectList = [];
      try {
        const res = await dashboardService.getUserProjects();
        projectList = res.data?.projects || [];
      } catch (e) {
        console.warn("getUserProjects endpoint failed, falling back to projectService.getProjects():", e);
        const fallbackRes = await projectService.getProjects();
        projectList = (fallbackRes.data || []).map(p => ({
          id: p.id,
          name: p.name,
          code: p.code,
          status: (p.status || 'ACTIVE').toUpperCase(),
          progress_pct: parseFloat(p.progress_pct || 0) || 0,
          is_default: false
        }));
      }

      setProjects(projectList);

      if (projectList.length > 0) {
        const initialId = getActiveProjectId(projectList);
        setSelectedProjectId(initialId);
        setActiveProjectId(initialId);
        loadAllWidgets(initialId, dateRange);
        return initialId;
      } else {
        // Zero projects available
        setActionQueue(prev => ({ ...prev, loading: false }));
        setScheduleSnapshot(prev => ({ ...prev, loading: false }));
        setCostSnapshot(prev => ({ ...prev, loading: false }));
        setApprovalsPending(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error("Error loading projects for dashboard:", err);
      setActionQueue(prev => ({ ...prev, loading: false, error: "Data unavailable, retrying…" }));
      setScheduleSnapshot(prev => ({ ...prev, loading: false, error: "Data unavailable, retrying…" }));
      setCostSnapshot(prev => ({ ...prev, loading: false, error: "Data unavailable, retrying…" }));
      setApprovalsPending(prev => ({ ...prev, loading: false, error: "Data unavailable, retrying…" }));
    } finally {
      setProjectsLoading(false);
    }
    return null;
  }, [dateRange, loadAllWidgets]);

  // Legacy background summary statistics loader
  const loadLegacySummary = useCallback(() => {
    const storedRole = localStorage.getItem('erp_role');
    if (storedRole) setUserRole(storedRole);

    dashboardService.getSummary()
      .then(res => setSummaryData(res.data))
      .catch(err => console.error("Legacy summary error:", err));

    authService.getUsers()
      .then(res => {
        const uList = res.data || [];
        setUsersCount(uList.length);
        setActiveUsersCount(uList.filter(u => u.is_active).length);
      })
      .catch(err => console.error("User stats error:", err));

    auditService.getLogs()
      .then(res => setRecentAuditLogs((res.data || []).slice(0, 5)))
      .catch(err => console.error("Audit log error:", err));
  }, []);

  // Initial Load Handler
  useEffect(() => {
    loadLegacySummary();
    loadUserProjects();
  }, [loadLegacySummary, loadUserProjects]);

  // 60-Second Configurable Dashboard Polling (Requirement 9)
  useEffect(() => {
    if (!selectedProjectId) return;

    const timer = setInterval(() => {
      loadAllWidgets(selectedProjectId, dateRange);
    }, DASHBOARD_POLLING_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [selectedProjectId, dateRange, loadAllWidgets]);

  // Automatic retry for unavailable widgets every 10 seconds
  useEffect(() => {
    if (!selectedProjectId) return;
    const hasAnyError = actionQueue.error || scheduleSnapshot.error || costSnapshot.error || approvalsPending.error;
    if (!hasAnyError) return;

    const retryTimer = setTimeout(() => {
      if (actionQueue.error) loadActionQueue(selectedProjectId);
      if (scheduleSnapshot.error) loadScheduleSnapshot(selectedProjectId, dateRange);
      if (costSnapshot.error) loadCostSnapshot(selectedProjectId);
      if (approvalsPending.error) loadApprovalsPending(selectedProjectId);
    }, RETRY_INTERVAL_MS);

    return () => clearTimeout(retryTimer);
  }, [selectedProjectId, dateRange, actionQueue.error, scheduleSnapshot.error, costSnapshot.error, approvalsPending.error, loadActionQueue, loadScheduleSnapshot, loadCostSnapshot, loadApprovalsPending]);

  // Synchronize with global active project context events
  useEffect(() => {
    const handleActiveProjectChange = (e) => {
      const newId = e.detail?.projectId;
      if (newId && String(newId) !== String(selectedProjectId)) {
        setSelectedProjectId(newId);
        loadAllWidgets(newId, dateRange);
      }
    };
    window.addEventListener('active_project_changed', handleActiveProjectChange);
    return () => window.removeEventListener('active_project_changed', handleActiveProjectChange);
  }, [selectedProjectId, dateRange, loadAllWidgets]);

  // Project Change Event Handler
  const handleProjectSwitch = (newProjectId) => {
    setSelectedProjectId(newProjectId);
    setActiveProjectId(newProjectId);
    loadAllWidgets(newProjectId, dateRange);
  };

  // Date Range Change Event Handler
  const handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange);
    if (selectedProjectId) {
      loadScheduleSnapshot(selectedProjectId, newDateRange);
    }
  };

  const roleLower = (userRole || 'admin').toLowerCase();

  const isPM = roleLower === 'project_manager' || roleLower === 'pm';
  const isSE = roleLower === 'site_engineer' || roleLower === 'site' || roleLower === 'je';
  const isFinance = roleLower === 'finance' || roleLower === 'accountant';
  const isProcurement = roleLower === 'procurement';
  const isManagement = roleLower === 'management';
  const isCustomer = roleLower === 'customer';

  // Customer Redirect
  if (isCustomer) {
    return (
      <div className="content-page" style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', paddingTop: '3rem' }}>
        <div className="glass-card" style={{ padding: '3rem' }}>
          <Building2 size={48} color="var(--accent-emerald)" style={{ margin: '0 auto 1rem' }} />
          <h2>Welcome to Project Flow Customer Portal</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            View your unit booking details, payment schedules, construction progress, and documents.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/portal')}>
            Open Property Portal ➔
          </button>
        </div>
      </div>
    );
  }

  // Active Project Context
  const currentProject = projects.find(p => String(p.id) === String(selectedProjectId)) || {};
  const isAnyWidgetLoading = actionQueue.loading || scheduleSnapshot.loading || costSnapshot.loading || approvalsPending.loading;

  return (
    <div className="content-page" style={{ maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
      
      {/* 1. UNIFIED DASHBOARD HEADER BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22), rgba(245, 158, 11, 0.06))',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(245, 158, 11, 0.15)',
              flexShrink: 0
            }}>
              {isSE ? <HardHat size={25} color="#10b981" /> :
               isPM ? <HardHat size={25} color="#f59e0b" /> :
               isFinance ? <DollarSign size={25} color="#10b981" /> :
               isProcurement ? <ShoppingCart size={25} color="#6366f1" /> :
               isManagement ? <Briefcase size={25} color="#06b6d4" /> :
               <Building2 size={25} color="#6366f1" />}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                Unified Project Dashboard
              </h1>
              <p style={{ margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.84rem' }}>
                PM Command Center • Live WBS Execution, Milestone Schedule, Cost Snapshot & Action Queue
              </p>
            </div>
          </div>
        </div>

        {/* Command Controls Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Project Switcher Dropdown */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(15, 23, 42, 0.85)',
            padding: '0.35rem 0.75rem',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
          }}>
            <Building2 size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
            <select
              id="project-switcher-select"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                maxWidth: '280px'
              }}
              value={selectedProjectId}
              onChange={(e) => handleProjectSwitch(e.target.value)}
              disabled={projectsLoading || projects.length === 0}
            >
              {projects.length === 0 && <option value="">No projects available</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id} style={{ background: '#0f172a', color: '#f8fafc' }}>
                  {p.code} — {p.name} ({p.status})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter Dropdown */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(15, 23, 42, 0.85)',
            padding: '0.35rem 0.75rem',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
          }}>
            <Calendar size={15} color="#38bdf8" style={{ flexShrink: 0 }} />
            <select
              id="date-range-filter-select"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
              value={dateRange}
              onChange={(e) => handleDateRangeChange(e.target.value)}
            >
              <option value="this_week" style={{ background: '#0f172a', color: '#f8fafc' }}>This Week</option>
              <option value="this_month" style={{ background: '#0f172a', color: '#f8fafc' }}>This Month</option>
              <option value="full_contract" style={{ background: '#0f172a', color: '#f8fafc' }}>Full Contract</option>
            </select>
          </div>

          {/* Active Role Badge */}
          <span className="tag-badge" style={{
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            fontWeight: 700,
            fontSize: '0.75rem',
            padding: '0.45rem 0.75rem',
            letterSpacing: '0.04em'
          }}>
            {roleLower.replace('_', ' ').toUpperCase()}
          </span>

          {/* Refresh Button */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => loadAllWidgets(selectedProjectId, dateRange)}
            disabled={!selectedProjectId}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem' }}
          >
            <RefreshCw size={14} className={isAnyWidgetLoading ? "spin-animation" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ACTIVE PROJECT CONTEXT HERO CARD */}
      {currentProject.name && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(19, 29, 51, 0.95) 0%, rgba(11, 19, 38, 0.98) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.28)',
          borderRadius: '16px',
          padding: '1.25rem 1.6rem',
          marginBottom: '1.5rem',
          boxShadow: '0 10px 30px -5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Ambient Glow */}
          <div style={{
            position: 'absolute',
            top: '-60px',
            right: '-60px',
            width: '220px',
            height: '220px',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
            <div style={{ flex: '1 1 420px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.12)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(56, 189, 248, 0.25)'
                }}>
                  Active Project Context
                </span>
                {currentProject.contract_type && (
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {currentProject.contract_type}
                  </span>
                )}
                {currentProject.division_name && (
                  <span style={{ fontSize: '0.72rem', color: '#cbd5e1', background: 'rgba(255,255,255,0.04)', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {currentProject.division_name}
                  </span>
                )}
                {currentProject.location && (
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    📍 {currentProject.location}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#818cf8',
                  background: 'rgba(99, 102, 241, 0.15)',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}>
                  {currentProject.code}
                </span>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>
                  {currentProject.name}
                </h2>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.25rem' }}>Project Status</div>
                <span className={`tag-badge ${currentProject.status === 'ACTIVE' || currentProject.status === 'IN_PROGRESS' ? 'tag-success' : 'tag-warning'}`} style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: 700 }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: currentProject.status === 'ACTIVE' ? '#34d399' : '#fbbf24', display: 'inline-block', marginRight: '6px', boxShadow: currentProject.status === 'ACTIVE' ? '0 0 6px #34d399' : undefined }}></span>
                  {currentProject.status || 'ACTIVE'}
                </span>
              </div>

              <div style={{ minWidth: '160px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>WBS Progress</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>
                    {currentProject.progress_pct || scheduleSnapshot.data.wbs_progress_pct || 0}%
                  </span>
                </div>
                <div style={{ height: '7px', width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, currentProject.progress_pct || scheduleSnapshot.data.wbs_progress_pct || 0))}%`,
                    background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                    borderRadius: '9999px',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. UNIFIED 2x2 WIDGET GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.35rem', marginBottom: '1.75rem' }}>

        {/* WIDGET A: ACTION QUEUE */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '340px', background: 'rgba(19, 29, 51, 0.75)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.14)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={16} color="#f59e0b" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.02rem', color: '#f8fafc' }}>Action Queue</span>
            </div>
            <span className="tag-badge" style={{
              background: actionQueue.error ? 'rgba(239,68,68,0.12)' : actionQueue.count > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)',
              color: actionQueue.error ? '#f87171' : actionQueue.count > 0 ? '#fbbf24' : '#94a3b8',
              border: actionQueue.count > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              {actionQueue.error ? 'Unavailable' : actionQueue.loading ? 'Loading...' : `${actionQueue.count} PENDING`}
            </span>
          </div>

          {actionQueue.error ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#fbbf24', fontSize: '0.9rem' }}>
              <AlertTriangle size={26} style={{ margin: '0 auto 0.6rem', display: 'block' }} />
              {actionQueue.error}
            </div>
          ) : actionQueue.loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading action items...
            </div>
          ) : actionQueue.items.length === 0 ? (
            <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.85rem' }}>
                <CheckCircle2 size={24} color="#10b981" />
              </div>
              <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.92rem', marginBottom: '0.2rem' }}>Queue is Clear</div>
              <div style={{ color: '#94a3b8', fontSize: '0.82rem', maxWidth: '320px', lineHeight: '1.4' }}>
                No pending action items for your role on this project.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Stage</th>
                    <th>Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {actionQueue.items.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: '#fff' }}>{item.title}</td>
                      <td>
                        <span className="tag-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                          {item.category}
                        </span>
                      </td>
                      <td style={{ color: 'var(--accent-amber)' }}>{item.current_stage}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{item.submitted_date}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                          onClick={() => navigate(item.route || '/approvals')}
                        >
                          Review ➔
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/approvals')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
              <span>View Full Action Queue</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* WIDGET D: APPROVALS PENDING */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '340px', background: 'rgba(19, 29, 51, 0.75)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: approvalsPending.pending_count > 0 ? 'rgba(244, 63, 94, 0.14)' : 'rgba(16, 185, 129, 0.14)',
                border: approvalsPending.pending_count > 0 ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckSquare size={16} color={approvalsPending.pending_count > 0 ? '#f43f5e' : '#10b981'} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.02rem', color: '#f8fafc' }}>Approvals Pending</span>
            </div>
            <span className="tag-badge" style={{
              background: approvalsPending.error ? 'rgba(239,68,68,0.12)' : approvalsPending.pending_count > 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: approvalsPending.error ? '#f87171' : approvalsPending.pending_count > 0 ? '#f43f5e' : '#34d399',
              border: approvalsPending.pending_count > 0 ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              {approvalsPending.error ? 'Unavailable' : approvalsPending.loading ? 'Loading...' : `${approvalsPending.pending_count} REQUIRING ACTION`}
            </span>
          </div>

          {approvalsPending.error ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#fbbf24', fontSize: '0.9rem' }}>
              <AlertTriangle size={26} style={{ margin: '0 auto 0.6rem', display: 'block' }} />
              {approvalsPending.error}
            </div>
          ) : approvalsPending.loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading pending approvals...
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
              {/* Highlight Banner */}
              {approvalsPending.pending_count > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1rem 1.25rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                  <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#f87171', lineHeight: 1 }}>
                    {approvalsPending.pending_count}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
                      Multi-Stage Approvals Awaiting Sign-Off
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                      Role-aware and project-aware pending workflows requiring authorization
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1rem 1.25rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#34d399', lineHeight: 1 }}>
                    0
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
                      All Workflows Signed Off
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      No multi-stage approvals awaiting your authorization on this project.
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pending Workflow Tasks
                </div>
                {approvalsPending.items && approvalsPending.items.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {approvalsPending.items.slice(0, 3).map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.82rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: '#fff', fontWeight: 500 }}>{item.title}</span>
                        <span style={{ color: 'var(--accent-amber)', fontSize: '0.75rem', fontWeight: 600 }}>{item.current_stage}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic', padding: '0.25rem 0' }}>
                    0 pending approval tasks.
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/approvals')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
              <span>Open Approval Workspace</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* WIDGET B: SCHEDULE SNAPSHOT */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '360px', background: 'rgba(19, 29, 51, 0.75)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.14)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={16} color="#10b981" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.02rem', color: '#f8fafc' }}>Schedule Snapshot</span>
            </div>
            <span className="tag-badge" style={{
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              {dateRange.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {scheduleSnapshot.error ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#fbbf24', fontSize: '0.9rem' }}>
              <AlertTriangle size={26} style={{ margin: '0 auto 0.6rem', display: 'block' }} />
              {scheduleSnapshot.error}
            </div>
          ) : scheduleSnapshot.loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading schedule snapshot...
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* WBS Execution Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>WBS Execution Progress</span>
                  <span style={{ fontWeight: 800, color: '#10b981', fontSize: '0.95rem' }}>
                    {scheduleSnapshot.data.wbs_progress_pct || 0}%
                  </span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${Math.min(100, Math.max(0, scheduleSnapshot.data.wbs_progress_pct || 0))}%`, 
                      background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease'
                    }} 
                  />
                </div>
              </div>

              {/* WBS Node Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem', textAlign: 'center' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.65rem 0.5rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>{scheduleSnapshot.data.total_wbs_nodes ?? 0}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginTop: '0.1rem' }}>Total Nodes</div>
                </div>
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.65rem 0.5rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>{scheduleSnapshot.data.active_wbs_nodes ?? 0}</div>
                  <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, marginTop: '0.1rem' }}>Active</div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.65rem 0.5rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{scheduleSnapshot.data.completed_wbs_nodes ?? 0}</div>
                  <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, marginTop: '0.1rem' }}>Completed</div>
                </div>
                <div style={{ background: 'rgba(244, 63, 94, 0.08)', padding: '0.65rem 0.5rem', borderRadius: '10px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f43f5e' }}>{scheduleSnapshot.data.delayed_wbs_nodes ?? 0}</div>
                  <div style={{ fontSize: '0.72rem', color: '#f43f5e', fontWeight: 600, marginTop: '0.1rem' }}>Delayed</div>
                </div>
              </div>

              {/* Milestones Summary */}
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Milestones Overview
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(255,255,255,0.04)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>Total: <strong style={{ color: '#fff' }}>{scheduleSnapshot.data.total_milestones ?? 0}</strong></span>
                  <span style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>Completed: <strong>{scheduleSnapshot.data.completed_milestones ?? 0}</strong></span>
                  <span style={{ background: 'rgba(56, 189, 248, 0.08)', color: '#38bdf8', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>Upcoming: <strong>{scheduleSnapshot.data.upcoming_milestones ?? 0}</strong></span>
                  <span style={{ background: 'rgba(244, 63, 94, 0.08)', color: '#f43f5e', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>Delayed: <strong>{scheduleSnapshot.data.delayed_milestones ?? 0}</strong></span>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/wbs?project_id=${selectedProjectId}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
              <span>WBS Tree</span>
              <ArrowRight size={13} />
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/milestones?project_id=${selectedProjectId}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
              <span>Project Milestones</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* WIDGET C: COST SNAPSHOT */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '360px', background: 'rgba(19, 29, 51, 0.75)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.14)', border: '1px solid rgba(6, 182, 212, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={16} color="#06b6d4" />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1.02rem', color: '#f8fafc' }}>Cost Snapshot</span>
            </div>
            <span className="tag-badge" style={{
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              ESTIMATE VS BILLED
            </span>
          </div>

          {costSnapshot.error ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: '#fbbf24', fontSize: '0.9rem' }}>
              <AlertTriangle size={26} style={{ margin: '0 auto 0.6rem', display: 'block' }} />
              {costSnapshot.error}
            </div>
          ) : isSE ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <ShieldAlert size={28} color="var(--accent-amber)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              Cost Snapshot is restricted for your role. Contact Finance/PM for financial reports.
            </div>
          ) : costSnapshot.loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading cost metrics...
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              {/* Billed % Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Billed % of Detailed Estimate</span>
                  <span style={{ fontWeight: 800, color: '#38bdf8', fontSize: '0.95rem' }}>
                    {costSnapshot.data.billed_percentage || 0}%
                  </span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${Math.min(100, Math.max(0, costSnapshot.data.billed_percentage || 0))}%`, 
                      background: 'linear-gradient(90deg, #06b6d4 0%, #6366f1 100%)',
                      borderRadius: '9999px',
                      transition: 'width 0.4s ease'
                    }} 
                  />
                </div>
              </div>

              {/* Financial Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Detailed Estimate Total</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.25rem' }}>
                    ₹{(costSnapshot.data.estimate_total || 0).toLocaleString()}
                  </div>
                </div>

                <div style={{ background: 'rgba(6, 182, 212, 0.08)', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(6, 182, 212, 0.22)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Billed Amount</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
                    ₹{(costSnapshot.data.billed_total || 0).toLocaleString()}
                  </div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.22)', gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Remaining / Unbilled Amount</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>
                        ₹{(costSnapshot.data.remaining_amount || 0).toLocaleString()}
                      </div>
                    </div>
                    <span className="tag-badge tag-success" style={{ fontSize: '0.72rem', fontWeight: 700 }}>Available Budget</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/estimation')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
              <span>Detailed Estimate</span>
              <ArrowRight size={13} />
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/contractor-billing')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
              <span>Contractor Billing</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

      </div>

      {/* 3. FULL MODULES EXPANSION SECTION (COLLAPSED BY DEFAULT) */}
      <div className="glass-card" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
        
        {/* Expansion Header Toggle */}
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setIsFullModulesExpanded(!isFullModulesExpanded)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Sliders size={20} color="var(--primary)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>Full ERP System Modules</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Access full system modules, navigation hubs, and governance tools
              </div>
            </div>
          </div>

          <button type="button" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {isFullModulesExpanded ? (
              <>Collapse Modules <ChevronDown size={16} /></>
            ) : (
              <>Expand Full Modules <ChevronRight size={16} /></>
            )}
          </button>
        </div>

        {/* Collapsible Content Body */}
        {isFullModulesExpanded && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            
            {/* 1. SITE ENGINEER MODULES */}
            {isSE && (
              <div>
                <div className="kpi-grid">
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
                    <KpiCard title="Today's Site Progress" value={`${summaryData?.kpi?.avg_project_progress || 41.4}%`} icon={Activity} color="#10b981" subtext="Physical Progress" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/wbs')}>
                    <KpiCard title="Active WBS Tasks" value={8} icon={Layers} color="#38bdf8" subtext="In Execution Today" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/inventory')}>
                    <KpiCard title="Material Requests" value={3} icon={Package} color="#f59e0b" subtext="2 Approved, 1 Pending" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/hse')}>
                    <KpiCard title="Site Issues Raised" value={2} icon={AlertTriangle} color="#f43f5e" subtext="Safety & Obstructions" />
                  </div>
                </div>
              </div>
            )}

            {/* 2. PROJECT MANAGER MODULES */}
            {isPM && (
              <div>
                <div className="kpi-grid">
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
                    <KpiCard title="My Projects" value={projects.length || 2} icon={HardHat} color="#6366f1" subtext="Active Construction Sites" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
                    <KpiCard title="Portfolio Progress" value={`${currentProject.progress_pct || 38.2}%`} icon={Activity} color="#10b981" subtext="Weighted WBS Execution" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
                    <KpiCard title="Budget Utilization" value="84.9%" icon={DollarSign} color="#f59e0b" subtext="Committed vs Approved" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/approvals')}>
                    <KpiCard title="Pending Approvals" value={approvalsPending.pending_count || 0} icon={CheckSquare} color="#ef4444" subtext="Awaiting PM Approval" />
                  </div>
                </div>
              </div>
            )}

            {/* 3. FINANCE MODULES */}
            {isFinance && (
              <div>
                <div className="kpi-grid">
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/bookings')}>
                    <KpiCard title="Total Receivables" value="₹42,50,000" icon={DollarSign} color="#10b981" subtext="Customer Accounts Receivable" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/contractor-billing')}>
                    <KpiCard title="Total Payables" value={`₹${(costSnapshot.data.billed_total || 0).toLocaleString()}`} icon={Calculator} color="#f59e0b" subtext="Contractor & Vendor Bills" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/contractor-billing')}>
                    <KpiCard title="3-Way Match Verified" value="98.2%" icon={CheckCircle2} color="#06b6d4" subtext="PO-GRN-Invoice Matched" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/financial-requests')}>
                    <KpiCard title="Pending Financial Requests" value={4} icon={AlertTriangle} color="#f43f5e" subtext="Awaiting Financial Approval" />
                  </div>
                </div>
              </div>
            )}

            {/* 4. PROCUREMENT MODULES */}
            {isProcurement && (
              <div>
                <div className="kpi-grid">
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/procurement')}>
                    <KpiCard title="Material Requests (MPR)" value={8} icon={ShoppingCart} color="#818cf8" subtext="4 PRs Created" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/procurement')}>
                    <KpiCard title="Issued Purchase Orders (PO)" value={5} icon={FileText} color="#38bdf8" subtext="5 Active Vendor POs" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/inventory')}>
                    <KpiCard title="Low Stock Material Items" value={2} icon={Package} color="#f59e0b" subtext="Reorder Threshold Reached" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/vendors')}>
                    <KpiCard title="Active Vendor Directory" value={6} icon={Truck} color="#10b981" subtext="Registered Suppliers" />
                  </div>
                </div>
              </div>
            )}

            {/* 5. EXECUTIVE MANAGEMENT MODULES */}
            {isManagement && (
              <div>
                <div className="kpi-grid">
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
                    <KpiCard title="Portfolio Budget Committed" value="₹1,25,00,000" icon={DollarSign} color="#6366f1" subtext="Approved Baseline Budget" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
                    <KpiCard title="Overall Portfolio Progress" value="44.8%" icon={TrendingUp} color="#10b981" subtext="Overall Physical Completion" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/ai-analytics')}>
                    <KpiCard title="Profitability Margin" value="61.8%" icon={Sparkles} color="#06b6d4" subtext="Projected Portfolio Net Margin" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/approvals')}>
                    <KpiCard title="Executive Approvals Queue" value={approvalsPending.pending_count || 0} icon={CheckSquare} color="#f59e0b" subtext="High-Value Financial Approvals" />
                  </div>
                </div>
              </div>
            )}

            {/* 6. SYSTEM ADMIN MODULES */}
            {!isSE && !isPM && !isFinance && !isProcurement && !isManagement && (
              <div>
                <div className="kpi-grid">
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/users')}>
                    <KpiCard title="Total System Accounts" value={usersCount || 7} icon={Users} color="#6366f1" subtext={`${activeUsersCount || 7} Active User Accounts`} />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/roles-permissions')}>
                    <KpiCard title="Active RBAC Roles" value={10} icon={UserCog} color="#06b6d4" subtext="10 Configured Roles" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/approvals')}>
                    <KpiCard title="System Approvals Queue" value={approvalsPending.pending_count || 0} icon={CheckSquare} color="#f59e0b" subtext="Workflow Action Queue" />
                  </div>
                  <div style={{ cursor: 'pointer' }} onClick={() => navigate('/audit-logs')}>
                    <KpiCard title="Audit Activity Logs" value={recentAuditLogs.length || 5} icon={ShieldAlert} color="#10b981" subtext="Logged System Events" />
                  </div>
                </div>

                <div className="glass-card" style={{ marginTop: '1rem' }}>
                  <div className="card-header">
                    <div className="card-title"><Sliders size={18} color="var(--primary)" /> System Admin Governance Actions</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/users')}>+ Create User Account</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/roles-permissions')}>Configure Roles & Permissions</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/approval-authority')}>Approval Authority Matrix</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/audit-logs')}>View Audit Logs</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/settings')}>System Configuration</button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}
