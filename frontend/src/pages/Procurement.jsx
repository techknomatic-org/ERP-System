import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, Plus, FileText, CheckCircle2, DollarSign, AlertTriangle, Truck, 
  LayoutDashboard, Package, Clock, ShieldCheck, History, ArrowRight, X, Check, Edit2, AlertCircle,
  CheckSquare, RefreshCw, ShieldAlert, ShoppingCart, GitCommit, Layers, ArrowUpRight, ChevronRight,
  Info, Building2
} from 'lucide-react';
import { procurementService, projectService, vendorService, inventoryService, approvalService, wbsService } from '../services/api';

export default function Procurement() {
  const location = useLocation();
  const navigate = useNavigate();

  // Helper mapping subpath to tab key
  const getTabFromPath = (pathname) => {
    if (pathname.includes('/material-purchase-requests')) return 'mprs';
    if (pathname.includes('/purchase-requisitions')) return 'prs';
    if (pathname.includes('/vendors')) return 'vendors';
    if (pathname.includes('/purchase-orders')) return 'pos';
    if (pathname.includes('/material-deliveries')) return 'deliveries';
    if (pathname.includes('/low-stock')) return 'low_stock';
    if (pathname.includes('/traceability') || pathname.includes('/history')) return 'history';
    return 'dashboard';
  };

  const activeTab = getTabFromPath(location.pathname);

  const handleTabNavigate = (tabKey) => {
    const pathMap = {
      dashboard: '/procurement',
      mprs: '/procurement/material-purchase-requests',
      prs: '/procurement/purchase-requisitions',
      vendors: '/procurement/vendors',
      pos: '/procurement/purchase-orders',
      deliveries: '/procurement/material-deliveries',
      low_stock: '/procurement/low-stock',
      history: '/procurement/history'
    };
    navigate(pathMap[tabKey] || '/procurement');
  };

  const [kpis, setKpis] = useState({
    total_mprs: 0,
    mprs_converted_to_pr: 0,
    pending_purchase_requests: 0,
    completed_mprs: 0,
    total_prs: 0,
    prs_created: 0,
    approved_prs: 0,
    pending_pos: 0,
    pos_issued: 0,
    low_stock_count: 0,
    active_vendors: 0,
    pending_approvals: 0,
    approval_breakdown: { MPR: 0, PR: 0, PO: 0, GRN: 0 },
    pending_deliveries: 0,
    completed_deliveries: 0,
    total_procurement_value: 0
  });

  const [mprs, setMprs] = useState([]);
  const [prs, setPrs] = useState([]);
  const [approvedPrs, setApprovedPrs] = useState([]);
  const [pos, setPos] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [activeVendors, setActiveVendors] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [history, setHistory] = useState([]);
  const [traceabilityChain, setTraceabilityChain] = useState([]);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [wbsTasks, setWbsTasks] = useState([]);
  const [approvalTasks, setApprovalTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // User Role Check
  const activeRole = (localStorage.getItem('erp_role') || 'admin').toLowerCase();
  const isCustomer = activeRole === 'customer';

  // Modals state
  const [showMprModal, setShowMprModal] = useState(false);
  const [showPrModal, setShowPrModal] = useState(false);
  const [showPoModal, setShowPoModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // Forms state
  const [mprForm, setMprForm] = useState({ 
    project_id: '', 
    wbs_phase_id: '', 
    wbs_task_id: '', 
    wbs_subtask_id: '',
    material_name: '', 
    material_category: 'General Construction', 
    quantity: '', 
    unit: 'cu.m', 
    required_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    estimated_unit_rate: '', 
    estimated_cost: '', 
    reason: '', 
    preferred_vendor_id: '' 
  });

  const [prForm, setPrForm] = useState({ 
    project_id: '', 
    wbs_phase_id: '', 
    wbs_task_id: '', 
    wbs_subtask_id: '', 
    title: '', 
    item_name: '', 
    quantity: '', 
    unit: 'cu.m', 
    estimated_cost: '', 
    required_date: '',
    reason: '', 
    source_material_request_id: '',
    mpr_number: ''
  });

  const [poForm, setPoForm] = useState({ 
    pr_id: '', 
    mpr_id: '',
    project_id: '', 
    wbs_phase_id: '',
    wbs_task_id: '',
    wbs_subtask_id: '',
    vendor_id: '', 
    item_name: '', 
    quantity: '', 
    unit: 'cu.m', 
    unit_price: '', 
    total_amount: '', 
    po_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    payment_terms: 'Net 30 Days after GRN inspection',
    delivery_terms: 'FOR Destination Site Yard',
    remarks: '',
    project_name: '',
    wbs_phase_title: '',
    wbs_task_title: '',
    wbs_subtask_title: ''
  });

  const [vendorForm, setVendorForm] = useState({ name: '', contact_person: '', phone: '', email: '', gst_number: '', pan_number: '', status: 'active' });
  const [deliveryForm, setDeliveryForm] = useState({ 
    po_id: '', 
    po_number: '',
    material_name: '',
    ordered_quantity: 0,
    prior_received: 0,
    remaining_quantity: 0,
    received_quantity: '', 
    delivery_location: 'Central Site Yard', 
    inspection_remarks: 'Quality & Quantity Verified', 
    status: 'FULLY_RECEIVED' 
  });

  const loadData = () => {
    setLoading(true);

    const safeGet = (promiseCall, defaultVal = []) => 
      promiseCall
        .then(res => res.data)
        .catch(err => {
          console.warn("Procurement safeGet caught non-fatal API response:", err);
          return defaultVal;
        });

    Promise.all([
      safeGet(procurementService.getKpis(), {}),
      safeGet(procurementService.getMaterialRequests(), []),
      safeGet(procurementService.getPrs(), []),
      safeGet(procurementService.getApprovedPrs(), []),
      safeGet(procurementService.getPos(), []),
      safeGet(vendorService.getVendors(), []),
      safeGet(procurementService.getActiveVendors(), []),
      safeGet(procurementService.getDeliveries(), []),
      safeGet(procurementService.getHistory(), []),
      safeGet(procurementService.getTraceabilityChain(), []),
      safeGet(inventoryService.getProducts(), []),
      safeGet(projectService.getProjects(), []),
      safeGet(approvalService.getTasks('procurement'), [])
    ])
      .then(([kpiRes, mprRes, prRes, appPrRes, poRes, vndRes, actVndRes, delRes, histRes, traceRes, invRes, prjRes, appTaskRes]) => {
        setKpis(kpiRes || {});
        setMprs(mprRes || []);
        setPrs(prRes || []);
        setApprovedPrs(appPrRes || []);
        setPos(poRes || []);
        setVendors(vndRes || []);
        setActiveVendors(actVndRes && actVndRes.length > 0 ? actVndRes : (vndRes || []).filter(v => v.status === 'active'));
        setDeliveries(delRes || []);
        setHistory(histRes || []);
        setTraceabilityChain(traceRes || []);
        setInventoryProducts(invRes || []);
        setProjects(prjRes || []);
        setApprovalTasks(appTaskRes || []);

        if (prjRes && prjRes.length > 0) {
          const firstProjId = prjRes[0].id;
          setMprForm(f => ({ ...f, project_id: firstProjId }));
          setPrForm(f => ({ ...f, project_id: firstProjId }));
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isCustomer) {
      loadData();
    }
  }, [activeRole]);

  // Fetch WBS tasks dynamically whenever MPR selected project changes
  useEffect(() => {
    if (mprForm.project_id) {
      wbsService.getProjectWbs(mprForm.project_id)
        .then(res => setWbsTasks(res.data || []))
        .catch(err => console.warn("Failed to load project WBS hierarchy:", err));
    } else {
      setWbsTasks([]);
    }
  }, [mprForm.project_id]);

  // Dependent WBS lists logic
  const wbsPhases = wbsTasks.filter(t => 
    (t.task_level || '').toLowerCase() === 'phase' || 
    (!t.parent_task_id && (t.task_level || '').toLowerCase() !== 'subtask')
  );

  const wbsTasksForPhase = mprForm.wbs_phase_id 
    ? wbsTasks.filter(t => 
        t.parent_task_id === parseInt(mprForm.wbs_phase_id) && 
        (t.task_level || '').toLowerCase() === 'task'
      )
    : [];

  const wbsSubtasksForTask = mprForm.wbs_task_id
    ? wbsTasks.filter(t => 
        t.parent_task_id === parseInt(mprForm.wbs_task_id) && 
        (t.task_level || '').toLowerCase() === 'subtask'
      )
    : [];

  // Handlers for MPR Cost calculation
  const handleMprQtyOrRateChange = (qtyVal, rateVal) => {
    const qty = parseFloat(qtyVal);
    const rate = parseFloat(rateVal);
    let estCost = mprForm.estimated_cost;
    if (!isNaN(qty) && !isNaN(rate) && rate >= 0) {
      estCost = (qty * rate).toFixed(2);
    }
    setMprForm(prev => ({
      ...prev,
      quantity: qtyVal,
      estimated_unit_rate: rateVal,
      estimated_cost: estCost
    }));
  };

  // Handlers for Workflows
  const handleCreateMpr = (e) => {
    e.preventDefault();
    if (!mprForm.project_id) { alert("Please select a Project."); return; }
    if (!mprForm.wbs_phase_id) { alert("Please select a WBS Phase."); return; }
    if (!mprForm.wbs_task_id) { alert("Please select a WBS Task."); return; }
    if (!mprForm.material_name) { alert("Please enter Material Name."); return; }
    if (parseFloat(mprForm.quantity) <= 0) { alert("Quantity must be greater than zero."); return; }

    procurementService.createMaterialRequest({
      project_id: parseInt(mprForm.project_id),
      wbs_phase_id: parseInt(mprForm.wbs_phase_id),
      wbs_task_id: parseInt(mprForm.wbs_task_id),
      wbs_subtask_id: mprForm.wbs_subtask_id ? parseInt(mprForm.wbs_subtask_id) : null,
      material_name: mprForm.material_name,
      material_category: mprForm.material_category,
      quantity: parseFloat(mprForm.quantity),
      unit: mprForm.unit,
      required_date: mprForm.required_date ? new Date(mprForm.required_date).toISOString() : null,
      estimated_unit_rate: mprForm.estimated_unit_rate ? parseFloat(mprForm.estimated_unit_rate) : null,
      estimated_cost: parseFloat(mprForm.estimated_cost || 0),
      reason: mprForm.reason,
      preferred_vendor_id: mprForm.preferred_vendor_id ? parseInt(mprForm.preferred_vendor_id) : null
    })
      .then(() => {
        setShowMprModal(false);
        setMprForm({ 
          project_id: projects[0]?.id || '', 
          wbs_phase_id: '', 
          wbs_task_id: '', 
          wbs_subtask_id: '', 
          material_name: '', 
          material_category: 'General Construction', 
          quantity: '', 
          unit: 'cu.m', 
          required_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          estimated_unit_rate: '', 
          estimated_cost: '', 
          reason: '', 
          preferred_vendor_id: '' 
        });
        loadData();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to create MPR"));
  };

  const handleTriggerLowStockMpr = (productId) => {
    procurementService.createLowStockMpr(productId)
      .then((res) => {
        alert(res.data.message || "Low Stock MPR Created!");
        loadData();
      })
      .catch(() => alert("Failed to create Low Stock MPR"));
  };

  const handleConvertMprToPr = (mpr) => {
    setPrForm({
      project_id: mpr.project_id,
      wbs_phase_id: mpr.wbs_phase_id || '',
      wbs_task_id: mpr.wbs_task_id || '',
      wbs_subtask_id: mpr.wbs_subtask_id || '',
      title: `PR for ${mpr.material_name}`,
      item_name: mpr.material_name,
      quantity: mpr.quantity,
      unit: mpr.unit,
      estimated_cost: mpr.estimated_cost,
      required_date: mpr.required_date ? new Date(mpr.required_date).toISOString().split('T')[0] : '',
      reason: `Converted from MPR ${mpr.request_number}`,
      source_material_request_id: mpr.id,
      mpr_number: mpr.request_number
    });
    setShowPrModal(true);
  };

  const handleCreatePr = (e) => {
    e.preventDefault();
    if (!prForm.project_id) { alert("Please select a Project."); return; }
    if (parseFloat(prForm.quantity) <= 0) { alert("Quantity must be greater than zero."); return; }

    procurementService.createPr({
      project_id: parseInt(prForm.project_id),
      wbs_phase_id: prForm.wbs_phase_id ? parseInt(prForm.wbs_phase_id) : null,
      wbs_task_id: prForm.wbs_task_id ? parseInt(prForm.wbs_task_id) : null,
      wbs_subtask_id: prForm.wbs_subtask_id ? parseInt(prForm.wbs_subtask_id) : null,
      title: prForm.title,
      item_name: prForm.item_name || prForm.title,
      quantity: parseFloat(prForm.quantity),
      unit: prForm.unit,
      estimated_cost: parseFloat(prForm.estimated_cost),
      required_date: prForm.required_date ? new Date(prForm.required_date).toISOString() : null,
      reason: prForm.reason,
      source_material_request_id: prForm.source_material_request_id ? parseInt(prForm.source_material_request_id) : null
    })
      .then(() => {
        setShowPrModal(false);
        setPrForm({ 
          project_id: projects[0]?.id || '', 
          wbs_phase_id: '', 
          wbs_task_id: '', 
          wbs_subtask_id: '', 
          title: '', 
          item_name: '', 
          quantity: '', 
          unit: 'cu.m', 
          estimated_cost: '', 
          required_date: '',
          reason: '', 
          source_material_request_id: '',
          mpr_number: '' 
        });
        loadData();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to create PR"));
  };

  // Selection of Approved PR in PO Modal
  const handleSelectApprovedPr = (prIdStr) => {
    const prId = parseInt(prIdStr);
    const pr = approvedPrs.find(p => p.id === prId);
    if (!pr) {
      setPoForm(prev => ({ ...prev, pr_id: '' }));
      return;
    }
    const qty = parseFloat(pr.quantity || 0);
    const estCost = parseFloat(pr.estimated_cost || 0);
    const calcUnitPrice = qty > 0 ? (estCost / qty).toFixed(2) : '0.00';
    const calcTotal = (qty * parseFloat(calcUnitPrice)).toFixed(2);

    const defaultVendorId = activeVendors[0]?.id || vendors[0]?.id || '';

    setPoForm({
      pr_id: pr.id,
      mpr_id: pr.source_material_request_id || '',
      project_id: pr.project_id,
      wbs_phase_id: pr.wbs_phase_id || '',
      wbs_task_id: pr.wbs_task_id || '',
      wbs_subtask_id: pr.wbs_subtask_id || '',
      vendor_id: defaultVendorId,
      item_name: pr.item_name || pr.title,
      quantity: qty,
      unit: pr.unit || 'cu.m',
      unit_price: calcUnitPrice,
      total_amount: calcTotal,
      po_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: pr.required_date ? new Date(pr.required_date).toISOString().split('T')[0] : new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      payment_terms: 'Net 30 Days after GRN inspection',
      delivery_terms: 'FOR Destination Site Yard',
      remarks: `Derived from Approved PR ${pr.req_number}`,
      project_name: pr.project_name || projects.find(p => p.id === pr.project_id)?.name || `Project #${pr.project_id}`,
      wbs_phase_title: pr.wbs_phase_title || 'Phase 1 - Structure',
      wbs_task_title: pr.wbs_task_title || 'Concrete & Reinforcement',
      wbs_subtask_title: pr.wbs_subtask_title || 'N/A'
    });
  };

  const handlePoQtyOrPriceChange = (qtyVal, priceVal) => {
    const qty = parseFloat(qtyVal);
    const price = parseFloat(priceVal);
    const total = (!isNaN(qty) && !isNaN(price)) ? (qty * price).toFixed(2) : '0.00';
    setPoForm(prev => ({
      ...prev,
      quantity: qtyVal,
      unit_price: priceVal,
      total_amount: total
    }));
  };

  const handleGeneratePoFromPr = (pr) => {
    handleSelectApprovedPr(pr.id.toString());
    setShowPoModal(true);
  };

  const handleCreatePo = (e) => {
    e.preventDefault();
    if (!poForm.pr_id) { alert("Please select an Approved PR."); return; }
    if (!poForm.vendor_id) { alert("Please select an active Vendor."); return; }
    if (parseFloat(poForm.quantity) <= 0) { alert("PO Quantity must be greater than zero."); return; }
    if (parseFloat(poForm.unit_price) < 0) { alert("Unit Price cannot be negative."); return; }

    procurementService.createPo({
      pr_id: parseInt(poForm.pr_id),
      mpr_id: poForm.mpr_id ? parseInt(poForm.mpr_id) : null,
      project_id: parseInt(poForm.project_id),
      wbs_phase_id: poForm.wbs_phase_id ? parseInt(poForm.wbs_phase_id) : null,
      wbs_task_id: poForm.wbs_task_id ? parseInt(poForm.wbs_task_id) : null,
      wbs_subtask_id: poForm.wbs_subtask_id ? parseInt(poForm.wbs_subtask_id) : null,
      vendor_id: parseInt(poForm.vendor_id),
      item_name: poForm.item_name,
      quantity: parseFloat(poForm.quantity),
      unit: poForm.unit,
      unit_price: parseFloat(poForm.unit_price),
      total_amount: parseFloat(poForm.total_amount),
      po_date: new Date(poForm.po_date).toISOString(),
      expected_delivery_date: new Date(poForm.expected_delivery_date).toISOString(),
      payment_terms: poForm.payment_terms,
      delivery_terms: poForm.delivery_terms,
      remarks: poForm.remarks
    })
      .then(() => {
        setShowPoModal(false);
        setPoForm({ 
          pr_id: '', mpr_id: '', project_id: projects[0]?.id || '', vendor_id: '', 
          item_name: '', quantity: '', unit: 'cu.m', unit_price: '', total_amount: '', 
          po_date: new Date().toISOString().split('T')[0],
          expected_delivery_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          payment_terms: 'Net 30 Days after GRN inspection',
          delivery_terms: 'FOR Destination Site Yard',
          remarks: ''
        });
        loadData();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to create Purchase Order"));
  };

  const handleCreateVendor = (e) => {
    e.preventDefault();
    const vCode = `V-${Math.floor(100 + Math.random() * 900)}`;
    vendorService.createVendor({
      code: vCode,
      name: vendorForm.name,
      contact_person: vendorForm.contact_person,
      phone: vendorForm.phone,
      email: vendorForm.email,
      gst_number: vendorForm.gst_number,
      pan_number: vendorForm.pan_number,
      status: 'active'
    })
      .then(() => {
        setShowVendorModal(false);
        setVendorForm({ name: '', contact_person: '', phone: '', email: '', gst_number: '', pan_number: '', status: 'active' });
        loadData();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to create Vendor"));
  };

  const handleOpenDeliveryForPo = (po) => {
    const priorDelivs = deliveries.filter(d => d.po_id === po.id);
    const priorRecd = priorDelivs.reduce((acc, d) => acc + Number(d.received_quantity || 0), 0);
    const remaining = Number(po.remaining_quantity !== undefined ? po.remaining_quantity : Math.max(0, Number(po.quantity || 0) - priorRecd));

    setDeliveryForm({
      po_id: po.id,
      po_number: po.po_number,
      material_name: po.item_name,
      ordered_quantity: po.quantity,
      prior_received: priorRecd,
      remaining_quantity: remaining,
      received_quantity: remaining > 0 ? remaining : po.quantity,
      delivery_location: 'Central Site Yard',
      inspection_remarks: 'Quality & Quantity Verified',
      status: remaining <= (remaining > 0 ? remaining : po.quantity) ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED'
    });
    setShowDeliveryModal(true);
  };

  const handleRecordDelivery = (e) => {
    e.preventDefault();
    const recd = parseFloat(deliveryForm.received_quantity);
    const rem = parseFloat(deliveryForm.remaining_quantity);
    if (recd <= 0) {
      alert("Received quantity must be greater than zero.");
      return;
    }
    if (rem > 0 && recd > rem + 0.0001) {
      alert(`Received quantity (${recd}) cannot exceed remaining PO quantity (${rem}).`);
      return;
    }

    procurementService.recordDelivery({
      po_id: parseInt(deliveryForm.po_id),
      received_quantity: recd,
      delivery_location: deliveryForm.delivery_location || 'Central Site Yard',
      inspection_remarks: deliveryForm.inspection_remarks,
      status: (rem > 0 && recd >= rem) ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED'
    })
      .then(() => {
        setShowDeliveryModal(false);
        setDeliveryForm({ po_id: '', po_number: '', material_name: '', ordered_quantity: 0, prior_received: 0, remaining_quantity: 0, received_quantity: '', delivery_location: '', inspection_remarks: '', status: 'FULLY_RECEIVED' });
        loadData();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to record delivery"));
  };

  const lowStockProducts = inventoryProducts.filter(p => p.stock <= (p.min_stock_alert || 10));

  return (
    <div className="content-page">
      {/* Page Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShoppingCart size={28} color="var(--primary)" />
            <span>Procurement & Supply Chain Management</span>
          </h1>
          <p className="page-subtitle">
            End-to-End Governance: Project WBS ➔ MPR ➔ PR ➔ PO ➔ GRN ➔ Auto Inventory
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="tag-badge tag-success">ACTIVE ROLE: PROCUREMENT</span>
          <button type="button" className="btn btn-secondary" onClick={loadData}>
            <RefreshCw size={15} className={loading ? "spin-animation" : ""} /> Refresh Data
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setShowMprModal(true)}>
            <Plus size={16} /> New Material Request (MPR)
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setShowPrModal(true)}>
            <Plus size={16} /> New Requisition (PR)
          </button>
          <button type="button" className="btn btn-primary" onClick={() => {
            if (approvedPrs.length > 0) {
              handleSelectApprovedPr(approvedPrs[0].id.toString());
            }
            setShowPoModal(true);
          }}>
            <Plus size={16} /> Generate PO
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        {[
          { key: 'dashboard', label: 'Procurement Dashboard', icon: LayoutDashboard },
          { key: 'mprs', label: `Material Requests (${mprs.length})`, icon: ShoppingCart },
          { key: 'prs', label: `Requisitions PR (${prs.length})`, icon: FileText },
          { key: 'vendors', label: `Vendors / Suppliers (${vendors.length})`, icon: Truck },
          { key: 'pos', label: `Purchase Orders PO (${pos.length})`, icon: Package },
          { key: 'deliveries', label: `Deliveries & GRN (${deliveries.length})`, icon: CheckSquare },
          { key: 'low_stock', label: `Low Stock Alerts (${lowStockProducts.length})`, icon: AlertTriangle },
          { key: 'history', label: 'Procurement History', icon: History }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.82rem', padding: '0.5rem 0.85rem', whiteSpace: 'nowrap' }}
              onClick={() => handleTabNavigate(tab.key)}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* SECTION 1: PROCUREMENT DASHBOARD (MAIN LANDING PAGE) */}
      {activeTab === 'dashboard' && (
        <div>
          {/* 5 REAL DATABASE KPI SUMMARY CARDS */}
          <div className="kpi-grid" style={{ marginBottom: '1.75rem' }}>
            <div className="kpi-card" style={{ borderLeft: '4px solid var(--primary)', cursor: 'pointer' }} onClick={() => handleTabNavigate('mprs')}>
              <div>
                <div className="kpi-title">1. Material Requests (MPR)</div>
                <div className="kpi-value" style={{ color: 'var(--primary)' }}>{kpis.total_mprs || mprs.length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {kpis.mprs_converted_to_pr || 0} Converted to PR • {kpis.pending_purchase_requests || 0} Pending
                </div>
              </div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '4px solid var(--accent-cyan)', cursor: 'pointer' }} onClick={() => handleTabNavigate('pos')}>
              <div>
                <div className="kpi-title">2. Issued Purchase Orders (PO)</div>
                <div className="kpi-value" style={{ color: 'var(--accent-cyan)' }}>{kpis.pos_issued || pos.length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Active Vendor POs Issued
                </div>
              </div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '4px solid var(--accent-amber)', cursor: 'pointer' }} onClick={() => handleTabNavigate('low_stock')}>
              <div>
                <div className="kpi-title">3. Low Stock Material Items</div>
                <div className="kpi-value" style={{ color: 'var(--accent-amber)' }}>{lowStockProducts.length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Stock ≤ Reorder Threshold
                </div>
              </div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '4px solid var(--accent-emerald)', cursor: 'pointer' }} onClick={() => handleTabNavigate('vendors')}>
              <div>
                <div className="kpi-title">4. Active Vendor Directory</div>
                <div className="kpi-value" style={{ color: 'var(--accent-emerald)' }}>{kpis.active_vendors || activeVendors.length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Registered Active Suppliers
                </div>
              </div>
            </div>

            <div className="kpi-card" style={{ borderLeft: '4px solid var(--accent-rose)', cursor: 'pointer' }} onClick={() => navigate('/approvals')}>
              <div>
                <div className="kpi-title">5. Pending Approvals</div>
                <div className="kpi-value" style={{ color: 'var(--accent-rose)' }}>{kpis.pending_approvals || approvalTasks.length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {kpis.approval_breakdown?.MPR || 0} MPR | {kpis.approval_breakdown?.PR || 0} PR | {kpis.approval_breakdown?.PO || 0} PO | {kpis.approval_breakdown?.GRN || 0} GRN
                </div>
              </div>
            </div>
          </div>

          {/* SECOND SECTION: PENDING APPROVALS / ALERTS */}
          <div className="glass-card" style={{ marginBottom: '1.75rem' }}>
            <div className="card-header">
              <div className="card-title"><CheckSquare size={18} color="var(--accent-rose)" /> Pending Procurement Approvals Queue</div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/approvals')}>View Full Approvals Module ➔</button>
            </div>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Ref ID</th>
                    <th>Approval Title</th>
                    <th>Category</th>
                    <th>Current Stage</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalTasks.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No pending procurement approvals awaiting action.
                      </td>
                    </tr>
                  ) : (
                    approvalTasks.slice(0, 4).map(task => (
                      <tr key={task.id}>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>#{task.id}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{task.title}</td>
                        <td><span className="tag-badge tag-info">{task.entity_type}</span></td>
                        <td>{task.current_stage}</td>
                        <td><span className="tag-badge tag-warning">{task.status}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/approvals')}>
                            Process Approval
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* THIRD SECTION: RECENT MATERIAL REQUESTS */}
          <div className="glass-card" style={{ marginBottom: '1.75rem' }}>
            <div className="card-header">
              <div className="card-title"><ShoppingCart size={18} color="var(--primary)" /> Recent Material Purchase Requests (MPR)</div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTabNavigate('mprs')}>View All MPRs ➔</button>
            </div>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>MPR #</th>
                    <th>Project & WBS Task</th>
                    <th>Material Name</th>
                    <th>Quantity</th>
                    <th>Est. Rate</th>
                    <th>Estimated Cost</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {mprs.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No material requests recorded yet.
                      </td>
                    </tr>
                  ) : (
                    mprs.slice(0, 5).map(mpr => (
                      <tr key={mpr.id}>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{mpr.request_number}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{mpr.project_name || `Project #${mpr.project_id}`}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {mpr.wbs_phase_title ? `${mpr.wbs_phase_title} ➔ ${mpr.wbs_task_title || ''}` : 'General Site Requirement'}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{mpr.material_name}</td>
                        <td>{mpr.quantity} {mpr.unit}</td>
                        <td>{mpr.estimated_unit_rate ? `₹${mpr.estimated_unit_rate}` : 'N/A'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>₹{Number(mpr.estimated_cost || 0).toLocaleString()}</td>
                        <td><span className="tag-badge tag-warning">{mpr.status}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          {(mpr.status === 'APPROVED_BY_PM' || mpr.status === 'SUBMITTED' || mpr.status === 'APPROVED') && (
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => handleConvertMprToPr(mpr)}>
                              Convert to PR ➔
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* FOURTH SECTION: RECENT PURCHASE ORDERS */}
          <div className="glass-card" style={{ marginBottom: '1.75rem' }}>
            <div className="card-header">
              <div className="card-title"><Package size={18} color="var(--accent-cyan)" /> Recent Issued Purchase Orders (PO)</div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTabNavigate('pos')}>View All POs ➔</button>
            </div>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>PO Ref #</th>
                    <th>PR Source</th>
                    <th>Vendor / Supplier</th>
                    <th>Item Description</th>
                    <th>Quantity & Unit</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No purchase orders issued yet.
                      </td>
                    </tr>
                  ) : (
                    pos.slice(0, 5).map(po => {
                      const vndName = po.vendor?.name || vendors.find(v => v.id === po.vendor_id)?.name || `Vendor #${po.vendor_id}`;
                      return (
                        <tr key={po.id}>
                          <td style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{po.po_number}</td>
                          <td>{po.pr_number ? po.pr_number : (po.pr_id ? `PR #${po.pr_id}` : 'Direct PO')}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{vndName}</td>
                          <td>{po.item_name || 'Material Order'}</td>
                          <td>{po.quantity} {po.unit || 'unit'}</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>₹{Number(po.total_amount || 0).toLocaleString()}</td>
                          <td>
                            <span className={`tag-badge ${po.status === 'COMPLETED' ? 'tag-success' : (po.status === 'PARTIALLY DELIVERED' ? 'tag-warning' : 'tag-info')}`}>
                              {po.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {po.status !== 'COMPLETED' && (
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenDeliveryForPo(po)}>
                                Record Delivery (GRN)
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* OPERATIONAL TAB 2: MATERIAL REQUESTS (MPR) */}
      {activeTab === 'mprs' && (
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">Material Purchase Requests (MPR)</div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowMprModal(true)}>+ New MPR</button>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Request #</th>
                  <th>Project</th>
                  <th>WBS Phase & Task</th>
                  <th>Material Name</th>
                  <th>Quantity & Unit</th>
                  <th>Est. Unit Rate</th>
                  <th>Estimated Cost</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mprs.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No material requests recorded.</td></tr>
                ) : (
                  mprs.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{m.request_number}</td>
                      <td>{m.project_name || `Project #${m.project_id}`}</td>
                      <td>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{m.wbs_phase_title || 'N/A'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.wbs_task_title ? `➔ ${m.wbs_task_title}` : ''}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.material_name}</td>
                      <td>{m.quantity} {m.unit}</td>
                      <td>{m.estimated_unit_rate ? `₹${m.estimated_unit_rate}` : 'N/A'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>₹{Number(m.estimated_cost || 0).toLocaleString()}</td>
                      <td><span className="tag-badge tag-info">{m.status}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        {(m.status === 'APPROVED_BY_PM' || m.status === 'SUBMITTED' || m.status === 'APPROVED') && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleConvertMprToPr(m)}>
                            Convert to PR ➔
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OPERATIONAL TAB 3: REQUISITIONS PR */}
      {activeTab === 'prs' && (
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">Purchase Requisitions (PR)</div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowPrModal(true)}>+ New PR Requisition</button>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>PR #</th>
                  <th>Source MPR</th>
                  <th>Project & WBS</th>
                  <th>Item / Material</th>
                  <th>Quantity & Unit</th>
                  <th>Estimated Cost</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {prs.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No purchase requisitions recorded.</td></tr>
                ) : (
                  prs.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{p.req_number}</td>
                      <td>{p.mpr_number ? p.mpr_number : 'Direct PR'}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.project_name || `Project #${p.project_id}`}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.wbs_phase_title ? `${p.wbs_phase_title} ➔ ${p.wbs_task_title || ''}` : ''}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.item_name || p.title}</td>
                      <td>{p.quantity} {p.unit}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>₹{Number(p.estimated_cost || 0).toLocaleString()}</td>
                      <td><span className="tag-badge tag-success">{p.status}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        {p.status === 'approved' && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleGeneratePoFromPr(p)}>
                            Generate PO ➔
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OPERATIONAL TAB 4: VENDORS */}
      {activeTab === 'vendors' && (
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">Active Vendor Directory</div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowVendorModal(true)}>+ Register Vendor</button>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Vendor Code</th>
                  <th>Business Name</th>
                  <th>Contact Person</th>
                  <th>Phone / Email</th>
                  <th>GST Number</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeVendors.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No active vendors available.</td></tr>
                ) : (
                  activeVendors.map(v => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{v.code}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{v.name}</td>
                      <td>{v.contact_person || 'N/A'}</td>
                      <td>{v.phone || v.email || 'N/A'}</td>
                      <td><code>{v.gst_number || 'UNREGISTERED'}</code></td>
                      <td><span className="tag-badge tag-success">{v.status || 'ACTIVE'}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OPERATIONAL TAB 5: PURCHASE ORDERS (PO) */}
      {activeTab === 'pos' && (
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">Issued Purchase Orders (PO)</div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => {
              if (approvedPrs.length > 0) {
                handleSelectApprovedPr(approvedPrs[0].id.toString());
              }
              setShowPoModal(true);
            }}>+ Generate PO</button>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>PR Ref</th>
                  <th>Project & WBS</th>
                  <th>Vendor</th>
                  <th>Item Description</th>
                  <th>Quantity & Unit</th>
                  <th>Unit Price</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pos.length === 0 ? (
                  <tr><td colSpan="10" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No purchase orders issued yet.</td></tr>
                ) : (
                  pos.map(po => {
                    const vndName = po.vendor?.name || vendors.find(v => v.id === po.vendor_id)?.name || `Vendor #${po.vendor_id}`;
                    return (
                      <tr key={po.id}>
                        <td style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{po.po_number}</td>
                        <td>{po.pr_number ? po.pr_number : (po.pr_id ? `PR #${po.pr_id}` : 'Direct PO')}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{po.project_name || `Project #${po.project_id}`}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{po.wbs_phase_title ? `${po.wbs_phase_title} ➔ ${po.wbs_task_title || ''}` : ''}</div>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{vndName}</td>
                        <td>{po.item_name}</td>
                        <td>{po.quantity} {po.unit || 'unit'}</td>
                        <td>₹{po.unit_price}</td>
                        <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>₹{Number(po.total_amount || 0).toLocaleString()}</td>
                        <td>
                          <span className={`tag-badge ${po.status === 'COMPLETED' ? 'tag-success' : (po.status === 'PARTIALLY DELIVERED' ? 'tag-warning' : 'tag-info')}`}>
                            {po.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {po.status !== 'COMPLETED' && (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenDeliveryForPo(po)}>
                              Record Delivery (GRN)
                            </button>
                          )}
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

      {/* OPERATIONAL TAB 6: MATERIAL DELIVERIES (GRN) */}
      {activeTab === 'deliveries' && (
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title">Material Deliveries & Goods Received Notes (GRN)</div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowDeliveryModal(true)}>+ Record Delivery</button>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>GRN Code</th>
                  <th>PO Reference</th>
                  <th>Supplier / Vendor</th>
                  <th>Material</th>
                  <th>Received Quantity</th>
                  <th>Delivery Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No material deliveries recorded yet.</td></tr>
                ) : (
                  deliveries.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{d.delivery_code}</td>
                      <td>{d.po_number || `PO #${d.po_id}`}</td>
                      <td>{d.vendor_name || `Vendor #${d.vendor_id}`}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.material_name}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{d.received_quantity} units</td>
                      <td>{d.delivery_location}</td>
                      <td><span className="tag-badge tag-success">{d.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OPERATIONAL TAB 7: LOW STOCK ALERTS & REORDER HUB */}
      {activeTab === 'low_stock' && (
        <div className="glass-card">
          <div className="card-header">
            <div className="card-title"><AlertTriangle size={18} color="var(--accent-amber)" /> Low Stock Material Reorder Hub</div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/inventory')}>View Full Inventory ➔</button>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>SKU Code</th>
                  <th>Material Name</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Reorder Level</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Trigger Action</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>All materials are in stock above reorder thresholds!</td></tr>
                ) : (
                  lowStockProducts.map(prod => (
                    <tr key={prod.id}>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{prod.sku}</td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{prod.name}</td>
                      <td>{prod.category}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-rose)' }}>{prod.stock} units</td>
                      <td>{prod.min_stock_alert || 10} units</td>
                      <td><span className="tag-badge tag-danger">LOW STOCK</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => handleTriggerLowStockMpr(prod.id)}>
                          + Trigger Reorder MPR
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OPERATIONAL TAB 8: PROCUREMENT HISTORY & TRACEABILITY */}
      {activeTab === 'history' && (
        <div>
          <div className="glass-card" style={{ marginBottom: '1.75rem' }}>
            <div className="card-header">
              <div className="card-title"><GitCommit size={18} color="var(--primary)" /> End-to-End Procurement Traceability Chain</div>
            </div>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>MPR Ref</th>
                    <th>Project & WBS Path</th>
                    <th>Material</th>
                    <th>PR Ref</th>
                    <th>Vendor</th>
                    <th>PO Ref</th>
                    <th>Deliveries (GRN)</th>
                    <th>Chain Status</th>
                  </tr>
                </thead>
                <tbody>
                  {traceabilityChain.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No active traceability chains recorded yet.</td></tr>
                  ) : (
                    traceabilityChain.map((chain, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{chain.mpr_number}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{chain.project_name || 'Project'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{chain.wbs_path || ''}</div>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{chain.material_name}</td>
                        <td>{chain.pr_number}</td>
                        <td>{chain.vendor_name}</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{chain.po_number}</td>
                        <td>{chain.deliveries_count} Receipts ({chain.total_received} units)</td>
                        <td><span className="tag-badge tag-info">{chain.po_status !== 'N/A' ? chain.po_status : chain.mpr_status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card">
            <div className="card-header">
              <div className="card-title"><History size={18} color="var(--text-secondary)" /> Procurement System Audit Log</div>
            </div>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Entity Type</th>
                    <th>User / Role</th>
                    <th>Payload Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No audit history recorded.</td></tr>
                  ) : (
                    history.map(h => (
                      <tr key={h.id}>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(h.created_at).toLocaleString()}</td>
                        <td><span className="tag-badge tag-neutral">{h.action}</span></td>
                        <td>{h.entity_type}</td>
                        <td>{h.user_name} ({h.user_role})</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{h.payload}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 1. NEW MATERIAL PURCHASE REQUEST (MPR) MODAL */}
      {showMprModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
          <div className="glass-card" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto', background: '#0f172a', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShoppingCart size={20} color="var(--primary)" />
                <span>New Material Purchase Request (MPR)</span>
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowMprModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateMpr}>
              {/* Project & Dependent WBS Hierarchy Group */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  1. PROJECT & DEPENDENT WBS LOCATION
                </div>
                
                <div className="form-group">
                  <label>Project *</label>
                  <select 
                    required 
                    className="form-select" 
                    value={mprForm.project_id} 
                    onChange={e => setMprForm({ ...mprForm, project_id: e.target.value, wbs_phase_id: '', wbs_task_id: '', wbs_subtask_id: '' })}
                    style={{ background: '#0f172a', color: '#f8fafc' }}
                  >
                    <option value="" style={{ background: '#1e293b' }}>-- Select Target Project --</option>
                    {projects.map(p => <option key={p.id} value={p.id} style={{ background: '#1e293b' }}>{p.code}: {p.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>WBS Phase *</label>
                    <select 
                      required 
                      className="form-select" 
                      value={mprForm.wbs_phase_id} 
                      onChange={e => setMprForm({ ...mprForm, wbs_phase_id: e.target.value, wbs_task_id: '', wbs_subtask_id: '' })}
                      style={{ background: '#0f172a', color: '#f8fafc' }}
                    >
                      <option value="" style={{ background: '#1e293b' }}>-- Select Phase --</option>
                      {wbsPhases.map(ph => <option key={ph.id} value={ph.id} style={{ background: '#1e293b' }}>{ph.title}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>WBS Task *</label>
                    <select 
                      required 
                      className="form-select" 
                      value={mprForm.wbs_task_id} 
                      onChange={e => setMprForm({ ...mprForm, wbs_task_id: e.target.value, wbs_subtask_id: '' })}
                      disabled={!mprForm.wbs_phase_id}
                      style={{ background: '#0f172a', color: '#f8fafc' }}
                    >
                      <option value="" style={{ background: '#1e293b' }}>-- Select Task --</option>
                      {wbsTasksForPhase.map(tk => <option key={tk.id} value={tk.id} style={{ background: '#1e293b' }}>{tk.title}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>WBS Subtask (Optional)</label>
                  <select 
                    className="form-select" 
                    value={mprForm.wbs_subtask_id} 
                    onChange={e => setMprForm({ ...mprForm, wbs_subtask_id: e.target.value })}
                    disabled={!mprForm.wbs_task_id}
                    style={{ background: '#0f172a', color: '#f8fafc' }}
                  >
                    <option value="" style={{ background: '#1e293b' }}>-- Select Subtask (Optional) --</option>
                    {wbsSubtasksForTask.map(sub => <option key={sub.id} value={sub.id} style={{ background: '#1e293b' }}>{sub.title}</option>)}
                  </select>
                </div>
              </div>

              {/* Material Details Group */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  2. MATERIAL REQUIREMENTS & COST CALCULATIONS
                </div>

                <div className="form-group">
                  <label>Material Name *</label>
                  <input 
                    required 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. M30 Grade Ready Mix Concrete" 
                    value={mprForm.material_name} 
                    onChange={e => setMprForm({ ...mprForm, material_name: e.target.value })} 
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input 
                      required 
                      type="number" 
                      step="0.01" 
                      min="0.01"
                      className="form-control" 
                      placeholder="800" 
                      value={mprForm.quantity} 
                      onChange={e => handleMprQtyOrRateChange(e.target.value, mprForm.estimated_unit_rate)} 
                    />
                  </div>

                  <div className="form-group">
                    <label>Unit of Measure *</label>
                    <input 
                      required 
                      type="text" 
                      className="form-control" 
                      placeholder="cu.m, bags, tonnes" 
                      value={mprForm.unit} 
                      onChange={e => setMprForm({ ...mprForm, unit: e.target.value })} 
                    />
                  </div>

                  <div className="form-group">
                    <label>Required Date *</label>
                    <input 
                      required 
                      type="date" 
                      className="form-control" 
                      value={mprForm.required_date} 
                      onChange={e => setMprForm({ ...mprForm, required_date: e.target.value })} 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Estimated Unit Rate (₹)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      className="form-control" 
                      placeholder="150" 
                      value={mprForm.estimated_unit_rate} 
                      onChange={e => handleMprQtyOrRateChange(mprForm.quantity, e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label>Estimated Total Cost (₹) *</label>
                    <input 
                      required 
                      type="number" 
                      step="0.01" 
                      className="form-control" 
                      placeholder="120000" 
                      value={mprForm.estimated_cost} 
                      onChange={e => setMprForm({ ...mprForm, estimated_cost: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Reason / Remarks</label>
                  <textarea 
                    className="form-control" 
                    placeholder="Justification for site material request..." 
                    value={mprForm.reason} 
                    onChange={e => setMprForm({ ...mprForm, reason: e.target.value })} 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMprModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit MPR</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CREATE PR MODAL */}
      {showPrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
          <div className="glass-card" style={{ width: '560px', background: '#0f172a', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0 }}>Create Purchase Requisition (PR)</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPrModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreatePr}>
              {prForm.mpr_number && (
                <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--accent-cyan)', marginBottom: '1rem' }}>
                  ℹ️ Auto-Carried Forward from <strong>MPR #{prForm.mpr_number}</strong>
                </div>
              )}
              <div className="form-group">
                <label>Target Project *</label>
                <select required className="form-select" value={prForm.project_id} onChange={e => setPrForm({ ...prForm, project_id: e.target.value })}>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.code}: {p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Requisition Title *</label>
                <input required type="text" className="form-control" placeholder="e.g. PR for Ready Mix Concrete M30 Grade" value={prForm.title} onChange={e => setPrForm({ ...prForm, title: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Quantity *</label>
                  <input required type="number" step="0.01" min="0.01" className="form-control" placeholder="800" value={prForm.quantity} onChange={e => setPrForm({ ...prForm, quantity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Unit *</label>
                  <input required type="text" className="form-control" placeholder="cu.m, bags" value={prForm.unit} onChange={e => setPrForm({ ...prForm, unit: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Estimated Total Cost (₹) *</label>
                <input required type="number" step="0.01" className="form-control" placeholder="120000" value={prForm.estimated_cost} onChange={e => setPrForm({ ...prForm, estimated_cost: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPrModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Approved PR</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. GENERATE PO MODAL (REQUIREMENT 4, 5, 6, 7, 13) */}
      {showPoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
          <div className="glass-card" style={{ width: '680px', maxHeight: '92vh', overflowY: 'auto', background: '#0f172a', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={20} color="var(--accent-cyan)" />
                <span>Generate Purchase Order (PO)</span>
              </h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPoModal(false)}><X size={16} /></button>
            </div>
            
            <form onSubmit={handleCreatePo}>
              {/* SECTION 1: SOURCE INFORMATION */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText size={15} /> SOURCE INFORMATION
                </div>

                <div className="form-group">
                  <label>Select Approved PR *</label>
                  <select 
                    required 
                    className="form-select" 
                    value={poForm.pr_id} 
                    onChange={e => handleSelectApprovedPr(e.target.value)}
                    style={{ background: '#0f172a', color: '#f8fafc', fontWeight: 600 }}
                  >
                    <option value="" style={{ background: '#1e293b' }}>-- Select Approved Purchase Requisition --</option>
                    {approvedPrs.length === 0 ? (
                      <option value="" disabled style={{ background: '#1e293b', color: 'var(--accent-rose)' }}>No Approved PRs available. Create and approve a PR first.</option>
                    ) : (
                      approvedPrs.map(pr => (
                        <option key={pr.id} value={pr.id} style={{ background: '#1e293b', color: '#f8fafc' }}>
                          {pr.req_number} | {pr.item_name || pr.title} | {pr.quantity} {pr.unit} | Approved
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Project (Read-only)</label>
                    <input type="text" readOnly className="form-control" value={poForm.project_name || 'Select PR first'} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }} />
                  </div>

                  <div className="form-group">
                    <label>WBS Phase (Read-only)</label>
                    <input type="text" readOnly className="form-control" value={poForm.wbs_phase_title || 'N/A'} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>WBS Task (Read-only)</label>
                    <input type="text" readOnly className="form-control" value={poForm.wbs_task_title || 'N/A'} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }} />
                  </div>

                  <div className="form-group">
                    <label>WBS Subtask (Read-only)</label>
                    <input type="text" readOnly className="form-control" value={poForm.wbs_subtask_title || 'N/A'} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Material Description (Read-only)</label>
                    <input type="text" readOnly className="form-control" value={poForm.item_name || ''} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }} />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Approved Qty</label>
                    <input type="text" readOnly className="form-control" value={poForm.quantity || ''} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }} />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Unit</label>
                    <input type="text" readOnly className="form-control" value={poForm.unit || ''} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }} />
                  </div>
                </div>
              </div>

              {/* SECTION 2: VENDOR INFORMATION */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Truck size={15} /> VENDOR INFORMATION
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Select Vendor / Supplier *</label>
                  <select 
                    required 
                    className="form-select" 
                    value={poForm.vendor_id} 
                    onChange={e => setPoForm({ ...poForm, vendor_id: e.target.value })}
                    style={{ background: '#0f172a', color: '#f8fafc' }}
                  >
                    <option value="" style={{ background: '#1e293b', color: '#94a3b8' }}>-- Select Active Registered Vendor --</option>
                    {activeVendors.length === 0 ? (
                      <option value="" disabled style={{ background: '#1e293b', color: 'var(--accent-rose)' }}>No active vendors available</option>
                    ) : (
                      activeVendors.map(v => (
                        <option key={v.id} value={v.id} style={{ background: '#1e293b', color: '#f8fafc' }}>
                          {v.code} - {v.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* SECTION 3: ORDER INFORMATION */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-amber)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <DollarSign size={15} /> ORDER INFORMATION & CALCULATIONS
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>PO Quantity *</label>
                    <input 
                      required 
                      type="number" 
                      step="0.01" 
                      min="0.01"
                      className="form-control" 
                      value={poForm.quantity} 
                      onChange={e => handlePoQtyOrPriceChange(e.target.value, poForm.unit_price)} 
                    />
                  </div>

                  <div className="form-group">
                    <label>Unit Price (₹) *</label>
                    <input 
                      required 
                      type="number" 
                      step="0.01" 
                      min="0"
                      className="form-control" 
                      placeholder="150"
                      value={poForm.unit_price} 
                      onChange={e => handlePoQtyOrPriceChange(poForm.quantity, e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label>Total PO Amount (₹)</label>
                    <input 
                      required 
                      type="number" 
                      readOnly
                      className="form-control" 
                      value={poForm.total_amount} 
                      style={{ fontWeight: 700, color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.1)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>PO Issue Date *</label>
                    <input required type="date" className="form-control" value={poForm.po_date} onChange={e => setPoForm({ ...poForm, po_date: e.target.value })} />
                  </div>

                  <div className="form-group">
                    <label>Expected Delivery Date *</label>
                    <input required type="date" className="form-control" value={poForm.expected_delivery_date} onChange={e => setPoForm({ ...poForm, expected_delivery_date: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Payment Terms</label>
                    <input type="text" className="form-control" placeholder="e.g. Net 30 Days after GRN" value={poForm.payment_terms} onChange={e => setPoForm({ ...poForm, payment_terms: e.target.value })} />
                  </div>

                  <div className="form-group">
                    <label>Delivery Terms</label>
                    <input type="text" className="form-control" placeholder="e.g. FOR Destination Site Yard" value={poForm.delivery_terms} onChange={e => setPoForm({ ...poForm, delivery_terms: e.target.value })} />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>PO Remarks</label>
                  <textarea className="form-control" placeholder="Special terms, quality specs, delivery notes..." value={poForm.remarks} onChange={e => setPoForm({ ...poForm, remarks: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPoModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Issue Purchase Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. REGISTER VENDOR MODAL */}
      {showVendorModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
          <div className="glass-card" style={{ width: '520px', background: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0 }}>Register New Supplier / Vendor</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowVendorModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateVendor}>
              <div className="form-group">
                <label>Vendor Business Name *</label>
                <input required type="text" className="form-control" placeholder="e.g. ABC Concrete" value={vendorForm.name} onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Contact Person</label>
                  <input type="text" className="form-control" placeholder="Rajesh Sharma" value={vendorForm.contact_person} onChange={e => setVendorForm({ ...vendorForm, contact_person: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="text" className="form-control" placeholder="+91 98765 43210" value={vendorForm.phone} onChange={e => setVendorForm({ ...vendorForm, phone: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" className="form-control" placeholder="sales@abcconcrete.com" value={vendorForm.email} onChange={e => setVendorForm({ ...vendorForm, email: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>GST Number</label>
                  <input type="text" className="form-control" placeholder="27AAAAA0000A1Z5" value={vendorForm.gst_number} onChange={e => setVendorForm({ ...vendorForm, gst_number: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>PAN Number</label>
                  <input type="text" className="form-control" placeholder="AAAAA0000A" value={vendorForm.pan_number} onChange={e => setVendorForm({ ...vendorForm, pan_number: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowVendorModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Vendor Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. RECORD DELIVERY / GRN MODAL (REQUIREMENT 10) */}
      {showDeliveryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
          <div className="glass-card" style={{ width: '560px', background: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
              <h3 style={{ margin: 0 }}>Record Material Delivery (GRN)</h3>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowDeliveryModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleRecordDelivery}>
              <div className="form-group">
                <label>Select Purchase Order (PO) *</label>
                <select 
                  required 
                  className="form-select" 
                  value={deliveryForm.po_id} 
                  onChange={e => {
                    const selectedPo = pos.find(p => p.id === parseInt(e.target.value));
                    if (selectedPo) {
                      handleOpenDeliveryForPo(selectedPo);
                    }
                  }}
                  style={{ background: '#0f172a', color: '#f8fafc' }}
                >
                  <option value="" style={{ background: '#1e293b' }}>-- Select PO --</option>
                  {pos.map(po => (
                    <option key={po.id} value={po.id} style={{ background: '#1e293b' }}>
                      {po.po_number}: {po.item_name} (Ordered: {po.quantity}, Remaining: {po.remaining_quantity !== undefined ? po.remaining_quantity : po.quantity})
                    </option>
                  ))}
                </select>
              </div>

              {deliveryForm.po_number && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <div><strong>PO Reference:</strong> {deliveryForm.po_number}</div>
                  <div><strong>Material:</strong> {deliveryForm.material_name}</div>
                  <div><strong>Ordered Quantity:</strong> {deliveryForm.ordered_quantity}</div>
                  <div><strong>Prior Received:</strong> {deliveryForm.prior_received}</div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-emerald)', marginTop: '0.2rem' }}>
                    <strong>Remaining Quantity to Receive:</strong> {deliveryForm.remaining_quantity}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Received Quantity *</label>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  min="0.01"
                  className="form-control" 
                  placeholder="500" 
                  value={deliveryForm.received_quantity} 
                  onChange={e => setDeliveryForm({ ...deliveryForm, received_quantity: e.target.value })} 
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', marginTop: '0.2rem', display: 'block' }}>
                  ⚡ Auto-Increases Material Inventory Stock upon GRN receipt.
                </span>
              </div>
              <div className="form-group">
                <label>Delivery Yard / Location *</label>
                <input required type="text" className="form-control" value={deliveryForm.delivery_location} onChange={e => setDeliveryForm({ ...deliveryForm, delivery_location: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Inspection Remarks</label>
                <textarea className="form-control" value={deliveryForm.inspection_remarks} onChange={e => setDeliveryForm({ ...deliveryForm, inspection_remarks: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeliveryModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record GRN Delivery</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
