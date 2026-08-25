import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, Filter, History, Eye, X, AlertTriangle, ShoppingCart } from 'lucide-react';
import { inventoryService, procurementService } from '../services/api';
import StockBar from '../components/StockBar';

export default function Inventory() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedProductHistory, setSelectedProductHistory] = useState(null);

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'Concrete & Masonry',
    price: '',
    cost: '',
    stock: '',
    min_stock_alert: 10
  });

  const loadProducts = () => {
    setLoading(true);
    inventoryService.getProducts()
      .then((res) => setProducts(res.data || []))
      .catch((err) => console.error("Error loading products:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    inventoryService.createProduct({
      ...formData,
      price: parseFloat(formData.price),
      cost: parseFloat(formData.cost || 0),
      stock: parseInt(formData.stock),
      min_stock_alert: parseInt(formData.min_stock_alert)
    })
      .then(() => {
        setShowModal(false);
        setFormData({ sku: '', name: '', category: 'Concrete & Masonry', price: '', cost: '', stock: '', min_stock_alert: 10 });
        loadProducts();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to create product"));
  };

  const handleTriggerReorderMpr = (productId, name) => {
    procurementService.createLowStockMpr(productId)
      .then((res) => {
        alert(res.data.message || `Reorder MPR triggered for ${name}!`);
        navigate('/procurement/material-purchase-requests');
      })
      .catch(() => alert("Failed to trigger reorder MPR."));
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || p.category === categoryFilter;

    let isLow = p.stock <= p.min_stock_alert;
    let isOut = p.stock === 0;
    let matchesStatus = true;
    if (statusFilter === 'LOW') matchesStatus = isLow && !isOut;
    if (statusFilter === 'OUT') matchesStatus = isOut;
    if (statusFilter === 'NORMAL') matchesStatus = !isLow && !isOut;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleOpenHistory = (prod) => {
    setSelectedProductHistory(prod);
    setShowHistoryModal(true);
  };

  return (
    <div className="content-page">
      <div className="section-header">
        <div>
          <h1 className="page-title"><Package size={26} color="var(--primary)" /> Material Inventory & Warehouse Stock</h1>
          <p className="page-subtitle">Visual stock gauge indicators, low-stock reorder triggers, and warehouse history</p>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/procurement/low-stock')}>
            <AlertTriangle size={16} /> Procurement Reorder Hub
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Register Material Item
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filter-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.82rem' }}>
          <Filter size={16} /> Filters:
        </div>

        <div className="search-box" style={{ width: '280px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search material SKU, name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select className="form-select" style={{ minWidth: '180px' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          <option value="Concrete & Masonry">Concrete & Masonry</option>
          <option value="Steel & Metals">Steel & Metals</option>
          <option value="Electrical & Fittings">Electrical & Fittings</option>
          <option value="Plumbing & Sanitation">Plumbing & Sanitation</option>
          <option value="Safety & Equipment">Safety & Equipment</option>
          <option value="Hardware & Tools">Hardware & Tools</option>
        </select>

        <select className="form-select" style={{ minWidth: '160px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Stock Levels</option>
          <option value="NORMAL">In Stock</option>
          <option value="LOW">Low Stock Alert</option>
          <option value="OUT">Out of Stock</option>
        </select>
      </div>

      {/* Inventory Stock Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>SKU / Material Code</th>
              <th>Material Name</th>
              <th>Category</th>
              <th>Unit Rate (₹)</th>
              <th>Stock Level & Gauge</th>
              <th>Min Alert Limit</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                  {loading ? "Loading warehouse inventory..." : "No matching material items found."}
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const isLow = p.stock <= p.min_stock_alert;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.sku}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                    <td><span className="tag-badge tag-info">{p.category}</span></td>
                    <td style={{ fontWeight: 700 }}>₹{p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td style={{ width: '240px' }}>
                      <StockBar current={p.stock} minimum={p.min_stock_alert} label={`${p.stock} Units Available`} />
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.min_stock_alert} units</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        {isLow && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleTriggerReorderMpr(p.id, p.name)}>
                            <ShoppingCart size={13} /> Reorder MPR
                          </button>
                        )}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenHistory(p)}>
                          <History size={13} /> Stock Log
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

      {/* Product Creation Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#111a33' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Register Construction Material</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>SKU / Material Code</label>
                <input required type="text" className="form-control" placeholder="MAT-CON-101" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Material Name</label>
                <input required type="text" className="form-control" placeholder="Ready Mix Concrete M30 Grade" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select className="form-select" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                  <option value="Concrete & Masonry">Concrete & Masonry</option>
                  <option value="Steel & Metals">Steel & Metals</option>
                  <option value="Electrical & Fittings">Electrical & Fittings</option>
                  <option value="Plumbing & Sanitation">Plumbing & Sanitation</option>
                  <option value="Safety & Equipment">Safety & Equipment</option>
                  <option value="Hardware & Tools">Hardware & Tools</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Unit Rate (₹)</label>
                  <input required type="number" step="0.01" className="form-control" placeholder="150.00" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Initial Stock Qty</label>
                  <input required type="number" className="form-control" placeholder="800" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Min Reorder Alert Limit</label>
                <input required type="number" className="form-control" placeholder="10" value={formData.min_stock_alert} onChange={e => setFormData({ ...formData, min_stock_alert: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Material Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
