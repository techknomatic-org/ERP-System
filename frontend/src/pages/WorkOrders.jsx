import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileCheck, Award, Building2, HardHat, FileSpreadsheet, Calculator, DollarSign, Truck, 
  Plus, Search, Filter, AlertCircle, CheckCircle, Clock, XCircle, ChevronRight, 
  Calendar, Info, RefreshCw, Eye, Edit, Send, Check, Printer, FileText, Layers, ArrowUpRight
} from 'lucide-react';
import { workOrderService, wbsService } from '../services/api';

export default function WorkOrders() {
  const [workOrders, setWorkOrders] = useState([]);
  const [eligibleAwards, setEligibleAwards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const [selectedWO, setSelectedWO] = useState(null);
  const [editingWOId, setEditingWOId] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Project WBS Tasks for package inclusion checklist
  const [projectWbsTasks, setProjectWbsTasks] = useState([]);
  const [selectedPackageCodes, setSelectedPackageCodes] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    award_id: '',
    project_id: '',
    contractor_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    scope_of_work: 'Civil, Structural & Architectural Works',
    description: 'Execution of approved civil, foundation, structural and related activities as per project BOQ and approved drawings.',
    work_order_value: '',
    start_date: new Date().toISOString().split('T')[0],
    completion_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    payment_terms: 'Milestone-based billing against verified Measurement Book records with 10% retention.',
    terms_conditions: 'Standard safety compliance, HSE rules, and quality specifications apply as per contract agreement.',
    remarks: 'Work order issued as per finalized commercial award.'
  });

  const [formErrors, setFormErrors] = useState({});
  const [selectedAwardData, setSelectedAwardData] = useState(null);

  const printRef = useRef(null);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [woRes, eligibleRes] = await Promise.all([
        workOrderService.getWorkOrders(),
        workOrderService.getEligibleAwards()
      ]);

      setWorkOrders(woRes.data || []);
      setEligibleAwards(eligibleRes.data || []);
    } catch (err) {
      console.error("Failed to load work orders data:", err);
      setError(err.response?.data?.detail || "Failed to load work orders data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate top summary KPI metrics
  const summaryMetrics = useMemo(() => {
    const readyCount = eligibleAwards.length;
    const draftCount = workOrders.filter(w => w.status === 'DRAFT').length;
    const issuedCount = workOrders.filter(w => w.status === 'ISSUED').length;
    const activeCount = workOrders.filter(w => w.status === 'ACTIVE').length;
    const totalWOValue = workOrders
      .filter(w => ['ISSUED', 'ACTIVE', 'COMPLETED'].includes(w.status))
      .reduce((sum, w) => sum + (parseFloat(w.work_order_value) || 0), 0);

    return {
      readyCount,
      draftCount,
      issuedCount,
      activeCount,
      totalWOValue
    };
  }, [workOrders, eligibleAwards]);

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

  // Load project WBS tasks when award changes
  const fetchWbsTasks = async (projectId) => {
    if (!projectId) {
      setProjectWbsTasks([]);
      return;
    }
    try {
      const res = await wbsService.getProjectWbs(projectId);
      const tasks = Array.isArray(res.data) ? res.data : (res.data?.tasks || []);
      // Filter for Phase or Task level
      setProjectWbsTasks(tasks.filter(t => t.task_level === 'Phase' || t.task_level === 'Task'));
    } catch (e) {
      setProjectWbsTasks([]);
    }
  };

  // Open modal for NEW Work Order
  const handleOpenNewModal = () => {
    setEditingWOId(null);
    setFormErrors({});

    const initialAward = eligibleAwards.length > 0 ? eligibleAwards[0] : null;

    setFormData({
      award_id: initialAward ? initialAward.award_id.toString() : '',
      project_id: initialAward ? initialAward.project_id.toString() : '',
      contractor_id: initialAward ? initialAward.contractor_id.toString() : '',
      issue_date: new Date().toISOString().split('T')[0],
      scope_of_work: 'Civil, Structural & Architectural Works',
      description: 'Execution of approved civil, foundation, structural and related activities as per project BOQ and approved drawings.',
      work_order_value: initialAward ? initialAward.award_amount.toString() : '',
      start_date: initialAward ? initialAward.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
      completion_date: initialAward ? initialAward.completion_date.split('T')[0] : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      payment_terms: 'Milestone-based billing against verified Measurement Book records with 10% retention.',
      terms_conditions: 'Standard safety compliance, HSE rules, and quality specifications apply as per contract agreement.',
      remarks: 'Work order issued as per finalized commercial award.'
    });

    setSelectedAwardData(initialAward);
    setSelectedPackageCodes([]);

    if (initialAward) {
      fetchWbsTasks(initialAward.project_id);
    }
    setIsModalOpen(true);
  };

  // Open modal for EDIT Work Order (DRAFT only)
  const handleOpenEditModal = (wo) => {
    setEditingWOId(wo.id);
    setFormErrors({});

    const awardData = {
      award_id: wo.award_id,
      award_reference: wo.award_reference,
      project_id: wo.project_id,
      project_name: wo.project_name,
      project_code: wo.project_code,
      contractor_id: wo.contractor_id,
      contractor_name: wo.contractor_name,
      contractor_code: wo.contractor_code,
      award_amount: wo.award_amount || wo.work_order_value,
      award_date: wo.award_date || wo.created_at,
      start_date: wo.start_date,
      completion_date: wo.completion_date
    };

    setFormData({
      award_id: wo.award_id.toString(),
      project_id: wo.project_id.toString(),
      contractor_id: wo.contractor_id.toString(),
      issue_date: wo.issue_date ? wo.issue_date.split('T')[0] : new Date().toISOString().split('T')[0],
      scope_of_work: wo.scope_of_work || 'Civil, Structural & Architectural Works',
      description: wo.description || '',
      work_order_value: wo.work_order_value ? wo.work_order_value.toString() : '',
      start_date: wo.start_date ? wo.start_date.split('T')[0] : new Date().toISOString().split('T')[0],
      completion_date: wo.completion_date ? wo.completion_date.split('T')[0] : new Date().toISOString().split('T')[0],
      payment_terms: wo.payment_terms || '',
      terms_conditions: wo.terms_conditions || '',
      remarks: wo.remarks || ''
    });

    setSelectedAwardData(awardData);

    try {
      const parsedPkgs = wo.included_packages ? JSON.parse(wo.included_packages) : [];
      setSelectedPackageCodes(Array.isArray(parsedPkgs) ? parsedPkgs : []);
    } catch (e) {
      setSelectedPackageCodes([]);
    }

    fetchWbsTasks(wo.project_id);
    setIsModalOpen(true);
  };

  // Handle Award selection change in form
  const handleAwardChange = (e) => {
    const awardIdStr = e.target.value;
    setFormData(prev => ({ ...prev, award_id: awardIdStr }));

    if (!awardIdStr) {
      setSelectedAwardData(null);
      return;
    }

    const awardId = parseInt(awardIdStr, 10);
    const award = eligibleAwards.find(a => a.award_id === awardId);
    if (award) {
      setSelectedAwardData(award);
      setFormData(prev => ({
        ...prev,
        project_id: award.project_id.toString(),
        contractor_id: award.contractor_id.toString(),
        work_order_value: award.award_amount ? award.award_amount.toString() : prev.work_order_value,
        start_date: award.start_date ? award.start_date.split('T')[0] : prev.start_date,
        completion_date: award.completion_date ? award.completion_date.split('T')[0] : prev.completion_date
      }));
      fetchWbsTasks(award.project_id);
    }
  };

  // Toggle WBS package selection
  const handleTogglePackage = (code) => {
    setSelectedPackageCodes(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Value excess variance check
  const valueVarianceInfo = useMemo(() => {
    if (!selectedAwardData || !formData.work_order_value) {
      return { diff: 0, isExceeded: false, formatted: '₹0' };
    }
    const awardAmt = parseFloat(selectedAwardData.award_amount) || 0;
    const woVal = parseFloat(formData.work_order_value) || 0;
    const diff = woVal - awardAmt;
    return {
      diff,
      isExceeded: woVal > awardAmt,
      formatted: formatINR(Math.abs(diff))
    };
  }, [selectedAwardData, formData.work_order_value]);

  // Form Validation
  const validateForm = (isIssueAction = false) => {
    const errs = {};
    if (!formData.award_id) {
      errs.award_id = "Contractor award selection is required.";
    }

    if (!formData.scope_of_work || !formData.scope_of_work.trim()) {
      errs.scope_of_work = "Scope of Work is required.";
    }

    const woValNum = parseFloat(formData.work_order_value);
    if (!formData.work_order_value || isNaN(woValNum) || woValNum <= 0) {
      errs.work_order_value = "Valid Work Order Value greater than 0 is required.";
    }

    if (isIssueAction) {
      if (!formData.issue_date) {
        errs.issue_date = "Issue Date is required.";
      }
      if (!formData.start_date) {
        errs.start_date = "Start Date is required.";
      }
      if (!formData.completion_date) {
        errs.completion_date = "Completion Date is required.";
      } else if (formData.start_date && formData.completion_date < formData.start_date) {
        errs.completion_date = "Completion Date cannot be earlier than Start Date.";
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
      award_id: parseInt(formData.award_id, 10),
      project_id: parseInt(formData.project_id, 10),
      contractor_id: parseInt(formData.contractor_id, 10),
      issue_date: formData.issue_date ? `${formData.issue_date}T00:00:00` : null,
      scope_of_work: formData.scope_of_work.trim(),
      description: formData.description,
      work_order_value: parseFloat(formData.work_order_value) || 0,
      start_date: formData.start_date ? `${formData.start_date}T00:00:00` : null,
      completion_date: formData.completion_date ? `${formData.completion_date}T00:00:00` : null,
      payment_terms: formData.payment_terms,
      terms_conditions: formData.terms_conditions,
      remarks: formData.remarks,
      included_packages: JSON.stringify(selectedPackageCodes),
      status: "DRAFT"
    };

    try {
      if (editingWOId) {
        await workOrderService.updateWorkOrder(editingWOId, payload);
        setSuccessMsg("Work Order draft updated successfully.");
      } else {
        await workOrderService.createWorkOrder(payload);
        setSuccessMsg("Work Order draft saved successfully.");
      }
      setIsModalOpen(false);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Save draft WO error:", err);
      setError(err.response?.data?.detail || "Failed to save Work Order draft.");
    }
  };

  // Issue Work Order Handler
  const handleIssueWorkOrder = async () => {
    if (!validateForm(true)) return;
    setError(null);

    const payload = {
      award_id: parseInt(formData.award_id, 10),
      project_id: parseInt(formData.project_id, 10),
      contractor_id: parseInt(formData.contractor_id, 10),
      issue_date: `${formData.issue_date}T00:00:00`,
      scope_of_work: formData.scope_of_work.trim(),
      description: formData.description,
      work_order_value: parseFloat(formData.work_order_value),
      start_date: `${formData.start_date}T00:00:00`,
      completion_date: `${formData.completion_date}T00:00:00`,
      payment_terms: formData.payment_terms,
      terms_conditions: formData.terms_conditions,
      remarks: formData.remarks,
      included_packages: JSON.stringify(selectedPackageCodes),
      status: "ISSUED"
    };

    try {
      if (editingWOId) {
        await workOrderService.updateWorkOrder(editingWOId, payload);
        await workOrderService.issueWorkOrder(editingWOId);
      } else {
        await workOrderService.createWorkOrder(payload);
      }
      setSuccessMsg("Work Order issued successfully.");
      setIsModalOpen(false);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Issue WO error:", err);
      setError(err.response?.data?.detail || "Failed to issue Work Order.");
    }
  };

  // Direct Issue from Table
  const handleDirectIssueFromTable = async (woId) => {
    try {
      await workOrderService.issueWorkOrder(woId);
      setSuccessMsg("Work Order issued successfully.");
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to issue Work Order.");
    }
  };

  // Open Cancel Modal
  const handleOpenCancelModal = (wo) => {
    setSelectedWO(wo);
    setCancellationReason('');
    setIsCancelModalOpen(true);
  };

  // Confirm Cancellation
  const handleConfirmCancel = async () => {
    if (!cancellationReason.trim()) {
      setError("Cancellation reason is required.");
      return;
    }
    try {
      await workOrderService.cancelWorkOrder(selectedWO.id, cancellationReason);
      setSuccessMsg("Work Order cancelled.");
      setIsCancelModalOpen(false);
      if (isDetailModalOpen && selectedWO?.id === selectedWO.id) {
        setSelectedWO(prev => ({ ...prev, status: 'CANCELLED', cancellation_reason: cancellationReason }));
      }
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to cancel Work Order.");
    }
  };

  // View Work Order Detail
  const handleViewWorkOrder = async (woOrId, e) => {
    if (e) {
      e.stopPropagation();
    }
    setError(null);
    const woId = typeof woOrId === 'object' ? woOrId.id : woOrId;
    const initialWO = typeof woOrId === 'object' ? woOrId : workOrders.find(w => w.id === woId);
    
    if (initialWO) {
      setSelectedWO(initialWO);
    }
    setIsDetailModalOpen(true);

    try {
      const res = await workOrderService.getWorkOrderById(woId);
      if (res.data) {
        setSelectedWO(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch work order details:", err);
    }
  };

  // Print Work Order Handler
  const handlePrint = () => {
    window.print();
  };

  // Filtered Work Orders list
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(wo => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || (
        (wo.work_order_number || '').toLowerCase().includes(q) ||
        (wo.project_name || '').toLowerCase().includes(q) ||
        (wo.contractor_name || '').toLowerCase().includes(q) ||
        (wo.award_reference || '').toLowerCase().includes(q) ||
        (wo.scope_of_work || '').toLowerCase().includes(q)
      );

      const matchesStatus = statusFilter === 'ALL' || wo.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [workOrders, searchQuery, statusFilter]);

  // Helper for Status Badge styling
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'DRAFT':
        return <span className="tag-badge tag-warning" style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40' }}><Clock size={12} className="inline mr-1" /> DRAFT</span>;
      case 'ISSUED':
        return <span className="tag-badge tag-info" style={{ background: '#3b82f620', color: '#60a5fa', border: '1px solid #3b82f640' }}><Send size={12} className="inline mr-1" /> ISSUED</span>;
      case 'ACTIVE':
        return <span className="tag-badge tag-success" style={{ background: '#10b98120', color: '#34d399', border: '1px solid #10b98140' }}><CheckCircle size={12} className="inline mr-1" /> ACTIVE</span>;
      case 'COMPLETED':
        return <span className="tag-badge tag-success" style={{ background: '#05966930', color: '#10b981', border: '1px solid #10b98160', fontWeight: 700 }}><Check size={12} className="inline mr-1" /> COMPLETED</span>;
      case 'CANCELLED':
        return <span className="tag-badge tag-danger" style={{ background: '#ef444420', color: '#f87171', border: '1px solid #ef444440' }}><XCircle size={12} className="inline mr-1" /> CANCELLED</span>;
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
            <FileCheck style={{ color: '#38bdf8' }} size={28} />
            Work Orders
          </h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem', fontSize: '0.9rem' }}>
            Generate and manage work orders from finalized contractor awards.
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
            style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(2,132,199,0.3)' }}
          >
            <Plus size={18} /> Generate Work Order
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
        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ready For Work Order
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.3rem' }}>
            {summaryMetrics.readyCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Finalized awards available</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Draft Work Orders
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.3rem' }}>
            {summaryMetrics.draftCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Preparation phase</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Issued Work Orders
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#818cf8', marginTop: '0.3rem' }}>
            {summaryMetrics.issuedCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Formally issued to contractor</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Work Orders
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#34d399', marginTop: '0.3rem' }}>
            {summaryMetrics.activeCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Execution under way</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Work Order Value
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#a7f3d0', marginTop: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formatINR(summaryMetrics.totalWOValue)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Committed contract value</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search by WO number, project, contractor or scope..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.5rem 0.75rem 0.5rem 2.25rem', color: '#f8fafc', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', background: '#0f172a', padding: '0.25rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {['ALL', 'DRAFT', 'ISSUED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? '#0284c7' : 'transparent',
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

      {/* SECTION 5: WORK ORDER TABLE */}
      <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} className="animate-spin inline mb-2" />
            <p>Loading work orders...</p>
          </div>
        ) : filteredWorkOrders.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <FileCheck size={36} style={{ color: '#475569', marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '1rem', fontWeight: 500, color: '#cbd5e1' }}>
              {searchQuery || statusFilter !== 'ALL' ? "No work orders found matching criteria." : "No work orders generated yet."}
            </p>
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Click "+ Generate Work Order" above to issue a work order from a finalized contractor award.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>WO Number</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Project</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Contractor</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Award Ref</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Scope of Work</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Work Order Value</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Start Date</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Completion Date</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkOrders.map(wo => (
                  <tr
                    key={wo.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s ease' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#38bdf8' }}>
                      {wo.work_order_number}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#f8fafc', fontWeight: 500 }}>
                      {wo.project_name || `Project #${wo.project_id}`}
                      {wo.project_code && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{wo.project_code}</div>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#e2e8f0' }}>
                      {wo.contractor_name || `Vendor #${wo.contractor_id}`}
                      {wo.contractor_code && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{wo.contractor_code}</div>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#818cf8', fontWeight: 600 }}>
                      {wo.award_reference || 'N/A'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {wo.scope_of_work}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                      {formatINR(wo.work_order_value)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                      {formatDate(wo.start_date)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                      {formatDate(wo.completion_date)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {renderStatusBadge(wo.status)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                        <button
                          onClick={(e) => handleViewWorkOrder(wo, e)}
                          className="btn btn-sm"
                          style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontWeight: 600 }}
                          title="View / Print Work Order"
                        >
                          <Eye size={13} /> View
                        </button>

                        {wo.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(wo)}
                              className="btn btn-sm"
                              style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                              title="Edit Draft Work Order"
                            >
                              <Edit size={13} /> Edit
                            </button>
                            <button
                              onClick={() => handleDirectIssueFromTable(wo.id)}
                              className="btn btn-sm"
                              style={{ background: 'rgba(2, 132, 199, 0.2)', border: '1px solid rgba(2, 132, 199, 0.4)', color: '#38bdf8', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600 }}
                              title="Issue Work Order"
                            >
                              <Send size={13} /> Issue
                            </button>
                          </>
                        )}

                        {wo.status !== 'COMPLETED' && wo.status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleOpenCancelModal(wo)}
                            className="btn btn-sm"
                            style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                            title="Cancel Work Order"
                          >
                            <XCircle size={13} /> Cancel
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

      {/* SECTION 6 & 9: GENERATE / EDIT WORK ORDER FORM MODAL */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '12px', width: '100%', maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileCheck size={20} style={{ color: '#38bdf8' }} />
                  {editingWOId ? 'Edit Work Order' : 'Generate Work Order'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                  {editingWOId ? 'Update draft work order parameters.' : 'Issue formal work order from a finalized contractor award.'}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><XCircle size={20} /></button>
            </div>

            {/* Modal Form Body */}
            <div style={{ padding: '1.5rem' }}>

              {/* 1. SOURCE / AWARD DETAILS (READ-ONLY) */}
              <div style={{ marginBottom: '1.5rem', background: 'rgba(30, 41, 59, 0.4)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  SOURCE / AWARD DETAILS
                </h4>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Contractor Award Reference *
                  </label>
                  {eligibleAwards.length === 0 && !editingWOId ? (
                    <div style={{ color: '#fbbf24', fontSize: '0.82rem', padding: '0.6rem', background: 'rgba(245,158,11,0.1)', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.2)' }}>
                      No contractor awards currently ready for Work Order. Finalize an award in Contractor Awards module first.
                    </div>
                  ) : (
                    <select
                      value={formData.award_id}
                      onChange={handleAwardChange}
                      disabled={!!editingWOId}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.award_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    >
                      <option value="">[ Select Finalized Contractor Award ]</option>
                      {eligibleAwards.map(a => (
                        <option key={a.award_id} value={a.award_id}>
                          {a.award_reference} — {a.project_name} ({a.contractor_name}) — Award Amount: {formatINR(a.award_amount)}
                        </option>
                      ))}
                    </select>
                  )}
                  {formErrors.award_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.award_id}</div>}
                </div>

                {/* Auto-populated Award Card */}
                {selectedAwardData && (
                  <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '0.85rem 1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Project</div>
                      <div style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedAwardData.project_name}</div>
                      <div style={{ color: '#818cf8', fontSize: '0.7rem' }}>{selectedAwardData.project_code}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Contractor / Vendor</div>
                      <div style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedAwardData.contractor_name}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{selectedAwardData.contractor_code}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Award Reference</div>
                      <div style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedAwardData.award_reference}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Award Amount</div>
                      <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.95rem' }}>{formatINR(selectedAwardData.award_amount)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. WORK ORDER DETAILS */}
              <div style={{ marginBottom: '1.5rem', background: 'rgba(30, 41, 59, 0.4)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  WORK ORDER DETAILS
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Work Order Number
                    </label>
                    <input
                      type="text"
                      disabled
                      value={editingWOId ? (workOrders.find(w => w.id === editingWOId)?.work_order_number || 'WO-2026-AUTO') : 'Auto-generated (e.g. WO-2026-001)'}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#64748b', fontSize: '0.85rem', cursor: 'not-allowed' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Issue Date *
                    </label>
                    <input
                      type="date"
                      value={formData.issue_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.issue_date ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                    {formErrors.issue_date && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.issue_date}</div>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Work Order Value (₹) *
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 4560000"
                      value={formData.work_order_value}
                      onChange={(e) => setFormData(prev => ({ ...prev, work_order_value: e.target.value }))}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.work_order_value ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                    {formErrors.work_order_value && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.work_order_value}</div>}
                  </div>
                </div>

                {/* Excess Value Warning Banner */}
                {valueVarianceInfo.isExceeded && (
                  <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#fbbf24', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={16} />
                    <span>Warning: Work Order value exceeds awarded amount by {valueVarianceInfo.formatted}.</span>
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Scope of Work *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Civil, Structural & Architectural Works"
                    value={formData.scope_of_work}
                    onChange={(e) => setFormData(prev => ({ ...prev, scope_of_work: e.target.value }))}
                    style={{ width: '100%', background: '#1e293b', border: formErrors.scope_of_work ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  />
                  {formErrors.scope_of_work && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.scope_of_work}</div>}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Detailed Scope Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Execution of approved civil, foundation, structural and related activities as per project BOQ and approved drawings."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem', resize: 'vertical' }}
                  />
                </div>

                {/* Included WBS Work Packages Checklist */}
                {projectWbsTasks.length > 0 && (
                  <div style={{ marginBottom: '1rem', background: '#0f172a', padding: '0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Layers size={14} style={{ color: '#38bdf8' }} />
                      <span>Included Project WBS Work Packages:</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', maxHeight: '140px', overflowY: 'auto' }}>
                      {projectWbsTasks.map(task => (
                        <label key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#cbd5e1', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedPackageCodes.includes(task.wbs_code || task.title)}
                            onChange={() => handleTogglePackage(task.wbs_code || task.title)}
                            style={{ accentColor: '#0284c7' }}
                          />
                          <span>{task.wbs_code ? `${task.wbs_code} ` : ''}{task.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contract Period */}
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

              {/* 3. TERMS & REMARKS */}
              <div style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Payment Terms
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Milestone-based billing against MB records with 10% retention."
                    value={formData.payment_terms}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem', resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Terms & Conditions
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Standard safety compliance, HSE rules, and quality specifications apply."
                    value={formData.terms_conditions}
                    onChange={(e) => setFormData(prev => ({ ...prev, terms_conditions: e.target.value }))}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem', resize: 'vertical' }}
                  />
                </div>
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
                onClick={handleIssueWorkOrder}
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.55rem 1.25rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Send size={15} /> Issue Work Order
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SECTION 19 & 20: WORK ORDER DETAIL & PRINT-READY VIEW MODAL */}
      {isDetailModalOpen && selectedWO && (
        <div 
          onClick={() => setIsDetailModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '12px', width: '100%', maxWidth: '850px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}
          >
            
            {/* Action Bar / Modal Header */}
            <div className="no-print" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.95)', position: 'sticky', top: 0, zIndex: 10 }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>WORK ORDER DETAILS</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{selectedWO.work_order_number}</h3>
              </div>
              <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center' }}>
                <button
                  onClick={handlePrint}
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.45rem 1rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                >
                  <Printer size={15} /> Print Work Order
                </button>
                <button 
                  onClick={() => setIsDetailModalOpen(false)} 
                  className="btn btn-secondary"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc', fontWeight: 600, padding: '0.45rem 0.9rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <XCircle size={15} /> Close
                </button>
              </div>
            </div>

            {/* Printable Document Container */}
            <div ref={printRef} style={{ padding: '2rem', background: '#ffffff', color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
              
              {/* Document Header Branding */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0284c7', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0284c7', letterSpacing: '-0.02em' }}>PROJECT FLOW ERP</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Official Work Order Document</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>WORK ORDER</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{selectedWO.work_order_number}</div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <span style={{ 
                      background: selectedWO.status === 'ISSUED' || selectedWO.status === 'ACTIVE' ? '#dcfce7' : selectedWO.status === 'DRAFT' ? '#fef3c7' : '#fee2e2', 
                      color: selectedWO.status === 'ISSUED' || selectedWO.status === 'ACTIVE' ? '#15803d' : selectedWO.status === 'DRAFT' ? '#b45309' : '#991b1b', 
                      padding: '0.2rem 0.6rem', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem', 
                      fontWeight: 700 
                    }}>
                      Status: {selectedWO.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Clean Sections: Project, Contractor, Award, Work Order */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                
                {/* PROJECT DETAILS */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#0284c7', textTransform: 'uppercase', fontWeight: 800, borderBottom: '1px solid #cbd5e1', paddingBottom: '0.35rem', marginBottom: '0.6rem' }}>
                    PROJECT DETAILS
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Project:</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>{selectedWO.project_name || 'N/A'}</div>
                  
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Project Code:</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>{selectedWO.project_code || `PROJ-${selectedWO.project_id}`}</div>
                </div>

                {/* CONTRACTOR DETAILS */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#0284c7', textTransform: 'uppercase', fontWeight: 800, borderBottom: '1px solid #cbd5e1', paddingBottom: '0.35rem', marginBottom: '0.6rem' }}>
                    CONTRACTOR DETAILS
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Contractor:</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>{selectedWO.contractor_name || 'N/A'}</div>
                  
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Vendor Code:</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>{selectedWO.contractor_code || `VND-${selectedWO.contractor_id}`}</div>
                </div>

                {/* AWARD DETAILS */}
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.72rem', color: '#0284c7', textTransform: 'uppercase', fontWeight: 800, borderBottom: '1px solid #cbd5e1', paddingBottom: '0.35rem', marginBottom: '0.6rem' }}>
                    AWARD DETAILS
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Award Reference:</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>{selectedWO.award_reference || 'N/A'}</div>
                  
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Award Amount:</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#15803d' }}>{formatINR(selectedWO.award_amount || selectedWO.work_order_value)}</div>
                </div>

                {/* WORK ORDER FINANCIAL & DATES */}
                <div style={{ background: '#f0f9ff', padding: '1rem', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                  <div style={{ fontSize: '0.72rem', color: '#0284c7', textTransform: 'uppercase', fontWeight: 800, borderBottom: '1px solid #93c5fd', paddingBottom: '0.35rem', marginBottom: '0.6rem' }}>
                    WORK ORDER SUMMARY
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: 600 }}>Work Order Value:</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7', marginBottom: '0.4rem' }}>{formatINR(selectedWO.work_order_value)}</div>
                  
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Issue Date:</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.2rem' }}>{formatDate(selectedWO.issue_date || selectedWO.created_at)}</div>

                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Contract Period:</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Start: {formatDate(selectedWO.start_date)} — Completion: {formatDate(selectedWO.completion_date)}</div>
                </div>

              </div>

              {/* Scope & Description */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                  SCOPE OF WORK & DESCRIPTION
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.6rem 0', fontWeight: 700, width: '25%', color: '#475569' }}>Scope of Work:</td>
                      <td style={{ padding: '0.6rem 0', fontWeight: 700, color: '#0f172a' }}>{selectedWO.scope_of_work}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.6rem 0', fontWeight: 700, color: '#475569' }}>Description:</td>
                      <td style={{ padding: '0.6rem 0', color: '#334155' }}>{selectedWO.description || 'As per approved project BOQ specifications.'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Terms & Conditions */}
              {selectedWO.payment_terms && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    PAYMENT TERMS
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#334155', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    {selectedWO.payment_terms}
                  </div>
                </div>
              )}

              {selectedWO.terms_conditions && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    TERMS & CONDITIONS
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#334155', background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    {selectedWO.terms_conditions}
                  </div>
                </div>
              )}

              {selectedWO.remarks && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    REMARKS
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569' }}>{selectedWO.remarks}</div>
                </div>
              )}

              {selectedWO.cancellation_reason && (
                <div style={{ marginBottom: '1.25rem', background: '#fef2f2', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>CANCELLATION REASON</div>
                  <div style={{ fontSize: '0.82rem', color: '#991b1b', marginTop: '0.2rem' }}>{selectedWO.cancellation_reason}</div>
                </div>
              )}

              {/* Signatures Footer for Print */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #cbd5e1' }}>
                <div>
                  <div style={{ height: '35px' }}></div>
                  <div style={{ borderTop: '1px solid #0f172a', width: '200px', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', paddingTop: '0.25rem' }}>
                    Authorized Signatory (Client)
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Project Flow Management</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ height: '35px' }}></div>
                  <div style={{ borderTop: '1px solid #0f172a', width: '200px', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', paddingTop: '0.25rem', marginLeft: 'auto' }}>
                    Accepted & Acknowledged
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{selectedWO.contractor_name}</div>
                </div>
              </div>

            </div>

            {/* Modal Footer with Close Button */}
            <div className="no-print" style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(15, 23, 42, 0.95)' }}>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="btn btn-secondary"
                style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#ffffff', fontWeight: 600, padding: '0.55rem 1.4rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SECTION 24: CANCEL WORK ORDER MODAL */}
      {isCancelModalOpen && selectedWO && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f87171', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertCircle size={20} /> Cancel Work Order {selectedWO.work_order_number}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1rem' }}>
              Please enter the reason for cancelling this work order. This action will update status to CANCELLED and preserve audit trail logs.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Cancellation Reason *
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Scope revision or commercial cancellation as per mutual agreement."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="btn btn-secondary"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.45rem 1rem', borderRadius: '6px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="btn btn-danger"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.45rem 1.1rem', borderRadius: '6px' }}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
