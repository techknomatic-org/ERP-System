import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Layers, Plus, ClipboardList, CheckCircle2, ArrowLeft, Package, DollarSign, 
  Eye, FileText, AlertCircle, RefreshCw, X, CheckSquare, Truck, Edit,
  ShieldCheck, Check, Clock, AlertTriangle, Camera, UploadCloud, RotateCcw
} from 'lucide-react';
import { boqMbService, projectService, vendorService } from '../services/api';

export default function BoqMb() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const urlProjectId = searchParams.get('projectId');
  const urlTab = searchParams.get('tab');

  const initialTab = (location.pathname === '/test-check' || urlTab === 'test_check') ? 'test_check' : (urlTab === 'boq' ? 'boq' : 'emb');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId || '');
  const [boqs, setBoqs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [wbsData, setWbsData] = useState({ phases: [], tasks: [], subtasks: [] });
  const [loading, setLoading] = useState(false);

  // Tenant P2 GPS-Tagging Setting
  const [isP2GpsEnabled, setIsP2GpsEnabled] = useState(false);

  // e-MB State
  const [embEntries, setEmbEntries] = useState([]);
  const [staleEntries, setStaleEntries] = useState([]);
  const [embLoading, setEmbLoading] = useState(false);

  // Offline Sync State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('emb_offline_queue')) || [];
    } catch {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals visibility & editing state
  const [editingBoqId, setEditingBoqId] = useState(null);
  const [showBoqModal, setShowBoqModal] = useState(false);
  const [showMbModal, setShowMbModal] = useState(false);
  const [showMbLogModal, setShowMbLogModal] = useState(false);
  const [showMprModal, setShowMprModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);

  // e-MB Modals
  const [showCreateEmbModal, setShowCreateEmbModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signTargetEntry, setSignTargetEntry] = useState(null);
  const [signRole, setSignRole] = useState('JE'); // 'JE' or 'Contractor PM'
  const [signatureText, setSignatureText] = useState('');

  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionTargetEntry, setCorrectionTargetEntry] = useState(null);
  const [showEmbDetailModal, setShowEmbDetailModal] = useState(false);
  const [embDetailEntry, setEmbDetailEntry] = useState(null);

  const [targetBoqItem, setTargetBoqItem] = useState(null);
  const [mbLogs, setMbLogs] = useState([]);
  const [toast, setToast] = useState(null);

  // EXA-03 Test-Check Sampling State
  const [testCheckData, setTestCheckData] = useState({ summary: null, assignments: [] });
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewAction, setReviewAction] = useState('Pass'); // 'Pass' or 'Flag'
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Forms state
  const [boqForm, setBoqForm] = useState({
    phase_id: '',
    task_id: '',
    subtask_id: '',
    item_name: '',
    unit: 'cu.m',
    approved_qty: '',
    rate: '',
    vendor_id: ''
  });

  const [mbForm, setMbForm] = useState({ location_zone: '', measured_qty: '', remarks: '' });
  const [mprForm, setMprForm] = useState({ quantity: '', estimated_cost: '', reason: '' });
  const [billForm, setBillForm] = useState({ billed_qty: '', billed_rate: '', remarks: '' });

  // Structured e-MB Form State
  const [embForm, setEmbForm] = useState({
    wbs_node_id: '',
    boq_item_id: '',
    description: '',
    measurement_method: 'LBH', // 'LBH' or 'DIRECT'
    length: '',
    breadth: '',
    height: '',
    direct_quantity: '',
    unit: 'm³',
    location_zone: '',
    remarks: '',
    photo_url: '',
    photo_metadata: ''
  });

  // Correction Form State
  const [correctionForm, setCorrectionForm] = useState({
    correction_reason: '',
    description: '',
    measurement_method: 'LBH',
    length: '',
    breadth: '',
    height: '',
    direct_quantity: '',
    unit: 'm³',
    location_zone: '',
    remarks: ''
  });

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === '/test-check' || urlTab === 'test_check') {
      setActiveTab('test_check');
    } else if (urlTab === 'boq') {
      setActiveTab('boq');
    } else if (urlTab === 'emb') {
      setActiveTab('emb');
    }
  }, [location.pathname, urlTab]);

  // Filtered WBS tasks for cascade dropdowns
  const availableTasks = wbsData.tasks.filter(t => !boqForm.phase_id || t.parent_task_id === parseInt(boqForm.phase_id));
  const availableSubtasks = wbsData.subtasks.filter(s => !boqForm.task_id || s.parent_task_id === parseInt(boqForm.task_id));

  // Flattened WBS nodes for e-MB selection
  const allWbsNodes = [
    ...wbsData.phases.map(p => ({ id: p.id, label: `Phase: ${p.title} (${p.wbs_code || 'Phase'})` })),
    ...wbsData.tasks.map(t => ({ id: t.id, label: `Task: ${t.title} (${t.wbs_code || 'Task'})` })),
    ...wbsData.subtasks.map(s => ({ id: s.id, label: `Subtask: ${s.title} (${s.wbs_code || 'Subtask'})` }))
  ];

  // Load Projects, Vendors, and Tenant Settings on mount
  useEffect(() => {
    projectService.getProjects()
      .then((res) => {
        setProjects(res.data || []);
        if (!selectedProjectId && res.data && res.data.length > 0) {
          setSelectedProjectId(res.data[0].id.toString());
        }
      })
      .catch((err) => console.error("Error loading projects:", err));

    vendorService.getVendors()
      .then((res) => setVendors(res.data || []))
      .catch((err) => console.error("Error loading vendors:", err));

    projectService.getTenantSettings()
      .then((res) => {
        setIsP2GpsEnabled(Boolean(res.data?.is_p2_enabled));
      })
      .catch(() => {});
  }, []);

  // Load BOQ items, WBS Hierarchy, e-MB entries, and stale entries
  const loadProjectData = (projectId) => {
    if (!projectId) return;
    setLoading(true);

    Promise.all([
      boqMbService.getBoqItems(projectId),
      boqMbService.getWbsHierarchy(projectId),
      boqMbService.getEmbEntries(projectId),
      boqMbService.getStaleEmbEntries(projectId),
      boqMbService.getProjectTestChecks(projectId)
    ])
      .then(([boqRes, wbsRes, embRes, staleRes, testCheckRes]) => {
        setBoqs(boqRes.data || []);
        setWbsData(wbsRes.data || { phases: [], tasks: [], subtasks: [] });
        setEmbEntries(embRes.data || []);
        setStaleEntries(staleRes.data || []);
        setTestCheckData(testCheckRes.data || { summary: null, assignments: [] });
      })
      .catch((err) => console.error("Error loading project data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectData(selectedProjectId);
    }
  }, [selectedProjectId]);

  const formatCurrency = (val) => {
    const num = parseFloat(val || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Calculate live e-MB Computed Quantity for Create Modal
  const parseValidDimension = (val, isRequired = false) => {
    if (val === null || val === undefined || String(val).trim() === '') {
      return isRequired ? null : 1.0;
    }
    const str = String(val).trim();
    if (isNaN(Number(str))) return null;
    const num = parseFloat(str);
    if (isNaN(num) || num <= 0) return null;
    return num;
  };

  const computeEmbQty = (method, l, b, h, dq) => {
    if (method === 'LBH') {
      const len = parseValidDimension(l, true);
      const wid = parseValidDimension(b, false);
      const hgt = parseValidDimension(h, false);
      if (len !== null && wid !== null && hgt !== null) {
        return Math.round(len * wid * hgt * 10000) / 10000;
      }
      return null;
    } else if (method === 'DIRECT') {
      const q = parseValidDimension(dq, true);
      if (q !== null) {
        return Math.round(q * 10000) / 10000;
      }
      return null;
    }
    return null;
  };

  const createModalComputedQty = computeEmbQty(
    embForm.measurement_method,
    embForm.length,
    embForm.breadth,
    embForm.height,
    embForm.direct_quantity
  );

  const correctionModalComputedQty = computeEmbQty(
    correctionForm.measurement_method,
    correctionForm.length,
    correctionForm.breadth,
    correctionForm.height,
    correctionForm.direct_quantity
  );

  // Handle Save (Create) e-MB Entry
  const handleSaveEmb = (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      showToast("Please select a project first.", "error");
      return;
    }
    if (!embForm.wbs_node_id) {
      showToast("WBS Reference is required.", "error");
      return;
    }
    if (!embForm.description || !embForm.description.trim()) {
      showToast("Measurement Description is required.", "error");
      return;
    }

    if (createModalComputedQty === null) {
      showToast("Enter valid numeric dimensions.", "error");
      return;
    }

    if (isP2GpsEnabled && !embForm.photo_url) {
      showToast("Photo evidence is required when P2 GPS-tagging is enabled.", "error");
      return;
    }

    const clientUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : `emb-uuid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const payload = {
      client_uuid: clientUuid,
      project_id: parseInt(selectedProjectId, 10),
      wbs_node_id: parseInt(embForm.wbs_node_id, 10),
      boq_item_id: embForm.boq_item_id ? parseInt(embForm.boq_item_id, 10) : null,
      description: embForm.description.trim(),
      measurement_method: embForm.measurement_method,
      length: embForm.measurement_method === 'LBH' && embForm.length !== '' && embForm.length !== null && embForm.length !== undefined ? parseFloat(embForm.length) : null,
      breadth: embForm.measurement_method === 'LBH' && embForm.breadth !== '' && embForm.breadth !== null && embForm.breadth !== undefined ? parseFloat(embForm.breadth) : null,
      height: embForm.measurement_method === 'LBH' && embForm.height !== '' && embForm.height !== null && embForm.height !== undefined ? parseFloat(embForm.height) : null,
      direct_quantity: embForm.measurement_method === 'DIRECT' && embForm.direct_quantity !== '' && embForm.direct_quantity !== null && embForm.direct_quantity !== undefined ? parseFloat(embForm.direct_quantity) : null,
      unit: embForm.unit,
      location_zone: embForm.location_zone,
      remarks: embForm.remarks,
      photo_url: embForm.photo_url || null,
      photo_metadata: embForm.photo_metadata || null
    };

    // If Offline: Queue locally
    if (!isOnline) {
      const updatedQueue = [...offlineQueue, { ...payload, created_at: new Date().toISOString() }];
      setOfflineQueue(updatedQueue);
      localStorage.setItem('emb_offline_queue', JSON.stringify(updatedQueue));
      setShowCreateEmbModal(false);
      showToast("Saved offline! Entry queued for synchronization when reconnected.", "info");
      return;
    }

    // If Online: Submit directly
    boqMbService.createEmbEntry(payload)
      .then((res) => {
        setShowCreateEmbModal(false);
        setEmbForm({
          wbs_node_id: '',
          boq_item_id: '',
          description: '',
          measurement_method: 'LBH',
          length: '',
          breadth: '',
          height: '',
          direct_quantity: '',
          unit: 'm³',
          location_zone: '',
          remarks: '',
          photo_url: '',
          photo_metadata: ''
        });
        loadProjectData(selectedProjectId);
        showToast("e-MB Measurement Entry created successfully!", "success");
      })
      .catch((err) => {
        const detail = err.response?.data?.detail || "Failed to record e-MB measurement";
        showToast(detail, "error");
      });
  };

  // Handle Sync Offline Queue
  const handleSyncOfflineQueue = () => {
    if (offlineQueue.length === 0) {
      showToast("No offline entries queued for synchronization.", "info");
      return;
    }
    if (!isOnline) {
      showToast("Cannot sync: you are currently offline.", "error");
      return;
    }

    setIsSyncing(true);
    boqMbService.syncEmbOffline({ items: offlineQueue })
      .then((res) => {
        const syncedCount = res.data?.synced?.length || 0;
        const conflictsCount = res.data?.conflicts?.length || 0;

        if (conflictsCount > 0) {
          showToast(`Synced ${syncedCount} items with ${conflictsCount} conflict(s).`, "warning");
        } else {
          showToast(`All ${syncedCount} queued entries synchronized successfully!`, "success");
        }
        setOfflineQueue([]);
        localStorage.removeItem('emb_offline_queue');
        loadProjectData(selectedProjectId);
      })
      .catch((err) => {
        showToast("Offline synchronization failed. Retrying later.", "error");
      })
      .finally(() => setIsSyncing(false));
  };

  // Handle Sign e-MB Entry
  const handleExecuteSign = () => {
    if (!signTargetEntry) return;

    const signPayload = {
      signature_text: signatureText.trim() || `Verified digital signature by ${signRole}`
    };

    const signPromise = signRole === 'Contractor PM'
      ? boqMbService.signContractorRep(signTargetEntry.id, signPayload)
      : boqMbService.signJe(signTargetEntry.id, signPayload);

    signPromise
      .then((res) => {
        setShowSignModal(false);
        setSignTargetEntry(null);
        setSignatureText('');
        loadProjectData(selectedProjectId);
        showToast(`Signed successfully as ${signRole}! Entry status updated to ${res.data.status}.`, "success");
      })
      .catch((err) => {
        const detail = err.response?.data?.detail || `Failed to submit signature as ${signRole}`;
        showToast(detail, "error");
      });
  };

  // Handle Submit Correction
  const handleSubmitCorrection = (e) => {
    e.preventDefault();
    if (!correctionTargetEntry) return;

    if (!correctionForm.correction_reason || !correctionForm.correction_reason.trim()) {
      showToast("Correction Reason is required.", "error");
      return;
    }

    if (correctionModalComputedQty === null) {
      showToast("Enter valid numeric dimensions.", "error");
      return;
    }

    const payload = {
      original_entry_id: correctionTargetEntry.id,
      correction_reason: correctionForm.correction_reason.trim(),
      description: correctionForm.description.trim() || `Correction for MB-${String(correctionTargetEntry.id).padStart(4, '0')}`,
      measurement_method: correctionForm.measurement_method,
      length: correctionForm.measurement_method === 'LBH' && correctionForm.length !== '' && correctionForm.length !== null && correctionForm.length !== undefined ? parseFloat(correctionForm.length) : null,
      breadth: correctionForm.measurement_method === 'LBH' && correctionForm.breadth !== '' && correctionForm.breadth !== null && correctionForm.breadth !== undefined ? parseFloat(correctionForm.breadth) : null,
      height: correctionForm.measurement_method === 'LBH' && correctionForm.height !== '' && correctionForm.height !== null && correctionForm.height !== undefined ? parseFloat(correctionForm.height) : null,
      direct_quantity: correctionForm.measurement_method === 'DIRECT' && correctionForm.direct_quantity !== '' && correctionForm.direct_quantity !== null && correctionForm.direct_quantity !== undefined ? parseFloat(correctionForm.direct_quantity) : null,
      unit: correctionForm.unit || correctionTargetEntry.unit,
      location_zone: correctionForm.location_zone || correctionTargetEntry.location_zone,
      remarks: correctionForm.remarks
    };

    boqMbService.createEmbCorrection(correctionTargetEntry.id, payload)
      .then((res) => {
        setShowCorrectionModal(false);
        setCorrectionTargetEntry(null);
        setCorrectionForm({
          correction_reason: '',
          description: '',
          measurement_method: 'LBH',
          length: '',
          breadth: '',
          height: '',
          direct_quantity: '',
          unit: 'm³',
          location_zone: '',
          remarks: ''
        });
        loadProjectData(selectedProjectId);
        showToast("Correction entry created successfully! Dual signatures required before billing.", "success");
      })
      .catch((err) => {
        const detail = err.response?.data?.detail || "Failed to create correction entry";
        showToast(detail, "error");
      });
  };

  // BOQ Item Modal Handlers
  const handleOpenEditBoq = (item) => {
    setEditingBoqId(item.id);
    setTargetBoqItem(item);
    setBoqForm({
      phase_id: item.phase_id ? String(item.phase_id) : '',
      task_id: item.task_id ? String(item.task_id) : '',
      subtask_id: item.subtask_id ? String(item.subtask_id) : '',
      item_name: item.item_name || '',
      unit: item.unit || 'm³',
      approved_qty: item.approved_qty ? String(item.approved_qty) : '',
      rate: item.rate ? String(item.rate) : '',
      vendor_id: item.vendor_id ? String(item.vendor_id) : ''
    });
    setShowBoqModal(true);
  };

  const handleSaveBoq = (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      showToast("Please select a project first.", "error");
      return;
    }

    const qty = parseFloat(boqForm.approved_qty);
    const rate = parseFloat(boqForm.rate);

    if (!boqForm.item_name || !boqForm.item_name.trim()) {
      showToast("Item Description is required.", "error");
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      showToast("Approved Quantity must be greater than 0.", "error");
      return;
    }

    if (isNaN(rate) || rate < 0) {
      showToast("Unit Rate must be greater than or equal to 0.", "error");
      return;
    }

    const payload = {
      project_id: parseInt(selectedProjectId, 10),
      phase_id: boqForm.phase_id ? parseInt(boqForm.phase_id, 10) : null,
      task_id: boqForm.task_id ? parseInt(boqForm.task_id, 10) : null,
      subtask_id: boqForm.subtask_id ? parseInt(boqForm.subtask_id, 10) : null,
      item_name: boqForm.item_name.trim(),
      unit: boqForm.unit,
      approved_qty: qty,
      rate: rate,
      vendor_id: boqForm.vendor_id ? parseInt(boqForm.vendor_id, 10) : null
    };

    if (editingBoqId) {
      boqMbService.updateBoqItem(editingBoqId, payload)
        .then(() => {
          setShowBoqModal(false);
          setEditingBoqId(null);
          loadProjectData(selectedProjectId);
          showToast("BOQ Line Item updated successfully!", "success");
        })
        .catch((err) => {
          const detail = err.response?.data?.detail || "Failed to update BOQ item";
          showToast(detail, "error");
        });
    } else {
      boqMbService.createBoqItem(payload)
        .then(() => {
          setShowBoqModal(false);
          loadProjectData(selectedProjectId);
          showToast("BOQ Line Item created successfully!", "success");
        })
        .catch((err) => {
          const detail = err.response?.data?.detail || "Failed to add BOQ item";
          showToast(detail, "error");
        });
    }
  };

  const currentProject = projects.find(p => p.id === parseInt(selectedProjectId));

  return (
    <div className="content-page">
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

      {/* Main Page Title & Project Filter */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Digital e-Measurement Book (e-MB) & BOQ</h1>
          <p className="page-subtitle">Dual-Signed Measurement Book, Structured Dimension Formulas, Append-Only Auditing & Billing Verification</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Online/Offline Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.65rem', borderRadius: '6px', background: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isOnline ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isOnline ? '#10b981' : '#ef4444' }}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          {offlineQueue.length > 0 && (
            <button 
              className="btn btn-warning" 
              onClick={handleSyncOfflineQueue} 
              disabled={isSyncing || !isOnline}
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem' }}
              title="Synchronize queued offline entries"
            >
              <RotateCcw size={14} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Syncing..." : `Sync Queue (${offlineQueue.length})`}
            </button>
          )}

          <select 
            className="form-control" 
            style={{ width: '280px', fontWeight: 600 }} 
            value={selectedProjectId} 
            onChange={e => setSelectedProjectId(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
        <button
          className={`btn ${activeTab === 'emb' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('emb')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}
        >
          <ClipboardList size={16} /> Digital e-Measurement Book (e-MB)
          <span className="tag-badge tag-info" style={{ fontSize: '0.72rem', padding: '0.1rem 0.45rem', borderRadius: '9999px' }}>
            {embEntries.length}
          </span>
          {staleEntries.length > 0 && (
            <span className="tag-badge tag-warning" style={{ fontSize: '0.72rem', padding: '0.1rem 0.45rem', borderRadius: '9999px' }}>
              {staleEntries.length} Stale
            </span>
          )}
        </button>

        <button
          className={`btn ${activeTab === 'boq' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('boq')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}
        >
          <Layers size={16} /> BOQ Master Line Items
          <span className="tag-badge tag-neutral" style={{ fontSize: '0.72rem', padding: '0.1rem 0.45rem', borderRadius: '9999px' }}>
            {boqs.length}
          </span>
        </button>

        <button
          className={`btn ${activeTab === 'test_check' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('test_check')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}
        >
          <ShieldCheck size={16} color={activeTab === 'test_check' ? '#fff' : '#10b981'} /> AE/EE Test-Check Sampling
          <span className="tag-badge tag-success" style={{ fontSize: '0.72rem', padding: '0.1rem 0.45rem', borderRadius: '9999px' }}>
            {testCheckData?.summary?.total_assignments || 0}
          </span>
          {((testCheckData?.summary?.ae_pending || 0) + (testCheckData?.summary?.ee_pending || 0)) > 0 && (
            <span className="tag-badge tag-warning" style={{ fontSize: '0.72rem', padding: '0.1rem 0.45rem', borderRadius: '9999px' }}>
              {(testCheckData?.summary?.ae_pending || 0) + (testCheckData?.summary?.ee_pending || 0)} Pending
            </span>
          )}
        </button>
      </div>

      {/* STALE e-MB ALERT BANNER */}
      {staleEntries.length > 0 && activeTab === 'emb' && (
        <div style={{ padding: '0.85rem 1.25rem', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f59e0b' }}>
            <AlertTriangle size={20} />
            <div>
              <strong style={{ fontSize: '0.9rem' }}>48-Hour Stale e-MB Warning ({staleEntries.length} entries)</strong>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                One or more measurements have been waiting for co-signature for more than 48 hours. Please expedite co-signing.
              </div>
            </div>
          </div>
          <span className="tag-badge tag-warning" style={{ fontWeight: 700 }}>Action Required</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: DIGITAL e-MEASUREMENT BOOK (e-MB) TABLE & VIEW                    */}
      {/* ========================================================================= */}
      {activeTab === 'emb' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardList size={20} color="#38bdf8" /> Digital e-Measurement Entries
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                Append-only certified measurement records with dual digital signatures (Contractor Rep & JE).
              </p>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={() => {
                setEmbForm({
                  wbs_node_id: '',
                  boq_item_id: '',
                  description: '',
                  measurement_method: 'LBH',
                  length: '',
                  breadth: '',
                  height: '',
                  direct_quantity: '',
                  unit: 'm³',
                  location_zone: '',
                  remarks: '',
                  photo_url: '',
                  photo_metadata: ''
                });
                setShowCreateEmbModal(true);
              }}
            >
              <Plus size={16} /> Record e-MB Entry
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>MB Ref</th>
                  <th>Date</th>
                  <th>WBS Node</th>
                  <th>Description</th>
                  <th>Dimensions / Method</th>
                  <th>Quantity</th>
                  <th>Contractor Rep</th>
                  <th>JE Signature</th>
                  <th>Entry Status</th>
                  <th>Billing Eligibility</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {embEntries.length === 0 ? (
                  <tr>
                    <td colSpan="11" style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                      {loading ? "Loading e-MB records..." : "No e-MB measurements recorded for this project yet. Click 'Record e-MB Entry' to add one."}
                    </td>
                  </tr>
                ) : (
                  embEntries.map((e) => {
                    const isFullySigned = e.status === 'FULLY SIGNED / SUBMITTED' || e.status === 'APPROVED';
                    const isPending = e.status === 'PENDING CO-SIGN';
                    const isDraft = e.status === 'DRAFT';

                    return (
                      <tr key={e.id} style={{ opacity: e.is_superseded ? 0.6 : 1 }}>
                        {/* Ref */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>MB-{String(e.id).padStart(4, '0')}</strong>
                            {e.correction_of_id && (
                              <span style={{ fontSize: '0.68rem', color: '#f59e0b' }}>
                                Corrects MB-{String(e.correction_of_id).padStart(4, '0')}
                              </span>
                            )}
                            {e.is_offline_sync && (
                              <span style={{ fontSize: '0.65rem', color: '#10b981' }}>[Synced Offline]</span>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          {new Date(e.created_at || Date.now()).toLocaleDateString()}
                        </td>

                        {/* WBS */}
                        <td>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                            {e.wbs_node_name || 'WBS Node'}
                          </div>
                          {e.wbs_code && (
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{e.wbs_code}</span>
                          )}
                        </td>

                        {/* Description */}
                        <td style={{ maxWidth: '180px', fontSize: '0.82rem' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.description}>
                            {e.description}
                          </div>
                        </td>

                        {/* Dimensions / Method */}
                        <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                          {e.measurement_method === 'LBH' ? (
                            <span>{e.length} × {e.breadth} × {e.height} <span style={{ color: '#94a3b8' }}>(L×B×H)</span></span>
                          ) : (
                            <span>{e.direct_quantity} <span style={{ color: '#94a3b8' }}>(Direct)</span></span>
                          )}
                        </td>

                        {/* Computed Quantity */}
                        <td style={{ fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>
                          {e.computed_quantity} {e.unit}
                        </td>

                        {/* Contractor Rep Signature */}
                        <td>
                          {e.has_contractor_rep_signed ? (
                            <span className="tag-badge tag-success" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Check size={12} /> {e.contractor_rep_name || 'Signed'}
                            </span>
                          ) : (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}
                              onClick={() => { setSignTargetEntry(e); setSignRole('Contractor PM'); setShowSignModal(true); }}
                            >
                              <Clock size={12} /> Sign (Contractor Rep)
                            </button>
                          )}
                        </td>

                        {/* JE Signature */}
                        <td>
                          {e.has_je_signed ? (
                            <span className="tag-badge tag-success" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Check size={12} /> {e.je_name || 'Signed'}
                            </span>
                          ) : (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', borderColor: 'rgba(56,189,248,0.3)', color: '#38bdf8' }}
                              onClick={() => { setSignTargetEntry(e); setSignRole('JE'); setShowSignModal(true); }}
                            >
                              <Clock size={12} /> Sign (JE)
                            </button>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          <span className={`tag-badge ${
                            isFullySigned ? 'tag-success' : isPending ? 'tag-warning' : 'tag-neutral'
                          }`}>
                            {e.status}
                          </span>
                        </td>

                        {/* Billing Eligibility */}
                        <td>
                          {e.is_billable ? (
                            <span className="tag-badge tag-success" style={{ fontSize: '0.72rem' }}>
                              Billable — Fully Signed
                            </span>
                          ) : (
                            <span className="tag-badge tag-warning" style={{ fontSize: '0.72rem' }}>
                              Not Billable — Pending Co-sign
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                              onClick={() => { setEmbDetailEntry(e); setShowEmbDetailModal(true); }}
                              title="View Details"
                            >
                              <Eye size={12} /> View
                            </button>

                            {isFullySigned && !e.is_superseded && (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', color: '#f59e0b', borderColor: 'rgba(245,158,11,0.3)' }}
                                onClick={() => {
                                  setCorrectionTargetEntry(e);
                                  setCorrectionForm({
                                    correction_reason: '',
                                    description: `Correction for MB-${String(e.id).padStart(4, '0')}: ${e.description}`,
                                    measurement_method: e.measurement_method || 'LBH',
                                    length: e.length ? String(e.length) : '',
                                    breadth: e.breadth ? String(e.breadth) : '',
                                    height: e.height ? String(e.height) : '',
                                    direct_quantity: e.direct_quantity ? String(e.direct_quantity) : '',
                                    unit: e.unit,
                                    location_zone: e.location_zone,
                                    remarks: ''
                                  });
                                  setShowCorrectionModal(true);
                                }}
                                title="Create linked correction (Append-Only rule)"
                              >
                                <RotateCcw size={12} /> Correct
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BOQ MASTER TABLE & VIEW (Existing)                                 */}
      {/* ========================================================================= */}
      {activeTab === 'boq' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={20} color="#38bdf8" /> BOQ Master Line Items & Measurement Progress
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Total Items: <strong>{boqs.length}</strong>
              </span>
              <button className="btn btn-primary" onClick={() => { setEditingBoqId(null); setBoqForm({ phase_id: '', task_id: '', subtask_id: '', item_name: '', unit: 'm³', approved_qty: '', rate: '', vendor_id: '' }); setShowBoqModal(true); }}>
                <Plus size={16} /> Add BOQ Item
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>BOQ ID</th>
                  <th>Item Description</th>
                  <th>WBS Location</th>
                  <th>Contractor / Vendor</th>
                  <th>Unit</th>
                  <th>Approved Qty</th>
                  <th>Executed Qty</th>
                  <th>Remaining Qty</th>
                  <th>Unit Rate</th>
                  <th>Total Amount</th>
                  <th>Progress %</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {boqs.length === 0 ? (
                  <tr>
                    <td colSpan="13" style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                      {loading ? "Loading project BOQ items..." : "No BOQ items added for this project yet. Click 'Add BOQ Item' to create one."}
                    </td>
                  </tr>
                ) : (
                  boqs.map((b) => {
                    const wbsPath = [b.phase_title, b.task_title, b.subtask_title].filter(Boolean).join(' ➔ ') || 'Unlinked';
                    return (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 700, color: '#38bdf8' }}>BOQ-{String(b.id).padStart(3, '0')}</td>
                        <td style={{ fontWeight: 600, color: '#f8fafc', maxWidth: '200px' }}>{b.item_name}</td>
                        <td style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{wbsPath}</td>
                        <td>{b.contractor_name || <span style={{ color: '#64748b' }}>Unassigned</span>}</td>
                        <td><span className="tag-badge tag-info">{b.unit}</span></td>
                        <td style={{ fontWeight: 600 }}>{b.approved_qty.toLocaleString()} {b.unit}</td>
                        <td style={{ fontWeight: 600, color: '#10b981' }}>{b.executed_qty.toLocaleString()} {b.unit}</td>
                        <td style={{ fontWeight: 600, color: b.remaining_qty === 0 ? '#f43f5e' : '#f59e0b' }}>
                          {b.remaining_qty.toLocaleString()} {b.unit}
                        </td>
                        <td><span style={{ color: '#94a3b8' }}>₹{b.rate.toLocaleString()}/unit</span></td>
                        <td style={{ fontWeight: 700, color: '#10b981' }}>₹{b.total_amount.toLocaleString()}</td>
                        <td style={{ minWidth: '110px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${b.progress_pct}%`, height: '100%', background: b.progress_pct >= 100 ? '#10b981' : '#38bdf8' }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{b.progress_pct}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`tag-badge ${b.status === 'COMPLETED' ? 'tag-success' : 'tag-primary'}`}>
                            {b.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', color: '#38bdf8', borderColor: 'rgba(56,189,248,0.3)' }} 
                              onClick={() => handleOpenEditBoq(b)}
                              title="Edit BOQ line item"
                            >
                              <Edit size={12} /> Edit
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', color: '#818cf8', borderColor: 'rgba(129,140,248,0.3)' }} 
                              onClick={() => {
                                setTargetBoqItem(b);
                                setMprForm({
                                  quantity: b.remaining_qty > 0 ? b.remaining_qty.toString() : b.approved_qty.toString(),
                                  estimated_cost: ((b.remaining_qty > 0 ? b.remaining_qty : b.approved_qty) * b.rate).toString(),
                                  reason: `Material purchase requirement generated for BOQ Item #${b.id}: ${b.item_name}`
                                });
                                setShowMprModal(true);
                              }}
                              title="Generate Material Purchase Request"
                            >
                              <Package size={12} /> PR
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }} 
                              onClick={() => {
                                setTargetBoqItem(b);
                                setBillForm({
                                  billed_qty: b.executed_qty > 0 ? b.executed_qty.toString() : b.approved_qty.toString(),
                                  billed_rate: b.rate.toString(),
                                  remarks: `Contractor billing generated against verified MB Executed Quantity for ${b.item_name}`
                                });
                                setShowBillModal(true);
                              }}
                              title="Create Contractor Bill"
                            >
                              <DollarSign size={12} /> Bill
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AE/EE TEST-CHECK SAMPLING WORKFLOW                                 */}
      {/* ========================================================================= */}
      {activeTab === 'test_check' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            {/* AE Sampling Card */}
            <div className="glass-card" style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(56,189,248,0.2)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={18} /> AE Test-Check Sampling
                </span>
                <span className="tag-badge tag-info">
                  {testCheckData?.summary?.ae_sampling_rate || 50}% (Min 50%)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>
                    {testCheckData?.summary?.ae_pending || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Pending</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
                    {testCheckData?.summary?.ae_passed || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Passed</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>
                    {testCheckData?.summary?.ae_flagged || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Flagged</div>
                </div>
              </div>
            </div>

            {/* EE Sampling Card */}
            <div className="glass-card" style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(168,85,247,0.2)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#a855f7', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={18} /> EE Test-Check Sampling
                </span>
                <span className="tag-badge tag-purple" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}>
                  {testCheckData?.summary?.ee_sampling_rate || 10}% (Min 10%)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>
                    {testCheckData?.summary?.ee_pending || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Pending</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
                    {testCheckData?.summary?.ee_passed || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Passed</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>
                    {testCheckData?.summary?.ee_flagged || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Flagged</div>
                </div>
              </div>
            </div>

            {/* Total Clearance Card */}
            <div className="glass-card" style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(16,185,129,0.2)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={18} /> Test-Check Clearance
                </span>
                <span className="tag-badge tag-success">CPWD Mandate</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '0.5rem', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>
                    {testCheckData?.summary?.total_assignments || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Total Sampled</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
                    {(testCheckData?.summary?.ae_passed || 0) + (testCheckData?.summary?.ee_passed || 0)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Total Cleared</div>
                </div>
              </div>
            </div>
          </div>

          {/* Test-Check Assignments Table */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={20} color="#10b981" /> AE / EE Test-Check Sampled Assignments
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                  CPWD Risk-Weighted Sampled e-MB entries. Independent AE (50%) and EE (10%) test-check approvals are required before billing.
                </p>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>MB Ref</th>
                    <th>WBS & Description</th>
                    <th>Quantity</th>
                    <th>Value (₹)</th>
                    <th>Authority</th>
                    <th>Sampling Reason & Risk</th>
                    <th>Status</th>
                    <th>Reviewer & Remarks</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {testCheckData.assignments.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                        No test-check sampled entries for this project yet. Entries will be automatically sampled upon dual e-MB sign-off.
                      </td>
                    </tr>
                  ) : (
                    testCheckData.assignments.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{item.mb_reference}</strong>
                        </td>
                        <td>
                          <div><strong>{item.wbs_node_name || 'WBS Task'}</strong></div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{item.description}</div>
                        </td>
                        <td>
                          <strong>{item.quantity} {item.unit}</strong>
                        </td>
                        <td>
                          <strong style={{ color: '#10b981' }}>{formatCurrency(item.total_value)}</strong>
                        </td>
                        <td>
                          <span className={`tag-badge ${item.authority === 'AE' ? 'tag-info' : 'tag-purple'}`} style={{ fontWeight: 700 }}>
                            {item.authority} ({item.sampling_percentage}%)
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.78rem' }}>{item.sampling_reason}</div>
                          <div style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '0.1rem' }}>
                            Risk Score: {item.risk_score} [{item.risk_factors}]
                          </div>
                        </td>
                        <td>
                          <span className={`tag-badge ${
                            item.status === 'Passed' ? 'tag-success' :
                            item.status === 'Flagged' ? 'tag-danger' : 'tag-warning'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          {item.reviewer_name ? (
                            <div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.reviewer_name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.reviewer_remarks}</div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Awaiting Review</span>
                          )}
                        </td>
                        <td>
                          {item.status === 'Pending' ? (
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button 
                                className="btn btn-primary" 
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                                onClick={() => {
                                  setReviewTarget(item);
                                  setReviewAction('Pass');
                                  setReviewRemarks('');
                                  setShowReviewModal(true);
                                }}
                              >
                                Pass
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444' }}
                                onClick={() => {
                                  setReviewTarget(item);
                                  setReviewAction('Flag');
                                  setReviewRemarks('');
                                  setShowReviewModal(true);
                                }}
                              >
                                Flag
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              {item.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE e-MB ENTRY MODAL                                                   */}
      {/* ========================================================================= */}
      {showCreateEmbModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '600px', background: '#1e293b', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ClipboardList size={20} color="#38bdf8" /> Record e-Measurement Book Entry
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                  Enter structured dimensions or direct quantity. Computed quantity is verified and read-only.
                </p>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowCreateEmbModal(false)}>
                <X size={16} />
              </button>
            </div>

            {isP2GpsEnabled && (
              <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Camera size={16} />
                <span><strong>Tenant Policy:</strong> P2 GPS-tagging enabled. Photo evidence is required for this entry.</span>
              </div>
            )}

            <form onSubmit={handleSaveEmb}>
              {/* WBS Reference */}
              <div className="form-group">
                <label>WBS Node Reference *</label>
                <select 
                  required 
                  className="form-control" 
                  value={embForm.wbs_node_id} 
                  onChange={e => setEmbForm({ ...embForm, wbs_node_id: e.target.value })}
                >
                  <option value="">-- Select WBS Node --</option>
                  {allWbsNodes.map(n => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="form-group">
                <label>Measurement Description *</label>
                <input 
                  required 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Substructure Raft Foundation Concrete M30 Pouring" 
                  value={embForm.description} 
                  onChange={e => setEmbForm({ ...embForm, description: e.target.value })} 
                />
              </div>

              {/* Method Selector */}
              <div className="form-group">
                <label>Measurement Method *</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem' }}>
                  <button
                    type="button"
                    className={`btn ${embForm.measurement_method === 'LBH' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setEmbForm({ ...embForm, measurement_method: 'LBH' })}
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                  >
                    Structured [ L × B × H ]
                  </button>
                  <button
                    type="button"
                    className={`btn ${embForm.measurement_method === 'DIRECT' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setEmbForm({ ...embForm, measurement_method: 'DIRECT' })}
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                  >
                    Direct Quantity
                  </button>
                </div>
              </div>

              {/* Structured Inputs */}
              {embForm.measurement_method === 'LBH' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Length (L) *</label>
                    <input 
                      required 
                      type="number" 
                      step="0.0001" 
                      min="0.0001" 
                      className="form-control" 
                      placeholder="10.00" 
                      value={embForm.length} 
                      onChange={e => setEmbForm({ ...embForm, length: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Breadth / Width (B) *</label>
                    <input 
                      required 
                      type="number" 
                      step="0.0001" 
                      min="0.0001" 
                      className="form-control" 
                      placeholder="5.00" 
                      value={embForm.breadth} 
                      onChange={e => setEmbForm({ ...embForm, breadth: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Height / Depth (H) *</label>
                    <input 
                      required 
                      type="number" 
                      step="0.0001" 
                      min="0.0001" 
                      className="form-control" 
                      placeholder="2.00" 
                      value={embForm.height} 
                      onChange={e => setEmbForm({ ...embForm, height: e.target.value })} 
                    />
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label>Direct Quantity *</label>
                  <input 
                    required 
                    type="number" 
                    step="0.0001" 
                    min="0.0001" 
                    className="form-control" 
                    placeholder="Enter measured execution quantity" 
                    value={embForm.direct_quantity} 
                    onChange={e => setEmbForm({ ...embForm, direct_quantity: e.target.value })} 
                  />
                </div>
              )}

              {/* Live Computed Quantity Box (READ-ONLY) */}
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Auto-Computed Quantity (Read-Only):</span>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {embForm.measurement_method === 'LBH' ? 'Formula: Length × Breadth × Height' : 'Direct certified input'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '1.25rem', color: createModalComputedQty !== null ? '#10b981' : '#f59e0b', fontFamily: 'monospace' }}>
                    {createModalComputedQty !== null ? `${createModalComputedQty} ${embForm.unit}` : 'Enter valid dimensions'}
                  </strong>
                </div>
              </div>

              {/* Unit & Location */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Unit of Measurement *</label>
                  <select className="form-control" value={embForm.unit} onChange={e => setEmbForm({ ...embForm, unit: e.target.value })}>
                    <option value="m³">m³ (Cubic Meters)</option>
                    <option value="cu.m">cu.m (Cubic Meters)</option>
                    <option value="sq.m">sq.m (Square Meters)</option>
                    <option value="sq.ft">sq.ft (Square Feet)</option>
                    <option value="Tonnes">Tonnes</option>
                    <option value="Running Meter">Running Meter</option>
                    <option value="Units">Units / Nos</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Zone / Location Reference</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Grid C1-C12 / Basement B2" 
                    value={embForm.location_zone} 
                    onChange={e => setEmbForm({ ...embForm, location_zone: e.target.value })} 
                  />
                </div>
              </div>

              {/* Photo Evidence URL */}
              <div className="form-group">
                <label>Photo Evidence {isP2GpsEnabled ? '*' : '(Optional)'}</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="/uploads/photos/site_inspection_grid_c.jpg" 
                  value={embForm.photo_url} 
                  onChange={e => setEmbForm({ ...embForm, photo_url: e.target.value })} 
                />
              </div>

              {/* Remarks */}
              <div className="form-group">
                <label>Verification Notes / Remarks</label>
                <textarea 
                  className="form-control" 
                  rows="2" 
                  placeholder="Verified by laser leveling and steel gauge depth readings..." 
                  value={embForm.remarks} 
                  onChange={e => setEmbForm({ ...embForm, remarks: e.target.value })} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateEmbModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {isOnline ? "Save e-MB Entry" : "Queue in Offline Storage"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIGITAL SIGNATURE MODAL                                                   */}
      {/* ========================================================================= */}
      {showSignModal && signTargetEntry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '500px', background: '#1e293b', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} color="#10b981" /> Digital Signature Verification
              </h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowSignModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '0.85rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
              <div>Entry: <strong>MB-{String(signTargetEntry.id).padStart(4, '0')}</strong></div>
              <div>Description: <strong>{signTargetEntry.description}</strong></div>
              <div>Computed Quantity: <strong style={{ color: '#10b981' }}>{signTargetEntry.computed_quantity} {signTargetEntry.unit}</strong></div>
              <div>Signing Authority: <strong style={{ color: '#38bdf8' }}>{signRole}</strong></div>
            </div>

            <div className="form-group">
              <label>Digital Signature Attestation *</label>
              <textarea 
                className="form-control" 
                rows="3" 
                value={signatureText} 
                onChange={e => setSignatureText(e.target.value)} 
                placeholder={`I hereby attest that the site measurements recorded in MB-${String(signTargetEntry.id).padStart(4, '0')} have been physically verified on site according to project technical specifications.`}
              />
            </div>

            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              * Signature will be cryptographically bound to your authenticated identity, project-team role, and current server timestamp.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowSignModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleExecuteSign} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                Apply Digital Signature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE CORRECTION MODAL (Append-Only Guard)                                */}
      {/* ========================================================================= */}
      {showCorrectionModal && correctionTargetEntry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '580px', background: '#1e293b', padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RotateCcw size={20} color="#f59e0b" /> Create Linked e-MB Correction
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
                  Append-Only Rule: Original MB-{String(correctionTargetEntry.id).padStart(4, '0')} remains immutable.
                </p>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowCorrectionModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '0.75rem 0.95rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#f59e0b' }}>
              <strong>Audit Policy:</strong> Correction entries must be re-signed by both the Contractor Representative and JE before contributing to contractor billing.
            </div>

            <form onSubmit={handleSubmitCorrection}>
              <div className="form-group">
                <label>Correction Reason (Mandatory) *</label>
                <textarea 
                  required 
                  className="form-control" 
                  rows="2" 
                  placeholder="Explain why correction is required (e.g. As-built laser survey readjustment for Column C4)..." 
                  value={correctionForm.correction_reason} 
                  onChange={e => setCorrectionForm({ ...correctionForm, correction_reason: e.target.value })} 
                />
              </div>

              <div className="form-group">
                <label>Description *</label>
                <input 
                  required 
                  type="text" 
                  className="form-control" 
                  value={correctionForm.description} 
                  onChange={e => setCorrectionForm({ ...correctionForm, description: e.target.value })} 
                />
              </div>

              {/* Method Selector */}
              <div className="form-group">
                <label>Measurement Method *</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem' }}>
                  <button
                    type="button"
                    className={`btn ${correctionForm.measurement_method === 'LBH' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCorrectionForm({ ...correctionForm, measurement_method: 'LBH' })}
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                  >
                    Structured [ L × B × H ]
                  </button>
                  <button
                    type="button"
                    className={`btn ${correctionForm.measurement_method === 'DIRECT' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCorrectionForm({ ...correctionForm, measurement_method: 'DIRECT' })}
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                  >
                    Direct Quantity
                  </button>
                </div>
              </div>

              {/* Structured Inputs */}
              {correctionForm.measurement_method === 'LBH' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Length (L) *</label>
                    <input 
                      required 
                      type="number" 
                      step="0.0001" 
                      min="0.0001" 
                      className="form-control" 
                      value={correctionForm.length} 
                      onChange={e => setCorrectionForm({ ...correctionForm, length: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Breadth / Width (B) *</label>
                    <input 
                      required 
                      type="number" 
                      step="0.0001" 
                      min="0.0001" 
                      className="form-control" 
                      value={correctionForm.breadth} 
                      onChange={e => setCorrectionForm({ ...correctionForm, breadth: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Height / Depth (H) *</label>
                    <input 
                      required 
                      type="number" 
                      step="0.0001" 
                      min="0.0001" 
                      className="form-control" 
                      value={correctionForm.height} 
                      onChange={e => setCorrectionForm({ ...correctionForm, height: e.target.value })} 
                    />
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label>Corrected Direct Quantity *</label>
                  <input 
                    required 
                    type="number" 
                    step="0.0001" 
                    min="0.0001" 
                    className="form-control" 
                    value={correctionForm.direct_quantity} 
                    onChange={e => setCorrectionForm({ ...correctionForm, direct_quantity: e.target.value })} 
                  />
                </div>
              )}

              {/* Live Computed Quantity */}
              <div style={{ padding: '0.85rem 1rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Corrected Computed Quantity:</span>
                <strong style={{ fontSize: '1.2rem', color: '#10b981', fontFamily: 'monospace' }}>
                  {correctionModalComputedQty !== null ? `${correctionModalComputedQty} ${correctionForm.unit}` : 'Enter valid dimensions'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCorrectionModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  Submit Correction Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW e-MB DETAILS MODAL                                                   */}
      {/* ========================================================================= */}
      {showEmbDetailModal && embDetailEntry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '560px', background: '#1e293b', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Measurement Entry MB-{String(embDetailEntry.id).padStart(4, '0')}</h3>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>UUID: {embDetailEntry.client_uuid || 'N/A'}</span>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowEmbDetailModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.82rem', marginBottom: '1rem' }}>
              <div>Project: <strong>{embDetailEntry.project_name || `#${embDetailEntry.project_id}`}</strong></div>
              <div>WBS: <strong>{embDetailEntry.wbs_node_name || 'N/A'}</strong></div>
              <div>Quantity: <strong style={{ color: '#10b981' }}>{embDetailEntry.computed_quantity} {embDetailEntry.unit}</strong></div>
              <div>Method: <strong>{embDetailEntry.measurement_method}</strong></div>
              <div>Status: <strong>{embDetailEntry.status}</strong></div>
              <div>Billing: <strong>{embDetailEntry.is_billable ? "Billable" : "Not Billable"}</strong></div>
            </div>

            {/* Dual Signatures Details */}
            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: '#94a3b8' }}>Contractor Rep: </span>
                {embDetailEntry.has_contractor_rep_signed ? (
                  <strong style={{ color: '#10b981' }}>✓ Signed by {embDetailEntry.contractor_rep_name} ({new Date(embDetailEntry.contractor_rep_signed_at).toLocaleString()})</strong>
                ) : (
                  <strong style={{ color: '#f59e0b' }}>⏳ Pending Signature</strong>
                )}
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Junior Engineer (JE): </span>
                {embDetailEntry.has_je_signed ? (
                  <strong style={{ color: '#10b981' }}>✓ Signed by {embDetailEntry.je_name} ({new Date(embDetailEntry.je_signed_at).toLocaleString()})</strong>
                ) : (
                  <strong style={{ color: '#f59e0b' }}>⏳ Pending Signature</strong>
                )}
              </div>
            </div>

            {embDetailEntry.correction_reason && (
              <div style={{ padding: '0.75rem', background: 'rgba(245,158,11,0.1)', borderRadius: '6px', fontSize: '0.8rem', color: '#f59e0b', marginBottom: '1rem' }}>
                <strong>Correction Reason:</strong> {embDetailEntry.correction_reason}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowEmbDetailModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT BOQ ITEM MODAL */}
      {showBoqModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '560px', background: '#1e293b', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0 }}>{editingBoqId ? "Edit BOQ Line Item" : "Add BOQ Line Item"}</h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowBoqModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleSaveBoq}>
              <div className="form-group">
                <label>Item Name / Description *</label>
                <input required type="text" className="form-control" placeholder="Foundation Concrete Slab Pour (M30)" value={boqForm.item_name} onChange={e => setBoqForm({ ...boqForm, item_name: e.target.value })} />
              </div>

              {/* WBS Cascade Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>WBS Phase</label>
                  <select className="form-control" value={boqForm.phase_id} onChange={e => setBoqForm({ ...boqForm, phase_id: e.target.value, task_id: '', subtask_id: '' })}>
                    <option value="">-- Select WBS Phase --</option>
                    {wbsData.phases.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>WBS Task</label>
                  <select className="form-control" value={boqForm.task_id} onChange={e => setBoqForm({ ...boqForm, task_id: e.target.value, subtask_id: '' })}>
                    <option value="">-- Select WBS Task --</option>
                    {availableTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              </div>

              {/* Quantities and Rate */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Unit *</label>
                  <select className="form-control" value={boqForm.unit} onChange={e => setBoqForm({ ...boqForm, unit: e.target.value })}>
                    <option value="m³">m³ (Cubic Meters)</option>
                    <option value="cu.m">cu.m (Cubic Meters)</option>
                    <option value="sq.ft">sq.ft (Square Feet)</option>
                    <option value="sq.m">sq.m (Square Meters)</option>
                    <option value="Tonnes">Tonnes</option>
                    <option value="Running Meter">Running Meter</option>
                    <option value="Units">Units / Nos</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Approved Qty *</label>
                  <input required type="number" step="0.01" className="form-control" placeholder="800" value={boqForm.approved_qty} onChange={e => setBoqForm({ ...boqForm, approved_qty: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Unit Rate (₹) *</label>
                  <input required type="number" step="0.01" className="form-control" placeholder="150" value={boqForm.rate} onChange={e => setBoqForm({ ...boqForm, rate: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBoqModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingBoqId ? "Save Changes" : "Save BOQ Line Item"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.85rem 1.25rem', borderRadius: '8px',
          background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : toast.type === 'warning' ? 'rgba(245, 158, 11, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          color: '#ffffff', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)', fontWeight: 600, fontSize: '0.88rem'
        }}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXA-03 TEST-CHECK REVIEW MODAL (Pass / Flag)                              */}
      {/* ========================================================================= */}
      {showReviewModal && reviewTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '520px', background: '#1e293b', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={20} color={reviewAction === 'Pass' ? '#10b981' : '#ef4444'} /> 
                {reviewTarget.authority} Test-Check Review ({reviewTarget.mb_reference})
              </h3>
              <button className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => setShowReviewModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '0.85rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
              <div>MB Reference: <strong style={{ color: '#38bdf8' }}>{reviewTarget.mb_reference}</strong></div>
              <div>Description: <strong>{reviewTarget.description}</strong></div>
              <div>Measured Qty: <strong style={{ color: '#10b981' }}>{reviewTarget.quantity} {reviewTarget.unit}</strong></div>
              <div>Sampling Authority: <strong style={{ color: '#c084fc' }}>{reviewTarget.authority} ({reviewTarget.sampling_percentage}%)</strong></div>
            </div>

            <form onSubmit={handleExecuteReview}>
              <div className="form-group">
                <label>Review Decision *</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem' }}>
                  <button 
                    type="button" 
                    className={`btn ${reviewAction === 'Pass' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, background: reviewAction === 'Pass' ? 'linear-gradient(135deg, #10b981, #059669)' : undefined }}
                    onClick={() => setReviewAction('Pass')}
                  >
                    <CheckCircle2 size={16} /> Pass Test-Check
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${reviewAction === 'Flag' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, background: reviewAction === 'Flag' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : undefined }}
                    onClick={() => setReviewAction('Flag')}
                  >
                    <AlertTriangle size={16} /> Flag Entry (Send Back)
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Reviewer Remarks {reviewAction === 'Flag' ? '*' : '(Optional)'}</label>
                <textarea 
                  required={reviewAction === 'Flag'}
                  className="form-control" 
                  rows="3" 
                  value={reviewRemarks} 
                  onChange={e => setReviewRemarks(e.target.value)} 
                  placeholder={reviewAction === 'Flag' 
                    ? "Mandatory remarks explaining measurement discrepancy or physical site inspection failure..." 
                    : "Physical verification verified on site according to CPWD specifications..."}
                />
              </div>

              {reviewAction === 'Flag' && (
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.78rem', color: '#f87171' }}>
                  <strong>Warning:</strong> Flagging this entry will trigger the Send-Back workflow. If a contractor bill has already been submitted for this item, it will automatically be pulled back to Draft.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReviewModal(false)}>Cancel</button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={reviewSubmitting}
                  style={{ background: reviewAction === 'Pass' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                >
                  {reviewSubmitting ? "Submitting..." : `Submit ${reviewAction} Decision`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
