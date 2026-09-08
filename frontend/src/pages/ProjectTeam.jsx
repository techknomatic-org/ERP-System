import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Plus, Search, Filter, ShieldCheck, HardHat, Building2, UserCheck, 
  Eye, Edit, Trash2, Power, AlertCircle, CheckCircle, Clock, Calendar, Briefcase, 
  Layers, ArrowUpRight, History, FileText, Check, X, RefreshCw
} from 'lucide-react';
import { projectService, projectTeamService } from '../services/api';

const CONTROLLED_ROLES = [
  "PROJECT MANAGER",
  "SITE ENGINEER",
  "PLANNING ENGINEER",
  "QA/QC ENGINEER",
  "HSE OFFICER",
  "PROCUREMENT",
  "FINANCE",
  "SUPERVISOR",
  "SITE SUPERVISOR",
  "PROJECT SPONSOR",
  "OTHER"
];

const CONTROLLED_DEPARTMENTS = [
  "Project Management",
  "Execution",
  "Planning",
  "Quality",
  "Safety",
  "Procurement",
  "Finance",
  "Management"
];

const formatAppRole = (raw) => {
  if (!raw) return 'Employee';
  const r = raw.trim().toLowerCase();
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
  return map[r] || raw.replace('_', ' ').toUpperCase();
};

