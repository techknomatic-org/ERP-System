import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, ShieldCheck, DollarSign, HardHat, ArrowRight, UserCheck, Clock, Check, Plus, FileText } from 'lucide-react';
import { approvalService, projectService, siteLogService, contractorBillingService } from '../services/api';

const FINANCIAL_TYPES = [
  "pr", "purchaserequisition", "po", "purchaseorder", "payment", 
  "paymentrequest", "contractorbill", "contractor_bill", "customerrefund", "budgetapproval", 
  "financialadjustment", "expense", "expense_claim", "purchase_request", "material_purchase"
];

function isFinancial(entityType) {
  const clean = (entityType || "").toLowerCase().replace(/ /g, "").replace(/_/g, "");
  return FINANCIAL_TYPES.includes(clean);
}

const ROLES = [
  { key: 'site_engineer', label: 'Site Engineer', stage: 'Site Engineer' },
  { key: 'project_manager', label: 'Project Manager', stage: 'Project Manager' },
  { key: 'finance', label: 'Finance & Accounts', stage: 'Finance' },
  { key: 'management', label: 'Management', stage: 'Management' },
  { key: 'admin', label: 'System Admin (All)', stage: 'Admin' }
];

const REQUEST_TYPES = [
  { id: 'SITE_LOG', label: 'Daily Site Progress Log', category: 'NON_FINANCIAL', isFinancial: false, workflow: 'Site Engineer → Project Manager' },
  { id: 'SITE_ISSUE', label: 'Site Issue / Delay Report', category: 'NON_FINANCIAL', isFinancial: false, workflow: 'Site Engineer → Project Manager' },
  { id: 'MATERIAL_REQUEST', label: 'Material Request', category: 'NON_FINANCIAL', isFinancial: false, workflow: 'Site Engineer → Project Manager' },
  { id: 'EQUIPMENT_REQUEST', label: 'Equipment Request', category: 'NON_FINANCIAL', isFinancial: false, workflow: 'Site Engineer → Project Manager' },
  { id: 'CONTRACTOR_BILL', label: 'Contractor Bill Payment', category: 'FINANCIAL', isFinancial: true, workflow: 'Site Engineer → Project Manager → Finance → Management' },
  { id: 'PURCHASE_REQUEST', label: 'Purchase Request', category: 'FINANCIAL', isFinancial: true, workflow: 'Site Engineer → Project Manager → Finance → Management' },
  { id: 'EXPENSE_CLAIM', label: 'Expense Claim', category: 'FINANCIAL', isFinancial: true, workflow: 'Site Engineer → Project Manager → Finance → Management' }
];

