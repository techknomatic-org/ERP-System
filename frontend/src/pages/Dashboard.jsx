import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, ShieldCheck, CheckSquare, HardHat, Building2, Key, DollarSign, 
  AlertTriangle, RefreshCw, ArrowRight, Activity, Sliders, Lock, Plus, 
  UserPlus, UserCog, Shield, CheckCircle2, ChevronDown, ChevronRight, Filter, Settings, Database, Clock, Layers, ClipboardList, ShoppingCart, Calculator, FileText, FileBarChart, TrendingUp, Sparkles
} from 'lucide-react';
import KpiCard from '../components/KpiCard';
import { dashboardService, projectService, propertyService, auditService, authService } from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();

  const [userRole, setUserRole] = useState(localStorage.getItem('erp_role') || 'admin');

  // Filters
  const [projectIdFilter, setProjectIdFilter] = useState('');
  const [propertyIdFilter, setPropertyIdFilter] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');

  const [projectList, setProjectList] = useState([]);
  const [propertyList, setPropertyList] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [recentAuditLogs, setRecentAuditLogs] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sample Financial Transactions
  const financialTransactions = [
    { id: 'TX-901', type: 'Payment', party: 'ABC Corp Client', project: 'Skyline Business Tower', amount: 125000, date: '2026-05-18', status: 'PAID' },
    { id: 'TX-902', type: 'Invoice', party: 'Apex Construction', project: 'Skyline Commercial Tower', amount: 45000, date: '2026-05-17', status: 'ISSUED' },
    { id: 'TX-903', type: 'Contractor Bill', party: 'BuildTech Contractors', project: 'Skyline Business Tower', amount: 85000, date: '2026-05-16', status: 'PARTIALLY PAID' },
    { id: 'TX-904', type: 'Expense', party: 'Metro Steel Supply', project: 'Residential Phase 1', amount: 32000, date: '2026-05-15', status: 'APPROVED' },
    { id: 'TX-905', type: 'Invoice', party: 'Global Tech Park', project: 'Skyline Business Tower', amount: 220000, date: '2026-05-14', status: 'OVERDUE' }
  ];

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
        setError("Could not refresh live summary statistics. Showing available dashboard views.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading && !summaryData) {
    return (
      <div className="content-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#94a3b8' }}>
          <RefreshCw className="spin" size={20} color="#10b981" />
          <span>Loading Dashboard Workspace...</span>
        </div>
      </div>
    );
  }

  const kpi = summaryData?.kpi || {};
  const project_overview = summaryData?.project_overview || [];
  const pendingApprovals = kpi.pending_approvals || 0;
  const activePct = usersCount > 0 ? Math.round((activeUsersCount / usersCount) * 100) : 100;
  const roleLower = (userRole || '').toLowerCase();
  const isPM = roleLower === 'project_manager';
  const isSE = roleLower === 'site_engineer';
  const isFinance = roleLower === 'finance';

  // --- 1. DEDICATED FINANCE DASHBOARD VIEW ---
  if (isFinance) {
    return (
      <div className="content-page" style={{ maxWidth: '1240px' }}>
        {/* Top Header */}
        <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.4rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={26} color="#10b981" /> Finance Dashboard
            </h1>
            <p className="page-subtitle" style={{ fontSize: '0.85rem' }}>
              Financial overview, collections, payments and project profitability
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="tag-badge tag-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem' }}>
              <DollarSign size={14} /> Finance Control Center
            </span>
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={fetchDashboardData}>
              <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="glass-card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderLeft: '4px solid #f59e0b', color: '#f59e0b', fontSize: '0.85rem' }}>
            <AlertTriangle size={16} style={{ display: 'inline', marginRight: '0.5rem' }} /> {error}
          </div>
        )}

        {/* Finance Filters Bar */}
        <div className="glass-card" style={{ marginBottom: '1.25rem', padding: '0.75rem 1.1rem', background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 600, fontSize: '0.8rem' }}>
              <Filter size={15} /> Financial Filters:
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Project:</span>
              <select className="form-control" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', minWidth: '180px' }} value={projectIdFilter} onChange={e => setProjectIdFilter(e.target.value)}>
                <option value="">All Projects</option>
                {projectList.map(p => (
                  <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Date Range:</span>
              <select className="form-control" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }} value={dateRangeFilter} onChange={e => setDateRangeFilter(e.target.value)}>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Fiscal Year</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
        </div>

        {/* 8 COMPACT 4-COLUMN FINANCE KPI CARDS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/bookings')}>
            <KpiCard title="Total Receivables" value="$4,250,000" icon={DollarSign} color="#10b981" trend="Accounts Receivable →" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/contractor-billing')}>
            <KpiCard title="Total Payables" value="$1,820,000" icon={Calculator} color="#f59e0b" trend="Accounts Payable →" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/tally')}>
            <KpiCard title="Total Revenue" value="$8,950,000" icon={TrendingUp} color="#38bdf8" trend="Booked Revenue" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/contractor-billing')}>
            <KpiCard title="Total Expenses" value="$3,420,000" icon={DollarSign} color="#818cf8" trend="Project Expenditures" />
          </div>

          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/bookings')}>
            <KpiCard title="Overdue Amount" value="$345,000" icon={AlertTriangle} color="#ef4444" trend="5 Overdue Invoices →" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/bookings')}>
            <KpiCard title="Payments Received" value="$1,250,000" icon={CheckCircle2} color="#10b981" trend="This Month Collections" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/bookings')}>
            <KpiCard title="Pending Invoices" value="14 Invoices" icon={FileText} color="#f59e0b" trend="Issued Invoices →" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
            <KpiCard title="Project Profitability" value="61.8% Margin" icon={Sparkles} color="#06b6d4" trend="Average Project Profit" />
          </div>
        </div>

        {/* FINANCIAL ALERTS / ACTION REQUIRED */}
        <div className="glass-card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={16} /> FINANCIAL ACTION REQUIRED
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
            <div style={{ padding: '0.85rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => navigate('/bookings')}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>🔴 5 Overdue Invoices</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>$221,500 outstanding total</div>
              </div>
              <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>View</button>
            </div>

            <div style={{ padding: '0.85rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => navigate('/contractor-billing')}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>🟠 3 Payments Due Soon</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>$145,000 due this week</div>
              </div>
              <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>View</button>
            </div>

            <div style={{ padding: '0.85rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => navigate('/contractor-billing')}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>🟡 4 Pending Contractor Bills</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>$85,000 awaiting sign-off</div>
              </div>
              <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>View</button>
            </div>

            <div style={{ padding: '0.85rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => navigate('/bookings')}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>🔵 2 Unpaid Invoices</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>$180,000 pending deposit</div>
              </div>
              <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}>View</button>
            </div>
          </div>
        </div>

        {/* RECEIVABLES AGING SUMMARY */}
        <div className="glass-card" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#f8fafc' }}>Receivables Aging Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '0.85rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)' }}>
              <div style={{ fontSize: '0.75rem', color: '#10b981' }}>0–30 DAYS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>$1,800,000</div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>Current Invoices</div>
            </div>

            <div style={{ padding: '0.85rem', background: 'rgba(56,189,248,0.1)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.3)' }}>
              <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>31–60 DAYS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8' }}>$1,200,000</div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>Due Soon</div>
            </div>

            <div style={{ padding: '0.85rem', background: 'rgba(245,158,11,0.1)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>61–90 DAYS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b' }}>$650,000</div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>Mild Overdue</div>
            </div>

            <div style={{ padding: '0.85rem', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>90+ DAYS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444' }}>$600,000</div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>Critical Aging</div>
            </div>
          </div>
        </div>

        {/* RECENT FINANCIAL TRANSACTIONS TABLE */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>Recent Financial Transactions</h3>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => navigate('/bookings')}>
              View All Invoices ➔
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Type</th>
                  <th>Customer / Vendor</th>
                  <th>Project</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {financialTransactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontWeight: 600, color: '#818cf8' }}>{tx.id}</td>
                    <td><span className="tag-badge tag-info">{tx.type}</span></td>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{tx.party}</td>
                    <td style={{ color: '#38bdf8' }}>{tx.project}</td>
                    <td style={{ fontWeight: 700, color: '#10b981' }}>${tx.amount.toLocaleString()}</td>
                    <td style={{ color: '#94a3b8' }}>{tx.date}</td>
                    <td>
                      <span className={`tag-badge ${tx.status === 'PAID' || tx.status === 'APPROVED' ? 'tag-success' : tx.status === 'OVERDUE' ? 'tag-danger' : 'tag-warning'}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={() => navigate('/bookings')}>
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    );
  }

  // --- 2. DEDICATED SITE ENGINEER DASHBOARD VIEW ---
  if (isSE) {
    return (
      <div className="content-page" style={{ maxWidth: '1240px' }}>
        {/* Top Header */}
        <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.4rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HardHat size={26} color="#10b981" /> Site Dashboard
            </h1>
            <p className="page-subtitle" style={{ fontSize: '0.85rem' }}>
              Monitor today's site activities, progress, resources and issues
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="tag-badge tag-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem' }}>
              <HardHat size={14} /> Site Engineer Workspace
            </span>
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={fetchDashboardData}>
              <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="glass-card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderLeft: '4px solid #f59e0b', color: '#f59e0b', fontSize: '0.85rem' }}>
            <AlertTriangle size={16} style={{ display: 'inline', marginRight: '0.5rem' }} /> {error}
          </div>
        )}

        {/* Site Selectors Bar */}
        <div className="glass-card" style={{ marginBottom: '1.25rem', padding: '0.75rem 1.1rem', background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 600, fontSize: '0.8rem' }}>
              <Filter size={15} /> Site Selectors:
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Assigned Site:</span>
              <select className="form-control" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', minWidth: '200px' }} value={projectIdFilter} onChange={e => setProjectIdFilter(e.target.value)}>
                <option value="">My Assigned Sites</option>
                {projectList.map(p => (
                  <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Execution Period:</span>
              <select className="form-control" style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }} value={dateRangeFilter} onChange={e => setDateRangeFilter(e.target.value)}>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
          </div>
        </div>

        {/* 7 SITE EXECUTION KPI CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
            <KpiCard title="TODAY'S PROGRESS" value={`${kpi.avg_project_progress || 41.43}%`} icon={Activity} color="#10b981" trend="Physical Site Progress" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/wbs')}>
            <KpiCard title="TASKS TODAY" value={8} icon={Layers} color="#38bdf8" trend="8 Site WBS Activities" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/wbs')}>
            <KpiCard title="COMPLETED TASKS" value={5} icon={CheckCircle2} color="#10b981" trend="5 Completed Today" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/inventory')}>
            <KpiCard title="MANPOWER ON SITE" value={42} icon={Users} color="#818cf8" trend="42 Active Workers" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/hse')}>
            <KpiCard title="OPEN SITE ISSUES" value={2} icon={AlertTriangle} color="#f43f5e" trend="2 Open Site Logs" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/procurement')}>
            <KpiCard title="PENDING MATERIAL REQUESTS" value={1} icon={ShoppingCart} color="#f59e0b" trend="1 Material Request" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/approvals')}>
            <KpiCard title="PENDING APPROVALS" value={1} icon={CheckSquare} color="#38bdf8" trend="1 Awaiting Sign-off" />
          </div>
        </div>
      </div>
    );
  }

  // --- 3. DEDICATED PROJECT MANAGER DASHBOARD VIEW ---
  if (isPM) {
    return (
      <div className="content-page" style={{ maxWidth: '1240px' }}>
        {/* Top Header */}
        <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.4rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HardHat size={26} color="#f59e0b" /> Project Manager Dashboard
            </h1>
            <p className="page-subtitle" style={{ fontSize: '0.85rem' }}>
              Monitor project execution, progress, cost, resources and approvals.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="tag-badge tag-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem' }}>
              <HardHat size={14} /> Project Manager Workspace
            </span>
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={fetchDashboardData}>
              <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="glass-card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderLeft: '4px solid #f59e0b', color: '#f59e0b', fontSize: '0.85rem' }}>
            <AlertTriangle size={16} style={{ display: 'inline', marginRight: '0.5rem' }} /> {error}
          </div>
        )}

        {/* 8 PM KPI CARDS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
            <KpiCard title="My Projects" value={kpi.total_projects || 2} icon={HardHat} color="#6366f1" trend={`${kpi.active_projects || 2} Active Projects`} />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/wbs')}>
            <KpiCard title="Active Tasks" value={24} icon={Layers} color="#38bdf8" trend="24 Tasks In Execution" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
            <KpiCard title="Project Completion" value={`${kpi.avg_project_progress || 38.2}%`} icon={Activity} color="#10b981" trend="WBS Weighted Progress" />
          </div>
          <div style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
            <KpiCard title="Budget Utilization" value="84.9%" icon={DollarSign} color="#f59e0b" trend="Approved Budget vs Actual" />
          </div>
        </div>
      </div>
    );
  }

  // --- 4. SYSTEM ADMIN CONTROL CENTER VIEW ---
  return (
    <div className="content-page" style={{ maxWidth: '1240px' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.4rem' }}>System Admin & Control Center</h1>
          <p className="page-subtitle" style={{ fontSize: '0.85rem' }}>Centralized administration, security, permissions and ERP monitoring</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="tag-badge tag-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem' }}>
            <ShieldCheck size={14} /> System Admin Mode Active
          </span>
          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={fetchDashboardData}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderLeft: '4px solid #f59e0b', color: '#f59e0b', fontSize: '0.85rem' }}>
          <AlertTriangle size={16} style={{ display: 'inline', marginRight: '0.5rem' }} /> {error}
        </div>
      )}

      {/* SYSTEM ADMIN METRICS */}
      <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/users')}>
          <KpiCard title="TOTAL USERS" value={usersCount || 7} icon={Users} color="#6366f1" trend={`${activeUsersCount || 7} Active Accounts → Manage Users`} />
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/users')}>
          <KpiCard title="ACTIVE USERS" value={activeUsersCount || 7} icon={ShieldCheck} color="#10b981" trend={`${activePct}% Active Status`} />
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/roles-permissions')}>
          <KpiCard title="ACTIVE ROLES" value={10} icon={UserCog} color="#06b6d4" trend="10 Active RBAC Roles" />
        </div>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/approvals')}>
          <KpiCard title="PENDING APPROVALS" value={pendingApprovals} icon={CheckSquare} color={pendingApprovals > 0 ? "#ef4444" : "#10b981"} trend="Awaiting Stage Sign-off" />
        </div>
      </div>
    </div>
  );
}
