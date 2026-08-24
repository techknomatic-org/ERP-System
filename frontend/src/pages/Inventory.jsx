import React, { useEffect, useState } from 'react';
import { Package, Plus, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import { inventoryService } from '../services/api';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'Electronics',
    price: '',
    cost: '',
    stock: '',
    min_stock_alert: 10
  });

  const loadProducts = () => {
    setLoading(true);
    inventoryService.getProducts()
      .then((res) => setProducts(res.data))
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
        setFormData({ sku: '', name: '', category: 'Electronics', price: '', cost: '', stock: '', min_stock_alert: 10 });
        loadProducts();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to create product"));
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="content-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Inventory & Stock Management</h1>
          <p className="page-subtitle">Track warehouse products, stock alerts, and unit pricing in MySQL</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add New Product
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div className="search-box" style={{ width: '100%' }}>
          <Search size={18} color="#64748b" />
          <input
            type="text"
            placeholder="Filter products by SKU, title, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Product Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Cost</th>
              <th>Stock Level</th>
              <th>Stock Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '2.5rem' }}>
                  {loading ? "Loading stock inventory..." : "No products found."}
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, color: '#818cf8' }}>{p.sku}</td>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td><span className="tag-badge tag-info">{p.category}</span></td>
                  <td style={{ fontWeight: 600 }}>${p.price.toFixed(2)}</td>
                  <td style={{ color: '#94a3b8' }}>${p.cost.toFixed(2)}</td>
                  <td style={{ fontWeight: 700 }}>{p.stock} units</td>
                  <td>
                    {p.stock <= p.min_stock_alert ? (
                      <span className="tag-badge tag-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <AlertTriangle size={12} /> Low Stock Alert
                      </span>
                    ) : (
                      <span className="tag-badge tag-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CheckCircle size={12} /> In Stock
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Product Creation Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Create Product Item</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>SKU Code</label>
                <input required type="text" className="form-control" placeholder="PROD-100" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Product Name</label>
                <input required type="text" className="form-control" placeholder="4K Monitor 27-inch" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select className="form-control" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                  <option value="Electronics">Electronics</option>
                  <option value="Hardware">Hardware</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Software">Software</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Selling Price ($)</label>
                  <input required type="number" step="0.01" className="form-control" placeholder="299.99" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Initial Stock</label>
                  <input required type="number" className="form-control" placeholder="25" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