export default function Approvals() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDetails, setTaskDetails] = useState(null);
  const [actionComments, setActionComments] = useState('');
  const [activeRole, setActiveRole] = useState(localStorage.getItem('erp_role') || 'admin');
  const [statusTab, setStatusTab] = useState('pending');

  // Create New Request Modal state (Requirements 1, 2, 3, 4, 5)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedReqTypeId, setSelectedReqTypeId] = useState('SITE_LOG');
  const [createForm, setCreateForm] = useState({
    project_id: '1',
    // SITE_LOG
    physical_progress: '',
    labour_count: '',
    materials_consumed: '',
    equipment_used: '',
    issues_identified: '',
    remarks: '',
    // CONTRACTOR_BILL
    contractor_name: '',
    invoice_number: '',
    bill_date: '',
    amount: '',
    description: '',
    supporting_doc: '',
    payment_details: '',
    // GENERIC
    title: '',
    quantity: '',
    unit: '',
    urgency: 'Medium'
  });

  const loadTasks = (role = activeRole, tab = statusTab) => {
    setLoading(true);
    approvalService.getTasks(role, tab)
      .then((res) => setTasks(res.data))
      .catch((err) => console.error("Error loading approvals:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTasks(activeRole, statusTab);
    projectService.getProjects()
      .then((res) => setProjects(res.data))
      .catch(() => {});
  }, [activeRole, statusTab]);

  const handleRoleChange = (newRole) => {
    setActiveRole(newRole);
    localStorage.setItem('erp_role', newRole);
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
        loadTasks(activeRole, statusTab);
      })
      .catch((err) => {
        const errMsg = err.response?.data?.detail || "Failed to process approval action";
        alert(errMsg);
      });
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const reqConfig = REQUEST_TYPES.find(r => r.id === selectedReqTypeId) || REQUEST_TYPES[0];

    if (selectedReqTypeId === 'SITE_LOG') {
      siteLogService.createLog({
        project_id: parseInt(createForm.project_id || projects[0]?.id || 1),
        physical_progress: createForm.physical_progress,
        labour_count: parseInt(createForm.labour_count || 0),
        materials_consumed: createForm.materials_consumed,
        equipment_used: createForm.equipment_used,
        issues_identified: createForm.issues_identified,
        remarks: createForm.remarks
      })
        .then(() => {
          setShowCreateModal(false);
          alert("Daily Site Progress Log submitted successfully. Classified as NON-FINANCIAL (Site Engineer → Project Manager).");
          loadTasks(activeRole, statusTab);
        })
        .catch((err) => alert(err.response?.data?.detail || "Failed to submit Daily Site Progress Log"));
    } else {
      // Generic or Contractor Bill Request submission
      const prj = projects.find(p => p.id === parseInt(createForm.project_id)) || projects[0];
      const prjTitle = prj ? prj.name : `Project #${createForm.project_id}`;

      let taskTitle = `${reqConfig.label} - ${prjTitle}`;
      if (selectedReqTypeId === 'CONTRACTOR_BILL') {
        taskTitle = `Contractor Bill Payment #${createForm.invoice_number || 'INV-502'} (${createForm.contractor_name || 'Contractor'})`;
      } else if (createForm.title) {
        taskTitle = `${reqConfig.label}: ${createForm.title} (${prjTitle})`;
      }

      approvalService.createTask({
        title: taskTitle,
        entity_type: selectedReqTypeId,
        entity_id: Math.floor(Math.random() * 9000) + 1000,
        current_stage: "Site Engineer"
      })
        .then(() => {
          setShowCreateModal(false);
          alert(`${reqConfig.label} submitted successfully! Classified as ${reqConfig.category} (${reqConfig.workflow}).`);
          loadTasks(activeRole, statusTab);
        })
        .catch((err) => alert(err.response?.data?.detail || "Failed to create request"));
    }
  };

  const selectedReqConfig = REQUEST_TYPES.find(r => r.id === selectedReqTypeId) || REQUEST_TYPES[0];

  const getStagesForTask = (entityType) => {
    if (isFinancial(entityType)) {
      return ["Site Engineer", "Project Manager", "Finance", "Management"];
    }
    return ["Site Engineer", "Project Manager"];
  };

  const renderStageTracker = (task) => {
    const stages = getStagesForTask(task.entity_type);
    const stageDetails = task.approval_stages || task.approvalStages || [];
    const currStageIdx = stages.indexOf(task.current_stage);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        {stages.map((stg, idx) => {
          let statusStyle = { background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' };
          let iconChar = '○';

          const stgInfo = stageDetails.find(s => s.role === stg);
          const stgStatus = stgInfo ? stgInfo.status.toLowerCase() : (task.status === 'approved' ? 'approved' : (idx < currStageIdx ? 'approved' : (idx === currStageIdx ? 'pending' : 'waiting')));

          if (stgStatus === 'approved' || task.status === 'approved') {
            statusStyle = { background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' };
            iconChar = '✓';
          } else if (stgStatus === 'rejected' || (task.status === 'rejected' && idx === currStageIdx)) {
            statusStyle = { background: 'rgba(244,63,94,0.15)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' };
            iconChar = '✕';
          } else if (stgStatus === 'pending' || (idx === currStageIdx && task.status === 'pending')) {
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

  // Render category badge with exact sub-label (Requirements 1, 2, 4, 8)
  const renderCategoryBadge = (task) => {
    const fin = isFinancial(task.entity_type);
    
    let sublabel = task.displaySublabel || task.display_sublabel;
    if (!sublabel) {
      const typeCode = (task.requestCode || task.request_code || task.entity_type || '').toLowerCase();
      if (typeCode.includes('material_stock') || typeCode.includes('materialstock')) {
        sublabel = '(Material Stock Request)';
      } else if (typeCode.includes('material_purchase') || typeCode.includes('materialpurchase') || typeCode.includes('purchase')) {
        sublabel = '(Material Purchase Request)';
      } else if (typeCode.includes('contractor')) {
        sublabel = '(Contractor Payment)';
      } else if (typeCode.includes('vendor')) {
        sublabel = '(Vendor Payment)';
      } else {
        sublabel = '(Site Daily Log)';
      }
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        <span className={`tag-badge ${fin ? 'tag-success' : 'tag-info'}`} style={{ width: 'fit-content', fontWeight: 700 }}>
          {fin ? 'FINANCIAL' : 'NON-FINANCIAL'}
        </span>
        <span style={{ fontSize: '0.73rem', color: '#94a3b8', fontWeight: 500 }}>
          {sublabel}
        </span>
      </div>
    );
  };

  // Stage permission check (Section 1, 7, 10, 13)
  const isUserAuthorizedForStage = (task) => {
    if (!task) return false;
    const reqStage = task.current_stage || task.currentApprovalStage;
    if (reqStage === 'Site Engineer' && activeRole === 'site_engineer') return true;
    if (reqStage === 'Project Manager' && activeRole === 'project_manager') return true;
    if (reqStage === 'Finance' && activeRole === 'finance') return true;
    if (reqStage === 'Management' && activeRole === 'management') return true;
    return false;
  };

  return (
    <div className="content-page">
      {/* Header */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Pending Approvals & Dynamic Workflow Engine</h1>
          <p className="page-subtitle">
            Role-Based Stage Progression: Non-Financial (Site Engineer → PM) vs Financial (Site Engineer → PM → Finance → Management)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} /> Create New Request
          </button>
          <span className="tag-badge tag-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <ShieldCheck size={14} /> Audit Trail Logged
          </span>
        </div>
      </div>

      {/* Role Display / Admin Switcher (Section 2 & 12) */}
      <div className="glass-card" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', background: 'rgba(15,23,42,0.7)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserCheck size={18} color="#38bdf8" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
            Logged-In User Persona: <strong style={{ color: '#38bdf8' }}>{activeRole.replace('_', ' ').toUpperCase()}</strong>
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
                    background: isSelected ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'rgba(255,255,255,0.05)',
                    color: isSelected ? '#ffffff' : '#cbd5e1',
                    border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
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

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
        {[
          { key: 'pending', label: 'Pending Approvals' },
          { key: 'completed', label: 'Approved / Completed' },
          { key: 'rejected', label: 'Rejected Tasks' },
          { key: 'all', label: 'All Tasks History' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusTab(tab.key)}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: statusTab === tab.key ? 700 : 500,
              background: statusTab === tab.key ? 'rgba(56,189,248,0.15)' : 'transparent',
              color: statusTab === tab.key ? '#38bdf8' : '#94a3b8',
              border: statusTab === tab.key ? '1px solid #38bdf8' : '1px solid transparent',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Task Title</th>
              <th>Request Category</th>
              <th>Approval Stage Tracker</th>
              <th>Status</th>
              <th>Submitted Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                  {loading ? "Loading approval task inbox..." : `No ${statusTab} approval tasks for role '${activeRole.replace('_', ' ').toUpperCase()}'.`}
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const fin = isFinancial(task.entity_type);
                return (
                  <tr key={task.id}>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        {fin ? <DollarSign size={16} color="#10b981" /> : <HardHat size={16} color="#38bdf8" />}
                        <span>{task.title}</span>
                      </div>
                    </td>
                    <td>
                      {renderCategoryBadge(task)}
                    </td>
                    <td>{renderStageTracker(task)}</td>
                    <td>
                      <span className={`tag-badge ${
                        task.status === 'approved' ? 'tag-success' :
                        task.status === 'rejected' ? 'tag-danger' :
                        task.status === 'sent_back' ? 'tag-warning' : 'tag-info'
                      }`}>
                        {task.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{new Date(task.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => openProcessModal(task)}
                      >
                        {statusTab === 'pending' ? 'Process Task' : 'View Details'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Process Action Modal */}
      {selectedTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '620px', background: '#1e293b', maxHeight: '92vh', overflowY: 'auto' }}>
            
            {/* Modal Header */}
            <div style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc' }}>
                  {isFinancial(selectedTask.entity_type) ? <DollarSign size={22} color="#10b981" /> : <HardHat size={22} color="#38bdf8" />}
                  <span>{selectedTask.title}</span>
                </h3>
                <span className={`tag-badge ${isFinancial(selectedTask.entity_type) ? 'tag-success' : 'tag-info'}`}>
                  {isFinancial(selectedTask.entity_type) ? 'FINANCIAL' : 'NON-FINANCIAL'}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                Current Pending Approval Role Stage: <strong style={{ color: '#38bdf8' }}>{selectedTask.current_stage}</strong>
              </div>
            </div>

            {/* Dynamic Stage Tracker Section */}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                STAGE PROGRESSION WORKFLOW CHAIN
              </div>
              {renderStageTracker(selectedTask)}
            </div>

            {/* Stage Audit History Details (Requirement 7 & 14) */}
            {taskDetails?.approval_stages && (
              <div style={{ background: 'rgba(15,23,42,0.5)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.5rem' }}>
                  STAGE APPROVAL AUDIT LOG & STATUSES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {taskDetails.approval_stages.map(s => (
                    <div key={s.role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.35rem 0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                      <div>
                        <strong style={{ color: '#f8fafc' }}>{s.role}:</strong>{' '}
                        <span style={{
                          color: s.status === 'approved' ? '#10b981' : s.status === 'rejected' ? '#f43f5e' : s.status === 'pending' ? '#38bdf8' : '#64748b',
                          fontWeight: 600
                        }}>
                          {s.status.toUpperCase()}
                        </span>
                        {s.comments && <span style={{ color: '#94a3b8', fontStyle: 'italic', marginLeft: '0.5rem' }}>"{s.comments}"</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {s.approvedBy ? `Approved by ${s.approvedBy.name}` : (s.rejectedBy ? `Rejected by ${s.rejectedBy.name}` : (s.status === 'pending' ? 'Awaiting Action' : 'Waiting'))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linked Site Log Information Panel (Requirement 12 & 15) */}
            {taskDetails?.site_log && (
              <div style={{ background: 'rgba(15,23,42,0.7)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(56,189,248,0.2)' }}>
                <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Submitted Daily Site Progress Log Details (Log #{taskDetails.site_log.id})
                </div>
                <div style={{ fontSize: '0.88rem', color: '#f8fafc', marginBottom: '0.6rem' }}>
                  <strong>Physical Progress Summary:</strong>
                  <p style={{ margin: '0.2rem 0 0 0', color: '#cbd5e1', fontSize: '0.85rem' }}>{taskDetails.site_log.physical_progress}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '6px', color: '#cbd5e1' }}>
                  <div><strong>Labour Count:</strong> {taskDetails.site_log.labour_count} Workers</div>
                  <div><strong>Materials:</strong> {taskDetails.site_log.materials_consumed || 'None'}</div>
                  <div><strong>Equipment:</strong> {taskDetails.site_log.equipment_used || 'Standard'}</div>
                </div>
                {taskDetails.site_log.issues_identified && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#fca5a5', background: 'rgba(244,63,94,0.1)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                    <strong>Blockers / Site Issues:</strong> {taskDetails.site_log.issues_identified}
                  </div>
                )}
              </div>
            )}

            {/* Stage Authorization Check Warning (Section 10 & 13) */}
            {!isUserAuthorizedForStage(selectedTask) ? (
              <div style={{ padding: '0.85rem', background: 'rgba(244,63,94,0.15)', border: '1px solid #f43f5e', borderRadius: '8px', color: '#f43f5e', fontSize: '0.83rem', marginBottom: '1rem' }}>
                🛑 <strong>Authorization Warning:</strong> You are not authorized to process this approval stage. Current pending stage is <strong>'{selectedTask.current_stage}'</strong>.
              </div>
            ) : (
              <div className="form-group">
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Decision Remarks & Approval Comments</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Enter comments or review feedback for audit log..."
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                />
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedTask(null)}>Close</button>
              
              {isUserAuthorizedForStage(selectedTask) && selectedTask.status === 'pending' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
                    onClick={() => handleAction(selectedTask.id, 'send_back')}
                  >
                    <RotateCcw size={16} /> Send Back
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ borderColor: '#f43f5e', color: '#f43f5e' }}
                    onClick={() => handleAction(selectedTask.id, 'reject')}
                  >
                    <XCircle size={16} /> Reject Task
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleAction(selectedTask.id, 'approve')}
                  >
                    <CheckCircle2 size={16} /> Approve Stage ({selectedTask.current_stage})
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Create New Request Modal (Requirements 1, 2, 3, 4, 5) */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '580px', background: '#1e293b', maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc' }}>
              <Plus size={20} color="#38bdf8" /> CREATE NEW REQUEST
            </h3>

            <form onSubmit={handleCreateSubmit}>
              {/* Request Type Pre-Selection Dropdown (Requirement 1 & 3) */}
              <div className="form-group">
                <label style={{ fontWeight: 700, color: '#f8fafc' }}>Request Type</label>
                <select
                  required
                  className="form-control"
                  style={{ background: 'rgba(15,23,42,0.8)', color: '#38bdf8', fontWeight: 600 }}
                  value={selectedReqTypeId}
                  onChange={e => setSelectedReqTypeId(e.target.value)}
                >
                  <option value="">[ Select Request Type ▼ ]</option>
                  <option value="SITE_LOG">Daily Site Progress Log</option>
                  <option value="SITE_ISSUE">Site Issue / Delay Report</option>
                  <option value="MATERIAL_REQUEST">Material Request</option>
                  <option value="EQUIPMENT_REQUEST">Equipment Request</option>
                  <option value="CONTRACTOR_BILL">Contractor Bill Payment</option>
                  <option value="PURCHASE_REQUEST">Purchase Request</option>
                  <option value="EXPENSE_CLAIM">Expense Claim</option>
                </select>
              </div>

              {/* Automatic Category & Workflow Classification Banner (Requirement 1, 2, 3) */}
              {selectedReqConfig && (
                <div style={{ marginBottom: '1.25rem', padding: '0.65rem 0.85rem', borderRadius: '8px', background: selectedReqConfig.isFinancial ? 'rgba(16,185,129,0.12)' : 'rgba(56,189,248,0.12)', border: selectedReqConfig.isFinancial ? '1px solid #10b981' : '1px solid #38bdf8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Automated Category Classification:</span>
                    <span className={`tag-badge ${selectedReqConfig.isFinancial ? 'tag-success' : 'tag-info'}`}>
                      {selectedReqConfig.category}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
                    <strong>Workflow Chain:</strong> {selectedReqConfig.workflow}
                  </div>
                </div>
              )}

              {/* Select Project Field */}
              <div className="form-group">
                <label>Select Project</label>
                <select className="form-control" value={createForm.project_id} onChange={e => setCreateForm({ ...createForm, project_id: e.target.value })}>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                  ))}
                </select>
              </div>

              {/* Dynamic Request Fields depending on Request Type */}
              {selectedReqTypeId === 'SITE_LOG' && (
                <>
                  <div className="form-group">
                    <label>Physical Progress Summary</label>
                    <textarea required className="form-control" rows="3" placeholder="Completed pour of foundation slab B2 level (800 cu.m)..." value={createForm.physical_progress} onChange={e => setCreateForm({ ...createForm, physical_progress: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Labour Count (Workers on Site)</label>
                    <input required type="number" className="form-control" placeholder="45" value={createForm.labour_count} onChange={e => setCreateForm({ ...createForm, labour_count: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Materials Consumed Today</label>
                    <input type="text" className="form-control" placeholder="Concrete M30: 800m3, TMT Steel: 45 Tonnes" value={createForm.materials_consumed} onChange={e => setCreateForm({ ...createForm, materials_consumed: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Equipment / Machinery Used</label>
                    <input type="text" className="form-control" placeholder="Concrete Pump Trucks x 3, Tower Crane #1" value={createForm.equipment_used} onChange={e => setCreateForm({ ...createForm, equipment_used: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Site Issues / Rain Delays (Optional)</label>
                    <input type="text" className="form-control" placeholder="Minor morning rain delay" value={createForm.issues_identified} onChange={e => setCreateForm({ ...createForm, issues_identified: e.target.value })} />
                  </div>
                </>
              )}

              {selectedReqTypeId === 'CONTRACTOR_BILL' && (
                <>
                  <div className="form-group">
                    <label>Contractor Name</label>
                    <input required type="text" className="form-control" placeholder="ABC Construction Corp" value={createForm.contractor_name} onChange={e => setCreateForm({ ...createForm, contractor_name: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label>Bill / Invoice Number</label>
                      <input required type="text" className="form-control" placeholder="INV-502" value={createForm.invoice_number} onChange={e => setCreateForm({ ...createForm, invoice_number: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Bill Date</label>
                      <input required type="date" className="form-control" value={createForm.bill_date} onChange={e => setCreateForm({ ...createForm, bill_date: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Amount ($ / ₹)</label>
                    <input required type="number" step="0.01" className="form-control" placeholder="500000" value={createForm.amount} onChange={e => setCreateForm({ ...createForm, amount: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Description / Purpose</label>
                    <textarea required className="form-control" rows="2" placeholder="Foundation concrete work milestone payment request..." value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label>Supporting Invoice / Document</label>
                      <input type="text" className="form-control" placeholder="Invoice_502.pdf" value={createForm.supporting_doc} onChange={e => setCreateForm({ ...createForm, supporting_doc: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Payment Details</label>
                      <input type="text" className="form-control" placeholder="Bank Transfer / Wire" value={createForm.payment_details} onChange={e => setCreateForm({ ...createForm, payment_details: e.target.value })} />
                    </div>
                  </div>
                </>
              )}

              {selectedReqTypeId === 'SITE_ISSUE' && (
                <>
                  <div className="form-group">
                    <label>Issue Title</label>
                    <input required type="text" className="form-control" placeholder="Heavy Rainfall & Excavation Flooding Delay" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Detailed Description</label>
                    <textarea required className="form-control" rows="3" placeholder="Waterlogging in Zone B excavation pit delayed foundation pour by 12 hours..." value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Recommended Action / Solution</label>
                    <input type="text" className="form-control" placeholder="Deploy dewatering pumps and resume pour tomorrow morning" value={createForm.remarks} onChange={e => setCreateForm({ ...createForm, remarks: e.target.value })} />
                  </div>
                </>
              )}

              {selectedReqTypeId === 'MATERIAL_REQUEST' && (
                <>
                  <div className="form-group">
                    <label>Material Name</label>
                    <input required type="text" className="form-control" placeholder="Portland Cement PPC Grade 53" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label>Quantity Required</label>
                      <input required type="number" className="form-control" placeholder="100" value={createForm.quantity} onChange={e => setCreateForm({ ...createForm, quantity: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Unit</label>
                      <input required type="text" className="form-control" placeholder="Bags / Tonnes" value={createForm.unit} onChange={e => setCreateForm({ ...createForm, unit: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Purpose / Site Location</label>
                    <textarea className="form-control" rows="2" placeholder="Required for Floor 4 column casting..." value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} />
                  </div>
                </>
              )}

              {selectedReqTypeId === 'EQUIPMENT_REQUEST' && (
                <>
                  <div className="form-group">
                    <label>Equipment / Machinery Name</label>
                    <input required type="text" className="form-control" placeholder="Hydraulic Excavator CAT 320" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Duration / Hours Required</label>
                    <input required type="text" className="form-control" placeholder="3 Days / 24 Hours" value={createForm.quantity} onChange={e => setCreateForm({ ...createForm, quantity: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Purpose / Site Assignment</label>
                    <textarea className="form-control" rows="2" placeholder="Trenching for storm water drain line..." value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} />
                  </div>
                </>
              )}

              {selectedReqTypeId === 'PURCHASE_REQUEST' && (
                <>
                  <div className="form-group">
                    <label>Purchase Item / Description</label>
                    <input required type="text" className="form-control" placeholder="TMT Steel Fe500D (50 Tonnes)" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Estimated Cost ($ / ₹)</label>
                    <input required type="number" step="0.01" className="form-control" placeholder="37500.00" value={createForm.amount} onChange={e => setCreateForm({ ...createForm, amount: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Justification / Purpose</label>
                    <textarea required className="form-control" rows="2" placeholder="Urgent reinforcement requirement for Phase 2 tower beams..." value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} />
                  </div>
                </>
              )}

              {selectedReqTypeId === 'EXPENSE_CLAIM' && (
                <>
                  <div className="form-group">
                    <label>Expense Claim Title</label>
                    <input required type="text" className="form-control" placeholder="Site Survey & Soil Testing Consultancy Fee" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Amount ($ / ₹)</label>
                    <input required type="number" step="0.01" className="form-control" placeholder="4500.00" value={createForm.amount} onChange={e => setCreateForm({ ...createForm, amount: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Receipt Reference & Description</label>
                    <textarea required className="form-control" rows="2" placeholder="Geotechnical lab testing report receipt #GEO-882..." value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {selectedReqTypeId === 'SITE_LOG' ? 'Submit Daily Progress Log' :
                   selectedReqTypeId === 'CONTRACTOR_BILL' ? 'Submit Contractor Bill Payment' :
                   selectedReqTypeId === 'SITE_ISSUE' ? 'Submit Site Issue Report' :
                   selectedReqTypeId === 'MATERIAL_REQUEST' ? 'Submit Material Request' :
                   selectedReqTypeId === 'EQUIPMENT_REQUEST' ? 'Submit Equipment Request' :
                   selectedReqTypeId === 'PURCHASE_REQUEST' ? 'Submit Purchase Request' : 'Submit Expense Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

