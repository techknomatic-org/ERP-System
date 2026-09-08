import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, Building2, HardHat, FileSpreadsheet, Calculator, DollarSign, Truck, 
  Plus, Search, Filter, AlertCircle, CheckCircle, Clock, XCircle, ChevronRight, 
  Calendar, Info, RefreshCw, Eye, Edit, Send, Check, ShieldAlert, ArrowDownRight, ArrowUpRight
} from 'lucide-react';
import { contractorAwardsService, vendorService, projectService } from '../services/api';

export default function ContractorAwards() {
  const [awards, setAwards] = useState([]);
  const [readyProjects, setReadyProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAward, setSelectedAward] = useState(null);
  const [editingAwardId, setEditingAwardId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    project_id: '',
    contractor_id: '',
    award_amount: '',
    award_date: new Date().toISOString().split('T')[0],
    start_date: new Date().toISOString().split('T')[0],
    completion_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    remarks: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [selectedProjectData, setSelectedProjectData] = useState(null);
  const [selectedContractorData, setSelectedContractorData] = useState(null);

  // Load initial data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [awardsRes, readyRes, vendorsRes, projectsRes] = await Promise.all([
        contractorAwardsService.getAwards(),
        contractorAwardsService.getReadyProjects(),
        vendorService.getVendors(),
        projectService.getProjects()
      ]);

      setAwards(awardsRes.data || []);
      setReadyProjects(readyRes.data || []);
      
      const vendorList = Array.isArray(vendorsRes.data) ? vendorsRes.data : (vendorsRes.data?.data || []);
      setVendors(vendorList);

      const projList = Array.isArray(projectsRes.data) ? projectsRes.data : (projectsRes.data?.data || []);
      setAllProjects(projList);
    } catch (err) {
      console.error("Failed to load contractor awards data:", err);
      setError(err.response?.data?.detail || "Failed to load contractor awards data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Summary Metrics calculation (from actual DB data)
  const summaryMetrics = useMemo(() => {
    const readyCount = readyProjects.length;
    const draftCount = awards.filter(a => a.status === 'DRAFT').length;
    const pendingCount = awards.filter(a => a.status === 'SUBMITTED').length;
    const activeCount = awards.filter(a => a.status === 'APPROVED' || a.status === 'AWARDED').length;
    const totalAwardedValue = awards
      .filter(a => a.status === 'AWARDED' || a.status === 'APPROVED')
      .reduce((sum, a) => sum + (parseFloat(a.award_amount) || 0), 0);

    return {
      readyCount,
      draftCount,
      pendingCount,
      activeCount,
      totalAwardedValue
    };
  }, [awards, readyProjects]);

  // Format currency in INR
  const formatINR = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  // Format date string nicely
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const dt = new Date(dateStr);
      return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // Open modal for NEW award
  const handleOpenNewModal = () => {
    setEditingAwardId(null);
    setFormData({
      project_id: readyProjects.length > 0 ? readyProjects[0].project_id.toString() : '',
      contractor_id: '',
      award_amount: '',
      award_date: new Date().toISOString().split('T')[0],
      start_date: new Date().toISOString().split('T')[0],
      completion_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      remarks: ''
    });
    setFormErrors({});
    
    if (readyProjects.length > 0) {
      setSelectedProjectData(readyProjects[0]);
    } else {
      setSelectedProjectData(null);
    }
    setSelectedContractorData(null);
    setIsModalOpen(true);
  };

  // Open modal for EDIT award (if DRAFT or REJECTED)
  const handleOpenEditModal = (award) => {
    setEditingAwardId(award.id);
    
    // Find project info
    const projData = readyProjects.find(r => r.project_id === award.project_id) || {
      project_id: award.project_id,
      project_name: award.project_name,
      project_code: award.project_code,
      estimate_id: award.estimate_id,
      estimate_number: award.estimate_number,
      estimated_amount: award.estimated_amount,
      estimate_status: award.estimate_status || 'APPROVED'
    };

    const vendorData = vendors.find(v => v.id === award.contractor_id);

    setFormData({
      project_id: award.project_id.toString(),
      contractor_id: award.contractor_id.toString(),
      award_amount: award.award_amount ? award.award_amount.toString() : '',
      award_date: award.award_date ? award.award_date.split('T')[0] : new Date().toISOString().split('T')[0],
      start_date: award.start_date ? award.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
      completion_date: award.completion_date ? award.completion_date.split('T')[0] : new Date().toISOString().split('T')[0],
      remarks: award.remarks || ''
    });

    setSelectedProjectData(projData);
    setSelectedContractorData(vendorData || null);
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Handle Project Selection Change in Form
  const handleProjectChange = (e) => {
    const projIdStr = e.target.value;
    setFormData(prev => ({ ...prev, project_id: projIdStr }));

    if (!projIdStr) {
      setSelectedProjectData(null);
      return;
    }

    const projId = parseInt(projIdStr, 10);
    const ready = readyProjects.find(r => r.project_id === projId);
    if (ready) {
      setSelectedProjectData(ready);
      setFormData(prev => ({
        ...prev,
        award_amount: ready.estimated_amount ? ready.estimated_amount.toString() : prev.award_amount
      }));
    } else {
      // Check all projects
      const proj = allProjects.find(p => p.id === projId);
      if (proj) {
        setSelectedProjectData({
          project_id: proj.id,
          project_name: proj.name,
          project_code: proj.code || `PRJ-${proj.id}`,
          estimate_id: null,
          estimate_number: 'N/A',
          estimated_amount: parseFloat(proj.budget) || 0,
          estimate_status: 'INCOMPLETE'
        });
      } else {
        setSelectedProjectData(null);
      }
    }
  };

  // Handle Contractor Selection Change in Form
  const handleContractorChange = (e) => {
    const vendorIdStr = e.target.value;
    setFormData(prev => ({ ...prev, contractor_id: vendorIdStr }));
    if (!vendorIdStr) {
      setSelectedContractorData(null);
      return;
    }
    const vId = parseInt(vendorIdStr, 10);
    const v = vendors.find(item => item.id === vId);
    setSelectedContractorData(v || null);
  };

  // Calculate live variance
  const calculatedVariance = useMemo(() => {
    if (!selectedProjectData || !formData.award_amount) {
      return { amount: 0, percentage: 0, isHigher: false, formatted: '₹0' };
    }
    const estimated = parseFloat(selectedProjectData.estimated_amount) || 0;
    const awarded = parseFloat(formData.award_amount) || 0;
    const varianceAmt = estimated - awarded;
    const isHigher = awarded > estimated;
    const pct = estimated > 0 ? (Math.abs(varianceAmt) / estimated) * 100 : 0;

    return {
      amount: varianceAmt,
      percentage: pct.toFixed(2),
      isHigher,
      formatted: formatINR(Math.abs(varianceAmt))
    };
  }, [selectedProjectData, formData.award_amount]);

  // Form Validation
  const validateForm = (isSubmitAction = false) => {
    const errs = {};
    if (!formData.project_id) {
      errs.project_id = "Project selection is required.";
    }

    if (selectedProjectData && selectedProjectData.estimate_status === 'INCOMPLETE') {
      errs.project_id = "Project is not ready for contractor award. Complete and approve the project estimate first.";
    }

    if (!formData.contractor_id) {
      errs.contractor_id = "Contractor selection is required.";
    }

    if (isSubmitAction) {
      const awardAmtNum = parseFloat(formData.award_amount);
      if (!formData.award_amount || isNaN(awardAmtNum) || awardAmtNum <= 0) {
        errs.award_amount = "Valid award amount greater than 0 is required.";
      }
      if (!formData.award_date) {
        errs.award_date = "Award date is required.";
      }
      if (!formData.start_date) {
        errs.start_date = "Start date is required.";
      }
      if (!formData.completion_date) {
        errs.completion_date = "Completion date is required.";
      } else if (formData.start_date && formData.completion_date < formData.start_date) {
        errs.completion_date = "Completion date cannot be earlier than Start Date.";
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Save Draft Handler
  const handleSaveDraft = async () => {
    if (!validateForm(false)) return;
    setError(null);

    const payload = {
      project_id: parseInt(formData.project_id, 10),
      contractor_id: parseInt(formData.contractor_id, 10),
      award_amount: parseFloat(formData.award_amount) || 0,
      award_date: formData.award_date ? `${formData.award_date}T00:00:00` : null,
      start_date: formData.start_date ? `${formData.start_date}T00:00:00` : null,
      completion_date: formData.completion_date ? `${formData.completion_date}T00:00:00` : null,
      remarks: formData.remarks,
      status: "DRAFT"
    };

    try {
      if (editingAwardId) {
        await contractorAwardsService.updateAward(editingAwardId, payload);
        setSuccessMsg("Contractor award draft updated successfully.");
      } else {
        await contractorAwardsService.createAward(payload);
        setSuccessMsg("Contractor award draft saved successfully.");
      }
      setIsModalOpen(false);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Save draft error:", err);
      const msg = err.response?.data?.detail || "Failed to save draft award.";
      setError(msg);
    }
  };

  // Submit for Approval Handler
  const handleSubmitForApproval = async () => {
    if (!validateForm(true)) return;
    setError(null);

    const payload = {
      project_id: parseInt(formData.project_id, 10),
      contractor_id: parseInt(formData.contractor_id, 10),
      award_amount: parseFloat(formData.award_amount),
      award_date: `${formData.award_date}T00:00:00`,
      start_date: `${formData.start_date}T00:00:00`,
      completion_date: `${formData.completion_date}T00:00:00`,
      remarks: formData.remarks,
      status: "SUBMITTED"
    };

    try {
      if (editingAwardId) {
        // Update first then submit
        await contractorAwardsService.updateAward(editingAwardId, payload);
        await contractorAwardsService.submitForApproval(editingAwardId);
      } else {
        // Create as submitted directly
        await contractorAwardsService.createAward(payload);
      }
      setSuccessMsg("Contractor award submitted for approval successfully.");
      setIsModalOpen(false);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Submit approval error:", err);
      const msg = err.response?.data?.detail || "Failed to submit contractor award for approval.";
      setError(msg);
    }
  };

  // Direct Submit Action from Table (for an existing DRAFT or REJECTED award)
  const handleDirectSubmitFromTable = async (awardId) => {
    try {
      await contractorAwardsService.submitForApproval(awardId);
      setSuccessMsg("Award submitted for approval.");
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit award.");
    }
  };

  // Finalize Award Handler (for APPROVED awards)
  const handleFinalizeAward = async (awardId) => {
    try {
      await contractorAwardsService.finalizeAward(awardId);
      setSuccessMsg("Contractor award finalized successfully (Status: AWARDED).");
      if (isDetailModalOpen && selectedAward?.id === awardId) {
        setSelectedAward(prev => ({ ...prev, status: 'AWARDED' }));
      }
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to finalize contractor award.");
    }
  };

  // Cancel Award Handler
  const handleCancelAward = async (awardId) => {
    if (!window.confirm("Are you sure you want to cancel this contractor award?")) return;
    try {
      await contractorAwardsService.cancelAward(awardId);
      setSuccessMsg("Contractor award cancelled.");
      if (isDetailModalOpen && selectedAward?.id === awardId) {
        setSelectedAward(prev => ({ ...prev, status: 'CANCELLED' }));
      }
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to cancel award.");
    }
  };

  // View Detail View Handler
  const handleViewAward = (award) => {
    setSelectedAward(award);
    setIsDetailModalOpen(true);
  };

  // Filtered Awards list
  const filteredAwards = useMemo(() => {
    return awards.filter(award => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || (
        (award.award_reference || '').toLowerCase().includes(q) ||
        (award.project_name || '').toLowerCase().includes(q) ||
        (award.contractor_name || '').toLowerCase().includes(q) ||
        (award.estimate_number || '').toLowerCase().includes(q)
      );

      const matchesStatus = statusFilter === 'ALL' || award.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [awards, searchQuery, statusFilter]);

  // Helper for Status Badge styling
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <span className="tag-badge tag-warning" style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40' }}><Clock size={12} className="inline mr-1" /> DRAFT</span>;
      case 'SUBMITTED':
        return <span className="tag-badge tag-info" style={{ background: '#3b82f620', color: '#60a5fa', border: '1px solid #3b82f640' }}><Send size={12} className="inline mr-1" /> SUBMITTED</span>;
      case 'APPROVED':
        return <span className="tag-badge tag-success" style={{ background: '#10b98120', color: '#34d399', border: '1px solid #10b98140' }}><CheckCircle size={12} className="inline mr-1" /> APPROVED</span>;
      case 'AWARDED':
        return <span className="tag-badge tag-success" style={{ background: '#05966930', color: '#10b981', border: '1px solid #10b98160', fontWeight: 700 }}><Award size={12} className="inline mr-1" /> AWARDED</span>;
      case 'CANCELLED':
        return <span className="tag-badge tag-danger" style={{ background: '#ef444420', color: '#f87171', border: '1px solid #ef444440' }}><XCircle size={12} className="inline mr-1" /> CANCELLED</span>;
      case 'REJECTED':
        return <span className="tag-badge tag-danger" style={{ background: '#dc262620', color: '#f87171', border: '1px solid #dc262640' }}><XCircle size={12} className="inline mr-1" /> REJECTED</span>;
      default:
        return <span className="tag-badge">{status}</span>;
    }
  };

  return (
    <div className="page-container" style={{ padding: '1.5rem', background: '#0b0f19', color: '#e2e8f0', minHeight: '100vh' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.65rem', margin: 0 }}>
            <Award style={{ color: '#818cf8' }} size={28} />
            Contractor Awards
          </h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem', fontSize: '0.9rem' }}>
            Assign approved project estimates to contractors and manage award status.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={fetchData}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            onClick={handleOpenNewModal}
            className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
          >
            <Plus size={18} /> New Contractor Award
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5', padding: '0.85rem 1.2rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}><XCircle size={16} /></button>
        </div>
      )}

      {successMsg && (
        <div style={{ background: '#064e3b', border: '1px solid #065f46', color: '#6ee7b7', padding: '0.85rem 1.2rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle size={18} />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'transparent', border: 'none', color: '#6ee7b7', cursor: 'pointer' }}><XCircle size={16} /></button>
        </div>
      )}

      {/* SECTION 4: SUMMARY CARDS (Top KPI Metrics) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', position: 'relative', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Projects Ready For Award
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.3rem' }}>
            {summaryMetrics.readyCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Approved estimates available</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Draft Awards
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.3rem' }}>
            {summaryMetrics.draftCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Unsubmitted awards</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending Approval
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#818cf8', marginTop: '0.3rem' }}>
            {summaryMetrics.pendingCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>In approval workflow</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Awards
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#34d399', marginTop: '0.3rem' }}>
            {summaryMetrics.activeCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Approved & Finalized</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Awarded Value
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#a7f3d0', marginTop: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formatINR(summaryMetrics.totalAwardedValue)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Cumulative awarded contracts</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search by reference, project or contractor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.5rem 0.75rem 0.5rem 2.25rem', color: '#f8fafc', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', background: '#0f172a', padding: '0.25rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'AWARDED', 'CANCELLED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? '#6366f1' : 'transparent',
                color: statusFilter === st ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '4px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 5: AWARD TABLE */}
      <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} className="animate-spin inline mb-2" />
            <p>Loading contractor awards...</p>
          </div>
        ) : filteredAwards.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <Award size={36} style={{ color: '#475569', marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '1rem', fontWeight: 500, color: '#cbd5e1' }}>
              {searchQuery || statusFilter !== 'ALL' ? "No contractor awards found matching criteria." : "No contractor awards found."}
            </p>
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Click "+ New Contractor Award" above to create an award.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Award Ref</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Project</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Contractor</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Estimate Ref</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Estimated Cost</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Award Amount</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Start Date</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Completion Date</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAwards.map(award => (
                  <tr
                    key={award.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s ease' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#818cf8' }}>
                      {award.award_reference}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#f8fafc', fontWeight: 500 }}>
                      {award.project_name || `Project #${award.project_id}`}
                      {award.project_code && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{award.project_code}</div>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#e2e8f0' }}>
                      {award.contractor_name || `Vendor #${award.contractor_id}`}
                      {award.contractor_code && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{award.contractor_code}</div>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                      {award.estimate_number || 'N/A'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#94a3b8' }}>
                      {formatINR(award.estimated_amount)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600, color: '#38bdf8' }}>
                      {formatINR(award.award_amount)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                      {formatDate(award.start_date)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                      {formatDate(award.completion_date)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {renderStatusBadge(award.status)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                        <button
                          onClick={() => handleViewAward(award)}
                          className="btn btn-sm"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                          title="View Award Details"
                        >
                          <Eye size={13} /> View
                        </button>

                        {(award.status === 'DRAFT' || award.status === 'REJECTED') && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(award)}
                              className="btn btn-sm"
                              style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                              title="Edit Award"
                            >
                              <Edit size={13} /> Edit
                            </button>
                            <button
                              onClick={() => handleDirectSubmitFromTable(award.id)}
                              className="btn btn-sm"
                              style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#818cf8', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                              title="Submit for Approval"
                            >
                              <Send size={13} /> Submit
                            </button>
                          </>
                        )}

                        {award.status === 'APPROVED' && (
                          <button
                            onClick={() => handleFinalizeAward(award.id)}
                            className="btn btn-sm"
                            style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600 }}
                            title="Finalize & Mark Awarded"
                          >
                            <Award size={13} /> Finalize
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 6: NEW / EDIT CONTRACTOR AWARD FORM MODAL */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '12px', width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award size={20} style={{ color: '#818cf8' }} />
                  {editingAwardId ? 'Edit Contractor Award' : 'New Contractor Award'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                  {editingAwardId ? 'Update draft award parameters before submission.' : 'Assign approved project estimate to an active contractor.'}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><XCircle size={20} /></button>
            </div>

            {/* Modal Form Body */}
            <div style={{ padding: '1.5rem' }}>

              {/* 1. PROJECT DETAILS */}
              <div style={{ marginBottom: '1.5rem', background: 'rgba(30, 41, 59, 0.4)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  PROJECT DETAILS
                </h4>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Project *
                  </label>
                  <select
                    value={formData.project_id}
                    onChange={handleProjectChange}
                    disabled={!!editingAwardId}
                    style={{ width: '100%', background: '#1e293b', border: formErrors.project_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  >
                    <option value="">[ Select Project ]</option>
                    
                    {readyProjects.map(rp => (
                      <option key={rp.project_id} value={rp.project_id}>
                        {rp.project_name} ({rp.project_code}) — Est: {formatINR(rp.estimated_amount)} [{rp.estimate_status}]
                      </option>
                    ))}

                    {/* Show other projects if not in ready projects list */}
                    {allProjects
                      .filter(p => !readyProjects.some(r => r.project_id === p.id))
                      .map(p => (
                        <option key={p.id} value={p.id} style={{ color: '#94a3b8' }}>
                          {p.name} ({p.code || `PRJ-${p.id}`}) — [Estimate Incomplete]
                        </option>
                      ))}
                  </select>
                  {formErrors.project_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.project_id}</div>}
                </div>

                {/* Selected Project Estimate Card */}
                {selectedProjectData && (
                  <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '0.85rem 1rem' }}>
                    {selectedProjectData.estimate_status === 'INCOMPLETE' ? (
                      <div style={{ color: '#fbbf24', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={16} />
                        <span>Project is not ready for contractor award. Complete and approve the project estimate first.</span>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Project Code</div>
                          <div style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedProjectData.project_code}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Estimate Number</div>
                          <div style={{ color: '#818cf8', fontWeight: 600 }}>{selectedProjectData.estimate_number}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Estimate Status</div>
                          <div style={{ color: '#34d399', fontWeight: 600 }}>{selectedProjectData.estimate_status}</div>
                        </div>
                        <div>
                          <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Estimated Cost</div>
                          <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.95rem' }}>{formatINR(selectedProjectData.estimated_amount)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. CONTRACTOR DETAILS */}
              <div style={{ marginBottom: '1.5rem', background: 'rgba(30, 41, 59, 0.4)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  CONTRACTOR DETAILS
                </h4>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Contractor / Vendor *
                  </label>
                  {vendors.filter(v => v.status === 'active').length === 0 ? (
                    <div style={{ color: '#fbbf24', fontSize: '0.82rem', padding: '0.5rem', background: 'rgba(245,158,11,0.1)', borderRadius: '6px' }}>
                      No active contractors available. Add a contractor in Vendor Directory first.
                    </div>
                  ) : (
                    <select
                      value={formData.contractor_id}
                      onChange={handleContractorChange}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.contractor_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    >
                      <option value="">[ Select Contractor ]</option>
                      {vendors.filter(v => v.status === 'active').map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.code}) — {v.contact_person || v.email}
                        </option>
                      ))}
                    </select>
                  )}
                  {formErrors.contractor_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.contractor_id}</div>}
                </div>

                {/* Selected Contractor Info Card */}
                {selectedContractorData && (
                  <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '0.85rem 1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Contractor Name</div>
                      <div style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedContractorData.name}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Vendor Code</div>
                      <div style={{ color: '#cbd5e1' }}>{selectedContractorData.code}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Contact Person</div>
                      <div style={{ color: '#cbd5e1' }}>{selectedContractorData.contact_person || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Status</div>
                      <div style={{ color: '#34d399', fontWeight: 600 }}>{selectedContractorData.status}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. AWARD DETAILS */}
              <div style={{ marginBottom: '1.5rem', background: 'rgba(30, 41, 59, 0.4)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  AWARD DETAILS
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Award Amount (₹) *
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 60000000"
                      value={formData.award_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, award_amount: e.target.value }))}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.award_amount ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                    {formErrors.award_amount && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.award_amount}</div>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Award Date *
                    </label>
                    <input
                      type="date"
                      value={formData.award_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, award_date: e.target.value }))}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.award_date ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                    {formErrors.award_date && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.award_date}</div>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Contract / Award Reference
                    </label>
                    <input
                      type="text"
                      disabled
                      value={editingAwardId ? (awards.find(a => a.id === editingAwardId)?.award_reference || 'AWD-2026-AUTO') : 'Auto-generated (e.g. AWD-2026-001)'}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#64748b', fontSize: '0.85rem', cursor: 'not-allowed' }}
                    />
                  </div>
                </div>

                {/* Variance Display Box */}
                {selectedProjectData && formData.award_amount && (
                  <div style={{
                    background: calculatedVariance.isHigher ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    border: calculatedVariance.isHigher ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '6px',
                    padding: '0.85rem 1rem',
                    fontSize: '0.85rem'
                  }}>
                    {calculatedVariance.isHigher ? (
                      <div>
                        <div style={{ color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <AlertCircle size={16} />
                          <span>Warning: Award amount exceeds approved estimate.</span>
                        </div>
                        <div style={{ color: '#fca5a5', marginTop: '0.2rem', fontSize: '0.8rem' }}>
                          Variance: {calculatedVariance.formatted} ({calculatedVariance.percentage}% above estimate)
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <div style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <ArrowDownRight size={18} />
                          <span>Savings vs Estimate: {calculatedVariance.formatted} ({calculatedVariance.percentage}% below estimate)</span>
                        </div>
                        <div style={{ color: '#a7f3d0', fontSize: '0.75rem', fontWeight: 600 }}>
                          Commercial Savings Realized
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4. CONTRACT PERIOD */}
              <div style={{ marginBottom: '1.5rem', background: 'rgba(30, 41, 59, 0.4)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  CONTRACT PERIOD
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.start_date ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                    {formErrors.start_date && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.start_date}</div>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Expected Completion Date *
                    </label>
                    <input
                      type="date"
                      value={formData.completion_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, completion_date: e.target.value }))}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.completion_date ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                    {formErrors.completion_date && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.completion_date}</div>}
                  </div>
                </div>
              </div>

              {/* 5. REMARKS */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Remarks / Award Evaluation Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Awarded based on approved project estimate and commercial evaluation."
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: 'rgba(15, 23, 42, 0.9)' }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn btn-secondary"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.55rem 1.1rem', borderRadius: '6px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="btn btn-secondary"
                style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', fontWeight: 600, padding: '0.55rem 1.1rem', borderRadius: '6px' }}
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={handleSubmitForApproval}
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.55rem 1.25rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Send size={15} /> Submit for Approval
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SECTION 17: AWARD DETAIL VIEW MODAL */}
      {isDetailModalOpen && selectedAward && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '12px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            
            {/* Detail Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  CONTRACTOR AWARD SUMMARY
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc', margin: '0.2rem 0 0 0' }}>
                  {selectedAward.award_reference}
                </h3>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><XCircle size={20} /></button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              
              {/* WORKFLOW STEPPER INDICATOR */}
              <div style={{ marginBottom: '1.75rem', background: 'rgba(30, 41, 59, 0.5)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  WORKFLOW STATUS PIPELINE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                  {['DRAFT', 'SUBMITTED', 'APPROVED', 'AWARDED'].map((st, idx, arr) => {
                    const statusOrder = { 'DRAFT': 1, 'SUBMITTED': 2, 'APPROVED': 3, 'AWARDED': 4, 'CANCELLED': 0, 'REJECTED': 0 };
                    const currentOrder = statusOrder[selectedAward.status] || 0;
                    const thisOrder = idx + 1;
                    const isPassed = currentOrder >= thisOrder;
                    const isCurrent = selectedAward.status === st;

                    return (
                      <React.Fragment key={st}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                          <div style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: isCurrent ? '#6366f1' : (isPassed ? '#10b981' : '#1e293b'),
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            border: isCurrent ? '2px solid #818cf8' : 'none'
                          }}>
                            {isPassed && !isCurrent ? <Check size={16} /> : thisOrder}
                          </div>
                          <span style={{ fontSize: '0.7rem', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#818cf8' : (isPassed ? '#34d399' : '#64748b'), marginTop: '0.35rem' }}>
                            {st}
                          </span>
                        </div>

                        {idx < arr.length - 1 && (
                          <div style={{
                            flex: 1,
                            height: '2px',
                            background: currentOrder > thisOrder ? '#10b981' : 'rgba(255,255,255,0.1)',
                            margin: '0 0.5rem',
                            marginBottom: '1rem'
                          }} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Award Core Details Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#1e293b', padding: '0.85rem 1rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Project</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>{selectedAward.project_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>{selectedAward.project_code}</div>
                </div>

                <div style={{ background: '#1e293b', padding: '0.85rem 1rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Contractor / Vendor</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>{selectedAward.contractor_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{selectedAward.contractor_code}</div>
                </div>

                <div style={{ background: '#1e293b', padding: '0.85rem 1rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Approved Estimate Reference</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38bdf8', marginTop: '0.2rem' }}>{selectedAward.estimate_number}</div>
                  <div style={{ fontSize: '0.75rem', color: '#34d399' }}>Status: {selectedAward.estimate_status || 'APPROVED'}</div>
                </div>

                <div style={{ background: '#1e293b', padding: '0.85rem 1rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Status</div>
                  <div style={{ marginTop: '0.3rem' }}>{renderStatusBadge(selectedAward.status)}</div>
                </div>
              </div>

              {/* Financial Breakdown (Snapshot Preserved Values) */}
              <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  HISTORICAL FINANCIAL SNAPSHOT
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
                  <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Estimated Cost</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#cbd5e1', marginTop: '0.25rem' }}>
                      {formatINR(selectedAward.estimated_amount)}
                    </div>
                  </div>

                  <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Award Amount</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.25rem' }}>
                      {formatINR(selectedAward.award_amount)}
                    </div>
                  </div>

                  <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Variance</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: selectedAward.variance_amount >= 0 ? '#34d399' : '#f87171', marginTop: '0.25rem' }}>
                      {formatINR(Math.abs(selectedAward.variance_amount))}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: selectedAward.variance_amount >= 0 ? '#a7f3d0' : '#fca5a5' }}>
                      {selectedAward.variance_amount >= 0 ? `${selectedAward.variance_percentage}% savings` : `${Math.abs(selectedAward.variance_percentage)}% over`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates & Remarks */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Award Date</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 500 }}>{formatDate(selectedAward.award_date)}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Contract Start Date</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 500 }}>{formatDate(selectedAward.start_date)}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Expected Completion</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 500 }}>{formatDate(selectedAward.completion_date)}</div>
                </div>
              </div>

              {selectedAward.remarks && (
                <div style={{ background: '#1e293b', padding: '0.85rem 1rem', borderRadius: '6px', fontSize: '0.82rem' }}>
                  <div style={{ color: '#64748b', fontSize: '0.72rem', marginBottom: '0.2rem' }}>Remarks</div>
                  <div style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>{selectedAward.remarks}</div>
                </div>
              )}

            </div>

            {/* Detail Actions Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: 'rgba(15, 23, 42, 0.9)' }}>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="btn btn-secondary"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.55rem 1.1rem', borderRadius: '6px' }}
              >
                Close
              </button>

              {selectedAward.status === 'APPROVED' && (
                <button
                  type="button"
                  onClick={() => handleFinalizeAward(selectedAward.id)}
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.55rem 1.25rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Award size={16} /> Finalize Award
                </button>
              )}

              {(selectedAward.status === 'DRAFT' || selectedAward.status === 'REJECTED') && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenEditModal(selectedAward);
                  }}
                  className="btn btn-secondary"
                  style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', fontWeight: 600, padding: '0.55rem 1.1rem', borderRadius: '6px' }}
                >
                  Edit Award
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
