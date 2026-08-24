import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, HardHat, Calendar, MapPin, DollarSign, TrendingUp, Layers, 
  ClipboardList, FileSpreadsheet, CheckCircle2, ShoppingCart, Package, 
  Calculator, FileText, FileBarChart, Users, AlertTriangle, UserCheck, Plus, ChevronRight, Sparkles
} from 'lucide-react';
import { projectService, authService } from '../services/api';

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Expense modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: 'Materials', description: '', amount: '' });
  const [expenses, setExpenses] = useState([
    { id: 101, date: '2026-05-18', category: 'Foundation Concrete', description: 'Grade 40 Concrete Pour', amount: 45000, submitted_by: 'Site Engineer', status: 'APPROVED' },
    { id: 102, date: '2026-05-12', category: 'Steel Rebar', description: '20mm High Yield Rebar Supply', amount: 32000, submitted_by: 'Procurement Officer', status: 'APPROVED' }
  ]);

  // Issue modal state
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueForm, setIssueForm] = useState({ description: '', priority: 'MEDIUM', assigned_to: 'Site Manager' });
  const [issues, setIssues] = useState([
    { id: 201, description: 'Column C-12 Reinforcement Alignment', priority: 'HIGH', assigned_to: 'Site Engineer', created_date: '2026-05-15', due_date: '2026-05-20', status: 'IN PROGRESS', delay_impact: '2 Days' },
    { id: 202, description: 'Waterproofing Material Delay at Block B', priority: 'MEDIUM', assigned_to: 'Procurement Manager', created_date: '2026-05-10', due_date: '2026-05-18', status: 'OPEN', delay_impact: '3 Days' }
  ]);

  useEffect(() => {
    setLoading(true);
    
    projectService.getProjectById(id)
      .then((res) => setProject(res.data))
      .catch((err) => console.error("Error loading project details:", err));

    authService.getUsers()
      .then((res) => setTeamMembers(res.data || []))
      .catch((err) => console.error("Error loading team members:", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="content-page">
        <p style={{ color: '#94a3b8' }}>Loading project workspace from MySQL...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="content-page">
        <button className="btn btn-secondary" onClick={() => navigate('/projects')} style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={18} /> Back to My Projects
        </button>
        <p style={{ color: '#f43f5e' }}>Project not found in database.</p>
      </div>
    );
  }

  const budgetUsedPct = project.budget > 0 ? ((project.actual_cost / project.budget) * 100).toFixed(2) : 0;
  const remainingBudget = Math.max(0, project.budget - project.actual_cost);

  const handleAddExpense = (e) => {
    e.preventDefault();
    const newExp = {
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      category: expenseForm.category,
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount),
      submitted_by: 'Project Manager',
      status: 'APPROVED'
    };
    setExpenses([newExp, ...expenses]);
    setShowExpenseModal(false);
    setExpenseForm({ category: 'Materials', description: '', amount: '' });
  };

  const handleReportIssue = (e) => {
    e.preventDefault();
    const newIss = {
      id: Date.now(),
      description: issueForm.description,
      priority: issueForm.priority,
      assigned_to: issueForm.assigned_to,
      created_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 864000000).toISOString().split('T')[0],
      status: 'OPEN',
      delay_impact: '1 Day'
    };
    setIssues([newIss, ...issues]);
    setShowIssueModal(false);
    setIssueForm({ description: '', priority: 'MEDIUM', assigned_to: 'Site Manager' });
  };

  return (
    <div className="content-page">
      {/* Requirement 22: BREADCRUMB */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
        <span style={{ cursor: 'pointer', color: '#38bdf8' }} onClick={() => navigate('/projects')}>My Projects</span>
        <ChevronRight size={14} />
        <span style={{ color: '#f8fafc', fontWeight: 600 }}>{project.name}</span>
        <ChevronRight size={14} />
        <span style={{ color: '#f59e0b', textTransform: 'capitalize', fontWeight: 600 }}>{activeTab}</span>
      </div>

      {/* Requirement 5: PROJECT WORKSPACE HEADER */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '1.4rem' }}>{project.name}</h1>
            <span className="tag-badge tag-info" style={{ fontSize: '0.8rem' }}>{project.code}</span>
            <span className="tag-badge tag-success" style={{ fontSize: '0.8rem' }}>{project.status ? project.status.toUpperCase() : 'ACTIVE'}</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MapPin size={15} color="#06b6d4" /> Project location: {project.location}
          </div>
        </div>

        <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => navigate('/projects')}>
          <ArrowLeft size={15} /> Switch Project
        </button>
      </div>

      {/* Requirement 5: WORKSPACE TABS */}
      <div className="glass-card" style={{ marginBottom: '1.25rem', padding: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {[
          { key: 'overview', label: 'Overview', icon: HardHat },
          { key: 'team', label: 'Team', icon: Users },
          { key: 'wbs', label: 'WBS & Gantt', icon: Layers, route: `/wbs?projectId=${id}` },
          { key: 'tasks', label: 'Tasks', icon: Layers, route: `/wbs?projectId=${id}` },
          { key: 'sitelogs', label: 'Site Logs', icon: ClipboardList, route: `/site-logs?projectId=${id}` },
          { key: 'boq', label: 'BOQ', icon: FileSpreadsheet, route: `/boq-mb?projectId=${id}` },
          { key: 'budget', label: 'Budget', icon: DollarSign },
          { key: 'expenses', label: 'Expenses', icon: Calculator },
          { key: 'issues', label: 'Issues & Delays', icon: AlertTriangle },
        ].map(t => (
          <button
            key={t.key}
            className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
            onClick={() => {
              if (t.route) {
                navigate(t.route);
              } else {
                setActiveTab(t.key);
              }
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Requirement 6: OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div>
          {/* Top 4 KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="glass-card" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PROJECT PROGRESS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>{project.progress_pct}%</div>
            </div>

            <div className="glass-card" style={{ padding: '1rem', borderLeft: '4px solid #38bdf8' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>OPEN TASKS</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>12</div>
            </div>

            <div className="glass-card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>BUDGET USED</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.2rem' }}>{budgetUsedPct}%</div>
            </div>

            <div className="glass-card" style={{ padding: '1rem', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>OPEN ISSUES</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ef4444', marginTop: '0.2rem' }}>{issues.filter(i => i.status !== 'RESOLVED').length}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>Recent Project Activities & Progress</h3>
                <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => navigate(`/ai-analytics?projectId=${id}`)}>
                  View Progress Report →
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ padding: '0.75rem', background: 'rgba(15,23,42,0.6)', borderRadius: '6px', borderLeft: '3px solid #10b981' }}>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>Foundation Pouring Phase 1 Completed</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>Site Log approved by PM • Yesterday</div>
                </div>

                <div style={{ padding: '0.75rem', background: 'rgba(15,23,42,0.6)', borderRadius: '6px', borderLeft: '3px solid #f59e0b' }}>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>Rebar Material Request Submitted</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>50 Tons Grade 50 Rebar PR pending approval • 2 days ago</div>
                </div>
              </div>
            </div>

            {/* Upcoming Milestones */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#f8fafc' }}>Upcoming Milestones</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Ground Slab Completion</span>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>June 10</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>Superstructure Level 1</span>
                  <span style={{ color: '#818cf8', fontWeight: 600 }}>July 25</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Requirement 7: TEAM TAB */}
      {activeTab === 'team' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users color="#38bdf8" size={20} /> Project Team Members ({teamMembers.length})
          </h3>

          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Contact Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{u.full_name || u.username}</td>
                    <td><span className="tag-badge tag-secondary">{u.role}</span></td>
                    <td style={{ color: '#94a3b8' }}>Construction Operations</td>
                    <td style={{ color: '#38bdf8' }}>{u.email}</td>
                    <td><span className="tag-badge tag-success">{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Requirement 12: BUDGET TAB */}
      {activeTab === 'budget' && (
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', color: '#f8fafc' }}>Project Financial Budget Breakdown</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Original Budget</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>${project.budget.toLocaleString()}</div>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Revised Budget</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#818cf8', marginTop: '0.2rem' }}>${project.budget.toLocaleString()}</div>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Actual Spent</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>${project.actual_cost.toLocaleString()}</div>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Remaining Budget</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>${remainingBudget.toLocaleString()}</div>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Utilization %</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.2rem' }}>{budgetUsedPct}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Requirement 13: EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>Project Expenses Records</h3>
            <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowExpenseModal(true)}>
              <Plus size={16} /> + Add Expense
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Expense ID</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Submitted By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600, color: '#818cf8' }}>#{e.id}</td>
                    <td style={{ color: '#94a3b8' }}>{e.date}</td>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{e.category}</td>
                    <td style={{ color: '#cbd5e1' }}>{e.description}</td>
                    <td style={{ fontWeight: 700, color: '#10b981' }}>${e.amount.toLocaleString()}</td>
                    <td style={{ color: '#94a3b8' }}>{e.submitted_by}</td>
                    <td><span className="tag-badge tag-success">{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Requirement 14: ISSUES & DELAYS TAB */}
      {activeTab === 'issues' && (
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>Project Issues & Delay Log</h3>
            <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowIssueModal(true)}>
              <Plus size={16} /> + Report Issue
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Issue ID</th>
                  <th>Description</th>
                  <th>Priority</th>
                  <th>Assigned To</th>
                  <th>Created Date</th>
                  <th>Expected Resolution</th>
                  <th>Delay Impact</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {issues.map(i => (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 600, color: '#818cf8' }}>#{i.id}</td>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{i.description}</td>
                    <td><span className={`tag-badge ${i.priority === 'HIGH' ? 'tag-danger' : 'tag-warning'}`}>{i.priority}</span></td>
                    <td style={{ color: '#38bdf8' }}>{i.assigned_to}</td>
                    <td style={{ color: '#94a3b8' }}>{i.created_date}</td>
                    <td style={{ color: '#cbd5e1' }}>{i.due_date}</td>
                    <td style={{ color: '#f43f5e', fontWeight: 600 }}>{i.delay_impact}</td>
                    <td><span className="tag-badge tag-warning">{i.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '440px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Add Project Expense</h3>
            <form onSubmit={handleAddExpense}>
              <div className="form-group">
                <label>Expense Category</label>
                <input required type="text" className="form-control" placeholder="e.g. Concrete, Steel, Site Labor" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input required type="text" className="form-control" placeholder="Details of project expenditure" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Amount ($)</label>
                <input required type="number" step="0.01" className="form-control" placeholder="15000" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Issue Modal */}
      {showIssueModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '440px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Report Site Issue / Delay</h3>
            <form onSubmit={handleReportIssue}>
              <div className="form-group">
                <label>Issue Description</label>
                <input required type="text" className="form-control" placeholder="e.g. Material delivery delay at Block A" value={issueForm.description} onChange={e => setIssueForm({ ...issueForm, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select className="form-control" value={issueForm.priority} onChange={e => setIssueForm({ ...issueForm, priority: e.target.value })}>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
              <div className="form-group">
                <label>Assigned Responsibility</label>
                <input required type="text" className="form-control" placeholder="e.g. Site Engineer" value={issueForm.assigned_to} onChange={e => setIssueForm({ ...issueForm, assigned_to: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowIssueModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Issue</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
