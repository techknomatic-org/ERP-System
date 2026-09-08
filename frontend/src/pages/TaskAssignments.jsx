import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserCheck, Plus, Search, Filter, Calendar, Layers, HardHat, AlertCircle, 
  CheckCircle, Clock, ArrowUpRight, Edit, Trash2, Eye, UserPlus, FileSpreadsheet, XCircle, ChevronRight
} from 'lucide-react';
import { taskAssignmentService, projectService, wbsService, userService, projectTeamService } from '../services/api';

const formatRole = (rawRole) => {
  if (!rawRole) return 'Team Member';
  const r = rawRole.trim().toLowerCase();
  const map = {
    admin: 'System Admin',
    project_manager: 'Project Manager',
    site_engineer: 'Site Engineer',
    management: 'Executive Management',
    finance: 'Finance Lead',
    procurement: 'Procurement Officer',
    hse: 'HSE Safety Manager',
    qc: 'Quality Control Officer',
    facility_manager: 'Facility Manager',
    customer: 'Customer Account'
  };
  return map[r] || rawRole;
};

export default function TaskAssignments() {
  // State variables
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [selectedUserFilter, setSelectedUserFilter] = useState('ALL');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('ALL');

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reassignTarget, setReassignTarget] = useState(null);
  const [reassignForm, setReassignForm] = useState({ new_user_id: '', role: '', remarks: '' });

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);

  // Cascading Form States for Assignment Creation
  const [wbsHierarchy, setWbsHierarchy] = useState([]);
  const [formData, setFormData] = useState({
    project_id: '',
    wbs_phase_id: '',
    task_id: '',
    subtask_id: '',
    assigned_user_id: '',
    role: '',
    priority: 'MEDIUM',
    start_date: '',
    due_date: '',
    remarks: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Initial Data Fetch
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [assignRes, projRes, userRes] = await Promise.all([
        taskAssignmentService.getAssignments(),
        projectService.getProjects(),
        userService.getUsers()
      ]);
      setAssignments(assignRes.data || []);
      setProjects(projRes.data || []);

      // Filter out customer accounts from internal assignment dropdowns
      const eligibleUsers = (userRes.data || []).filter(u => u.role !== 'customer');
      setUsers(eligibleUsers);
    } catch (err) {
      console.error("Failed to load task assignments data:", err);
      setError("Failed to load data from server.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignmentsOnly = async () => {
    try {
      const res = await taskAssignmentService.getAssignments({
        project_id: selectedProjectId || undefined,
        status: selectedStatusFilter !== 'ALL' ? selectedStatusFilter : undefined,
        assigned_user_id: selectedUserFilter !== 'ALL' ? selectedUserFilter : undefined,
        priority: selectedPriorityFilter !== 'ALL' ? selectedPriorityFilter : undefined
      });
      setAssignments(res.data || []);
    } catch (err) {
      console.error("Error refreshing task assignments:", err);
    }
  };

  useEffect(() => {
    fetchAssignmentsOnly();
  }, [selectedProjectId, selectedStatusFilter, selectedUserFilter, selectedPriorityFilter]);

  // Load WBS hierarchy & Project Team when project changes in Create/Edit Form
  const [projectTeamMembers, setProjectTeamMembers] = useState([]);

  useEffect(() => {
    if (!formData.project_id) {
      setWbsHierarchy([]);
      setProjectTeamMembers([]);
      return;
    }
    const loadWbsAndTeam = async () => {
      try {
        const [wbsRes, teamRes] = await Promise.all([
          wbsService.getWbsByProject(formData.project_id),
          projectTeamService.getProjectTeam(formData.project_id).catch(() => ({ data: { members: [] } }))
        ]);
        setWbsHierarchy(wbsRes.data || []);
        const members = teamRes.data?.members || [];
        setProjectTeamMembers(members.filter(m => m.status === 'ACTIVE'));
      } catch (err) {
        console.error("Failed to load project WBS hierarchy or team:", err);
      }
    };
    loadWbsAndTeam();
  }, [formData.project_id]);

  // Derived WBS options
  const wbsPhases = useMemo(() => {
    return wbsHierarchy.filter(item => !item.parent_task_id || item.task_level === 'Phase');
  }, [wbsHierarchy]);

  const availableTasks = useMemo(() => {
    if (!formData.wbs_phase_id) return [];
    const pId = parseInt(formData.wbs_phase_id, 10);
    return wbsHierarchy.filter(item => item.parent_task_id === pId);
  }, [wbsHierarchy, formData.wbs_phase_id]);

  const availableSubtasks = useMemo(() => {
    if (!formData.task_id) return [];
    const tId = parseInt(formData.task_id, 10);
    return wbsHierarchy.filter(item => item.parent_task_id === tId);
  }, [wbsHierarchy, formData.task_id]);

  // Handle Project Change in Modal Form
  const handleProjectSelectChange = (e) => {
    const projId = e.target.value;
    setFormData(prev => ({
      ...prev,
      project_id: projId,
      wbs_phase_id: '',
      task_id: '',
      subtask_id: ''
    }));
  };

  // Handle Phase Change
  const handlePhaseSelectChange = (e) => {
    const phaseId = e.target.value;
    setFormData(prev => ({
      ...prev,
      wbs_phase_id: phaseId,
      task_id: '',
      subtask_id: ''
    }));
  };

  // Handle Task Change
  const handleTaskSelectChange = (e) => {
    const taskId = e.target.value;
    setFormData(prev => ({
      ...prev,
      task_id: taskId,
      subtask_id: ''
    }));
  };

  // Handle User Change and auto-populate Role
  const handleUserSelectChange = (e) => {
    const uIdStr = e.target.value;
    const uId = parseInt(uIdStr, 10);
    const selectedUser = users.find(u => u.id === uId);

    setFormData(prev => ({
      ...prev,
      assigned_user_id: uIdStr,
      role: selectedUser ? formatRole(selectedUser.role) : prev.role
    }));
  };

  // Metric Stats Calculations
  const stats = useMemo(() => {
    const total = assignments.length;
    const assigned = assignments.filter(a => a.status === 'ASSIGNED' || a.status === 'IN PROGRESS').length;
    const unassigned = assignments.filter(a => a.status === 'UNASSIGNED').length;
    const overdue = assignments.filter(a => a.status === 'OVERDUE').length;
    return { total, assigned, unassigned, overdue };
  }, [assignments]);

  // Filtered Assignments List
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || (
        (a.assignment_ref || '').toLowerCase().includes(q) ||
        (a.project_name || '').toLowerCase().includes(q) ||
        (a.task_name || '').toLowerCase().includes(q) ||
        (a.subtask_name || '').toLowerCase().includes(q) ||
        (a.assigned_user_name || '').toLowerCase().includes(q) ||
        (a.role || '').toLowerCase().includes(q)
      );

      const matchesProj = !selectedProjectId || a.project_id === parseInt(selectedProjectId, 10);
      const matchesStatus = selectedStatusFilter === 'ALL' || a.status === selectedStatusFilter;
      const matchesUser = selectedUserFilter === 'ALL' || a.assigned_user_id === parseInt(selectedUserFilter, 10);
      const matchesPriority = selectedPriorityFilter === 'ALL' || a.priority === selectedPriorityFilter;

      return matchesQuery && matchesProj && matchesStatus && matchesUser && matchesPriority;
    });
  }, [assignments, searchQuery, selectedProjectId, selectedStatusFilter, selectedUserFilter, selectedPriorityFilter]);

  // Open Form Modal (Create / Edit)
  const handleOpenFormModal = (assignmentToEdit = null) => {
    setFormErrors({});
    if (assignmentToEdit) {
      setEditingId(assignmentToEdit.id);
      setFormData({
        project_id: assignmentToEdit.project_id.toString(),
        wbs_phase_id: assignmentToEdit.wbs_phase_id.toString(),
        task_id: assignmentToEdit.task_id.toString(),
        subtask_id: assignmentToEdit.subtask_id ? assignmentToEdit.subtask_id.toString() : '',
        assigned_user_id: assignmentToEdit.assigned_user_id.toString(),
        role: assignmentToEdit.role || '',
        priority: assignmentToEdit.priority || 'MEDIUM',
        start_date: assignmentToEdit.start_date || '',
        due_date: assignmentToEdit.due_date || '',
        remarks: assignmentToEdit.remarks || ''
      });
    } else {
      setEditingId(null);
      const firstProjId = projects.length > 0 ? projects[0].id.toString() : '';
      const firstUser = users.length > 0 ? users[0] : null;

      const todayStr = new Date().toISOString().split('T')[0];
      const futureDueStr = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

      setFormData({
        project_id: firstProjId,
        wbs_phase_id: '',
        task_id: '',
        subtask_id: '',
        assigned_user_id: firstUser ? firstUser.id.toString() : '',
        role: firstUser ? formatRole(firstUser.role) : '',
        priority: 'MEDIUM',
        start_date: todayStr,
        due_date: futureDueStr,
        remarks: ''
      });
    }
    setIsFormModalOpen(true);
  };

  // Form Validation
  const validateForm = () => {
    const errs = {};
    if (!formData.project_id) errs.project_id = "Project selection is required.";
    if (!formData.wbs_phase_id) errs.wbs_phase_id = "WBS Phase selection is required.";
    if (!formData.task_id) errs.task_id = "Task selection is required.";
    if (!formData.assigned_user_id) errs.assigned_user_id = "Assigned user is required.";
    if (!formData.start_date) errs.start_date = "Start date is required.";
    if (!formData.due_date) errs.due_date = "Due date is required.";

    if (formData.start_date && formData.due_date && formData.due_date < formData.start_date) {
      errs.due_date = "Due date cannot be earlier than start date.";
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Form Modal
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const payload = {
        project_id: parseInt(formData.project_id, 10),
        wbs_phase_id: parseInt(formData.wbs_phase_id, 10),
        task_id: parseInt(formData.task_id, 10),
        subtask_id: formData.subtask_id ? parseInt(formData.subtask_id, 10) : null,
        assigned_user_id: parseInt(formData.assigned_user_id, 10),
        role: formData.role,
        priority: formData.priority,
        start_date: formData.start_date,
        due_date: formData.due_date,
        remarks: formData.remarks
      };

      if (editingId) {
        await taskAssignmentService.updateAssignment(editingId, payload);
        setSuccessMsg("Task assignment updated successfully.");
      } else {
        await taskAssignmentService.createAssignment(payload);
        setSuccessMsg("Task assigned successfully.");
      }

      setIsFormModalOpen(false);
      fetchAssignmentsOnly();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Save assignment error:", err);
      setError(err.response?.data?.detail || "Failed to save task assignment.");
    }
  };

  // Open Reassign Modal
  const handleOpenReassignModal = (assignment) => {
    setReassignTarget(assignment);
    const nextUser = users.find(u => u.id !== assignment.assigned_user_id) || null;
    setReassignForm({
      new_user_id: nextUser ? nextUser.id.toString() : '',
      role: nextUser ? formatRole(nextUser.role) : '',
      remarks: ''
    });
    setIsReassignModalOpen(true);
  };

  // Submit Reassign Modal
  const handleSaveReassign = async (e) => {
    e.preventDefault();
    if (!reassignForm.new_user_id) {
      alert("Please select a new team member to reassign this task to.");
      return;
    }

    try {
      await taskAssignmentService.reassignTask(reassignTarget.id, {
        new_user_id: parseInt(reassignForm.new_user_id, 10),
        role: reassignForm.role,
        remarks: reassignForm.remarks
      });

      setSuccessMsg(`Task ${reassignTarget.assignment_ref} reassigned successfully.`);
      setIsReassignModalOpen(false);
      fetchAssignmentsOnly();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Reassign error:", err);
      setError(err.response?.data?.detail || "Failed to reassign task.");
    }
  };

  // Open Detail Modal
  const handleViewDetail = async (id) => {
    try {
      const res = await taskAssignmentService.getAssignmentById(id);
      setSelectedDetail(res.data);
      setIsDetailModalOpen(true);
    } catch (err) {
      console.error("Failed to load details:", err);
      setError("Failed to load task assignment details.");
    }
  };

  // Delete Assignment
  const handleDeleteAssignment = async (id, ref) => {
    if (!window.confirm(`Are you sure you want to delete assignment ${ref}?`)) return;

    try {
      await taskAssignmentService.deleteAssignment(id);
      setSuccessMsg(`Task assignment ${ref} deleted.`);
      fetchAssignmentsOnly();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Delete error:", err);
      setError(err.response?.data?.detail || "Failed to delete task assignment.");
    }
  };

  // Render Badges
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'ASSIGNED':
        return <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Clock size={12} /> ASSIGNED</span>;
      case 'IN PROGRESS':
        return <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><ArrowUpRight size={12} /> IN PROGRESS</span>;
      case 'COMPLETED':
        return <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle size={12} /> COMPLETED</span>;
      case 'OVERDUE':
        return <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><AlertCircle size={12} /> OVERDUE</span>;
      default:
        return <span style={{ color: '#94a3b8' }}>{status}</span>;
    }
  };

  const renderPriorityBadge = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.73rem', background: 'rgba(239,68,68,0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>CRITICAL</span>;
      case 'HIGH':
        return <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.73rem', background: 'rgba(245,158,11,0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>HIGH</span>;
      case 'MEDIUM':
        return <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.73rem', background: 'rgba(56,189,248,0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>MEDIUM</span>;
      case 'LOW':
        return <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.73rem', background: 'rgba(148,163,184,0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>LOW</span>;
      default:
        return priority;
    }
  };

  return (
    <div className="page-container" style={{ padding: '1.5rem', background: '#0b0f19', color: '#e2e8f0', minHeight: '100vh' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.65rem', margin: 0 }}>
            <UserCheck style={{ color: '#38bdf8' }} size={28} />
            Task Assignments
          </h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem', fontSize: '0.9rem' }}>
            Assign project tasks to responsible team members and track ownership.
          </p>
        </div>

        <button
          onClick={() => handleOpenFormModal(null)}
          className="btn btn-primary"
          style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 12px rgba(2,132,199,0.3)' }}
        >
          <Plus size={18} />
          Assign Task
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Assignments</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>{stats.total}</div>
        </div>
        <div style={{ background: '#0f172a', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Assigned / Active</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>{stats.assigned}</div>
        </div>
        <div style={{ background: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Unassigned</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#cbd5e1', marginTop: '0.2rem' }}>{stats.unassigned}</div>
        </div>
        <div style={{ background: '#0f172a', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Overdue Tasks</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f87171', marginTop: '0.2rem' }}>{stats.overdue}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search by Ref, Project, Task, User..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '0.5rem 0.75rem 0.5rem 2.25rem', color: '#f8fafc', fontSize: '0.85rem' }}
          />
        </div>

        {/* Project Filter */}
        <div style={{ flex: '1 1 200px' }}>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
          >
            <option value="">[ All Projects ]</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ width: '160px' }}>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="IN PROGRESS">IN PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="OVERDUE">OVERDUE</option>
          </select>
        </div>

        {/* Assigned User Filter */}
        <div style={{ width: '180px' }}>
          <select
            value={selectedUserFilter}
            onChange={(e) => setSelectedUserFilter(e.target.value)}
            style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Team Members</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>

        {/* Priority Filter */}
        <div style={{ width: '140px' }}>
          <select
            value={selectedPriorityFilter}
            onChange={(e) => setSelectedPriorityFilter(e.target.value)}
            style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>

      </div>

      {/* Task Assignments Data Table */}
      <div style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading task assignments...</div>
        ) : filteredAssignments.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <UserCheck size={36} style={{ margin: '0 auto 0.75rem auto', color: '#64748b', display: 'block' }} />
            No task assignments found matching your criteria. Click <strong>+ Assign Task</strong> to assign a task.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ background: 'rgba(30, 41, 59, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Assignment Ref</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Project</th>
                  <th style={{ padding: '0.75rem 1rem' }}>WBS Phase & Task</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Assigned To & Role</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Start Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Due Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map((a, idx) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', background: idx % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.2)' }}>
                    
                    {/* Assignment Ref */}
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#38bdf8' }}>
                      {a.assignment_ref}
                    </td>

                    {/* Project Name */}
                    <td style={{ padding: '0.75rem 1rem', color: '#f8fafc', fontWeight: 600 }}>
                      {a.project_name || 'N/A'}
                    </td>

                    {/* WBS Phase, Task & Subtask */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ color: '#cbd5e1', fontWeight: 600 }}>{a.task_name || 'N/A'}</div>
                      <div style={{ fontSize: '0.73rem', color: '#64748b' }}>
                        Phase: {a.phase_name || 'N/A'} {a.subtask_name ? ` → Subtask: ${a.subtask_name}` : ''}
                      </div>
                    </td>

                    {/* Assigned User & Role */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <UserCheck size={14} style={{ color: '#38bdf8' }} />
                        {a.assigned_user_name || 'Unassigned'}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: '#94a3b8' }}>
                        {formatRole(a.role)}
                      </div>
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {renderPriorityBadge(a.priority)}
                    </td>

                    {/* Start Date */}
                    <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                      {a.start_date}
                    </td>

                    {/* Due Date */}
                    <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>
                      {a.due_date}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {renderStatusBadge(a.status)}
                    </td>

                    {/* Action Buttons */}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                        
                        {/* View Button */}
                        <button
                          onClick={() => handleViewDetail(a.id)}
                          style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.73rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                          title="View Details"
                        >
                          <Eye size={12} /> View
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenFormModal(a)}
                          style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.73rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                          title="Edit Assignment"
                        >
                          <Edit size={12} /> Edit
                        </button>

                        {/* Reassign Button */}
                        <button
                          onClick={() => handleOpenReassignModal(a)}
                          style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', color: '#c084fc', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.73rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                          title="Reassign Task"
                        >
                          <UserPlus size={12} /> Reassign
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteAssignment(a.id, a.assignment_ref)}
                          style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.73rem', cursor: 'pointer' }}
                          title="Delete Assignment"
                        >
                          <Trash2 size={12} />
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

      {/* CREATE / EDIT TASK ASSIGNMENT MODAL */}
      {isFormModalOpen && (
        <div onClick={() => setIsFormModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#0f172a', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', width: '100%', maxWidth: '650px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <UserCheck size={18} />
                {editingId ? 'Edit Task Assignment' : 'Assign Task to Project'}
              </h3>
              <button onClick={() => setIsFormModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><XCircle size={20} /></button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitForm}>

              {/* Project Selection */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>Project *</label>
                <select
                  value={formData.project_id}
                  onChange={handleProjectSelectChange}
                  disabled={!!editingId}
                  style={{ width: '100%', background: '#1e293b', border: formErrors.project_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                >
                  <option value="">[ Select Project ]</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {formErrors.project_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.project_id}</div>}
              </div>

              {/* Cascading WBS Hierarchy: Phase & Task */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                
                {/* WBS Phase */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>WBS Phase *</label>
                  <select
                    value={formData.wbs_phase_id}
                    onChange={handlePhaseSelectChange}
                    disabled={!formData.project_id || !!editingId}
                    style={{ width: '100%', background: '#1e293b', border: formErrors.wbs_phase_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  >
                    <option value="">[ Select WBS Phase ]</option>
                    {wbsPhases.map(phase => (
                      <option key={phase.id} value={phase.id}>{phase.title || phase.task_name}</option>
                    ))}
                  </select>
                  {formErrors.wbs_phase_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.wbs_phase_id}</div>}
                </div>

                {/* Task */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>Task *</label>
                  <select
                    value={formData.task_id}
                    onChange={handleTaskSelectChange}
                    disabled={!formData.wbs_phase_id || !!editingId}
                    style={{ width: '100%', background: '#1e293b', border: formErrors.task_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  >
                    <option value="">[ Select Task ]</option>
                    {availableTasks.map(task => (
                      <option key={task.id} value={task.id}>{task.title || task.task_name}</option>
                    ))}
                  </select>
                  {formErrors.task_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.task_id}</div>}
                </div>

              </div>

              {/* Subtask Selection (Optional) */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>Subtask (Optional)</label>
                <select
                  value={formData.subtask_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, subtask_id: e.target.value }))}
                  disabled={!formData.task_id || !!editingId}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                >
                  <option value="">[ None / Entire Task ]</option>
                  {availableSubtasks.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.title || sub.task_name}</option>
                  ))}
                </select>
              </div>

              {/* Assigned To & Role */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                
                {/* Assigned To */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>Assigned To *</label>
                  <select
                    value={formData.assigned_user_id}
                    onChange={handleUserSelectChange}
                    style={{ width: '100%', background: '#1e293b', border: formErrors.assigned_user_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  >
                    <option value="">[ Select Project Team Member ]</option>
                    {projectTeamMembers.length > 0 ? (
                      <optgroup label="Active Project Team Members">
                        {projectTeamMembers.map(m => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.user_name} ({m.project_role})
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      <optgroup label="All Application Users (Team Membership Required)">
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name} ({formatRole(u.role)})</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {projectTeamMembers.length === 0 && formData.project_id && (
                    <div style={{ color: '#fbbf24', fontSize: '0.73rem', marginTop: '0.25rem' }}>
                      ⚠️ No active team members for this project yet. Please add team members under <strong>Project Team</strong>.
                    </div>
                  )}
                  {formErrors.assigned_user_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.assigned_user_id}</div>}
                </div>

                {/* Role */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>Role</label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="e.g. Site Engineer..."
                    style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  />
                </div>

              </div>

              {/* Priority & Start/Due Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                
                {/* Priority */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>Start Date *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    style={{ width: '100%', background: '#1e293b', border: formErrors.start_date ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  />
                  {formErrors.start_date && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.start_date}</div>}
                </div>

                {/* Due Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>Due Date *</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                    style={{ width: '100%', background: '#1e293b', border: formErrors.due_date ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  />
                  {formErrors.due_date && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.due_date}</div>}
                </div>

              </div>

              {/* Remarks */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>Remarks / Scope Instructions</label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Additional assignment instructions..."
                  style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setIsFormModalOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.45rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.45rem 1.2rem', borderRadius: '6px', cursor: 'pointer' }}>Save Assignment</button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* REASSIGN TASK MODAL */}
      {isReassignModalOpen && reassignTarget && (
        <div onClick={() => setIsReassignModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#0f172a', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c084fc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <UserPlus size={18} />
                Reassign Task: {reassignTarget.assignment_ref}
              </h3>
              <button onClick={() => setIsReassignModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><XCircle size={20} /></button>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
              <div>Task: <strong style={{ color: '#f8fafc' }}>{reassignTarget.task_name}</strong></div>
              <div>Current Assignee: <strong style={{ color: '#fbbf24' }}>{reassignTarget.assigned_user_name}</strong> ({formatRole(reassignTarget.role)})</div>
            </div>

            <form onSubmit={handleSaveReassign}>
              
              {/* Select New Assignee */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>Reassign To *</label>
                <select
                  value={reassignForm.new_user_id}
                  onChange={(e) => {
                    const uId = parseInt(e.target.value, 10);
                    const u = users.find(x => x.id === uId);
                    setReassignForm(prev => ({
                      ...prev,
                      new_user_id: e.target.value,
                      role: u ? formatRole(u.role) : prev.role
                    }));
                  }}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                >
                  <option value="">[ Select New Team Member ]</option>
                  {users.filter(u => u.id !== reassignTarget.assigned_user_id).map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({formatRole(u.role)})</option>
                  ))}
                </select>
              </div>

              {/* Role */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>Role Title</label>
                <input
                  type="text"
                  value={reassignForm.role}
                  onChange={(e) => setReassignForm(prev => ({ ...prev, role: e.target.value }))}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                />
              </div>

              {/* Remarks */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>Reassignment Reason / Audit Note</label>
                <textarea
                  rows={2}
                  value={reassignForm.remarks}
                  onChange={(e) => setReassignForm(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="State reason for reassignment..."
                  style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                <button type="button" onClick={() => setIsReassignModalOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.45rem 1rem', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ background: 'linear-gradient(135deg, #a855f7, #7e22ce)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.45rem 1.2rem', borderRadius: '6px', cursor: 'pointer' }}>Confirm Reassignment</button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* TASK ASSIGNMENT DETAIL MODAL */}
      {isDetailModalOpen && selectedDetail && (
        <div onClick={() => setIsDetailModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#0f172a', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.95)', stickyTop: 0 }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Task Assignment Details</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: '0.1rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {selectedDetail.assignment_ref}
                  {renderStatusBadge(selectedDetail.status)}
                </h2>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><XCircle size={20} /></button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem' }}>
              
              {/* Assignment Summary Grid */}
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Project:</span>
                  <div style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedDetail.project_name}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Assigned To & Role:</span>
                  <div style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedDetail.assigned_user_name} ({formatRole(selectedDetail.role)})</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>WBS Phase:</span>
                  <div style={{ color: '#cbd5e1' }}>{selectedDetail.phase_name}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>WBS Task / Subtask:</span>
                  <div style={{ color: '#cbd5e1' }}>{selectedDetail.task_name} {selectedDetail.subtask_name ? ` → ${selectedDetail.subtask_name}` : ''}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Priority:</span>
                  <div>{renderPriorityBadge(selectedDetail.priority)}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Execution Period:</span>
                  <div style={{ color: '#fbbf24', fontWeight: 600 }}>{selectedDetail.start_date} to {selectedDetail.due_date}</div>
                </div>
                {selectedDetail.remarks && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Assignment Remarks:</span>
                    <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>"{selectedDetail.remarks}"</div>
                  </div>
                )}
              </div>

              {/* WORK PLAN REFERENCE SECTION */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileSpreadsheet size={16} /> WORK PLAN REFERENCE
                </h4>
                {selectedDetail.work_plan_ref ? (
                  <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', padding: '1rem', fontSize: '0.82rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                      <div>
                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Work Plan Ref:</span>
                        <div style={{ color: '#38bdf8', fontWeight: 700 }}>{selectedDetail.work_plan_ref.work_plan_number}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Activity Name:</span>
                        <div style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedDetail.work_plan_ref.activity_name}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Planned Quantity & Unit:</span>
                        <div style={{ color: '#cbd5e1' }}>{selectedDetail.work_plan_ref.planned_quantity.toLocaleString()} {selectedDetail.work_plan_ref.unit}</div>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Work Plan Status:</span>
                        <div style={{ color: '#34d399', fontWeight: 600 }}>{selectedDetail.work_plan_ref.status}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(30, 41, 59, 0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                    No Work Plan activity linked to this task yet. Work Plan activities can be created under the Work Plan module.
                  </div>
                )}
              </div>

              {/* AUDIT LOG TIMELINE SECTION */}
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#c084fc', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={16} /> ASSIGNMENT AUDIT TRAIL
                </h4>
                {selectedDetail.audits.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No audit history recorded.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {selectedDetail.audits.map(audit => (
                      <div key={audit.id} style={{ background: 'rgba(30, 41, 59, 0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '0.65rem 0.85rem', fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 700, color: audit.action === 'REASSIGNED' ? '#c084fc' : '#38bdf8' }}>{audit.action}</span>
                          <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{new Date(audit.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ color: '#cbd5e1' }}>{audit.remarks}</div>
                        {audit.previous_user_name && audit.new_user_name && (
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            {audit.previous_user_name} → <strong style={{ color: '#38bdf8' }}>{audit.new_user_name}</strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(15, 23, 42, 0.95)' }}>
              <button onClick={() => setIsDetailModalOpen(false)} style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#ffffff', fontWeight: 600, padding: '0.45rem 1.2rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>Close</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
