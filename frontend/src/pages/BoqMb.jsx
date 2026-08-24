import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Layers, Plus, ClipboardList, CheckCircle2, ArrowLeft, Package, DollarSign, 
  Eye, FileText, AlertCircle, RefreshCw, X, CheckSquare, Truck
} from 'lucide-react';
import { boqMbService, projectService, vendorService } from '../services/api';

export default function BoqMb() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlProjectId = searchParams.get('projectId');

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId || '');
  const [boqs, setBoqs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [wbsData, setWbsData] = useState({ phases: [], tasks: [], subtasks: [] });
  const [loading, setLoading] = useState(false);

  // Modals visibility
  const [showBoqModal, setShowBoqModal] = useState(false);
  const [showMbModal, setShowMbModal] = useState(false);
  const [showMbLogModal, setShowMbLogModal] = useState(false);
  const [showMprModal, setShowMprModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);

  const [targetBoqItem, setTargetBoqItem] = useState(null);
  const [mbLogs, setMbLogs] = useState([]);

  // Forms state
  const [boqForm, setBoqForm] = useState({
    phase_id: '',
    task_id: '',
    subtask_id: '',
    item_name: '',
    unit: 'cu.m',
    approved_qty: '',
    rate: '',
    vendor_id: ''
  });

  const [mbForm, setMbForm] = useState({ location_zone: '', measured_qty: '', remarks: '' });
  const [mprForm, setMprForm] = useState({ quantity: '', estimated_cost: '', reason: '' });
  const [billForm, setBillForm] = useState({ billed_qty: '', billed_rate: '', remarks: '' });

  // Filtered WBS tasks for cascade dropdowns
  const availableTasks = wbsData.tasks.filter(t => !boqForm.phase_id || t.parent_task_id === parseInt(boqForm.phase_id));
  const availableSubtasks = wbsData.subtasks.filter(s => !boqForm.task_id || s.parent_task_id === parseInt(boqForm.task_id));

  // Load Projects & Vendors on mount
  useEffect(() => {
    projectService.getProjects()
      .then((res) => {
        setProjects(res.data || []);
        if (!selectedProjectId && res.data && res.data.length > 0) {
          setSelectedProjectId(res.data[0].id.toString());
        }
      })
      .catch((err) => console.error("Error loading projects:", err));

    vendorService.getVendors()
      .then((res) => setVendors(res.data || []))
      .catch((err) => console.error("Error loading vendors:", err));
  }, []);

  // Load BOQ items and WBS Hierarchy when selectedProjectId changes
  const loadProjectData = (projectId) => {
    if (!projectId) return;
    setLoading(true);

    Promise.all([
      boqMbService.getBoqItems(projectId),
      boqMbService.getWbsHierarchy(projectId)
    ])
      .then(([boqRes, wbsRes]) => {
        setBoqs(boqRes.data || []);
        setWbsData(wbsRes.data || { phases: [], tasks: [], subtasks: [] });
      })
      .catch((err) => console.error("Error loading BOQ data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectData(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Calculate BOQ Total Amount
  const calculatedTotal = (parseFloat(boqForm.approved_qty) || 0) * (parseFloat(boqForm.rate) || 0);

  // Handle Create BOQ Item
  const handleCreateBoq = (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("Please select a project first.");
      return;
    }

    boqMbService.createBoqItem({
      project_id: parseInt(selectedProjectId),
      phase_id: boqForm.phase_id ? parseInt(boqForm.phase_id) : null,
      task_id: boqForm.task_id ? parseInt(boqForm.task_id) : null,
      subtask_id: boqForm.subtask_id ? parseInt(boqForm.subtask_id) : null,
      item_name: boqForm.item_name,
      unit: boqForm.unit,
      approved_qty: parseFloat(boqForm.approved_qty),
      rate: parseFloat(boqForm.rate),
      vendor_id: boqForm.vendor_id ? parseInt(boqForm.vendor_id) : null
    })
      .then(() => {
        setShowBoqModal(false);
        setBoqForm({ phase_id: '', task_id: '', subtask_id: '', item_name: '', unit: 'cu.m', approved_qty: '', rate: '', vendor_id: '' });
        loadProjectData(selectedProjectId);
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to add BOQ item"));
  };

  // Handle Record MB Measurement
  const handleRecordMb = (e) => {
    e.preventDefault();
    if (!targetBoqItem) return;

    boqMbService.recordMb({
      project_id: parseInt(selectedProjectId),
      boq_item_id: targetBoqItem.id,
      phase_id: targetBoqItem.phase_id,
      task_id: targetBoqItem.task_id,
      subtask_id: targetBoqItem.subtask_id,
      location_zone: mbForm.location_zone,
      measured_qty: parseFloat(mbForm.measured_qty),
      unit: targetBoqItem.unit,
      remarks: mbForm.remarks
    })
      .then(() => {
        setShowMbModal(false);
        setTargetBoqItem(null);
        setMbForm({ location_zone: '', measured_qty: '', remarks: '' });
        loadProjectData(selectedProjectId);
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to record MB Measurement"));
  };

  // View MB Logs Modal
  const openMbLogs = (boqItem) => {
    setTargetBoqItem(boqItem);
    boqMbService.getMbRecords(boqItem.id)
      .then((res) => {
        setMbLogs(res.data || []);
        setShowMbLogModal(true);
      })
      .catch((err) => alert("Failed to fetch MB logs"));
  };

  // Open Material Request Modal
  const openMprModal = (boqItem) => {
    setTargetBoqItem(boqItem);
    setMprForm({
      quantity: boqItem.remaining_qty > 0 ? boqItem.remaining_qty.toString() : boqItem.approved_qty.toString(),
      estimated_cost: ((boqItem.remaining_qty > 0 ? boqItem.remaining_qty : boqItem.approved_qty) * boqItem.rate).toString(),
      reason: `Material purchase requirement generated for BOQ Item #${boqItem.id}: ${boqItem.item_name}`
    });
    setShowMprModal(true);
  };

  // Handle Create Material Request (PR)
  const handleCreateMpr = (e) => {
    e.preventDefault();
    if (!targetBoqItem) return;

    boqMbService.createMaterialRequest({
      project_id: parseInt(selectedProjectId),
      boq_item_id: targetBoqItem.id,
      material_name: targetBoqItem.item_name,
      quantity: parseFloat(mprForm.quantity),
      unit: targetBoqItem.unit,
      estimated_cost: parseFloat(mprForm.estimated_cost),
      reason: mprForm.reason,
      preferred_vendor_id: targetBoqItem.vendor_id
    })
      .then((res) => {
        alert(`Material Request #${res.data.request_number} generated successfully and submitted to Project Manager for Non-Financial Approval!`);
        setShowMprModal(false);
        setTargetBoqItem(null);
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to create Material Request"));
  };

  // Open Contractor Bill Modal
  const openBillModal = (boqItem) => {
    setTargetBoqItem(boqItem);
    setBillForm({
      billed_qty: boqItem.executed_qty > 0 ? boqItem.executed_qty.toString() : boqItem.approved_qty.toString(),
      billed_rate: boqItem.rate.toString(),
      remarks: `Contractor billing generated against verified MB Executed Quantity for ${boqItem.item_name}`
    });
    setShowBillModal(true);
  };

  // Handle Create Contractor Bill
  const handleCreateBill = (e) => {
    e.preventDefault();
    if (!targetBoqItem) return;
    if (!targetBoqItem.vendor_id) {
      alert("Please assign a Vendor / Contractor to this BOQ item before creating a bill.");
      return;
    }

    boqMbService.createContractorBill({
      project_id: parseInt(selectedProjectId),
      boq_item_id: targetBoqItem.id,
      vendor_id: targetBoqItem.vendor_id,
      billed_qty: parseFloat(billForm.billed_qty),
      billed_rate: parseFloat(billForm.billed_rate),
      remarks: billForm.remarks
    })
      .then((res) => {
        alert(`Contractor Bill #${res.data.bill_number} for ₹${res.data.total_amount.toLocaleString()} created successfully! Submitted for 4-Stage Financial Approval (Site Engineer ➔ Project Manager ➔ Finance ➔ Management).`);
        setShowBillModal(false);
        setTargetBoqItem(null);
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to submit Contractor Bill"));
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

      {/* Main Page Title & Project Filter */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">BOQ & Measurement Book (MB)</h1>
          <p className="page-subtitle">Project Bill of Quantities, WBS Line Items, Executed Quantity Logs & Contractor Billing</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <select 
            className="form-control" 
            style={{ width: '280px', fontWeight: 600 }} 
            value={selectedProjectId} 
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => setShowBoqModal(true)}>
            <Plus size={18} /> Add BOQ Item
          </button>
        </div>
      </div>

      {/* BOQ Master Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={20} color="#38bdf8" /> BOQ Master Line Items & Measurement Progress
          </h3>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Total Items: <strong>{boqs.length}</strong>
          </span>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>BOQ ID</th>
                <th>Item Description</th>
                <th>WBS Location</th>
                <th>Contractor / Vendor</th>
                <th>Unit</th>
                <th>Approved Qty</th>
                <th>Executed Qty</th>
                <th>Remaining Qty</th>
                <th>Unit Rate</th>
                <th>Total Amount</th>
                <th>Progress %</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {boqs.length === 0 ? (
                <tr>
                  <td colSpan="13" style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                    {loading ? "Loading project BOQ items..." : "No BOQ items added for this project yet. Click 'Add BOQ Item' to create one."}
                  </td>
                </tr>
              ) : (
                boqs.map((b) => {
                  const wbsPath = [b.phase_title, b.task_title, b.subtask_title].filter(Boolean).join(' ➔ ') || 'Unlinked';
                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 700, color: '#38bdf8' }}>BOQ-{String(b.id).padStart(3, '0')}</td>
                      <td style={{ fontWeight: 600, color: '#f8fafc', maxWidth: '200px' }}>{b.item_name}</td>
                      <td style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{wbsPath}</td>
                      <td>{b.contractor_name || <span style={{ color: '#64748b' }}>Unassigned</span>}</td>
                      <td><span className="tag-badge tag-info">{b.unit}</span></td>
                      <td style={{ fontWeight: 600 }}>{b.approved_qty.toLocaleString()} {b.unit}</td>
                      <td style={{ fontWeight: 600, color: '#10b981' }}>{b.executed_qty.toLocaleString()} {b.unit}</td>
                      <td style={{ fontWeight: 600, color: b.remaining_qty === 0 ? '#f43f5e' : '#f59e0b' }}>
                        {b.remaining_qty.toLocaleString()} {b.unit}
                      </td>
                      <td><span style={{ color: '#94a3b8' }}>₹{b.rate.toLocaleString()}/unit</span></td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>₹{b.total_amount.toLocaleString()}</td>
                      <td style={{ minWidth: '110px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${b.progress_pct}%`, height: '100%', background: b.progress_pct >= 100 ? '#10b981' : '#38bdf8' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{b.progress_pct}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`tag-badge ${b.status === 'COMPLETED' ? 'tag-success' : 'tag-primary'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }} 
                            onClick={() => { setTargetBoqItem(b); setShowMbModal(true); }}
                            title="Record actual site measurement"
                          >
                            <Plus size={12} /> MB
                          </button>

                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }} 
                            onClick={() => openMbLogs(b)}
                            title="View Measurement Book logs"
                          >
                            <Eye size={12} /> Logs
                          </button>

                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', color: '#818cf8', borderColor: 'rgba(129,140,248,0.3)' }} 
                            onClick={() => openMprModal(b)}
                            title="Generate Material Purchase Request"
                          >
                            <Package size={12} /> PR
                          </button>

                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }} 
                            onClick={() => openBillModal(b)}
                            title="Create Contractor Bill"
                          >
                            <DollarSign size={12} /> Bill
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE BOQ ITEM MODAL */}
      {showBoqModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '560px', background: '#1e293b', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0 }}>Add BOQ Line Item</h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowBoqModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateBoq}>
              <div className="form-group">
                <label>Item Name / Description *</label>
                <input required type="text" className="form-control" placeholder="Foundation Concrete Slab Pour (M30)" value={boqForm.item_name} onChange={e => setBoqForm({ ...boqForm, item_name: e.target.value })} />
              </div>

              {/* WBS Cascade Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>WBS Phase</label>
                  <select className="form-control" value={boqForm.phase_id} onChange={e => setBoqForm({ ...boqForm, phase_id: e.target.value, task_id: '', subtask_id: '' })}>
                    <option value="">-- Select WBS Phase --</option>
                    {wbsData.phases.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>WBS Task</label>
                  <select className="form-control" value={boqForm.task_id} onChange={e => setBoqForm({ ...boqForm, task_id: e.target.value, subtask_id: '' })}>
                    <option value="">-- Select WBS Task --</option>
                    {availableTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>WBS Subtask (Optional)</label>
                  <select className="form-control" value={boqForm.subtask_id} onChange={e => setBoqForm({ ...boqForm, subtask_id: e.target.value })}>
                    <option value="">-- Select WBS Subtask --</option>
                    {availableSubtasks.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Assigned Contractor / Vendor</label>
                  <select className="form-control" value={boqForm.vendor_id} onChange={e => setBoqForm({ ...boqForm, vendor_id: e.target.value })}>
                    <option value="">-- Select Contractor --</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.code})</option>)}
                  </select>
                </div>
              </div>

              {/* Quantities and Rate */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Unit *</label>
                  <select className="form-control" value={boqForm.unit} onChange={e => setBoqForm({ ...boqForm, unit: e.target.value })}>
                    <option value="cu.m">cu.m (Cubic Meters)</option>
                    <option value="sq.ft">sq.ft (Square Feet)</option>
                    <option value="sq.m">sq.m (Square Meters)</option>
                    <option value="Tonnes">Tonnes</option>
                    <option value="Running Meter">Running Meter</option>
                    <option value="Units">Units / Nos</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Approved Qty *</label>
                  <input required type="number" step="0.01" className="form-control" placeholder="800" value={boqForm.approved_qty} onChange={e => setBoqForm({ ...boqForm, approved_qty: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Unit Rate (₹) *</label>
                  <input required type="number" step="0.01" className="form-control" placeholder="150" value={boqForm.rate} onChange={e => setBoqForm({ ...boqForm, rate: e.target.value })} />
                </div>
              </div>

              {/* Auto Calculated Total & Budget Preview */}
              <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Auto-Calculated Total Amount:</span>
                <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>
                  {isNaN(calculatedTotal) || calculatedTotal <= 0 ? "₹0" : `₹${calculatedTotal.toLocaleString()}`}
                </strong>
              </div>

              {boqForm.phase_id && (
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(56,189,248,0.06)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Linked WBS Location: <strong>Phase #{boqForm.phase_id}</strong>
                  {boqForm.task_id ? ` ➔ Task #${boqForm.task_id}` : ''}
                  {boqForm.subtask_id ? ` ➔ Subtask #${boqForm.subtask_id}` : ''}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBoqModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save BOQ Line Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD MB MEASUREMENT MODAL */}
      {showMbModal && targetBoqItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '500px', background: '#1e293b', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Record Site Measurement (MB)</h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowMbModal(false)}><X size={16} /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Target: <strong>{targetBoqItem.item_name}</strong> (BOQ Approved Ceiling: {targetBoqItem.approved_qty} {targetBoqItem.unit})
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', padding: '0.65rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
              <div>Executed so far: <strong style={{ color: '#10b981' }}>{targetBoqItem.executed_qty} {targetBoqItem.unit}</strong></div>
              <div>Remaining ceiling: <strong style={{ color: '#f59e0b' }}>{targetBoqItem.remaining_qty} {targetBoqItem.unit}</strong></div>
            </div>

            <form onSubmit={handleRecordMb}>
              <div className="form-group">
                <label>Location / Zone Description *</label>
                <input required type="text" className="form-control" placeholder="Zone A - Substructure B2 Level" value={mbForm.location_zone} onChange={e => setMbForm({ ...mbForm, location_zone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Measured Quantity ({targetBoqItem.unit}) *</label>
                <input required type="number" step="0.01" max={targetBoqItem.remaining_qty} className="form-control" placeholder="200" value={mbForm.measured_qty} onChange={e => setMbForm({ ...mbForm, measured_qty: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Verification Notes / Remarks</label>
                <textarea className="form-control" rows="2" placeholder="Verified laser leveling & depth gauges..." value={mbForm.remarks} onChange={e => setMbForm({ ...mbForm, remarks: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMbModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save MB Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MB LOGS MODAL */}
      {showMbLogModal && targetBoqItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '640px', background: '#1e293b', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Verified Measurement Book (MB) Logs</h3>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>BOQ Item: {targetBoqItem.item_name}</p>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowMbLogModal(false)}><X size={16} /></button>
            </div>

            <div className="table-container" style={{ maxHeight: '320px', overflowY: 'auto' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Log ID</th>
                    <th>Date</th>
                    <th>Location / Zone</th>
                    <th>Measured Qty</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {mbLogs.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                        No MB logs recorded for this item yet.
                      </td>
                    </tr>
                  ) : (
                    mbLogs.map(l => (
                      <tr key={l.id}>
                        <td>MB-{String(l.id).padStart(4, '0')}</td>
                        <td>{new Date(l.log_date || l.created_at).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>{l.location_zone}</td>
                        <td style={{ color: '#10b981', fontWeight: 700 }}>{l.measured_qty} {l.unit || targetBoqItem.unit}</td>
                        <td><span className="tag-badge tag-success">{l.status}</span></td>
                        <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{l.remarks || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowMbLogModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MATERIAL REQUEST (PR) MODAL */}
      {showMprModal && targetBoqItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '500px', background: '#1e293b', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Create Material Request (PR)</h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowMprModal(false)}><X size={16} /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Ref BOQ Item: <strong>{targetBoqItem.item_name}</strong> (Rate: ₹{targetBoqItem.rate}/unit)
            </p>

            <form onSubmit={handleCreateMpr}>
              <div className="form-group">
                <label>Required Quantity ({targetBoqItem.unit}) *</label>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  className="form-control" 
                  value={mprForm.quantity} 
                  onChange={e => {
                    const qty = parseFloat(e.target.value) || 0;
                    setMprForm({ ...mprForm, quantity: e.target.value, estimated_cost: (qty * targetBoqItem.rate).toString() });
                  }} 
                />
              </div>
              <div className="form-group">
                <label>Estimated Cost (₹) *</label>
                <input required type="number" step="0.01" className="form-control" value={mprForm.estimated_cost} onChange={e => setMprForm({ ...mprForm, estimated_cost: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Requisition Reason</label>
                <textarea className="form-control" rows="2" value={mprForm.reason} onChange={e => setMprForm({ ...mprForm, reason: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMprModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate Material PR</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CONTRACTOR BILL MODAL */}
      {showBillModal && targetBoqItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '520px', background: '#1e293b', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Create Contractor Bill</h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowBillModal(false)}><X size={16} /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Target: <strong>{targetBoqItem.item_name}</strong> | Contractor: <strong>{targetBoqItem.contractor_name || 'Unassigned'}</strong>
            </p>

            <form onSubmit={handleCreateBill}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Billed Quantity ({targetBoqItem.unit}) *</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={billForm.billed_qty} 
                    onChange={e => setBillForm({ ...billForm, billed_qty: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Billed Rate (₹) *</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={billForm.billed_rate} 
                    onChange={e => setBillForm({ ...billForm, billed_rate: e.target.value })} 
                  />
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Total Contractor Bill Amount:</span>
                <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>
                  ₹{((parseFloat(billForm.billed_qty) || 0) * (parseFloat(billForm.billed_rate) || 0)).toLocaleString()}
                </strong>
              </div>

              <div className="form-group">
                <label>Billing Notes / Remarks</label>
                <textarea className="form-control" rows="2" value={billForm.remarks} onChange={e => setBillForm({ ...billForm, remarks: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBillModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  Submit Contractor Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
