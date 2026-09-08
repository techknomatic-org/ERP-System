import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, Plus, Search, Filter, Save, Send, AlertTriangle, 
  CheckCircle, AlertCircle, RefreshCw, Building2, Check, FileText, 
  Upload, Eye, CheckSquare, XCircle, FileCheck, DollarSign, Tag, ExternalLink
} from 'lucide-react';
import { projectService, sorService, nonSorService } from '../services/api';
import EmptyState from '../components/EmptyState';

export default function NonSorRateAnalysis() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Active SOR Items list for SOR-First check
  const [sorMasterList, setSorMasterList] = useState([]);

  // Analyses State
  const [analyses, setAnalyses] = useState([]);
  const [reconcileReport, setReconcileReport] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState('analyses'); // 'analyses' | 'reconcile'

  // Filter State
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Create Form State
  const [formData, setFormData] = useState({
    boq_item_id: '',
    item_description: '',
    unit: 'm³',
    market_rate_source: 'Vendor Quotation',
    market_rate: '',
    supporting_document_id: null,
    supporting_document_name: '',
    analysis_remarks: ''
  });

  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileDoc, setUploadedFileDoc] = useState(null);
  const [sorMatchFound, setSorMatchFound] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Derived conditional supporting document validation for PSC-06
  const isVendorQuotation = (formData.market_rate_source || '').trim() === "Vendor Quotation";
  const isDocRequired = isVendorQuotation;
  const isDocMissing = isDocRequired && !formData.supporting_document_id;

  // Toast Notification State
  const [toast, setToast] = useState(null);

  const showToastNotification = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Format Currency
  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    const num = parseFloat(val);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Unit compatibility check helper
  const checkUnitCompatibility = (unit1, unit2) => {
    if (!unit1 || !unit2) return false;
    const u1 = unit1.trim().toLowerCase();
    const u2 = unit2.trim().toLowerCase();
    const aliases = {
      'cum': 'm³', 'cu.m': 'm³', 'm3': 'm³', 'cubic meter': 'm³', 'cubic metre': 'm³',
      'sqm': 'm²', 'sq.m': 'm2', 'm2': 'm²', 'square meter': 'm²', 'square metre': 'm²',
      'rm': 'm', 'meter': 'm', 'metre': 'm',
      'mt': 'tonnes', 'tonne': 'tonnes', 'tons': 'tonnes', 'ton': 'tonnes',
      'nos': 'nos', 'number': 'nos', 'numbers': 'nos', 'each': 'nos'
    };
    return (aliases[u1] || u1) === (aliases[u2] || u2);
  };

  // Fetch initial projects & SOR items
  useEffect(() => {
    setLoadingProjects(true);
    Promise.all([
      projectService.getProjects(),
      sorService.getSorItems()
    ])
      .then(([projRes, sorRes]) => {
        setProjects(projRes.data || []);
        setSorMasterList(sorRes.data || []);
        if (projRes.data && projRes.data.length > 0) {
          setSelectedProjectId(projRes.data[0].id.toString());
        }
      })
      .catch((err) => {
        console.error("Error loading initial projects or SOR:", err);
        showToastNotification("Failed to load initial project data.", "error");
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  // Fetch Non-SOR data for selected project
  const loadProjectData = (projId) => {
    if (!projId) {
      setAnalyses([]);
      setReconcileReport([]);
      return;
    }

    setLoadingData(true);
    Promise.all([
      nonSorService.getAnalysesByProject(projId),
      nonSorService.getReconcileReport(projId)
    ])
      .then(([anaRes, recRes]) => {
        setAnalyses(anaRes.data || []);
        setReconcileReport(recRes.data || []);
      })
      .catch((err) => {
        console.error("Error loading Non-SOR data:", err);
        showToastNotification("Failed to load Non-SOR Rate Analysis data.", "error");
      })
      .finally(() => setLoadingData(false));
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectData(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Check SOR-First rule whenever item_description or unit changes in Create Form
  useEffect(() => {
    if (!formData.item_description || !formData.item_description.trim() || !selectedProjectId) {
      setSorMatchFound(null);
      return;
    }

    const descLower = formData.item_description.trim().toLowerCase();
    const currentProj = projects.find(p => p.id.toString() === selectedProjectId);

    let found = null;
    for (const sor of sorMasterList) {
      if (sor.status !== 'Active') continue;
      const sorDesc = (sor.description || '').trim().toLowerCase();

      // Check unit compatibility
      if (checkUnitCompatibility(formData.unit, sor.unit)) {
        if (descLower === sorDesc || descLower.includes(sorDesc) || sorDesc.includes(descLower)) {
          found = sor;
          break;
        }
      }
    }

    setSorMatchFound(found);
  }, [formData.item_description, formData.unit, selectedProjectId, sorMasterList, projects]);

  // File Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    const form = new FormData();
    form.append('file', file);

    try {
      const res = await nonSorService.uploadSupportingDocument(form);
      setUploadedFileDoc(res.data);
      setFormData(prev => ({
        ...prev,
        supporting_document_id: res.data.id,
        supporting_document_name: res.data.file_name
      }));
      showToastNotification(`Uploaded supporting document '${res.data.file_name}' successfully.`, "success");
    } catch (err) {
      console.error("Error uploading supporting document:", err);
      showToastNotification("Failed to upload supporting document file.", "error");
    } finally {
      setUploadingFile(false);
    }
  };

  // Create Form Submission Handler
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    // SOR-First Check
    if (sorMatchFound) {
      showToastNotification(
        `An applicable SOR rate exists (${sorMatchFound.sor_code}: ${formatCurrency(sorMatchFound.rate)}). Non-SOR Analysis is not permitted.`,
        "error"
      );
      return;
    }

    // Validation: Item Description
    if (!formData.item_description || !formData.item_description.trim()) {
      showToastNotification("Item Description is required.", "error");
      return;
    }

    // Validation: Market Rate
    const rateNum = parseFloat(formData.market_rate);
    if (isNaN(rateNum) || rateNum <= 0) {
      showToastNotification("Market Rate must be a valid positive monetary value.", "error");
      return;
    }

    // Validation: Supporting document required ONLY for Vendor Quotation (PSC-06)
    if (isDocMissing) {
      showToastNotification("A supporting document (file upload) is required when Market Rate Source is 'Vendor Quotation'.", "error");
      return;
    }

    setSubmitting(true);
    const payload = {
      project_id: parseInt(selectedProjectId, 10),
      item_description: formData.item_description.trim(),
      unit: formData.unit,
      market_rate_source: formData.market_rate_source,
      market_rate: rateNum,
      supporting_document_id: formData.supporting_document_id,
      analysis_remarks: formData.analysis_remarks
    };

    try {
      await nonSorService.createAnalysis(payload);
      setShowCreateModal(false);
      setFormData({
        boq_item_id: '',
        item_description: '',
        unit: 'm³',
        market_rate_source: 'Vendor Quotation',
        market_rate: '',
        supporting_document_id: null,
        supporting_document_name: '',
        analysis_remarks: ''
      });
      setUploadedFileDoc(null);
      loadProjectData(selectedProjectId);
      showToastNotification("Non-SOR Rate Analysis created and submitted for EE review!", "success");
    } catch (err) {
      console.error("Error creating Non-SOR rate analysis:", err);
      const msg = err.response?.data?.detail || "Failed to create Non-SOR Rate Analysis.";
      showToastNotification(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Approve Handler
  const handleApprove = async (analysisId) => {
    setSubmitting(true);
    try {
      await nonSorService.approveAnalysis(analysisId);
      loadProjectData(selectedProjectId);
      showToastNotification("Non-SOR Market Rate APPROVED successfully!", "success");
    } catch (err) {
      console.error("Error approving Non-SOR rate analysis:", err);
      const msg = err.response?.data?.detail || "Failed to approve Non-SOR Rate Analysis. Check your role authorization.";
      showToastNotification(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Reject Handler
  const handleRejectSubmit = async () => {
    if (!selectedAnalysis) return;
    setSubmitting(true);
    try {
      await nonSorService.rejectAnalysis(selectedAnalysis.id, { rejection_reason: rejectionReason });
      setShowRejectModal(false);
      setSelectedAnalysis(null);
      setRejectionReason('');
      loadProjectData(selectedProjectId);
      showToastNotification("Non-SOR Rate Analysis REJECTED.", "info");
    } catch (err) {
      console.error("Error rejecting Non-SOR rate analysis:", err);
      const msg = err.response?.data?.detail || "Failed to reject Non-SOR Rate Analysis.";
      showToastNotification(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Computed KPIs
  const kpis = useMemo(() => {
    const total = analyses.length;
    const pending = analyses.filter(a => a.status === 'PENDING_EE_REVIEW').length;
    const approved = analyses.filter(a => a.status === 'APPROVED').length;
    const reconciled = reconcileReport.filter(r => r.is_reconciled).length;
    return { total, pending, approved, reconciled };
  }, [analyses, reconcileReport]);

  // Filtered analyses list
  const filteredAnalyses = useMemo(() => {
    return analyses.filter(item => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.item_description.toLowerCase().includes(q) ||
          item.market_rate_source.toLowerCase().includes(q) ||
          (item.created_by_name || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [analyses, statusFilter, searchQuery]);

  const activeProjectObj = projects.find(p => p.id.toString() === selectedProjectId);

  return (
    <div className="content-page">
      {/* Toast Notification */}
      {toast && (
        <div 
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : toast.type === 'info' ? 'rgba(59, 130, 246, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            color: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
            fontWeight: 600,
            fontSize: '0.88rem',
            animation: 'fadeIn 0.25s ease-out'
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ padding: '0.45rem', background: 'rgba(56, 189, 248, 0.15)', borderRadius: '8px', color: '#38bdf8' }}>
              <FileSpreadsheet size={24} />
            </div>
            <h1 className="page-title" style={{ margin: 0 }}>NON-SOR RATE ANALYSIS</h1>
          </div>
          <p className="page-subtitle" style={{ marginTop: '0.35rem' }}>
            Create market rate analyses for items without applicable SOR rates, submit for EE review, & reconcile against newer SOR editions.
          </p>
        </div>

        <div>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowCreateModal(true)}
            disabled={!selectedProjectId}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
          >
            <Plus size={18} />
            <span>New Non-SOR Analysis</span>
          </button>
        </div>
      </div>

      {/* Project Selector Toolbar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
            <Building2 size={18} color="#06b6d4" />
            <span>Select Project:</span>
          </div>
          <div style={{ minWidth: '320px', flex: 1 }}>
            <select 
              className="form-control"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{ fontWeight: 600, cursor: 'pointer' }}
            >
              <option value="">-- Select Project --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {selectedProjectId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>TOTAL ANALYSES</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>{kpis.total}</div>
          </div>
          <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>PENDING EE REVIEW</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>{kpis.pending}</div>
          </div>
          <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>APPROVED MARKET RATES</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>{kpis.approved}</div>
          </div>
          <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>RECONCILIATION FLAGS</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c084fc', marginTop: '0.2rem' }}>{kpis.reconciled}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {selectedProjectId && (
        <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '1.5rem' }}>
          <button
            onClick={() => setActiveTab('analyses')}
            style={{
              padding: '0.65rem 0.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'analyses' ? '3px solid #38bdf8' : '3px solid transparent',
              color: activeTab === 'analyses' ? '#38bdf8' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer'
            }}
          >
            Non-SOR Rate Analyses ({analyses.length})
          </button>
          <button
            onClick={() => setActiveTab('reconcile')}
            style={{
              padding: '0.65rem 0.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'reconcile' ? '3px solid #c084fc' : '3px solid transparent',
              color: activeTab === 'reconcile' ? '#c084fc' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer'
            }}
          >
            Reconcile Rates Report ({reconcileReport.length})
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      {!selectedProjectId ? (
        <div className="glass-card" style={{ padding: '3rem 1rem' }}>
          <EmptyState 
            icon={Building2}
            title="Select a project to begin Non-SOR Rate Analysis"
            description="Choose an existing construction project from the dropdown above."
          />
        </div>
      ) : loadingData ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8' }}>
          <RefreshCw size={28} className="spin-icon" style={{ marginBottom: '0.75rem', color: '#06b6d4' }} />
          <p style={{ fontSize: '0.92rem' }}>Loading Non-SOR rate analyses...</p>
        </div>
      ) : activeTab === 'analyses' ? (
        <>
          {/* Filters Bar */}
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['ALL', 'PENDING_EE_REVIEW', 'APPROVED', 'REJECTED'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`btn ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                >
                  {st.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search description or source..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.2rem', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          {/* Analyses Table */}
          {filteredAnalyses.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem 1rem' }}>
              <EmptyState 
                icon={FileText}
                title="No Non-SOR rate analyses found"
                description="Click 'New Non-SOR Analysis' to create a market rate analysis for EE review."
              />
            </div>
          ) : (
            <div className="table-container" style={{ marginBottom: '1.75rem' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Item Description</th>
                    <th style={{ width: '80px' }}>Unit</th>
                    <th style={{ width: '150px' }}>Rate Source</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Market Rate (₹)</th>
                    <th style={{ width: '140px', textAlign: 'center' }}>Status</th>
                    <th style={{ width: '140px' }}>Supporting Doc</th>
                    <th style={{ width: '130px' }}>Created By</th>
                    <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnalyses.map((item, idx) => (
                    <tr key={item.id}>
                      <td style={{ color: '#64748b', fontSize: '0.82rem' }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.88rem' }}>{item.item_description}</div>
                        {item.analysis_remarks && (
                          <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            Remarks: {item.analysis_remarks}
                          </div>
                        )}
                      </td>
                      <td style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>{item.unit}</td>
                      <td>
                        <span className="tag-badge tag-secondary" style={{ fontSize: '0.73rem' }}>
                          {item.market_rate_source}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                        {formatCurrency(item.market_rate)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span 
                          className={`tag-badge ${
                            item.status === 'APPROVED' ? 'tag-success' :
                            item.status === 'PENDING_EE_REVIEW' ? 'tag-warning' : 'tag-danger'
                          }`}
                          style={{ fontSize: '0.72rem' }}
                        >
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        {item.supporting_document_name ? (
                          <a
                            href={`/${item.supporting_document_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#38bdf8', fontSize: '0.78rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
                          >
                            <FileText size={14} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                              {item.supporting_document_name}
                            </span>
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>None</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{item.created_by_name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                          {/* Approve Action (EE Review) */}
                          {item.status === 'PENDING_EE_REVIEW' && (
                            <>
                              <button
                                className="btn btn-primary"
                                title="EE Approve Market Rate"
                                onClick={() => handleApprove(item.id)}
                                disabled={submitting}
                                style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem', background: '#10b981', borderColor: '#10b981' }}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                className="btn btn-secondary"
                                title="EE Reject"
                                onClick={() => {
                                  setSelectedAnalysis(item);
                                  setShowRejectModal(true);
                                }}
                                disabled={submitting}
                                style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                              >
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                          {item.status === 'APPROVED' && (
                            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <CheckCircle size={13} /> Approved
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Tab 2: Reconcile Rates Report */}
          <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', borderLeft: '4px solid #c084fc' }}>
            <h4 style={{ margin: '0 0 0.35rem 0', color: '#f8fafc', fontSize: '0.95rem', fontWeight: 700 }}>
              RECONCILE RATES REPORT
            </h4>
            <p style={{ margin: 0, fontSize: '0.83rem', color: '#cbd5e1' }}>
              Identifies approved Non-SOR items that match newly added SOR items in newer SOR editions. Historical Non-SOR records and estimates remain permanently unchanged.
            </p>
          </div>

          {reconcileReport.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem 1rem' }}>
              <EmptyState 
                icon={CheckSquare}
                title="No Non-SOR records found for reconciliation"
                description="Create Non-SOR Rate Analyses to monitor alignment with newer SOR editions."
              />
            </div>
          ) : (
            <div className="table-container" style={{ marginBottom: '1.75rem' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Non-SOR Item Description</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Market Rate (₹)</th>
                    <th style={{ width: '140px' }}>Rate Source</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Classification</th>
                    <th style={{ width: '180px' }}>Newer SOR Edition Match</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Newer SOR Rate (₹)</th>
                    <th style={{ width: '160px', textAlign: 'center' }}>Reconciliation Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {reconcileReport.map((rep, idx) => (
                    <tr key={rep.id} style={{ background: rep.is_reconciled ? 'rgba(192, 132, 252, 0.05)' : undefined }}>
                      <td style={{ color: '#64748b', fontSize: '0.82rem' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.88rem' }}>
                        {rep.item_description}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                        {formatCurrency(rep.market_rate)}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{rep.market_rate_source}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="tag-badge tag-primary" style={{ fontSize: '0.72rem' }}>
                          {rep.rate_type}
                        </span>
                      </td>
                      <td>
                        {rep.newer_sor_code ? (
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c084fc' }}>{rep.newer_sor_code}</div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{rep.newer_sor_edition}</div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>No SOR Match</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: rep.newer_sor_rate ? '#a7f3d0' : '#64748b', fontFamily: 'monospace' }}>
                        {rep.newer_sor_rate ? formatCurrency(rep.newer_sor_rate) : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {rep.is_reconciled ? (
                          <span className="tag-badge tag-warning" style={{ fontSize: '0.72rem', background: 'rgba(192, 132, 252, 0.2)', color: '#c084fc' }}>
                            Flagged for Reconciliation
                          </span>
                        ) : (
                          <span className="tag-badge tag-secondary" style={{ fontSize: '0.72rem' }}>
                            No Action Required
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal: Create Non-SOR Rate Analysis */}
      {showCreateModal && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.85)', 
            backdropFilter: 'blur(8px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div 
            className="glass-card" 
            style={{ 
              width: '100%', 
              maxWidth: '560px', 
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              padding: '1.5rem',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} color="#38bdf8" /> Create Non-SOR Rate Analysis
            </h3>

            <form onSubmit={handleCreateSubmit}>
              {/* Item Description */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Item Description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. Specialized Anti-Corrosive Epoxy Coating"
                  value={formData.item_description}
                  onChange={(e) => setFormData({ ...formData, item_description: e.target.value })}
                  style={{ fontSize: '0.88rem' }}
                />

                {/* SOR-First Warning */}
                {sorMatchFound && (
                  <div style={{ marginTop: '0.4rem', color: '#ef4444', fontSize: '0.78rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '6px', fontWeight: 600 }}>
                    ⚠ SOR Match Found: {sorMatchFound.sor_code} ({sorMatchFound.description}) @ {formatCurrency(sorMatchFound.rate)}/{sorMatchFound.unit}. Non-SOR Rate Analysis is not permitted when an applicable SOR rate exists.
                  </div>
                )}
              </div>

              {/* Unit & Market Rate Source */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Unit
                  </label>
                  <select
                    className="form-control"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="m³">m³ (Cubic Meter)</option>
                    <option value="m²">m² (Square Meter)</option>
                    <option value="m">m (Running Meter)</option>
                    <option value="Tonnes">Tonnes</option>
                    <option value="Nos">Nos (Numbers)</option>
                    <option value="Lumpsum">Lumpsum</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Market Rate Source <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    required
                    className="form-control"
                    value={formData.market_rate_source}
                    onChange={(e) => setFormData({ ...formData, market_rate_source: e.target.value })}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="Vendor Quotation">Vendor Quotation</option>
                    <option value="Published Index">Published Index</option>
                    <option value="Manual Entry">Manual Entry</option>
                  </select>
                </div>
              </div>

              {/* Market Rate Input */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Market Rate (₹/unit) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="form-control"
                  placeholder="e.g. 4500.00"
                  value={formData.market_rate}
                  onChange={(e) => setFormData({ ...formData, market_rate: e.target.value })}
                  style={{ fontSize: '0.88rem', fontFamily: 'monospace', fontWeight: 600 }}
                />
              </div>

              {/* Supporting Document File Upload */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Supporting Document {isDocRequired && <span style={{ color: '#ef4444' }}>* (Required for Vendor Quotation)</span>}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="file"
                    id="non-sor-file-input"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => document.getElementById('non-sor-file-input').click()}
                    disabled={uploadingFile}
                    style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Upload size={14} />
                    <span>{uploadingFile ? 'Uploading...' : 'Choose File'}</span>
                  </button>
                  <span style={{ fontSize: '0.78rem', color: formData.supporting_document_name ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
                    {formData.supporting_document_name || 'No file selected'}
                  </span>
                </div>
                {isDocMissing && (
                  <div style={{ color: '#ef4444', fontSize: '0.72rem', marginTop: '0.25rem', fontWeight: 600 }}>
                    A supporting document file upload is mandatory for Vendor Quotation source.
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Analysis Remarks
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Optional market rate justification remarks..."
                  value={formData.analysis_remarks}
                  onChange={(e) => setFormData({ ...formData, analysis_remarks: e.target.value })}
                  style={{ fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || Boolean(sorMatchFound) || isDocMissing}
                >
                  {submitting ? 'Submitting...' : 'Submit for EE Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reject EE Review */}
      {showRejectModal && selectedAnalysis && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.85)', 
            backdropFilter: 'blur(8px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div 
            className="glass-card" 
            style={{ 
              width: '100%', 
              maxWidth: '460px', 
              background: '#1e293b', 
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '12px',
              padding: '1.5rem'
            }}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <XCircle size={18} /> Reject Non-SOR Rate Analysis
            </h3>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1rem' }}>
              Rejecting Non-SOR analysis for: <strong>{selectedAnalysis.item_description}</strong>
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                Rejection Reason
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Specify reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{ fontSize: '0.82rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedAnalysis(null);
                }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRejectSubmit}
                disabled={submitting}
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
              >
                {submitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Style Overrides */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .spin-icon {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
