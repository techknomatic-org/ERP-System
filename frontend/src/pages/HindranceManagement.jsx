import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ShieldAlert, AlertTriangle, CheckCircle, XCircle, Clock, FileText, Plus, RefreshCw, 
  Calendar, Layers, UserCheck, AlertOctagon, Eye, Lock, Filter, Search, Award
} from 'lucide-react';
import { hindranceService, projectService, wbsService, documentService } from '../services/api';

export default function HindranceManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProjectId = searchParams.get('project_id') || '';

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [selectedProject, setSelectedProject] = useState(null);

  const [wbsNodes, setWbsNodes] = useState([]);
  const [hindrances, setHindrances] = useState([]);
  const [eotBreakdown, setEotBreakdown] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [activeTab, setActiveTab] = useState('records'); // 'records', 'eot'
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedHindrance, setSelectedHindrance] = useState(null);

  // Form States
  const [raiseForm, setRaiseForm] = useState({
    hindrance_type: 'Land non-availability',
    date_occurred: new Date().toISOString().split('T')[0],
    delay_start_date: new Date().toISOString().split('T')[0],
    delay_end_date: new Date().toISOString().split('T')[0],
    description: '',
    wbs_node_id: '',
    evidence_file_name: '',
    evidence_file_type: '',
    evidence_file_size: 0,
    evidence_document_id: null
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [decisionForm, setDecisionForm] = useState({
    ee_decision: 'Accepted',
    ee_remarks: ''
  });

  const userRole = (localStorage.getItem('erp_role') || 'admin').toLowerCase();
  const isAuthorizedEE = ['admin', 'ee', 'tenant_admin', 'management'].includes(userRole);

  const hindranceTypes = [
    "Land non-availability",
    "Design pending",
    "Utility shifting",
    "Weather",
    "Force majeure",
    "Other"
  ];

  // 1. Fetch Projects on Mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // 2. When selectedProjectId changes, fetch data
  useEffect(() => {
    if (selectedProjectId) {
      setSearchParams({ project_id: selectedProjectId });
      const proj = projects.find(p => p.id.toString() === selectedProjectId.toString());
      setSelectedProject(proj || null);

      fetchHindrances(selectedProjectId);
      fetchWbsNodes(selectedProjectId);
      fetchEotBreakdown(selectedProjectId);
    }
  }, [selectedProjectId, projects]);

  const fetchProjects = async () => {
    try {
      const res = await projectService.getProjects();
      const list = Array.isArray(res.data) ? res.data : (res.data?.projects || []);
      setProjects(list);

      if (!selectedProjectId && list.length > 0) {
        // PREFER ACTIVE PROJECT over Closed project
        const activeProj = list.find(p => !p.status || p.status.toUpperCase() !== 'CLOSED');
        const defaultProj = activeProj || list[0];
        setSelectedProjectId(defaultProj.id.toString());
        setSelectedProject(defaultProj);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("Failed to load project list.");
    }
  };

  const fetchWbsNodes = async (projectId) => {
    try {
      const res = await wbsService.getProjectWbs(projectId);
      setWbsNodes(res.data || []);
    } catch (err) {
      console.error('Failed to fetch WBS nodes:', err);
      setWbsNodes([]);
    }
  };

  const fetchHindrances = async (projectId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await hindranceService.getHindrances({ project_id: projectId });
      setHindrances(res.data || []);
    } catch (err) {
      console.error("Failed to fetch hindrances:", err);
      const msg = err.response?.data?.detail || 'Failed to load project hindrances.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchEotBreakdown = async (projectId) => {
    try {
      const res = await hindranceService.getEotBreakdown(projectId);
      setEotBreakdown(res.data || null);
    } catch (err) {
      console.error('Failed to fetch EOT breakdown:', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', 'HindranceEvidence');
      formData.append('entity_id', selectedProjectId || 0);

      const res = await documentService.uploadDocument(formData);
      const doc = res.data;

      setRaiseForm(prev => ({
        ...prev,
        evidence_document_id: doc.id,
        evidence_file_name: doc.file_name || file.name,
        evidence_file_type: doc.file_type || file.type,
        evidence_file_size: doc.file_size || file.size
      }));
      setSuccessMsg(`Evidence attached: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (err) {
      const msg = err.response?.data?.detail || 'File upload failed';
      setUploadError(msg);
      setRaiseForm(prev => ({
        ...prev,
        evidence_file_name: file.name,
        evidence_file_type: file.type,
        evidence_file_size: file.size
      }));
    } finally {
      setUploading(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (selectedProject?.status?.toUpperCase() === 'CLOSED') {
      setError('Cannot create hindrance for a closed project.');
      return;
    }

    if (!raiseForm.wbs_node_id) {
      setError('Please select the affected WBS Node.');
      return;
    }

    if (!raiseForm.evidence_file_name && !raiseForm.evidence_document_id) {
      setError('Evidence is required.');
      return;
    }

    if (!raiseForm.description || raiseForm.description.trim().length < 20) {
      setError('Description must be at least 20 characters.');
      return;
    }

    try {
      const payload = {
        project_id: parseInt(selectedProjectId, 10),
        wbs_node_id: parseInt(raiseForm.wbs_node_id, 10),
        hindrance_type: raiseForm.hindrance_type,
        date_occurred: raiseForm.date_occurred,
        delay_start_date: raiseForm.delay_start_date || raiseForm.date_occurred,
        delay_end_date: raiseForm.delay_end_date || raiseForm.delay_start_date || raiseForm.date_occurred,
        description: raiseForm.description.trim(),
        evidence_document_id: raiseForm.evidence_document_id,
        evidence_file_name: raiseForm.evidence_file_name,
        evidence_file_type: raiseForm.evidence_file_type,
        evidence_file_size: raiseForm.evidence_file_size
      };

      const res = await hindranceService.createHindrance(payload);
      setSuccessMsg(`Hindrance #${res.data.id} created successfully! Raised timestamp: ${new Date(res.data.raised_at).toLocaleString()}`);
      setShowRaiseModal(false);

      setRaiseForm({
        hindrance_type: 'Land non-availability',
        date_occurred: new Date().toISOString().split('T')[0],
        delay_start_date: new Date().toISOString().split('T')[0],
        delay_end_date: new Date().toISOString().split('T')[0],
        description: '',
        wbs_node_id: '',
        evidence_file_name: '',
        evidence_file_type: '',
        evidence_file_size: 0,
        evidence_document_id: null
      });
      setSelectedFile(null);

      fetchHindrances(selectedProjectId);
      fetchEotBreakdown(selectedProjectId);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create hindrance.');
    }
  };

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHindrance) return;

    setError(null);
    setSuccessMsg(null);

    if (['Rejected', 'Info Requested'].includes(decisionForm.ee_decision) && !decisionForm.ee_remarks.trim()) {
      setError('EE Remarks are required for Rejected or Info Requested decisions.');
      return;
    }

    try {
      await hindranceService.submitEeDecision(selectedHindrance.id, {
        ee_decision: decisionForm.ee_decision,
        ee_remarks: decisionForm.ee_remarks.trim()
      });

      setSuccessMsg(`Decision '${decisionForm.ee_decision}' recorded for Hindrance #${selectedHindrance.id}.`);
      setShowDecisionModal(false);
      setSelectedHindrance(null);
      setDecisionForm({ ee_decision: 'Accepted', ee_remarks: '' });

      fetchHindrances(selectedProjectId);
      fetchEotBreakdown(selectedProjectId);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to record decision.');
    }
  };

  const handleRunSlaProcessor = async () => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await hindranceService.processSla();
      const data = res.data;
      setSuccessMsg(`SLA Engine Processed ${data.processed_hindrances} records: Reminders: ${data.day2_reminders_sent + data.day3_reminders_sent}, Escalations: ${data.day5_escalations}`);
      fetchHindrances(selectedProjectId);
      fetchEotBreakdown(selectedProjectId);
    } catch (err) {
      setError('Failed to trigger SLA worker process.');
    }
  };

  // KPI Calculations
  const metrics = useMemo(() => {
    const total = hindrances.length;
    const raised = hindrances.filter(h => h.current_status === 'RAISED').length;
    const accepted = hindrances.filter(h => h.current_status === 'ACCEPTED' || h.ee_decision === 'ACCEPTED').length;
    const rejected = hindrances.filter(h => h.current_status === 'REJECTED' || h.ee_decision === 'REJECTED').length;
    const infoReq = hindrances.filter(h => h.ee_decision === 'INFO_REQUESTED').length;
    const breached = hindrances.filter(h => h.sla_breached || h.current_status === 'SLA_BREACHED').length;
    const netEot = eotBreakdown ? eotBreakdown.net_eot_delay_days : 0;
    return { total, raised, accepted, rejected, infoReq, breached, netEot };
  }, [hindrances, eotBreakdown]);

  // Filtered Records
  const filteredHindrances = useMemo(() => {
    return hindrances.filter(h => {
      const matchesSearch = !searchQuery || 
        h.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (h.hindrance_type && h.hindrance_type.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (h.wbs_node_name && h.wbs_node_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        h.id.toString().includes(searchQuery);

      let matchesStatus = true;
      if (statusFilter === 'RAISED') matchesStatus = h.current_status === 'RAISED';
      else if (statusFilter === 'ACCEPTED') matchesStatus = h.current_status === 'ACCEPTED' || h.ee_decision === 'ACCEPTED';
      else if (statusFilter === 'REJECTED') matchesStatus = h.current_status === 'REJECTED' || h.ee_decision === 'REJECTED';
      else if (statusFilter === 'INFO_REQUESTED') matchesStatus = h.ee_decision === 'INFO_REQUESTED';
      else if (statusFilter === 'SLA_BREACHED') matchesStatus = h.sla_breached || h.current_status === 'SLA_BREACHED';

      return matchesSearch && matchesStatus;
    });
  }, [hindrances, searchQuery, statusFilter]);

  const isProjectClosed = selectedProject?.status?.toUpperCase() === 'CLOSED';

  const renderSlaBadge = (h) => {
    if (h.sla_breached || h.current_status === 'SLA_BREACHED') {
      return (
        <span style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <AlertTriangle size={12} /> SLA Breached / Escalated
        </span>
      );
    }
    if (h.day3_reminder_sent) {
      return (
        <span style={{ background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', color: '#fcd34d', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <Clock size={12} /> Day 3 Final Reminder
        </span>
      );
    }
    if (h.day2_reminder_sent) {
      return (
        <span style={{ background: 'rgba(234, 179, 8, 0.2)', border: '1px solid #eab308', color: '#fef08a', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <Clock size={12} /> Day 2 Reminder Sent
        </span>
      );
    }
    if (h.current_status === 'ACCEPTED') {
      return (
        <span style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#6ee7b7', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <CheckCircle size={12} /> Accepted
        </span>
      );
    }
    if (h.current_status === 'REJECTED') {
      return (
        <span style={{ background: 'rgba(244, 63, 94, 0.2)', border: '1px solid #f43f5e', color: '#fda4af', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <XCircle size={12} /> Rejected
        </span>
      );
    }
    return (
      <span style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', color: '#7dd3fc', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <Clock size={12} /> Within SLA
      </span>
    );
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto', color: '#f8fafc' }}>
      
      {/* Header Banner */}
      <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', backdropFilter: 'blur(10px)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldAlert size={26} color="#f59e0b" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>EXA-06 — Hindrance Logging & EE Decision</h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.3rem', margin: 0 }}>
            Log site delay obstructions, enforce 4-day SLA clock, authorize Executive Engineer decisions, and compute CPWD Interval Union EOT Net Delay.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          {/* Project Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.2rem' }}>Select Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc', padding: '0.5rem 0.85rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500, minWidth: '220px' }}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name} ({p.status})</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRunSlaProcessor}
            className="btn"
            style={{ marginTop: '1rem', background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', padding: '0.5rem 0.85rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            title="Trigger SLA Engine (Day 2/3 Reminders & Day 5 Escalations)"
          >
            <RefreshCw size={14} color="#f59e0b" /> Run SLA Worker
          </button>

          <button
            onClick={() => setShowRaiseModal(true)}
            disabled={isProjectClosed}
            className="btn btn-primary"
            style={{
              marginTop: '1rem',
              background: isProjectClosed ? '#475569' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none',
              color: '#0f172a',
              fontWeight: 700,
              padding: '0.55rem 1.25rem',
              borderRadius: '8px',
              cursor: isProjectClosed ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: isProjectClosed ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.3)'
            }}
            title={isProjectClosed ? "Cannot raise hindrance on closed project" : "Raise New Hindrance"}
          >
            {isProjectClosed ? <Lock size={16} /> : <Plus size={16} />} + Raise Hindrance
          </button>
        </div>
      </div>

      {/* Closed Project Warning Banner */}
      {isProjectClosed && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1.25rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>
          <Lock size={18} />
          <span>PROJECT CLOSED — Read-Only Mode. New hindrance logging is disabled for closed contracts.</span>
        </div>
      )}

      {/* Notifications */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <AlertOctagon size={16} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#6ee7b7', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metric Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1rem' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Total Hindrances</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>{metrics.total}</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '10px', padding: '1rem' }}>
          <span style={{ color: '#38bdf8', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Raised / Pending EE</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>{metrics.raised}</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', padding: '1rem' }}>
          <span style={{ color: '#34d399', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Accepted (EOT)</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>{metrics.accepted}</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '10px', padding: '1rem' }}>
          <span style={{ color: '#fda4af', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Rejected</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fda4af', marginTop: '0.2rem' }}>{metrics.rejected}</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '10px', padding: '1rem' }}>
          <span style={{ color: '#fcd34d', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Info Requested</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fcd34d', marginTop: '0.2rem' }}>{metrics.infoReq}</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', padding: '1rem' }}>
          <span style={{ color: '#fca5a5', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>SLA Breached</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fca5a5', marginTop: '0.2rem' }}>{metrics.breached}</div>
        </div>

        <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '10px', padding: '1rem' }}>
          <span style={{ color: '#fbbf24', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Net EOT Delay</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.2rem' }}>{metrics.netEot} Days</div>
        </div>
      </div>

      {/* Tabs Header */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('records')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'records' ? '3px solid #f59e0b' : '3px solid transparent',
            color: activeTab === 'records' ? '#f59e0b' : '#94a3b8',
            padding: '0.75rem 1.25rem',
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Layers size={16} /> Hindrance Management Table
        </button>
        <button
          onClick={() => setActiveTab('eot')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'eot' ? '3px solid #f59e0b' : '3px solid transparent',
            color: activeTab === 'eot' ? '#f59e0b' : '#94a3b8',
            padding: '0.75rem 1.25rem',
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Calendar size={16} /> EOT Net Delay & Interval Union Breakdown
        </button>
      </div>

      {/* TAB 1: Hindrance Table View */}
      {activeTab === 'records' && (
        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
          
          {/* Controls & Filters Bar */}
          <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyBetween: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginRight: '0.5rem' }}>Filter Status:</span>
              {['ALL', 'RAISED', 'ACCEPTED', 'REJECTED', 'INFO_REQUESTED', 'SLA_BREACHED'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    background: statusFilter === st ? '#f59e0b' : '#0f172a',
                    color: statusFilter === st ? '#0f172a' : '#cbd5e1',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    padding: '0.3rem 0.8rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search description, WBS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.4rem 0.75rem 0.4rem 2.2rem', color: '#f8fafc', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Responsive Table Container */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead style={{ background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700 }}>
                <tr>
                  <th style={{ padding: '0.85rem 1rem' }}>Hindrance ID</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Type</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Occurred Date</th>
                  <th style={{ padding: '0.85rem 1rem' }}>WBS Node</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Description</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Raised At (Server)</th>
                  <th style={{ padding: '0.85rem 1rem' }}>SLA Status</th>
                  <th style={{ padding: '0.85rem 1rem' }}>EE Decision</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
                {loading ? (
                  <tr>
                    <td colSpan="9" style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                      <RefreshCw size={20} className="spin" style={{ display: 'inline', marginRight: '0.5rem' }} /> Loading hindrances...
                    </td>
                  </tr>
                ) : filteredHindrances.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                      No hindrances recorded for this project.
                    </td>
                  </tr>
                ) : (
                  filteredHindrances.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 700 }}>#HND-{h.id}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#ffffff', fontWeight: 600 }}>{h.hindrance_type}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>{h.date_occurred}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.wbs_node_name || `WBS #${h.wbs_node_id}`}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#94a3b8', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.description}>{h.description}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.75rem' }}>{new Date(h.raised_at).toLocaleString()}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>{renderSlaBadge(h)}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {h.ee_decision ? (
                          <span style={{ fontWeight: 700, fontSize: '0.75rem', color: h.ee_decision === 'ACCEPTED' ? '#34d399' : h.ee_decision === 'REJECTED' ? '#fda4af' : '#fcd34d' }}>
                            {h.ee_decision}
                          </span>
                        ) : (
                          <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.75rem' }}>Pending EE</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => {
                              setSelectedHindrance(h);
                              setShowDetailModal(true);
                            }}
                            style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                          >
                            <Eye size={12} color="#38bdf8" /> Details
                          </button>

                          {!isProjectClosed && isAuthorizedEE && (
                            <button
                              onClick={() => {
                                setSelectedHindrance(h);
                                setShowDecisionModal(true);
                              }}
                              style={{ background: '#f59e0b', border: 'none', color: '#0f172a', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            >
                              <UserCheck size={12} /> EE Decision
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: EOT Interval Union Report */}
      {activeTab === 'eot' && eotBreakdown && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          
          {/* Summary Box */}
          <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={20} color="#f59e0b" /> CPWD Interval Union Delay Days Calculation ($\bigcup [start_i, end_i]$)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Accepted hindrances affecting the project are merged mathematically so overlapping delay periods are counted exactly once.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Total Accepted Hindrances</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff' }}>{eotBreakdown.total_accepted_hindrances}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Sum of Individual Durations</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#cbd5e1' }}>{eotBreakdown.individual_total_days} Days</div>
              </div>
              <div>
                <span style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 700 }}>Net EOT Delay Days (Union)</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24' }}>{eotBreakdown.net_eot_delay_days} Days</div>
              </div>
              <div>
                <span style={{ color: '#34d399', fontSize: '0.75rem', fontWeight: 700 }}>Overlap Days Saved</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>{eotBreakdown.overlap_days_saved} Days</div>
              </div>
            </div>
          </div>

          {/* Merged Non-Overlapping Intervals */}
          <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
              Merged Non-Overlapping EOT Union Delay Intervals
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead style={{ background: '#0f172a', color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                <tr>
                  <th style={{ padding: '0.75rem 1rem' }}>Union Interval #</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Start Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>End Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Merged Days</th>
                </tr>
              </thead>
              <tbody>
                {eotBreakdown.merged_intervals.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No accepted hindrances contributing to EOT delay.</td>
                  </tr>
                ) : (
                  eotBreakdown.merged_intervals.map((interval, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 700 }}>Interval #{idx + 1}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#ffffff' }}>{interval.start_date}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#ffffff' }}>{interval.end_date}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#fbbf24' }}>{interval.interval_days} Days</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Contributing Hindrances */}
          <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
              Individual Accepted Hindrance Breakdown
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead style={{ background: '#0f172a', color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                <tr>
                  <th style={{ padding: '0.75rem 1rem' }}>Hindrance ID</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                  <th style={{ padding: '0.75rem 1rem' }}>WBS Node</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Delay Start</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Delay End</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Individual Days</th>
                </tr>
              </thead>
              <tbody>
                {eotBreakdown.hindrances.map(h => (
                  <tr key={h.hindrance_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: '#fbbf24' }}>#HND-{h.hindrance_id}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#ffffff' }}>{h.hindrance_type}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{h.wbs_node_name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{h.delay_start_date}</td>
                    <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{h.delay_end_date}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#e2e8f0' }}>{h.individual_days} Days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Raise Hindrance Modal */}
      {showRaiseModal && (
        <div style={{ fixed: 'inset-0', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyCenter: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', maxWidth: '580px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={20} color="#f59e0b" /> Raise New Hindrance
            </h2>

            <form onSubmit={handleCreateSubmit} style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.3rem' }}>Hindrance Type *</label>
                <select
                  value={raiseForm.hindrance_type}
                  onChange={(e) => setRaiseForm({ ...raiseForm, hindrance_type: e.target.value })}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.5rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  required
                >
                  {hindranceTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.3rem' }}>Affected WBS Node *</label>
                <select
                  value={raiseForm.wbs_node_id}
                  onChange={(e) => setRaiseForm({ ...raiseForm, wbs_node_id: e.target.value })}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.5rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  required
                >
                  <option value="">-- Select WBS Node --</option>
                  {wbsNodes.map(w => (
                    <option key={w.id} value={w.id}>{w.wbs_code} - {w.title}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.3rem' }}>Date Occurred *</label>
                  <input
                    type="date"
                    value={raiseForm.date_occurred}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setRaiseForm({ ...raiseForm, date_occurred: e.target.value })}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.5rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.3rem' }}>Delay Start</label>
                  <input
                    type="date"
                    value={raiseForm.delay_start_date}
                    onChange={(e) => setRaiseForm({ ...raiseForm, delay_start_date: e.target.value })}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.5rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.3rem' }}>Delay End</label>
                  <input
                    type="date"
                    value={raiseForm.delay_end_date}
                    onChange={(e) => setRaiseForm({ ...raiseForm, delay_end_date: e.target.value })}
                    style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.5rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.3rem' }}>
                  Description (Min 20 characters) *
                  <span style={{ float: 'right', color: raiseForm.description.length >= 20 ? '#34d399' : '#f43f5e' }}>
                    {raiseForm.description.length}/20 chars
                  </span>
                </label>
                <textarea
                  rows="3"
                  placeholder="Comprehensive description of hindrance..."
                  value={raiseForm.description}
                  onChange={(e) => setRaiseForm({ ...raiseForm, description: e.target.value })}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.5rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.3rem' }}>Upload Evidence Document / Photo *</label>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  style={{ fontSize: '0.8rem', color: '#94a3b8' }}
                  required
                />
                {uploading && <span style={{ fontSize: '0.75rem', color: '#fbbf24', display: 'block', marginTop: '0.2rem' }}>Uploading evidence...</span>}
                {uploadError && <span style={{ fontSize: '0.75rem', color: '#fda4af', display: 'block', marginTop: '0.2rem' }}>{uploadError}</span>}
                {raiseForm.evidence_file_name && (
                  <span style={{ fontSize: '0.75rem', color: '#34d399', display: 'block', marginTop: '0.2rem' }}>
                    Attached: {raiseForm.evidence_file_name} ({(raiseForm.evidence_file_size / (1024*1024)).toFixed(2)} MB)
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyRight: 'flex-end', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRaiseModal(false)}
                  style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: '#0f172a', fontWeight: 700, padding: '0.5rem 1.25rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Submit Hindrance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EE Decision Modal */}
      {showDecisionModal && selectedHindrance && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', maxWidth: '520px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginTop: 0, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserCheck size={20} color="#f59e0b" /> Authorized Executive Engineer (EE) Decision
            </h2>

            <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem', display: 'grid', gap: '0.3rem', marginBottom: '1rem' }}>
              <div><span style={{ color: '#64748b' }}>Hindrance ID:</span> <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontWeight: 700 }}>#HND-{selectedHindrance.id}</span></div>
              <div><span style={{ color: '#64748b' }}>Type:</span> <span style={{ color: '#ffffff', fontWeight: 600 }}>{selectedHindrance.hindrance_type}</span></div>
              <div><span style={{ color: '#64748b' }}>WBS Node:</span> <span style={{ color: '#cbd5e1' }}>{selectedHindrance.wbs_node_name}</span></div>
              <div><span style={{ color: '#64748b' }}>Date Occurred:</span> <span style={{ color: '#cbd5e1' }}>{selectedHindrance.date_occurred}</span></div>
              <div><span style={{ color: '#64748b' }}>Raised At:</span> <span style={{ color: '#cbd5e1' }}>{new Date(selectedHindrance.raised_at).toLocaleString()}</span></div>
            </div>

            <form onSubmit={handleDecisionSubmit} style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>Select EE Decision *</label>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#0f172a', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="ee_decision"
                      value="Accepted"
                      checked={decisionForm.ee_decision === 'Accepted'}
                      onChange={(e) => setDecisionForm({ ...decisionForm, ee_decision: e.target.value })}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>Accepted</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#64748b' }}>Feeds EOT Delay</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#0f172a', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="ee_decision"
                      value="Rejected"
                      checked={decisionForm.ee_decision === 'Rejected'}
                      onChange={(e) => setDecisionForm({ ...decisionForm, ee_decision: e.target.value })}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fda4af' }}>Rejected</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#64748b' }}>Remarks Mandatory</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#0f172a', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="ee_decision"
                      value="Info Requested"
                      checked={decisionForm.ee_decision === 'Info Requested'}
                      onChange={(e) => setDecisionForm({ ...decisionForm, ee_decision: e.target.value })}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fcd34d' }}>Info Requested</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#64748b' }}>Reopens to Raiser</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.3rem' }}>
                  EE Remarks {['Rejected', 'Info Requested'].includes(decisionForm.ee_decision) ? '*' : '(Optional)'}
                </label>
                <textarea
                  rows="3"
                  placeholder="Provide engineering evaluation remarks..."
                  value={decisionForm.ee_remarks}
                  onChange={(e) => setDecisionForm({ ...decisionForm, ee_remarks: e.target.value })}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.5rem', color: '#f8fafc', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowDecisionModal(false)}
                  style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', color: '#0f172a', fontWeight: 700, padding: '0.5rem 1.25rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Submit Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Audit Trail & Details */}
      {showDetailModal && selectedHindrance && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', maxWidth: '640px', width: '100%', padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye size={18} color="#38bdf8" /> Hindrance #{selectedHindrance.id} Audit History
              </h2>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div><span style={{ color: '#64748b' }}>Type:</span> <span style={{ color: '#ffffff', fontWeight: 600 }}>{selectedHindrance.hindrance_type}</span></div>
                <div><span style={{ color: '#64748b' }}>Status:</span> <span style={{ color: '#fbbf24', fontWeight: 700 }}>{selectedHindrance.current_status}</span></div>
                <div><span style={{ color: '#64748b' }}>Occurred Date:</span> <span style={{ color: '#cbd5e1' }}>{selectedHindrance.date_occurred}</span></div>
                <div><span style={{ color: '#64748b' }}>Raised At:</span> <span style={{ color: '#cbd5e1' }}>{new Date(selectedHindrance.raised_at).toLocaleString()}</span></div>
                <div><span style={{ color: '#64748b' }}>SLA Due At:</span> <span style={{ color: '#cbd5e1' }}>{new Date(selectedHindrance.sla_due_at).toLocaleString()}</span></div>
                <div><span style={{ color: '#64748b' }}>Reopened Count:</span> <span style={{ color: '#cbd5e1' }}>{selectedHindrance.reopened_count}</span></div>
              </div>

              <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 700 }}>Historical Audit Events</h4>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {selectedHindrance.audits && selectedHindrance.audits.length > 0 ? (
                  selectedHindrance.audits.map(a => (
                    <div key={a.id} style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <Clock size={14} color="#f59e0b" style={{ marginTop: '0.1rem' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#ffffff' }}>
                          <span>{a.action}</span>
                          <span style={{ color: '#64748b', fontWeight: 400 }}>{new Date(a.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ color: '#94a3b8', marginTop: '0.2rem' }}>
                          Actor: <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{a.actor_name || `User #${a.actor_id || 'System'}`}</span> ({a.actor_role})
                        </div>
                        {a.remarks && <div style={{ color: '#fbbf24', fontStyle: 'italic', marginTop: '0.2rem' }}>"{a.remarks}"</div>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>No audit events logged.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
