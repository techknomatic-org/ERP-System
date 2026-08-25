import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Layers, Plus, Calendar, Clock, CheckCircle2, AlertTriangle, Edit3, Trash2, ArrowLeft, ChevronDown, ChevronRight, CornerDownRight, FolderTree, X, BarChart3, ListFilter } from 'lucide-react';
import { projectService, wbsService } from '../services/api';

export default function WbsGantt() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlProjectId = searchParams.get('projectId');

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId || '');
  const [rawTasks, setRawTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // View Switcher State: 'table' vs 'gantt'
  const [activeView, setActiveView] = useState('table');

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

  // Build True Hierarchical WBS Tree
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

        const isStartedByDate = task.start_date && new Date(task.start_date) <= new Date();
        let taskStatus = task.status || (taskProgress >= 100 ? 'completed' : (taskProgress > 0 || isStartedByDate ? 'in_progress' : 'not_started'));

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

      const isPhaseStartedByDate = phase.start_date && new Date(phase.start_date) <= new Date();
      let phaseStatus = phase.status || (phaseProgress >= 100 ? 'completed' : (phaseProgress > 0 || isPhaseStartedByDate ? 'in_progress' : 'not_started'));

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

    return phaseMap;
  };

  const treeData = buildTree();

  // Summary Totals
  const totalPlannedBudget = treeData.reduce((acc, p) => acc + Number(p.planned_budget || 0), 0);
  const totalRequiredTillNow = treeData.reduce((acc, p) => acc + Number(p.required_till_now || 0), 0);
  const totalRemainingBudget = totalPlannedBudget - totalRequiredTillNow;
  const overallUtilizationPct = totalPlannedBudget > 0 ? Math.round((totalRequiredTillNow / totalPlannedBudget) * 100) : 0;

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

  const handleOpenEditModal = (item, parentPhaseName = '', parentTaskName = '') => {
    setEditModalItem({ ...item, parent_phase_name: parentPhaseName, parent_task_name: parentTaskName });
    setEditFormData({
      title: item.title || '',
      contractor_name: item.contractor_name || '',
      start_date: item.start_date ? new Date(item.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      end_date: item.end_date ? new Date(item.end_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      planned_budget: item.planned_budget || 0,
      progress_pct: item.progress_pct || 0
    });
    setEditFormError('');
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setFormError("Please select a project first.");
      return;
    }
    if (!formData.title) {
      setFormError("Title is required.");
      return;
    }

    wbsService.createTask({
      project_id: parseInt(selectedProjectId),
      task_level: formData.item_type,
      parent_task_id: formData.item_type === 'Subtask' ? parseInt(formData.parent_task_id) : (formData.item_type === 'Task' ? parseInt(formData.parent_phase_id) : null),
      title: formData.title,
      contractor_name: formData.contractor_name || 'In-House',
      planned_budget: parseFloat(formData.planned_budget || 0),
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString()
    })
      .then(() => {
        setShowCreateModal(false);
        setFormData({ item_type: 'Phase', parent_phase_id: '', parent_task_id: '', title: '', contractor_name: '', start_date: new Date().toISOString().split('T')[0], end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0], planned_budget: '' });
        loadWbs(selectedProjectId);
      })
      .catch((err) => setFormError(err.response?.data?.detail || "Failed to create WBS item"));
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editModalItem) return;

    wbsService.updateTask(editModalItem.id, {
      title: editFormData.title,
      contractor_name: editFormData.contractor_name,
      planned_budget: parseFloat(editFormData.planned_budget),
      start_date: new Date(editFormData.start_date).toISOString(),
      end_date: new Date(editFormData.end_date).toISOString(),
      progress_pct: editModalItem.isCalculated ? editModalItem.progress_pct : parseFloat(editFormData.progress_pct)
    })
      .then(() => {
        setEditModalItem(null);
        loadWbs(selectedProjectId);
      })
      .catch((err) => setEditFormError(err.response?.data?.detail || "Failed to update WBS item"));
  };

  const handleDeleteTask = (id, title, hasChildren) => {
    if (hasChildren) {
      alert(`Cannot delete '${title}' because it contains child tasks/subtasks. Please remove child items first.`);
      return;
    }
    if (window.confirm(`Are you sure you want to delete '${title}'?`)) {
      wbsService.deleteTask(id)
        .then(() => loadWbs(selectedProjectId))
        .catch(() => alert("Failed to delete task."));
    }
  };

  const currentProject = projects.find(p => p.id === parseInt(selectedProjectId));

  // Dynamic Status Resolver taking into account DB status, start date, and progress %
  const getDerivedStatusInfo = (item, overrideProg) => {
    if (!item) return { label: 'NOT STARTED', tagClass: 'tag-warning' };
    const prog = overrideProg !== undefined ? Number(overrideProg || 0) : Number(item.progress_pct || 0);
    const dbStatus = (item.status || '').toLowerCase();

    if (dbStatus === 'completed' || prog >= 100) return { label: 'COMPLETED', tagClass: 'tag-success' };
    if (dbStatus === 'in_progress' || prog > 0) return { label: 'IN PROGRESS', tagClass: 'tag-info' };

    if (item.start_date || editFormData.start_date) {
      const sDateStr = editFormData.start_date || item.start_date;
      const start = new Date(sDateStr);
      const today = new Date();
      if (!isNaN(start.getTime()) && start <= today) {
        return { label: 'IN PROGRESS', tagClass: 'tag-info' };
      }
    }

    return { label: 'NOT STARTED', tagClass: 'tag-warning' };
  };

  const timelineMonths = ['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026', 'Dec 2026'];

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
            <Layers color="var(--primary)" size={28} /> WBS Hierarchy & Gantt Timeline Workspace
          </h1>
          <p className="page-subtitle">
            Hierarchical Phase ➔ Task ➔ Subtask budget tracking & visual Gantt schedule execution timeline
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            className="form-select" 
            style={{ width: '220px' }}
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
              <FolderTree size={14} /> WBS Hierarchy Table
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

          <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> Add WBS Item
          </button>
        </div>
      </div>

      {/* SUMMARY METRICS BAR */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div>
            <div className="kpi-title">Planned Budget</div>
            <div className="kpi-value" style={{ color: 'var(--accent-cyan)' }}>₹{totalPlannedBudget.toLocaleString()}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Required Till Now</div>
            <div className="kpi-value" style={{ color: 'var(--accent-amber)' }}>₹{totalRequiredTillNow.toLocaleString()}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Remaining Budget</div>
            <div className="kpi-value" style={{ color: totalRemainingBudget < 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
              {totalRemainingBudget < 0 ? `-₹${Math.abs(totalRemainingBudget).toLocaleString()}` : `₹${totalRemainingBudget.toLocaleString()}`}
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div>
            <div className="kpi-title">Budget Utilization</div>
            <div className="kpi-value" style={{ color: overallUtilizationPct > 100 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
              {overallUtilizationPct}%
            </div>
          </div>
        </div>
      </div>

      {/* 1. VIEW 1: WBS TASK HIERARCHY TABLE */}
      {activeView === 'table' && (
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <div className="card-title"><FolderTree size={18} color="var(--primary)" /> Work Breakdown Structure & Budget Rollup Table</div>
          </div>
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
                    <td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                      {loading ? "Loading WBS hierarchy..." : "No WBS records found. Click 'Add WBS Item' to create a Phase."}
                    </td>
                  </tr>
                ) : (
                  treeData.map((phase) => {
                    const isPhaseCollapsed = collapsed[phase.id];
                    const isOverBudget = phase.remaining_budget < 0;
                    const phaseStatusInfo = getDerivedStatusInfo(phase);

                    return (
                      <React.Fragment key={`phase-${phase.id}`}>
                        <tr style={{ background: 'rgba(99,102,241,0.06)', borderLeft: '4px solid var(--primary)' }}>
                          <td><span className="tag-badge tag-info">Phase</span></td>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }} onClick={() => toggleCollapse(phase.id)}>
                              <button type="button" className="btn" style={{ padding: '2px', background: 'transparent', color: 'var(--primary)' }}>
                                {isPhaseCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                              </button>
                              <span>{phase.title}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>{phase.contractor_name || 'In-House'}</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>₹{Number(phase.planned_budget).toLocaleString()}</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent-amber)' }}>₹{Number(phase.required_till_now).toLocaleString()}</td>
                          <td>
                            {isOverBudget ? (
                              <span className="tag-badge tag-danger">OVER BUDGET: ₹{Math.abs(phase.remaining_budget).toLocaleString()}</span>
                            ) : (
                              <span style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>₹{Number(phase.remaining_budget).toLocaleString()}</span>
                            )}
                          </td>
                          <td>{Number(phase.budget_utilization_pct || 0)}%</td>
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

                          return (
                            <React.Fragment key={`task-${task.id}`}>
                              <tr style={{ background: 'rgba(245,158,11,0.03)', borderLeft: '4px solid var(--accent-amber)' }}>
                                <td><span className="tag-badge tag-warning" style={{ marginLeft: '0.75rem' }}>Task</span></td>
                                <td style={{ paddingLeft: '1.75rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    {hasSubtasks ? (
                                      <button type="button" className="btn" style={{ padding: '2px', background: 'transparent', color: 'var(--accent-amber)' }} onClick={() => toggleCollapse(task.id)}>
                                        {isTaskCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                                      </button>
                                    ) : <span style={{ width: '16px', color: 'var(--text-muted)' }}>├──</span>}
                                    <span>{task.title}</span>
                                  </div>
                                </td>
                                <td>{task.contractor_name || 'In-House'}</td>
                                <td style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>₹{Number(task.planned_budget).toLocaleString()}</td>
                                <td style={{ fontWeight: 600, color: 'var(--accent-amber)' }}>₹{Number(task.required_till_now).toLocaleString()}</td>
                                <td>₹{Number(task.remaining_budget).toLocaleString()}</td>
                                <td>{Number(task.budget_utilization_pct || 0)}%</td>
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
                                return (
                                  <tr key={`subtask-${subtask.id}`} style={{ background: 'rgba(16,185,129,0.02)', borderLeft: '4px solid var(--accent-emerald)' }}>
                                    <td><span className="tag-badge tag-success" style={{ marginLeft: '1.5rem' }}>Subtask</span></td>
                                    <td style={{ paddingLeft: '2.5rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <CornerDownRight size={14} color="var(--accent-emerald)" />
                                        <span>{subtask.title}</span>
                                      </div>
                                    </td>
                                    <td>{subtask.contractor_name || 'In-House'}</td>
                                    <td style={{ color: 'var(--accent-cyan)' }}>₹{Number(subtask.planned_budget || 0).toLocaleString()}</td>
                                    <td style={{ color: 'var(--accent-amber)' }}>₹{Number(subtask.required_till_now || 0).toLocaleString()}</td>
                                    <td>₹{Number(subtask.remaining_budget || 0).toLocaleString()}</td>
                                    <td>{Number(subtask.budget_utilization_pct || 0)}%</td>
                                    <td>{Number(subtask.progress_pct || 0)}%</td>
                                    <td>
                                      <span className={`tag-badge ${subStatusInfo.tagClass}`}>
                                        {subStatusInfo.label}
                                      </span>
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
              Project Schedule Baseline vs Physical Progress Overlay
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '940px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '260px repeat(12, 1fr)', background: 'rgba(8,14,30,0.95)', borderBottom: '1px solid var(--border-color)', padding: '0.65rem 0', fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div style={{ paddingLeft: '1rem' }}>WBS Activity</div>
                {timelineMonths.map((m, idx) => (
                  <div key={idx} style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>{m}</div>
                ))}
              </div>

              {treeData.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                  No active tasks to display in Gantt chart.
                </div>
              ) : (
                treeData.map((phase) => (
                  <React.Fragment key={`gantt-phase-${phase.id}`}>
                    <div style={{ display: 'grid', gridTemplateColumns: '260px repeat(12, 1fr)', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)', background: 'rgba(99,102,241,0.04)', alignItems: 'center' }}>
                      <div style={{ paddingLeft: '1rem', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="tag-badge tag-info" style={{ fontSize: '0.65rem' }}>Phase</span>
                        <span>{phase.title}</span>
                      </div>
                      <div style={{ gridColumn: '2 / span 12', padding: '0 0.5rem', position: 'relative' }}>
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
                      <div key={`gantt-task-${task.id}`} style={{ display: 'grid', gridTemplateColumns: '260px repeat(12, 1fr)', padding: '0.6rem 0', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                        <div style={{ paddingLeft: '2rem', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>├──</span>
                          <span>{task.title}</span>
                        </div>
                        <div style={{ gridColumn: '2 / span 12', padding: '0 0.5rem', position: 'relative' }}>
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
          <div className="glass-card" style={{ width: '540px', background: '#0f172a', border: '1px solid var(--border-color-hover)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} color="var(--primary)" /> Add New WBS Item
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)}>
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '0.6rem 0.8rem', background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger-border)', borderRadius: '6px', color: 'var(--status-danger-text)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label>WBS Item Level</label>
                <select className="form-select" value={formData.item_type} onChange={e => setFormData({ ...formData, item_type: e.target.value })}>
                  <option value="Phase">Phase (Top-Level Category)</option>
                  <option value="Task">Task (Under a Phase)</option>
                  <option value="Subtask">Subtask (Under a Task)</option>
                </select>
              </div>

              {formData.item_type === 'Task' && (
                <div className="form-group">
                  <label>Parent Phase</label>
                  <select required className="form-select" value={formData.parent_phase_id} onChange={e => setFormData({ ...formData, parent_phase_id: e.target.value })}>
                    <option value="">-- Select Parent Phase --</option>
                    {availablePhases.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.item_type === 'Subtask' && (
                <>
                  <div className="form-group">
                    <label>Parent Phase</label>
                    <select required className="form-select" value={formData.parent_phase_id} onChange={e => setFormData({ ...formData, parent_phase_id: e.target.value, parent_task_id: '' })}>
                      <option value="">-- Select Parent Phase --</option>
                      {availablePhases.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Parent Task</label>
                    <select required className="form-select" value={formData.parent_task_id} onChange={e => setFormData({ ...formData, parent_task_id: e.target.value })}>
                      <option value="">-- Select Parent Task --</option>
                      {availableTasks.map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Title / Name</label>
                <input required type="text" className="form-control" placeholder="e.g. Substructure Execution Phase" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Assigned Contractor</label>
                  <input type="text" className="form-control" placeholder="e.g. Civil Works Corp" value={formData.contractor_name} onChange={e => setFormData({ ...formData, contractor_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Planned Budget (₹)</label>
                  <input required type="number" step="1" className="form-control" placeholder="500000" value={formData.planned_budget} onChange={e => setFormData({ ...formData, planned_budget: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Start Date</label>
                  <input required type="date" className="form-control" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Target End Date</label>
                  <input required type="date" className="form-control" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
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
          <div className="glass-card" style={{ width: '560px', background: '#0f172a', border: '1px solid var(--border-color-hover)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                <Edit3 size={20} color="var(--primary)" /> Edit {editModalItem.task_level || 'WBS Item'}
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditModalItem(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label>Item Name</label>
                <input required type="text" className="form-control" value={editFormData.title} onChange={e => setEditFormData({ ...editFormData, title: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Assigned Contractor</label>
                  <input type="text" className="form-control" value={editFormData.contractor_name} onChange={e => setEditFormData({ ...editFormData, contractor_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Planned Budget (₹)</label>
                  <input required type="number" step="1" className="form-control" value={editFormData.planned_budget} onChange={e => setEditFormData({ ...editFormData, planned_budget: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Start Date</label>
                  <input required type="date" className="form-control" value={editFormData.start_date} onChange={e => setEditFormData({ ...editFormData, start_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input required type="date" className="form-control" value={editFormData.end_date} onChange={e => setEditFormData({ ...editFormData, end_date: e.target.value })} />
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
