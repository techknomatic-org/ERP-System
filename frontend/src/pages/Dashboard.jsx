import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, ShieldCheck, CheckSquare, HardHat, Building2, Key, DollarSign, 
  AlertTriangle, RefreshCw, Activity, Sliders, Plus, 
  UserCog, CheckCircle2, Filter, Layers, ClipboardList, ShoppingCart, Calculator, FileText, TrendingUp, Sparkles, Truck, ShieldAlert, Package, Briefcase
} from 'lucide-react';
import KpiCard from '../components/KpiCard';
import ProjectHealthBadge from '../components/ProjectHealthBadge';
import { dashboardService, projectService, propertyService, auditService, authService } from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();

  const [userRole, setUserRole] = useState(localStorage.getItem('erp_role') || 'admin');

  // Filter States
  const [projectIdFilter, setProjectIdFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');

  const [projectList, setProjectList] = useState([]);
  const [propertyList, setPropertyList] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [recentAuditLogs, setRecentAuditLogs] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = () => {
    setLoading(true);
    setError(null);

    const storedRole = localStorage.getItem('erp_role');
    if (storedRole) setUserRole(storedRole);

    projectService.getProjects()
      .then(res => setProjectList(res.data || []))
      .catch(err => console.error(err));

    propertyService.getProperties()
      .then(res => setPropertyList(res.data || []))
      .catch(err => console.error(err));

    authService.getUsers()
      .then(res => {
        const uList = res.data || [];
        setUsersCount(uList.length);
        setActiveUsersCount(uList.filter(u => u.is_active).length);
      })
      .catch(err => console.error(err));

    auditService.getLogs()
      .then(res => {
        setRecentAuditLogs((res.data || []).slice(0, 5));
      })
      .catch(err => console.error(err));

    dashboardService.getSummary()
      .then(res => setSummaryData(res.data))
      .catch(err => {
        console.error("Dashboard summary API error:", err);
        setError("Could not refresh live summary statistics. Showing cached view.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const kpi = summaryData?.kpi || {};
  const roleLower = (userRole || 'admin').toLowerCase();

  const isPM = roleLower === 'project_manager' || roleLower === 'pm';
  const isSE = roleLower === 'site_engineer' || roleLower === 'site';
  const isFinance = roleLower === 'finance';
  const isProcurement = roleLower === 'procurement';
  const isManagement = roleLower === 'management';
  const isCustomer = roleLower === 'customer';

  // Customer Redirect
  if (isCustomer) {
    return (
      <div className="content-page" style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', paddingTop: '3rem' }}>
        <div className="glass-card" style={{ padding: '3rem' }}>
          <Building2 size={48} color="var(--accent-emerald)" style={{ margin: '0 auto 1rem' }} />
          <h2>Welcome to Skyline Customer Portal</h2>
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

  return (
    <div className="content-page" style={{ maxWidth: '1280px' }}>
      {/* Header Bar */}
      <div className="section-header">
        <div>
          <h1 className="page-title">
            {isSE ? <HardHat size={28} color="var(--accent-emerald)" /> :
             isPM ? <HardHat size={28} color="var(--accent-amber)" /> :
             isFinance ? <DollarSign size={28} color="var(--accent-emerald)" /> :
             isProcurement ? <ShoppingCart size={28} color="var(--primary)" /> :
             isManagement ? <Briefcase size={28} color="var(--accent-cyan)" /> :
             <Building2 size={28} color="var(--primary)" />}
            {isSE ? "Site Engineer Command Center" :
             isPM ? "Project Manager Control Dashboard" :
             isFinance ? "Financial & Billing Workspace" :
             isProcurement ? "Procurement & Material Hub" :
             isManagement ? "Executive Management Portfolio" :
             "System Admin Control Center"}
          </h1>
          <p className="page-subtitle">
            {isManagement ? "Portfolio Governance, Profitability Margins & High-Value Approvals" :
             isProcurement ? "PR/PO Pipeline, Material Stock Health, GRN Deliveries & Vendor Directory" :
             "Live ERP Operations, Key Performance Indicators, and Workflows"}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="tag-badge tag-success">
            Active Role: {roleLower.replace('_', ' ').toUpperCase()}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchDashboardData}>
            <RefreshCw size={14} className={loading ? "spin-animation" : ""} /> Refresh Data
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-card" style={{ marginBottom: '1.25rem', borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.1)', color: '#fbbf24', fontSize: '0.85rem' }}>
          <AlertTriangle size={16} style={{ marginRight: '0.5rem' }} /> {error}
        </div>
      )}

      {/* 1. SITE ENGINEER DASHBOARD */}
      {isSE && (
        <div>
          <div className="kpi-grid">
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
              <KpiCard title="Today's Site Progress" value={`${kpi.avg_project_progress || 41.4}%`} icon={Activity} color="#10b981" subtext="Physical Progress" />
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

      {/* 2. PROJECT MANAGER DASHBOARD */}
      {isPM && (
        <div>
          <div className="kpi-grid">
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
              <KpiCard title="My Projects" value={kpi.total_projects || 2} icon={HardHat} color="#6366f1" subtext="2 Active Construction Sites" />
            </div>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
              <KpiCard title="Portfolio Progress" value={`${kpi.avg_project_progress || 38.2}%`} icon={Activity} color="#10b981" subtext="Weighted WBS Execution" />
            </div>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
              <KpiCard title="Budget Utilization" value="84.9%" icon={DollarSign} color="#f59e0b" subtext="Committed vs Approved" />
            </div>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/approvals')}>
              <KpiCard title="Pending Approvals" value={kpi.pending_approvals || 3} icon={CheckSquare} color="#ef4444" subtext="Awaiting PM Approval" />
            </div>
          </div>
        </div>
      )}

      {/* 3. FINANCE DASHBOARD */}
      {isFinance && (
        <div>
          <div className="kpi-grid">
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/bookings')}>
              <KpiCard title="Total Receivables" value="₹42,50,000" icon={DollarSign} color="#10b981" subtext="Customer Accounts Receivable" />
            </div>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/contractor-billing')}>
              <KpiCard title="Total Payables" value="₹18,20,000" icon={Calculator} color="#f59e0b" subtext="Contractor & Vendor Bills" />
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

      {/* 4. PROCUREMENT DASHBOARD */}
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

      {/* 5. EXECUTIVE MANAGEMENT DASHBOARD (Portfolio Governance) */}
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
              <KpiCard title="Executive Approvals Queue" value={2} icon={CheckSquare} color="#f59e0b" subtext="High-Value Financial Approvals" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
            <div className="glass-card">
              <div className="card-header">
                <div className="card-title"><Briefcase size={18} color="var(--accent-cyan)" /> Executive Portfolio Governance Overview</div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Review high-level project milestones, cash flow forecasts, financial exposure, and executive sign-off queues.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/projects')}>
                  Inspect Portfolio Projects
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/ai-analytics')}>
                  View AI Forecasts & Insights
                </button>
              </div>
            </div>

            <div className="glass-card">
              <div className="card-header">
                <div className="card-title"><ShieldAlert size={18} color="var(--accent-rose)" /> Major Risk Alerts</div>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>Skyline Commercial Tower - Phase 1</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-danger-text)', marginTop: '0.2rem' }}>
                Contractor bill discrepancy rate at 25.0%
              </div>
              <div style={{ marginTop: '0.85rem' }}>
                <ProjectHealthBadge health="amber" progress={44.8} budgetUtilization={82} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. SYSTEM ADMIN DASHBOARD (System & User Governance) */}
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
              <KpiCard title="System Approvals Queue" value={kpi.pending_approvals || 0} icon={CheckSquare} color="#f59e0b" subtext="Workflow Action Queue" />
            </div>
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/audit-logs')}>
              <KpiCard title="Audit Activity Logs" value={recentAuditLogs.length || 5} icon={ShieldAlert} color="#10b981" subtext="Logged System Events" />
            </div>
          </div>

          <div className="glass-card">
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
  );
}
