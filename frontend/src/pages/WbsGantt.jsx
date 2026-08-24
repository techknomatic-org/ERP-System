import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Layers, Plus, Calendar, Clock, CheckCircle2, AlertTriangle, Edit3, Trash2, ArrowLeft, ChevronDown, ChevronRight, CornerDownRight, FolderTree, X } from 'lucide-react';
import { projectService, wbsService } from '../services/api';

export default function WbsGantt() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlProjectId = searchParams.get('projectId');

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId || '');
  const [rawTasks, setRawTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Collapse state for Phase and Task IDs
  const [collapsed, setCollapsed] = useState({});

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Edit / Update Modal State
  const [editModalItem, setEditModalItem] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    contractor_name: '',
    start_date: '',
    end_date: '',
    planned_budget: '',
    progress_pct: 0
  });
  const [editFormError, setEditFormError] = useState('');

  // Form State for Creation
  const [formData, setFormData] = useState({
    item_type: 'Phase', // 'Phase' | 'Task' | 'Subtask'
    parent_phase_id: '',
    parent_task_id: '',
    title: '',
    contractor_name: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
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
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadWbs(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Toggle Collapse
  const toggleCollapse = (id) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Build True Hierarchical WBS Tree with Bottom-Up Progress & BOQ Budget Rollup Calculation
  const buildTree = () => {
    const phases = rawTasks.filter(t => {
      const lvl = (t.task_level || '').toLowerCase();
      return lvl === 'phase' || (!t.parent_task_id && lvl !== 'subtask');
    });

    const phaseMap = phases.map(phase => {
      const tasks = rawTasks.filter(t => {
        const lvl = (t.task_level || '').toLowerCase();
        return lvl === 'task' && (t.parent_task_id === phase.id || (!t.parent_task_id && !phases.some(p => p.id === t.id)));
      });

      const taskNodes = tasks.map(task => {
        const subtasks = rawTasks.filter(t => {
          const lvl = (t.task_level || '').toLowerCase();
          return lvl === 'subtask' && t.parent_task_id === task.id;
        });

        let taskProgress = Number(task.progress_pct || 0);
        if (subtasks.length > 0) {
          const sumSub = subtasks.reduce((acc, s) => acc + Number(s.progress_pct || 0), 0);
          taskProgress = Math.round((sumSub / subtasks.length) * 100) / 100;
        }

        let taskStatus = taskProgress >= 100 ? 'completed' : (taskProgress > 0 ? 'in_progress' : 'not_started');

        return { 
          ...task, 
          subtasks, 
          progress_pct: taskProgress, 
          status: taskStatus, 
          isCalculated: subtasks.length > 0,
          required_till_now: Number(task.required_till_now || 0),
          remaining_budget: Number(task.remaining_budget || 0),
          budget_utilization_pct: Number(task.budget_utilization_pct || 0),
          linked_boqs: task.linked_boqs || []
        };
      });

      let phaseProgress = Number(phase.progress_pct || 0);
      if (taskNodes.length > 0) {
        const sumTask = taskNodes.reduce((acc, t) => acc + Number(t.progress_pct || 0), 0);
        phaseProgress = Math.round((sumTask / taskNodes.length) * 100) / 100;
      }

      let phaseStatus = phaseProgress >= 100 ? 'completed' : (phaseProgress > 0 ? 'in_progress' : 'not_started');

      return { 
        ...phase, 
        tasks: taskNodes, 
        progress_pct: phaseProgress, 
        status: phaseStatus, 
        isCalculated: taskNodes.length > 0,
        required_till_now: Number(phase.required_till_now || 0),
        remaining_budget: Number(phase.remaining_budget || 0),
        budget_utilization_pct: Number(phase.budget_utilization_pct || 0),
        linked_boqs: phase.linked_boqs || []
      };
    });

    const handledIds = new Set();
    phaseMap.forEach(p => {
      handledIds.add(p.id);
      p.tasks.forEach(t => {
        handledIds.add(t.id);
        t.subtasks.forEach(s => handledIds.add(s.id));
      });
    });

    const unhandled = rawTasks.filter(t => !handledIds.has(t.id));
    if (unhandled.length > 0) {
      phaseMap.push({
        id: -999,
        title: 'General / Uncategorized Phase',
        task_level: 'Phase',
        contractor_name: 'In-House',
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        planned_budget: 0,
        required_till_now: 0,
        remaining_budget: 0,
        budget_utilization_pct: 0,
        progress_pct: 0,
        status: 'in_progress',
        isCalculated: false,
        tasks: unhandled.map(u => ({ ...u, subtasks: [], isCalculated: false, linked_boqs: u.linked_boqs || [] })),
        linked_boqs: []
      });
    }

    return phaseMap;
  };

  const treeData = buildTree();

  // Summary Totals
  const totalPlannedBudget = treeData.reduce((acc, p) => acc + Number(p.planned_budget || 0), 0);
  const totalRequiredTillNow = treeData.reduce((acc, p) => acc + Number(p.required_till_now || 0), 0);
  const totalRemainingBudget = totalPlannedBudget - totalRequiredTillNow;
  const overallUtilizationPct = totalPlannedBudget > 0 ? Math.round((totalRequiredTillNow / totalPlannedBudget) * 100) : 0;

  // Helper arrays for dropdowns
  const availablePhases = rawTasks.filter(t => (t.task_level || '').toLowerCase() === 'phase' || !t.parent_task_id);
  const availableTasks = rawTasks.filter(t => {
    const lvl = (t.task_level || '').toLowerCase();
    if (lvl !== 'task') return false;
    if (formData.parent_phase_id) {
      return t.parent_task_id === parseInt(formData.parent_phase_id);
    }
    return true;
  });

  // Shortcut to add Task from Phase
  const handleAddTaskFromPhase = (phaseId) => {
    setFormData({
      item_type: 'Task',
      parent_phase_id: phaseId.toString(),
      parent_task_id: '',
      title: '',
      contractor_name: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      planned_budget: ''
    });
    setFormError('');
    setShowCreateModal(true);
  };

  // Shortcut to add Subtask from Task
  const handleAddSubtaskFromTask = (phaseId, taskId) => {
    setFormData({
      item_type: 'Subtask',
      parent_phase_id: phaseId.toString(),
      parent_task_id: taskId.toString(),
      title: '',
      contractor_name: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      planned_budget: ''
    });
    setFormError('');
    setShowCreateModal(true);
  };

  // Open Edit / Update Modal for Phase, Task, or Subtask
  const handleOpenEditModal = (item, parentPhaseName = '', parentTaskName = '') => {
    const sDate = item.start_date ? new Date(item.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const eDate = item.end_date ? new Date(item.end_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    setEditModalItem({
      ...item,
      parent_phase_name: parentPhaseName,
      parent_task_name: parentTaskName
    });

    setEditFormData({
      title: item.title || '',
      contractor_name: item.contractor_name || 'In-House',
      start_date: sDate,
      end_date: eDate,
      planned_budget: item.planned_budget !== undefined ? item.planned_budget.toString() : '0',
      progress_pct: item.progress_pct || 0
    });

    setEditFormError('');
  };

  // Save Changes Submit Handler
  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editModalItem) return;
    setEditFormError('');

    // Date range validation check
    if (new Date(editFormData.start_date) > new Date(editFormData.end_date)) {
      setEditFormError("Start Date cannot be after End Date.");
      return;
    }

    const payload = {
      title: editFormData.title.trim(),
      contractor_name: editFormData.contractor_name.trim() || 'In-House',
      start_date: new Date(editFormData.start_date).toISOString(),
      end_date: new Date(editFormData.end_date).toISOString(),
      planned_budget: parseFloat(editFormData.planned_budget || 0)
    };

    // If item has no children, include progress_pct in update payload
    if (!editModalItem.isCalculated) {
      payload.progress_pct = parseFloat(editFormData.progress_pct || 0);
    }

    wbsService.updateTask(editModalItem.id, payload)
      .then(() => {
        setEditModalItem(null);
        loadWbs(selectedProjectId);
      })
      .catch((err) => {
        setEditFormError(err.response?.data?.detail || "Unable to update record. Please try again.");
      });
  };

  // Handle Form Submit for Creation
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (formData.item_type === 'Task' && !formData.parent_phase_id) {
      setFormError("Parent Phase is required for a Task.");
      return;
    }

    if (formData.item_type === 'Subtask') {
      if (!formData.parent_phase_id) {
        setFormError("Parent Phase is required for a Subtask.");
        return;
      }
      if (!formData.parent_task_id) {
        setFormError("Parent Task is required for a Subtask.");
        return;
      }
    }

    let parentIdToSend = null;
    if (formData.item_type === 'Task') {
      parentIdToSend = parseInt(formData.parent_phase_id);
    } else if (formData.item_type === 'Subtask') {
      parentIdToSend = parseInt(formData.parent_task_id);
    }

    wbsService.createTask({
      project_id: parseInt(selectedProjectId),
      parent_task_id: parentIdToSend,
      title: formData.title,
      task_level: formData.item_type,
      contractor_name: formData.contractor_name,
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString(),
      planned_budget: parseFloat(formData.planned_budget || 0)
    })
      .then(() => {
        setShowCreateModal(false);
        setFormData({
          item_type: 'Phase',
          parent_phase_id: '',
          parent_task_id: '',
          title: '',
          contractor_name: '',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          planned_budget: ''
        });
        loadWbs(selectedProjectId);
      })
      .catch((err) => {
        setFormError(err.response?.data?.detail || "Failed to create WBS item");
      });
  };

  // Handle Delete Task
  const handleDeleteTask = (taskId, taskTitle, hasChildren) => {
    const confirmMsg = hasChildren 
      ? `Are you sure you want to delete '${taskTitle}' and all of its child tasks/subtasks?`
      : `Are you sure you want to delete WBS item '${taskTitle}'?`;
    
    if (window.confirm(confirmMsg)) {
      wbsService.deleteTask(taskId)
        .then(() => loadWbs(selectedProjectId))
        .catch((err) => alert(err.response?.data?.detail || "Failed to delete task"));
    }
  };

  const currentProject = projects.find(p => p.id === parseInt(selectedProjectId));

  // Compute status badge text dynamically from progress
  const getDerivedStatusInfo = (prog) => {
    const p = Number(prog || 0);
    if (p >= 100) return { label: 'COMPLETED', tagClass: 'tag-success' };
    if (p > 0) return { label: 'IN PROGRESS', tagClass: 'tag-info' };
    return { label: 'NOT STARTED', tagClass: 'tag-warning' };
  };

  return (
    <div className="content-page">
      {/* Header Controls */}
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
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Layers color="#38bdf8" size={28} /> WBS Hierarchy & Gantt Budget Rollup
          </h1>
          <p className="page-subtitle">
            Hierarchical Phase ➔ Task ➔ Subtask budget tracking with bottom-up BOQ requirement rollups & execution monitoring
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select 
            className="form-control" 
            style={{ width: '220px' }}
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
            ))}
          </select>

          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Add WBS Item
          </button>
        </div>
      </div>

      {/* SUMMARY METRICS BAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Planned Budget</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.25rem' }}>
            ₹{totalPlannedBudget.toLocaleString()}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Required Till Now</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.25rem' }}>
            ₹{totalRequiredTillNow.toLocaleString()}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Remaining Budget</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: totalRemainingBudget < 0 ? '#f43f5e' : '#10b981', marginTop: '0.25rem' }}>
            {totalRemainingBudget < 0 ? `-₹${Math.abs(totalRemainingBudget).toLocaleString()}` : `₹${totalRemainingBudget.toLocaleString()}`}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Budget Utilization</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: overallUtilizationPct > 100 ? '#f43f5e' : overallUtilizationPct >= 80 ? '#f59e0b' : '#10b981', marginTop: '0.25rem' }}>
            {overallUtilizationPct}%
          </div>
        </div>
      </div>

      {/* WBS Task Hierarchy Table */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FolderTree size={20} color="#38bdf8" /> Work Breakdown Structure & Budget Rollup Table
        </h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Level</th>
                <th>Phase / Task / Subtask Title</th>
                <th>Contractor</th>
                <th>Planned Budget</th>
                <th>Required Till Now</th>
                <th>Remaining Budget</th>
                <th>Utilization %</th>
                <th>Progress %</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {treeData.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', color: '#64748b', padding: '2.5rem' }}>
                    {loading ? "Loading WBS hierarchy..." : "No WBS records found for this project. Click 'Add WBS Item' to create a Phase."}
                  </td>
                </tr>
              ) : (
                treeData.map((phase) => {
                  const isPhaseCollapsed = collapsed[phase.id];
                  const isOverBudget = phase.remaining_budget < 0;

                  return (
                    <React.Fragment key={`phase-${phase.id}`}>
                      {/* PHASE ROW */}
                      <tr style={{ background: 'rgba(56,189,248,0.06)', borderLeft: '4px solid #38bdf8' }}>
                        <td>
                          <span className="tag-badge tag-info" style={{ fontWeight: 700 }}>
                            Phase
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.95rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }} onClick={() => toggleCollapse(phase.id)}>
                            <button className="btn" style={{ padding: '2px', background: 'transparent', color: '#38bdf8' }}>
                              {isPhaseCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                            </button>
                            <span>{phase.title}</span>
                          </div>
                        </td>
                        <td style={{ color: '#94a3b8' }}>{phase.contractor_name || 'In-House'}</td>
                        <td style={{ fontWeight: 700, color: '#38bdf8' }}>₹{Number(phase.planned_budget).toLocaleString()}</td>
                        <td style={{ fontWeight: 700, color: '#f59e0b' }}>₹{Number(phase.required_till_now).toLocaleString()}</td>
                        <td>
                          {isOverBudget ? (
                            <span className="tag-badge tag-danger" style={{ fontWeight: 700 }}>
                              OVER BUDGET: ₹{Math.abs(phase.remaining_budget).toLocaleString()}
                            </span>
                          ) : (
                            <span style={{ fontWeight: 700, color: '#10b981' }}>
                              ₹{Number(phase.remaining_budget).toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ 
                                width: `${Math.min(100, phase.budget_utilization_pct)}%`, 
                                height: '100%', 
                                background: phase.budget_utilization_pct > 100 ? '#f43f5e' : phase.budget_utilization_pct >= 80 ? '#f59e0b' : '#10b981' 
                              }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: phase.budget_utilization_pct > 100 ? '#f43f5e' : '#f8fafc' }}>
                              {phase.budget_utilization_pct}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#10b981' }}>{phase.progress_pct}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`tag-badge ${
                            phase.status === 'completed' ? 'tag-success' :
                            phase.status === 'in_progress' ? 'tag-info' : 'tag-warning'
                          }`}>
                            {(phase.status || 'not_started').replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                            {phase.id !== -999 && (
                              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: '#38bdf8', color: '#38bdf8' }} onClick={() => handleOpenEditModal(phase, '', '')}>
                                <Edit3 size={12} /> Edit / Update
                              </button>
                            )}
                            {phase.id !== -999 && (
                              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: '#f59e0b', color: '#f59e0b' }} onClick={() => handleAddTaskFromPhase(phase.id)}>
                                <Plus size={12} /> Add Task
                              </button>
                            )}
                            {phase.id !== -999 && (
                              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: '#f43f5e', color: '#f43f5e' }} onClick={() => handleDeleteTask(phase.id, phase.title, phase.tasks.length > 0)}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* TASKS UNDER PHASE (if Phase not collapsed) */}
                      {!isPhaseCollapsed && phase.tasks.map((task) => {
                        const isTaskCollapsed = collapsed[task.id];
                        const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                        const isTaskOverBudget = task.remaining_budget < 0;

                        return (
                          <React.Fragment key={`task-${task.id}`}>
                            {/* TASK ROW */}
                            <tr style={{ background: 'rgba(245,158,11,0.04)', borderLeft: '4px solid #f59e0b' }}>
                              <td>
                                <span className="tag-badge tag-warning" style={{ marginLeft: '0.8rem', fontSize: '0.75rem' }}>
                                  Task
                                </span>
                              </td>
                              <td style={{ fontWeight: 600, color: '#f8fafc', paddingLeft: '1.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  {hasSubtasks ? (
                                    <button className="btn" style={{ padding: '2px', background: 'transparent', color: '#f59e0b' }} onClick={() => toggleCollapse(task.id)}>
                                      {isTaskCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                  ) : (
                                    <span style={{ width: '16px', display: 'inline-block', textAlign: 'center', color: '#64748b' }}>├──</span>
                                  )}
                                  <span>{task.title}</span>
                                </div>
                              </td>
                              <td style={{ color: '#94a3b8' }}>{task.contractor_name || 'In-House'}</td>
                              <td style={{ fontWeight: 600, color: '#38bdf8' }}>₹{Number(task.planned_budget).toLocaleString()}</td>
                              <td style={{ fontWeight: 600, color: '#f59e0b' }}>₹{Number(task.required_till_now).toLocaleString()}</td>
                              <td>
                                {isTaskOverBudget ? (
                                  <span className="tag-badge tag-danger" style={{ fontWeight: 600, fontSize: '0.75rem' }}>
                                    OVER BUDGET: ₹{Math.abs(task.remaining_budget).toLocaleString()}
                                  </span>
                                ) : (
                                  <span style={{ fontWeight: 600, color: '#10b981' }}>
                                    ₹{Number(task.remaining_budget).toLocaleString()}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ 
                                      width: `${Math.min(100, task.budget_utilization_pct)}%`, 
                                      height: '100%', 
                                      background: task.budget_utilization_pct > 100 ? '#f43f5e' : task.budget_utilization_pct >= 80 ? '#f59e0b' : '#10b981' 
                                    }} />
                                  </div>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{task.budget_utilization_pct}%</span>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#10b981' }}>{task.progress_pct}%</span>
                              </td>
                              <td>
                                <span className={`tag-badge ${
                                  task.status === 'completed' ? 'tag-success' :
                                  task.status === 'in_progress' ? 'tag-info' : 'tag-warning'
                                }`}>
                                  {(task.status || 'not_started').replace('_', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                                  <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: '#f59e0b', color: '#f59e0b' }} onClick={() => handleOpenEditModal(task, phase.title, '')}>
                                    <Edit3 size={12} /> Edit / Update
                                  </button>
                                  <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: '#10b981', color: '#10b981' }} onClick={() => handleAddSubtaskFromTask(phase.id, task.id)}>
                                    <Plus size={12} /> Add Subtask
                                  </button>
                                  <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: '#f43f5e', color: '#f43f5e' }} onClick={() => handleDeleteTask(task.id, task.title, hasSubtasks)}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* SUBTASKS UNDER TASK (if Task not collapsed) */}
                            {!isTaskCollapsed && task.subtasks.map((subtask) => {
                              const isSubOverBudget = (subtask.remaining_budget || 0) < 0;

                              return (
                                <React.Fragment key={`subtask-${subtask.id}`}>
                                  <tr style={{ background: 'rgba(16,185,129,0.02)', borderLeft: '4px solid #10b981' }}>
                                    <td>
                                      <span className="tag-badge tag-success" style={{ marginLeft: '1.6rem', fontSize: '0.7rem' }}>
                                        Subtask
                                      </span>
                                    </td>
                                    <td style={{ color: '#cbd5e1', paddingLeft: '2.5rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <CornerDownRight size={14} color="#10b981" />
                                        <span>{subtask.title}</span>
                                      </div>
                                    </td>
                                    <td style={{ color: '#94a3b8' }}>{subtask.contractor_name || 'In-House'}</td>
                                    <td style={{ fontWeight: 600, color: '#38bdf8' }}>₹{Number(subtask.planned_budget || 0).toLocaleString()}</td>
                                    <td style={{ fontWeight: 600, color: '#f59e0b' }}>₹{Number(subtask.required_till_now || 0).toLocaleString()}</td>
                                    <td>
                                      {isSubOverBudget ? (
                                        <span className="tag-badge tag-danger" style={{ fontSize: '0.7rem' }}>
                                          OVER BUDGET: ₹{Math.abs(subtask.remaining_budget).toLocaleString()}
                                        </span>
                                      ) : (
                                        <span style={{ fontWeight: 600, color: '#10b981' }}>
                                          ₹{Number(subtask.remaining_budget || 0).toLocaleString()}
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{subtask.budget_utilization_pct || 0}%</span>
                                    </td>
                                    <td>
                                      <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#10b981' }}>{subtask.progress_pct}%</span>
                                    </td>
                                    <td>
                                      <span className={`tag-badge ${
                                        subtask.status === 'completed' ? 'tag-success' :
                                        subtask.status === 'in_progress' ? 'tag-info' : 'tag-warning'
                                      }`}>
                                        {(subtask.status || 'not_started').replace('_', ' ').toUpperCase()}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: '#10b981', color: '#10b981' }} onClick={() => handleOpenEditModal(subtask, phase.title, task.title)}>
                                          <Edit3 size={12} /> Edit / Update
                                        </button>
                                        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: '#f43f5e', color: '#f43f5e' }} onClick={() => handleDeleteTask(subtask.id, subtask.title, false)}>
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                </React.Fragment>
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

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '540px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} color="#38bdf8" /> Add New WBS Item
              </h3>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setShowCreateModal(false)}>
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '6px', color: '#fca5a5', fontSize: '0.82rem', marginBottom: '1rem' }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>WBS Item Level <span style={{ color: '#f43f5e' }}>*</span></label>
                <select 
                  className="form-control"
                  value={formData.item_type}
                  onChange={e => setFormData({ ...formData, item_type: e.target.value })}
                >
                  <option value="Phase">Phase (Top-Level Category)</option>
                  <option value="Task">Task (Under a Phase)</option>
                  <option value="Subtask">Subtask (Under a Task)</option>
                </select>
              </div>

              {formData.item_type === 'Task' && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>Parent Phase <span style={{ color: '#f43f5e' }}>*</span></label>
                  <select 
                    required
                    className="form-control"
                    value={formData.parent_phase_id}
                    onChange={e => setFormData({ ...formData, parent_phase_id: e.target.value })}
                  >
                    <option value="">-- Select Parent Phase --</option>
                    {availablePhases.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.item_type === 'Subtask' && (
                <>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Parent Phase <span style={{ color: '#f43f5e' }}>*</span></label>
                    <select 
                      required
                      className="form-control"
                      value={formData.parent_phase_id}
                      onChange={e => setFormData({ ...formData, parent_phase_id: e.target.value, parent_task_id: '' })}
                    >
                      <option value="">-- Select Parent Phase --</option>
                      {availablePhases.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Parent Task <span style={{ color: '#f43f5e' }}>*</span></label>
                    <select 
                      required
                      className="form-control"
                      value={formData.parent_task_id}
                      onChange={e => setFormData({ ...formData, parent_task_id: e.target.value })}
                    >
                      <option value="">-- Select Parent Task --</option>
                      {availableTasks.map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Title / Name <span style={{ color: '#f43f5e' }}>*</span></label>
                <input
                  required
                  type="text"
                  className="form-control"
                  placeholder="e.g. Columns, Beam Reinforcement"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label>Assigned Contractor</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Apex Steel Inc. or In-House"
                    value={formData.contractor_name}
                    onChange={e => setFormData({ ...formData, contractor_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Planned Budget (₹)</label>
                  <input
                    required
                    type="number"
                    step="1"
                    className="form-control"
                    placeholder="500000"
                    value={formData.planned_budget}
                    onChange={e => setFormData({ ...formData, planned_budget: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label>Start Date <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input
                    required
                    type="date"
                    className="form-control"
                    value={formData.start_date}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>End Date <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input
                    required
                    type="date"
                    className="form-control"
                    value={formData.end_date}
                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save {formData.item_type}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / UPDATE MODAL FOR PHASE, TASK, & SUBTASK */}
      {editModalItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '560px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                <Edit3 size={20} color="#38bdf8" /> Edit {editModalItem.task_level || 'WBS Item'}
              </h3>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setEditModalItem(null)}>
                <X size={16} />
              </button>
            </div>

            {/* READ-ONLY HIERARCHY BREADCRUMB */}
            {(editModalItem.parent_phase_name || editModalItem.parent_task_name) && (
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '1rem' }}>
                {editModalItem.parent_phase_name && (
                  <div>Parent Phase: <strong style={{ color: '#38bdf8' }}>{editModalItem.parent_phase_name}</strong> (Read-Only)</div>
                )}
                {editModalItem.parent_task_name && (
                  <div style={{ marginTop: '0.2rem' }}>Parent Task: <strong style={{ color: '#f59e0b' }}>{editModalItem.parent_task_name}</strong> (Read-Only)</div>
                )}
              </div>
            )}

            {editFormError && (
              <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '6px', color: '#fca5a5', fontSize: '0.82rem', marginBottom: '1rem' }}>
                ⚠️ {editFormError}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  {(editModalItem.task_level || 'Item')} Name <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <input
                  required
                  type="text"
                  className="form-control"
                  value={editFormData.title}
                  onChange={e => setEditFormData({ ...editFormData, title: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Assigned Contractor</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.contractor_name}
                    onChange={e => setEditFormData({ ...editFormData, contractor_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Planned Budget (₹) <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input
                    required
                    type="number"
                    step="1"
                    className="form-control"
                    value={editFormData.planned_budget}
                    onChange={e => setEditFormData({ ...editFormData, planned_budget: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Start Date <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input
                    required
                    type="date"
                    className="form-control"
                    value={editFormData.start_date}
                    onChange={e => setEditFormData({ ...editFormData, start_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>End Date <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input
                    required
                    type="date"
                    className="form-control"
                    value={editFormData.end_date}
                    onChange={e => setEditFormData({ ...editFormData, end_date: e.target.value })}
                  />
                </div>
              </div>

              {/* PROGRESS % & CALCULATED STATUS SECTION */}
              <div style={{ padding: '0.85rem', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                    Progress: <span style={{ color: '#10b981' }}>{editModalItem.isCalculated ? editModalItem.progress_pct : editFormData.progress_pct}%</span>
                  </label>
                  <span className={`tag-badge ${getDerivedStatusInfo(editModalItem.isCalculated ? editModalItem.progress_pct : editFormData.progress_pct).tagClass}`}>
                    Status: {getDerivedStatusInfo(editModalItem.isCalculated ? editModalItem.progress_pct : editFormData.progress_pct).label}
                  </span>
                </div>

                {editModalItem.isCalculated ? (
                  <div style={{ fontSize: '0.78rem', color: '#f59e0b', fontStyle: 'italic' }}>
                    • Calculated automatically from {(editModalItem.task_level || '').toLowerCase() === 'phase' ? 'Tasks' : 'Subtasks'}
                  </div>
                ) : (
                  <div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      step="5" 
                      style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }} 
                      value={editFormData.progress_pct} 
                      onChange={e => setEditFormData({ ...editFormData, progress_pct: e.target.value })} 
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                      <span>0% (Not Started)</span>
                      <span>50% (In Progress)</span>
                      <span>100% (Completed)</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalItem(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #38bdf8, #0284c7)' }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
