import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Layers, CheckCircle, Clock, AlertCircle, XCircle, 
  Plus, Search, Filter, RefreshCw, Eye, Edit, Trash2, ArrowUpRight, 
  Building2, Hash, FileText, Check, AlertTriangle, User, Tag, FileSpreadsheet,
  Link, DollarSign
} from 'lucide-react';
import { workPlanService, projectService, wbsService } from '../services/api';

export default function WorkPlan() {
  const [workPlans, setWorkPlans] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedWP, setSelectedWP] = useState(null);
  const [editingWPId, setEditingWPId] = useState(null);

  // FEATURE 2: BOQ Mapping State
  const [boqMappings, setBoqMappings] = useState([]);
  const [eligibleBoqItems, setEligibleBoqItems] = useState([]);
  const [isMapBoqModalOpen, setIsMapBoqModalOpen] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState(null);
  const [boqFormData, setBoqFormData] = useState({
    boq_item_id: '',
    mapped_quantity: '',
    unit: ''
  });
  const [selectedBoqItemData, setSelectedBoqItemData] = useState(null);
  const [boqFormErrors, setBoqFormErrors] = useState({});

  // WBS Cascading options
  const [projectWbsTasks, setProjectWbsTasks] = useState([]);
  const [wbsPhases, setWbsPhases] = useState([]);
  const [wbsTasks, setWbsTasks] = useState([]);
  const [wbsSubtasks, setWbsSubtasks] = useState([]);
  const [noWbsNotice, setNoWbsNotice] = useState(false);

  // Work Plan Form State
  const [formData, setFormData] = useState({
    project_id: '',
    wbs_phase_id: '',
    task_id: '',
    subtask_id: '',
    activity_name: '',
    description: '',
    planned_quantity: '',
    unit: 'm³',
    planned_start_date: new Date().toISOString().split('T')[0],
    planned_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'MEDIUM',
    dependency_id: '',
    responsible_user_name: '',
    remarks: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [dateWarning, setDateWarning] = useState(null);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [wpRes, projRes] = await Promise.all([
        workPlanService.getWorkPlans({ project_id: selectedProjectId || undefined }),
        projectService.getProjects()
      ]);

      setWorkPlans(wpRes.data || []);
      const projList = Array.isArray(projRes.data) ? projRes.data : (projRes.data?.projects || []);
      setProjects(projList);
    } catch (err) {
      console.error("Failed to load work plan data:", err);
      setError(err.response?.data?.detail || "Failed to load work plan activities.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProjectId]);

  // Calculate Summary KPI Cards
  const summaryMetrics = useMemo(() => {
    const total = workPlans.length;
    const notStarted = workPlans.filter(w => w.status === 'NOT STARTED').length;
    const inProgress = workPlans.filter(w => w.status === 'IN PROGRESS').length;
    const completed = workPlans.filter(w => w.status === 'COMPLETED').length;
    const overdue = workPlans.filter(w => w.status === 'DELAYED').length;

    return { total, notStarted, inProgress, completed, overdue };
  }, [workPlans]);

  // Format date nicely
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const dt = new Date(dateStr);
      return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  // Format INR currency
  const formatINR = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  // Fetch BOQ Mappings for selected Work Plan Activity
  const fetchBoqMappingsData = async (wpId) => {
    try {
      const [mappingsRes, eligibleRes] = await Promise.all([
        workPlanService.getBoqMappings(wpId),
        workPlanService.getEligibleBoqItems(wpId)
      ]);
      setBoqMappings(mappingsRes.data || []);
      setEligibleBoqItems(eligibleRes.data || []);
    } catch (err) {
      console.error("Failed to load BOQ mappings:", err);
    }
  };

  // Process WBS tasks for a project
  const handleLoadWbsForProject = async (projIdStr) => {
    if (!projIdStr) {
      setProjectWbsTasks([]);
      setWbsPhases([]);
      setWbsTasks([]);
      setWbsSubtasks([]);
      setNoWbsNotice(false);
      return;
    }

    try {
      const res = await wbsService.getProjectWbs(parseInt(projIdStr, 10));
      const tasks = Array.isArray(res.data) ? res.data : (res.data?.tasks || []);
      setProjectWbsTasks(tasks);

      if (tasks.length === 0) {
        setNoWbsNotice(true);
        setWbsPhases([]);
        setWbsTasks([]);
        setWbsSubtasks([]);
        return;
      }
      setNoWbsNotice(false);

      const phases = tasks.filter(t => t.task_level === 'Phase' || !t.parent_task_id);
      setWbsPhases(phases.length > 0 ? phases : tasks);
    } catch (e) {
      console.error("Failed to load WBS tasks:", e);
      setProjectWbsTasks([]);
      setWbsPhases([]);
      setNoWbsNotice(true);
    }
  };

  // When form Project selection changes
  const handleFormProjectChange = (e) => {
    const projIdStr = e.target.value;
    setFormData(prev => ({
      ...prev,
      project_id: projIdStr,
      wbs_phase_id: '',
      task_id: '',
      subtask_id: ''
    }));
    setWbsTasks([]);
    setWbsSubtasks([]);
    handleLoadWbsForProject(projIdStr);
    checkProjectDateBounds(projIdStr, formData.planned_start_date, formData.planned_end_date);
  };

  // When WBS Phase selection changes
  const handleFormPhaseChange = (e) => {
    const phaseIdStr = e.target.value;
    setFormData(prev => ({
      ...prev,
      wbs_phase_id: phaseIdStr,
      task_id: '',
      subtask_id: ''
    }));
    setWbsSubtasks([]);

    if (!phaseIdStr) {
      setWbsTasks([]);
      return;
    }

    const phaseId = parseInt(phaseIdStr, 10);
    const childTasks = projectWbsTasks.filter(t => t.parent_task_id === phaseId || (t.task_level === 'Task' && t.parent_task_id === phaseId));
    setWbsTasks(childTasks.length > 0 ? childTasks : projectWbsTasks.filter(t => t.id !== phaseId));
  };

  // When WBS Task selection changes
  const handleFormTaskChange = (e) => {
    const taskIdStr = e.target.value;
    setFormData(prev => ({
      ...prev,
      task_id: taskIdStr,
      subtask_id: ''
    }));

    if (!taskIdStr) {
      setWbsSubtasks([]);
      return;
    }

    const taskId = parseInt(taskIdStr, 10);
    const childSubtasks = projectWbsTasks.filter(t => t.parent_task_id === taskId || t.task_level === 'Subtask');
    setWbsSubtasks(childSubtasks);
  };

  // Date range warning against project dates
  const checkProjectDateBounds = (projIdStr, startStr, endStr) => {
    if (!projIdStr || !startStr || !endStr) {
      setDateWarning(null);
      return;
    }
    const proj = projects.find(p => p.id === parseInt(projIdStr, 10));
    if (proj && (proj.start_date || proj.end_date)) {
      const pStart = proj.start_date ? new Date(proj.start_date) : null;
      const pEnd = proj.end_date ? new Date(proj.end_date) : null;
      const wStart = new Date(startStr);
      const wEnd = new Date(endStr);

      if ((pStart && wStart < pStart) || (pEnd && wEnd > pEnd)) {
        setDateWarning(`Warning: Planned dates (${formatDate(startStr)} - ${formatDate(endStr)}) extend outside project timeframe (${formatDate(proj.start_date)} - ${formatDate(proj.end_date)}).`);
        return;
      }
    }
    setDateWarning(null);
  };

  // Open Modal for New Work Plan
  const handleOpenNewModal = () => {
    setEditingWPId(null);
    setFormErrors({});
    setDateWarning(null);

    const defaultProjId = selectedProjectId || (projects.length > 0 ? projects[0].id.toString() : '');

    setFormData({
      project_id: defaultProjId,
      wbs_phase_id: '',
      task_id: '',
      subtask_id: '',
      activity_name: '',
      description: '',
      planned_quantity: '',
      unit: 'm³',
      planned_start_date: new Date().toISOString().split('T')[0],
      planned_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: 'MEDIUM',
      dependency_id: '',
      responsible_user_name: '',
      remarks: ''
    });

    if (defaultProjId) {
      handleLoadWbsForProject(defaultProjId);
    }
    setIsModalOpen(true);
  };

  // Open Modal for Edit Work Plan
  const handleOpenEditModal = async (wp) => {
    setEditingWPId(wp.id);
    setFormErrors({});
    setDateWarning(null);

    setFormData({
      project_id: wp.project_id.toString(),
      wbs_phase_id: wp.wbs_phase_id.toString(),
      task_id: wp.task_id.toString(),
      subtask_id: wp.subtask_id ? wp.subtask_id.toString() : '',
      activity_name: wp.activity_name,
      description: wp.description || '',
      planned_quantity: wp.planned_quantity ? wp.planned_quantity.toString() : '0',
      unit: wp.unit || 'm³',
      planned_start_date: wp.planned_start_date ? wp.planned_start_date.split('T')[0] : new Date().toISOString().split('T')[0],
      planned_end_date: wp.planned_end_date ? wp.planned_end_date.split('T')[0] : new Date().toISOString().split('T')[0],
      priority: wp.priority || 'MEDIUM',
      dependency_id: wp.dependency_id ? wp.dependency_id.toString() : '',
      responsible_user_name: wp.responsible_user_name || '',
      remarks: wp.remarks || ''
    });

    await handleLoadWbsForProject(wp.project_id.toString());
    setIsModalOpen(true);
  };

  // Form Validation for Work Plan
  const validateForm = () => {
    const errs = {};
    if (!formData.project_id) errs.project_id = "Project selection is required.";
    if (!formData.wbs_phase_id) errs.wbs_phase_id = "WBS Phase selection is required.";
    if (!formData.task_id) errs.task_id = "WBS Task selection is required.";
    if (!formData.activity_name || !formData.activity_name.trim()) errs.activity_name = "Activity Name is required.";

    const qtyNum = parseFloat(formData.planned_quantity);
    if (formData.planned_quantity === '' || isNaN(qtyNum) || qtyNum < 0) {
      errs.planned_quantity = "Valid planned quantity (>= 0) is required.";
    }

    if (!formData.planned_start_date) errs.planned_start_date = "Planned Start Date is required.";
    if (!formData.planned_end_date) errs.planned_end_date = "Planned End Date is required.";
    else if (formData.planned_start_date && formData.planned_end_date < formData.planned_start_date) {
      errs.planned_end_date = "Planned End Date cannot be earlier than Planned Start Date.";
    }

    if (formData.dependency_id && editingWPId && parseInt(formData.dependency_id, 10) === editingWPId) {
      errs.dependency_id = "An activity cannot depend on itself.";
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Handler for Work Plan
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setError(null);

    const payload = {
      project_id: parseInt(formData.project_id, 10),
      wbs_phase_id: parseInt(formData.wbs_phase_id, 10),
      task_id: parseInt(formData.task_id, 10),
      subtask_id: formData.subtask_id ? parseInt(formData.subtask_id, 10) : null,
      activity_name: formData.activity_name.trim(),
      description: formData.description,
      planned_quantity: parseFloat(formData.planned_quantity) || 0.0,
      unit: formData.unit.trim(),
      planned_start_date: `${formData.planned_start_date}T00:00:00`,
      planned_end_date: `${formData.planned_end_date}T00:00:00`,
      priority: formData.priority,
      dependency_id: formData.dependency_id ? parseInt(formData.dependency_id, 10) : null,
      remarks: formData.remarks
    };

    try {
      if (editingWPId) {
        await workPlanService.updateWorkPlan(editingWPId, payload);
        setSuccessMsg("Work Plan activity updated successfully.");
      } else {
        await workPlanService.createWorkPlan(payload);
        setSuccessMsg("Work Plan activity created successfully.");
      }
      setIsModalOpen(false);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Save Work Plan error:", err);
      setError(err.response?.data?.detail || "Failed to save Work Plan activity.");
    }
  };

  // Archive Work Plan
  const handleArchive = async (wpId, wpNum) => {
    if (!window.confirm(`Are you sure you want to archive Work Plan ${wpNum}? Historical planning data will be preserved.`)) {
      return;
    }
    try {
      await workPlanService.deleteWorkPlan(wpId);
      setSuccessMsg(`Work Plan ${wpNum} archived.`);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to archive Work Plan activity.");
    }
  };

  // View Work Plan Detail Modal & Load Mapped BOQ Items
  const handleViewDetail = async (wpId) => {
    try {
      const res = await workPlanService.getWorkPlanById(wpId);
      setSelectedWP(res.data);
      await fetchBoqMappingsData(wpId);
      setIsDetailModalOpen(true);
    } catch (err) {
      console.error("Failed to load details:", err);
    }
  };

  // Group eligible BOQ items into compatible and incompatible based on unit
  const compatibleBoqItems = useMemo(() => {
    return eligibleBoqItems.filter(b => b.is_unit_compatible);
  }, [eligibleBoqItems]);

  const incompatibleBoqItems = useMemo(() => {
    return eligibleBoqItems.filter(b => !b.is_unit_compatible);
  }, [eligibleBoqItems]);

  // Disable Save Mapping button if item is unselected, incompatible, or quantity is invalid
  const isSaveBoqDisabled = useMemo(() => {
    if (!boqFormData.boq_item_id) return true;
    if (selectedBoqItemData && !selectedBoqItemData.is_unit_compatible) return true;
    const qty = parseFloat(boqFormData.mapped_quantity);
    if (boqFormData.mapped_quantity === '' || isNaN(qty) || qty <= 0) return true;
    if (selectedBoqItemData) {
      const maxAllowed = editingMappingId 
        ? (selectedBoqItemData.remaining_unmapped_qty + (boqMappings.find(m => m.id === editingMappingId)?.mapped_quantity || 0))
        : selectedBoqItemData.remaining_unmapped_qty;
      if (qty > maxAllowed + 1e-6) return true;
    }
    return false;
  }, [boqFormData, selectedBoqItemData, editingMappingId, boqMappings]);

  // FEATURE 2: OPEN MAP BOQ ITEM MODAL
  const handleOpenMapBoqModal = (mappingToEdit = null) => {
    setBoqFormErrors({});
    if (mappingToEdit) {
      setEditingMappingId(mappingToEdit.id);
      const boqItem = eligibleBoqItems.find(b => b.boq_item_id === mappingToEdit.boq_item_id);
      setSelectedBoqItemData(boqItem || null);
      setBoqFormData({
        boq_item_id: mappingToEdit.boq_item_id.toString(),
        mapped_quantity: mappingToEdit.mapped_quantity.toString(),
        unit: mappingToEdit.unit
      });
    } else {
      setEditingMappingId(null);
      // Prefer compatible BOQ items first on initial modal opening
      const comp = eligibleBoqItems.filter(b => b.is_unit_compatible);
      const firstEligible = comp.length > 0 ? comp[0] : (eligibleBoqItems.length > 0 ? eligibleBoqItems[0] : null);
      setSelectedBoqItemData(firstEligible);
      setBoqFormData({
        boq_item_id: firstEligible ? firstEligible.boq_item_id.toString() : '',
        mapped_quantity: firstEligible ? Math.min(selectedWP.planned_quantity, firstEligible.remaining_unmapped_qty).toString() : '',
        unit: firstEligible ? firstEligible.unit : selectedWP.unit
      });
    }
    setIsMapBoqModalOpen(true);
  };

  // When BOQ Item Selection Changes in Mapping Modal
  const handleBoqItemSelectChange = (e) => {
    const boqIdStr = e.target.value;
    setBoqFormData(prev => ({ ...prev, boq_item_id: boqIdStr }));

    if (!boqIdStr) {
      setSelectedBoqItemData(null);
      return;
    }

    const boqId = parseInt(boqIdStr, 10);
    const boq = eligibleBoqItems.find(b => b.boq_item_id === boqId);
    if (boq) {
      setSelectedBoqItemData(boq);
      setBoqFormData(prev => ({
        ...prev,
        mapped_quantity: Math.min(selectedWP.planned_quantity, boq.remaining_unmapped_qty).toString(),
        unit: boq.unit
      }));
    }
  };

  // Validate BOQ Mapping Form
  const validateBoqMappingForm = () => {
    const errs = {};
    if (!boqFormData.boq_item_id) {
      errs.boq_item_id = "BOQ item selection is required.";
    }

    const qty = parseFloat(boqFormData.mapped_quantity);
    if (boqFormData.mapped_quantity === '' || isNaN(qty) || qty <= 0) {
      errs.mapped_quantity = "Mapped quantity must be strictly greater than 0.";
    } else if (selectedBoqItemData) {
      const maxAllowed = editingMappingId 
        ? (selectedBoqItemData.remaining_unmapped_qty + (boqMappings.find(m => m.id === editingMappingId)?.mapped_quantity || 0))
        : selectedBoqItemData.remaining_unmapped_qty;

      if (qty > maxAllowed + 1e-6) {
        errs.mapped_quantity = `Mapped quantity (${qty.toLocaleString()} ${boqFormData.unit}) exceeds remaining BOQ quantity (${maxAllowed.toLocaleString()} ${boqFormData.unit}).`;
      }
    }

    if (selectedBoqItemData && !selectedBoqItemData.is_unit_compatible) {
      errs.unit = selectedBoqItemData.compatibility_warning || "Unit incompatibility error!";
    }

    setBoqFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit BOQ Mapping
  const handleSaveBoqMapping = async (e) => {
    e.preventDefault();
    if (!validateBoqMappingForm()) return;

    try {
      if (editingMappingId) {
        await workPlanService.updateBoqMapping(editingMappingId, {
          mapped_quantity: parseFloat(boqFormData.mapped_quantity)
        });
        setSuccessMsg("BOQ item mapping updated.");
      } else {
        await workPlanService.createBoqMapping(selectedWP.id, {
          boq_item_id: parseInt(boqFormData.boq_item_id, 10),
          mapped_quantity: parseFloat(boqFormData.mapped_quantity),
          unit: boqFormData.unit
        });
        setSuccessMsg("BOQ item mapped successfully.");
      }
      setIsMapBoqModalOpen(false);
      await fetchBoqMappingsData(selectedWP.id);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Save BOQ mapping error:", err);
      setError(err.response?.data?.detail || "Failed to save BOQ mapping.");
    }
  };

  // Remove BOQ Mapping
  const handleRemoveBoqMapping = async (mappingId, boqCode) => {
    if (!window.confirm(`Are you sure you want to remove mapping for BOQ item ${boqCode}?`)) {
      return;
    }
    try {
      await workPlanService.deleteBoqMapping(mappingId);
      setSuccessMsg(`BOQ Item mapping removed.`);
      await fetchBoqMappingsData(selectedWP.id);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to remove BOQ mapping.");
    }
  };

  // Filtered Work Plans list
  const filteredWorkPlans = useMemo(() => {
    return workPlans.filter(wp => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || (
        (wp.work_plan_number || '').toLowerCase().includes(q) ||
        (wp.activity_name || '').toLowerCase().includes(q) ||
        (wp.task_name || '').toLowerCase().includes(q) ||
        (wp.phase_name || '').toLowerCase().includes(q) ||
        (wp.project_name || '').toLowerCase().includes(q)
      );

      const matchesStatus = statusFilter === 'ALL' || wp.status === statusFilter;
      const matchesPriority = priorityFilter === 'ALL' || wp.priority === priorityFilter;

      return matchesQuery && matchesStatus && matchesPriority;
    });
  }, [workPlans, searchQuery, statusFilter, priorityFilter]);

  // Helper status badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'NOT STARTED':
        return <span className="tag-badge" style={{ background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.4)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600 }}><Clock size={12} className="inline mr-1" /> NOT STARTED</span>;
      case 'IN PROGRESS':
        return <span className="tag-badge" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600 }}><ArrowUpRight size={12} className="inline mr-1" /> IN PROGRESS</span>;
      case 'COMPLETED':
        return <span className="tag-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600 }}><CheckCircle size={12} className="inline mr-1" /> COMPLETED</span>;
      case 'DELAYED':
        return <span className="tag-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600 }}><AlertCircle size={12} className="inline mr-1" /> DELAYED</span>;
      default:
        return <span className="tag-badge">{status}</span>;
    }
  };

  // Helper priority badge
  const renderPriorityBadge = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return <span style={{ color: '#f87171', fontWeight: 700, fontSize: '0.75rem', background: 'rgba(239,68,68,0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>CRITICAL</span>;
      case 'HIGH':
        return <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.75rem', background: 'rgba(245,158,11,0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>HIGH</span>;
      case 'MEDIUM':
        return <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.75rem', background: 'rgba(56,189,248,0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>MEDIUM</span>;
      case 'LOW':
        return <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.75rem', background: 'rgba(148,163,184,0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>LOW</span>;
      default:
        return priority;
    }
  };

  // FEATURE 2: Render BOQ Mapping status badge in Work Plan table
  const renderBoqMappingBadge = (wp) => {
    const st = wp.boq_mapping_status || 'Not Mapped';
    if (st === 'Not Mapped') {
      return <span style={{ color: '#94a3b8', background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.25)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.73rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={11} /> Not Mapped</span>;
    } else if (st === 'Fully Mapped') {
      return <span style={{ color: '#34d399', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle size={11} /> Fully Mapped</span>;
    } else {
      return <span style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Layers size={11} /> {st}</span>;
    }
  };

  return (
    <div className="page-container" style={{ padding: '1.5rem', background: '#0b0f19', color: '#e2e8f0', minHeight: '100vh' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.65rem', margin: 0 }}>
            <Calendar style={{ color: '#38bdf8' }} size={28} />
            Work Plan
          </h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem', fontSize: '0.9rem' }}>
            Plan project activities, quantities and execution timelines.
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
            style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.6rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(2,132,199,0.3)', cursor: 'pointer' }}
          >
            <Plus size={18} /> Create Work Plan
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

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            TOTAL ACTIVITIES
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.3rem' }}>
            {summaryMetrics.total}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Planned project activities</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            NOT STARTED
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#cbd5e1', marginTop: '0.3rem' }}>
            {summaryMetrics.notStarted}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Future start dates (0%)</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            IN PROGRESS
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#60a5fa', marginTop: '0.3rem' }}>
            {summaryMetrics.inProgress}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Currently active window</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            COMPLETED
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#34d399', marginTop: '0.3rem' }}>
            {summaryMetrics.completed}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>100% quantity executed</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1.1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            OVERDUE
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fbbf24', marginTop: '0.3rem' }}>
            {summaryMetrics.overdue}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>Past end date</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        
        {/* Project Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '260px' }}>
          <Building2 size={16} style={{ color: '#38bdf8' }} />
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{ flex: 1, background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
          >
            <option value="">[ All Projects ]</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search by activity, task, phase or WP number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.5rem 0.75rem 0.5rem 2.25rem', color: '#f8fafc', fontSize: '0.85rem' }}
          />
        </div>

        {/* Priority Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Priority:</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.45rem 0.65rem', color: '#f8fafc', fontSize: '0.8rem' }}
          >
            <option value="ALL">All</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', background: '#0f172a', padding: '0.25rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {['ALL', 'NOT STARTED', 'IN PROGRESS', 'COMPLETED', 'DELAYED'].map(st => (
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

      {/* WORK PLAN TABLE */}
      <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} className="animate-spin inline mb-2" />
            <p>Loading work plan activities...</p>
          </div>
        ) : filteredWorkPlans.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <Calendar size={40} style={{ color: '#475569', marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: '0.2rem 0' }}>
              No Work Plan activities created yet.
            </p>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Create planned activities to start scheduling project execution.
            </p>
            <button
              onClick={handleOpenNewModal}
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.55rem 1.2rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '6px', cursor: 'pointer' }}
            >
              <Plus size={16} /> Create Work Plan
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Work Plan Ref</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Project</th>
                  <th style={{ padding: '0.85rem 1rem' }}>WBS Phase / Task</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Activity Name</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Planned Quantity</th>
                  <th style={{ padding: '0.85rem 1rem' }}>BOQ Mapping</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Start Date</th>
                  <th style={{ padding: '0.85rem 1rem' }}>End Date</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Progress</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkPlans.map(wp => (
                  <tr
                    key={wp.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s ease' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#38bdf8' }}>
                      {wp.work_plan_number}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#f8fafc', fontWeight: 500 }}>
                      {wp.project_name || `Project #${wp.project_id}`}
                      {wp.project_code && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{wp.project_code}</div>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.82rem' }}>{wp.phase_name || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{wp.task_name || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#ffffff', fontWeight: 600 }}>
                      {wp.activity_name}
                      {wp.dependency_activity_name && (
                        <div style={{ fontSize: '0.7rem', color: '#818cf8', marginTop: '0.15rem' }}>
                          Dep: {wp.dependency_activity_name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                      {wp.planned_quantity.toLocaleString()} {wp.unit}
                    </td>

                    {/* FEATURE 2: BOQ MAPPING BADGE COLUMN */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {renderBoqMappingBadge(wp)}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                      {formatDate(wp.planned_start_date)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                      {formatDate(wp.planned_end_date)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600, color: wp.progress_percentage > 0 ? '#34d399' : '#64748b' }}>
                      {wp.progress_percentage}%
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {renderStatusBadge(wp.status)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                        <button
                          onClick={() => handleViewDetail(wp.id)}
                          className="btn btn-sm"
                          style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '0.25rem 0.55rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', fontWeight: 600 }}
                          title="View Work Plan & Map BOQ"
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(wp)}
                          className="btn btn-sm"
                          style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', padding: '0.25rem 0.55rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}
                          title="Edit Work Plan"
                        >
                          <Edit size={13} /> Edit
                        </button>
                        <button
                          onClick={() => handleArchive(wp.id, wp.work_plan_number)}
                          className="btn btn-sm"
                          style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.25rem 0.45rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                          title="Archive Work Plan"
                        >
                          <Trash2 size={13} />
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

      {/* CREATE / EDIT WORK PLAN FORM MODAL */}
      {isModalOpen && (
        <div 
          onClick={() => setIsModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '12px', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}
          >
            
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={20} style={{ color: '#38bdf8' }} />
                  {editingWPId ? 'Edit Work Plan Activity' : 'Create Work Plan Activity'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                  {editingWPId ? 'Update planned activity parameters.' : 'Schedule a new activity linked to an existing WBS task.'}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><XCircle size={20} /></button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitForm} style={{ padding: '1.5rem' }}>

              {/* PROJECT & WBS SELECTION */}
              <div style={{ marginBottom: '1.25rem', background: 'rgba(30, 41, 59, 0.4)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  1. PROJECT & WBS RELATIONSHIP
                </h4>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Select Project *
                  </label>
                  <select
                    value={formData.project_id}
                    onChange={handleFormProjectChange}
                    disabled={!!editingWPId}
                    style={{ width: '100%', background: '#1e293b', border: formErrors.project_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  >
                    <option value="">[ Select Project ]</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                    ))}
                  </select>
                  {formErrors.project_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.project_id}</div>}
                </div>

                {noWbsNotice && (
                  <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', padding: '0.75rem 1rem', color: '#fbbf24', fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={16} />
                    <span>This project does not have a WBS structure yet. Create the WBS before creating a Work Plan.</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      WBS Phase *
                    </label>
                    <select
                      value={formData.wbs_phase_id}
                      onChange={handleFormPhaseChange}
                      disabled={!formData.project_id || wbsPhases.length === 0}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.wbs_phase_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    >
                      <option value="">[ Select WBS Phase ]</option>
                      {wbsPhases.map(ph => (
                        <option key={ph.id} value={ph.id}>{ph.wbs_code ? `${ph.wbs_code} ` : ''}{ph.title}</option>
                      ))}
                    </select>
                    {formErrors.wbs_phase_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.wbs_phase_id}</div>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      WBS Task *
                    </label>
                    <select
                      value={formData.task_id}
                      onChange={handleFormTaskChange}
                      disabled={!formData.wbs_phase_id || wbsTasks.length === 0}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.task_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    >
                      <option value="">[ Select WBS Task ]</option>
                      {wbsTasks.map(t => (
                        <option key={t.id} value={t.id}>{t.wbs_code ? `${t.wbs_code} ` : ''}{t.title}</option>
                      ))}
                    </select>
                    {formErrors.task_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.task_id}</div>}
                  </div>

                  {wbsSubtasks.length > 0 && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                        WBS Subtask (Optional)
                      </label>
                      <select
                        value={formData.subtask_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, subtask_id: e.target.value }))}
                        style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                      >
                        <option value="">[ Select Subtask ]</option>
                        {wbsSubtasks.map(st => (
                          <option key={st.id} value={st.id}>{st.wbs_code ? `${st.wbs_code} ` : ''}{st.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* ACTIVITY & QUANTITY */}
              <div style={{ marginBottom: '1.25rem', background: 'rgba(30, 41, 59, 0.4)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  2. PLANNED ACTIVITY & QUANTITY
                </h4>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Activity Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Site Excavation & Earthwork"
                    value={formData.activity_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, activity_name: e.target.value }))}
                    style={{ width: '100%', background: '#1e293b', border: formErrors.activity_name ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  />
                  {formErrors.activity_name && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.activity_name}</div>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Planned Quantity *
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 5000"
                      value={formData.planned_quantity}
                      onChange={(e) => setFormData(prev => ({ ...prev, planned_quantity: e.target.value }))}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.planned_quantity ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                    {formErrors.planned_quantity && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.planned_quantity}</div>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Unit *
                    </label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                      style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    >
                      <option value="m³">m³ (Cubic Meters)</option>
                      <option value="sqm">sqm (Square Meters)</option>
                      <option value="MT">MT (Metric Tonnes)</option>
                      <option value="Nos">Nos (Numbers)</option>
                      <option value="Rft">Rft (Running Feet)</option>
                      <option value="Kg">Kg (Kilograms)</option>
                      <option value="LS">LS (Lump Sum)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Description / Scope Details
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief details about the planned activity..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* TIMELINE & SCHEDULING */}
              <div style={{ marginBottom: '1.25rem', background: 'rgba(30, 41, 59, 0.4)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  3. TIMELINE & SCHEDULING
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Planned Start Date *
                    </label>
                    <input
                      type="date"
                      value={formData.planned_start_date}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, planned_start_date: e.target.value }));
                        checkProjectDateBounds(formData.project_id, e.target.value, formData.planned_end_date);
                      }}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.planned_start_date ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                    {formErrors.planned_start_date && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.planned_start_date}</div>}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      Planned End Date *
                    </label>
                    <input
                      type="date"
                      value={formData.planned_end_date}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, planned_end_date: e.target.value }));
                        checkProjectDateBounds(formData.project_id, formData.planned_start_date, e.target.value);
                      }}
                      style={{ width: '100%', background: '#1e293b', border: formErrors.planned_end_date ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                    />
                    {formErrors.planned_end_date && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.planned_end_date}</div>}
                  </div>
                </div>

                {dateWarning && (
                  <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', padding: '0.65rem 0.85rem', color: '#fbbf24', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertTriangle size={15} />
                    <span>{dateWarning}</span>
                  </div>
                )}
              </div>

              {/* PRIORITY, DEPENDENCY & REMARKS */}
              <div style={{ marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Priority
                  </label>
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

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    Dependency (Predecessor Activity)
                  </label>
                  <select
                    value={formData.dependency_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, dependency_id: e.target.value }))}
                    style={{ width: '100%', background: '#1e293b', border: formErrors.dependency_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                  >
                    <option value="">[ None / Standalone Activity ]</option>
                    {workPlans
                      .filter(w => w.id !== editingWPId && (!formData.project_id || w.project_id === parseInt(formData.project_id, 10)))
                      .map(w => (
                        <option key={w.id} value={w.id}>
                          {w.work_plan_number} — {w.activity_name}
                        </option>
                      ))}
                  </select>
                  {formErrors.dependency_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{formErrors.dependency_id}</div>}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Remarks / Execution Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Special instructions or mobilization notes..."
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.55rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>

              {/* Form Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.55rem 1.1rem', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.55rem 1.3rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Check size={16} /> {editingWPId ? 'Save Changes' : 'Create Activity'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* VIEW WORK PLAN DETAIL MODAL WITH MAPPED BOQ ITEMS SECTION */}
      {isDetailModalOpen && selectedWP && (
        <div 
          onClick={() => setIsDetailModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '12px', width: '100%', maxWidth: '850px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}
          >
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.95)', position: 'sticky', top: 0, zIndex: 10 }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>WORK PLAN ACTIVITY DETAILS</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{selectedWP.work_plan_number} — {selectedWP.activity_name}</h3>
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)} 
                className="btn btn-secondary"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc', fontWeight: 600, padding: '0.45rem 0.9rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <XCircle size={15} /> Close
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', fontSize: '0.85rem' }}>
              
              {/* Top Banner Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', background: 'rgba(30, 41, 59, 0.5)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Status</div>
                  <div style={{ marginTop: '0.25rem' }}>{renderStatusBadge(selectedWP.status)}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Priority</div>
                  <div style={{ marginTop: '0.25rem' }}>{renderPriorityBadge(selectedWP.priority)}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Progress</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: selectedWP.progress_percentage > 0 ? '#34d399' : '#94a3b8', marginTop: '0.2rem' }}>
                    {selectedWP.progress_percentage}%
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Planned Quantity</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>
                    {selectedWP.planned_quantity.toLocaleString()} {selectedWP.unit}
                  </div>
                </div>
              </div>

              {/* Relationship Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                
                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: '#38bdf8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>PROJECT & WBS HIERARCHY</div>
                  
                  <div style={{ marginBottom: '0.4rem' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Project: </span>
                    <span style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedWP.project_name} ({selectedWP.project_code})</span>
                  </div>

                  <div style={{ marginBottom: '0.4rem' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>WBS Phase: </span>
                    <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{selectedWP.phase_name || 'N/A'}</span>
                  </div>

                  <div style={{ marginBottom: '0.4rem' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>WBS Task: </span>
                    <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{selectedWP.task_name || 'N/A'}</span>
                  </div>

                  {selectedWP.subtask_name && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem' }}>WBS Subtask: </span>
                      <span style={{ color: '#cbd5e1' }}>{selectedWP.subtask_name}</span>
                    </div>
                  )}
                </div>

                <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ color: '#38bdf8', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>EXECUTION TIMELINE</div>
                  
                  <div style={{ marginBottom: '0.4rem' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Planned Start Date: </span>
                    <span style={{ color: '#f8fafc', fontWeight: 600 }}>{formatDate(selectedWP.planned_start_date)}</span>
                  </div>

                  <div style={{ marginBottom: '0.4rem' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Planned End Date: </span>
                    <span style={{ color: '#f8fafc', fontWeight: 600 }}>{formatDate(selectedWP.planned_end_date)}</span>
                  </div>

                  <div style={{ marginBottom: '0.4rem' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Dependency: </span>
                    <span style={{ color: '#818cf8', fontWeight: 600 }}>{selectedWP.dependency_activity_name || 'None (Standalone)'}</span>
                  </div>

                  {selectedWP.responsible_user_name && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Responsible: </span>
                      <span style={{ color: '#cbd5e1' }}>{selectedWP.responsible_user_name}</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Description & Remarks */}
              {selectedWP.description && (
                <div style={{ marginBottom: '1.25rem', background: 'rgba(30, 41, 59, 0.4)', padding: '0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>Description / Scope</div>
                  <div style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{selectedWP.description}</div>
                </div>
              )}

              {/* FEATURE 2: MAPPED BOQ ITEMS SECTION */}
              <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '10px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileSpreadsheet size={18} /> MAPPED BOQ ITEMS
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                      BOQ items linked to this Work Plan activity for project quantity tracking.
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpenMapBoqModal(null)}
                    className="btn btn-sm"
                    style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.45rem 0.95rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
                  >
                    <Plus size={14} /> Map BOQ Item
                  </button>
                </div>

                {/* BOQ Summary Stats Bar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem', background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Total BOQ Items Mapped:</span>
                    <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem' }}>{boqMappings.length}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Total BOQ Quantity Mapped:</span>
                    <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.95rem' }}>
                      {boqMappings.reduce((sum, m) => sum + (parseFloat(m.mapped_quantity) || 0), 0).toLocaleString()} {selectedWP.unit}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Mapping Completion:</span>
                    <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.95rem' }}>
                      {selectedWP.planned_quantity > 0 
                        ? `${Math.min(100, Math.round((boqMappings.reduce((sum, m) => sum + (parseFloat(m.mapped_quantity) || 0), 0) / selectedWP.planned_quantity) * 100))}%`
                        : '0%'}
                    </div>
                  </div>
                </div>

                {/* BOQ Mappings Table */}
                {boqMappings.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', background: '#0f172a', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.08)' }}>
                    <FileSpreadsheet size={28} style={{ color: '#475569', marginBottom: '0.32rem' }} />
                    <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: 0 }}>No BOQ items mapped to this activity yet.</p>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>Click "+ Map BOQ Item" to assign project BOQ items.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                          <th style={{ padding: '0.65rem 0.85rem' }}>BOQ Code</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Description</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Unit</th>
                          <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>BOQ Total Qty</th>
                          <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Mapped Qty</th>
                          <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Remaining Qty</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Allocation Status</th>
                          <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {boqMappings.map(m => (
                          <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#38bdf8' }}>{m.boq_code}</td>
                            <td style={{ padding: '0.65rem 0.85rem', color: '#f8fafc', fontWeight: 500 }}>{m.boq_description}</td>
                            <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>{m.unit}</td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#cbd5e1' }}>{m.boq_total_quantity.toLocaleString()}</td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>{m.mapped_quantity.toLocaleString()}</td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#fbbf24' }}>{m.remaining_quantity.toLocaleString()}</td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              {m.mapping_status === 'FULLY ALLOCATED' ? (
                                <span style={{ color: '#34d399', background: 'rgba(16,185,129,0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>FULLY ALLOCATED</span>
                              ) : (
                                <span style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>PARTIALLY MAPPED</span>
                              )}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.3rem' }}>
                                <button
                                  onClick={() => handleOpenMapBoqModal(m)}
                                  style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer' }}
                                  title="Edit Mapped Quantity"
                                >
                                  <Edit size={12} /> Edit
                                </button>
                                <button
                                  onClick={() => handleRemoveBoqMapping(m.id, m.boq_code)}
                                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '0.2rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer' }}
                                  title="Remove BOQ Mapping"
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

            </div>

            {/* Modal Footer with Close Button */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(15, 23, 42, 0.95)' }}>
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

      {/* FEATURE 2: MAP BOQ ITEM MODAL */}
      {isMapBoqModalOpen && selectedWP && (
        <div 
          onClick={() => setIsMapBoqModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0f172a', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', width: '100%', maxWidth: '600px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6)' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileSpreadsheet size={18} />
                  {editingMappingId ? 'Edit BOQ Item Mapping' : 'Map BOQ Item to Work Plan'}
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.15rem 0 0 0' }}>
                  Activity: <strong style={{ color: '#f8fafc' }}>{selectedWP.work_plan_number} — {selectedWP.activity_name}</strong>
                </p>
              </div>
              <button onClick={() => setIsMapBoqModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><XCircle size={20} /></button>
            </div>

            {/* Work Plan Activity Unit Context Banner */}
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', padding: '0.55rem 0.85rem', marginBottom: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: '#cbd5e1' }}>Work Plan Activity Unit:</span>
              <span style={{ color: '#38bdf8', fontWeight: 700, background: 'rgba(56, 189, 248, 0.18)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.15rem 0.55rem', borderRadius: '4px', fontSize: '0.82rem' }}>
                {selectedWP.unit}
              </span>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveBoqMapping}>

              {/* Project-scoped BOQ Item Selection */}
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Select Project BOQ Item *
                </label>
                {eligibleBoqItems.length === 0 ? (
                  <div style={{ color: '#fbbf24', fontSize: '0.8rem', padding: '0.65rem', background: 'rgba(245,158,11,0.1)', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.2)' }}>
                    No BOQ items found for project '{selectedWP.project_name}'. Create BOQ items in BOQ & Measurement Book module first.
                  </div>
                ) : (
                  <select
                    value={boqFormData.boq_item_id}
                    onChange={handleBoqItemSelectChange}
                    disabled={!!editingMappingId}
                    style={{ 
                      width: '100%', 
                      background: '#1e293b', 
                      border: (boqFormErrors.boq_item_id || (selectedBoqItemData && !selectedBoqItemData.is_unit_compatible)) 
                        ? '1px solid #ef4444' 
                        : '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '6px', 
                      padding: '0.55rem 0.75rem', 
                      color: '#f8fafc', 
                      fontSize: '0.85rem' 
                    }}
                  >
                    <option value="">[ Select Project BOQ Item ]</option>
                    
                    {compatibleBoqItems.length > 0 && (
                      <optgroup label={`✓ Compatible BOQ Items (${selectedWP.unit})`}>
                        {compatibleBoqItems.map(b => (
                          <option key={b.boq_item_id} value={b.boq_item_id}>
                            {b.boq_code} — {b.item_name} ({b.approved_qty.toLocaleString()} {b.unit}) — Remaining: {b.remaining_unmapped_qty.toLocaleString()} {b.unit}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {incompatibleBoqItems.length > 0 && (
                      <optgroup label="⚠️ Incompatible BOQ Items (Different Unit)">
                        {incompatibleBoqItems.map(b => (
                          <option key={b.boq_item_id} value={b.boq_item_id}>
                            {b.boq_code} — {b.item_name} ({b.approved_qty.toLocaleString()} {b.unit}) [Incompatible Unit]
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}
                {boqFormErrors.boq_item_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{boqFormErrors.boq_item_id}</div>}
              </div>

              {/* Auto-populated BOQ Info Card */}
              {selectedBoqItemData && (
                <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: selectedBoqItemData.is_unit_compatible ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '0.85rem 1rem', marginBottom: '1.1rem', fontSize: '0.82rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>BOQ Item Name:</span>
                    <div style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedBoqItemData.item_name}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>BOQ Code:</span>
                    <div style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedBoqItemData.boq_code}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>BOQ Approved Quantity:</span>
                    <div style={{ color: '#cbd5e1', fontWeight: 600 }}>{selectedBoqItemData.approved_qty.toLocaleString()} {selectedBoqItemData.unit}</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Remaining Unmapped Quantity:</span>
                    <div style={{ color: '#fbbf24', fontWeight: 700 }}>{selectedBoqItemData.remaining_unmapped_qty.toLocaleString()} {selectedBoqItemData.unit}</div>
                  </div>
                </div>
              )}

              {/* Unit Incompatibility Warning */}
              {selectedBoqItemData && !selectedBoqItemData.is_unit_compatible && (
                <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '0.75rem 0.85rem', marginBottom: '1.1rem', color: '#f87171', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Incompatible Unit:</strong> BOQ item unit (<strong>{selectedBoqItemData.unit}</strong>) does not match Work Plan unit (<strong>{selectedWP.unit}</strong>). Cannot save mapping.
                  </div>
                </div>
              )}

              {/* Mapped Quantity Field */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Mapped Quantity ({selectedBoqItemData ? selectedBoqItemData.unit : selectedWP.unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder={`Enter quantity in ${selectedBoqItemData ? selectedBoqItemData.unit : selectedWP.unit}...`}
                  value={boqFormData.mapped_quantity}
                  onChange={(e) => setBoqFormData(prev => ({ ...prev, mapped_quantity: e.target.value }))}
                  disabled={selectedBoqItemData && !selectedBoqItemData.is_unit_compatible}
                  style={{ 
                    width: '100%', 
                    background: (selectedBoqItemData && !selectedBoqItemData.is_unit_compatible) ? '#0f172a' : '#1e293b', 
                    border: boqFormErrors.mapped_quantity ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '6px', 
                    padding: '0.55rem 0.75rem', 
                    color: (selectedBoqItemData && !selectedBoqItemData.is_unit_compatible) ? '#64748b' : '#f8fafc', 
                    fontSize: '0.85rem' 
                  }}
                />
                {boqFormErrors.mapped_quantity && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{boqFormErrors.mapped_quantity}</div>}
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsMapBoqModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.45rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaveBoqDisabled}
                  className="btn btn-primary"
                  style={{ 
                    background: isSaveBoqDisabled ? '#334155' : 'linear-gradient(135deg, #0284c7, #0369a1)', 
                    border: 'none', 
                    color: isSaveBoqDisabled ? '#94a3b8' : '#ffffff', 
                    fontWeight: 600, 
                    padding: '0.45rem 1.2rem', 
                    borderRadius: '6px', 
                    cursor: isSaveBoqDisabled ? 'not-allowed' : 'pointer', 
                    opacity: isSaveBoqDisabled ? 0.5 : 1 
                  }}
                >
                  Save Mapping
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
