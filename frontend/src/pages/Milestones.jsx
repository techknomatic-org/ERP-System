import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Flag, Plus, Search, Filter, AlertTriangle, CheckCircle, Clock, 
  Calendar, Layers, Edit, Trash2, XCircle, RefreshCw, Check, ArrowRight, Info
} from 'lucide-react';
import { milestoneService, projectService, wbsService } from '../services/api';

export default function Milestones() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProjectId = searchParams.get('project_id') || '';

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // WBS tasks for current selected project
  const [projectWbsNodes, setProjectWbsNodes] = useState([]);

  // Filter and Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [formData, setFormData] = useState({
    milestone_name: '',
    project_id: '',
    wbs_node_id: '',
    is_date_based: false,
    is_quantity_based: false,
    target_date: '',
    target_quantity: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Dynamic WBS Node summary for modal
  const [selectedNodeSummary, setSelectedNodeSummary] = useState(null);

  // Load Projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // When selected project changes, reload milestones and WBS nodes
  useEffect(() => {
    if (selectedProjectId) {
      setSearchParams({ project_id: selectedProjectId });
      fetchMilestones(selectedProjectId);
      fetchWbsNodes(selectedProjectId);
    } else {
      fetchAllMilestones();
    }
  }, [selectedProjectId]);

  const fetchProjects = async () => {
    try {
      const res = await projectService.getProjects();
      const list = Array.isArray(res.data) ? res.data : (res.data?.projects || []);
      setProjects(list);
      if (!selectedProjectId && list.length > 0) {
        setSelectedProjectId(list[0].id.toString());
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  };

  const fetchMilestones = async (projId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await milestoneService.getMilestones(projId ? parseInt(projId, 10) : undefined);
      setMilestones(res.data || []);
    } catch (err) {
      console.error("Failed to load milestones:", err);
      setError("Failed to load project milestones.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMilestones = async () => {
    setLoading(true);
    try {
      const res = await milestoneService.getMilestones();
      setMilestones(res.data || []);
    } catch (err) {
      console.error("Failed to load all milestones:", err);
      setError("Failed to load milestones.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWbsNodes = async (projId) => {
    try {
      const res = await wbsService.getProjectWbs(parseInt(projId, 10));
      const tasks = Array.isArray(res.data) ? res.data : (res.data?.tasks || []);
      setProjectWbsNodes(tasks);
    } catch (err) {
      console.error("Failed to load WBS nodes:", err);
      setProjectWbsNodes([]);
    }
  };

  // Helper date formatter
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const dt = new Date(dateStr);
      return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // Metrics summary
  const summaryMetrics = useMemo(() => {
    const total = milestones.length;
    const met = milestones.filter(m => m.status === 'MET').length;
    const notMet = total - met;
    const dateBased = milestones.filter(m => m.is_date_based).length;
    const qtyBased = milestones.filter(m => m.is_quantity_based).length;
    return { total, met, notMet, dateBased, qtyBased };
  }, [milestones]);

  // Filtered milestones
  const filteredMilestones = useMemo(() => {
    return milestones.filter(m => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        (m.milestone_name || '').toLowerCase().includes(q) ||
        (m.wbs_node_name || '').toLowerCase().includes(q) ||
        (m.wbs_code || '').toLowerCase().includes(q) ||
        (m.project_name || '').toLowerCase().includes(q)
      );

      const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;

      let matchesType = true;
      if (typeFilter === 'DATE') matchesType = m.is_date_based && !m.is_quantity_based;
      else if (typeFilter === 'QUANTITY') matchesType = m.is_quantity_based && !m.is_date_based;
      else if (typeFilter === 'BOTH') matchesType = m.is_date_based && m.is_quantity_based;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [milestones, searchQuery, statusFilter, typeFilter]);

  // Handle WBS Node selection in modal to load mapped BOQ summary
  const handleModalNodeChange = async (nodeIdStr) => {
    setFormData(prev => ({ ...prev, wbs_node_id: nodeIdStr }));
    if (!nodeIdStr) {
      setSelectedNodeSummary(null);
      return;
    }
    try {
      const res = await milestoneService.getWbsNodeBoqSummary(parseInt(nodeIdStr, 10));
      setSelectedNodeSummary(res.data);
    } catch (err) {
      console.error("Failed to load WBS node BOQ summary:", err);
      setSelectedNodeSummary(null);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingMilestoneId(null);
    setFormErrors({});
    setSelectedNodeSummary(null);
    const defaultProjId = selectedProjectId || (projects.length > 0 ? projects[0].id.toString() : '');
    const firstNodeId = projectWbsNodes.length > 0 ? projectWbsNodes[0].id.toString() : '';

    setFormData({
      milestone_name: '',
      project_id: defaultProjId,
      wbs_node_id: firstNodeId,
      is_date_based: true,
      is_quantity_based: false,
      target_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      target_quantity: ''
    });

    if (firstNodeId) {
      handleModalNodeChange(firstNodeId);
    }
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = async (m) => {
    setEditingMilestoneId(m.id);
    setFormErrors({});
    setFormData({
      milestone_name: m.milestone_name,
      project_id: m.project_id.toString(),
      wbs_node_id: m.wbs_node_id.toString(),
      is_date_based: m.is_date_based,
      is_quantity_based: m.is_quantity_based,
      target_date: m.target_date ? m.target_date.split('T')[0] : '',
      target_quantity: m.target_quantity !== null && m.target_quantity !== undefined ? m.target_quantity.toString() : ''
    });

    try {
      const res = await milestoneService.getWbsNodeBoqSummary(m.wbs_node_id);
      setSelectedNodeSummary(res.data);
    } catch (err) {
      setSelectedNodeSummary(null);
    }
    setIsModalOpen(true);
  };

  // Real-time calculation: does target quantity exceed mapped BOQ?
  const isQuantityExceedingMapped = useMemo(() => {
    if (!formData.is_quantity_based || !formData.target_quantity || !selectedNodeSummary) return false;
    const targetVal = parseFloat(formData.target_quantity);
    if (isNaN(targetVal) || targetVal <= 0) return false;
    return targetVal > (selectedNodeSummary.total_mapped_boq_qty || 0);
  }, [formData.is_quantity_based, formData.target_quantity, selectedNodeSummary]);

  // Form Validation
  const validateForm = () => {
    const errs = {};
    if (!formData.milestone_name || !formData.milestone_name.trim()) {
      errs.milestone_name = "Milestone Name is required.";
    }
    if (!formData.project_id) {
      errs.project_id = "Project is required.";
    }
    if (!formData.wbs_node_id) {
      errs.wbs_node_id = "WBS Node is required.";
    }

    // Mandatory Type Selection Rule
    if (!formData.is_date_based && !formData.is_quantity_based) {
      errs.type = "Select at least one milestone type.";
    }

    // Date-based validation
    if (formData.is_date_based && !formData.target_date) {
      errs.target_date = "Target Date is required for Date-based milestones.";
    }

    // Quantity-based validation
    if (formData.is_quantity_based) {
      const qtyNum = parseFloat(formData.target_quantity);
      if (formData.target_quantity === '' || isNaN(qtyNum) || qtyNum <= 0) {
        errs.target_quantity = "Target Quantity / % must be a valid positive number.";
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Milestone Save
  const handleSaveMilestone = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      milestone_name: formData.milestone_name.trim(),
      project_id: parseInt(formData.project_id, 10),
      wbs_node_id: parseInt(formData.wbs_node_id, 10),
      is_date_based: formData.is_date_based,
      is_quantity_based: formData.is_quantity_based,
      target_date: formData.is_date_based ? formData.target_date : null,
      target_quantity: formData.is_quantity_based ? parseFloat(formData.target_quantity) : null
    };

    try {
      if (editingMilestoneId) {
        await milestoneService.updateMilestone(editingMilestoneId, payload);
        setSuccessMsg("Milestone updated successfully.");
      } else {
        await milestoneService.createMilestone(payload);
        setSuccessMsg("Milestone created successfully.");
      }
      setIsModalOpen(false);
      fetchMilestones(selectedProjectId);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Save milestone error:", err);
      const msg = err.response?.data?.detail || "Failed to save milestone.";
      setFormErrors(prev => ({ ...prev, general: msg }));
    }
  };

  // Delete Milestone
  const handleDeleteMilestone = async (m) => {
    if (!window.confirm(`Are you sure you want to delete milestone '${m.milestone_name}'?`)) {
      return;
    }
    try {
      await milestoneService.deleteMilestone(m.id);
      setSuccessMsg(`Milestone '${m.milestone_name}' deleted.`);
      fetchMilestones(selectedProjectId);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Delete milestone error:", err);
      setError(err.response?.data?.detail || "Failed to delete milestone.");
    }
  };

  return (
    <div className="page-container" style={{ padding: '1.5rem', background: '#0b0f19', color: '#e2e8f0', minHeight: '100vh' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.65rem', margin: 0 }}>
            <Flag style={{ color: '#38bdf8' }} size={28} />
            Project Milestones
          </h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem', fontSize: '0.9rem' }}>
            Feature WPT-03: Define date-based and quantity-based project milestone gates linked to WBS nodes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={handleOpenCreateModal}
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 600,
              padding: '0.55rem 1.25rem',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.3)'
            }}
          >
            <Plus size={16} /> + Define Milestone
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#6ee7b7', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metrics Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '1rem' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Milestones</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>{summaryMetrics.total}</div>
        </div>
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '1rem' }}>
          <span style={{ color: '#34d399', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>MET Milestones</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#34d399', marginTop: '0.2rem' }}>{summaryMetrics.met}</div>
        </div>
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', padding: '1rem' }}>
          <span style={{ color: '#fbbf24', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>NOT MET Milestones</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fbbf24', marginTop: '0.2rem' }}>{summaryMetrics.notMet}</div>
        </div>
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', padding: '1rem' }}>
          <span style={{ color: '#38bdf8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Date-Based</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>{summaryMetrics.dateBased}</div>
        </div>
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '8px', padding: '1rem' }}>
          <span style={{ color: '#c084fc', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Quantity-Based</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#c084fc', marginTop: '0.2rem' }}>{summaryMetrics.qtyBased}</div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', flex: 1, minWidth: '300px' }}>
          
          {/* Project Filter */}
          <div style={{ minWidth: '220px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.45rem 0.65rem', color: '#f8fafc', fontSize: '0.85rem' }}
            >
              <option value="">[ All Projects ]</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Filter by milestone name or WBS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.45rem 0.75rem 0.45rem 2.2rem', color: '#f8fafc', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Milestone Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.45rem 0.65rem', color: '#f8fafc', fontSize: '0.85rem' }}
            >
              <option value="ALL">All Types</option>
              <option value="DATE">Date-based Only</option>
              <option value="QUANTITY">Quantity-based Only</option>
              <option value="BOTH">Both (Date + Qty)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.45rem 0.65rem', color: '#f8fafc', fontSize: '0.85rem' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="MET">MET</option>
              <option value="NOT MET">NOT MET</option>
            </select>
          </div>

        </div>

        <button
          onClick={() => {
            if (selectedProjectId) fetchMilestones(selectedProjectId);
            else fetchAllMilestones();
          }}
          className="btn btn-secondary"
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', padding: '0.45rem 0.85rem', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '1rem' }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Milestones Table */}
      <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} className="animate-spin inline mb-2" />
            <p>Loading project milestones...</p>
          </div>
        ) : filteredMilestones.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <Flag size={40} style={{ color: '#475569', marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: '0.2rem 0' }}>
              No milestones found.
            </p>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Define date-based or quantity-based milestones to govern project progress gates.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.55rem 1.2rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}
            >
              <Plus size={16} /> Define Milestone
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Milestone Name</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Project</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Linked WBS Node</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Type</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Target Date</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Target Qty / %</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>WBS Actual</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Overall Status</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMilestones.map(m => (
                  <tr
                    key={m.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s ease' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Flag size={14} style={{ color: m.status === 'MET' ? '#34d399' : '#38bdf8' }} />
                        {m.milestone_name}
                      </div>
                      {m.has_quantity_warning && (
                        <div style={{ fontSize: '0.72rem', color: '#fbbf24', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} title={m.quantity_warning_message}>
                          <AlertTriangle size={12} /> Planned ahead of mapped BOQ ({m.total_mapped_boq_qty} m³)
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                      {m.project_name}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                      <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{m.wbs_node_name}</div>
                      {m.wbs_code && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>WBS: {m.wbs_code}</div>}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {m.is_date_based && (
                          <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                            Date
                          </span>
                        )}
                        {m.is_quantity_based && (
                          <span style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc', border: '1px solid rgba(192, 132, 252, 0.3)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                            Quantity
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                      {m.is_date_based ? (
                        <div>
                          <span style={{ fontWeight: 500 }}>{formatDate(m.target_date)}</span>
                          <div style={{ marginTop: '0.15rem' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '3px',
                              fontWeight: 600,
                              background: m.is_date_met ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.2)',
                              color: m.is_date_met ? '#34d399' : '#94a3b8'
                            }}>
                              Date: {m.is_date_met ? 'Met' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#64748b' }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: m.is_quantity_based ? '#c084fc' : '#64748b' }}>
                      {m.is_quantity_based ? (
                        <div>
                          <span>{m.target_quantity?.toLocaleString()}</span>
                          <div style={{ marginTop: '0.15rem' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '3px',
                              fontWeight: 600,
                              background: m.is_quantity_met ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.2)',
                              color: m.is_quantity_met ? '#34d399' : '#94a3b8'
                            }}>
                              Qty: {m.is_quantity_met ? 'Met' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      ) : '—'}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#cbd5e1' }}>
                      <div style={{ fontWeight: 600, color: m.current_actual_qty > 0 ? '#34d399' : '#94a3b8' }}>
                        {m.current_actual_qty?.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {m.current_progress_pct}% prog
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        background: m.status === 'MET' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                        border: m.status === 'MET' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.35)',
                        color: m.status === 'MET' ? '#34d399' : '#fbbf24'
                      }}>
                        {m.status === 'MET' ? <CheckCircle size={13} /> : <Clock size={13} />}
                        {m.status}
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                        <button
                          onClick={() => handleOpenEditModal(m)}
                          className="btn btn-sm"
                          style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', padding: '0.25rem 0.55rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}
                          title="Edit Milestone"
                        >
                          <Edit size={13} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMilestone(m)}
                          className="btn btn-sm"
                          style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.25rem 0.55rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}
                          title="Delete Milestone"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MILESTONE MODAL */}
      {isModalOpen && (
        <div 
          onClick={() => setIsModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0f172a', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', width: '100%', maxWidth: '650px', maxHeight: '92vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6)' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Flag size={20} />
                  {editingMilestoneId ? 'Edit Project Milestone' : 'Define New Milestone'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                  Configure date-based or quantity-based milestone gate linked to WBS.
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><XCircle size={20} /></button>
            </div>

            {formErrors.general && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {formErrors.general}
              </div>
            )}

            <form onSubmit={handleSaveMilestone}>

              {/* Milestone Name */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Milestone Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Substructure Completion / Foundation Signoff"
                  value={formData.milestone_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, milestone_name: e.target.value }))}
                  style={{ width: '100%', background: '#1e293b', border: formErrors.milestone_name ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                />
                {formErrors.milestone_name && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.milestone_name}</div>}
              </div>

              {/* Project & WBS Node Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Project *
                  </label>
                  <select
                    value={formData.project_id}
                    disabled={!!editingMilestoneId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      setFormData(prev => ({ ...prev, project_id: pId, wbs_node_id: '' }));
                      if (pId) fetchWbsNodes(pId);
                    }}
                    style={{ width: '100%', background: '#1e293b', border: formErrors.project_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  >
                    <option value="">[ Select Project ]</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                  {formErrors.project_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.project_id}</div>}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    WBS Node *
                  </label>
                  <select
                    value={formData.wbs_node_id}
                    onChange={(e) => handleModalNodeChange(e.target.value)}
                    style={{ width: '100%', background: '#1e293b', border: formErrors.wbs_node_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  >
                    <option value="">[ Select WBS Node ]</option>
                    {projectWbsNodes.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.wbs_code ? `${n.wbs_code} ` : ''}{n.title} ({n.task_level || 'Task'})
                      </option>
                    ))}
                  </select>
                  {formErrors.wbs_node_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.wbs_node_id}</div>}
                </div>
              </div>

              {/* Dynamic WBS Node Context Box */}
              {selectedNodeSummary && (
                <div style={{ background: 'rgba(30, 41, 59, 0.45)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>Mapped BOQ Quantity:</span>
                    <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.95rem' }}>
                      {selectedNodeSummary.total_mapped_boq_qty?.toLocaleString()} {selectedNodeSummary.unit}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>WBS Actual Executed:</span>
                    <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.95rem' }}>
                      {selectedNodeSummary.actual_qty?.toLocaleString()} {selectedNodeSummary.unit}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>WBS Current Progress:</span>
                    <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.95rem' }}>
                      {selectedNodeSummary.progress_pct}%
                    </div>
                  </div>
                </div>
              )}

              {/* Milestone Type Checkboxes (Requirement: Checkbox pair, at least one required) */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: formErrors.type ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
                  Milestone Type (Select at least one) *
                </label>

                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#e2e8f0' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_date_based}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_date_based: e.target.checked }))}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0284c7' }}
                    />
                    <span>1. Date-based</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#e2e8f0' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_quantity_based}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_quantity_based: e.target.checked }))}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0284c7' }}
                    />
                    <span>2. Quantity-based</span>
                  </label>
                </div>

                {formErrors.type && (
                  <div style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '0.5rem', fontWeight: 600 }}>
                    {formErrors.type}
                  </div>
                )}
              </div>

              {/* Conditional Inputs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: (formData.is_date_based && formData.is_quantity_based) ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                
                {/* Target Date (shown only when Date-based is checked) */}
                {formData.is_date_based && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Target Date *
                    </label>
                    <input
                      type="date"
                      value={formData.target_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, target_date: e.target.value }))}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.target_date ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                    {formErrors.target_date && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.target_date}</div>}
                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                      Milestone is Met when Current Date &ge; Target Date.
                    </span>
                  </div>
                )}

                {/* Target Quantity / % (shown only when Quantity-based is checked) */}
                {formData.is_quantity_based && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Target Quantity / % *
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 50 or 100"
                      value={formData.target_quantity}
                      onChange={(e) => setFormData(prev => ({ ...prev, target_quantity: e.target.value }))}
                      style={{ width: '100%', background: '#1e293b', border: (formErrors.target_quantity || isQuantityExceedingMapped) ? (isQuantityExceedingMapped ? '1px solid #f59e0b' : '1px solid #ef4444') : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                    {formErrors.target_quantity && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.target_quantity}</div>}
                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                      Milestone is Met when WBS actual quantity or progress % reaches this target.
                    </span>
                  </div>
                )}

              </div>

              {/* Requirement 4: Non-blocking Quantity Warning */}
              {isQuantityExceedingMapped && selectedNodeSummary && (
                <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '6px', padding: '0.75rem 1rem', color: '#fbbf24', fontSize: '0.82rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Planning Ahead Warning:</strong> Target quantity ({formData.target_quantity}) exceeds the WBS node's total mapped BOQ quantity ({selectedNodeSummary.total_mapped_boq_qty} {selectedNodeSummary.unit}). This milestone is planned ahead of the currently mapped quantity. (Save is allowed).
                  </div>
                </div>
              )}

              {/* Strict AND Logic Explanatory Banner when both are selected */}
              {formData.is_date_based && formData.is_quantity_based && (
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', padding: '0.65rem 0.85rem', color: '#93c5fd', fontSize: '0.78rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Info size={16} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>Strict AND Rule:</strong> Because both types are selected, this milestone will be <strong>MET</strong> only when <strong>BOTH</strong> the target date is reached AND the target quantity is executed.
                  </span>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.5rem 1.1rem', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 600,
                    padding: '0.5rem 1.3rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Check size={16} /> {editingMilestoneId ? 'Save Changes' : 'Save Milestone'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
