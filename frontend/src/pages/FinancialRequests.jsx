import React, { useEffect, useState } from 'react';
import { DollarSign, Plus, CheckCircle2, XCircle, RotateCcw, ShieldCheck, UserCheck, ArrowRight, FileText, Clock, AlertTriangle, Building2, HardHat } from 'lucide-react';
import { approvalService, projectService, vendorService } from '../services/api';

const ROLES = [
  { key: 'site_engineer', label: 'Site Engineer', stage: 'Site Engineer' },
  { key: 'project_manager', label: 'Project Manager', stage: 'Project Manager' },
  { key: 'finance', label: 'Finance & Accounts', stage: 'Finance' },
  { key: 'management', label: 'Management', stage: 'Management' },
  { key: 'admin', label: 'System Admin (All)', stage: 'Admin' }
];

const FINANCIAL_REQUEST_TYPES = [
  "Contractor Bill Payment",
  "Vendor Payment",
  "Purchase Payment",
  "Other Financial Request"
];

const PAYMENT_TYPES = [
  "Bank Transfer / Wire",
  "NEFT / RTGS",
  "Cheque Payment",
  "Letter of Credit (LC)"
];

export default function FinancialRequests() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState(localStorage.getItem('erp_role') || 'admin');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDetails, setTaskDetails] = useState(null);
  const [actionComments, setActionComments] = useState('');

  const [formData, setFormData] = useState({
    project_id: '1',
    request_type: 'Contractor Bill Payment',
    vendor_name: '',
    bill_number: '',
    bill_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_type: 'Bank Transfer / Wire',
    description: '',
    supporting_doc: ''
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      approvalService.getTasks(activeRole, activeTab === 'pending' ? 'pending' : 'history'),
      projectService.getProjects(),
      vendorService.getVendors()
    ])
      .then(([tasksRes, prjRes, vndRes]) => {
        // Filter financial requests only for this module
        const finTasks = tasksRes.data.filter(t => t.is_financial || t.category?.toLowerCase().includes('financial'));
        setTasks(finTasks);
        setProjects(prjRes.data);
        setVendors(vndRes.data);
      })
      .catch((err) => console.error("Error loading financial requests:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [activeRole, activeTab]);

  const handleRoleChange = (newRole) => {
    setActiveRole(newRole);
    localStorage.setItem('erp_role', newRole);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const prj = projects.find(p => p.id === parseInt(formData.project_id)) || projects[0];
    const prjName = prj ? prj.name : `Project #${formData.project_id}`;
    const titleStr = `${formData.request_type} #${formData.bill_number || '502'} (${formData.vendor_name || 'Vendor'}) - ${prjName}`;

    approvalService.createTask({
      title: titleStr,
      entity_type: "CONTRACTOR_BILL",
      entity_id: Math.floor(Math.random() * 90000) + 10000,
      current_stage: "Site Engineer"
    })
      .then(() => {
        setShowCreateModal(false);
        setFormData({
          project_id: projects[0]?.id || '1',
          request_type: 'Contractor Bill Payment',
          vendor_name: '',
          bill_number: '',
          bill_date: new Date().toISOString().split('T')[0],
          amount: '',
          payment_type: 'Bank Transfer / Wire',
          description: '',
          supporting_doc: ''
        });
        alert("Financial Request created successfully! Automatically classified as Category = FINANCIAL (Site Engineer → PM → Finance → Management).");
        loadData();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to create financial request"));
  };

  const openProcessModal = (task) => {
    setSelectedTask(task);
    setTaskDetails(null);
    setActionComments('');
    approvalService.getTaskDetails(task.id)
      .then((res) => setTaskDetails(res.data))
      .catch(() => setTaskDetails(task));
  };

  const handleAction = (taskId, action) => {
    approvalService.processAction(taskId, action, actionComments, activeRole)
      .then(() => {
        setSelectedTask(null);
        setTaskDetails(null);
        setActionComments('');
        loadData();
      })
      .catch((err) => alert(err.response?.data?.detail || "Action failed"));
  };

  const isUserAuthorizedForStage = (task) => {
    if (!task) return false;
    const reqStage = task.current_stage || task.currentApprovalStage;
    if (reqStage === 'Site Engineer' && activeRole === 'site_engineer') return true;
    if (reqStage === 'Project Manager' && activeRole === 'project_manager') return true;
    if (reqStage === 'Finance' && activeRole === 'finance') return true;
    if (reqStage === 'Management' && activeRole === 'management') return true;
    return false;
  };

  const renderStageTracker = (task) => {
    const stages = ["Site Engineer", "Project Manager", "Finance", "Management"];
    const stageDetails = task.approval_stages || task.approvalStages || [];
    const currStage = task.current_stage || task.currentApprovalStage;
    const currIdx = stages.indexOf(currStage);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        {stages.map((stg, idx) => {
          let statusStyle = { background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' };
          let iconChar = '○';

          const stgInfo = stageDetails.find(s => s.role === stg);
          const stgStatus = stgInfo ? (stgInfo.status || '').toLowerCase() : (task.status === 'approved' || task.overallStatus === 'FULLY APPROVED' ? 'approved' : (idx < currIdx ? 'approved' : (idx === currIdx ? 'pending' : 'waiting')));

          if (stgStatus === 'approved' || task.status === 'approved' || task.overallStatus === 'FULLY APPROVED') {
            statusStyle = { background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' };
            iconChar = '✓';
          } else if (stgStatus === 'rejected' || (task.status === 'rejected' && idx === currIdx)) {
            statusStyle = { background: 'rgba(244,63,94,0.15)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' };
            iconChar = '✕';
          } else if (stgStatus === 'pending' || (idx === currIdx && task.status === 'pending')) {
            statusStyle = { background: 'rgba(56,189,248,0.2)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.4)', fontWeight: 700 };
            iconChar = '●';
          }

          return (
            <React.Fragment key={stg}>
              <span
                style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  ...statusStyle
                }}
              >
                <span>{iconChar}</span>
                <span>{stg}</span>
              </span>
              {idx < stages.length - 1 && <ArrowRight size={12} color="#64748b" />}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="content-page">
      {/* Header */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Financial Requests & Sequential Approvals Module</h1>
          <p className="page-subtitle">
            Automated Financial Workflow (Category = FINANCIAL): Site Engineer → Project Manager → Finance → Management
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={18} /> Submit Financial Request
        </button>
      </div>

      {/* Role Display / Admin Switcher (Section 2 & 12) */}
      <div className="glass-card" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', background: 'rgba(15,23,42,0.7)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserCheck size={18} color="#10b981" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
            Logged-In User Persona: <strong style={{ color: '#10b981' }}>{activeRole.replace('_', ' ').toUpperCase()}</strong>
          </span>
        </div>

        {activeRole === 'admin' ? (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', alignSelf: 'center', marginRight: '0.4rem' }}>Admin Persona Switcher (Testing):</span>
            {ROLES.map(r => {
              const isSelected = activeRole === r.key;
              return (
                <button
                  key={r.key}
                  className="btn"
                  style={{
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    background: isSelected ? 'linear-gradient(135deg, #10b981, #047857)' : 'rgba(255,255,255,0.05)',
                    color: isSelected ? '#ffffff' : '#cbd5e1',
                    border: isSelected ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                    fontWeight: isSelected ? 700 : 500
                  }}
                  onClick={() => handleRoleChange(r.key)}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: '0.8rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.3rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.3)' }}>
            🔒 Authenticated Session Role: <strong>{activeRole.replace('_', ' ').toUpperCase()}</strong>
          </div>
        )}
      </div>

      {/* Navigation Tabs (My Pending Approvals vs Persistent Approval History) */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '0.45rem 1.1rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: activeTab === 'pending' ? 700 : 500,
            background: activeTab === 'pending' ? 'rgba(16,185,129,0.15)' : 'transparent',
            color: activeTab === 'pending' ? '#10b981' : '#94a3b8',
            border: activeTab === 'pending' ? '1px solid #10b981' : '1px solid transparent',
            cursor: 'pointer'
          }}
        >
          My Pending Approvals
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '0.45rem 1.1rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            fontWeight: activeTab === 'history' ? 700 : 500,
            background: activeTab === 'history' ? 'rgba(56,189,248,0.15)' : 'transparent',
            color: activeTab === 'history' ? '#38bdf8' : '#94a3b8',
            border: activeTab === 'history' ? '1px solid #38bdf8' : '1px solid transparent',
            cursor: 'pointer'
          }}
        >
          Approval History & Processed Requests
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Request Title / Invoice</th>
              <th>Category</th>
              <th>Approval Stage Tracker</th>
              <th>Overall Status</th>
              <th>Current Approver</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                  {loading ? "Loading financial requests..." : `No ${activeTab} financial requests for role '${activeRole.replace('_', ' ').toUpperCase()}'.`}
                </td>
              </tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <DollarSign size={16} color="#10b981" />
                      <span>{t.title}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span className="tag-badge tag-success" style={{ width: 'fit-content', fontWeight: 700 }}>
                        FINANCIAL
                      </span>
                      <span style={{ fontSize: '0.73rem', color: '#94a3b8', fontWeight: 500 }}>
                        {t.displaySublabel || t.display_sublabel || '(Contractor Payment)'}
                      </span>
                    </div>
                  </td>
                  <td>{renderStageTracker(t)}</td>
                  <td>
                    <span className={`tag-badge ${
                      t.status === 'approved' || t.overallStatus === 'FULLY APPROVED' ? 'tag-success' :
                      t.status === 'rejected' ? 'tag-danger' : 'tag-info'
                    }`}>
                      {(t.overallStatus || t.status).toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>
                    {t.status === 'approved' ? 'Completed' : t.current_stage || t.currentApprovalStage}
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                      onClick={() => openProcessModal(t)}
                    >
                      {activeTab === 'pending' ? 'Process Request' : 'View History'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Submit Financial Request Modal (Requirement 1) */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '560px', background: '#1e293b', maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
              <DollarSign size={22} /> Submit Financial Request
            </h3>

            <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
              Automatic Category: <strong style={{ color: '#10b981' }}>FINANCIAL</strong>
              <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: '#94a3b8' }}>
                Approval Workflow Chain: <code>Site Engineer → Project Manager → Finance → Management</code>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label>Select Project</label>
                <select required className="form-control" value={formData.project_id} onChange={e => setFormData({ ...formData, project_id: e.target.value })}>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Request Type</label>
                  <select required className="form-control" value={formData.request_type} onChange={e => setFormData({ ...formData, request_type: e.target.value })}>
                    {FINANCIAL_REQUEST_TYPES.map(rt => (
                      <option key={rt} value={rt}>{rt}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Contractor / Vendor</label>
                  <input required type="text" className="form-control" placeholder="ABC Construction Corp" value={formData.vendor_name} onChange={e => setFormData({ ...formData, vendor_name: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Bill Number</label>
                  <input required type="text" className="form-control" placeholder="INV-502" value={formData.bill_number} onChange={e => setFormData({ ...formData, bill_number: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Bill Date</label>
                  <input required type="date" className="form-control" value={formData.bill_date} onChange={e => setFormData({ ...formData, bill_date: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Bill Amount ($ / ₹)</label>
                  <input required type="number" step="0.01" className="form-control" placeholder="500000.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Payment Type</label>
                  <select required className="form-control" value={formData.payment_type} onChange={e => setFormData({ ...formData, payment_type: e.target.value })}>
                    {PAYMENT_TYPES.map(pt => (
                      <option key={pt} value={pt}>{pt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description / Purpose</label>
                <textarea required className="form-control" rows="2" placeholder="Foundation concrete pour milestone payment..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Supporting Documents / Invoice</label>
                <input type="text" className="form-control" placeholder="Contractor_Bill_502.pdf" value={formData.supporting_doc} onChange={e => setFormData({ ...formData, supporting_doc: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Financial Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Action Modal with Permanent History */}
      {selectedTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '620px', background: '#1e293b', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={22} color="#10b981" />
                <span>{selectedTask.title}</span>
              </h3>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                Current Approval Stage: <strong style={{ color: '#10b981' }}>{selectedTask.current_stage || selectedTask.currentApprovalStage}</strong>
              </div>
            </div>

            {/* Stage Tracker */}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 700 }}>SEQUENTIAL APPROVAL WORKFLOW</div>
              {renderStageTracker(selectedTask)}
            </div>

            {/* Persistent Approval History Log (Requirements 3, 8, 9, 11) */}
            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '0.9rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.08)' }}>
              <strong style={{ fontSize: '0.8rem', color: '#10b981' }}>PERMANENT APPROVAL HISTORY</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {(taskDetails?.approval_stages || selectedTask.approval_stages || []).map(s => (
                  <div key={s.role} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                    <div>
                      <strong style={{ color: '#f8fafc' }}>{s.role}:</strong>{' '}
                      <span style={{ color: s.status === 'APPROVED' || s.status === 'approved' ? '#10b981' : s.status === 'REJECTED' || s.status === 'rejected' ? '#f43f5e' : '#38bdf8', fontWeight: 600 }}>
                        {s.status.toUpperCase()}
                      </span>
                      {s.comments && <span style={{ color: '#cbd5e1', fontStyle: 'italic', marginLeft: '0.5rem' }}>"{s.comments}"</span>}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                      {s.approvedBy ? `Approved by ${s.approvedBy.name}` : (s.rejectedBy ? `Rejected by ${s.rejectedBy.name}` : 'Awaiting')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Authorization Action Panel (Section 10) */}
            {!isUserAuthorizedForStage(selectedTask) ? (
              <div style={{ padding: '0.85rem', background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', borderRadius: '8px', color: '#f59e0b', fontSize: '0.85rem', marginBottom: '1rem' }}>
                ⚠️ <strong>Role Authorization Notice:</strong> This request is not currently assigned to your role. Current approval stage is assigned to <strong>'{selectedTask.current_stage || selectedTask.currentApprovalStage}'</strong>.
              </div>
            ) : (
              selectedTask.status === 'pending' && (
                <div className="form-group">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Approver Remarks & Review Notes</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Enter audit approval remarks..."
                    value={actionComments}
                    onChange={(e) => setActionComments(e.target.value)}
                  />
                </div>
              )
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedTask(null)}>Close</button>

              {isUserAuthorizedForStage(selectedTask) && selectedTask.status === 'pending' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" style={{ borderColor: '#f43f5e', color: '#f43f5e' }} onClick={() => handleAction(selectedTask.id, 'reject')}>
                    <XCircle size={16} /> Reject Request
                  </button>
                  <button className="btn btn-primary" onClick={() => handleAction(selectedTask.id, 'approve')}>
                    <CheckCircle2 size={16} /> Approve Stage ({selectedTask.current_stage})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
