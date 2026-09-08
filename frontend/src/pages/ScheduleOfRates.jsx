import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, Plus, Search, Filter, Edit3, Power, CheckCircle, 
  AlertCircle, X, RefreshCw, FileText, Layers, Upload, Download, Globe, Settings, ArrowRight, FileSpreadsheet
} from 'lucide-react';
import { sorService } from '../services/api';
import EmptyState from '../components/EmptyState';

const CATEGORY_OPTIONS = [
  'Earthwork',
  'Concrete',
  'Structural',
  'Masonry',
  'Finishing',
  'Electrical',
  'Plumbing',
  'General',
  'Other'
];

const UNIT_OPTIONS = [
  'm³',
  'm²',
  'rmt',
  'each',
  'nos',
  'kg',
  'quintal',
  'tonnes',
  'lumpsum',
  'hours',
  'bags',
  'Other'
];

export default function ScheduleOfRates() {
  const [sorItems, setSorItems] = useState([]);
  const [editions, setEditions] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [editionFilter, setEditionFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [unitFilter, setUnitFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Add/Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    sor_edition_id: '',
    sor_region_id: '',
    sor_code: '',
    description: '',
    category: 'Earthwork',
    unit: 'm³',
    base_rate: '',
    cost_index: '1.0000',
    effective_from: new Date().toISOString().split('T')[0],
    status: 'Active'
  });
  const [formErrors, setFormErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Bulk Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [committingImport, setCommittingImport] = useState(false);
  const [importErrorMsg, setImportErrorMsg] = useState('');

  // Manage Editions & Regions Modal State
  const [showManageModal, setShowManageModal] = useState(false);
  const [newEditionName, setNewEditionName] = useState('');
  const [newEditionDesc, setNewEditionDesc] = useState('');
  const [newRegionName, setNewRegionName] = useState('');
  const [newRegionCode, setNewRegionCode] = useState('');
  const [updateCostIndexEdId, setUpdateCostIndexEdId] = useState('');
  const [newCostIndexVal, setNewCostIndexVal] = useState('1.10');
  const [manageSubmitting, setManageSubmitting] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState(null);

  const showToastNotification = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [sorRes, edRes, regRes] = await Promise.all([
        sorService.getSorItems(),
        sorService.getEditions(),
        sorService.getRegions()
      ]);
      setSorItems(sorRes.data || []);
      setEditions(edRes.data || []);
      setRegions(regRes.data || []);
    } catch (err) {
      console.error("Error loading Schedule of Rates master data:", err);
      showToastNotification("Failed to load SOR database.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Filtering Logic
  const filteredItems = useMemo(() => {
    return sorItems.filter(item => {
      const matchesSearch = 
        !searchQuery.trim() ||
        (item.sor_code && item.sor_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.sor_edition_name && item.sor_edition_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.sor_region_name && item.sor_region_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesEdition = editionFilter === 'All' || item.sor_edition_id?.toString() === editionFilter || item.sor_edition_name === editionFilter;
      const matchesRegion = regionFilter === 'All' || item.sor_region_id?.toString() === regionFilter || item.sor_region_name === regionFilter;
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      const matchesUnit = unitFilter === 'All' || item.unit === unitFilter;
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;

      return matchesSearch && matchesEdition && matchesRegion && matchesCategory && matchesUnit && matchesStatus;
    });
  }, [sorItems, searchQuery, editionFilter, regionFilter, categoryFilter, unitFilter, statusFilter]);

  // Modal Open Handlers
  const handleOpenAddModal = () => {
    setEditingItem(null);
    const defEdition = editions.length > 0 ? editions[0].id.toString() : '';
    const defRegion = regions.length > 0 ? regions[0].id.toString() : '';
    setFormData({
      sor_edition_id: defEdition,
      sor_region_id: defRegion,
      sor_code: '',
      description: '',
      category: 'Earthwork',
      unit: 'm³',
      base_rate: '',
      cost_index: '1.0000',
      effective_from: new Date().toISOString().split('T')[0],
      status: 'Active'
    });
    setFormErrors({});
    setServerError('');
    setShowModal(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    let formattedDate = '';
    if (item.effective_from) {
      formattedDate = new Date(item.effective_from).toISOString().split('T')[0];
    }
    setFormData({
      sor_edition_id: item.sor_edition_id ? item.sor_edition_id.toString() : '',
      sor_region_id: item.sor_region_id ? item.sor_region_id.toString() : '',
      sor_code: item.sor_code,
      description: item.description,
      category: item.category,
      unit: item.unit,
      base_rate: (item.base_rate !== undefined && item.base_rate !== null) ? item.base_rate.toString() : item.rate.toString(),
      cost_index: (item.cost_index !== undefined && item.cost_index !== null) ? item.cost_index.toString() : '1.0000',
      effective_from: formattedDate,
      status: item.status
    });
    setFormErrors({});
    setServerError('');
    setShowModal(true);
  };

  // Validation
  const validateForm = () => {
    const errors = {};

    if (!formData.sor_edition_id) {
      errors.sor_edition_id = 'SOR Edition is required.';
    }

    if (!formData.sor_region_id) {
      errors.sor_region_id = 'Region is required.';
    }

    if (!formData.sor_code || !formData.sor_code.trim()) {
      errors.sor_code = 'Item Code is required.';
    }

    if (!formData.description || !formData.description.trim()) {
      errors.description = 'Description is required.';
    }

    if (!formData.category || !formData.category.trim()) {
      errors.category = 'Category is required.';
    }

    if (!formData.unit || !formData.unit.trim()) {
      errors.unit = 'Unit is required.';
    }

    const numericRate = parseFloat(formData.base_rate);
    if (!formData.base_rate || isNaN(numericRate)) {
      errors.base_rate = 'Base Rate is required and must be numeric.';
    } else if (numericRate <= 0) {
      errors.base_rate = 'Base Rate must be greater than 0.';
    }

    if (!formData.effective_from) {
      errors.effective_from = 'Effective Date is required.';
    }

    // Edition-scoped Uniqueness Check
    if (formData.sor_edition_id && formData.sor_code.trim()) {
      const exists = sorItems.some(i => 
        i.sor_edition_id?.toString() === formData.sor_edition_id.toString() &&
        i.sor_code.toLowerCase() === formData.sor_code.trim().toLowerCase() &&
        (!editingItem || i.id !== editingItem.id)
      );
      if (exists) {
        errors.sor_code = `Item Code already exists in selected SOR Edition.`;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    const selectedEd = editions.find(e => e.id.toString() === formData.sor_edition_id);
    const selectedReg = regions.find(r => r.id.toString() === formData.sor_region_id);

    const payload = {
      sor_edition_id: parseInt(formData.sor_edition_id, 10),
      sor_region_id: parseInt(formData.sor_region_id, 10),
      sor_edition_name: selectedEd ? selectedEd.name : '',
      sor_region_name: selectedReg ? selectedReg.name : '',
      sor_code: formData.sor_code.trim(),
      description: formData.description.trim(),
      category: formData.category,
      unit: formData.unit,
      base_rate: parseFloat(formData.base_rate),
      cost_index: parseFloat(formData.cost_index || 1.0),
      rate: parseFloat(formData.base_rate) * parseFloat(formData.cost_index || 1.0),
      effective_from: new Date(formData.effective_from).toISOString(),
      status: formData.status
    };

    try {
      if (editingItem) {
        await sorService.updateSorItem(editingItem.id, payload);
        showToastNotification("SOR item updated successfully.", "success");
      } else {
        await sorService.createSorItem(payload);
        showToastNotification("SOR item added successfully.", "success");
      }
      setShowModal(false);
      fetchInitialData();
    } catch (err) {
      console.error("Error saving SOR item:", err);
      const detailMsg = err.response?.data?.detail || "Failed to save SOR item. Please verify inputs.";
      setServerError(detailMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Status Toggle Handler
  const handleToggleStatus = async (item) => {
    const newStatus = item.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await sorService.toggleSorStatus(item.id, newStatus);
      showToastNotification("SOR item status updated.", "success");
      fetchInitialData();
    } catch (err) {
      console.error("Error toggling status:", err);
      showToastNotification("Failed to update SOR item status.", "error");
    }
  };

  // File Import Handlers
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImportFile(file);
      setImportPreview(null);
      setImportErrorMsg('');
      handlePreviewFile(file);
    }
  };

  const handlePreviewFile = async (file) => {
    setLoadingPreview(true);
    setImportErrorMsg('');
    const form = new FormData();
    form.append('file', file);

    try {
      const res = await sorService.importPreview(form);
      setImportPreview(res.data);
    } catch (err) {
      console.error("Error previewing import file:", err);
      const msg = err.response?.data?.detail || "Failed to process import file format.";
      setImportErrorMsg(msg);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCommitImport = async () => {
    if (!importPreview || !importPreview.valid_items || importPreview.valid_items.length === 0) {
      return;
    }
    setCommittingImport(true);
    try {
      const res = await sorService.importCommit(importPreview.valid_items);
      showToastNotification(res.data?.message || "Import completed successfully!", "success");
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview(null);
      fetchInitialData();
    } catch (err) {
      console.error("Error committing import:", err);
      const msg = err.response?.data?.detail || "Bulk import commit failed.";
      setImportErrorMsg(msg);
    } finally {
      setCommittingImport(false);
    }
  };

  // Manage Editions / Regions Handlers
  const handleCreateEdition = async (e) => {
    e.preventDefault();
    if (!newEditionName.trim()) return;
    setManageSubmitting(true);
    try {
      await sorService.createEdition({ name: newEditionName.trim(), description: newEditionDesc.trim() });
      showToastNotification(`Edition '${newEditionName}' created.`, "success");
      setNewEditionName('');
      setNewEditionDesc('');
      fetchInitialData();
    } catch (err) {
      showToastNotification(err.response?.data?.detail || "Failed to create edition.", "error");
    } finally {
      setManageSubmitting(false);
    }
  };

  const handleCreateRegion = async (e) => {
    e.preventDefault();
    if (!newRegionName.trim()) return;
    setManageSubmitting(true);
    try {
      await sorService.createRegion({ name: newRegionName.trim(), code: newRegionCode.trim() });
      showToastNotification(`Region '${newRegionName}' created.`, "success");
      setNewRegionName('');
      setNewRegionCode('');
      fetchInitialData();
    } catch (err) {
      showToastNotification(err.response?.data?.detail || "Failed to create region.", "error");
    } finally {
      setManageSubmitting(false);
    }
  };

  const handleUpdateCostIndex = async (e) => {
    e.preventDefault();
    if (!updateCostIndexEdId) return;
    setManageSubmitting(true);
    try {
      await sorService.updateEditionCostIndex(parseInt(updateCostIndexEdId, 10), parseFloat(newCostIndexVal));
      showToastNotification("Cost Index updated successfully across edition items.", "success");
      fetchInitialData();
    } catch (err) {
      showToastNotification(err.response?.data?.detail || "Failed to update Cost Index.", "error");
    } finally {
      setManageSubmitting(false);
    }
  };

  // Formatting Helpers
  const formatCurrency = (val) => {
    const num = parseFloat(val || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="content-page" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
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
            background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            color: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
            fontWeight: 600,
            fontSize: '0.88rem'
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ padding: '0.45rem', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '8px', color: '#818cf8' }}>
              <Calculator size={24} />
            </div>
            <h1 className="page-title" style={{ margin: 0 }}>Schedule of Rates (SOR / DSR)</h1>
          </div>
          <p className="page-subtitle" style={{ marginTop: '0.35rem' }}>
            PSC-04 Master Rate Database scoped by SOR Edition & Region with Cost Index adjustments.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowManageModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
          >
            <Settings size={16} />
            <span>Editions & Regions</span>
          </button>
          
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              setImportFile(null);
              setImportPreview(null);
              setImportErrorMsg('');
              setShowImportModal(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
          >
            <Upload size={16} />
            <span>Import SOR</span>
          </button>

          <button 
            className="btn btn-primary" 
            onClick={handleOpenAddModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
          >
            <Plus size={18} />
            <span>Add SOR Item</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.2rem 1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', alignItems: 'center' }}>
          
          {/* Search Box */}
          <div style={{ position: 'relative', gridColumn: 'span 1' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text"
              className="form-control"
              placeholder="Search code, item, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.4rem' }}
            />
          </div>

          {/* Edition Filter */}
          <div>
            <select 
              className="form-control"
              value={editionFilter}
              onChange={(e) => setEditionFilter(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="All">All SOR Editions</option>
              {editions.map(ed => (
                <option key={ed.id} value={ed.id.toString()}>{ed.name}</option>
              ))}
            </select>
          </div>

          {/* Region Filter */}
          <div>
            <select 
              className="form-control"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="All">All Regions</option>
              {regions.map(r => (
                <option key={r.id} value={r.id.toString()}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select 
              className="form-control"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="All">All Categories</option>
              {CATEGORY_OPTIONS.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Unit Filter */}
          <div>
            <select 
              className="form-control"
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="All">All Units</option>
              {UNIT_OPTIONS.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select 
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="All">All Status (Active + Inactive)</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Table Presentation */}
      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#94a3b8' }}>
          <RefreshCw size={28} className="spin-icon" style={{ marginBottom: '0.75rem', color: '#6366f1' }} />
          <p style={{ fontSize: '0.92rem' }}>Loading SOR Rate Database...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="glass-card" style={{ padding: '2rem 1rem' }}>
          <EmptyState 
            icon={Calculator}
            title={sorItems.length === 0 ? "No Schedule of Rates available" : "No matching SOR items found"}
            description={
              sorItems.length === 0 
                ? "Add your first SOR item or import standard DSR dataset."
                : "Try adjusting your search query, edition, or region filters."
            }
            actionLabel={sorItems.length === 0 ? "+ Add SOR Item" : undefined}
            onAction={sorItems.length === 0 ? handleOpenAddModal : undefined}
          />
        </div>
      ) : (
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Edition</th>
                <th style={{ width: '100px' }}>Region</th>
                <th style={{ width: '110px' }}>Item Code</th>
                <th>Description</th>
                <th style={{ width: '110px' }}>Category</th>
                <th style={{ width: '80px' }}>Unit</th>
                <th style={{ width: '110px', textAlign: 'right' }}>Base Rate</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Index</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Adjusted Rate</th>
                <th style={{ width: '110px' }}>Effective Date</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isActive = item.status === 'Active';
                const baseRateVal = item.base_rate !== undefined ? item.base_rate : item.rate;
                const costIndexVal = item.cost_index !== undefined ? item.cost_index : 1.0;
                const adjustedRateVal = item.adjusted_rate !== undefined ? item.adjusted_rate : (baseRateVal * costIndexVal);

                return (
                  <tr key={item.id} style={{ opacity: isActive ? 1 : 0.65 }}>
                    <td style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>
                      <span style={{ padding: '0.15rem 0.45rem', background: 'rgba(99, 102, 241, 0.12)', color: '#a5b4fc', borderRadius: '4px' }}>
                        {item.sor_edition_name || 'DSR 2023'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {item.sor_region_name || 'Maharashtra'}
                    </td>
                    <td style={{ fontWeight: 700, color: '#818cf8', fontFamily: 'monospace', fontSize: '0.88rem' }}>
                      {item.sor_code}
                    </td>
                    <td style={{ fontWeight: 500, color: '#f8fafc', maxWidth: '280px', wordBreak: 'break-word' }}>
                      {item.description}
                    </td>
                    <td>
                      <span 
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.12)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.2)'
                        }}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{item.unit}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#94a3b8', fontSize: '0.88rem', fontFamily: 'monospace' }}>
                      {formatCurrency(baseRateVal)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '0.82rem', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 600 }}>
                      {parseFloat(costIndexVal).toFixed(4)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981', fontSize: '0.92rem', fontFamily: 'monospace' }}>
                      {formatCurrency(adjustedRateVal)}
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                      {formatDate(item.effective_from)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`tag-badge ${isActive ? 'tag-success' : 'tag-danger'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEditModal(item)}
                          title="Edit SOR Item"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                        <button 
                          className={`btn btn-sm ${isActive ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => handleToggleStatus(item)}
                          title={isActive ? "Deactivate Item" : "Activate Item"}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          <Power size={12} /> {isActive ? 'Off' : 'On'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PERFECTLY CENTERED ADD / EDIT SOR MODAL */}
      {showModal && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.85)', 
            backdropFilter: 'blur(8px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div 
            className="glass-card" 
            style={{ 
              width: '100%', 
              maxWidth: '620px', 
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              margin: 'auto'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calculator size={20} color="#818cf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
                  {editingItem ? 'Edit SOR Item' : 'Add SOR Item'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {serverError && (
                <div 
                  style={{ 
                    marginBottom: '1rem', 
                    padding: '0.75rem 1rem', 
                    borderRadius: '6px', 
                    background: 'rgba(239, 68, 68, 0.15)', 
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{serverError}</span>
                </div>
              )}

              <form id="sor-form" onSubmit={handleSubmit}>
                
                {/* SECTION 1: CONFIGURATION */}
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  1. SOR Configuration & Scope
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  
                  {/* SOR Edition */}
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                      SOR Edition <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select 
                      className="form-control"
                      value={formData.sor_edition_id}
                      onChange={(e) => {
                        setFormData({ ...formData, sor_edition_id: e.target.value });
                        if (formErrors.sor_edition_id) setFormErrors({ ...formErrors, sor_edition_id: null });
                      }}
                      style={{ borderColor: formErrors.sor_edition_id ? '#ef4444' : undefined }}
                    >
                      <option value="">Select Edition</option>
                      {editions.map(ed => (
                        <option key={ed.id} value={ed.id.toString()}>{ed.name}</option>
                      ))}
                    </select>
                    {formErrors.sor_edition_id && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem' }}>{formErrors.sor_edition_id}</div>}
                  </div>

                  {/* Region */}
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Region <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select 
                      className="form-control"
                      value={formData.sor_region_id}
                      onChange={(e) => {
                        setFormData({ ...formData, sor_region_id: e.target.value });
                        if (formErrors.sor_region_id) setFormErrors({ ...formErrors, sor_region_id: null });
                      }}
                      style={{ borderColor: formErrors.sor_region_id ? '#ef4444' : undefined }}
                    >
                      <option value="">Select Region</option>
                      {regions.map(r => (
                        <option key={r.id} value={r.id.toString()}>{r.name}</option>
                      ))}
                    </select>
                    {formErrors.sor_region_id && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem' }}>{formErrors.sor_region_id}</div>}
                  </div>

                </div>

                {/* SECTION 2: ITEM DETAILS */}
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  2. Item Details & Classification
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  {/* Item Code */}
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Item Code <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. SOR-001"
                      value={formData.sor_code}
                      onChange={(e) => {
                        setFormData({ ...formData, sor_code: e.target.value });
                        if (formErrors.sor_code) setFormErrors({ ...formErrors, sor_code: null });
                      }}
                      style={{ borderColor: formErrors.sor_code ? '#ef4444' : undefined }}
                    />
                    {formErrors.sor_code && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem' }}>{formErrors.sor_code}</div>}
                  </div>

                  {/* Category */}
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Category <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select 
                      className="form-control"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {CATEGORY_OPTIONS.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Item Description <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea 
                    rows={2}
                    className="form-control"
                    placeholder="Detailed standard specification description..."
                    value={formData.description}
                    onChange={(e) => {
                      setFormData({ ...formData, description: e.target.value });
                      if (formErrors.description) setFormErrors({ ...formErrors, description: null });
                    }}
                    style={{ borderColor: formErrors.description ? '#ef4444' : undefined, resize: 'vertical' }}
                  />
                  {formErrors.description && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem' }}>{formErrors.description}</div>}
                </div>

                {/* Unit */}
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Unit of Measurement <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select 
                    className="form-control"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  >
                    {UNIT_OPTIONS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                {/* SECTION 3: RATE & COST INDEX */}
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  3. Rate & Cost Index Calculation
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  {/* Base Rate */}
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Base Rate (₹) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-control"
                      placeholder="e.g. 1000.00"
                      value={formData.base_rate}
                      onChange={(e) => {
                        setFormData({ ...formData, base_rate: e.target.value });
                        if (formErrors.base_rate) setFormErrors({ ...formErrors, base_rate: null });
                      }}
                      style={{ borderColor: formErrors.base_rate ? '#ef4444' : undefined }}
                    />
                    {formErrors.base_rate && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem' }}>{formErrors.base_rate}</div>}
                  </div>

                  {/* Cost Index */}
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Cost Index
                    </label>
                    <input 
                      type="number"
                      step="0.0001"
                      className="form-control"
                      value={formData.cost_index}
                      onChange={(e) => setFormData({ ...formData, cost_index: e.target.value })}
                    />
                  </div>

                  {/* Calculated Adjusted Rate Preview */}
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Adjusted Rate (₹)
                    </label>
                    <div 
                      style={{
                        padding: '0.55rem 0.75rem',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '6px',
                        color: '#10b981',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        fontSize: '0.95rem'
                      }}
                    >
                      {formatCurrency(
                        (parseFloat(formData.base_rate || 0) * parseFloat(formData.cost_index || 1.0)).toFixed(2)
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  {/* Effective Date */}
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Effective Date <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input 
                      type="date"
                      className="form-control"
                      value={formData.effective_from}
                      onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                    />
                  </div>

                  {/* Status */}
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Status
                    </label>
                    <select 
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

              </form>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#1e293b' }}>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="sor-form"
                className="btn btn-primary"
                disabled={submitting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={14} className="spin-icon" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{editingItem ? 'Update SOR Item' : 'Save SOR Item'}</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* BULK IMPORT MODAL */}
      {showImportModal && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.85)', 
            backdropFilter: 'blur(8px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div 
            className="glass-card" 
            style={{ 
              width: '100%', 
              maxWidth: '750px', 
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              margin: 'auto'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={20} color="#818cf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
                  Bulk Import Schedule of Rates (CSV / Excel)
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowImportModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              
              {/* File Upload Box */}
              <div 
                style={{
                  border: '2px dashed rgba(99, 102, 241, 0.35)',
                  borderRadius: '10px',
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  background: 'rgba(99, 102, 241, 0.05)',
                  marginBottom: '1.25rem'
                }}
              >
                <FileSpreadsheet size={36} color="#818cf8" style={{ marginBottom: '0.5rem' }} />
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '1rem' }}>Select CSV or Excel (.xlsx) file to upload</h4>
                <p style={{ margin: '0 0 1rem 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                  File must contain headers: SOR Edition, Region, Item Code, Description, Category, Unit, Base Rate, Cost Index, Effective Date
                </p>

                <input 
                  type="file" 
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="sor-file-input"
                />
                <label 
                  htmlFor="sor-file-input" 
                  className="btn btn-primary"
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Upload size={16} /> Choose File
                </label>
                {importFile && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>
                    Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              {loadingPreview && (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#818cf8' }}>
                  <RefreshCw size={24} className="spin-icon" style={{ marginBottom: '0.5rem' }} />
                  <div>Validating every row transactionally...</div>
                </div>
              )}

              {importErrorMsg && (
                <div 
                  style={{ 
                    padding: '0.85rem 1rem', 
                    borderRadius: '8px', 
                    background: 'rgba(239, 68, 68, 0.15)', 
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '0.88rem',
                    marginBottom: '1rem'
                  }}
                >
                  <AlertCircle size={16} style={{ display: 'inline', marginRight: '0.4rem' }} />
                  {importErrorMsg}
                </div>
              )}

              {/* Preview Report Card */}
              {importPreview && (
                <div>
                  {/* Summary Counters */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Total Rows</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>{importPreview.total_rows}</div>
                    </div>
                    <div style={{ padding: '0.85rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase' }}>Valid Rows</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>{importPreview.valid_rows_count}</div>
                    </div>
                    <div style={{ padding: '0.85rem', background: importPreview.invalid_rows_count > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)', borderRadius: '8px', textAlign: 'center', border: importPreview.invalid_rows_count > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent' }}>
                      <div style={{ fontSize: '0.75rem', color: importPreview.invalid_rows_count > 0 ? '#f87171' : '#94a3b8', textTransform: 'uppercase' }}>Invalid Rows</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: importPreview.invalid_rows_count > 0 ? '#ef4444' : '#f8fafc' }}>{importPreview.invalid_rows_count}</div>
                    </div>
                  </div>

                  {/* Validation Error Table */}
                  {importPreview.errors && importPreview.errors.length > 0 ? (
                    <div>
                      <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <AlertCircle size={16} /> Transactional Validation Errors (Commit Blocked)
                      </div>
                      <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px' }}>
                        <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '60px' }}>Row</th>
                              <th style={{ width: '110px' }}>Field</th>
                              <th>Error Details</th>
                              <th style={{ width: '130px' }}>Conflicting Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importPreview.errors.map((err, i) => (
                              <tr key={i} style={{ background: 'rgba(239, 68, 68, 0.08)' }}>
                                <td style={{ fontWeight: 700, color: '#ef4444' }}>Row {err.row_number}</td>
                                <td style={{ color: '#f8fafc', fontWeight: 600 }}>{err.field}</td>
                                <td style={{ color: '#f87171' }}>{err.error}</td>
                                <td style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{err.existing_value || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', color: '#34d399', fontSize: '0.88rem', fontWeight: 600 }}>
                      <CheckCircle size={16} style={{ display: 'inline', marginRight: '0.4rem' }} />
                      All {importPreview.valid_rows_count} rows passed validation cleanly! Ready to commit.
                    </div>
                  )}

                  {/* Valid Rows Preview Table */}
                  {importPreview.valid_items && importPreview.valid_items.length > 0 && (
                    <div style={{ marginTop: '1.25rem' }}>
                      <div style={{ fontWeight: 600, color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        Valid Records Preview ({importPreview.valid_items.length} items)
                      </div>
                      <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                        <table className="custom-table" style={{ fontSize: '0.78rem' }}>
                          <thead>
                            <tr>
                              <th>Edition</th>
                              <th>Item Code</th>
                              <th>Description</th>
                              <th>Unit</th>
                              <th style={{ textAlign: 'right' }}>Base Rate</th>
                              <th style={{ textAlign: 'center' }}>Index</th>
                              <th style={{ textAlign: 'right' }}>Adjusted Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importPreview.valid_items.slice(0, 10).map((v, i) => (
                              <tr key={i}>
                                <td>{v.sor_edition_name}</td>
                                <td style={{ fontWeight: 700, color: '#818cf8', fontFamily: 'monospace' }}>{v.sor_code}</td>
                                <td>{v.description}</td>
                                <td>{v.unit}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(v.base_rate)}</td>
                                <td style={{ textAlign: 'center', fontFamily: 'monospace', color: '#fbbf24' }}>{v.cost_index}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#10b981', fontWeight: 700 }}>{formatCurrency(v.adjusted_rate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#1e293b' }}>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowImportModal(false)}
                disabled={committingImport}
              >
                Cancel
              </button>

              <button 
                type="button"
                className="btn btn-primary"
                onClick={handleCommitImport}
                disabled={!importPreview || importPreview.invalid_rows_count > 0 || importPreview.valid_rows_count === 0 || committingImport}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {committingImport ? (
                  <>
                    <RefreshCw size={14} className="spin-icon" />
                    <span>Committing...</span>
                  </>
                ) : (
                  <span>Confirm & Commit Import ({importPreview?.valid_rows_count || 0} Items)</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MANAGE EDITIONS & REGIONS MODAL */}
      {showManageModal && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.85)', 
            backdropFilter: 'blur(8px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div 
            className="glass-card" 
            style={{ 
              width: '100%', 
              maxWidth: '600px', 
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: '12px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              margin: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={20} color="#818cf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
                  Manage SOR Editions & Regions
                </h3>
              </div>
              <button type="button" onClick={() => setShowManageModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              
              {/* Add New Edition */}
              <div style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', color: '#818cf8', fontSize: '0.92rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Create SOR Edition</h4>
                <form onSubmit={handleCreateEdition} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. CPWD SOR 2024" 
                    value={newEditionName}
                    onChange={(e) => setNewEditionName(e.target.value)}
                    style={{ flex: 1, minWidth: '180px' }}
                  />
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Description (optional)" 
                    value={newEditionDesc}
                    onChange={(e) => setNewEditionDesc(e.target.value)}
                    style={{ flex: 1, minWidth: '180px' }}
                  />
                  <button className="btn btn-primary" type="submit" disabled={manageSubmitting}>
                    + Add Edition
                  </button>
                </form>
              </div>

              {/* Add New Region */}
              <div style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', color: '#818cf8', fontSize: '0.92rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Create Region</h4>
                <form onSubmit={handleCreateRegion} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Gujarat" 
                    value={newRegionName}
                    onChange={(e) => setNewRegionName(e.target.value)}
                    style={{ flex: 1, minWidth: '180px' }}
                  />
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Code (e.g. GJ)" 
                    value={newRegionCode}
                    onChange={(e) => setNewRegionCode(e.target.value)}
                    style={{ width: '100px' }}
                  />
                  <button className="btn btn-primary" type="submit" disabled={manageSubmitting}>
                    + Add Region
                  </button>
                </form>
              </div>

              {/* Update Cost Index for Edition */}
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', color: '#818cf8', fontSize: '0.92rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Update Edition Cost Index</h4>
                <form onSubmit={handleUpdateCostIndex} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <select 
                    className="form-control" 
                    value={updateCostIndexEdId} 
                    onChange={(e) => setUpdateCostIndexEdId(e.target.value)}
                    style={{ flex: 1, minWidth: '180px' }}
                  >
                    <option value="">Select Edition</option>
                    {editions.map(ed => (
                      <option key={ed.id} value={ed.id.toString()}>{ed.name}</option>
                    ))}
                  </select>
                  <input 
                    type="number" 
                    step="0.0001"
                    className="form-control" 
                    placeholder="New Index (e.g. 1.10)" 
                    value={newCostIndexVal}
                    onChange={(e) => setNewCostIndexVal(e.target.value)}
                    style={{ width: '120px' }}
                  />
                  <button className="btn btn-primary" type="submit" disabled={manageSubmitting || !updateCostIndexEdId}>
                    Apply Cost Index
                  </button>
                </form>
              </div>

            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', background: '#1e293b' }}>
              <button className="btn btn-secondary" onClick={() => setShowManageModal(false)}>Close</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
