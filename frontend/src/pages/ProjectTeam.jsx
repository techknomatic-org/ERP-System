import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Plus, Search, Filter, ShieldCheck, HardHat, Building2, UserCheck, 
  Eye, Edit, Trash2, Power, AlertCircle, CheckCircle, Clock, Calendar, Briefcase, 
  Layers, ArrowUpRight, History, FileText, Check, X, RefreshCw, UserPlus, Send, AlertTriangle
} from 'lucide-react';
import { projectService, projectTeamService } from '../services/api';

const CONTROLLED_ROLES = [
  "Contractor PM",
  "JE",
  "AE",
  "EE",
  "Divisional Accountant",
  "Tenant Admin"
];

const CONTROLLED_DEPARTMENTS = [
  "Project Management",
  "Execution",
  "Planning",
  "Quality",
  "Safety",
  "Procurement",
  "Finance",
  "Engineering"
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

  // Reassignment Modal State
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [pendingApprovalsList, setPendingApprovalsList] = useState([]);
  const [memberToReassign, setMemberToReassign] = useState(null);
  const [replacementUserId, setReplacementUserId] = useState('');
  const [reassignActionPending, setReassignActionPending] = useState(null); // { type: 'toggle' | 'remove', member }
  const [reassignLoading, setReassignLoading] = useState(false);

  // Invite Modal / Subform State
  const [showInviteSection, setShowInviteSection] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('Contractor PM');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    project_id: '',
    user_id: '',
    project_role: 'Contractor PM',
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    department: 'Execution',
    responsibility: '',
    status: 'ACTIVE',
    remarks: ''
  });

  const [formErrors, setFormErrors] = useState({});

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
        const defaultProj = projList.find(p => (p.name || '').includes('Greenfield')) || projList[0];
        setSelectedProjectId(defaultProj.id.toString());
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

  // Eligible replacement members for reassignment
  const eligibleReplacementMembers = useMemo(() => {
    if (!memberToReassign) return [];
    return (teamData.members || []).filter(m => 
      m.id !== memberToReassign.id && 
      m.user_id !== memberToReassign.user_id && 
      m.status === 'ACTIVE'
    );
  }, [teamData.members, memberToReassign]);

  // Open Form Modal (Add / Edit)
  const handleOpenFormModal = (memberToEdit = null) => {
    setFormErrors({});
    setError(null);
    setShowInviteSection(false);
    setInviteMessage(null);

    if (memberToEdit) {
      setEditingMemberId(memberToEdit.id);
      setFormData({
        project_id: memberToEdit.project_id.toString(),
        user_id: memberToEdit.user_id.toString(),
        project_role: memberToEdit.project_role || 'Contractor PM',
        effective_from: memberToEdit.effective_from ? memberToEdit.effective_from.split('T')[0] : (memberToEdit.joining_date ? memberToEdit.joining_date.split('T')[0] : new Date().toISOString().split('T')[0]),
        effective_to: memberToEdit.effective_to ? memberToEdit.effective_to.split('T')[0] : '',
        department: memberToEdit.department || 'Execution',
        responsibility: memberToEdit.responsibility || '',
        status: memberToEdit.status || 'ACTIVE',
        remarks: memberToEdit.remarks || ''
      });
    } else {
      setEditingMemberId(null);
      const existingUserIds = (teamData.members || []).map(m => m.user_id);
      const defaultUser = eligibleUsers.find(u => !existingUserIds.includes(u.id)) || eligibleUsers[0];

      setFormData({
        project_id: selectedProjectId.toString(),
        user_id: defaultUser ? defaultUser.id.toString() : '',
        project_role: 'Contractor PM',
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: '',
        department: 'Execution',
        responsibility: '',
        status: 'ACTIVE',
        remarks: ''
      });
    }
    setIsFormModalOpen(true);
  };

  // Form Validation with exact WPT-04 requirement strings
  const validateForm = () => {
    const errs = {};
    if (!formData.project_role || !formData.project_role.trim()) {
      errs.project_role = "Role is required.";
    }
    if (!formData.user_id) {
      errs.user_id = "User is required.";
    }
    if (!formData.effective_from) {
      errs.effective_from = "Effective From is required.";
    }
    if (formData.effective_to && formData.effective_from && formData.effective_to < formData.effective_from) {
      errs.effective_to = "Effective To cannot be before Effective From.";
    }
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError(Object.values(errs)[0]);
      return false;
    }
    return true;
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
        effective_from: formData.effective_from,
        effective_to: formData.effective_to ? formData.effective_to : null,
        joining_date: formData.effective_from,
        department: formData.department || null,
        responsibility: formData.responsibility || null,
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
      const detail = err.response?.data?.detail;
      setError(detail || "Failed to save project team member.");
    }
  };

  // Handle Invite New User
  const handleInviteUser = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      setError("Email is required for invitation.");
      return;
    }
    setInviteSubmitting(true);
    setInviteMessage(null);
    setError(null);
    try {
      const res = await projectTeamService.inviteUser({
        project_id: parseInt(selectedProjectId, 10),
        email: inviteEmail.trim(),
        full_name: inviteName.trim() || inviteEmail.split('@')[0],
        role: inviteRole
      });

      setInviteMessage({ type: 'success', text: res.data?.message || "Invitation sent / user registered successfully." });
      
      // Refresh eligible users list
      const uRes = await projectTeamService.getEligibleUsers();
      setEligibleUsers(uRes.data || []);
      
      if (res.data?.user_id) {
        setFormData(prev => ({ ...prev, user_id: res.data.user_id.toString(), project_role: inviteRole }));
      }
      setShowInviteSection(false);
      setInviteEmail('');
      setInviteName('');
    } catch (err) {
      console.error("Error inviting user:", err);
      const detail = err.response?.data?.detail;
      setInviteMessage({ type: 'error', text: detail || "Failed to invite user." });
    } finally {
      setInviteSubmitting(false);
    }
  };

  // Toggle Member Status (ACTIVE / INACTIVE) with Pending Approval Check
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
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string' && detail.includes("Reassign pending approvals first")) {
        try {
          const appRes = await projectTeamService.getPendingApprovals(member.id);
          setPendingApprovalsList(appRes.data || []);
          setMemberToReassign(member);
          setReassignActionPending({ type: 'toggle', member });
          setReplacementUserId('');
          setIsReassignModalOpen(true);
          return;
        } catch (e) {
          console.error("Failed to load pending approvals:", e);
        }
      }
      setError(detail || "Failed to change member status.");
    }
  };

  // Remove Member with Pending Approval Check
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
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string' && detail.includes("Reassign pending approvals first")) {
        try {
          const appRes = await projectTeamService.getPendingApprovals(member.id);
          setPendingApprovalsList(appRes.data || []);
          setMemberToReassign(member);
          setReassignActionPending({ type: 'remove', member });
          setReplacementUserId('');
          setIsReassignModalOpen(true);
          return;
        } catch (e) {
          console.error("Failed to load pending approvals:", e);
        }
      }
      setError(detail || "Failed to remove project team member.");
    }
  };

  // Execute Reassignment & Proceed with Pending Action
  const handleExecuteReassignment = async (e) => {
    e.preventDefault();
    if (!replacementUserId) {
      setError("Please select an active replacement team member.");
      return;
    }
    setReassignLoading(true);
    setError(null);
    try {
      await projectTeamService.reassignApprovals({
        project_id: parseInt(selectedProjectId, 10),
        from_user_id: memberToReassign.user_id,
        to_user_id: parseInt(replacementUserId, 10),
        role: memberToReassign.project_role
      });

      // Now complete the pending action
      if (reassignActionPending?.type === 'remove') {
        await projectTeamService.removeTeamMember(memberToReassign.id);
        setSuccessMsg(`Approvals reassigned and member '${memberToReassign.user_name}' removed successfully.`);
      } else if (reassignActionPending?.type === 'toggle') {
        await projectTeamService.toggleMemberStatus(memberToReassign.id);
        setSuccessMsg(`Approvals reassigned and member '${memberToReassign.user_name}' status updated.`);
      }

      setIsReassignModalOpen(false);
      setMemberToReassign(null);
      setReassignActionPending(null);
      fetchTeamForProject(selectedProjectId);
    } catch (err) {
      console.error("Error executing reassignment:", err);
      const detail = err.response?.data?.detail;
      setError(detail || "Failed to reassign pending approvals.");
    } finally {
      setReassignLoading(false);
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

  const previewAccessStatus = useMemo(() => {
    if (formData.status !== 'ACTIVE') return 'INACTIVE';
    if (!formData.effective_from) return 'NOT YET ACTIVE';
    const todayStr = new Date().toISOString().split('T')[0];
    if (formData.effective_from > todayStr) return 'NOT YET ACTIVE';
    if (formData.effective_to && formData.effective_to < todayStr) return 'EXPIRED';
    if (currentProject && ['CLOSED', 'COMPLETED'].includes((currentProject.status || '').toUpperCase())) return 'REVOKED / INACTIVE';
    return 'ACTIVE';
  }, [formData.status, formData.effective_from, formData.effective_to, currentProject]);

  const summary = teamData.summary || {};

  const getAccessBadgeStyle = (status) => {
    switch (status) {
      case 'ACTIVE':
        return { background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' };
      case 'NOT YET ACTIVE':
      case 'UPCOMING':
        return { background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' };
      case 'EXPIRED':
        return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' };
      case 'REVOKED / INACTIVE':
      case 'REVOKED - PROJECT CLOSED':
        return { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' };
      default:
        return { background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.3)' };
    }
  };

  return (
    <div className="page-container" style={{ padding: '1.5rem', background: '#0f172a', color: '#f8fafc', minHeight: '100vh' }}>
      
      {/* Top Header & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Briefcase size={14} color="#38bdf8" />
            <span>Planning & Execution</span>
            <span>/</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Project Team Setup</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            Project Team Setup (WPT-04)
          </h1>
          <p style={{ margin: '0.3rem 0 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>
            Configure project governance team, roles, date access windows, and gate readiness.
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
          <span>+ Assign Team Member</span>
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
      <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Building2 size={20} color="#38bdf8" />
          <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap' }}>
            Project:
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
                {p.name} ({p.code || `PRJ-${p.id}`}) [{p.status || 'DRAFT'}]
              </option>
            ))
          )}
        </select>

        {currentProject && (
          <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
            <span>Status: <strong style={{ color: currentProject.status === 'ACTIVE' ? '#34d399' : '#38bdf8' }}>{currentProject.status || 'DRAFT'}</strong></span>
            {currentProject.start_date && (
              <span>Start: <strong style={{ color: '#e2e8f0' }}>{currentProject.start_date.split('T')[0]}</strong></span>
            )}
          </div>
        )}
      </div>

      {/* Summary KPI Cards & Draft Gate Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        
        {/* Total Members */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} color="#6366f1" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Total Members</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', marginTop: '0.1rem' }}>
              {loading ? '...' : (summary.total_members ?? 0)}
            </div>
          </div>
        </div>

        {/* Effective Active Members */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCheck size={22} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Active In Window</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981', marginTop: '0.1rem' }}>
              {loading ? '...' : (summary.effective_active_members ?? summary.active_members ?? 0)}
            </div>
          </div>
        </div>

        {/* Contractor PM Gate */}
        <div style={{ background: '#1e293b', border: `1px solid ${summary.has_contractor_pm ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, borderRadius: '12px', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: summary.has_contractor_pm ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Briefcase size={22} color={summary.has_contractor_pm ? '#10b981' : '#ef4444'} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Contractor PM Gate</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: summary.has_contractor_pm ? '#34d399' : '#f87171', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {summary.has_contractor_pm ? <Check size={16} /> : <AlertTriangle size={16} />}
              <span>{summary.has_contractor_pm ? "Ready / Active" : "Missing / Inactive"}</span>
            </div>
          </div>
        </div>

        {/* Executive Engineer (EE) Gate */}
        <div style={{ background: '#1e293b', border: `1px solid ${summary.has_ee ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, borderRadius: '12px', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: summary.has_ee ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HardHat size={22} color={summary.has_ee ? '#10b981' : '#ef4444'} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>EE (Exec. Eng.) Gate</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: summary.has_ee ? '#34d399' : '#f87171', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {summary.has_ee ? <Check size={16} /> : <AlertTriangle size={16} />}
              <span>{summary.has_ee ? "Ready / Active" : "Missing / Inactive"}</span>
            </div>
          </div>
        </div>

        {/* Draft -> Active Gate Readiness */}
        <div style={{ background: '#1e293b', border: `1px solid ${summary.is_draft_gate_ready ? 'rgba(56, 189, 248, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`, borderRadius: '12px', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: summary.is_draft_gate_ready ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={22} color={summary.is_draft_gate_ready ? '#38bdf8' : '#f59e0b'} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Activation Gate</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: summary.is_draft_gate_ready ? '#38bdf8' : '#fbbf24', marginTop: '0.2rem' }}>
              {summary.is_draft_gate_ready ? "Gate Passed (Ready)" : "Requires PM & EE"}
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
              placeholder="Search member name, email, project role..."
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
              + Assign First Team Member
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>Member</th>
                <th style={{ padding: '0.85rem 1rem' }}>Project Role</th>
                <th style={{ padding: '0.85rem 1rem' }}>Effective From</th>
                <th style={{ padding: '0.85rem 1rem' }}>Effective To</th>
                <th style={{ padding: '0.85rem 1rem' }}>Access Status</th>
                <th style={{ padding: '0.85rem 1rem' }}>Assignment Status</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => {
                const isActive = m.status === 'ACTIVE';
                const accessStatus = m.access_status || (isActive ? 'ACTIVE' : 'INACTIVE');
                const badgeStyle = getAccessBadgeStyle(accessStatus);

                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', transition: 'background 0.15s' }}>
                    
                    {/* Member Name & Email */}
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>{m.user_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{m.user_email}</div>
                    </td>

                    {/* Project Role */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        background: m.project_role === 'Contractor PM' ? 'rgba(245, 158, 11, 0.15)' :
                                   m.project_role === 'EE' ? 'rgba(56, 189, 248, 0.15)' :
                                   m.project_role === 'Tenant Admin' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                        border: m.project_role === 'Contractor PM' ? '1px solid rgba(245, 158, 11, 0.3)' :
                                m.project_role === 'EE' ? '1px solid rgba(56, 189, 248, 0.3)' :
                                m.project_role === 'Tenant Admin' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)',
                        color: m.project_role === 'Contractor PM' ? '#fcd34d' :
                               m.project_role === 'EE' ? '#38bdf8' :
                               m.project_role === 'Tenant Admin' ? '#c084fc' : '#818cf8',
                        fontWeight: 600,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem'
                      }}>
                        {m.project_role}
                      </span>
                    </td>

                    {/* Effective From */}
                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                      {m.effective_from ? m.effective_from.split('T')[0] : (m.joining_date ? m.joining_date.split('T')[0] : '—')}
                    </td>

                    {/* Effective To */}
                    <td style={{ padding: '0.85rem 1rem', color: m.effective_to ? '#cbd5e1' : '#94a3b8' }}>
                      {m.effective_to ? m.effective_to.split('T')[0] : 'Indefinite'}
                    </td>

                    {/* Access Status (WPT-04 Window Based) */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        ...badgeStyle,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: badgeStyle.color }} />
                        {accessStatus}
                      </span>
                    </td>

                    {/* Assignment Status */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        background: isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                        color: isActive ? '#34d399' : '#94a3b8',
                        border: isActive ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(148, 163, 184, 0.25)',
                        padding: '0.18rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: '0.72rem'
                      }}>
                        {m.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <button
                          onClick={() => handleOpenDetailModal(m.id)}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#38bdf8', padding: '0.35rem', borderRadius: '6px', cursor: 'pointer' }}
                          title="View Details"
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
          <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '14px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            
            {/* Modal Header */}
            <div style={{ background: '#0f172a', padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserCheck size={20} color="#6366f1" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
                  {editingMemberId ? "Edit Project Team Member" : "Assign Team Member to Project"}
                </h3>
              </div>
              <button onClick={() => setIsFormModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSubmitForm} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              {/* Grid 2 Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                
                {/* Project (Readonly / Display) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Project <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={formData.project_id}
                    disabled={true}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#94a3b8', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Project Role (Controlled: Contractor PM, JE, AE, EE, Divisional Accountant, Tenant Admin) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Project Role <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={formData.project_role}
                    onChange={(e) => setFormData({ ...formData, project_role: e.target.value })}
                    style={{ width: '100%', background: '#0f172a', border: formErrors.project_role ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    {CONTROLLED_ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {formErrors.project_role && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.2rem' }}>{formErrors.project_role}</div>}
                </div>

              </div>

              {/* User Selection & Invite Option */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
                    User / Global Identity <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {!editingMemberId && (
                    <button
                      type="button"
                      onClick={() => setShowInviteSection(!showInviteSection)}
                      style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'underline' }}
                    >
                      <UserPlus size={13} />
                      <span>{showInviteSection ? "Select Existing User" : "+ Invite Unregistered User"}</span>
                    </button>
                  )}
                </div>

                {!showInviteSection ? (
                  <>
                    <select
                      value={formData.user_id}
                      disabled={!!editingMemberId}
                      onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                      style={{ width: '100%', background: '#0f172a', border: formErrors.user_id ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}
                    >
                      <option value="">Select User...</option>
                      {eligibleUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.email}) [{formatAppRole(u.role)}]
                        </option>
                      ))}
                    </select>
                    {formErrors.user_id && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.2rem' }}>{formErrors.user_id}</div>}
                  </>
                ) : (
                  <div style={{ background: '#0f172a', border: '1px dashed rgba(56, 189, 248, 0.4)', borderRadius: '8px', padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>
                      Invite New User (Global Identity / Unregistered)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <input
                        type="email"
                        placeholder="Email Address (e.g. user@example.com)"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.45rem 0.65rem', borderRadius: '6px', fontSize: '0.8rem' }}
                      />
                      <input
                        type="text"
                        placeholder="Full Name (optional)"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.45rem 0.65rem', borderRadius: '6px', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={handleInviteUser}
                        disabled={inviteSubmitting}
                        style={{ background: '#0284c7', color: 'white', border: 'none', padding: '0.4rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <Send size={13} />
                        <span>{inviteSubmitting ? "Inviting..." : "Send Invite & Select"}</span>
                      </button>
                    </div>
                    {inviteMessage && (
                      <div style={{ fontSize: '0.75rem', color: inviteMessage.type === 'success' ? '#34d399' : '#f87171' }}>
                        {inviteMessage.text}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Effective From and Effective To Window */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                
                {/* Effective From (Mandatory) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Effective From <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.effective_from}
                    onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                    style={{ width: '100%', background: '#0f172a', border: formErrors.effective_from ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                  {formErrors.effective_from && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.2rem' }}>{formErrors.effective_from}</div>}
                </div>

                {/* Effective To (Optional; Open-ended if blank) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
                      Effective To
                    </label>
                    {formData.effective_to && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, effective_to: '' })}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Clear (Indefinite)
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={formData.effective_to}
                    placeholder="Indefinite if blank"
                    onChange={(e) => setFormData({ ...formData, effective_to: e.target.value })}
                    style={{ width: '100%', background: '#0f172a', border: formErrors.effective_to ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                  {formErrors.effective_to && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.2rem' }}>{formErrors.effective_to}</div>}
                </div>

              </div>

              {/* Department & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Assignment Status (Admin)
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

              {/* Derived Access Status Live Preview */}
              <div style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1' }}>Derived Project Access Status:</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Computed server-side from Effective Dates, Assignment Status, and Project state</div>
                </div>
                <span style={{
                  ...getAccessBadgeStyle(previewAccessStatus),
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: getAccessBadgeStyle(previewAccessStatus).color }} />
                  {previewAccessStatus}
                </span>
              </div>

              {/* Responsibility */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Responsibility / Scope
                </label>
                <input
                  type="text"
                  placeholder="e.g. Overall project execution, Technical sanctioning, Measurement approvals..."
                  value={formData.responsibility}
                  onChange={(e) => setFormData({ ...formData, responsibility: e.target.value })}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', padding: '0.55rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem' }}
                />
              </div>

              {/* Remarks */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Remarks / Assignment Notes
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
      {/* MODAL 2: REASSIGN PENDING APPROVALS MODAL                */}
      {/* ========================================================= */}
      {isReassignModalOpen && memberToReassign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '14px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            
            {/* Modal Header */}
            <div style={{ background: '#0f172a', padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <AlertCircle size={22} color="#ef4444" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
                    Reassign pending approvals first
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>
                    Member cannot be {reassignActionPending?.type === 'remove' ? 'removed' : 'deactivated'} while pending approvals exist.
                  </div>
                </div>
              </div>
              <button onClick={() => setIsReassignModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '0.9rem', color: '#fca5a5', fontSize: '0.85rem' }}>
                <strong>{memberToReassign.user_name}</strong> ({memberToReassign.project_role}) is currently assigned to <strong>{pendingApprovalsList.length} pending approval request(s)</strong>. Select an eligible active team member on this project to transfer pending approvals before proceeding.
              </div>

              {/* Pending Approvals List */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Pending Approval Items:
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px' }}>
                  {pendingApprovalsList.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>No pending items found.</div>
                  ) : (
                    pendingApprovalsList.map((item, idx) => (
                      <div key={idx} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>{item.title}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Type: {item.type} | Ref: {item.reference_id}</div>
                        </div>
                        {item.amount && (
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#34d399' }}>
                            ₹{Number(item.amount).toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Reassignment Selector Form */}
              <form onSubmit={handleExecuteReassignment}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Transfer Approvals To Active Team Member: <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={replacementUserId}
                  onChange={(e) => setReplacementUserId(e.target.value)}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', padding: '0.6rem 0.85rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1.2rem' }}
                >
                  <option value="">Select Replacement Member...</option>
                  {eligibleReplacementMembers.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user_name} ({m.project_role})
                    </option>
                  ))}
                </select>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <button
                    type="button"
                    onClick={() => setIsReassignModalOpen(false)}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reassignLoading || !replacementUserId}
                    style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none', padding: '0.6rem 1.4rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, opacity: (!replacementUserId || reassignLoading) ? 0.6 : 1 }}
                  >
                    {reassignLoading ? "Reassigning..." : "Reassign & Proceed"}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: TEAM MEMBER DETAIL MODAL                         */}
      {/* ========================================================= */}
      {isDetailModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '14px', width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            
            {/* Modal Header */}
            <div style={{ background: '#0f172a', padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Eye size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
                  Project Team Member Profile
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
                <div>Fetching member detail...</div>
              </div>
            ) : (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                
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
                    <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Effective Window</div>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                      {selectedMemberDetail.effective_from ? selectedMemberDetail.effective_from.split('T')[0] : '—'} to {selectedMemberDetail.effective_to ? selectedMemberDetail.effective_to.split('T')[0] : 'Indefinite'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Department</div>
                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.2rem' }}>{selectedMemberDetail.department || '—'}</div>
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
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.3rem' }}>Responsibility / Scope</div>
                    <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', color: '#e2e8f0', fontSize: '0.85rem' }}>
                      {selectedMemberDetail.responsibility}
                    </div>
                  </div>
                )}

                {selectedMemberDetail.remarks && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.3rem' }}>Remarks</div>
                    <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', color: '#94a3b8', fontSize: '0.85rem' }}>
                      {selectedMemberDetail.remarks}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
