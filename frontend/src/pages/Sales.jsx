import React, { useEffect, useState } from 'react';
import { ShoppingBag, Plus, Calendar, DollarSign, UserCheck } from 'lucide-react';
import { salesService, customerService, inventoryService } from '../services/api';

export default function Sales() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      salesService.getOrders(),
      customerService.getCustomers(),
      inventoryService.getProducts()
    ])
      .then(([ordersRes, custRes, prodRes]) => {
        setOrders(ordersRes.data);
        setCustomers(custRes.data);
        setProducts(prodRes.data);
      })
      .catch((err) => console.error("Error loading sales:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOrder = (e) => {
    e.preventDefault();
    const prod = products.find(p => p.id === parseInt(selectedProduct));
    if (!prod) return alert("Please select a valid product");

    salesService.createOrder({
      customer_id: parseInt(selectedCustomer),
      status: "completed",
      items: [
        {
          product_id: prod.id,
          quantity: parseInt(quantity),
          unit_price: prod.price
        }
      ]
    })
      .then(() => {
        setShowModal(false);
        setSelectedCustomer('');
        setSelectedProduct('');
        setQuantity(1);
        loadData();
      })
      .catch((err) => alert(err.response?.data?.detail || "Order creation failed"));
  };

  return (
    <div className="content-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Sales Orders & Revenue</h1>
          <p className="page-subtitle">Track customer orders, transactions, and sales invoices</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> New Sales Order
        </button>
      </div>

      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Order Ref</th>
              <th>Customer ID</th>
              <th>Order Date</th>
              <th>Total Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: '2.5rem' }}>
                  {loading ? "Loading sales orders..." : "No sales orders found."}
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 600, color: '#818cf8' }}>{o.order_number}</td>
                  <td>Customer #{o.customer_id}</td>
                  <td>{new Date(o.order_date).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 700, color: '#10b981' }}>${o.total_amount.toFixed(2)}</td>
                  <td>
                    <span className={`tag-badge ${o.status === 'completed' ? 'tag-success' : 'tag-warning'}`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '460px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Create Sales Order</h3>
            <form onSubmit={handleCreateOrder}>
              <div className="form-group">
                <label>Select Customer</label>
                <select required className="form-control" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Select Product</label>
                <select required className="form-control" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                  <option value="">-- Choose Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - ${p.price.toFixed(2)} ({p.stock} in stock)</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Quantity</label>
                <input required type="number" min="1" className="form-control" value={quantity} onChange={e => setQuantity(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Process Order</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
