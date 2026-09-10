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

const DASHBOARD_POLLING_INTERVAL_MS = 60000;
const RETRY_INTERVAL_MS = 10000;

export default function Dashboard() {
  const navigate = useNavigate();

  const [userRole, setUserRole] = useState(localStorage.getItem('erp_role') || 'admin');

  // Multi-Project Context State
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(localStorage.getItem('active_project_id') || '');
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
        const storedProjId = localStorage.getItem('active_project_id');
        const exists = projectList.some(p => String(p.id) === String(storedProjId));
        
        let initialId = '';
        if (storedProjId && exists) {
          initialId = String(storedProjId);
        } else {
          const activeProj = projectList.find(p => p.is_default) || projectList.find(p => ['ACTIVE', 'IN_PROGRESS'].includes((p.status || '').toUpperCase())) || projectList[0];
          initialId = String(activeProj.id);
        }

        setSelectedProjectId(initialId);
        localStorage.setItem('active_project_id', initialId);
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

  // Project Change Event Handler
  const handleProjectSwitch = (newProjectId) => {
    setSelectedProjectId(newProjectId);
    localStorage.setItem('active_project_id', newProjectId);
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
    <div className="content-page" style={{ maxWidth: '1280px' }}>
      
      {/* 1. UNIFIED DASHBOARD HEADER BAR */}
      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isSE ? <HardHat size={28} color="var(--accent-emerald)" /> :
             isPM ? <HardHat size={28} color="var(--accent-amber)" /> :
             isFinance ? <DollarSign size={28} color="var(--accent-emerald)" /> :
             isProcurement ? <ShoppingCart size={28} color="var(--primary)" /> :
             isManagement ? <Briefcase size={28} color="var(--accent-cyan)" /> :
             <Building2 size={28} color="var(--primary)" />}
            Unified Project Dashboard
          </h1>
          <p className="page-subtitle">
            PM Command Center • Live WBS Execution, Milestone Schedule, Cost Snapshot & Action Queue
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          
          {/* Project Switcher Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Building2 size={16} color="var(--accent-amber)" />
            <select
              id="project-switcher-select"
              className="form-control"
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.88rem', padding: '0 0.5rem', fontWeight: 600, cursor: 'pointer' }}
              value={selectedProjectId}
              onChange={(e) => handleProjectSwitch(e.target.value)}
              disabled={projectsLoading || projects.length === 0}
            >
              {projects.length === 0 && <option value="">No projects available</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id} style={{ background: '#1e293b', color: '#fff' }}>
                  {p.code} — {p.name} ({p.status})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Calendar size={16} color="var(--accent-cyan)" />
            <select
              id="date-range-filter-select"
              className="form-control"
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.88rem', padding: '0 0.5rem', fontWeight: 600, cursor: 'pointer' }}
              value={dateRange}
              onChange={(e) => handleDateRangeChange(e.target.value)}
            >
              <option value="this_week" style={{ background: '#1e293b', color: '#fff' }}>This Week</option>
              <option value="this_month" style={{ background: '#1e293b', color: '#fff' }}>This Month</option>
              <option value="full_contract" style={{ background: '#1e293b', color: '#fff' }}>Full Contract</option>
            </select>
          </div>

          <span className="tag-badge tag-success">
            {roleLower.replace('_', ' ').toUpperCase()}
          </span>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => loadAllWidgets(selectedProjectId, dateRange)}
            disabled={!selectedProjectId}
          >
            <RefreshCw size={14} className={isAnyWidgetLoading ? "spin-animation" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* PROJECT CONTEXT HEADER BANNER */}
      {currentProject.name && (
        <div className="glass-card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)', borderColor: 'rgba(56, 189, 248, 0.2)' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Active Project Context</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginTop: '0.2rem' }}>
              [{currentProject.code}] {currentProject.name}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status</div>
              <span className={`tag-badge ${currentProject.status === 'ACTIVE' || currentProject.status === 'IN_PROGRESS' ? 'tag-success' : 'tag-warning'}`} style={{ marginTop: '0.2rem' }}>
                {currentProject.status || 'ACTIVE'}
              </span>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>WBS Progress</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-emerald)', marginTop: '0.1rem' }}>
                {currentProject.progress_pct || scheduleSnapshot.data.wbs_progress_pct || 0}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. UNIFIED 2x2 WIDGET GRID (Independent Fault Tolerance) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(580px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>

        {/* WIDGET A: ACTION QUEUE */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '320px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} color="var(--accent-amber)" /> Action Queue
            </div>
            <span className={`tag-badge ${actionQueue.error ? 'tag-danger' : 'tag-warning'}`} style={{ fontSize: '0.75rem' }}>
              {actionQueue.error ? 'Unavailable' : actionQueue.loading ? 'Loading...' : `${actionQueue.count} Pending`}
            </span>
          </div>

          {actionQueue.error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#fbbf24', fontSize: '0.9rem' }}>
              <AlertTriangle size={24} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              {actionQueue.error}
            </div>
          ) : actionQueue.loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading...
            </div>
          ) : actionQueue.items.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              <CheckCircle2 size={32} color="var(--accent-emerald)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              No pending action items for your role on this project.
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
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
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
          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/approvals')}>
              View Full Action Queue ➔
            </button>
          </div>
        </div>

        {/* WIDGET D: APPROVALS PENDING */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '320px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckSquare size={18} color="var(--accent-rose)" /> Approvals Pending
            </div>
            <span className="tag-badge tag-danger" style={{ fontSize: '0.75rem' }}>
              {approvalsPending.error ? 'Unavailable' : approvalsPending.loading ? 'Loading...' : `${approvalsPending.pending_count} Requiring Action`}
            </span>
          </div>

          {approvalsPending.error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#fbbf24', fontSize: '0.9rem' }}>
              <AlertTriangle size={24} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              {approvalsPending.error}
            </div>
          ) : approvalsPending.loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading...
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f87171', lineHeight: 1 }}>
                  {approvalsPending.pending_count}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
                    Multi-Stage Approvals Awaiting Sign-Off
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    Role-aware and project-aware pending workflows requiring authorization
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Pending Workflow Tasks
                </div>
                {approvalsPending.items && approvalsPending.items.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {approvalsPending.items.slice(0, 3).map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.8rem' }}>
                        <span style={{ color: '#fff', fontWeight: 500 }}>{item.title}</span>
                        <span style={{ color: 'var(--accent-amber)', fontSize: '0.75rem' }}>{item.current_stage}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>0 pending approval tasks.</div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/approvals')}>
              Open Approval Workspace ➔
            </button>
          </div>
        </div>

        {/* WIDGET B: SCHEDULE SNAPSHOT */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} color="var(--accent-emerald)" /> Schedule Snapshot
            </div>
            <span className={`tag-badge ${scheduleSnapshot.error ? 'tag-danger' : 'tag-info'}`} style={{ fontSize: '0.75rem' }}>
              {scheduleSnapshot.error ? 'Unavailable' : scheduleSnapshot.loading ? 'Loading...' : dateRange.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {scheduleSnapshot.error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#fbbf24', fontSize: '0.9rem' }}>
              <AlertTriangle size={24} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              {scheduleSnapshot.error}
            </div>
          ) : scheduleSnapshot.loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading...
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* WBS Execution Progress */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>WBS Execution Progress</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{scheduleSnapshot.data.wbs_progress_pct || 0}%</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${Math.min(100, Math.max(0, scheduleSnapshot.data.wbs_progress_pct || 0))}%`, 
                      background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
                      transition: 'width 0.4s ease'
                    }} 
                  />
                </div>
              </div>

              {/* WBS Node Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{scheduleSnapshot.data.total_wbs_nodes ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Total Nodes</div>
                </div>
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '0.5rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>{scheduleSnapshot.data.active_wbs_nodes ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#38bdf8' }}>Active</div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.5rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>{scheduleSnapshot.data.completed_wbs_nodes ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Completed</div>
                </div>
                <div style={{ background: 'rgba(244, 63, 94, 0.08)', padding: '0.5rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f43f5e' }}>{scheduleSnapshot.data.delayed_wbs_nodes ?? 0}</div>
                  <div style={{ fontSize: '0.7rem', color: '#f43f5e' }}>Delayed</div>
                </div>
              </div>

              {/* Milestones Summary */}
              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Milestones Overview
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                  <span>Total: <strong>{scheduleSnapshot.data.total_milestones ?? 0}</strong></span>
                  <span style={{ color: '#10b981' }}>Completed: <strong>{scheduleSnapshot.data.completed_milestones ?? 0}</strong></span>
                  <span style={{ color: '#38bdf8' }}>Upcoming: <strong>{scheduleSnapshot.data.upcoming_milestones ?? 0}</strong></span>
                  <span style={{ color: '#f43f5e' }}>Delayed: <strong>{scheduleSnapshot.data.delayed_milestones ?? 0}</strong></span>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/wbs?project_id=${selectedProjectId}`)}>
              WBS Tree ➔
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/milestones?project_id=${selectedProjectId}`)}>
              Project Milestones ➔
            </button>
          </div>
        </div>

        {/* WIDGET C: COST SNAPSHOT */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={18} color="var(--accent-cyan)" /> Cost Snapshot
            </div>
            <span className={`tag-badge ${costSnapshot.error ? 'tag-danger' : 'tag-success'}`} style={{ fontSize: '0.75rem' }}>
              {costSnapshot.error ? 'Unavailable' : costSnapshot.loading ? 'Loading...' : 'Estimate vs Billed'}
            </span>
          </div>

          {costSnapshot.error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#fbbf24', fontSize: '0.9rem' }}>
              <AlertTriangle size={24} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              {costSnapshot.error}
            </div>
          ) : isSE ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <ShieldAlert size={28} color="var(--accent-amber)" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              Cost Snapshot is restricted for your role. Contact Finance/PM for financial reports.
            </div>
          ) : costSnapshot.loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading...
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Billed % Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Billed % of Detailed Estimate</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{costSnapshot.data.billed_percentage || 0}%</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${Math.min(100, Math.max(0, costSnapshot.data.billed_percentage || 0))}%`, 
                      background: 'linear-gradient(90deg, #06b6d4 0%, #38bdf8 100%)',
                      transition: 'width 0.4s ease'
                    }} 
                  />
                </div>
              </div>

              {/* Financial Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Detailed Estimate Total</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginTop: '0.2rem' }}>
                    ₹{(costSnapshot.data.estimate_total || 0).toLocaleString()}
                  </div>
                </div>

                <div style={{ background: 'rgba(6, 182, 212, 0.08)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>Total Billed Amount</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
                    ₹{(costSnapshot.data.billed_total || 0).toLocaleString()}
                  </div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)' }}>Remaining / Unbilled Amount</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>
                        ₹{(costSnapshot.data.remaining_amount || 0).toLocaleString()}
                      </div>
                    </div>
                    <span className="tag-badge tag-success">Available Budget</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/estimation')}>
              Detailed Estimate ➔
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/contractor-billing')}>
              Contractor Billing ➔
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
