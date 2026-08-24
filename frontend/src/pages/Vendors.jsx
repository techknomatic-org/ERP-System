import React, { useEffect, useState } from 'react';
import { Users, Plus, Star, ShieldCheck, Mail, Phone } from 'lucide-react';
import { vendorService } from '../services/api';

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    contact_person: '',
    email: '',
    phone: '',
    gst_number: '',
    pan_number: '',
    rating: '5.0'
  });

  const loadVendors = () => {
    setLoading(true);
    vendorService.getVendors()
      .then((res) => setVendors(res.data))
      .catch((err) => console.error("Error loading vendors:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const handleCreateVendor = (e) => {
    e.preventDefault();
    vendorService.createVendor({
      ...formData,
      rating: parseFloat(formData.rating || 5.0)
    })
      .then(() => {
        setShowModal(false);
        setFormData({ name: '', code: '', contact_person: '', email: '', phone: '', gst_number: '', pan_number: '', rating: '5.0' });
        loadVendors();
      })
      .catch((err) => alert("Failed to register vendor"));
  };

  return (
    <div className="content-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Vendor Directory & Compliance</h1>
          <p className="page-subtitle">Manage construction contractors, GST/PAN compliance, ratings, and active status</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Register Vendor
        </button>
      </div>

      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Vendor Code</th>
              <th>Company Name</th>
              <th>Contact Person</th>
              <th>GST / PAN Compliance</th>
              <th>Rating</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {vendors.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '2.5rem' }}>
                  {loading ? "Loading vendors..." : "No vendors registered."}
                </td>
              </tr>
            ) : (
              vendors.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600, color: '#818cf8' }}>{v.code}</td>
                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>{v.name}</td>
                  <td>{v.contact_person || 'N/A'}</td>
                  <td>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      GST: <strong style={{ color: '#38bdf8' }}>{v.gst_number || 'Pending'}</strong> | PAN: {v.pan_number || 'Pending'}
                    </div>
                  </td>
                  <td>
                    <span className="tag-badge tag-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Star size={12} fill="currentColor" /> {v.rating} / 5.0
                    </span>
                  </td>
                  <td>
                    <span className="tag-badge tag-success">{v.status.toUpperCase()}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Vendor Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Register Vendor / Contractor</h3>
            <form onSubmit={handleCreateVendor}>
              <div className="form-group">
                <label>Company Name</label>
                <input required type="text" className="form-control" placeholder="Apex Concrete Corp" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Vendor Code</label>
                <input required type="text" className="form-control" placeholder="VND-APX" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Contact Person</label>
                  <input type="text" className="form-control" placeholder="Robert Vance" value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input required type="email" className="form-control" placeholder="contact@company.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>GST Number</label>
                  <input type="text" className="form-control" placeholder="GST-908123" value={formData.gst_number} onChange={e => setFormData({ ...formData, gst_number: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>PAN Number</label>
                  <input type="text" className="form-control" placeholder="PAN-88102" value={formData.pan_number} onChange={e => setFormData({ ...formData, pan_number: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Vendor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
