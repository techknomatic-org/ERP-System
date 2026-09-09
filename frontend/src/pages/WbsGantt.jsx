import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Layers, Plus, Calendar, Clock, CheckCircle2, AlertTriangle, Edit3, Trash2, ArrowLeft, ChevronDown, ChevronRight, CornerDownRight, FolderTree, X, BarChart3, ListFilter, Send } from 'lucide-react';
import { projectService, wbsService, boqMbService } from '../services/api';

export default function WbsGantt() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlProjectId = searchParams.get('projectId');

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId || '');
  const [rawTasks, setRawTasks] = useState([]);
  const [projectBoqItems, setProjectBoqItems] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState(null);
  const [publishError, setPublishError] = useState(null);
  
  // View Switcher State: 'table' vs 'gantt'
  const [activeView, setActiveView] = useState('table');

  // Collapse state for Phase and Task IDs
  const [collapsed, setCollapsed] = useState({});

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Edit / Update Modal State
  const [editModalItem, setEditModalItem] = useState(null);
  const [editFormData, setEditFormData] = useState({
    wbs_code: '',
    title: '',
    node_type: 'Phase',
    parent_node_id: '',
    boq_item_id: '',
    contractor_name: '',
    start_date: '',
    end_date: '',
    planned_qty: '',
    planned_budget: '',
    progress_pct: 0
  });
  const [editFormError, setEditFormError] = useState('');

  // Form State for Creation
  const [formData, setFormData] = useState({
    item_type: 'Phase', // 'Phase' | 'Activity' | 'Task'
    parent_node_id: '',
    boq_item_id: '',
    wbs_code: '',
    title: '',
    contractor_name: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    planned_qty: '',
    planned_budget: ''
  });

  const [formError, setFormError] = useState('');

  useEffect(() => {
    projectService.getProjects()
      .then((res) => {
        setProjects(res.data);
        if (!selectedProjectId && res.data.length > 0) {
          setSelectedProjectId(res.data[0].id.toString());
        }
      })
      .catch((err) => console.error("Error loading projects:", err));
  }, []);

  const loadWbs = (projectId) => {
    if (!projectId) return;
    setLoading(true);
    wbsService.getProjectWbs(projectId)
      .then((res) => setRawTasks(res.data))
      .catch((err) => console.error("Error loading WBS:", err))
      .finally(() => setLoading(false));

    boqMbService.getBoqItems(projectId)
      .then((res) => setProjectBoqItems(res.data || []))
      .catch((err) => console.error("Error loading BOQ items:", err));
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadWbs(selectedProjectId);
    }
  }, [selectedProjectId]);

  const handlePublish = async () => {
    if (!selectedProjectId) return;
    setPublishing(true);
    setPublishMessage(null);
    setPublishError(null);
    try {
      const res = await wbsService.publishWbs(selectedProjectId);
      setPublishMessage(res.data?.message || "Work Plan published successfully!");
      loadWbs(selectedProjectId);
    } catch (err) {
      setPublishError(err.response?.data?.detail || "Cannot publish Work Plan.");
    } finally {
      setPublishing(false);
    }
  };

  // Toggle Collapse
  const toggleCollapse = (id) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const getQtyMetrics = (item) => {
    const linkedBoqs = item.linked_boqs || [];
    if (linkedBoqs.length > 0) {
      const planned = linkedBoqs.reduce((sum, b) => sum + (Number(b.approved_qty) || 0), 0);
      const executed = linkedBoqs.reduce((sum, b) => sum + (Number(b.executed_qty) || 0), 0);
      const remaining = Math.max(0, planned - executed);
      const unit = linkedBoqs[0]?.unit ? ` ${linkedBoqs[0].unit}` : '';
      const prog = planned > 0 ? Math.min(100, Math.round((executed / planned) * 10000) / 100) : 0;

      return {
        hasQty: true,
        plannedRaw: planned,
        executedRaw: executed,
        plannedStr: `${planned.toLocaleString()}${unit}`,
        executedStr: `${executed.toLocaleString()}${unit}`,
        remainingStr: `${remaining.toLocaleString()}${unit}`,
        progressPct: prog
      };
    } else if (Number(item.planned_qty) > 0 || Number(item.actual_qty) > 0) {
      const planned = Number(item.planned_qty || 0);
      const executed = Number(item.actual_qty || 0);
      const remaining = Math.max(0, planned - executed);
      const prog = planned > 0 ? Math.min(100, Math.round((executed / planned) * 10000) / 100) : 0;

      return {
        hasQty: true,
        plannedRaw: planned,
        executedRaw: executed,
        plannedStr: planned.toLocaleString(),
        executedStr: executed.toLocaleString(),
        remainingStr: remaining.toLocaleString(),
        progressPct: prog
      };
    } else {
      return {
        hasQty: false,
        plannedRaw: 0,
        executedRaw: 0,
        plannedStr: '—',
        executedStr: '—',
        remainingStr: '—',
        progressPct: null
      };
    }
  };

  // Build True Hierarchical WBS Tree with Date & Status Rules
  const buildTree = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const phases = rawTasks.filter(t => {
      const lvl = (t.task_level || '').toLowerCase();
      return lvl === 'phase' || !t.parent_task_id;
    });

    const phaseMap = phases.map(phase => {
      const tasks = rawTasks.filter(t => t.parent_task_id === phase.id);

      const taskNodes = tasks.map(task => {
        const subtasks = rawTasks.filter(t => t.parent_task_id === task.id);

        const subtaskNodes = subtasks.map(subtask => {
          const subMetrics = getQtyMetrics(subtask);
          const sDate = subtask.start_date ? new Date(subtask.start_date) : null;
          const eDate = subtask.end_date ? new Date(subtask.end_date) : null;
          if (sDate) sDate.setHours(0, 0, 0, 0);
          if (eDate) eDate.setHours(0, 0, 0, 0);

          let rawProg = subMetrics.hasQty ? subMetrics.progressPct : Number(subtask.progress_pct || 0);
          let subProg = rawProg;
          let subStatus = (subtask.status || 'not_started').toLowerCase();
          let hasInconsistency = Boolean(subtask.has_date_inconsistency);
          let warningMsg = subtask.inconsistency_warning || null;

          // Rule 1: Current Date < Start Date
          if (sDate && today < sDate) {
            subProg = 0;
            subStatus = 'not_started';
            if ((subMetrics.hasQty && subMetrics.executedRaw > 0) || rawProg > 0) {
              hasInconsistency = true;
              warningMsg = warningMsg || `Executed quantity recorded prior to planned start date (${sDate.toLocaleDateString()}). Status remains NOT STARTED (0% progress) until start date.`;
            }
          } else if (eDate && today > eDate) {
            // Rule 3: Current Date > End Date
            if ((subMetrics.hasQty && subMetrics.executedRaw >= subMetrics.plannedRaw) || subProg >= 100) {
              subStatus = 'completed';
            } else {
              subStatus = 'delayed';
            }
          } else {
            // Rule 2: Start Date <= Current Date <= End Date
            if ((subMetrics.hasQty && subMetrics.executedRaw >= subMetrics.plannedRaw) || subProg >= 100) {
              subStatus = 'completed';
            } else if ((subMetrics.hasQty && subMetrics.executedRaw > 0) || subProg > 0) {
              subStatus = 'in_progress';
            } else {
              subStatus = 'not_started';
            }
          }

          return {
            ...subtask,
            progress_pct: subProg,
            status: subStatus,
            has_date_inconsistency: hasInconsistency,
            inconsistency_warning: warningMsg
          };
        });

        const tDate = task.start_date ? new Date(task.start_date) : null;
        const teDate = task.end_date ? new Date(task.end_date) : null;
        if (tDate) tDate.setHours(0, 0, 0, 0);
        if (teDate) teDate.setHours(0, 0, 0, 0);

        let taskProgress = Number(task.progress_pct || 0);
        let hasTaskInconsistency = Boolean(task.has_date_inconsistency);
        let taskWarningMsg = task.inconsistency_warning || null;

        if (subtaskNodes.length > 0) {
          const sumSub = subtaskNodes.reduce((acc, s) => acc + Number(s.progress_pct || 0), 0);
          taskProgress = Math.round((sumSub / subtaskNodes.length) * 100) / 100;
          hasTaskInconsistency = hasTaskInconsistency || subtaskNodes.some(s => s.has_date_inconsistency);
        } else {
          const taskMetrics = getQtyMetrics(task);
          if (taskMetrics.hasQty) {
            taskProgress = taskMetrics.progressPct;
          }
        }

        let taskStatus = 'not_started';
        if (tDate && today < tDate) {
          taskProgress = 0;
          taskStatus = 'not_started';
        } else if (teDate && today > teDate) {
          taskStatus = taskProgress >= 100 ? 'completed' : 'delayed';
        } else {
          taskStatus = taskProgress >= 100 ? 'completed' : (taskProgress > 0 ? 'in_progress' : 'not_started');
        }

        return { 
          ...task, 
          subtasks: subtaskNodes, 
          progress_pct: taskProgress, 
          status: taskStatus,
          has_date_inconsistency: hasTaskInconsistency,
          inconsistency_warning: taskWarningMsg,
          isCalculated: subtaskNodes.length > 0,
          required_till_now: Number(task.required_till_now || 0),
          remaining_budget: Number(task.remaining_budget || 0),
          budget_utilization_pct: Number(task.budget_utilization_pct || 0),
          linked_boqs: task.linked_boqs || []
        };
      });

      const pDate = phase.start_date ? new Date(phase.start_date) : null;
      const peDate = phase.end_date ? new Date(phase.end_date) : null;
      if (pDate) pDate.setHours(0, 0, 0, 0);
      if (peDate) peDate.setHours(0, 0, 0, 0);

      let phaseProgress = Number(phase.progress_pct || 0);
      let hasPhaseInconsistency = Boolean(phase.has_date_inconsistency);
      let phaseWarningMsg = phase.inconsistency_warning || null;

      if (taskNodes.length > 0) {
        const sumTask = taskNodes.reduce((acc, t) => acc + Number(t.progress_pct || 0), 0);
        phaseProgress = Math.round((sumTask / taskNodes.length) * 100) / 100;
        hasPhaseInconsistency = hasPhaseInconsistency || taskNodes.some(t => t.has_date_inconsistency);
      } else {
        const phaseMetrics = getQtyMetrics(phase);
        if (phaseMetrics.hasQty) {
          phaseProgress = phaseMetrics.progressPct;
        }
      }

      let phaseStatus = 'not_started';
      if (pDate && today < pDate) {
        phaseProgress = 0;
        phaseStatus = 'not_started';
      } else if (peDate && today > peDate) {
        phaseStatus = phaseProgress >= 100 ? 'completed' : 'delayed';
      } else {
        phaseStatus = phaseProgress >= 100 ? 'completed' : (phaseProgress > 0 ? 'in_progress' : 'not_started');
      }

      return { 
        ...phase, 
        tasks: taskNodes, 
        progress_pct: phaseProgress, 
        status: phaseStatus,
        has_date_inconsistency: hasPhaseInconsistency,
        inconsistency_warning: phaseWarningMsg,
        isCalculated: taskNodes.length > 0,
        required_till_now: Number(phase.required_till_now || 0),
        remaining_budget: Number(phase.remaining_budget || 0),
        budget_utilization_pct: Number(phase.budget_utilization_pct || 0),
        linked_boqs: phase.linked_boqs || []
      };
    });

    return phaseMap;
  };

  const treeData = buildTree();

  const availablePhases = rawTasks.filter(t => (t.task_level || '').toLowerCase() === 'phase' || !t.parent_task_id);
  const availableTasks = rawTasks.filter(t => {
    const lvl = (t.task_level || '').toLowerCase();
    if (lvl !== 'task') return false;
    if (formData.parent_phase_id) {
      return t.parent_task_id === parseInt(formData.parent_phase_id);
    }
    return true;
  });

  const handleAddTaskFromPhase = (phaseId) => {
    setFormData({
      item_type: 'Activity',
      parent_node_id: phaseId.toString(),
      parent_phase_id: phaseId.toString(),
      parent_task_id: '',
      wbs_code: '',
      title: '',
      contractor_name: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      planned_qty: '',
      planned_budget: ''
    });
    setFormError('');
    setShowCreateModal(true);
  };

  const handleAddSubtaskFromTask = (phaseId, taskId) => {
    setFormData({
      item_type: 'Task',
      parent_node_id: taskId.toString(),
      parent_phase_id: phaseId.toString(),
      parent_task_id: taskId.toString(),
      wbs_code: '',
      title: '',
      contractor_name: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      planned_qty: '',
      planned_budget: ''
    });
    setFormError('');
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (item, parentPhaseName = '', parentTaskName = '') => {
    setEditModalItem({ ...item, parent_phase_name: parentPhaseName, parent_task_name: parentTaskName });
    setEditFormData({
      wbs_code: item.wbs_code || '',
      title: item.title || '',
      node_type: item.task_level || 'Phase',
      parent_node_id: item.parent_task_id ? item.parent_task_id.toString() : '',
      boq_item_id: item.boq_item_id ? item.boq_item_id.toString() : '',
      contractor_name: item.contractor_name || '',
      start_date: item.start_date ? new Date(item.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      end_date: item.end_date ? new Date(item.end_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      planned_qty: item.planned_qty || '',
      planned_budget: item.planned_budget || 0,
      progress_pct: item.progress_pct || 0
    });
    setEditFormError('');
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    if (!selectedProjectId) {
      setFormError("Please select a project first.");
      return;
    }
    if (!formData.title || !formData.title.trim()) {
      setFormError("WBS Node Name cannot be blank.");
      return;
    }
    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      setFormError("Child date range must fall within the parent's planned date range.");
      return;
    }

    wbsService.createTask({
      project_id: parseInt(selectedProjectId),
      node_type: formData.item_type,
      task_level: formData.item_type,
      parent_task_id: formData.parent_node_id ? parseInt(formData.parent_node_id) : null,
      boq_item_id: formData.boq_item_id ? parseInt(formData.boq_item_id) : null,
      wbs_code: formData.wbs_code || null,
      title: formData.title.trim(),
      contractor_name: formData.contractor_name || null,
      planned_qty: parseFloat(formData.planned_qty || 0),
      planned_budget: parseFloat(formData.planned_budget || 0),
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString()
    })
      .then(() => {
        setShowCreateModal(false);
        setFormData({
          item_type: 'Phase',
          parent_node_id: '',
          boq_item_id: '',
          wbs_code: '',
          title: '',
          contractor_name: '',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          planned_qty: '',
          planned_budget: ''
        });
        loadWbs(selectedProjectId);
      })
      .catch((err) => {
        const detail = err.response?.data?.detail;
        let msg = "Failed to create WBS node";
        if (typeof detail === 'string') {
          msg = detail;
        } else if (Array.isArray(detail)) {
          msg = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
        } else if (detail && typeof detail === 'object') {
          msg = detail.message || JSON.stringify(detail);
        }
        setFormError(msg);
      });
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editModalItem) return;
    setEditFormError('');

    if (!editFormData.title || !editFormData.title.trim()) {
      setEditFormError("WBS Node Name cannot be blank.");
      return;
    }

    wbsService.updateTask(editModalItem.id, {
      wbs_code: editFormData.wbs_code,
      title: editFormData.title.trim(),
      parent_task_id: editFormData.parent_node_id ? parseInt(editFormData.parent_node_id) : null,
      node_type: editFormData.node_type || editModalItem.task_level,
      boq_item_id: editFormData.boq_item_id ? parseInt(editFormData.boq_item_id) : null,
      contractor_name: editFormData.contractor_name,
      planned_qty: parseFloat(editFormData.planned_qty || 0),
      planned_budget: parseFloat(editFormData.planned_budget || 0),
      start_date: new Date(editFormData.start_date).toISOString(),
      end_date: new Date(editFormData.end_date).toISOString(),
      progress_pct: editModalItem.isCalculated ? editModalItem.progress_pct : parseFloat(editFormData.progress_pct)
    })
      .then(() => {
        setEditModalItem(null);
        loadWbs(selectedProjectId);
      })
      .catch((err) => {
        const detail = err.response?.data?.detail;
        let msg = "Failed to update WBS node";
        if (typeof detail === 'string') {
          msg = detail;
        } else if (Array.isArray(detail)) {
          msg = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
        } else if (detail && typeof detail === 'object') {
          msg = detail.message || JSON.stringify(detail);
        }
        setEditFormError(msg);
      });
  };

  const handleDeleteTask = (id, title, hasChildren) => {
    if (hasChildren) {
      alert("Reassign or delete child nodes first.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete '${title}'?`)) {
      wbsService.deleteTask(id)
        .then(() => loadWbs(selectedProjectId))
        .catch((err) => alert(err.response?.data?.detail || "Reassign or delete child nodes first."));
    }
  };

  const currentProject = projects.find(p => p.id === parseInt(selectedProjectId));

  // Dynamic Status Resolver enforcing Date Rules 1, 2, 3
  const getDerivedStatusInfo = (item, overrideProg) => {
    if (!item) return { label: 'NOT STARTED', tagClass: 'tag-warning' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sDateStr = item.start_date;
    const eDateStr = item.end_date;
    const sDate = sDateStr ? new Date(sDateStr) : null;
    const eDate = eDateStr ? new Date(eDateStr) : null;
    if (sDate) sDate.setHours(0, 0, 0, 0);
    if (eDate) eDate.setHours(0, 0, 0, 0);

    const dbStatus = (item.status || '').toLowerCase();
    const prog = overrideProg !== undefined ? Number(overrideProg || 0) : Number(item.progress_pct || 0);

    // Rule 1: Current Date < Start Date -> NOT STARTED (0%)
    if (sDate && today < sDate) {
      return { label: 'NOT STARTED', tagClass: 'tag-warning' };
    }

    // Rule 3: Current Date > End Date
    if (eDate && today > eDate) {
      if (dbStatus === 'completed' || prog >= 100) {
        return { label: 'COMPLETED', tagClass: 'tag-success' };
      }
      return { label: 'DELAYED', tagClass: 'tag-danger' };
    }

    // Rule 2: Start Date <= Current Date <= End Date (Active Period)
    if (dbStatus === 'completed' || prog >= 100) {
      return { label: 'COMPLETED', tagClass: 'tag-success' };
    }
    if (dbStatus === 'in_progress' || prog > 0) {
      return { label: 'IN PROGRESS', tagClass: 'tag-info' };
    }
    if (dbStatus === 'delayed') {
      return { label: 'DELAYED', tagClass: 'tag-danger' };
    }

    return { label: 'NOT STARTED', tagClass: 'tag-warning' };
  };

  const timelineMonths = ['Oct 2026', 'Nov 2026', 'Dec 2026', 'Jan 2027', 'Feb 2027', 'Mar 2027', 'Apr 2027', 'May 2027', 'Jun 2027', 'Jul 2027', 'Aug 2027', 'Sep 2027', 'Oct 2027', 'Nov 2027', 'Dec 2027', 'Jan 2028', 'Feb 2028', 'Mar 2028', 'Apr 2028', 'May 2028', 'Jun 2028'];

  return (
    <div className="content-page">
      {/* Header Controls */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {selectedProjectId ? (
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/projects/${selectedProjectId}`)}>
            <ArrowLeft size={16} /> Back to Project Details
          </button>
        ) : <div />}

        {currentProject && (
          <span className="tag-badge tag-info" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
            Project: <strong>{currentProject.name}</strong> | {currentProject.code}
          </span>
        )}
      </div>

      <div className="section-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Layers color="var(--primary)" size={28} /> Work Breakdown Structure & Timeline
          </h1>
          <p className="page-subtitle">
            Data Center WBS Hierarchy: L1 Phase ➔ L2 Work Package ➔ L3 Task Execution & Quantity Tracking
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            className="form-select" 
            style={{ width: '240px' }}
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
            ))}
          </select>

          {/* VIEW SWITCHER TABS */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className={`btn btn-sm ${activeView === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
              onClick={() => setActiveView('table')}
            >
              <FolderTree size={14} /> WBS Tree Table
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeView === 'gantt' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none' }}
              onClick={() => setActiveView('gantt')}
            >
              <BarChart3 size={14} /> Interactive Gantt Chart
            </button>
          </div>

          <button 
            type="button" 
            className="btn btn-success" 
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#ffffff', fontWeight: 600 }}
            disabled={publishing || !selectedProjectId}
            onClick={handlePublish}
          >
            <Send size={16} /> {publishing ? "Publishing..." : "Publish Work Plan"}
          </button>

          <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Add WBS Node
          </button>
        </div>
      </div>

      {publishMessage && (
        <div style={{ padding: '0.8rem 1rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '8px', color: '#34d399', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <CheckCircle2 size={18} /> {publishMessage}
        </div>
      )}

      {publishError && (
        <div style={{ padding: '0.8rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#f87171', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <AlertTriangle size={18} /> {publishError}
        </div>
      )}

      {/* 1. VIEW 1: WBS TASK HIERARCHY TABLE */}
      {activeView === 'table' && (
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <div className="card-title"><FolderTree size={18} color="var(--primary)" /> Work Breakdown Structure & Execution Table</div>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>WBS CODE</th>
                  <th style={{ width: '80px' }}>LEVEL</th>
                  <th>WBS PHASE / TASK / SUBTASK</th>
                  <th>START DATE</th>
                  <th>END DATE</th>
                  <th>PLANNED QTY</th>
                  <th>EXECUTED QTY</th>
                  <th>REMAINING QTY</th>
                  <th>PROGRESS %</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {treeData.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                      {loading ? "Loading WBS hierarchy..." : "No WBS records found. Click 'Add WBS Item' to create a Phase."}
                    </td>
                  </tr>
                ) : (
                  treeData.map((phase) => {
                    const isPhaseCollapsed = collapsed[phase.id];
                    const phaseStatusInfo = getDerivedStatusInfo(phase);
                    const phaseQty = getQtyMetrics(phase);

                    return (
                      <React.Fragment key={`phase-${phase.id}`}>
                        <tr style={{ background: 'rgba(99,102,241,0.06)', borderLeft: '4px solid var(--primary)' }}>
                          <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{phase.wbs_code || '1.0'}</td>
                          <td><span className="tag-badge tag-info">Phase</span></td>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }} onClick={() => toggleCollapse(phase.id)}>
                              <button type="button" className="btn" style={{ padding: '2px', background: 'transparent', color: 'var(--primary)' }}>
                                {isPhaseCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                              </button>
                              <span>{phase.title}</span>
                            </div>
                          </td>
                          <td>{formatDate(phase.start_date)}</td>
                          <td>{formatDate(phase.end_date)}</td>
                          <td>{phaseQty.plannedStr}</td>
                          <td>{phaseQty.executedStr}</td>
                          <td>{phaseQty.remainingStr}</td>
                          <td><strong style={{ color: 'var(--accent-emerald)' }}>{Number(phase.progress_pct || 0)}%</strong></td>
                          <td>
                            <span className={`tag-badge ${phaseStatusInfo.tagClass}`}>
                              {phaseStatusInfo.label}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenEditModal(phase, '', '')}>
                                <Edit3 size={12} /> Edit
                              </button>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleAddTaskFromPhase(phase.id)}>
                                <Plus size={12} /> Task
                              </button>
                              <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(phase.id, phase.title, phase.tasks.length > 0)}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {!isPhaseCollapsed && phase.tasks.map((task) => {
                          const isTaskCollapsed = collapsed[task.id];
                          const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                          const taskStatusInfo = getDerivedStatusInfo(task);
                          const taskQty = getQtyMetrics(task);

                          return (
                            <React.Fragment key={`task-${task.id}`}>
                              <tr style={{ background: 'rgba(245,158,11,0.03)', borderLeft: '4px solid var(--accent-amber)' }}>
                                <td style={{ fontWeight: 600, color: 'var(--accent-cyan)', paddingLeft: '0.8rem' }}>{task.wbs_code || '1.1'}</td>
                                <td><span className="tag-badge tag-warning">{task.task_level || task.node_type || 'Task'}</span></td>
                                <td style={{ paddingLeft: '1.75rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    {hasSubtasks ? (
                                      <button type="button" className="btn" style={{ padding: '2px', background: 'transparent', color: 'var(--accent-amber)' }} onClick={() => toggleCollapse(task.id)}>
                                        {isTaskCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                                      </button>
                                    ) : <span style={{ width: '16px', color: 'var(--text-muted)' }}>├─</span>}
                                    <span style={{ fontWeight: 600 }}>{task.title}</span>
                                  </div>
                                </td>
                                <td>{formatDate(task.start_date)}</td>
                                <td>{formatDate(task.end_date)}</td>
                                <td>{taskQty.plannedStr}</td>
                                <td>{taskQty.executedStr}</td>
                                <td>{taskQty.remainingStr}</td>
                                <td>{Number(task.progress_pct || 0)}%</td>
                                <td>
                                  <span className={`tag-badge ${taskStatusInfo.tagClass}`}>
                                    {taskStatusInfo.label}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenEditModal(task, phase.title, '')}>
                                      <Edit3 size={12} /> Edit
                                    </button>
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleAddSubtaskFromTask(phase.id, task.id)}>
                                      <Plus size={12} /> Subtask
                                    </button>
                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(task.id, task.title, hasSubtasks)}>
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {!isTaskCollapsed && task.subtasks.map((subtask) => {
                                const subStatusInfo = getDerivedStatusInfo(subtask);
                                const subQty = getQtyMetrics(subtask);
                                return (
                                  <tr key={`subtask-${subtask.id}`} style={{ background: 'rgba(16,185,129,0.02)', borderLeft: '4px solid var(--accent-emerald)' }}>
                                    <td style={{ color: 'var(--accent-cyan)', paddingLeft: '1.2rem' }}>{subtask.wbs_code || '1.1.1'}</td>
                                    <td><span className="tag-badge tag-success">{subtask.task_level || subtask.node_type || 'Subtask'}</span></td>
                                    <td style={{ paddingLeft: '2.75rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <CornerDownRight size={14} color="var(--accent-emerald)" />
                                        <span>{subtask.title}</span>
                                      </div>
                                    </td>
                                    <td>{formatDate(subtask.start_date)}</td>
                                    <td>{formatDate(subtask.end_date)}</td>
                                    <td>{subQty.plannedStr}</td>
                                    <td>{subQty.executedStr}</td>
                                    <td>{subQty.remainingStr}</td>
                                    <td>{Number(subtask.progress_pct || 0)}%</td>
                                     <td>
                                       <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                         <span className={`tag-badge ${subStatusInfo.tagClass}`}>
                                           {subStatusInfo.label}
                                         </span>
                                         {subtask.has_date_inconsistency && (
                                           <span 
                                             title={subtask.inconsistency_warning || "Executed quantity recorded prior to planned start date. Effective progress remains 0% until start date."}
                                             style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', color: '#f59e0b' }}
                                           >
                                             <AlertTriangle size={14} color="#f59e0b" />
                                           </span>
                                         )}
                                       </div>
                                     </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenEditModal(subtask, phase.title, task.title)}>
                                          <Edit3 size={12} /> Edit
                                        </button>
                                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(subtask.id, subtask.title, false)}>
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. VIEW 2: INTERACTIVE GANTT TIMELINE SCHEDULE CHART */}
      {activeView === 'gantt' && (
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <div className="card-title">
              <BarChart3 size={18} color="var(--accent-cyan)" /> Interactive Gantt Schedule Timeline
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Data Center Project Baseline Schedule (Oct 2026 - Jun 2028)
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '1200px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '320px repeat(21, 1fr)', background: 'rgba(8,14,30,0.95)', borderBottom: '1px solid var(--border-color)', padding: '0.65rem 0', fontWeight: 700, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div style={{ paddingLeft: '1rem' }}>WBS Activity</div>
                {timelineMonths.map((m, idx) => (
                  <div key={idx} style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)', fontSize: '0.65rem' }}>{m}</div>
                ))}
              </div>

              {treeData.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                  No active tasks to display in Gantt chart.
                </div>
              ) : (
                treeData.map((phase) => (
                  <React.Fragment key={`gantt-phase-${phase.id}`}>
                    <div style={{ display: 'grid', gridTemplateColumns: '320px repeat(21, 1fr)', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)', background: 'rgba(99,102,241,0.04)', alignItems: 'center' }}>
                      <div style={{ paddingLeft: '1rem', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="tag-badge tag-info" style={{ fontSize: '0.65rem' }}>{phase.wbs_code || '1.0'}</span>
                        <span>{phase.title}</span>
                      </div>
                      <div style={{ gridColumn: '2 / span 21', padding: '0 0.5rem', position: 'relative' }}>
                        <div style={{ position: 'relative', height: '22px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--primary-border)' }}>
                          <div
                            style={{
                              width: `${Math.max(5, phase.progress_pct)}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, var(--primary), var(--accent-cyan))',
                              borderRadius: '3px',
                              display: 'flex',
                              alignItems: 'center',
                              paddingLeft: '0.5rem',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: '#ffffff'
                            }}
                          >
                            {phase.progress_pct}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {phase.tasks.map((task) => (
                      <div key={`gantt-task-${task.id}`} style={{ display: 'grid', gridTemplateColumns: '320px repeat(21, 1fr)', padding: '0.6rem 0', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                        <div style={{ paddingLeft: '2rem', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>[{task.wbs_code}]</span>
                          <span>{task.title}</span>
                        </div>
                        <div style={{ gridColumn: '2 / span 21', padding: '0 0.5rem', position: 'relative' }}>
                          <div style={{ position: 'relative', height: '18px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                            <div
                              style={{
                                width: `${Math.max(4, task.progress_pct)}%`,
                                height: '100%',
                                background: task.status === 'completed' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                                borderRadius: '3px',
                                display: 'flex',
                                alignItems: 'center',
                                paddingLeft: '0.4rem',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: '#ffffff'
                              }}
                            >
                              {task.progress_pct}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </React.Fragment>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '620px', background: '#0f172a', border: '1px solid var(--border-color-hover)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} color="var(--primary)" /> Add New WBS Node
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)}>
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '0.65rem 0.85rem', background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger-border)', borderRadius: '6px', color: 'var(--status-danger-text)', fontSize: '0.84rem', marginBottom: '1rem', fontWeight: 600 }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Node Type *</label>
                  <select className="form-select" value={formData.item_type} onChange={e => setFormData({ ...formData, item_type: e.target.value })}>
                    <option value="Phase">Phase</option>
                    <option value="Activity">Activity</option>
                    <option value="Task">Task</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Parent Node</label>
                  <select className="form-select" value={formData.parent_node_id} onChange={e => setFormData({ ...formData, parent_node_id: e.target.value })}>
                    <option value="">-- None (Top-Level Node) --</option>
                    {rawTasks.map(t => (
                      <option key={t.id} value={t.id}>[{t.task_level || 'Node'}] {t.wbs_code ? `${t.wbs_code} — ` : ''}{t.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>WBS Node Name *</label>
                <input required type="text" className="form-control" placeholder="e.g. Earthwork Excavation & Site Prep" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>

              <div className="form-group">
                <label>BOQ Reference (Optional on creation, required before Publish)</label>
                <select className="form-select" value={formData.boq_item_id} onChange={e => setFormData({ ...formData, boq_item_id: e.target.value })}>
                  <option value="">-- No BOQ Item Linked --</option>
                  {projectBoqItems.map(b => (
                    <option key={b.id} value={b.id}>{b.item_name} ({b.approved_qty} {b.unit})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Planned Start Date *</label>
                  <input required type="date" className="form-control" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Planned End Date *</label>
                  <input required type="date" className="form-control" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>WBS Code (Optional)</label>
                  <input type="text" className="form-control" placeholder="e.g. 1.1" value={formData.wbs_code} onChange={e => setFormData({ ...formData, wbs_code: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Contractor Name (Optional)</label>
                  <input type="text" className="form-control" placeholder="e.g. ABC Infrastructure" value={formData.contractor_name} onChange={e => setFormData({ ...formData, contractor_name: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Node</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / UPDATE MODAL */}
      {editModalItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '620px', background: '#0f172a', border: '1px solid var(--border-color-hover)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                <Edit3 size={20} color="var(--primary)" /> Edit WBS Node
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditModalItem(null)}>
                <X size={16} />
              </button>
            </div>

            {editFormError && (
              <div style={{ padding: '0.65rem 0.85rem', background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger-border)', borderRadius: '6px', color: 'var(--status-danger-text)', fontSize: '0.84rem', marginBottom: '1rem', fontWeight: 600 }}>
                ⚠️ {editFormError}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Node Type *</label>
                  <select className="form-select" value={editFormData.node_type} onChange={e => setEditFormData({ ...editFormData, node_type: e.target.value })}>
                    <option value="Phase">Phase</option>
                    <option value="Activity">Activity</option>
                    <option value="Task">Task</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Parent Node</label>
                  <select className="form-select" value={editFormData.parent_node_id} onChange={e => setEditFormData({ ...editFormData, parent_node_id: e.target.value })}>
                    <option value="">-- None (Top-Level Node) --</option>
                    {rawTasks.filter(t => t.id !== editModalItem.id).map(t => (
                      <option key={t.id} value={t.id}>[{t.task_level || 'Node'}] {t.wbs_code ? `${t.wbs_code} — ` : ''}{t.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>WBS Node Name *</label>
                <input required type="text" className="form-control" value={editFormData.title} onChange={e => setEditFormData({ ...editFormData, title: e.target.value })} />
              </div>

              <div className="form-group">
                <label>BOQ Reference</label>
                <select className="form-select" value={editFormData.boq_item_id} onChange={e => setEditFormData({ ...editFormData, boq_item_id: e.target.value })}>
                  <option value="">-- No BOQ Item Linked --</option>
                  {projectBoqItems.map(b => (
                    <option key={b.id} value={b.id}>{b.item_name} ({b.approved_qty} {b.unit})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Planned Start Date *</label>
                  <input required type="date" className="form-control" value={editFormData.start_date} onChange={e => setEditFormData({ ...editFormData, start_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Planned End Date *</label>
                  <input required type="date" className="form-control" value={editFormData.end_date} onChange={e => setEditFormData({ ...editFormData, end_date: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>WBS Code</label>
                  <input type="text" className="form-control" value={editFormData.wbs_code} onChange={e => setEditFormData({ ...editFormData, wbs_code: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Contractor Name</label>
                  <input type="text" className="form-control" value={editFormData.contractor_name} onChange={e => setEditFormData({ ...editFormData, contractor_name: e.target.value })} />
                </div>
              </div>

              <div style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Progress: <span style={{ color: 'var(--accent-emerald)' }}>{editModalItem.isCalculated ? Number(editModalItem.progress_pct || 0) : Number(editFormData.progress_pct || 0)}%</span>
                  </label>
                  <span className={`tag-badge ${getDerivedStatusInfo(editModalItem, editFormData.progress_pct).tagClass}`}>
                    Status: {getDerivedStatusInfo(editModalItem, editFormData.progress_pct).label}
                  </span>
                </div>

                {!editModalItem.isCalculated && (
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5" 
                    style={{ width: '100%', accentColor: 'var(--accent-emerald)', cursor: 'pointer' }} 
                    value={editFormData.progress_pct} 
                    onChange={e => setEditFormData({ ...editFormData, progress_pct: e.target.value })} 
                  />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalItem(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
