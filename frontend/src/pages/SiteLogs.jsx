import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { HardHat, Plus, Camera, CheckCircle2, Clock, AlertCircle, ArrowLeft, Layers, CheckSquare, X } from 'lucide-react';
import { projectService, siteLogService, boqMbService } from '../services/api';

export default function SiteLogs() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlProjectId = searchParams.get('projectId');

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId || '');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // WBS and BOQ data for dynamic selection
  const [wbsData, setWbsData] = useState({ phases: [], tasks: [], subtasks: [] });
  const [boqs, setBoqs] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    physical_progress: '',
    labour_count: '',
    materials_consumed: '',
    equipment_used: '',
    issues_identified: '',
    remarks: '',
    phase_id: '',
    task_id: '',
    subtask_id: '',
    boq_item_id: '',
    executed_qty_today: ''
  });

  // Load Projects on mount
  useEffect(() => {
    projectService.getProjects()
      .then((res) => {
        setProjects(res.data || []);
        if (!selectedProjectId && res.data && res.data.length > 0) {
          setSelectedProjectId(res.data[0].id.toString());
        }
      })
      .catch((err) => console.error("Error loading projects:", err));
  }, []);

  // Load Logs, WBS Hierarchy & BOQ Items for selected project
  const loadProjectData = (projectId) => {
    if (!projectId) return;
    setLoading(true);

    Promise.all([
      siteLogService.getProjectLogs(projectId),
      boqMbService.getWbsHierarchy(projectId),
      boqMbService.getBoqItems(projectId)
    ])
      .then(([logRes, wbsRes, boqRes]) => {
        setLogs(logRes.data || []);
        setWbsData(wbsRes.data || { phases: [], tasks: [], subtasks: [] });
        setBoqs(boqRes.data || []);
      })
      .catch((err) => console.error("Error loading site log data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectData(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Filtered dropdowns for WBS Cascade
  const availableTasks = wbsData.tasks.filter(t => !formData.phase_id || t.parent_task_id === parseInt(formData.phase_id));
  const availableSubtasks = wbsData.subtasks.filter(s => !formData.task_id || s.parent_task_id === parseInt(formData.task_id));

  // Filtered BOQ Items based on WBS Location selection
  const availableBoqs = boqs.filter(b => {
    if (formData.subtask_id) return b.subtask_id === parseInt(formData.subtask_id);
    if (formData.task_id) return b.task_id === parseInt(formData.task_id);
    if (formData.phase_id) return b.phase_id === parseInt(formData.phase_id);
    return true;
  });

  // Selected BOQ item details
  const selectedBoq = boqs.find(b => b.id === parseInt(formData.boq_item_id));
  const approvedQty = selectedBoq ? parseFloat(selectedBoq.approved_qty) : 0;
  const prevExecutedQty = selectedBoq ? parseFloat(selectedBoq.executed_qty) : 0;
  const execToday = parseFloat(formData.executed_qty_today) || 0;
  
  const totalExecuted = prevExecutedQty + execToday;
  const remainingQty = approvedQty - totalExecuted;
  const executionPct = approvedQty > 0 ? Math.round((totalExecuted / approvedQty) * 10000) / 100 : 0;
  const isOverExecuted = totalExecuted > approvedQty;

  const handleCreateLog = (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("Please select a project first.");
      return;
    }

    if (execToday < 0) {
      alert("Executed Quantity Today cannot be negative.");
      return;
    }

    siteLogService.createLog({
      project_id: parseInt(selectedProjectId),
      physical_progress: formData.physical_progress,
      labour_count: parseInt(formData.labour_count || 0),
      materials_consumed: formData.materials_consumed,
      equipment_used: formData.equipment_used,
      issues_identified: formData.issues_identified,
      remarks: formData.remarks,
      phase_id: formData.phase_id ? parseInt(formData.phase_id) : null,
      task_id: formData.task_id ? parseInt(formData.task_id) : null,
      subtask_id: formData.subtask_id ? parseInt(formData.subtask_id) : null,
      boq_item_id: formData.boq_item_id ? parseInt(formData.boq_item_id) : null,
      executed_qty: execToday
    })
      .then(() => {
        setShowModal(false);
        setFormData({
          physical_progress: '',
          labour_count: '',
          materials_consumed: '',
          equipment_used: '',
          issues_identified: '',
          remarks: '',
          phase_id: '',
          task_id: '',
          subtask_id: '',
          boq_item_id: '',
          executed_qty_today: ''
        });
        loadProjectData(selectedProjectId);
        alert("Daily Site Progress Log & BOQ Work Measurement submitted successfully!");
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to submit Daily Site Progress Log"));
  };

  const currentProject = projects.find(p => p.id === parseInt(selectedProjectId));

  return (
    <div className="content-page">
      {/* Navigation Header */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {selectedProjectId ? (
          <button className="btn btn-secondary" onClick={() => navigate(`/projects/${selectedProjectId}`)}>
            <ArrowLeft size={16} /> Back to Project Details
          </button>
        ) : <div />}

        {currentProject && (
          <span className="tag-badge tag-info" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
            Project: <strong>{currentProject.name}</strong> | {currentProject.code}
          </span>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Site Daily Logs & Work Measurement</h1>
          <p className="page-subtitle">Site Engineer daily logs, labour workforce, equipment & BOQ executed quantity tracking</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <select className="form-control" style={{ width: '260px' }} value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> New Site Daily Log
          </button>
        </div>
      </div>

      {/* Logs Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {logs.length === 0 ? (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            {loading ? "Loading site logs..." : "No daily site logs logged for this project yet."}
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                <div>
                  <span className="tag-badge tag-info">Log Date: {new Date(log.log_date).toLocaleDateString()}</span>
                  <h3 style={{ marginTop: '0.35rem' }}>Site Log #{log.id} - Engineer #{log.engineer_id}</h3>
                </div>
                <span className={`tag-badge ${log.approval_status === 'approved' ? 'tag-success' : log.approval_status === 'rejected' ? 'tag-danger' : 'tag-warning'}`}>
                  Approval: {log.approval_status.toUpperCase()}
                </span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ fontSize: '0.85rem', color: '#38bdf8' }}>Physical Progress Summary:</strong>
                <p style={{ color: '#f8fafc', fontSize: '0.9rem', marginTop: '0.2rem' }}>{log.physical_progress}</p>
              </div>

              {/* BOQ Execution Metrics Card */}
              {log.boq_item_id && (
                <div style={{ padding: '0.85rem', background: 'rgba(56,189,248,0.06)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>
                      📦 BOQ Work Measurement Log: {log.boq_item_name}
                    </span>
                    <span className="tag-badge tag-success" style={{ fontWeight: 700 }}>
                      Execution: {log.execution_pct}%
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div>Approved Qty: <strong>{log.approved_qty} {log.unit}</strong></div>
                    <div>Executed Today: <strong style={{ color: '#10b981' }}>{log.executed_qty} {log.unit}</strong></div>
                    <div>Total Executed: <strong style={{ color: '#38bdf8' }}>{log.total_executed_qty} {log.unit}</strong></div>
                    <div>Remaining Qty: <strong style={{ color: '#f59e0b' }}>{log.remaining_qty} {log.unit}</strong></div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'rgba(15,23,42,0.6)', padding: '0.9rem', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>On-Site Labour Workforce</div>
                  <div style={{ fontWeight: 700, color: '#f8fafc' }}>{log.labour_count} Workers</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Materials Consumed</div>
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{log.materials_consumed || 'None recorded'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Machinery & Equipment</div>
                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{log.equipment_used || 'Standard tools'}</div>
                </div>
              </div>

              {log.issues_identified && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '8px', fontSize: '0.85rem', color: '#fca5a5' }}>
                  <strong>Site Blockers / Issues:</strong> {log.issues_identified}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* CREATE DAILY LOG MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '1.5rem 0' }}>
          <div className="glass-card" style={{ width: '580px', background: '#1e293b', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Submit Daily Site Progress Log</h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateLog}>
              <div className="form-group">
                <label>Physical Progress Summary *</label>
                <textarea required className="form-control" rows="2" placeholder="Completed pour of foundation slab B2 level (800 cu.m)..." value={formData.physical_progress} onChange={e => setFormData({ ...formData, physical_progress: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Labour Count (Workers on Site)</label>
                  <input required type="number" className="form-control" placeholder="45" value={formData.labour_count} onChange={e => setFormData({ ...formData, labour_count: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Equipment Used</label>
                  <input type="text" className="form-control" placeholder="Concrete Pump Trucks x 3" value={formData.equipment_used} onChange={e => setFormData({ ...formData, equipment_used: e.target.value })} />
                </div>
              </div>

              {/* DYNAMIC BOQ / WORK MEASUREMENT SECTION */}
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)', marginBottom: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
                  <HardHat size={16} /> BOQ / Work Measurement Entry (Site Engineer)
                </h4>

                {/* WBS Cascade Selection */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>WBS Phase</label>
                    <select className="form-control" style={{ fontSize: '0.82rem' }} value={formData.phase_id} onChange={e => setFormData({ ...formData, phase_id: e.target.value, task_id: '', subtask_id: '', boq_item_id: '' })}>
                      <option value="">-- Select WBS Phase --</option>
                      {wbsData.phases.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>WBS Task</label>
                    <select className="form-control" style={{ fontSize: '0.82rem' }} value={formData.task_id} onChange={e => setFormData({ ...formData, task_id: e.target.value, subtask_id: '', boq_item_id: '' })}>
                      <option value="">-- Select WBS Task --</option>
                      {availableTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>WBS Subtask (Optional)</label>
                    <select className="form-control" style={{ fontSize: '0.82rem' }} value={formData.subtask_id} onChange={e => setFormData({ ...formData, subtask_id: e.target.value, boq_item_id: '' })}>
                      <option value="">-- Select WBS Subtask --</option>
                      {availableSubtasks.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 600 }}>Target BOQ Item *</label>
                    <select className="form-control" style={{ fontSize: '0.82rem', fontWeight: 600 }} value={formData.boq_item_id} onChange={e => setFormData({ ...formData, boq_item_id: e.target.value })}>
                      <option value="">-- Select BOQ Line Item --</option>
                      {availableBoqs.map(b => (
                        <option key={b.id} value={b.id}>BOQ-{String(b.id).padStart(3, '0')}: {b.item_name} ({b.approved_qty} {b.unit})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Auto-Populated Readonly BOQ Details & Input */}
                {selectedBoq && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', padding: '0.5rem', background: 'rgba(56,189,248,0.08)', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.78rem' }}>
                      <div>Approved Qty: <strong style={{ color: '#38bdf8' }}>{approvedQty} {selectedBoq.unit}</strong></div>
                      <div>Prev Executed: <strong style={{ color: '#10b981' }}>{prevExecutedQty} {selectedBoq.unit}</strong></div>
                      <div>Prev Remaining: <strong style={{ color: '#f59e0b' }}>{approvedQty - prevExecutedQty} {selectedBoq.unit}</strong></div>
                    </div>

                    <div className="form-group">
                      <label style={{ color: '#10b981', fontWeight: 700 }}>Executed Quantity Today ({selectedBoq.unit}) *</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0"
                        className="form-control" 
                        placeholder="100" 
                        value={formData.executed_qty_today} 
                        onChange={e => setFormData({ ...formData, executed_qty_today: e.target.value })} 
                      />
                    </div>

                    {/* Live Calculation Preview */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', padding: '0.65rem', background: 'rgba(16,185,129,0.1)', borderRadius: '6px', fontSize: '0.8rem' }}>
                      <div>Total Executed: <strong style={{ color: '#10b981' }}>{totalExecuted} {selectedBoq.unit}</strong></div>
                      <div>Remaining Qty: <strong style={{ color: remainingQty < 0 ? '#f43f5e' : '#f59e0b' }}>{remainingQty} {selectedBoq.unit}</strong></div>
                      <div>Execution %: <strong style={{ color: executionPct > 100 ? '#f43f5e' : '#10b981' }}>{executionPct}%</strong></div>
                    </div>

                    {/* Warning Alert if Total Executed > Approved Qty */}
                    {isOverExecuted && (
                      <div style={{ marginTop: '0.75rem', padding: '0.6rem', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: '6px', fontSize: '0.78rem', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <AlertCircle size={16} /> Executed quantity exceeds approved BOQ quantity. (Excess: {totalExecuted - approvedQty} {selectedBoq.unit})
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="form-group">
                <label>Materials Consumed Today</label>
                <input type="text" className="form-control" placeholder="Concrete M30: 100m3" value={formData.materials_consumed} onChange={e => setFormData({ ...formData, materials_consumed: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Site Issues / Remarks (Optional)</label>
                <input type="text" className="form-control" placeholder="Completed on schedule" value={formData.issues_identified} onChange={e => setFormData({ ...formData, issues_identified: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Daily Site Log</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
