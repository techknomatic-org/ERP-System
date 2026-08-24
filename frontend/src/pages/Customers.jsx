import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Mail, Phone, Building, Search, Eye, Edit3, Filter, ChevronRight, UserCheck } from 'lucide-react';
import { customerService } from '../services/api';

export default function Customers() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    company: '',
    customer_type: 'Individual',
    status: 'active',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    notes: ''
  });

  const loadCustomers = () => {
    setLoading(true);
    const params = {};
    if (typeFilter !== 'ALL') params.customer_type = typeFilter;
    if (statusFilter !== 'ALL') params.status = statusFilter;

    customerService.getCustomers(params)
      .then((res) => setCustomers(res.data))
      .catch((err) => console.error("Error loading customers:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCustomers();
  }, [typeFilter, statusFilter]);

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      company: '',
      customer_type: 'Individual',
      status: 'active',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      notes: ''
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (c, e) => {
    e.stopPropagation();
    setEditingCustomer(c);
    setFormData({
      name: c.name || '',
      contact_person: c.contact_person || '',
      email: c.email || '',
      phone: c.phone || '',
      company: c.company || '',
      customer_type: c.customer_type || 'Individual',
      status: c.status || 'active',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      postal_code: c.postal_code || '',
      notes: c.notes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      alert("Please fill in required fields (Customer Name and Email).");
      return;
    }

    if (editingCustomer) {
      customerService.updateCustomer(editingCustomer.id, formData)
        .then(() => {
          setShowModal(false);
          loadCustomers();
        })
        .catch((err) => alert(err.response?.data?.detail || "Failed to update customer"));
    } else {
      customerService.createCustomer(formData)
        .then(() => {
          setShowModal(false);
          loadCustomers();
        })
        .catch((err) => alert(err.response?.data?.detail || "Failed to create customer"));
    }
  };

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    return (
      (c.customer_code && c.customer_code.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="content-page">
      {/* Top Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Customer Master Directory</h1>
          <p className="page-subtitle">Converted Client Accounts, Contact Details, and CRM Source Lead History</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAddModal}>
          <Plus size={18} /> Register New Customer
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Customers</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>{customers.length}</div>
        </div>

        <div className="glass-card" style={{ padding: '1rem', borderTop: '3px solid #10b981' }}>
          <div style={{ fontSize: '0.8rem', color: '#10b981' }}>Active Accounts</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>
            {customers.filter(c => c.status === 'active').length}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1rem', borderTop: '3px solid #818cf8' }}>
          <div style={{ fontSize: '0.8rem', color: '#818cf8' }}>Corporate Accounts</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#818cf8', marginTop: '0.2rem' }}>
            {customers.filter(c => c.customer_type === 'Corporate').length}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1rem', borderTop: '3px solid #06b6d4' }}>
          <div style={{ fontSize: '0.8rem', color: '#06b6d4' }}>Converted from CRM</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#06b6d4', marginTop: '0.2rem' }}>
            {customers.filter(c => !!c.source_lead_id).length}
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2.4rem' }}
              placeholder="Search by Customer ID, Name, Company, Phone, or Email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <select className="form-control" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="ALL">All Customer Types</option>
              <option value="Individual">Individual</option>
              <option value="Corporate">Corporate</option>
            </select>
          </div>

          <div>
            <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customer Master Table */}
      <div className="glass-card">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Customer ID & Name</th>
                <th>Company</th>
                <th>Contact Person</th>
                <th>Phone & Email</th>
                <th>Type</th>
                <th>Status</th>
                <th>Source Lead</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                    {loading ? "Loading Customer directory from database..." : "No customer accounts found matching filter criteria."}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/customers/${c.id}`)}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{c.name}</div>
                      <span className="tag-badge tag-info" style={{ fontSize: '0.7rem' }}>{c.customer_code}</span>
                    </td>
                    <td>{c.company || 'N/A'}</td>
                    <td style={{ color: '#cbd5e1' }}>{c.contact_person || c.name}</td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Phone size={12} color="#06b6d4" /> {c.phone || 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Mail size={12} color="#818cf8" /> {c.email}
                      </div>
                    </td>
                    <td><span className="tag-badge tag-secondary">{c.customer_type || 'Individual'}</span></td>
                    <td>
                      <span className={`tag-badge ${c.status === 'active' ? 'tag-success' : 'tag-danger'}`}>
                        {(c.status || 'active').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {c.source_lead_id ? (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: '#38bdf8' }}
                          onClick={(e) => { e.stopPropagation(); navigate(`/crm/leads/${c.source_lead_id}`); }}
                        >
                          Lead #{c.source_lead_id} ({c.source_lead_name || 'View'})
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Direct Registration</span>
                      )}
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => navigate(`/customers/${c.id}`)}>
                          <Eye size={14} /> View
                        </button>
                        <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={(e) => handleOpenEditModal(c, e)}>
                          <Edit3 size={14} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '540px', background: '#1e293b', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>
              {editingCustomer ? `Edit Customer Record ${editingCustomer.customer_code}` : "Register New Customer Account"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Customer / Account Name <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input required type="text" className="form-control" placeholder="ABC Corporation" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Contact Person</label>
                  <input type="text" className="form-control" placeholder="John Doe" value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Email Address <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input required type="email" className="form-control" placeholder="contact@company.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="text" className="form-control" placeholder="+1 555-0199" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Company Name</label>
                  <input type="text" className="form-control" placeholder="ABC Corp Ltd" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Customer Type</label>
                  <select className="form-control" value={formData.customer_type} onChange={e => setFormData({ ...formData, customer_type: e.target.value })}>
                    <option value="Individual">Individual</option>
                    <option value="Corporate">Corporate</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-control" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Address</label>
                <input type="text" className="form-control" placeholder="100 Financial District Plaza" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>City</label>
                  <input type="text" className="form-control" placeholder="Metropolis" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input type="text" className="form-control" placeholder="State Capital" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Postal Code</label>
                  <input type="text" className="form-control" placeholder="10001" value={formData.postal_code} onChange={e => setFormData({ ...formData, postal_code: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea className="form-control" rows="2" placeholder="Converted from qualified lead..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