export default function ProjectTeam() {
  const navigate = useNavigate();

  // Core Data States
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [teamData, setTeamData] = useState({ summary: {}, members: [] });
  const [eligibleUsers, setEligibleUsers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedMemberDetail, setSelectedMemberDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    project_id: '',
    user_id: '',
    project_role: 'SITE ENGINEER',
    department: 'Execution',
    responsibility: '',
    joining_date: new Date().toISOString().split('T')[0],
    status: 'ACTIVE',
    remarks: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [dateWarning, setDateWarning] = useState(null);

  // Initial Projects & Eligible Users Load
  useEffect(() => {
    fetchInitialProjectsAndUsers();
  }, []);

  const fetchInitialProjectsAndUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, usersRes] = await Promise.all([
        projectService.getProjects(),
        projectTeamService.getEligibleUsers()
      ]);

      const projList = Array.isArray(projRes.data) ? projRes.data : (projRes.data?.projects || []);
      setProjects(projList);
      setEligibleUsers(usersRes.data || []);

      if (projList.length > 0) {
        // Default to Greenfield Data Center Park if present, else first project
        const greenfield = projList.find(p => (p.name || '').includes('Greenfield'));
        const defaultId = greenfield ? greenfield.id.toString() : projList[0].id.toString();
        setSelectedProjectId(defaultId);
      }
    } catch (err) {
      console.error("Failed to load initial projects or users:", err);
      setError("Failed to connect to server. Please verify backend service.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Team Members when Selected Project Changes
  const fetchTeamForProject = async (projId) => {
    if (!projId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await projectTeamService.getProjectTeam(projId);
      setTeamData(res.data || { summary: {}, members: [] });
    } catch (err) {
      console.error("Error fetching project team:", err);
      setError(err.response?.data?.detail || "Failed to load project team members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchTeamForProject(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Current Selected Project Object
  const currentProject = useMemo(() => {
    return projects.find(p => p.id.toString() === selectedProjectId.toString()) || null;
  }, [projects, selectedProjectId]);

  // Joining Date Validation against Project Start Date
  useEffect(() => {
    if (formData.joining_date && currentProject?.start_date) {
      const join = new Date(formData.joining_date);
      const start = new Date(currentProject.start_date);
      if (join < start) {
        setDateWarning(`Joining date (${formData.joining_date}) is earlier than project start date (${currentProject.start_date.split('T')[0]}).`);
      } else {
        setDateWarning(null);
      }
    } else {
      setDateWarning(null);
    }
  }, [formData.joining_date, currentProject]);

  // Filtered Members List
  const filteredMembers = useMemo(() => {
    const members = teamData.members || [];
    return members.filter(m => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        (m.user_name || '').toLowerCase().includes(q) ||
        (m.user_email || '').toLowerCase().includes(q) ||
        (m.project_role || '').toLowerCase().includes(q) ||
        (m.department || '').toLowerCase().includes(q) ||
        (m.responsibility || '').toLowerCase().includes(q)
      );

      const matchesRole = roleFilter === 'ALL' || (m.project_role || '').toUpperCase() === roleFilter.toUpperCase();
      const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [teamData.members, searchQuery, roleFilter, statusFilter]);

  // Open Form Modal (Add / Edit)
  const handleOpenFormModal = (memberToEdit = null) => {
    setFormErrors({});
    setError(null);
    if (memberToEdit) {
      setEditingMemberId(memberToEdit.id);
      setFormData({
        project_id: memberToEdit.project_id.toString(),
        user_id: memberToEdit.user_id.toString(),
        project_role: memberToEdit.project_role || 'SITE ENGINEER',
        department: memberToEdit.department || 'Execution',
        responsibility: memberToEdit.responsibility || '',
        joining_date: memberToEdit.joining_date ? memberToEdit.joining_date.split('T')[0] : new Date().toISOString().split('T')[0],
        status: memberToEdit.status || 'ACTIVE',
        remarks: memberToEdit.remarks || ''
      });
    } else {
      setEditingMemberId(null);
      // Select first eligible user not currently ACTIVE in project team
      const existingUserIds = (teamData.members || []).filter(m => m.status === 'ACTIVE').map(m => m.user_id);
      const defaultUser = eligibleUsers.find(u => !existingUserIds.includes(u.id)) || eligibleUsers[0];

      setFormData({
        project_id: selectedProjectId.toString(),
        user_id: defaultUser ? defaultUser.id.toString() : '',
        project_role: 'SITE ENGINEER',
        department: 'Execution',
        responsibility: '',
        joining_date: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
        remarks: ''
      });
    }
    setIsFormModalOpen(true);
  };

  // Form Validation
  const validateForm = () => {
    const errs = {};
    if (!formData.project_id) errs.project_id = "Project is required.";
    if (!formData.user_id) errs.user_id = "Team Member / User selection is required.";
    if (!formData.project_role) errs.project_role = "Project Role is required.";
    if (!formData.joining_date) errs.joining_date = "Joining Date is required.";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Form Modal
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setError(null);
    setSuccessMsg(null);
    try {
      const payload = {
        project_id: parseInt(formData.project_id, 10),
        user_id: parseInt(formData.user_id, 10),
        project_role: formData.project_role,
        department: formData.department || null,
        responsibility: formData.responsibility || null,
        joining_date: formData.joining_date,
        status: formData.status,
        remarks: formData.remarks || null
      };

      if (editingMemberId) {
        await projectTeamService.updateTeamMember(editingMemberId, payload);
        setSuccessMsg("Project team member updated successfully.");
      } else {
        await projectTeamService.createTeamMember(payload);
        setSuccessMsg("Team member added to project successfully.");
      }

      setIsFormModalOpen(false);
      fetchTeamForProject(selectedProjectId);
    } catch (err) {
      console.error("Error saving team member:", err);
      setError(err.response?.data?.detail || "Failed to save project team member.");
    }
  };

  // Toggle Member Status (ACTIVE / INACTIVE)
  const handleToggleStatus = async (member) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await projectTeamService.toggleMemberStatus(member.id);
      const newSt = res.data.status;
      setSuccessMsg(`Status for member '${member.user_name}' changed to ${newSt}.`);
      fetchTeamForProject(selectedProjectId);
    } catch (err) {
      console.error("Error toggling member status:", err);
      setError(err.response?.data?.detail || "Failed to change member status.");
    }
  };

  // Remove Member (Soft Delete)
  const handleRemoveMember = async (member) => {
    if (!window.confirm(`Are you sure you want to remove '${member.user_name}' from this project team?`)) return;

    setError(null);
    setSuccessMsg(null);
    try {
      await projectTeamService.removeTeamMember(member.id);
      setSuccessMsg(`Member '${member.user_name}' removed from project team.`);
      fetchTeamForProject(selectedProjectId);
    } catch (err) {
      console.error("Error removing member:", err);
      setError(err.response?.data?.detail || "Failed to remove project team member.");
    }
  };

  // Open Detail View Modal
  const handleOpenDetailModal = async (memberId) => {
    setLoadingDetail(true);
    setIsDetailModalOpen(true);
    setSelectedMemberDetail(null);
    try {
      const res = await projectTeamService.getTeamMemberDetail(memberId);
      setSelectedMemberDetail(res.data);
    } catch (err) {
      console.error("Error fetching member details:", err);
      setError(err.response?.data?.detail || "Failed to fetch member details.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const summary = teamData.summary || {};

  return (
    <div className="page-container" style={{ padding: '1.5rem', background: '#0f172a', color: '#f8fafc', minHeight: '100vh' }}>
      
      {/* Top Header & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Briefcase size={14} color="#38bdf8" />
            <span>Planning & Execution</span>
            <span>/</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Project Team</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            Project Team
          </h1>
          <p style={{ margin: '0.3rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
            Manage project members, responsibilities and team roles.
          </p>
        </div>

        <button
          onClick={() => handleOpenFormModal()}
          className="btn-primary"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: 'white',
            border: 'none',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
          }}
        >
          <Plus size={18} />
          <span>+ Add Team Member</span>
        </button>
      </div>

      {/* Alert Banners */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.85rem 1.2rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}

      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6ee7b7', padding: '0.85rem 1.2rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle size={18} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}

      {/* Project Selector Bar */}
      <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 size={20} color="#38bdf8" />
          <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap' }}>
            Project <span style={{ color: '#ef4444' }}>*</span>
          </label>
        </div>

        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          style={{
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#f8fafc',
            padding: '0.6rem 1rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: 600,
            minWidth: '320px',
            outline: 'none'
          }}
        >
          {projects.length === 0 ? (
            <option value="">No projects available</option>
          ) : (
            projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code || `PRJ-${p.id}`})
              </option>
            ))
          )}
        </select>

        {currentProject && (
          <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
            <span>Status: <strong style={{ color: '#38bdf8' }}>{currentProject.status || 'Active'}</strong></span>
            {currentProject.start_date && (
              <span>Start Date: <strong style={{ color: '#e2e8f0' }}>{currentProject.start_date.split('T')[0]}</strong></span>
            )}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={24} color="#6366f1" />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Total Team Members</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', marginTop: '0.1rem' }}>
              {loading ? '...' : (summary.total_members ?? 0)}
            </div>
          </div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={24} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Active Members</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '0.1rem' }}>
              {loading ? '...' : (summary.active_members ?? 0)}
            </div>
          </div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Briefcase size={24} color="#f59e0b" />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Project Managers</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.1rem' }}>
              {loading ? '...' : (summary.project_managers ?? 0)}
            </div>
          </div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HardHat size={24} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Site / Execution</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.1rem' }}>
              {loading ? '...' : (summary.execution_members ?? 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px 12px 0 0', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search team member name, role, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                padding: '0.55rem 0.85rem 0.55rem 2.4rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={14} color="#94a3b8" />
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            >
              <option value="ALL">All Roles</option>
              {CONTROLLED_ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                outline: 'none'
              }}
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <button
            onClick={() => fetchTeamForProject(selectedProjectId)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8',
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8rem'
            }}
            title="Refresh List"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Team Table */}
      <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.08)', borderTop: 'none', borderRadius: '0 0 12px 12px', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
            <div>Loading project team members...</div>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <Users size={36} color="#64748b" style={{ marginBottom: '0.75rem' }} />
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0' }}>No Project Team Members Found</div>
            <p style={{ fontSize: '0.85rem', margin: '0.4rem 0 1rem 0' }}>
              {teamData.members?.length === 0 ? "No team members have been assigned to this project yet." : "No team members match your filter criteria."}
            </p>
            <button
              onClick={() => handleOpenFormModal()}
              style={{
                background: '#6366f1',
                color: 'white',
                border: 'none',
                padding: '0.55rem 1.1rem',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              + Add First Team Member
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>Member</th>
                <th style={{ padding: '0.85rem 1rem' }}>App Role</th>
                <th style={{ padding: '0.85rem 1rem' }}>Project Role</th>
                <th style={{ padding: '0.85rem 1rem' }}>Department</th>
                <th style={{ padding: '0.85rem 1rem' }}>Responsibility</th>
                <th style={{ padding: '0.85rem 1rem' }}>Joining Date</th>
                <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                <th style={{ padding: '0.85rem 1rem' }}>Task Assignments</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => {
                const isActive = m.status === 'ACTIVE';
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.15s' }}>
                    
                    {/* Member Name & Email */}
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>{m.user_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{m.user_email}</div>
                    </td>

                    {/* App Role */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ background: 'rgba(255, 255, 255, 0.06)', padding: '0.2rem 0.55rem', borderRadius: '4px', color: '#cbd5e1', fontSize: '0.78rem' }}>
                        {formatAppRole(m.user_app_role)}
                      </span>
                    </td>

                    {/* Project Role */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        background: (m.project_role || '').includes('MANAGER') ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                        border: (m.project_role || '').includes('MANAGER') ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                        color: (m.project_role || '').includes('MANAGER') ? '#fcd34d' : '#38bdf8',
                        fontWeight: 600,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem'
                      }}>
                        {m.project_role}
                      </span>
                    </td>

                    {/* Department */}
                    <td style={{ padding: '0.85rem 1rem', color: '#e2e8f0' }}>
                      {m.department || '—'}
                    </td>

                    {/* Responsibility */}
                    <td style={{ padding: '0.85rem 1rem', color: '#94a3b8', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.responsibility}>
                      {m.responsibility || '—'}
                    </td>

                    {/* Joining Date */}
                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                      {m.joining_date ? m.joining_date.split('T')[0] : '—'}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                        color: isActive ? '#34d399' : '#94a3b8',
                        border: isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.3)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '9999px',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActive ? '#34d399' : '#94a3b8' }} />
                        {m.status}
                      </span>
                    </td>

                    {/* Task Assignment Count */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <button
                        onClick={() => navigate(`/task-assignments?project_id=${m.project_id}&user_id=${m.user_id}`)}
                        style={{
                          background: 'rgba(99, 102, 241, 0.12)',
                          border: '1px solid rgba(99, 102, 241, 0.25)',
                          color: '#818cf8',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                        title="Click to filter task assignments for this member"
                      >
                        <Layers size={13} />
                        <span>{m.task_assignment_count || 0} Tasks</span>
                        <ArrowUpRight size={12} />
                      </button>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <button
                          onClick={() => handleOpenDetailModal(m.id)}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#38bdf8', padding: '0.35rem', borderRadius: '6px', cursor: 'pointer' }}
                          title="View Details & Tasks"
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          onClick={() => handleOpenFormModal(m)}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f59e0b', padding: '0.35rem', borderRadius: '6px', cursor: 'pointer' }}
                          title="Edit Team Member"
                        >
                          <Edit size={15} />
                        </button>

                        <button
                          onClick={() => handleToggleStatus(m)}
                          style={{
                            background: isActive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            border: isActive ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
                            color: isActive ? '#f87171' : '#34d399',
                            padding: '0.35rem',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                          title={isActive ? "Deactivate Member" : "Activate Member"}
                        >
                          <Power size={15} />
                        </button>

                        <button
                          onClick={() => handleRemoveMember(m)}
                          style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', padding: '0.35rem', borderRadius: '6px', cursor: 'pointer' }}
                          title="Remove Member"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD / EDIT TEAM MEMBER MODAL                     */}
      {/* ========================================================= */}
      {isFormModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '14px', width: '100%', maxWidth: '620px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            
            {/* Modal Header */}
            <div style={{ background: '#0f172a', padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserCheck size={20} color="#6366f1" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
                  {editingMemberId ? "Edit Project Team Member" : "Add Team Member to Project"}
                </h3>
              </div>
              <button onClick={() => setIsFormModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmitForm} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* Date Warning Banner if any */}
              {dateWarning && (
                <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', padding: '0.65rem 0.9rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={16} />
                  <span>{dateWarning}</span>
                </div>
              )}

              {/* Grid 2 Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                
                {/* Project (Disabled / Display) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Project <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={formData.project_id}
                    disabled={!!editingMemberId}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* User / Team Member */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    User / Team Member <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={formData.user_id}
                    disabled={!!editingMemberId}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    {eligibleUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({formatAppRole(u.role)})
                      </option>
                    ))}
                  </select>
                  {formErrors.user_id && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.2rem' }}>{formErrors.user_id}</div>}
                </div>

                {/* Project Role */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Project Role <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={formData.project_role}
                    onChange={(e) => setFormData({ ...formData, project_role: e.target.value })}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    {CONTROLLED_ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    {CONTROLLED_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Joining Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Joining Date <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.joining_date}
                    onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Status */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

              </div>

              {/* Responsibility */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Responsibility / Scope
                </label>
                <input
                  type="text"
                  placeholder="e.g. Overall project coordination, Foundation concrete supervision..."
                  value={formData.responsibility}
                  onChange={(e) => setFormData({ ...formData, responsibility: e.target.value })}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}
                />
              </div>

              {/* Remarks */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional assignment notes..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white', border: 'none', padding: '0.6rem 1.4rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {editingMemberId ? "Update Member" : "Save Team Member"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: TEAM MEMBER DETAIL & ASSIGNED TASKS MODAL       */}
      {/* ========================================================= */}
      {isDetailModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '14px', width: '100%', maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            
            {/* Modal Header */}
            <div style={{ background: '#0f172a', padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', sticky: 'top' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Eye size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
                  PROJECT TEAM MEMBER DETAIL
                </h3>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            {loadingDetail || !selectedMemberDetail ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
                <div>Fetching member detail and task assignments...</div>
              </div>
            ) : (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Member Profile Grid */}
                <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Member Name</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginTop: '0.2rem' }}>{selectedMemberDetail.user_name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{selectedMemberDetail.user_email}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Project</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#38bdf8', marginTop: '0.2rem' }}>{selectedMemberDetail.project_name}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Project Role</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f59e0b', marginTop: '0.2rem' }}>{selectedMemberDetail.project_role}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Application Role</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0', marginTop: '0.2rem' }}>{formatAppRole(selectedMemberDetail.user_app_role)}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Department</div>
                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.2rem' }}>{selectedMemberDetail.department || '—'}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Joining Date</div>
                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.2rem' }}>{selectedMemberDetail.joining_date ? selectedMemberDetail.joining_date.split('T')[0] : '—'}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Status</div>
                    <div style={{ marginTop: '0.2rem' }}>
                      <span style={{
                        background: selectedMemberDetail.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                        color: selectedMemberDetail.status === 'ACTIVE' ? '#34d399' : '#94a3b8',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '0.75rem'
                      }}>
                        {selectedMemberDetail.status}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedMemberDetail.responsibility && (
                  <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}>Responsibility</div>
                    <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{selectedMemberDetail.responsibility}</div>
                  </div>
                )}

                {/* TASK ASSIGNMENTS Section */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Layers size={16} color="#818cf8" />
                      <span>TASK ASSIGNMENTS</span>
                      <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '0.1rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem' }}>
                        {selectedMemberDetail.assigned_tasks?.length || 0}
                      </span>
                    </h4>
                  </div>

                  {selectedMemberDetail.assigned_tasks?.length === 0 ? (
                    <div style={{ background: '#0f172a', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      No active task assignments found for this team member on this project.
                    </div>
                  ) : (
                    <div style={{ background: '#0f172a', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>Ref</th>
                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>Task</th>
                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>Subtask</th>
                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>Priority</th>
                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>Dates</th>
                            <th style={{ padding: '0.65rem 0.85rem', textAlign: 'left' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedMemberDetail.assigned_tasks.map(t => (
                            <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#38bdf8' }}>{t.assignment_ref}</td>
                              <td style={{ padding: '0.65rem 0.85rem', color: '#f1f5f9' }}>{t.task_name}</td>
                              <td style={{ padding: '0.65rem 0.85rem', color: '#94a3b8' }}>{t.subtask_name || '—'}</td>
                              <td style={{ padding: '0.65rem 0.85rem' }}>
                                <span style={{
                                  color: t.priority === 'HIGH' ? '#f87171' : t.priority === 'MEDIUM' ? '#fbbf24' : '#60a5fa',
                                  fontWeight: 600
                                }}>
                                  {t.priority}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>
                                {t.start_date} to {t.due_date}
                              </td>
                              <td style={{ padding: '0.65rem 0.85rem' }}>
                                <span style={{
                                  background: t.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : t.status === 'OVERDUE' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                  color: t.status === 'COMPLETED' ? '#34d399' : t.status === 'OVERDUE' ? '#f87171' : '#38bdf8',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  fontSize: '0.72rem'
                                }}>
                                  {t.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* AUDIT LOGS Section */}
                {selectedMemberDetail.audits?.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <History size={16} color="#94a3b8" />
                      <span>AUDIT TRAIL LOGS</span>
                    </h4>
                    <div style={{ background: '#0f172a', borderRadius: '8px', padding: '0.75rem 1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {selectedMemberDetail.audits.map(a => (
                        <div key={a.id} style={{ padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ fontWeight: 700, color: a.action === 'ADDED' ? '#34d399' : a.action === 'DEACTIVATED' ? '#f87171' : '#fbbf24' }}>
                              [{a.action}]
                            </span>{' '}
                            <span style={{ color: '#cbd5e1' }}>{a.remarks}</span>
                          </div>
                          <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                            By {a.changed_by_user_name} on {new Date(a.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Modal Footer */}
            <div style={{ background: '#0f172a', padding: '1rem 1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                style={{ background: '#334155', color: 'white', border: 'none', padding: '0.55rem 1.25rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
