import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { HardHat, Plus, Camera, Upload, CheckCircle2, Clock, AlertCircle, ArrowLeft, Layers, CheckSquare, X, Image as ImageIcon, Trash2, Filter, Eye, User, Calendar, Tag, Activity, CalendarDays, AlertTriangle } from 'lucide-react';
import { projectService, siteLogService, boqMbService, authService, workPlanService, getFileUrl } from '../services/api';

const getImageUrl = (filePath) => getFileUrl(filePath);

export default function SiteLogs() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const urlProjectId = searchParams.get('projectId');
  const urlTab = searchParams.get('tab');

  // Sub-tab Navigation: 'logs' | 'gallery'
  const initialTab = (location.pathname === '/photo-gallery' || urlTab === 'gallery') ? 'gallery' : 'logs';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (location.pathname === '/photo-gallery' || urlTab === 'gallery') {
      setActiveTab('gallery');
    } else if (urlTab === 'logs') {
      setActiveTab('logs');
    }
  }, [location.pathname, urlTab]);

  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId || '');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // WBS, BOQ and Work Plan data for dynamic selection
  const [wbsData, setWbsData] = useState({ phases: [], tasks: [], subtasks: [] });
  const [boqs, setBoqs] = useState([]);
  const [workPlans, setWorkPlans] = useState([]);
  const [workPlanContexts, setWorkPlanContexts] = useState({}); // wp_id -> context

  // Daily Task Monitoring list state in create modal
  const [monitoredTasks, setMonitoredTasks] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    physical_progress: '',
    labour_count: '',
    materials_consumed: '',
    equipment_used: '',
    issues_identified: '',
    remarks: '',
    phase_id: '',
    task_id: '',
    subtask_id: '',
    boq_item_id: '',
    executed_qty_today: ''
  });

  // Photo Input & Preview State
  const [selectedPhotos, setSelectedPhotos] = useState([]); // [{ id, file, previewUrl, caption }]
  const [photoError, setPhotoError] = useState('');
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Lightbox Preview Modal State
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Log Details Modal State (opened from Gallery or Card)
  const [detailLog, setDetailLog] = useState(null);

  // Photo Gallery State & Filters
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryFilters, setGalleryFilters] = useState({
    project_id: '',
    phase_id: '',
    task_id: '',
    uploaded_by_id: '',
    date: ''
  });

  // Load Projects & Users on mount
  useEffect(() => {
    projectService.getProjects()
      .then((res) => {
        const prjs = res.data || [];
        setProjects(prjs);
        if (!selectedProjectId && prjs.length > 0) {
          setSelectedProjectId(prjs[0].id.toString());
        }
      })
      .catch((err) => console.error("Error loading projects:", err));

    authService.getUsers()
      .then((res) => setUsers(res.data || []))
      .catch(() => {});
  }, []);

  // Load Logs, WBS Hierarchy, BOQ Items & Work Plans for selected project
  const loadProjectData = (projectId) => {
    if (!projectId) return;
    setLoading(true);

    Promise.all([
      siteLogService.getProjectLogs(projectId),
      boqMbService.getWbsHierarchy(projectId),
      boqMbService.getBoqItems(projectId),
      workPlanService.getWorkPlans({ project_id: projectId })
    ])
      .then(([logRes, wbsRes, boqRes, wpRes]) => {
        setLogs(logRes.data || []);
        setWbsData(wbsRes.data || { phases: [], tasks: [], subtasks: [] });
        setBoqs(boqRes.data || []);
        setWorkPlans(wpRes.data || []);
      })
      .catch((err) => console.error("Error loading site log data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectData(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Fetch Photo Gallery Records
  const fetchPhotoGallery = () => {
    setGalleryLoading(true);
    const params = {};
    if (galleryFilters.project_id) params.project_id = galleryFilters.project_id;
    if (galleryFilters.phase_id) params.phase_id = galleryFilters.phase_id;
    if (galleryFilters.task_id) params.task_id = galleryFilters.task_id;
    if (galleryFilters.uploaded_by_id) params.uploaded_by_id = galleryFilters.uploaded_by_id;
    if (galleryFilters.date) params.date = galleryFilters.date;

    siteLogService.getPhotoGallery(params)
      .then((res) => setGalleryPhotos(res.data || []))
      .catch((err) => console.error("Error loading photo gallery:", err))
      .finally(() => setGalleryLoading(false));
  };

  useEffect(() => {
    if (activeTab === 'gallery') {
      fetchPhotoGallery();
    }
  }, [activeTab, galleryFilters]);

  // Sync selected project into gallery filter if empty
  useEffect(() => {
    if (selectedProjectId && !galleryFilters.project_id) {
      setGalleryFilters(prev => ({ ...prev, project_id: selectedProjectId }));
    }
  }, [selectedProjectId]);

  // Filtered dropdowns for WBS Cascade
  const availableTasks = wbsData.tasks.filter(t => !formData.phase_id || t.parent_task_id === parseInt(formData.phase_id));
  const availableSubtasks = wbsData.subtasks.filter(s => !formData.task_id || s.parent_task_id === parseInt(formData.task_id));

  // Filtered BOQ Items based on WBS Location selection
  const availableBoqs = boqs.filter(b => {
    if (formData.subtask_id) return b.subtask_id === parseInt(formData.subtask_id);
    if (formData.task_id) return b.task_id === parseInt(formData.task_id);
    if (formData.phase_id) return b.phase_id === parseInt(formData.phase_id);
    return true;
  });

  // Selected BOQ item and WBS details
  const selectedPhase = wbsData.phases.find(p => p.id === parseInt(formData.phase_id));
  const selectedTask = wbsData.tasks.find(t => t.id === parseInt(formData.task_id));
  const selectedSubtask = wbsData.subtasks.find(s => s.id === parseInt(formData.subtask_id));
  const selectedWbsCode = selectedSubtask?.wbs_code || selectedTask?.wbs_code || selectedPhase?.wbs_code || '';

  const selectedBoq = boqs.find(b => b.id === parseInt(formData.boq_item_id));
  const approvedQty = selectedBoq ? parseFloat(selectedBoq.approved_qty) : 0;
  const prevExecutedQty = selectedBoq ? parseFloat(selectedBoq.executed_qty) : 0;
  const execToday = parseFloat(formData.executed_qty_today) || 0;
  
  const totalExecuted = prevExecutedQty + execToday;
  const remainingQty = approvedQty - totalExecuted;
  const executionPct = approvedQty > 0 ? Math.round((totalExecuted / approvedQty) * 10000) / 100 : 0;
  const isOverExecuted = totalExecuted > approvedQty;

  // Handle Photo File Selection & Validation
  const handlePhotoSelect = (e) => {
    setPhotoError('');
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    const maxPhotosLimit = 10;

    if (selectedPhotos.length + files.length > maxPhotosLimit) {
      setPhotoError(`Maximum ${maxPhotosLimit} photos allowed per Daily Site Log. You currently have ${selectedPhotos.length} photo(s).`);
      return;
    }

    const newPhotos = [];
    for (let file of files) {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      const validExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
      const validMime = allowedTypes.includes(file.type.toLowerCase());

      if (!validExt && !validMime) {
        setPhotoError(`Invalid file format '${file.name}'. Only JPG, JPEG, PNG, and WEBP formats are supported.`);
        return;
      }

      if (file.size > maxSizeBytes) {
        setPhotoError(`File '${file.name}' exceeds the maximum allowed size of 10MB.`);
        return;
      }

      newPhotos.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        previewUrl: URL.createObjectURL(file),
        caption: ''
      });
    }

    setSelectedPhotos(prev => [...prev, ...newPhotos]);
    // Reset inputs
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = (id) => {
    setSelectedPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleCaptionChange = (id, text) => {
    setSelectedPhotos(prev => prev.map(p => p.id === id ? { ...p, caption: text } : p));
  };

  // Helper for Work Plan Context Fetching
  const fetchWorkPlanContext = async (wpId) => {
    if (!wpId || workPlanContexts[wpId]) return workPlanContexts[wpId];
    try {
      const res = await siteLogService.getWorkPlanContext(wpId);
      const ctx = res.data;
      setWorkPlanContexts(prev => ({ ...prev, [wpId]: ctx }));
      return ctx;
    } catch (err) {
      console.error("Failed to load work plan context:", err);
      return null;
    }
  };

  const handleAddMonitoredTask = () => {
    setMonitoredTasks(prev => [
      ...prev,
      {
        work_plan_id: '',
        boq_mapping_id: '',
        boq_item_id: '',
        task_status: 'IN PROGRESS',
        executed_quantity: 0,
        unit: 'sqm',
        execution_notes: '',
        delay_reason: ''
      }
    ]);
  };

  const handleRemoveMonitoredTask = (index) => {
    setMonitoredTasks(prev => prev.filter((_, i) => i !== index));
  };

  const handleMonitoredTaskChange = async (index, field, value) => {
    const updated = [...monitoredTasks];
    updated[index][field] = value;

    if (field === 'work_plan_id' && value) {
      const ctx = await fetchWorkPlanContext(value);
      if (ctx) {
        // Pre-populate BOQ mapping and unit if available
        if (ctx.mapped_boq_items && ctx.mapped_boq_items.length > 0) {
          const firstBoq = ctx.mapped_boq_items[0];
          updated[index].boq_mapping_id = firstBoq.mapping_id;
          updated[index].boq_item_id = firstBoq.boq_item_id;
          updated[index].unit = firstBoq.boq_unit || ctx.unit || 'sqm';
        } else {
          updated[index].unit = ctx.unit || 'sqm';
        }

        // Future activity check
        if (ctx.is_future_activity) {
          updated[index].task_status = 'NOT STARTED';
          updated[index].executed_quantity = 0;
        } else if (ctx.is_delayed_activity) {
          updated[index].task_status = 'DELAYED';
        }
      }
    } else if (field === 'boq_mapping_id' && value && updated[index].work_plan_id) {
      const ctx = workPlanContexts[updated[index].work_plan_id];
      if (ctx && ctx.mapped_boq_items) {
        const found = ctx.mapped_boq_items.find(m => m.mapping_id === parseInt(value));
        if (found) {
          updated[index].boq_item_id = found.boq_item_id;
          updated[index].unit = found.boq_unit || ctx.unit || 'sqm';
        }
      }
    }

    setMonitoredTasks(updated);
  };

  const handleCreateLog = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("Please select a project first.");
      return;
    }

    if (execToday < 0) {
      alert("Executed Quantity Today cannot be negative.");
      return;
    }

    // Format daily_tasks payload
    const formattedDailyTasks = monitoredTasks.map(t => ({
      work_plan_id: parseInt(t.work_plan_id),
      boq_mapping_id: t.boq_mapping_id ? parseInt(t.boq_mapping_id) : null,
      boq_item_id: t.boq_item_id ? parseInt(t.boq_item_id) : null,
      task_status: t.task_status,
      executed_quantity: parseFloat(t.executed_quantity || 0),
      unit: t.unit || 'sqm',
      execution_notes: t.execution_notes || '',
      delay_reason: t.delay_reason || ''
    }));

    try {
      // Step 1: Create Daily Site Log with daily_tasks
      const createRes = await siteLogService.createLog({
        project_id: parseInt(selectedProjectId),
        physical_progress: formData.physical_progress,
        labour_count: parseInt(formData.labour_count || 0),
        materials_consumed: formData.materials_consumed,
        equipment_used: formData.equipment_used,
        issues_identified: formData.issues_identified,
        remarks: formData.remarks,
        phase_id: formData.phase_id ? parseInt(formData.phase_id) : null,
        task_id: formData.task_id ? parseInt(formData.task_id) : null,
        subtask_id: formData.subtask_id ? parseInt(formData.subtask_id) : null,
        boq_item_id: formData.boq_item_id ? parseInt(formData.boq_item_id) : null,
        executed_qty: execToday,
        daily_tasks: formattedDailyTasks
      });

      const newLogId = createRes.data?.id;

      // Step 2: Upload attached photos if present
      if (newLogId && selectedPhotos.length > 0) {
        const uploadFormData = new FormData();
        selectedPhotos.forEach(p => {
          uploadFormData.append('files', p.file);
          uploadFormData.append('captions', p.caption || '');
        });

        if (formData.phase_id) uploadFormData.append('phase_id', formData.phase_id);
        if (formData.task_id) uploadFormData.append('task_id', formData.task_id);
        if (formData.subtask_id) uploadFormData.append('subtask_id', formData.subtask_id);
        if (formData.boq_item_id) uploadFormData.append('boq_item_id', formData.boq_item_id);

        await siteLogService.uploadPhotos(newLogId, uploadFormData);
      }

      setShowModal(false);
      setFormData({
        physical_progress: '',
        labour_count: '',
        materials_consumed: '',
        equipment_used: '',
        issues_identified: '',
        remarks: '',
        phase_id: '',
        task_id: '',
        subtask_id: '',
        boq_item_id: '',
        executed_qty_today: ''
      });
      setMonitoredTasks([]);
      setSelectedPhotos([]);
      setPhotoError('');
      loadProjectData(selectedProjectId);
      if (activeTab === 'gallery') fetchPhotoGallery();
      alert("Daily Site Progress Log, Task Monitoring & Photos submitted successfully!");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to submit Daily Site Progress Log");
    }
  };

  const openLogDetailModal = (logId) => {
    siteLogService.getLogById(logId)
      .then((res) => setDetailLog(res.data))
      .catch((err) => alert(err.response?.data?.detail || "Failed to load site log details"));
  };

  const currentProject = projects.find(p => p.id === parseInt(selectedProjectId));

  return (
    <div className="content-page">
      {/* Hidden inputs for camera capture & file upload */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handlePhotoSelect}
      />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={handlePhotoSelect}
      />

      {/* Navigation Header */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {selectedProjectId ? (
          <button className="btn btn-secondary" onClick={() => navigate(`/projects/${selectedProjectId}`)}>
            <ArrowLeft size={16} /> Back to Project Details
          </button>
        ) : <div />}

        {currentProject && (
          <span className="tag-badge tag-info" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
            Project: <strong>{currentProject.name}</strong> | {currentProject.code}
          </span>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Site Daily Logs & Photo Gallery</h1>
          <p className="page-subtitle">Site Engineer daily progress, site photo evidence, labour, equipment & BOQ execution tracking</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select className="form-control" style={{ width: '260px' }} value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> New Site Daily Log
          </button>
        </div>
      </div>

      {/* SUB-TAB SWITCHER */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('logs')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <CheckSquare size={16} /> Daily Site Logs ({logs.length})
        </button>
        <button
          className={`btn ${activeTab === 'gallery' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('gallery')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <ImageIcon size={16} /> Site Photo Gallery
        </button>
      </div>

      {/* TAB 1: DAILY SITE LOGS FEED */}
      {activeTab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {logs.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              {loading ? "Loading site logs..." : "No daily site logs logged for this project yet."}
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                  <div>
                    <span className="tag-badge tag-info">Log Date: {new Date(log.log_date).toLocaleDateString()}</span>
                    <h3 style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>Site Log #{log.id} - Engineer #{log.engineer_id}</span>
                      <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => openLogDetailModal(log.id)}>
                        <Eye size={12} /> View Full Details
                      </button>
                    </h3>
                  </div>
                  <span className={`tag-badge ${log.approval_status === 'approved' ? 'tag-success' : log.approval_status === 'rejected' ? 'tag-danger' : 'tag-warning'}`}>
                    Approval: {log.approval_status.toUpperCase()}
                  </span>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#38bdf8' }}>Physical Progress Summary:</strong>
                  <p style={{ color: '#f8fafc', fontSize: '0.9rem', marginTop: '0.2rem' }}>{log.physical_progress}</p>
                </div>

                {/* BOQ Execution Metrics Card */}
                {log.boq_item_id && (
                  <div style={{ padding: '0.85rem', background: 'rgba(56,189,248,0.06)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8' }}>
                        📦 BOQ Work Measurement Log: {log.boq_item_name}
                      </span>
                      <span className="tag-badge tag-success" style={{ fontWeight: 700 }}>
                        Execution: {log.execution_pct}%
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', fontSize: '0.8rem' }}>
                      <div>Approved Qty: <strong>{log.approved_qty} {log.unit}</strong></div>
                      <div>Executed Today: <strong style={{ color: '#10b981' }}>{log.executed_qty} {log.unit}</strong></div>
                      <div>Total Executed: <strong style={{ color: '#38bdf8' }}>{log.total_executed_qty} {log.unit}</strong></div>
                      <div>Remaining Qty: <strong style={{ color: '#f59e0b' }}>{log.remaining_qty} {log.unit}</strong></div>
                    </div>
                  </div>
                )}

                {/* Monitored Daily Tasks List */}
                {log.daily_tasks && log.daily_tasks.length > 0 && (
                  <div style={{ padding: '0.85rem', background: 'rgba(16,185,129,0.06)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.25)', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Activity size={15} /> MONITORED WORK PLAN ACTIVITIES ({log.daily_tasks.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {log.daily_tasks.map((task) => (
                        <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <strong style={{ color: '#f8fafc' }}>{task.work_plan_name || `WP Task #${task.work_plan_id}`}</strong>
                            {task.wbs_name && <span style={{ color: '#38bdf8', marginLeft: '0.5rem' }}>({task.wbs_name})</span>}
                            {task.execution_notes && <div style={{ fontSize: '0.75rem', color: '#cbd5e1', fontStyle: 'italic', marginTop: '0.1rem' }}>"{task.execution_notes}"</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span style={{ color: '#10b981', fontWeight: 700 }}>+ {task.executed_quantity} {task.unit}</span>
                            <span className={`tag-badge ${task.task_status === 'COMPLETED' ? 'tag-success' : task.task_status === 'DELAYED' ? 'tag-danger' : task.task_status === 'IN PROGRESS' ? 'tag-info' : 'tag-warning'}`} style={{ fontSize: '0.72rem' }}>
                              {task.task_status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'rgba(15,23,42,0.6)', padding: '0.9rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>On-Site Labour Workforce</div>
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>{log.labour_count} Workers</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Materials Consumed</div>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{log.materials_consumed || 'None recorded'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Machinery & Equipment</div>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{log.equipment_used || 'Standard tools'}</div>
                  </div>
                </div>

                {log.issues_identified && (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '8px', fontSize: '0.85rem', color: '#fca5a5' }}>
                    <strong>Site Blockers / Issues:</strong> {log.issues_identified}
                  </div>
                )}

                {/* SITE PHOTOS THUMBNAILS ATTACHED TO LOG */}
                {log.photos && log.photos.length > 0 && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Camera size={14} /> SITE PHOTOS ({log.photos.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
                      {log.photos.map(p => (
                        <div
                          key={p.id}
                          style={{
                            position: 'relative',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: '#0f172a',
                            cursor: 'pointer'
                          }}
                          onClick={() => setPreviewPhoto(p)}
                        >
                          <img
                            src={getImageUrl(p.file_path)}
                            alt={p.caption || p.file_name}
                            style={{ width: '100%', height: '90px', objectFit: 'cover', display: 'block' }}
                          />
                          {p.caption && (
                            <div style={{ padding: '0.35rem 0.4rem', fontSize: '0.72rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.caption}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: PROJECT PHOTO GALLERY */}
      {activeTab === 'gallery' && (
        <div>
          {/* Gallery Filters */}
          <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', background: 'rgba(15,23,42,0.7)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: '#38bdf8', fontWeight: 700, fontSize: '0.9rem' }}>
              <Filter size={16} /> Photo Gallery Filters
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Project</label>
                <select className="form-control" style={{ fontSize: '0.82rem' }} value={galleryFilters.project_id} onChange={e => setGalleryFilters({ ...galleryFilters, project_id: e.target.value })}>
                  <option value="">All Projects</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.code}: {p.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Log Date</label>
                <input
                  type="date"
                  className="form-control"
                  style={{ fontSize: '0.82rem' }}
                  value={galleryFilters.date}
                  onChange={e => setGalleryFilters({ ...galleryFilters, date: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>WBS Phase</label>
                <select className="form-control" style={{ fontSize: '0.82rem' }} value={galleryFilters.phase_id} onChange={e => setGalleryFilters({ ...galleryFilters, phase_id: e.target.value })}>
                  <option value="">All Phases</option>
                  {wbsData.phases.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>WBS Task</label>
                <select className="form-control" style={{ fontSize: '0.82rem' }} value={galleryFilters.task_id} onChange={e => setGalleryFilters({ ...galleryFilters, task_id: e.target.value })}>
                  <option value="">All Tasks</option>
                  {wbsData.tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Uploaded By</label>
                <select className="form-control" style={{ fontSize: '0.82rem' }} value={galleryFilters.uploaded_by_id} onChange={e => setGalleryFilters({ ...galleryFilters, uploaded_by_id: e.target.value })}>
                  <option value="">All Users</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Gallery Cards Grid */}
          {galleryLoading ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              Loading project photo gallery...
            </div>
          ) : galleryPhotos.length === 0 ? (
            <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              No photos found matching selected gallery filters.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
              {galleryPhotos.map((photo) => (
                <div key={photo.id} className="glass-card" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {/* Thumbnail Image */}
                    <div
                      style={{ position: 'relative', height: '170px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', marginBottom: '0.75rem', background: '#020617' }}
                      onClick={() => setPreviewPhoto(photo)}
                    >
                      <img
                        src={getImageUrl(photo.file_path)}
                        alt={photo.caption || photo.file_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.7)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', color: '#fff' }}>
                        🔍 Click Preview
                      </div>
                    </div>

                    {/* Metadata Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span className="tag-badge tag-info" style={{ fontSize: '0.72rem' }}>
                        <Calendar size={12} style={{ display: 'inline', marginRight: '3px' }} />
                        {new Date(photo.created_at).toLocaleDateString()}
                      </span>

                      {/* Daily Log Reference Badge */}
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', borderColor: '#38bdf8', color: '#38bdf8' }}
                        onClick={() => openLogDetailModal(photo.site_log_id)}
                      >
                        <Tag size={11} style={{ display: 'inline', marginRight: '3px' }} />
                        Log #DSL-{photo.site_log_id}
                      </button>
                    </div>

                    {/* Project & WBS Info */}
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.25rem' }}>
                      {photo.project_name || `Project #${photo.project_id}`}
                    </div>
                    {(photo.phase_name || photo.task_name) && (
                      <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginBottom: '0.4rem' }}>
                        {photo.phase_name}{photo.task_name ? ` → ${photo.task_name}` : ''}
                      </div>
                    )}

                    {/* Caption */}
                    {photo.caption && (
                      <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: '0.25rem 0 0.5rem 0', fontStyle: 'italic' }}>
                        "{photo.caption}"
                      </p>
                    )}
                  </div>

                  {/* Uploader Footer */}
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.4rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <User size={12} /> Uploaded by: <strong style={{ color: '#f8fafc' }}>{photo.uploader_name || 'Site Engineer'}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE DAILY LOG MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '1.5rem 1rem' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '680px', background: '#1e293b', padding: '1.75rem', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc', fontSize: '1.1rem', fontWeight: 700 }}>
                <HardHat size={20} color="#38bdf8" /> Submit Daily Site Progress Log
              </h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateLog}>
              <div className="form-group" style={{ marginBottom: '1rem', width: '100%', minWidth: 0 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.35rem', display: 'block' }}>
                  Physical Progress Summary *
                </label>
                <textarea 
                  required 
                  className="form-control" 
                  rows={2} 
                  style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', resize: 'vertical' }}
                  placeholder="Completed pour of foundation slab B2 level (800 cu.m)..." 
                  value={formData.physical_progress} 
                  onChange={e => setFormData({ ...formData, physical_progress: e.target.value })} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                <div className="form-group" style={{ marginBottom: 0, width: '100%', minWidth: 0 }}>
                  <label style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem', display: 'block' }}>
                    Labour Count (Workers on Site)
                  </label>
                  <input 
                    required 
                    type="number" 
                    min="0"
                    className="form-control" 
                    style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}
                    placeholder="45" 
                    value={formData.labour_count} 
                    onChange={e => setFormData({ ...formData, labour_count: e.target.value })} 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0, width: '100%', minWidth: 0 }}>
                  <label style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem', display: 'block' }}>
                    Equipment Used
                  </label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}
                    placeholder="Concrete Pump Trucks x 3" 
                    value={formData.equipment_used} 
                    onChange={e => setFormData({ ...formData, equipment_used: e.target.value })} 
                  />
                </div>
              </div>

              {/* WORK / QUANTITY PROGRESS SECTION */}
              <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'rgba(15,23,42,0.85)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.35)', marginBottom: '1rem', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.92rem', fontWeight: 700, borderBottom: '1px solid rgba(56,189,248,0.2)', paddingBottom: '0.5rem' }}>
                  <HardHat size={18} /> WORK / QUANTITY PROGRESS
                </h4>

                {/* Selectors: Phase -> Task -> Subtask -> BOQ Item */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                  <div style={{ width: '100%', minWidth: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.3rem', display: 'block' }}>Phase *</label>
                    <select className="form-control" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: '0.82rem' }} value={formData.phase_id} onChange={e => setFormData({ ...formData, phase_id: e.target.value, task_id: '', subtask_id: '', boq_item_id: '' })}>
                      <option value="">-- Select Phase --</option>
                      {wbsData.phases.map(p => <option key={p.id} value={p.id}>{p.wbs_code ? `${p.wbs_code} - ` : ''}{p.title}</option>)}
                    </select>
                  </div>

                  <div style={{ width: '100%', minWidth: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.3rem', display: 'block' }}>Task *</label>
                    <select className="form-control" disabled={!formData.phase_id} style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: '0.82rem', opacity: !formData.phase_id ? 0.6 : 1 }} value={formData.task_id} onChange={e => setFormData({ ...formData, task_id: e.target.value, subtask_id: '', boq_item_id: '' })}>
                      <option value="">{formData.phase_id ? '-- Select Task --' : 'Select a phase first'}</option>
                      {availableTasks.map(t => <option key={t.id} value={t.id}>{t.wbs_code ? `${t.wbs_code} - ` : ''}{t.title}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                  <div style={{ width: '100%', minWidth: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.3rem', display: 'block' }}>Subtask (where applicable)</label>
                    <select className="form-control" disabled={!formData.task_id} style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: '0.82rem', opacity: !formData.task_id ? 0.6 : 1 }} value={formData.subtask_id} onChange={e => setFormData({ ...formData, subtask_id: e.target.value, boq_item_id: '' })}>
                      <option value="">{formData.task_id ? '-- Select Subtask --' : 'Select a task first'}</option>
                      {availableSubtasks.map(s => <option key={s.id} value={s.id}>{s.wbs_code ? `${s.wbs_code} - ` : ''}{s.title}</option>)}
                    </select>
                  </div>

                  <div style={{ width: '100%', minWidth: 0 }}>
                    <label style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 600, marginBottom: '0.3rem', display: 'block' }}>BOQ Item *</label>
                    <select className="form-control" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: '0.82rem', fontWeight: 600 }} value={formData.boq_item_id} onChange={e => setFormData({ ...formData, boq_item_id: e.target.value })}>
                      <option value="">-- Select BOQ Item --</option>
                      {availableBoqs.map(b => (
                        <option key={b.id} value={b.id}>BOQ-{String(b.id).padStart(3, '0')}: {b.item_name} ({b.approved_qty} {b.unit})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Auto-Populated Quantity Progress Box */}
                {selectedBoq ? (
                  <div style={{ background: 'rgba(15,23,42,0.9)', padding: '0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', marginTop: '0.5rem', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.82rem', color: '#cbd5e1', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '0.5rem', minWidth: 0 }}>
                      <div><strong>WBS:</strong> <span style={{ color: '#38bdf8' }}>{selectedWbsCode ? `${selectedWbsCode} - ` : ''}{selectedSubtask?.title || selectedTask?.title || selectedPhase?.title || 'Selected WBS Node'}</span></div>
                      <div><strong>BOQ:</strong> <span style={{ color: '#f8fafc' }}>{selectedBoq.item_name}</span></div>
                      <div><strong>Unit:</strong> <span style={{ color: '#f8fafc' }}>{selectedBoq.unit}</span></div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem', fontSize: '0.82rem', minWidth: 0 }}>
                      <div style={{ background: 'rgba(56,189,248,0.08)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                        <span style={{ color: '#94a3b8' }}>Planned Quantity:</span> <strong style={{ color: '#38bdf8', float: 'right' }}>{approvedQty.toLocaleString()} {selectedBoq.unit}</strong>
                      </div>
                      <div style={{ background: 'rgba(56,189,248,0.08)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                        <span style={{ color: '#94a3b8' }}>Previous Cumulative:</span> <strong style={{ color: '#38bdf8', float: 'right' }}>{prevExecutedQty.toLocaleString()} {selectedBoq.unit}</strong>
                      </div>
                    </div>

                    {/* Single Input Field: Today's Executed Quantity */}
                    <div className="form-group" style={{ marginBottom: '0.75rem', width: '100%', minWidth: 0 }}>
                      <label style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.3rem', display: 'block' }}>Today's Executed Qty ({selectedBoq.unit}) *</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0"
                        className="form-control" 
                        style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', fontSize: '0.95rem', fontWeight: 700, borderColor: '#10b981' }}
                        placeholder="Enter quantity completed today..." 
                        value={formData.executed_qty_today} 
                        onChange={e => setFormData({ ...formData, executed_qty_today: e.target.value })} 
                      />
                    </div>

                    {/* Automatic Calculated Results Display */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', padding: '0.65rem', background: 'rgba(16,185,129,0.12)', borderRadius: '6px', fontSize: '0.82rem', minWidth: 0 }}>
                      <div>New Cumulative: <strong style={{ color: '#10b981' }}>{totalExecuted.toLocaleString()} {selectedBoq.unit}</strong></div>
                      <div>Remaining Quantity: <strong style={{ color: remainingQty <= 0 ? '#f43f5e' : '#f59e0b' }}>{remainingQty.toLocaleString()} {selectedBoq.unit}</strong></div>
                      <div>Progress: <strong style={{ color: executionPct >= 100 ? '#10b981' : '#38bdf8' }}>{executionPct}%</strong></div>
                    </div>

                    {/* Validation Error Alert */}
                    {isOverExecuted && (
                      <div style={{ marginTop: '0.75rem', padding: '0.65rem', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: '6px', fontSize: '0.8rem', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <AlertCircle size={16} /> Today's executed quantity exceeds the remaining planned quantity.
                      </div>
                    )}

                    {/* Completion Notification */}
                    {prevExecutedQty >= approvedQty && (
                      <div style={{ marginTop: '0.75rem', padding: '0.65rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '6px', fontSize: '0.8rem', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <CheckCircle2 size={16} /> Work Completed (100%). Additional entries require an approved Variation / Extra Item.
                      </div>
                    )}

                    {/* Historical Daily Log Entries */}
                    {logs.filter(l => l.boq_item_id === selectedBoq.id).length > 0 && (
                      <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.4rem' }}>
                          Historical Daily Log Entries for {selectedBoq.item_name}:
                        </div>
                        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                              <th style={{ padding: '0.35rem 0.5rem' }}>Date</th>
                              <th style={{ padding: '0.35rem 0.5rem' }}>Today's Qty</th>
                              <th style={{ padding: '0.35rem 0.5rem' }}>Cumulative</th>
                              <th style={{ padding: '0.35rem 0.5rem' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {logs.filter(l => l.boq_item_id === selectedBoq.id).map((hLog) => (
                              <tr key={hLog.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#cbd5e1' }}>
                                <td style={{ padding: '0.35rem 0.5rem' }}>{new Date(hLog.log_date).toLocaleDateString()}</td>
                                <td style={{ padding: '0.35rem 0.5rem', color: '#10b981', fontWeight: 600 }}>{hLog.executed_qty} {hLog.unit || selectedBoq.unit}</td>
                                <td style={{ padding: '0.35rem 0.5rem', color: '#38bdf8', fontWeight: 600 }}>{hLog.new_cumulative_qty || hLog.total_executed_qty} {hLog.unit || selectedBoq.unit}</td>
                                <td style={{ padding: '0.35rem 0.5rem' }}>
                                  <span className={`tag-badge ${hLog.approval_status === 'approved' ? 'tag-success' : hLog.approval_status === 'rejected' ? 'tag-danger' : 'tag-warning'}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>
                                    {hLog.approval_status.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: 'rgba(15,23,42,0.5)', padding: '0.75rem', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    Select a BOQ item to view execution quantities.
                  </div>
                )}
              </div>

              {/* DAILY TASK MONITORING SECTION */}
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(15,23,42,0.85)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.35)', marginBottom: '1rem', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(56,189,248,0.2)', paddingBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.92rem', fontWeight: 700 }}>
                    <Activity size={18} /> DAILY TASK MONITORING (Work Plan Activities)
                  </h4>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: '#38bdf8', color: '#38bdf8' }} onClick={handleAddMonitoredTask}>
                    <Plus size={14} /> Add Monitored Activity
                  </button>
                </div>

                <p style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>
                  Select planned Work Plan activities to track execution progress, task status, mapped BOQ items, and delay reasons.
                </p>

                {monitoredTasks.length === 0 ? (
                  <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    No Work Plan activities added to today's log. Click "Add Monitored Activity" to link planning items.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {monitoredTasks.map((t, idx) => {
                      const ctx = t.work_plan_id ? workPlanContexts[t.work_plan_id] : null;

                      return (
                        <div key={idx} style={{ background: 'rgba(0,0,0,0.35)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
                              Activity #{idx + 1}
                            </span>
                            <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem', color: '#f43f5e', borderColor: 'rgba(244,63,94,0.3)' }} onClick={() => handleRemoveMonitoredTask(idx)}>
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {/* Work Plan Dropdown */}
                          <div style={{ marginBottom: '0.6rem' }}>
                            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Work Plan Activity *</label>
                            <select className="form-control" style={{ fontSize: '0.82rem' }} value={t.work_plan_id} onChange={e => handleMonitoredTaskChange(idx, 'work_plan_id', e.target.value)}>
                              <option value="">-- Select Work Plan Activity --</option>
                              {workPlans.map(wp => (
                                <option key={wp.id} value={wp.id}>WP-{wp.id}: {wp.name || wp.activity_name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Planning Context Banner */}
                          {ctx && (
                            <div style={{ padding: '0.6rem', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', marginBottom: '0.6rem', fontSize: '0.78rem' }}>
                              <div style={{ color: '#38bdf8', fontWeight: 600, marginBottom: '0.2rem' }}>
                                📌 {ctx.wbs_path || 'WBS Node'}
                              </div>
                              <div style={{ display: 'flex', gap: '1rem', color: '#cbd5e1', flexWrap: 'wrap' }}>
                                <span>Planned Qty: <strong>{ctx.planned_quantity} {ctx.unit}</strong></span>
                                <span>Schedule: <strong>{ctx.planned_start_date} to {ctx.planned_end_date}</strong></span>
                                <span>Priority: <strong>{ctx.priority}</strong></span>
                              </div>

                              {/* Date Awareness Warning Banners */}
                              {ctx.is_future_activity && (
                                <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.6rem', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: '4px', color: '#fca5a5', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                                  <AlertCircle size={14} /> Future Activity: Planned start date is {ctx.planned_start_date}. Execution quantity blocked (0).
                                </div>
                              )}

                              {ctx.is_delayed_activity && (
                                <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.6rem', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '4px', color: '#fcd34d', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                                  <AlertTriangle size={14} /> Delayed Activity: Past finish date ({ctx.planned_end_date}). Delay reason required.
                                </div>
                              )}
                            </div>
                          )}

                          {/* Mapped BOQ Item Dropdown (if context has mappings) */}
                          {ctx && ctx.mapped_boq_items && ctx.mapped_boq_items.length > 0 && (
                            <div style={{ marginBottom: '0.6rem' }}>
                              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Mapped BOQ Item</label>
                              <select className="form-control" style={{ fontSize: '0.82rem' }} value={t.boq_mapping_id} onChange={e => handleMonitoredTaskChange(idx, 'boq_mapping_id', e.target.value)}>
                                {ctx.mapped_boq_items.map(m => (
                                  <option key={m.mapping_id} value={m.mapping_id}>BOQ-{m.boq_item_id}: {m.boq_item_name} ({m.mapped_quantity} {m.boq_unit})</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Status & Quantity */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                            <div>
                              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Task Status</label>
                              <select className="form-control" style={{ fontSize: '0.82rem' }} disabled={ctx?.is_future_activity} value={t.task_status} onChange={e => handleMonitoredTaskChange(idx, 'task_status', e.target.value)}>
                                <option value="NOT STARTED">NOT STARTED</option>
                                <option value="IN PROGRESS">IN PROGRESS</option>
                                <option value="COMPLETED">COMPLETED</option>
                                <option value="DELAYED">DELAYED</option>
                                <option value="ON HOLD">ON HOLD</option>
                              </select>
                            </div>

                            <div>
                              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>Today's Executed Qty ({t.unit || 'units'})</label>
                              <input type="number" step="0.01" min="0" className="form-control" style={{ fontSize: '0.82rem' }} disabled={ctx?.is_future_activity} value={t.executed_quantity} onChange={e => handleMonitoredTaskChange(idx, 'executed_quantity', e.target.value)} />
                            </div>
                          </div>

                          {/* Execution Notes & Delay Reason */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                            <div>
                              <input type="text" className="form-control" style={{ fontSize: '0.78rem' }} placeholder="Execution Notes..." value={t.execution_notes} onChange={e => handleMonitoredTaskChange(idx, 'execution_notes', e.target.value)} />
                            </div>
                            <div>
                              <input type="text" className="form-control" style={{ fontSize: '0.78rem' }} placeholder="Delay Reason (if applicable)..." value={t.delay_reason} onChange={e => handleMonitoredTaskChange(idx, 'delay_reason', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '1rem', width: '100%', minWidth: 0 }}>
                <label style={{ fontSize: '0.85rem', color: '#f8fafc', marginBottom: '0.35rem', display: 'block' }}>
                  Materials Consumed Today <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 400 }}>(Separate from Executed Work Quantity)</span>
                </label>
                <input type="text" className="form-control" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }} placeholder="100 m3 Concrete, 5 Tonnes Steel" value={formData.materials_consumed} onChange={e => setFormData({ ...formData, materials_consumed: e.target.value })} />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem', width: '100%', minWidth: 0 }}>
                <label style={{ fontSize: '0.85rem', color: '#f8fafc', marginBottom: '0.35rem', display: 'block' }}>
                  Site Issues / Remarks (Optional)
                </label>
                <input type="text" className="form-control" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }} placeholder="Completed on schedule" value={formData.issues_identified} onChange={e => setFormData({ ...formData, issues_identified: e.target.value })} />
              </div>

              {/* SITE PHOTOS / PHOTO GALLERY */}
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(15,23,42,0.8)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.3)', marginBottom: '1rem', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
                    <Camera size={18} /> SITE PHOTOS / PHOTO GALLERY
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {selectedPhotos.length} / 10 photos added
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '0.85rem' }}>
                  Add photos showing today's site work as supporting evidence for Project Manager review. Supported formats: JPG, JPEG, PNG, WEBP (Max 10MB per file).
                </p>

                {/* Photo Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={selectedPhotos.length >= 10}
                    style={{ borderColor: '#38bdf8', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: selectedPhotos.length >= 10 ? 0.5 : 1 }}
                    onClick={() => cameraInputRef.current && cameraInputRef.current.click()}
                  >
                    <Camera size={16} /> [ Capture Photo ]
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={selectedPhotos.length >= 10}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: selectedPhotos.length >= 10 ? 0.5 : 1 }}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  >
                    <Upload size={16} /> [ Upload Photos ]
                  </button>
                </div>

                {/* Validation Error Message */}
                {photoError && (
                  <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: '6px', fontSize: '0.8rem', color: '#fca5a5', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertCircle size={16} /> {photoError}
                  </div>
                )}

                {/* Selected Photos Thumbnails List */}
                {selectedPhotos.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    {selectedPhotos.map((photo, index) => (
                      <div key={photo.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
                        <img
                          src={photo.previewUrl}
                          alt={`Photo ${index + 1}`}
                          style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', color: '#f8fafc', fontWeight: 600, marginBottom: '0.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Photo {index + 1}: <span style={{ color: '#94a3b8', fontWeight: 400 }}>{photo.file.name}</span>
                          </div>
                          <input
                            type="text"
                            className="form-control"
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem', width: '100%', minWidth: 0, boxSizing: 'border-box' }}
                            placeholder='Add Caption (e.g. "Foundation concrete pouring completed in Block A")'
                            value={photo.caption}
                            onChange={(e) => handleCaptionChange(photo.id, e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem', color: '#f43f5e', borderColor: 'rgba(244,63,94,0.3)', flexShrink: 0 }}
                          title="Remove before submission"
                          onClick={() => handleRemovePhoto(photo.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Daily Site Progress Log</button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* LIGHTBOX PREVIEW MODAL */}
      {previewPhoto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1.5rem' }}>
          <div className="glass-card" style={{ maxWidth: '800px', width: '100%', background: '#0f172a', padding: '1.25rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.9rem', color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Camera size={18} /> {previewPhoto.file_name}
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setPreviewPhoto(null)}><X size={18} /></button>
            </div>

            <div style={{ background: '#020617', borderRadius: '8px', overflow: 'hidden', textAlign: 'center', marginBottom: '0.75rem', maxHeight: '65vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={getImageUrl(previewPhoto.file_path)}
                alt={previewPhoto.caption || previewPhoto.file_name}
                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }}
              />
            </div>

            {previewPhoto.caption && (
              <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <strong>Caption:</strong> {previewPhoto.caption}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', fontSize: '0.78rem', color: '#94a3b8' }}>
              <div>Log Reference: <strong style={{ color: '#38bdf8' }}>Log #DSL-{previewPhoto.site_log_id}</strong></div>
              <div>Project: <strong style={{ color: '#f8fafc' }}>{previewPhoto.project_name || previewPhoto.project_id}</strong></div>
              <div>Uploaded By: <strong style={{ color: '#f8fafc' }}>{previewPhoto.uploader_name || 'Site Engineer'}</strong></div>
              <div>Date: <strong style={{ color: '#f8fafc' }}>{new Date(previewPhoto.created_at).toLocaleString()}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* DAILY LOG DETAILS MODAL (FROM GALLERY REFERENCE LINK) */}
      {detailLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1.5rem 0' }}>
          <div className="glass-card" style={{ width: '650px', background: '#1e293b', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div>
                <span className="tag-badge tag-info">Log Date: {new Date(detailLog.log_date).toLocaleDateString()}</span>
                <h3 style={{ margin: '0.2rem 0 0 0' }}>Daily Site Log #{detailLog.id}</h3>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setDetailLog(null)}><X size={16} /></button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <strong style={{ fontSize: '0.85rem', color: '#38bdf8' }}>Physical Progress Summary:</strong>
              <p style={{ color: '#f8fafc', fontSize: '0.9rem', marginTop: '0.2rem' }}>{detailLog.physical_progress}</p>
            </div>

            {/* WORK / QUANTITY PROGRESS BREAKDOWN */}
            {detailLog.boq_item_name && (
              <div style={{ padding: '0.85rem', background: 'rgba(56,189,248,0.06)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.2)', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                    📦 WORK / QUANTITY PROGRESS: {detailLog.boq_item_name}
                  </span>
                  <span className="tag-badge tag-success" style={{ fontWeight: 700 }}>
                    Progress: {detailLog.execution_pct}%
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  <div>Unit: <strong>{detailLog.unit}</strong></div>
                  <div>Planned Quantity: <strong>{detailLog.approved_qty} {detailLog.unit}</strong></div>
                  <div>Previous Cumulative: <strong style={{ color: '#38bdf8' }}>{detailLog.prev_executed_qty} {detailLog.unit}</strong></div>
                  <div>Today's Executed: <strong style={{ color: '#10b981' }}>{detailLog.executed_qty} {detailLog.unit}</strong></div>
                  <div>New Cumulative: <strong style={{ color: '#10b981' }}>{detailLog.new_cumulative_qty || detailLog.total_executed_qty} {detailLog.unit}</strong></div>
                  <div>Remaining Quantity: <strong style={{ color: '#f59e0b' }}>{detailLog.remaining_qty} {detailLog.unit}</strong></div>
                </div>

                {detailLog.execution_history && detailLog.execution_history.length > 0 && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.35rem' }}>Historical Daily Execution Log:</div>
                    <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                          <th style={{ padding: '0.3rem 0.4rem' }}>Date</th>
                          <th style={{ padding: '0.3rem 0.4rem' }}>Today's Qty</th>
                          <th style={{ padding: '0.3rem 0.4rem' }}>Cumulative</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailLog.execution_history.map(h => (
                          <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#cbd5e1' }}>
                            <td style={{ padding: '0.3rem 0.4rem' }}>{new Date(h.log_date).toLocaleDateString()}</td>
                            <td style={{ padding: '0.3rem 0.4rem', color: '#10b981' }}>{h.today_executed_qty} {detailLog.unit}</td>
                            <td style={{ padding: '0.3rem 0.4rem', color: '#38bdf8' }}>{h.cumulative_qty} {detailLog.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* MONITORED WORK PLAN ACTIVITIES BREAKDOWN */}
            {detailLog.daily_tasks && detailLog.daily_tasks.length > 0 && (
              <div style={{ padding: '0.85rem', background: 'rgba(16,185,129,0.06)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.25)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Activity size={16} /> MONITORED WORK PLAN ACTIVITIES ({detailLog.daily_tasks.length})
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {detailLog.daily_tasks.map((dt) => (
                    <div key={dt.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <div>
                          <strong style={{ color: '#f8fafc', fontSize: '0.85rem' }}>{dt.work_plan_name || `WP Task #${dt.work_plan_id}`}</strong>
                          {dt.wbs_name && <span style={{ fontSize: '0.75rem', color: '#38bdf8', marginLeft: '0.5rem' }}>({dt.wbs_name})</span>}
                        </div>
                        <span className={`tag-badge ${dt.task_status === 'COMPLETED' ? 'tag-success' : dt.task_status === 'DELAYED' ? 'tag-danger' : dt.task_status === 'IN PROGRESS' ? 'tag-info' : 'tag-warning'}`} style={{ fontSize: '0.72rem' }}>
                          {dt.task_status}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.4rem', fontSize: '0.78rem', color: '#cbd5e1' }}>
                        <div>Today's Executed: <strong style={{ color: '#10b981' }}>{dt.executed_quantity} {dt.unit}</strong></div>
                        {dt.boq_item_name && <div>BOQ: <strong style={{ color: '#38bdf8' }}>{dt.boq_item_name}</strong></div>}
                        {dt.is_future_activity && <div style={{ color: '#fca5a5' }}>⚠️ Future Activity</div>}
                        {dt.is_delayed_activity && <div style={{ color: '#fcd34d' }}>⏳ Delayed Activity</div>}
                      </div>

                      {dt.execution_notes && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '0.3rem' }}>
                          Notes: "{dt.execution_notes}"
                        </div>
                      )}

                      {dt.delay_reason && (
                        <div style={{ fontSize: '0.75rem', color: '#fca5a5', marginTop: '0.2rem' }}>
                          <strong>Delay Reason:</strong> {dt.delay_reason}
                        </div>
                      )}

                      {dt.warning_message && (
                        <div style={{ fontSize: '0.72rem', color: '#fcd34d', marginTop: '0.2rem' }}>
                          ℹ️ {dt.warning_message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', background: 'rgba(15,23,42,0.6)', padding: '0.9rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>On-Site Labour</div>
                <div style={{ fontWeight: 700, color: '#f8fafc' }}>{detailLog.labour_count} Workers</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Materials Consumed</div>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{detailLog.materials_consumed || 'None'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Machinery & Equipment</div>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{detailLog.equipment_used || 'Standard'}</div>
              </div>
            </div>

            {detailLog.issues_identified && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '8px', fontSize: '0.85rem', color: '#fca5a5' }}>
                <strong>Site Blockers / Issues:</strong> {detailLog.issues_identified}
              </div>
            )}

            {detailLog.photos && detailLog.photos.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.85rem', color: '#38bdf8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Camera size={16} /> ATTACHED SITE PHOTOS ({detailLog.photos.length})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
                  {detailLog.photos.map(p => (
                    <div key={p.id} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: '#020617' }} onClick={() => setPreviewPhoto(p)}>
                      <img src={getImageUrl(p.file_path)} alt={p.caption || p.file_name} style={{ width: '100%', height: '90px', objectFit: 'cover' }} />
                      {p.caption && <div style={{ padding: '0.3rem', fontSize: '0.7rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.caption}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setDetailLog(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
