import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  HardHat, Plus, Calendar, MapPin, ArrowRight, Settings, 
  Building2, AlertTriangle, CheckCircle, Info, ShieldAlert, Layers
} from 'lucide-react';
import { projectService, customerService, authService } from '../services/api';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDivisionModal, setShowDivisionModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [userRole, setUserRole] = useState(localStorage.getItem('erp_role') || 'admin');

  // Master lists
  const [divisions, setDivisions] = useState([]);
  const [allDivisions, setAllDivisions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [tenantSettings, setTenantSettings] = useState({
    is_p2_enabled: false,
    is_funding_mode_enabled: false
  });

  // Division Form State
  const [newDivName, setNewDivName] = useState('');
  const [newDivCode, setNewDivCode] = useState('');
  const [divError, setDivError] = useState('');

  // Project Creation Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    tenant_name: 'Default Tenant',
    division_id: '',
    contract_type: 'Item Rate',
    funding_mode: 'Budgeted',
    client_id: '',
    manager_id: '',
    location: '',
    latitude: '',
    longitude: '',
    start_date: '',
    end_date: '',
    budget: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [formWarnings, setFormWarnings] = useState({});
  const [submitError, setSubmitError] = useState('');

  const loadInitialData = () => {
    setLoading(true);
    const storedRole = localStorage.getItem('erp_role');
    if (storedRole) setUserRole(storedRole);

    Promise.all([
      projectService.getProjects(),
      projectService.getDivisions(true),
      projectService.getDivisions(false),
      projectService.getTenantSettings(),
      customerService.getCustomers().catch(() => ({ data: [] })),
      authService.getUsers().catch(() => ({ data: [] }))
    ])
      .then(([projRes, activeDivRes, allDivRes, settingsRes, custRes, userRes]) => {
        setProjects(projRes.data || []);
        setDivisions(activeDivRes.data || []);
        setAllDivisions(allDivRes.data || []);
        if (settingsRes.data) {
          setTenantSettings({
            is_p2_enabled: settingsRes.data.is_p2_enabled,
            is_funding_mode_enabled: settingsRes.data.is_funding_mode_enabled
          });
        }
        setCustomers(custRes.data || []);
        setUsers(userRes.data || []);
      })
      .catch((err) => console.error("Error loading project setup data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Calculate Duration in Days automatically
  const calculateDurationDays = (start, end) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    const diffMs = e.getTime() - s.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Real-time Validation Engine
  const validateField = (field, value, currentFormData = formData) => {
    const errors = { ...formErrors };
    const warnings = { ...formWarnings };

    if (field === 'name') {
      if (!value.trim()) {
        errors.name = "Project / Contract Name is required.";
      } else if (value.trim().length > 120) {
        errors.name = "Project Name cannot exceed 120 characters.";
      } else {
        // Case-insensitive duplicate name check within tenant
        const isDuplicate = projects.some(
          p => p.name.trim().toLowerCase() === value.trim().toLowerCase()
        );
        if (isDuplicate) {
          errors.name = "A project with this name already exists in your organization.";
        } else {
          delete errors.name;
        }
      }
    }

    if (field === 'budget') {
      const valNum = parseFloat(value);
      if (value !== '' && (isNaN(valNum) || valNum <= 0)) {
        errors.budget = "Estimated Contract Value must be greater than 0.";
      } else {
        delete errors.budget;
      }
    }

    if (field === 'start_date' || field === 'end_date') {
      const startDateVal = field === 'start_date' ? value : currentFormData.start_date;
      const endDateVal = field === 'end_date' ? value : currentFormData.end_date;

      // Start Date past warning check
      if (startDateVal) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sDate = new Date(startDateVal);
        sDate.setHours(0, 0, 0, 0);
        if (sDate < today) {
          warnings.start_date = "Note: Start Date is in the past. (Allowed for backdating)";
        } else {
          delete warnings.start_date;
        }
      }

      // Scheduled Completion Date check
      if (startDateVal && endDateVal) {
        if (new Date(endDateVal) <= new Date(startDateVal)) {
          errors.end_date = "Scheduled Completion Date must be after Start Date.";
        } else {
          delete errors.end_date;
        }
      }
    }

    setFormErrors(errors);
    setFormWarnings(warnings);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    setFormData(updated);
    validateField(name, value, updated);
  };

  const handleCreateProjectSubmit = (e) => {
    e.preventDefault();
    setSubmitError('');

    // Pre-submit Checks
    const nameClean = formData.name.trim();
    if (!nameClean) {
      setFormErrors(prev => ({ ...prev, name: "Project / Contract Name is required." }));
      return;
    }
    if (nameClean.length > 120) {
      setFormErrors(prev => ({ ...prev, name: "Project Name cannot exceed 120 characters." }));
      return;
    }

    // Case-insensitive uniqueness check
    const isDuplicate = projects.some(
      p => p.name.trim().toLowerCase() === nameClean.toLowerCase()
    );
    if (isDuplicate) {
      setFormErrors(prev => ({ ...prev, name: "A project with this name already exists in your organization." }));
      return;
    }

    if (parseFloat(formData.budget) <= 0 || isNaN(parseFloat(formData.budget))) {
      setFormErrors(prev => ({ ...prev, budget: "Estimated Contract Value must be greater than 0." }));
      return;
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      setFormErrors(prev => ({ ...prev, end_date: "Scheduled Completion Date must be after Start Date." }));
      return;
    }

    const payload = {
      name: nameClean,
      code: formData.code.trim(),
      tenant_name: formData.tenant_name,
      division_id: formData.division_id ? parseInt(formData.division_id) : null,
      contract_type: formData.contract_type,
      funding_mode: tenantSettings.is_funding_mode_enabled ? formData.funding_mode : 'Budgeted',
      client_id: formData.client_id ? parseInt(formData.client_id) : null,
      manager_id: formData.manager_id ? parseInt(formData.manager_id) : null,
      location: formData.location.trim(),
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString(),
      budget: parseFloat(formData.budget),
      status: 'DRAFT'
    };

    projectService.createProject(payload)
      .then(() => {
        setShowModal(false);
        setFormData({
          name: '', code: '', tenant_name: 'Default Tenant', division_id: '',
          contract_type: 'Item Rate', funding_mode: 'Budgeted', client_id: '',
          manager_id: '', location: '', latitude: '', longitude: '',
          start_date: '', end_date: '', budget: ''
        });
        setFormErrors({});
        setFormWarnings({});
        loadInitialData();
      })
      .catch((err) => {
        const msg = err.response?.data?.detail || "Failed to register construction project.";
        setSubmitError(msg);
      });
  };

  // Division Handlers
  const handleAddDivision = (e) => {
    e.preventDefault();
    setDivError('');
    if (!newDivName.trim() || !newDivCode.trim()) {
      setDivError("Division Name and Code are required.");
      return;
    }
    projectService.createDivision({ name: newDivName.trim(), code: newDivCode.trim() })
      .then(() => {
        setNewDivName('');
        setNewDivCode('');
        loadInitialData();
      })
      .catch(err => setDivError(err.response?.data?.detail || "Failed to add division."));
  };

  const handleToggleDivision = (divId, currentActive) => {
    projectService.toggleDivisionActive(divId, !currentActive)
      .then(() => loadInitialData())
      .catch(err => alert("Failed to toggle division status."));
  };

  // Tenant Settings Handler
  const handleToggleP2 = () => {
    const updated = !tenantSettings.is_p2_enabled;
    projectService.updateTenantSettings({ is_p2_enabled: updated })
      .then(res => {
        setTenantSettings(prev => ({ ...prev, is_p2_enabled: res.data.is_p2_enabled }));
      })
      .catch(err => alert("Failed to update feature flags."));
  };

  const handleToggleFundingMode = () => {
    const updated = !tenantSettings.is_funding_mode_enabled;
    projectService.updateTenantSettings({ is_funding_mode_enabled: updated })
      .then(res => {
        setTenantSettings(prev => ({ ...prev, is_funding_mode_enabled: res.data.is_funding_mode_enabled }));
      })
      .catch(err => alert("Failed to update feature flags."));
  };

  const isSE = (userRole || '').toLowerCase() === 'site_engineer';
  const durationCalculated = calculateDurationDays(formData.start_date, formData.end_date);

  return (
    <div className="content-page">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">{isSE ? "My Sites" : "Construction Projects"}</h1>
          <p className="page-subtitle">
            {isSE ? "View and execute your assigned construction sites" : "PSC-01 Enterprise Project & Contract Management System"}
          </p>
        </div>
        
        {!isSE && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => setShowSettingsModal(true)}
              title="Configure Feature Flags & Settings"
            >
              <Settings size={16} /> Feature Flags
            </button>
            <button 
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => setShowDivisionModal(true)}
              title="Manage Tenant Divisions / Circles"
            >
              <Building2 size={16} /> Divisions / Circles
            </button>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18} /> New Construction Project
            </button>
          </div>
        )}
      </div>

      {/* Feature Flags Active Status Bar */}
      <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', color: '#cbd5e1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <span style={{ fontWeight: 600, color: '#f8fafc' }}>Tenant Config:</span>
          <span>
            P2 (Percentage Rate / EPC):{' '}
            <strong style={{ color: tenantSettings.is_p2_enabled ? '#10b981' : '#f59e0b' }}>
              {tenantSettings.is_p2_enabled ? 'ENABLED' : 'DISABLED (Item Rate Default Only)'}
            </strong>
          </span>
          <span>
            Funding Mode Field:{' '}
            <strong style={{ color: tenantSettings.is_funding_mode_enabled ? '#10b981' : '#64748b' }}>
              {tenantSettings.is_funding_mode_enabled ? 'ENABLED' : 'HIDDEN (Defaults to Budgeted)'}
            </strong>
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Active Divisions: {divisions.length}
        </span>
      </div>

      {/* Site / Project Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {projects.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            {loading ? "Loading sites..." : "No assigned sites registered."}
          </div>
        ) : (
          projects.map((p) => {
            const isDraft = (p.status || '').toUpperCase() === 'DRAFT';
            return (
              <div
                key={p.id}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '1.25rem',
                  border: isDraft ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Title & Status Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        🏗️ {p.name}
                      </h3>
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                        <span className="tag-badge tag-info" style={{ fontSize: '0.72rem' }}>{p.code}</span>
                        {p.contract_type && (
                          <span className="tag-badge" style={{ fontSize: '0.72rem', background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>
                            {p.contract_type}
                          </span>
                        )}
                      </div>
                    </div>
                    <span 
                      className={`tag-badge ${isDraft ? 'tag-warning' : 'tag-success'}`} 
                      style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}
                    >
                      {p.status ? p.status.toUpperCase() : 'DRAFT'}
                    </span>
                  </div>

                  {/* Division Snapshot & Location */}
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {p.division_name && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#cbd5e1' }}>
                        <Building2 size={14} color="#818cf8" /> Division: <strong>{p.division_name}</strong>
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MapPin size={14} color="#06b6d4" /> {p.location}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={14} color="#818cf8" /> {new Date(p.start_date).toLocaleDateString()} ──► {new Date(p.end_date).toLocaleDateString()}
                      {p.contract_duration_days ? ` (${p.contract_duration_days} Days)` : ''}
                    </span>
                    <span style={{ fontSize: '0.82rem', color: '#e2e8f0', marginTop: '0.2rem' }}>
                      Budget: <strong>${parseFloat(p.budget || 0).toLocaleString()}</strong>
                    </span>
                  </div>

                  {/* Physical Progress */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                      <span style={{ color: '#94a3b8' }}>Physical Progress</span>
                      <strong style={{ color: '#10b981' }}>{p.progress_pct || 0}%</strong>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{ width: `${p.progress_pct || 0}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #06b6d4)', borderRadius: '9999px' }} />
                    </div>
                  </div>

                  {/* Activation Notice for Draft projects */}
                  {isDraft && (
                    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: '#fbbf24', marginBottom: '0.85rem' }}>
                      🔒 Project is in DRAFT. Activation requires attached BOQ + Detailed Estimate + Technical Sanction.
                    </div>
                  )}
                </div>

                {/* Card Footer Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <button
                    className="btn btn-primary"
                    style={{
                      fontSize: '0.82rem',
                      padding: '0.45rem 0.9rem',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: isSE ? 'linear-gradient(135deg, #10b981, #059669)' : undefined
                    }}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <span>{isSE ? "Open Site" : "Open Project"}</span> <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- CREATE PROJECT MODAL (PSC-01 IMPLEMENTATION) --- */}
      {showModal && !isSE && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', background: '#1e293b', padding: '1.75rem', border: '1px solid rgba(255,255,255,0.12)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.3rem' }}>Register Construction Project</h3>
              <span className="tag-badge tag-warning" style={{ fontSize: '0.8rem', fontWeight: 700 }}>STATUS: DRAFT</span>
            </div>

            {submitError && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} color="#ef4444" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleCreateProjectSubmit}>
              {/* SECTION 1: PROJECT / CONTRACT DETAILS */}
              <div style={{ background: 'rgba(15,23,42,0.4)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', color: '#38bdf8', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                  1. PROJECT / CONTRACT DETAILS
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Project / Contract Name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      required
                      type="text"
                      maxLength={120}
                      className="form-control"
                      placeholder="e.g. Greenfield Data Center Park"
                      value={formData.name}
                      onChange={handleInputChange}
                      name="name"
                      style={{ borderColor: formErrors.name ? '#ef4444' : undefined }}
                    />
                    {formErrors.name && (
                      <span style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
                        ⚠️ {formErrors.name}
                      </span>
                    )}
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'right', display: 'block' }}>
                      {formData.name.length} / 120 chars
                    </span>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Project Code <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      required
                      type="text"
                      className="form-control"
                      placeholder="PROJ-GREENFIELD-01"
                      value={formData.code}
                      onChange={handleInputChange}
                      name="code"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Tenant (System)</label>
                    <input
                      readOnly
                      disabled
                      type="text"
                      className="form-control"
                      value={formData.tenant_name}
                      style={{ background: 'rgba(0,0,0,0.3)', color: '#94a3b8', cursor: 'not-allowed' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Division / Circle <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      required
                      className="form-control"
                      name="division_id"
                      value={formData.division_id}
                      onChange={handleInputChange}
                    >
                      <option value="">-- Select Active Division --</option>
                      {divisions.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Contract Type <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      required
                      className="form-control"
                      name="contract_type"
                      value={formData.contract_type}
                      onChange={handleInputChange}
                    >
                      <option value="Item Rate">Item Rate (Default)</option>
                      <option value="Percentage Rate" disabled={!tenantSettings.is_p2_enabled}>
                        Percentage Rate {!tenantSettings.is_p2_enabled ? '(Requires P2 Flag)' : ''}
                      </option>
                      <option value="EPC" disabled={!tenantSettings.is_p2_enabled}>
                        EPC {!tenantSettings.is_p2_enabled ? '(Requires P2 Flag)' : ''}
                      </option>
                    </select>
                    {!tenantSettings.is_p2_enabled && (
                      <span style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '0.2rem', display: 'block' }}>
                        ℹ️ Percentage Rate and EPC require tenant P2 feature to be enabled.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 2: PROJECT INFORMATION */}
              <div style={{ background: 'rgba(15,23,42,0.4)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', color: '#38bdf8', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                  2. PROJECT INFORMATION
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Client</label>
                    <select
                      className="form-control"
                      name="client_id"
                      value={formData.client_id}
                      onChange={handleInputChange}
                    >
                      <option value="">-- Select Client --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.company || 'Client'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Project Manager</label>
                    <select
                      className="form-control"
                      name="manager_id"
                      value={formData.manager_id}
                      onChange={handleInputChange}
                    >
                      <option value="">-- Select Project Manager --</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Site Location <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      required
                      type="text"
                      className="form-control"
                      placeholder="Financial District Plaza, Central Avenue"
                      value={formData.location}
                      onChange={handleInputChange}
                      name="location"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Latitude (GPS Pin)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      placeholder="30.2672"
                      value={formData.latitude}
                      onChange={handleInputChange}
                      name="latitude"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Longitude (GPS Pin)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      placeholder="-97.7431"
                      value={formData.longitude}
                      onChange={handleInputChange}
                      name="longitude"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Estimated Contract Value ($) <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-control"
                      placeholder="4500000.00"
                      value={formData.budget}
                      onChange={handleInputChange}
                      name="budget"
                      style={{ borderColor: formErrors.budget ? '#ef4444' : undefined }}
                    />
                    {formErrors.budget && (
                      <span style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
                        ⚠️ {formErrors.budget}
                      </span>
                    )}
                  </div>

                  {tenantSettings.is_funding_mode_enabled && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '0.82rem' }}>Funding Mode</label>
                      <select
                        className="form-control"
                        name="funding_mode"
                        value={formData.funding_mode}
                        onChange={handleInputChange}
                      >
                        <option value="Budgeted">Budgeted</option>
                        <option value="Deposit">Deposit</option>
                        <option value="CSSA">CSSA</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 3: SCHEDULE */}
              <div style={{ background: 'rgba(15,23,42,0.4)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', color: '#38bdf8', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                  3. SCHEDULE & DURATION
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Start Date <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      required
                      type="date"
                      className="form-control"
                      value={formData.start_date}
                      onChange={handleInputChange}
                      name="start_date"
                    />
                    {formWarnings.start_date && (
                      <span style={{ color: '#fbbf24', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                        ⚠️ {formWarnings.start_date}
                      </span>
                    )}
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Scheduled Completion Date <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      required
                      type="date"
                      className="form-control"
                      value={formData.end_date}
                      onChange={handleInputChange}
                      name="end_date"
                      style={{ borderColor: formErrors.end_date ? '#ef4444' : undefined }}
                    />
                    {formErrors.end_date && (
                      <span style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: '0.25rem', display: 'block' }}>
                        ⚠️ {formErrors.end_date}
                      </span>
                    )}
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.82rem' }}>Contract Duration (Calculated)</label>
                    <input
                      readOnly
                      disabled
                      type="text"
                      className="form-control"
                      value={`${durationCalculated} Days`}
                      style={{ background: 'rgba(0,0,0,0.3)', color: '#38bdf8', fontWeight: 700, cursor: 'not-allowed' }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: STATUS */}
              <div style={{ background: 'rgba(245,158,11,0.08)', padding: '0.85rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: '#fbbf24' }}>
                  <Info size={18} />
                  <span><strong>Status Rule:</strong> Newly registered projects automatically enter <strong>DRAFT</strong> status.</span>
                </div>
                <span className="tag-badge tag-warning" style={{ fontSize: '0.8rem', fontWeight: 700 }}>DRAFT</span>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.55rem 1.5rem' }}>
                  Register Construction Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DIVISION MANAGEMENT MODAL --- */}
      {showDivisionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '1rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '640px', background: '#1e293b', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem' }}>Tenant Divisions & Circles</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowDivisionModal(false)}>Close</button>
            </div>

            {divError && (
              <div style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem' }}>
                ⚠️ {divError}
              </div>
            )}

            {/* Add New Division Form */}
            <form onSubmit={handleAddDivision} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.75rem', marginBottom: '1.25rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px' }}>
              <input
                required
                type="text"
                className="form-control"
                placeholder="Division Name (e.g. Infrastructure Circle B)"
                value={newDivName}
                onChange={e => setNewDivName(e.target.value)}
              />
              <input
                required
                type="text"
                className="form-control"
                placeholder="Code (DIV-INFRA-B)"
                value={newDivCode}
                onChange={e => setNewDivCode(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem' }}>Add</button>
            </form>

            {/* Division List with Deactivation Toggle */}
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>Division Name</th>
                    <th style={{ padding: '0.5rem' }}>Code</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allDivisions.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0' }}>
                      <td style={{ padding: '0.5rem' }}>{d.name}</td>
                      <td style={{ padding: '0.5rem' }}><code>{d.code}</code></td>
                      <td style={{ padding: '0.5rem' }}>
                        <span className={`tag-badge ${d.is_active ? 'tag-success' : 'tag-danger'}`}>
                          {d.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                        <button
                          className={`btn btn-sm ${d.is_active ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                          onClick={() => handleToggleDivision(d.id, d.is_active)}
                        >
                          {d.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- FEATURE FLAGS MODAL --- */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '1rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', background: '#1e293b', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: '0.75rem' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem' }}>Tenant Feature Flags (PSC-01)</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowSettingsModal(false)}>Close</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '0.95rem' }}>P2 Feature Flag</h4>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.78rem' }}>Enables Percentage Rate & EPC Contract Types during project registration.</p>
                </div>
                <button
                  className={`btn ${tenantSettings.is_p2_enabled ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', minWidth: '90px' }}
                  onClick={handleToggleP2}
                >
                  {tenantSettings.is_p2_enabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '0.95rem' }}>Funding Mode Feature Flag</h4>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.78rem' }}>Displays the Funding Mode dropdown (Budgeted, Deposit, CSSA) in form.</p>
                </div>
                <button
                  className={`btn ${tenantSettings.is_funding_mode_enabled ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', minWidth: '90px' }}
                  onClick={handleToggleFundingMode}
                >
                  {tenantSettings.is_funding_mode_enabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
