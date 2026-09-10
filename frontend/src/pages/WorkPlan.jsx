import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Layers, CheckCircle, Clock, AlertCircle, XCircle, 
  Plus, Search, Filter, RefreshCw, Eye, Edit, Trash2, ArrowUpRight, 
  Building2, Hash, FileText, Check, AlertTriangle, User, Tag, FileSpreadsheet,
  Link, DollarSign, Target
} from 'lucide-react';
import { workPlanService, projectService, wbsService } from '../services/api';

export default function WorkPlan() {
  const navigate = useNavigate();
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
  const [editModalTab, setEditModalTab] = useState('details'); // 'details' | 'boq'

  // FEATURE 2: BOQ Mapping State
  const [boqMappings, setBoqMappings] = useState([]);
  const [eligibleBoqItems, setEligibleBoqItems] = useState([]);
  const [isMapBoqModalOpen, setIsMapBoqModalOpen] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState(null);
  const [boqFormData, setBoqFormData] = useState({
    boq_item_id: '',
    wbs_node_id: '',
    mapped_quantity: '',
    unit: ''
  });
  const [selectedBoqItemData, setSelectedBoqItemData] = useState(null);
  const [boqFormErrors, setBoqFormErrors] = useState({});

  // WPT-02: Publish & Remap State
  const [publishReadiness, setPublishReadiness] = useState(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isRemapModalOpen, setIsRemapModalOpen] = useState(false);
  const [targetOrphanedMapping, setTargetOrphanedMapping] = useState(null);
  const [selectedRemapBoqId, setSelectedRemapBoqId] = useState('');
  const [remapLoading, setRemapLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);

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
    if (selectedProjectId) {
      fetchPublishReadiness(selectedProjectId);
    } else {
      setPublishReadiness(null);
    }
  }, [selectedProjectId]);

  const fetchPublishReadiness = async (projId) => {
    if (!projId) {
      setPublishReadiness(null);
      return;
    }
    try {
      const res = await workPlanService.getPublishReadiness(projId);
      setPublishReadiness(res.data);
    } catch (e) {
      console.error("Failed to load publish readiness:", e);
    }
  };

  const handlePublishWorkPlan = async () => {
    if (!selectedProjectId) {
      alert("Please select a project to publish its Work Plan.");
      return;
    }
    setPublishLoading(true);
    setError(null);
    try {
      const res = await workPlanService.publishWorkPlan(selectedProjectId);
      setSuccessMsg(res.data.message || "Work Plan published successfully!");
      setIsPublishModalOpen(false);
      fetchData();
      fetchPublishReadiness(selectedProjectId);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      const detail = err.response?.data?.detail || "Failed to publish Work Plan.";
      setError(detail);
      await fetchPublishReadiness(selectedProjectId);
      setIsPublishModalOpen(true);
    } finally {
      setPublishLoading(false);
    }
  };

  const handleOpenRemapModal = (orphanedMapping) => {
    setTargetOrphanedMapping(orphanedMapping);
    setSelectedRemapBoqId('');
    setIsRemapModalOpen(true);
  };

  const handleExecuteRemap = async (e) => {
    e.preventDefault();
    if (!selectedRemapBoqId || !targetOrphanedMapping) return;
    setRemapLoading(true);
    try {
      await workPlanService.remapBoqMapping(targetOrphanedMapping.mapping_id || targetOrphanedMapping.id, {
        target_boq_item_id: parseInt(selectedRemapBoqId, 10)
      });
      setSuccessMsg("Orphaned mapping remapped successfully!");
      setIsRemapModalOpen(false);
      fetchData();
      if (selectedWP) {
        fetchBoqMappingsData(selectedWP.id);
      }
      if (selectedProjectId) {
        fetchPublishReadiness(selectedProjectId);
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to remap BOQ item.");
    } finally {
      setRemapLoading(false);
    }
  };

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
    setSelectedWP(wp);
    setEditModalTab('details');
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

    await Promise.all([
      handleLoadWbsForProject(wp.project_id.toString()),
      fetchBoqMappingsData(wp.id)
    ]);
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

  // Live over-mapped detection for dynamic warning display
  const isOverMapped = useMemo(() => {
    if (!selectedBoqItemData) return false;
    const qty = parseFloat(boqFormData.mapped_quantity);
    if (boqFormData.mapped_quantity === '' || isNaN(qty) || qty <= 0) return false;
    const maxAllowed = editingMappingId 
      ? (selectedBoqItemData.remaining_unmapped_qty + (boqMappings.find(m => m.id === editingMappingId)?.mapped_quantity || 0))
      : selectedBoqItemData.remaining_unmapped_qty;
    return qty > maxAllowed + 1e-6;
  }, [boqFormData.mapped_quantity, selectedBoqItemData, editingMappingId, boqMappings]);

  // FEATURE 2: OPEN MAP BOQ ITEM MODAL
  const handleOpenMapBoqModal = async (mappingToEdit = null, wpTarget = null, preselectBoqId = null) => {
    setBoqFormErrors({});
    const activeWP = wpTarget || selectedWP;
    if (activeWP) {
      setSelectedWP(activeWP);
      try {
        const [mappingsRes, eligibleRes] = await Promise.all([
          workPlanService.getBoqMappings(activeWP.id),
          workPlanService.getEligibleBoqItems(activeWP.id)
        ]);
        const mList = mappingsRes.data || [];
        const eList = eligibleRes.data || [];
        setBoqMappings(mList);
        setEligibleBoqItems(eList);

        if (mappingToEdit) {
          setEditingMappingId(mappingToEdit.id);
          const boqItem = eList.find(b => b.boq_item_id === mappingToEdit.boq_item_id);
          setSelectedBoqItemData(boqItem || null);
          setBoqFormData({
            boq_item_id: mappingToEdit.boq_item_id.toString(),
            wbs_node_id: activeWP.id.toString(),
            mapped_quantity: mappingToEdit.mapped_quantity.toString(),
            unit: mappingToEdit.unit
          });
        } else {
          setEditingMappingId(null);
          let targetBoq = null;
          if (preselectBoqId) {
            targetBoq = eList.find(b => b.boq_item_id === preselectBoqId);
          }
          if (!targetBoq) {
            const comp = eList.filter(b => b.is_unit_compatible);
            targetBoq = comp.length > 0 ? comp[0] : (eList.length > 0 ? eList[0] : null);
          }
          setSelectedBoqItemData(targetBoq || null);
          setBoqFormData({
            boq_item_id: targetBoq ? targetBoq.boq_item_id.toString() : '',
            wbs_node_id: activeWP.id.toString(),
            mapped_quantity: '',
            unit: targetBoq ? targetBoq.unit : activeWP.unit
          });
        }
      } catch (err) {
        console.error("Failed to load BOQ items:", err);
      }
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
        errs.mapped_quantity = `Mapped quantity exceeds remaining unmapped quantity. Remaining balance: ${maxAllowed} ${boqFormData.unit || selectedBoqItemData.unit}.`;
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
    if (e) e.preventDefault();
    if (!validateBoqMappingForm()) return;

    try {
      const targetWpId = boqFormData.wbs_node_id ? parseInt(boqFormData.wbs_node_id, 10) : selectedWP.id;
      if (editingMappingId) {
        await workPlanService.updateBoqMapping(editingMappingId, {
          mapped_quantity: parseFloat(boqFormData.mapped_quantity)
        });
        setSuccessMsg("BOQ item mapping updated successfully.");
      } else {
        await workPlanService.createBoqMapping(targetWpId, {
          boq_item_id: parseInt(boqFormData.boq_item_id, 10),
          work_plan_id: targetWpId,
          mapped_quantity: parseFloat(boqFormData.mapped_quantity),
          unit: boqFormData.unit || selectedBoqItemData?.unit
        });
        setSuccessMsg("BOQ item mapped successfully.");
      }
      setEditingMappingId(null);
      setBoqFormData(prev => ({ ...prev, mapped_quantity: '' }));
      if (selectedWP) {
        await fetchBoqMappingsData(selectedWP.id);
      }
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Save BOQ mapping error:", err);
      const msg = err.response?.data?.detail || "Failed to save BOQ mapping.";
      setBoqFormErrors(prev => ({ ...prev, general: msg }));
      setError(msg);
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
      if (selectedWP) {
        await fetchBoqMappingsData(selectedWP.id);
      }
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

  // FEATURE 2: Render BOQ Mapping status badge / action button in Work Plan table
  const renderBoqMappingBadge = (wp) => {
    const st = wp.boq_mapping_status || 'Not Mapped';
    if (st === 'Not Mapped') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenMapBoqModal(null, wp);
          }}
          style={{
            color: '#38bdf8',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            padding: '0.25rem 0.65rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Click to map BOQ items to this activity"
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.25)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)'; }}
        >
          <Plus size={12} /> Map BOQ
        </button>
      );
    } else if (st === 'Fully Mapped') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenMapBoqModal(null, wp);
          }}
          style={{
            color: '#34d399',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            padding: '0.25rem 0.65rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            cursor: 'pointer'
          }}
          title="Fully Mapped — Click to view/edit mappings"
        >
          <CheckCircle size={12} /> Fully Mapped
        </button>
      );
    } else {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenMapBoqModal(null, wp);
          }}
          style={{
            color: '#38bdf8',
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            padding: '0.25rem 0.65rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            cursor: 'pointer'
          }}
          title="Click to view/edit mappings"
        >
          <Layers size={12} /> {st}
        </button>
      );
    }
  };

  // Renders the functional BOQ Mapping UI (used both inside Edit modal and standalone Map BOQ modal)
  const renderBoqMappingSection = () => {
    if (!selectedWP) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
          Please select a Work Plan Activity first.
        </div>
      );
    }

    const totalMapped = boqMappings.reduce((sum, m) => sum + (parseFloat(m.mapped_quantity) || 0), 0);

    return (
      <div style={{ padding: '1rem 1.25rem' }}>
        {/* Activity & Mapping Metrics Summary */}
        <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', padding: '0.85rem 1.1rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Activity Planned Quantity</div>
            <div style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 700 }}>
              {selectedWP.planned_quantity?.toLocaleString()} {selectedWP.unit}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
              {selectedWP.work_plan_number} — {selectedWP.activity_name}
            </div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Total BOQ Mapped</div>
            <div style={{ color: '#34d399', fontSize: '1.25rem', fontWeight: 700 }}>
              {totalMapped.toLocaleString()} {selectedWP.unit}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
              {boqMappings.length} item(s) mapped
            </div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>Remaining to Map</div>
            <div style={{ color: Math.max(0, (selectedWP.planned_quantity || 0) - totalMapped) > 0 ? '#fbbf24' : '#34d399', fontSize: '1.25rem', fontWeight: 700 }}>
              {Math.max(0, (selectedWP.planned_quantity || 0) - totalMapped).toLocaleString()} {selectedWP.unit}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
              Activity balance
            </div>
          </div>
        </div>

        {/* Existing Mappings Table */}
        <div style={{ marginBottom: '1.5rem', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.6)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#f8fafc', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Layers size={15} style={{ color: '#38bdf8' }} /> Current BOQ Mappings
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {boqMappings.length} record(s)
            </span>
          </div>

          {boqMappings.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              No BOQ items mapped to this activity yet. Use the form below to add a mapping.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(15, 23, 42, 0.9)', color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.04em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>BOQ Item</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>BOQ Qty</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Mapped Qty</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Remaining Qty</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>WBS Node</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {boqMappings.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{m.boq_description}</div>
                        <div style={{ fontSize: '0.7rem', color: '#38bdf8' }}>{m.boq_code}</div>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#cbd5e1' }}>
                        {m.boq_total_quantity.toLocaleString()} {m.unit}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                        {m.mapped_quantity.toLocaleString()} {m.unit}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#fbbf24', fontWeight: 600 }}>
                        {m.remaining_quantity.toLocaleString()} {m.unit}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', color: '#e2e8f0' }}>
                        {m.wbs_node_name || selectedWP.activity_name}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenMapBoqModal(m)}
                            className="btn btn-sm"
                            style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer' }}
                          >
                            <Edit size={12} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveBoqMapping(m.id, m.boq_code)}
                            className="btn btn-sm"
                            style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer' }}
                          >
                            <Trash2 size={12} /> Delete
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

        {/* Functional Add/Edit Mapping Form */}
        <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', padding: '1.25rem' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Plus size={16} /> {editingMappingId ? 'Edit BOQ Mapping' : '+ Add BOQ Mapping'}
          </h4>

          {boqFormErrors.general && (
            <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.65rem 0.85rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.82rem' }}>
              {boqFormErrors.general}
            </div>
          )}

          <form onSubmit={handleSaveBoqMapping}>
            {/* 1. BOQ Item Lookup */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                BOQ Item *
              </label>
              {eligibleBoqItems.length === 0 ? (
                <div style={{ color: '#fbbf24', fontSize: '0.8rem', padding: '0.65rem', background: 'rgba(245,158,11,0.1)', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.2)' }}>
                  No BOQ items found for project '{selectedWP.project_name}'. Create or approve items in Detailed Estimate first.
                </div>
              ) : (
                <select
                  value={boqFormData.boq_item_id}
                  onChange={handleBoqItemSelectChange}
                  disabled={!!editingMappingId}
                  style={{
                    width: '100%',
                    background: '#1e293b',
                    border: boqFormErrors.boq_item_id ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    padding: '0.55rem 0.75rem',
                    color: '#f8fafc',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">[ Select BOQ Item from current Detailed Estimate ]</option>
                  {eligibleBoqItems.map(b => (
                    <option key={b.boq_item_id} value={b.boq_item_id}>
                      {b.boq_code} — {b.item_name} ({b.approved_qty.toLocaleString()} {b.unit}) — Remaining: {b.remaining_unmapped_qty.toLocaleString()} {b.unit}
                    </option>
                  ))}
                </select>
              )}
              {boqFormErrors.boq_item_id && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{boqFormErrors.boq_item_id}</div>}
            </div>

            {/* Dynamic Display Cards: BOQ Quantity, Already Mapped, Remaining */}
            {selectedBoqItemData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.1rem' }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '0.75rem 0.9rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>BOQ Quantity</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#cbd5e1', marginTop: '0.15rem' }}>
                    {selectedBoqItemData.approved_qty.toLocaleString()} {selectedBoqItemData.unit}
                  </div>
                </div>
                <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '0.75rem 0.9rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Already Mapped</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.15rem' }}>
                    {selectedBoqItemData.total_allocated_qty.toLocaleString()} {selectedBoqItemData.unit}
                  </div>
                </div>
                <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: selectedBoqItemData.remaining_unmapped_qty > 0 ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '0.75rem 0.9rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Remaining</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: selectedBoqItemData.remaining_unmapped_qty > 0 ? '#34d399' : '#f87171', marginTop: '0.15rem' }}>
                    {selectedBoqItemData.remaining_unmapped_qty.toLocaleString()} {selectedBoqItemData.unit}
                  </div>
                </div>
              </div>
            )}

            {/* 2. WBS Node Dropdown */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                WBS Node *
              </label>
              <select
                value={boqFormData.wbs_node_id || selectedWP.id.toString()}
                onChange={(e) => setBoqFormData(prev => ({ ...prev, wbs_node_id: e.target.value }))}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '0.55rem 0.75rem',
                  color: '#f8fafc',
                  fontSize: '0.85rem'
                }}
              >
                {workPlans.filter(w => w.project_id === selectedWP.project_id).map(w => (
                  <option key={w.id} value={w.id}>
                    {w.task_name ? `${w.task_name} ` : ''}({w.work_plan_number} — {w.activity_name})
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                Only WBS nodes / activities belonging to {selectedWP.project_name} may be selected.
              </div>
            </div>

            {/* 3. Mapped Quantity Field */}
            <div style={{ marginBottom: '1.1rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Mapped Quantity ({selectedBoqItemData ? selectedBoqItemData.unit : selectedWP.unit}) *
              </label>
              <input
                type="number"
                step="any"
                placeholder={`Enter mapped quantity in ${selectedBoqItemData ? selectedBoqItemData.unit : selectedWP.unit}...`}
                value={boqFormData.mapped_quantity}
                onChange={(e) => setBoqFormData(prev => ({ ...prev, mapped_quantity: e.target.value }))}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: (boqFormErrors.mapped_quantity || isOverMapped) ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '0.55rem 0.75rem',
                  color: '#f8fafc',
                  fontSize: '0.85rem'
                }}
              />
              {boqFormErrors.mapped_quantity && <div style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '0.3rem' }}>{boqFormErrors.mapped_quantity}</div>}
            </div>

            {/* Live Over-Mapping Warning Alert */}
            {isOverMapped && selectedBoqItemData && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                <div>
                  <strong>BLOCK SAVE:</strong> Mapped quantity exceeds remaining unmapped quantity. Remaining balance: {selectedBoqItemData.remaining_unmapped_qty} {selectedBoqItemData.unit}.
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              {editingMappingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMappingId(null);
                    setBoqFormData(prev => ({ ...prev, mapped_quantity: '' }));
                  }}
                  className="btn btn-secondary"
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.45rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                disabled={isSaveBoqDisabled || isOverMapped}
                className="btn btn-primary"
                style={{
                  background: (isSaveBoqDisabled || isOverMapped) ? '#334155' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                  border: 'none',
                  color: (isSaveBoqDisabled || isOverMapped) ? '#94a3b8' : '#ffffff',
                  fontWeight: 600,
                  padding: '0.55rem 1.4rem',
                  borderRadius: '6px',
                  cursor: (isSaveBoqDisabled || isOverMapped) ? 'not-allowed' : 'pointer'
                }}
              >
                Save Mapping
              </button>
            </div>

          </form>
        </div>
      </div>
    );
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

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {selectedProjectId && (
            <button
              onClick={handlePublishWorkPlan}
              disabled={publishLoading}
              className="btn"
              style={{
                background: publishReadiness?.can_publish
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'rgba(239, 68, 68, 0.15)',
                border: publishReadiness?.can_publish
                  ? 'none'
                  : '1px solid rgba(239, 68, 68, 0.4)',
                color: publishReadiness?.can_publish ? '#ffffff' : '#fca5a5',
                fontWeight: 600,
                padding: '0.6rem 1.15rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                borderRadius: '6px',
                boxShadow: publishReadiness?.can_publish ? '0 4px 12px rgba(16,185,129,0.3)' : 'none'
              }}
            >
              <CheckCircle size={17} />
              {publishLoading ? "Publishing..." : "Publish Work Plan"}
            </button>
          )}
          <button
            onClick={() => navigate(selectedProjectId ? `/milestones?projectId=${selectedProjectId}` : '/milestones')}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', fontWeight: 600, padding: '0.6rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
          >
            <Target size={16} /> Milestones (WPT-03)
          </button>
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

      {/* Publish Readiness Summary Banner */}
      {selectedProjectId && publishReadiness && (
        <div style={{
          background: publishReadiness.can_publish ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          border: publishReadiness.can_publish ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {publishReadiness.can_publish ? (
              <CheckCircle size={22} style={{ color: '#34d399', flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={22} style={{ color: '#fbbf24', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontWeight: 600, color: publishReadiness.can_publish ? '#34d399' : '#fbbf24', fontSize: '0.92rem' }}>
                {publishReadiness.can_publish 
                  ? "Work Plan 100% BOQ Mapped & Ready for Publish" 
                  : `Publish Blocked: ${publishReadiness.unmapped_count + publishReadiness.partially_mapped_count} BOQ item(s) unmapped / partially mapped${publishReadiness.orphaned_count > 0 ? `, ${publishReadiness.orphaned_count} orphaned mapping(s)` : ''}`
                }
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                Total BOQ items: <strong>{publishReadiness.total_boq_items}</strong> | Fully Mapped: <strong style={{ color: '#34d399' }}>{publishReadiness.fully_mapped_count}</strong> | Unmapped/Partial: <strong style={{ color: '#fbbf24' }}>{publishReadiness.unmapped_count + publishReadiness.partially_mapped_count}</strong> | Orphaned: <strong style={{ color: '#f87171' }}>{publishReadiness.orphaned_count}</strong>
              </div>
            </div>
          </div>
          {!publishReadiness.can_publish && (
            <button
              onClick={() => setIsPublishModalOpen(true)}
              style={{
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#fbbf24',
                padding: '0.4rem 0.85rem',
                borderRadius: '5px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Eye size={14} /> Review Unmapped Lines
            </button>
          )}
        </div>
      )}

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
                          onClick={() => handleOpenMapBoqModal(null, wp)}
                          className="btn btn-sm"
                          style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#38bdf8', padding: '0.25rem 0.55rem', borderRadius: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontWeight: 600 }}
                          title="Manage BOQ Mappings"
                        >
                          <FileSpreadsheet size={13} /> BOQ
                        </button>
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

            {/* Tab Navigation if Editing an Existing Activity */}
            {editingWPId && (
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(15, 23, 42, 0.7)', padding: '0 1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditModalTab('details')}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: editModalTab === 'details' ? '2px solid #38bdf8' : '2px solid transparent',
                    color: editModalTab === 'details' ? '#38bdf8' : '#94a3b8',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  1. Activity Details
                </button>
                <button
                  type="button"
                  onClick={() => setEditModalTab('boq')}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: editModalTab === 'boq' ? '2px solid #38bdf8' : '2px solid transparent',
                    color: editModalTab === 'boq' ? '#38bdf8' : '#94a3b8',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <FileSpreadsheet size={15} /> 2. BOQ Mapping ({boqMappings.length})
                </button>
              </div>
            )}

            {editingWPId && editModalTab === 'boq' ? (
              <div>
                {renderBoqMappingSection()}
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(15, 23, 42, 0.95)' }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn btn-secondary"
                    style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#ffffff', fontWeight: 600, padding: '0.55rem 1.4rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              /* Modal Form Body */
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

              {/* BOQ MAPPING DIRECT ACCESS CALLOUT (WHEN EDITING) */}
              {editingWPId && (
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileSpreadsheet size={16} style={{ color: '#38bdf8' }} /> BOQ → Work Plan Mapping
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      Status: <strong style={{ color: boqMappings.length > 0 ? '#34d399' : '#fbbf24' }}>
                        {boqMappings.length > 0 ? `${boqMappings.length} BOQ Item(s) Mapped` : 'Not Mapped'}
                      </strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditModalTab('boq')}
                    style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', color: '#ffffff', padding: '0.45rem 1rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Plus size={14} /> Map BOQ Items →
                  </button>
                </div>
              )}

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
          )}
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
            style={{ background: '#0f172a', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', width: '100%', maxWidth: '850px', maxHeight: '92vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6)' }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileSpreadsheet size={20} />
                  BOQ → Work Plan Activity Mapping
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                  Project: <strong style={{ color: '#f8fafc' }}>{selectedWP.project_name}</strong> | Activity: <strong style={{ color: '#f8fafc' }}>{selectedWP.work_plan_number} — {selectedWP.activity_name}</strong>
                </p>
              </div>
              <button onClick={() => setIsMapBoqModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><XCircle size={22} /></button>
            </div>

            {renderBoqMappingSection()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                onClick={() => setIsMapBoqModalOpen(false)}
                className="btn btn-secondary"
                style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#ffffff', fontWeight: 600, padding: '0.5rem 1.3rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PUBLISH READINESS VALIDATION MODAL */}
      {isPublishModalOpen && publishReadiness && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                  <AlertTriangle style={{ color: '#fbbf24' }} size={24} />
                  Work Plan Publish Readiness
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                  Project: <strong>{projects.find(p => p.id === parseInt(selectedProjectId, 10))?.name || selectedProjectId}</strong>
                </p>
              </div>
              <button onClick={() => setIsPublishModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><XCircle size={22} /></button>
            </div>

            {/* Status Summary Banner */}
            <div style={{ background: publishReadiness.can_publish ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: publishReadiness.can_publish ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 600, color: publishReadiness.can_publish ? '#34d399' : '#f87171', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                {publishReadiness.can_publish ? "✓ Work Plan 100% BOQ Mapped & Ready for Publish" : "⚠️ Work Plan Publication Blocked"}
              </div>
              {publishReadiness.blocking_reasons && publishReadiness.blocking_reasons.map((reason, idx) => (
                <div key={idx} style={{ color: '#fca5a5', fontSize: '0.83rem', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  • {reason}
                </div>
              ))}
            </div>

            {/* Orphaned Mappings Section */}
            {publishReadiness.orphaned_mappings && publishReadiness.orphaned_mappings.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f87171', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={18} /> Orphaned Mappings ({publishReadiness.orphaned_mappings.length})
                </h3>
                <div style={{ overflowX: 'auto', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Work Plan Activity</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Original BOQ</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Mapped Qty</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Reason</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {publishReadiness.orphaned_mappings.map((orph, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#f8fafc', fontWeight: 600 }}>{orph.wbs_node_name}</td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>{orph.original_boq_code} — {orph.original_boq_name}</td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>{orph.mapped_quantity} {orph.unit}</td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#f87171', fontStyle: 'italic' }}>{orph.orphaned_reason}</td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <button
                              onClick={() => { setIsPublishModalOpen(false); handleOpenRemapModal(orph); }}
                              style={{ background: 'linear-gradient(135deg, #eab308, #ca8a04)', border: 'none', color: '#ffffff', padding: '0.35rem 0.75rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Remap
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Unmapped / Partially Mapped BOQ Items Section */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fbbf24', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={18} /> Unmapped / Partially Mapped BOQ Items ({publishReadiness.unmapped_or_partial_items?.length || 0})
              </h3>
              {(!publishReadiness.unmapped_or_partial_items || publishReadiness.unmapped_or_partial_items.length === 0) ? (
                <div style={{ color: '#34d399', fontSize: '0.85rem', padding: '0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: '6px' }}>
                  ✓ All BOQ items for this project are 100% mapped!
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#1e293b', color: '#cbd5e1' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>BOQ Code</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Description</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>BOQ Total Qty</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Mapped Qty</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Remaining Unmapped</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Status</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {publishReadiness.unmapped_or_partial_items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#38bdf8', fontWeight: 600 }}>{item.boq_code}</td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#f8fafc' }}>{item.description}</td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>{item.boq_quantity.toLocaleString()} {item.unit}</td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#cbd5e1' }}>{item.mapped_quantity.toLocaleString()} {item.unit}</td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#fbbf24', fontWeight: 700 }}>{item.remaining_quantity.toLocaleString()} {item.unit}</td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{
                              background: item.status === 'UNMAPPED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                              color: item.status === 'UNMAPPED' ? '#f87171' : '#fbbf24',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 600
                            }}>
                              {item.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setIsPublishModalOpen(false);
                                const targetWp = workPlans.find(w => w.project_id === parseInt(selectedProjectId, 10));
                                if (targetWp) {
                                  handleOpenMapBoqModal(null, targetWp, item.boq_item_id);
                                }
                              }}
                              style={{
                                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                border: 'none',
                                color: '#ffffff',
                                padding: '0.3rem 0.75rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                            >
                              <Plus size={12} /> Map Now
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(false)}
                className="btn btn-secondary"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.5rem 1.25rem', borderRadius: '6px', cursor: 'pointer' }}
              >
                Close
              </button>
              {publishReadiness.can_publish && (
                <button
                  type="button"
                  onClick={handlePublishWorkPlan}
                  disabled={publishLoading}
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.5rem 1.25rem', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {publishLoading ? "Publishing..." : "Publish Work Plan Now"}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ORPHANED MAPPING REMAP MODAL */}
      {isRemapModalOpen && targetOrphanedMapping && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', width: '100%', maxWidth: '550px', padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Link style={{ color: '#eab308' }} size={22} />
                Remap Orphaned BOQ Mapping
              </h2>
              <button onClick={() => setIsRemapModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><XCircle size={20} /></button>
            </div>

            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
              <div style={{ color: '#f87171', fontWeight: 600, marginBottom: '0.35rem' }}>Orphaned Mapping Info:</div>
              <div style={{ color: '#cbd5e1' }}>Activity: <strong>{targetOrphanedMapping.wbs_node_name}</strong></div>
              <div style={{ color: '#cbd5e1' }}>Original BOQ: <strong>{targetOrphanedMapping.original_boq_code} — {targetOrphanedMapping.original_boq_name}</strong></div>
              <div style={{ color: '#cbd5e1' }}>Mapped Qty: <strong>{targetOrphanedMapping.mapped_quantity} {targetOrphanedMapping.unit}</strong></div>
            </div>

            <form onSubmit={handleExecuteRemap}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Select Replacement BOQ Item in Approved Estimate *
                </label>
                <select
                  value={selectedRemapBoqId}
                  onChange={(e) => setSelectedRemapBoqId(e.target.value)}
                  required
                  style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0.6rem 0.75rem', color: '#f8fafc', fontSize: '0.85rem' }}
                >
                  <option value="">[ Select Replacement BOQ Item ]</option>
                  {eligibleBoqItems.map(b => (
                    <option key={b.boq_item_id} value={b.boq_item_id}>
                      {b.boq_code} — {b.item_name} ({b.approved_qty.toLocaleString()} {b.unit}) — Remaining: {b.remaining_unmapped_qty.toLocaleString()} {b.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsRemapModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.45rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedRemapBoqId || remapLoading}
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #eab308, #ca8a04)', border: 'none', color: '#ffffff', fontWeight: 600, padding: '0.45rem 1.25rem', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {remapLoading ? "Remapping..." : "Save Remapping"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
