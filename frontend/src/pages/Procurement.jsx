import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, Plus, FileText, CheckCircle2, DollarSign, AlertTriangle, Truck, 
  LayoutDashboard, Package, Clock, ShieldCheck, History, ArrowRight, X, Check, Edit2, AlertCircle,
  CheckSquare, RefreshCw, ShieldAlert
} from 'lucide-react';
import { procurementService, projectService, vendorService } from '../services/api';

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
    if (pathname.includes('/history')) return 'history';
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
      history: '/procurement/history'
    };
    navigate(pathMap[tabKey] || '/procurement');
  };

  const [kpis, setKpis] = useState({
    pending_purchase_requests: 0,
    prs_created: 0,
    pending_pos: 0,
    pos_issued: 0,
    pending_deliveries: 0,
    completed_deliveries: 0,
    total_procurement_value: 0
  });

  const [mprs, setMprs] = useState([]);
  const [prs, setPrs] = useState([]);
  const [approvedPrs, setApprovedPrs] = useState([]);
  const [pos, setPos] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [history, setHistory] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // User Role & Persona Check (Section 6)
  const activeRole = (localStorage.getItem('erp_role') || 'admin').toLowerCase();
  const isCustomer = activeRole === 'customer';

  // Modals state
  const [showMprModal, setShowMprModal] = useState(false);
  const [showPrModal, setShowPrModal] = useState(false);
  const [showPoModal, setShowPoModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // Forms state
  const [mprForm, setMprForm] = useState({ project_id: '', material_name: '', material_category: 'General Construction', quantity: '', unit: 'unit', estimated_cost: '', reason: '', preferred_vendor_id: '' });
  const [prForm, setPrForm] = useState({ project_id: '', title: '', item_name: '', quantity: '', unit: 'unit', estimated_cost: '', reason: '', source_material_request_id: '' });
  const [poForm, setPoForm] = useState({ pr_id: '', project_id: '', vendor_id: '', item_name: '', quantity: '', unit_price: '', total_amount: '', delivery_date: '' });
  const [vendorForm, setVendorForm] = useState({ name: '', contact_person: '', phone: '', email: '', gst_number: '', pan_number: '', status: 'active' });
  const [deliveryForm, setDeliveryForm] = useState({ po_id: '', received_quantity: '', delivery_location: '', inspection_remarks: '', status: 'FULLY_RECEIVED' });

  const loadData = () => {
    setLoading(true);
    setFetchError(false);
    Promise.all([
      procurementService.getKpis(),
      procurementService.getMaterialRequests(),
      procurementService.getPrs(),
      procurementService.getApprovedPrs(),
      procurementService.getPos(),
      vendorService.getVendors(),
      procurementService.getDeliveries(),
      procurementService.getHistory(),
      projectService.getProjects()
    ])
      .then(([kpiRes, mprRes, prRes, appPrRes, poRes, vndRes, delRes, histRes, prjRes]) => {
        setKpis(kpiRes.data || {});
        setMprs(mprRes.data || []);
        setPrs(prRes.data || []);
        setApprovedPrs(appPrRes.data || []);
        setPos(poRes.data || []);
        setVendors(vndRes.data || []);
        setDeliveries(delRes.data || []);
        setHistory(histRes.data || []);
        setProjects(prjRes.data || []);

        if (prjRes.data && prjRes.data.length > 0) {
          setMprForm(f => ({ ...f, project_id: prjRes.data[0].id }));
          setPrForm(f => ({ ...f, project_id: prjRes.data[0].id }));
          setPoForm(f => ({ ...f, project_id: prjRes.data[0].id }));
        }
      })
      .catch((err) => {
        console.error("Error loading procurement portal data:", err);
        setFetchError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isCustomer) {
      loadData();
    }
  }, [activeRole]);

  // Section 6: Access Denied for Unauthorized Roles (e.g., Customer)
  if (isCustomer) {
    return (
      <div className="content-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="glass-card" style={{ width: '460px', padding: '2rem', textAlign: 'center', border: '1px solid rgba(244,63,94,0.3)', background: 'rgba(15,23,42,0.8)' }}>
          <ShieldAlert size={48} color="#f43f5e" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ color: '#f8fafc', margin: '0 0 0.5rem 0' }}>Access Denied</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>
            You do not have permission to access Procurement. Please contact your system administrator.
          </p>
          <div style={{ fontSize: '0.8rem', color: '#f43f5e', padding: '0.5rem', background: 'rgba(244,63,94,0.1)', borderRadius: '6px' }}>
            Active Role Persona: <strong>{activeRole.toUpperCase()}</strong>
          </div>
        </div>
      </div>
    );
  }

  // Section 7: Database / API Error State
  if (fetchError) {
    return (
      <div className="content-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="glass-card" style={{ width: '480px', padding: '2rem', textAlign: 'center', border: '1px solid rgba(245,158,11,0.3)' }}>
          <AlertCircle size={48} color="#f59e0b" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ color: '#f8fafc', margin: '0 0 0.5rem 0' }}>Unable to load procurement data.</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
            The backend server or database API could not be reached. Please check server connectivity and try again.
          </p>
          <button className="btn btn-primary" onClick={loadData} style={{ margin: '0 auto', gap: '0.5rem' }}>
            <RefreshCw size={16} /> Retry Data Load
          </button>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading) {
    return (
      <div className="content-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={36} color="#818cf8" className="spin" style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
          <div style={{ color: '#f8fafc', fontWeight: 600 }}>Loading Procurement Portal Data...</div>
        </div>
      </div>
    );
  }

  // Handlers
  const handleCreateMpr = (e) => {
    e.preventDefault();
    procurementService.createMaterialRequest({
      project_id: parseInt(mprForm.project_id),
      material_name: mprForm.material_name,
      material_category: mprForm.material_category,
      quantity: parseFloat(mprForm.quantity),
      unit: mprForm.unit,
      estimated_cost: parseFloat(mprForm.estimated_cost),
      reason: mprForm.reason,
      preferred_vendor_id: mprForm.preferred_vendor_id ? parseInt(mprForm.preferred_vendor_id) : null
    })
      .then(() => {
        setShowMprModal(false);
        setMprForm({ project_id: projects[0]?.id || '', material_name: '', material_category: 'General Construction', quantity: '', unit: 'unit', estimated_cost: '', reason: '', preferred_vendor_id: '' });
        loadData();
      })
      .catch(() => alert("Failed to submit Material Purchase Request"));
  };

  const handleOpenPrForMpr = (mpr) => {
    setPrForm({
      project_id: mpr.project_id,
      title: `${mpr.material_name} (${mpr.quantity} ${mpr.unit})`,
      item_name: mpr.material_name,
      quantity: mpr.quantity,
      unit: mpr.unit,
      estimated_cost: mpr.estimated_cost,
      reason: mpr.reason || `Source MPR #${mpr.request_number}`,
      source_material_request_id: mpr.id
    });
    setShowPrModal(true);
  };

  const handleCreatePr = (e) => {
    e.preventDefault();
    procurementService.createPr({
      project_id: parseInt(prForm.project_id),
      title: prForm.title,
      item_name: prForm.item_name || prForm.title,
      quantity: prForm.quantity ? parseFloat(prForm.quantity) : null,
      unit: prForm.unit,
      estimated_cost: parseFloat(prForm.estimated_cost),
      reason: prForm.reason,
      source_material_request_id: prForm.source_material_request_id ? parseInt(prForm.source_material_request_id) : null
    })
      .then(() => {
        setShowPrModal(false);
        setPrForm({ project_id: projects[0]?.id || '', title: '', item_name: '', quantity: '', unit: 'unit', estimated_cost: '', reason: '', source_material_request_id: '' });
        loadData();
      })
      .catch(() => alert("Failed to create Purchase Requisition"));
  };

  const handlePrSelect = (prId) => {
    if (!prId) {
      setPoForm(f => ({ ...f, pr_id: '', total_amount: '', item_name: '' }));
      return;
    }
    const selectedPr = approvedPrs.find(p => p.id === parseInt(prId)) || prs.find(p => p.id === parseInt(prId));
    if (selectedPr) {
      setPoForm(f => ({
        ...f,
        pr_id: selectedPr.id,
        project_id: selectedPr.project_id,
        title: selectedPr.title,
        item_name: selectedPr.item_name || selectedPr.title,
        quantity: selectedPr.quantity || '',
        total_amount: selectedPr.estimated_cost || ''
      }));
    }
  };

  const handleCreatePo = (e) => {
    e.preventDefault();
    if (!poForm.vendor_id) {
      alert("Please select a valid Vendor/Supplier.");
      return;
    }
    procurementService.createPo({
      pr_id: poForm.pr_id ? parseInt(poForm.pr_id) : null,
      project_id: parseInt(poForm.project_id),
      vendor_id: parseInt(poForm.vendor_id),
      item_name: poForm.item_name,
      quantity: poForm.quantity ? parseFloat(poForm.quantity) : null,
      unit_price: poForm.unit_price ? parseFloat(poForm.unit_price) : null,
      total_amount: parseFloat(poForm.total_amount),
      delivery_date: poForm.delivery_date || null
    })
      .then(() => {
        setShowPoModal(false);
        setPoForm({ pr_id: '', project_id: projects[0]?.id || '', vendor_id: '', item_name: '', quantity: '', unit_price: '', total_amount: '', delivery_date: '' });
        loadData();
      })
      .catch((err) => {
        const errorMsg = err.response?.data?.detail || "Failed to generate Purchase Order";
        alert(errorMsg);
      });
  };

  const handleCreateVendor = (e) => {
    e.preventDefault();
    vendorService.createVendor({
      name: vendorForm.name,
      contact_person: vendorForm.contact_person,
      phone: vendorForm.phone,
      email: vendorForm.email,
      gst_number: vendorForm.gst_number,
      pan_number: vendorForm.pan_number,
      status: vendorForm.status
    })
      .then(() => {
        setShowVendorModal(false);
        setVendorForm({ name: '', contact_person: '', phone: '', email: '', gst_number: '', pan_number: '', status: 'active' });
        loadData();
      })
      .catch(() => alert("Failed to add vendor"));
  };

  const handleOpenDeliveryForPo = (po) => {
    setDeliveryForm({
      po_id: po.id,
      received_quantity: po.quantity || '',
      delivery_location: 'Project Site Yard',
      inspection_remarks: 'Verified material count and quality',
      status: 'FULLY_RECEIVED'
    });
    setShowDeliveryModal(true);
  };

  const handleRecordDelivery = (e) => {
    e.preventDefault();
    procurementService.recordDelivery({
      po_id: parseInt(deliveryForm.po_id),
      received_quantity: parseFloat(deliveryForm.received_quantity),
      delivery_location: deliveryForm.delivery_location,
      inspection_remarks: deliveryForm.inspection_remarks,
      status: deliveryForm.status
    })
      .then(() => {
        setShowDeliveryModal(false);
        setDeliveryForm({ po_id: '', received_quantity: '', delivery_location: '', inspection_remarks: '', status: 'FULLY_RECEIVED' });
        loadData();
      })
      .catch(() => alert("Failed to record delivery"));
  };

  return (
    <div className="content-page">
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShoppingCart size={28} color="#818cf8" />
            <span>Procurement</span>
          </h1>
          <p className="page-subtitle">
            Procurement Dashboard & Supply Chain Process Management
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {(activeRole.includes('site') || activeRole === 'admin') && (
            <button className="btn btn-secondary" onClick={() => setShowMprModal(true)}>
              <Plus size={16} /> New Material Purchase Request
            </button>
          )}
          {(activeRole.includes('procurement') || activeRole === 'admin') && (
            <>
              <button className="btn btn-secondary" onClick={() => setShowPrModal(true)}>
                <Plus size={16} /> New PR Requisition
              </button>
              <button className="btn btn-primary" onClick={() => setShowPoModal(true)}>
                <Plus size={16} /> Generate PO
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        {[
          { key: 'dashboard', label: 'Procurement Dashboard', icon: LayoutDashboard },
          { key: 'mprs', label: `Purchase Requests (${mprs.length})`, icon: ShoppingCart },
          { key: 'prs', label: `Requisitions PR (${prs.length})`, icon: FileText },
          { key: 'vendors', label: `Vendors / Suppliers (${vendors.length})`, icon: Truck },
          { key: 'pos', label: `Purchase Orders PO (${pos.length})`, icon: Package },
          { key: 'deliveries', label: `Material Deliveries (${deliveries.length})`, icon: CheckSquare },
          { key: 'history', label: 'Procurement History', icon: History }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: '0.82rem',
                padding: '0.5rem 0.85rem',
                whiteSpace: 'nowrap',
                background: isActive ? 'linear-gradient(135deg, #818cf8, #6366f1)' : 'rgba(255,255,255,0.04)'
              }}
              onClick={() => handleTabNavigate(tab.key)}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD (SECTION 4 REQUIREMENTS) */}
      {activeTab === 'dashboard' && (
        <div>
          {/* Section 4 Summary KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
            <div className="glass-card" style={{ padding: '1.1rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Pending Purchase Requests</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', margin: '0.2rem 0' }}>{kpis.pending_purchase_requests || 0}</div>
              <div style={{ fontSize: '0.72rem', color: '#f59e0b' }}>Approved by PM awaiting PR</div>
            </div>

            <div className="glass-card" style={{ padding: '1.1rem', borderLeft: '4px solid #818cf8' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>PRs Created</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', margin: '0.2rem 0' }}>{kpis.prs_created || 0}</div>
              <div style={{ fontSize: '0.72rem', color: '#818cf8' }}>Internal Requisitions</div>
            </div>

            <div className="glass-card" style={{ padding: '1.1rem', borderLeft: '4px solid #38bdf8' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Pending Purchase Orders</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', margin: '0.2rem 0' }}>{kpis.pending_pos || 0}</div>
              <div style={{ fontSize: '0.72rem', color: '#38bdf8' }}>PR Approved awaiting PO</div>
            </div>

            <div className="glass-card" style={{ padding: '1.1rem', borderLeft: '4px solid #6366f1' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>POs Issued</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', margin: '0.2rem 0' }}>{kpis.pos_issued || 0}</div>
              <div style={{ fontSize: '0.72rem', color: '#6366f1' }}>Issued to Vendors</div>
            </div>

            <div className="glass-card" style={{ padding: '1.1rem', borderLeft: '4px solid #ec4899' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Pending Deliveries</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', margin: '0.2rem 0' }}>{kpis.pending_deliveries || 0}</div>
              <div style={{ fontSize: '0.72rem', color: '#ec4899' }}>Awaiting Site Receipt</div>
            </div>

            <div className="glass-card" style={{ padding: '1.1rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Completed Deliveries</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', margin: '0.2rem 0' }}>{kpis.completed_deliveries || 0}</div>
              <div style={{ fontSize: '0.72rem', color: '#10b981' }}>Fully Received & Closed</div>
            </div>
          </div>

          {/* Section 4 List 1: Recent Purchase Requests */}
          <div className="glass-card" style={{ marginBottom: '1.75rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Recent Purchase Requests</h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Ref #</th>
                    <th>Material / Item Description</th>
                    <th>Project</th>
                    <th>Quantity</th>
                    <th>Estimated Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mprs.length === 0 && prs.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                        No procurement records found.
                      </td>
                    </tr>
                  ) : (
                    mprs.slice(0, 5).map(mpr => {
                      const prj = projects.find(p => p.id === mpr.project_id);
                      return (
                        <tr key={mpr.id}>
                          <td style={{ fontWeight: 600, color: '#818cf8' }}>{mpr.request_number}</td>
                          <td>{mpr.material_name}</td>
                          <td>{prj ? prj.name : `Project #${mpr.project_id}`}</td>
                          <td>{mpr.quantity} {mpr.unit}</td>
                          <td style={{ fontWeight: 700, color: '#10b981' }}>${mpr.estimated_cost?.toLocaleString()}</td>
                          <td><span className="tag-badge tag-warning">{mpr.status}</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4 List 2: Recent Purchase Orders */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem' }}>Recent Purchase Orders</h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>PO Ref #</th>
                    <th>PR Reference</th>
                    <th>Project</th>
                    <th>Vendor / Supplier</th>
                    <th>Item Description</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                        No procurement records found.
                      </td>
                    </tr>
                  ) : (
                    pos.slice(0, 5).map(po => {
                      const prj = projects.find(p => p.id === po.project_id);
                      const vnd = vendors.find(v => v.id === po.vendor_id);
                      return (
                        <tr key={po.id}>
                          <td style={{ fontWeight: 600, color: '#38bdf8' }}>{po.po_number}</td>
                          <td>{po.pr_id ? `PR #${po.pr_id}` : 'Direct PO'}</td>
                          <td>{prj ? prj.name : `Project #${po.project_id}`}</td>
                          <td style={{ fontWeight: 600, color: '#f8fafc' }}>{vnd ? vnd.name : `Vendor #${po.vendor_id}`}</td>
                          <td>{po.item_name || 'Material Order'}</td>
                          <td style={{ fontWeight: 700, color: '#10b981' }}>${po.total_amount?.toLocaleString()}</td>
                          <td><span className="tag-badge tag-success">{po.status.toUpperCase()}</span></td>
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

      {/* TAB 2: MATERIAL PURCHASE REQUESTS */}
      {activeTab === 'mprs' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Material Purchase Requests (MPR)</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Site Material Requirements requiring external procurement (PM Approval ──► Procurement)
              </p>
            </div>
            {(activeRole === 'site_engineer' || activeRole === 'admin') && (
              <button className="btn btn-primary" onClick={() => setShowMprModal(true)}>
                <Plus size={16} /> Submit New MPR
              </button>
            )}
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Request Ref #</th>
                  <th>Material & Description</th>
                  <th>Project</th>
                  <th>Quantity</th>
                  <th>Estimated Cost</th>
                  <th>Stock Availability</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {mprs.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>No Material Purchase Requests found.</td></tr>
                ) : (
                  mprs.map((mpr) => {
                    const prj = projects.find(p => p.id === mpr.project_id);
                    return (
                      <tr key={mpr.id}>
                        <td style={{ fontWeight: 600, color: '#818cf8' }}>{mpr.request_number}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{mpr.material_name}</div>
                          {mpr.reason && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Reason: {mpr.reason}</div>}
                        </td>
                        <td>{prj ? prj.name : `Project #${mpr.project_id}`}</td>
                        <td>{mpr.quantity} {mpr.unit}</td>
                        <td style={{ fontWeight: 700, color: '#10b981' }}>${mpr.estimated_cost?.toLocaleString()}</td>
                        <td>
                          <span className="tag-badge tag-warning" style={{ fontSize: '0.7rem' }}>
                            {mpr.stock_availability}
                          </span>
                        </td>
                        <td>
                          <span className={`tag-badge ${
                            mpr.status === 'APPROVED_BY_PM' ? 'tag-success' : 
                            mpr.status === 'PR_CREATED' ? 'tag-info' : 
                            mpr.status === 'REJECTED' ? 'tag-danger' : 'tag-warning'
                          }`}>
                            {mpr.status}
                          </span>
                        </td>
                        <td>
                          {mpr.status === 'APPROVED_BY_PM' && (activeRole === 'procurement' || activeRole === 'admin') && (
                            <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => handleOpenPrForMpr(mpr)}>
                              Create PR
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

      {/* TAB 3: PURCHASE REQUISITIONS (PR) */}
      {activeTab === 'prs' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Purchase Requisitions (PR)</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Internal Purchase Requisitions created from approved purchase requests
              </p>
            </div>
            {(activeRole === 'procurement' || activeRole === 'admin') && (
              <button className="btn btn-primary" onClick={() => setShowPrModal(true)}>
                <Plus size={16} /> New PR Requisition
              </button>
            )}
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>PR Ref #</th>
                  <th>Requisition Title / Item</th>
                  <th>Project</th>
                  <th>Quantity</th>
                  <th>Estimated Cost</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {prs.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>No Purchase Requisitions (PR) found.</td></tr>
                ) : (
                  prs.map((pr) => {
                    const prj = projects.find(p => p.id === pr.project_id);
                    return (
                      <tr key={pr.id}>
                        <td style={{ fontWeight: 600, color: '#818cf8' }}>{pr.req_number}</td>
                        <td style={{ fontWeight: 500 }}>
                          {pr.title}
                          {pr.reason && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Reason: {pr.reason}</div>}
                        </td>
                        <td>{prj ? prj.name : `Project #${pr.project_id}`}</td>
                        <td>{pr.quantity ? `${pr.quantity} ${pr.unit || ''}` : 'N/A'}</td>
                        <td style={{ fontWeight: 700, color: '#10b981' }}>${pr.estimated_cost?.toLocaleString()}</td>
                        <td>
                          <span className={`tag-badge ${
                            pr.status === 'approved' ? 'tag-success' : 
                            pr.status === 'po_created' ? 'tag-info' : 
                            pr.status === 'rejected' ? 'tag-danger' : 'tag-warning'
                          }`}>
                            {pr.status === 'po_created' ? 'PO CREATED' : pr.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {pr.status === 'approved' && (activeRole === 'procurement' || activeRole === 'admin') && (
                            <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => { setPoForm(f => ({ ...f, pr_id: pr.id, project_id: pr.project_id, item_name: pr.title, total_amount: pr.estimated_cost })); setShowPoModal(true); }}>
                              Generate PO
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

      {/* TAB 4: VENDORS / SUPPLIERS */}
      {activeTab === 'vendors' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Approved Vendors & Suppliers</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Directory of registered vendors for issuing Purchase Orders
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowVendorModal(true)}>
              <Plus size={16} /> Add New Vendor
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Vendor Code</th>
                  <th>Vendor / Company Name</th>
                  <th>Contact Person</th>
                  <th>Phone & Email</th>
                  <th>GST / Tax Info</th>
                  <th>Rating</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>No Approved Vendors found.</td></tr>
                ) : (
                  vendors.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600, color: '#38bdf8' }}>{v.code}</td>
                      <td style={{ fontWeight: 600, color: '#f8fafc' }}>{v.name}</td>
                      <td>{v.contact_person || 'N/A'}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <div>{v.phone}</div>
                        <div style={{ color: '#94a3b8' }}>{v.email}</div>
                      </td>
                      <td>{v.gst_number || 'N/A'}</td>
                      <td><span style={{ color: '#f59e0b', fontWeight: 700 }}>★ {v.rating || '5.0'}</span></td>
                      <td>
                        <span className={`tag-badge ${v.status === 'active' ? 'tag-success' : 'tag-warning'}`}>
                          {v.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PURCHASE ORDERS (PO) */}
      {activeTab === 'pos' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Purchase Orders (PO) Issued</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Official purchase orders issued to external vendors and suppliers
              </p>
            </div>
            {(activeRole === 'procurement' || activeRole === 'admin') && (
              <button className="btn btn-primary" onClick={() => setShowPoModal(true)}>
                <Plus size={16} /> Generate Purchase Order (PO)
              </button>
            )}
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>PO Ref #</th>
                  <th>PR Link</th>
                  <th>Project</th>
                  <th>Vendor / Supplier</th>
                  <th>Item Description</th>
                  <th>Total PO Value</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pos.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>No Purchase Orders (PO) found.</td></tr>
                ) : (
                  pos.map((po) => {
                    const prj = projects.find(p => p.id === po.project_id);
                    const vnd = vendors.find(v => v.id === po.vendor_id);
                    return (
                      <tr key={po.id}>
                        <td style={{ fontWeight: 600, color: '#38bdf8' }}>{po.po_number}</td>
                        <td>
                          {po.pr_id ? (
                            <span style={{ color: '#818cf8', fontWeight: 600 }}>PR #{po.pr_id}</span>
                          ) : (
                            <span className="tag-badge tag-warning" style={{ fontSize: '0.7rem' }}>DIRECT PO / NO PR</span>
                          )}
                        </td>
                        <td>{prj ? prj.name : `Project #${po.project_id}`}</td>
                        <td style={{ fontWeight: 600, color: '#f8fafc' }}>{vnd ? vnd.name : `Vendor #${po.vendor_id}`}</td>
                        <td>{po.item_name || 'Material Order'}</td>
                        <td style={{ fontWeight: 700, color: '#10b981' }}>${po.total_amount?.toLocaleString()}</td>
                        <td><span className="tag-badge tag-success">{po.status.toUpperCase()}</span></td>
                        <td>
                          {po.status !== 'RECEIVED' && (
                            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => handleOpenDeliveryForPo(po)}>
                              Record Delivery
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

      {/* TAB 6: MATERIAL DELIVERIES */}
      {activeTab === 'deliveries' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Material Delivery Receipts</h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Goods receipt & site material delivery verification log against Purchase Orders
              </p>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Delivery Ref #</th>
                  <th>PO Link</th>
                  <th>Material Name</th>
                  <th>Ordered vs Received Qty</th>
                  <th>Delivery Date & Yard Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>No Material Deliveries recorded yet.</td></tr>
                ) : (
                  deliveries.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600, color: '#10b981' }}>{d.delivery_code}</td>
                      <td style={{ fontWeight: 600, color: '#38bdf8' }}>PO #{d.po_id}</td>
                      <td style={{ fontWeight: 600, color: '#f8fafc' }}>{d.material_name}</td>
                      <td>
                        <strong style={{ color: '#10b981' }}>{d.received_quantity}</strong> / {d.ordered_quantity} units
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <div>{new Date(d.delivery_date).toLocaleDateString()}</div>
                        <div style={{ color: '#94a3b8' }}>{d.delivery_location}</div>
                      </td>
                      <td>
                        <span className={`tag-badge ${d.status === 'FULLY_RECEIVED' ? 'tag-success' : 'tag-warning'}`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: PROCUREMENT HISTORY */}
      {activeTab === 'history' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem' }}>Procurement Audit Trail & Event History</h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User & Persona Role</th>
                  <th>Action Event</th>
                  <th>Transaction Entity</th>
                  <th>Event Details / Payload</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>No procurement audit history recorded yet.</td></tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.id}>
                      <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{new Date(h.created_at).toLocaleString()}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{h.user_name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#818cf8', textTransform: 'capitalize' }}>{h.user_role}</div>
                      </td>
                      <td><span className="tag-badge tag-info">{h.action}</span></td>
                      <td style={{ fontWeight: 600, color: '#38bdf8' }}>{h.entity_type} #{h.entity_id}</td>
                      <td style={{ fontSize: '0.85rem' }}>{h.payload}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Create Material Purchase Request (MPR) */}
      {showMprModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '540px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem', color: '#f8fafc' }}>Submit Material Purchase Request (MPR)</h3>
            <form onSubmit={handleCreateMpr}>
              <div className="form-group">
                <label>Select Project</label>
                <select required className="form-control" value={mprForm.project_id} onChange={e => setMprForm({ ...mprForm, project_id: e.target.value })}>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Material Name</label>
                <input required type="text" className="form-control" placeholder="Structural Steel Rebar 16mm" value={mprForm.material_name} onChange={e => setMprForm({ ...mprForm, material_name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Quantity</label>
                  <input required type="number" step="0.01" className="form-control" placeholder="50" value={mprForm.quantity} onChange={e => setMprForm({ ...mprForm, quantity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <input required type="text" className="form-control" placeholder="Tons / Bags / m3" value={mprForm.unit} onChange={e => setMprForm({ ...mprForm, unit: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Estimated Total Cost ($)</label>
                <input required type="number" step="0.01" className="form-control" placeholder="45000" value={mprForm.estimated_cost} onChange={e => setMprForm({ ...mprForm, estimated_cost: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Reason / Site Requirement Notes</label>
                <textarea className="form-control" rows="2" placeholder="Required for 3rd floor slab & column reinforcement..." value={mprForm.reason} onChange={e => setMprForm({ ...mprForm, reason: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMprModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit to PM for Approval</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create PR */}
      {showPrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '520px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem', color: '#f8fafc' }}>Create Purchase Requisition (PR)</h3>
            <form onSubmit={handleCreatePr}>
              <div className="form-group">
                <label>Select Project</label>
                <select required className="form-control" value={prForm.project_id} onChange={e => setPrForm({ ...prForm, project_id: e.target.value })}>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Requisition Title</label>
                <input required type="text" className="form-control" placeholder="Ready Mix Concrete M30 Supply" value={prForm.title} onChange={e => setPrForm({ ...prForm, title: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Quantity</label>
                  <input type="number" step="0.01" className="form-control" placeholder="2000" value={prForm.quantity} onChange={e => setPrForm({ ...prForm, quantity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <input type="text" className="form-control" placeholder="cu.m / bags" value={prForm.unit} onChange={e => setPrForm({ ...prForm, unit: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Estimated Cost ($)</label>
                <input required type="number" step="0.01" className="form-control" placeholder="350000" value={prForm.estimated_cost} onChange={e => setPrForm({ ...prForm, estimated_cost: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Reason / Procurement Notes</label>
                <textarea className="form-control" rows="2" placeholder="Procurement requisition for site material..." value={prForm.reason} onChange={e => setPrForm({ ...prForm, reason: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPrModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Approved PR</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Create PO */}
      {showPoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '560px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem', color: '#f8fafc' }}>Generate Official Purchase Order (PO)</h3>
            
            <form onSubmit={handleCreatePo}>
              <div className="form-group">
                <label>Select Approved PR <span style={{ color: '#10b981', fontWeight: 600 }}>(Mandatory Standard Flow)</span></label>
                <select className="form-control" value={poForm.pr_id} onChange={e => handlePrSelect(e.target.value)}>
                  <option value="">-- DIRECT PO / NO PR (Restricted Admin Override) --</option>
                  {approvedPrs.map(pr => {
                    const prj = projects.find(p => p.id === pr.project_id);
                    return (
                      <option key={pr.id} value={pr.id}>
                        ✅ {pr.req_number}: {pr.title} (${pr.estimated_cost?.toLocaleString()}) [{prj?.name}]
                      </option>
                    );
                  })}
                </select>
              </div>

              {!poForm.pr_id && (
                <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', borderRadius: '6px', fontSize: '0.8rem', color: '#f59e0b', marginBottom: '1rem' }}>
                  ⚠️ <strong>Notice:</strong> Creating a Purchase Order without an approved PR is marked as <strong>DIRECT PO / NO PR</strong> and bypasses standard procurement requisitions.
                </div>
              )}

              <div className="form-group">
                <label>Select Project</label>
                <select required className="form-control" value={poForm.project_id} onChange={e => setPoForm({ ...poForm, project_id: e.target.value })}>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Select Vendor / Supplier</label>
                <select required className="form-control" value={poForm.vendor_id} onChange={e => setPoForm({ ...poForm, vendor_id: e.target.value })}>
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.code || `ID #${v.id}`})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Material / Item Description</label>
                <input type="text" className="form-control" placeholder="Ready Mix Concrete M30 - 2000 cu.m" value={poForm.item_name} onChange={e => setPoForm({ ...poForm, item_name: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Total PO Amount ($)</label>
                <input required type="number" step="0.01" className="form-control" placeholder="350000" value={poForm.total_amount} onChange={e => setPoForm({ ...poForm, total_amount: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPoModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Issue Official PO</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Add Vendor */}
      {showVendorModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '500px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem', color: '#f8fafc' }}>Register New Vendor / Supplier</h3>
            <form onSubmit={handleCreateVendor}>
              <div className="form-group">
                <label>Vendor / Company Name</label>
                <input required type="text" className="form-control" placeholder="Apex Concrete Solutions Pvt Ltd" value={vendorForm.name} onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Contact Person</label>
                  <input type="text" className="form-control" placeholder="John Smith" value={vendorForm.contact_person} onChange={e => setVendorForm({ ...vendorForm, contact_person: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="text" className="form-control" placeholder="+1 555 0192" value={vendorForm.phone} onChange={e => setVendorForm({ ...vendorForm, phone: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input required type="email" className="form-control" placeholder="orders@apexconcrete.com" value={vendorForm.email} onChange={e => setVendorForm({ ...vendorForm, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>GST / Tax Registration Number</label>
                <input type="text" className="form-control" placeholder="27AAACA123411Z5" value={vendorForm.gst_number} onChange={e => setVendorForm({ ...vendorForm, gst_number: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowVendorModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Vendor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Record Material Delivery */}
      {showDeliveryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '500px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem', color: '#f8fafc' }}>Record Site Material Delivery</h3>
            <form onSubmit={handleRecordDelivery}>
              <div className="form-group">
                <label>Select Purchase Order (PO)</label>
                <select required className="form-control" value={deliveryForm.po_id} onChange={e => setDeliveryForm({ ...deliveryForm, po_id: e.target.value })}>
                  {pos.map(p => (
                    <option key={p.id} value={p.id}>{p.po_number}: {p.item_name || 'Material Order'} (${p.total_amount})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Received Quantity</label>
                <input required type="number" step="0.01" className="form-control" placeholder="2000" value={deliveryForm.received_quantity} onChange={e => setDeliveryForm({ ...deliveryForm, received_quantity: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Delivery Yard / Location</label>
                <input required type="text" className="form-control" placeholder="Tower B Main Material Storage Yard" value={deliveryForm.delivery_location} onChange={e => setDeliveryForm({ ...deliveryForm, delivery_location: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Inspection & Verification Remarks</label>
                <textarea className="form-control" rows="2" placeholder="Quality inspection passed, weighbridge slip verified..." value={deliveryForm.inspection_remarks} onChange={e => setDeliveryForm({ ...deliveryForm, inspection_remarks: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeliveryModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Receipt & Update PO</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
