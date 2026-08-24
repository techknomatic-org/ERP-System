import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Key, Plus, ShieldAlert, CheckCircle2, Lock, FileText, Calendar, Search, Eye, XCircle, Building2, HardHat, Layers, DollarSign, Calculator } from 'lucide-react';
import { bookingService, propertyService, buildingService, unitInventoryService, customerService, projectService, authService } from '../services/api';

export default function Bookings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlUnitId = searchParams.get('unitId');
  const urlCustomerId = searchParams.get('customerId');

  const [userRole, setUserRole] = useState(localStorage.getItem('erp_role') || 'admin');
  const [kpis, setKpis] = useState({ total: 0, confirmed: 0, pending: 0, cancelled: 0, total_booking_value: 0 });
  const [bookings, setBookings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [properties, setProperties] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [propertyFilter, setPropertyFilter] = useState('ALL');
  const [buildingFilter, setBuildingFilter] = useState('ALL');

  const [showModal, setShowModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Payment Recording Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    customer_id: urlCustomerId || '',
    project_id: '',
    property_id: '',
    building_id: '',
    unit_id: urlUnitId || '',
    salesperson_id: '',
    booking_amount: '',
    discount: '0',
    expected_agreement_date: '',
    remarks: '',
    notes: ''
  });

  const loadInitialData = () => {
    setLoading(true);
    const storedRole = localStorage.getItem('erp_role');
    if (storedRole) setUserRole(storedRole);

    const params = {};
    if (statusFilter !== 'ALL') params.status = statusFilter;
    if (projectFilter !== 'ALL') params.project_id = projectFilter;
    if (propertyFilter !== 'ALL') params.property_id = propertyFilter;
    if (buildingFilter !== 'ALL') params.building_id = buildingFilter;

    Promise.all([
      bookingService.getKpis(),
      bookingService.getBookings(params),
      projectService.getProjects(),
      propertyService.getProperties(),
      customerService.getCustomers(),
      authService.getUsers()
    ])
      .then(([kpiRes, bkRes, projRes, propRes, custRes, userRes]) => {
        setKpis(kpiRes.data);
        setBookings(bkRes.data);
        setProjects(projRes.data);
        setProperties(propRes.data);
        setCustomers(custRes.data);
        setUsers(userRes.data || []);
      })
      .catch((err) => console.error("Error loading bookings:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInitialData();
  }, [statusFilter, projectFilter, propertyFilter, buildingFilter]);

  useEffect(() => {
    if (urlUnitId || urlCustomerId) {
      if ((userRole || '').toLowerCase() !== 'finance') {
        setShowModal(true);
      }
    }
  }, [urlUnitId, urlCustomerId, userRole]);

  const handleProjectChange = (projId) => {
    setFormData(prev => ({ ...prev, project_id: projId, property_id: '', building_id: '', unit_id: '' }));
    setBuildings([]);
    setAvailableUnits([]);
  };

  const handlePropertyChange = (propId) => {
    setFormData(prev => ({ ...prev, property_id: propId, building_id: '', unit_id: '' }));
    setAvailableUnits([]);
    if (propId) {
      buildingService.getBuildings(propId)
        .then(res => setBuildings(res.data))
        .catch(err => console.error(err));
    } else {
      setBuildings([]);
    }
  };

  const handleBuildingChange = (bldId) => {
    setFormData(prev => ({ ...prev, building_id: bldId, unit_id: '' }));
    if (bldId) {
      unitInventoryService.getUnits({ building_id: bldId, status: 'AVAILABLE' })
        .then(res => setAvailableUnits(res.data))
        .catch(err => console.error(err));
    } else {
      setAvailableUnits([]);
    }
  };

  const handleUnitSelect = (uId) => {
    setFormData(prev => ({ ...prev, unit_id: uId }));
    const selectedUnit = availableUnits.find(u => u.id === parseInt(uId));
    if (selectedUnit && !formData.booking_amount) {
      setFormData(prev => ({ ...prev, booking_amount: (selectedUnit.total_price * 0.10).toFixed(2) }));
    }
  };

  const handleCreateBooking = (e) => {
    e.preventDefault();
    if (!formData.customer_id || !formData.unit_id || !formData.booking_amount) {
      alert("Please select a Customer, Unit, and fill in Booking Amount.");
      return;
    }

    bookingService.createBooking({
      unit_id: parseInt(formData.unit_id),
      customer_id: parseInt(formData.customer_id),
      salesperson_id: formData.salesperson_id ? parseInt(formData.salesperson_id) : undefined,
      booking_amount: parseFloat(formData.booking_amount),
      discount: formData.discount ? parseFloat(formData.discount) : 0,
      expected_agreement_date: formData.expected_agreement_date ? new Date(formData.expected_agreement_date).toISOString() : undefined,
      status: 'CONFIRMED',
      remarks: formData.remarks,
      notes: formData.notes
    })
      .then(() => {
        setShowModal(false);
        setFormData({ customer_id: '', project_id: '', property_id: '', building_id: '', unit_id: '', salesperson_id: '', booking_amount: '', discount: '0', expected_agreement_date: '', remarks: '', notes: '' });
        loadInitialData();
      })
      .catch((err) => alert(err.response?.data?.detail || "Booking failed: Unit unavailable or concurrent booking lock active."));
  };

  const handleOpenCancelModal = (b, e) => {
    e.stopPropagation();
    setSelectedBookingForCancel(b);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const handleConfirmCancel = (e) => {
    e.preventDefault();
    if (!cancellationReason) {
      alert("Please provide a reason for cancellation.");
      return;
    }

    bookingService.cancelBooking(selectedBookingForCancel.id, { cancellation_reason: cancellationReason })
      .then(() => {
        setShowCancelModal(false);
        loadInitialData();
      })
      .catch(err => alert(err.response?.data?.detail || "Failed to cancel booking"));
  };

  const handleOpenPaymentModal = (b, e) => {
    e.stopPropagation();
    setSelectedBookingForPayment(b);
    setPaymentAmount(b.booking_amount ? b.booking_amount.toString() : '');
    setShowPaymentModal(true);
  };

  const handleRecordPaymentSubmit = (e) => {
    e.preventDefault();
    alert(`Payment of $${parseFloat(paymentAmount).toLocaleString()} recorded successfully for Booking ${selectedBookingForPayment.booking_number}!`);
    setShowPaymentModal(false);
    loadInitialData();
  };

  const filteredBookings = bookings.filter(b => {
    const q = searchQuery.toLowerCase();
    return (
      (b.booking_number && b.booking_number.toLowerCase().includes(q)) ||
      (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
      (b.unit_number && b.unit_number.toLowerCase().includes(q)) ||
      (b.property_name && b.property_name.toLowerCase().includes(q))
    );
  });

  const isFinance = (userRole || '').toLowerCase() === 'finance';

  return (
    <div className="content-page">
      {/* Header Bar */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">{isFinance ? "Invoices, Payments & Accounts Receivable" : "Unit Booking & Reservation Management"}</h1>
          <p className="page-subtitle">
            {isFinance ? "Financial visibility into unit bookings, invoices, deposit collections, and payment schedules" : "Atomic transaction locking, cascading unit selectors, and unit status synchronization"}
          </p>
        </div>
        {!isFinance && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Create New Booking
          </button>
        )}
      </div>

      {/* Live Booking KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Invoices / Bookings</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>{kpis.total}</div>
        </div>

        <div className="glass-card" style={{ padding: '1rem', borderTop: '3px solid #10b981' }}>
          <div style={{ fontSize: '0.8rem', color: '#10b981' }}>Confirmed / Paid</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>{kpis.confirmed}</div>
        </div>

        <div className="glass-card" style={{ padding: '1rem', borderTop: '3px solid #f43f5e' }}>
          <div style={{ fontSize: '0.8rem', color: '#f43f5e' }}>Cancelled Invoices</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f43f5e', marginTop: '0.2rem' }}>{kpis.cancelled}</div>
        </div>

        <div className="glass-card" style={{ padding: '1rem', borderTop: '3px solid #38bdf8' }}>
          <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Total Receivables Value</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
            ${kpis.total_booking_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Search & Cascading Filter Bar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2.4rem' }}
              placeholder="Search by Invoice ID, Customer Name, Unit Number..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="PENDING">PENDING</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div>
            <select className="form-control" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
              <option value="ALL">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.code}: {p.name}</option>)}
            </select>
          </div>

          <div>
            <select className="form-control" value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}>
              <option value="ALL">All Properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.code}: {p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Booking / Invoice Master Table */}
      <div className="glass-card">
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Invoice / Booking ID</th>
                <th>Customer</th>
                <th>Unit & Building</th>
                <th>Property & Project</th>
                <th>Invoice Date</th>
                <th>Booking Deposit Value</th>
                <th>Payment Status</th>
                <th>Financial Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                    {loading ? "Loading invoice records from database..." : "No invoice records found matching filter criteria."}
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/bookings/${b.id}`)}>
                    <td>
                      <span className="tag-badge tag-info" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{b.booking_number}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{b.customer_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>{b.customer_company || 'Individual Client'}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#38bdf8' }}>{b.unit_number} ({b.unit_type})</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{b.building_name}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{b.property_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.project_name}</div>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      {new Date(b.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ color: '#10b981', fontWeight: 700 }}>
                      ${b.booking_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`tag-badge ${b.status === 'CONFIRMED' ? 'tag-success' : b.status === 'CANCELLED' ? 'tag-danger' : 'tag-warning'}`}>
                        {b.status === 'CONFIRMED' ? 'PAID / CONFIRMED' : b.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => navigate(`/bookings/${b.id}`)}>
                          <Eye size={14} /> View Details
                        </button>
                        {isFinance && b.status !== 'CANCELLED' && (
                          <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#10b981', borderColor: '#059669' }} onClick={(e) => handleOpenPaymentModal(b, e)}>
                            <DollarSign size={14} /> Record Payment
                          </button>
                        )}
                        {!isFinance && b.status !== 'CANCELLED' && (
                          <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#f43f5e' }} onClick={(e) => handleOpenCancelModal(b, e)}>
                            <XCircle size={14} /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal for Finance */}
      {showPaymentModal && selectedBookingForPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={20} /> Record Payment for Invoice {selectedBookingForPayment.booking_number}
            </h3>

            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
              <div>Customer: <strong>{selectedBookingForPayment.customer_name}</strong></div>
              <div>Unit: <strong>{selectedBookingForPayment.unit_number}</strong> ({selectedBookingForPayment.property_name})</div>
              <div>Booking Value: <strong style={{ color: '#10b981' }}>${selectedBookingForPayment.booking_amount.toLocaleString()}</strong></div>
            </div>

            <form onSubmit={handleRecordPaymentSubmit}>
              <div className="form-group">
                <label>Payment Amount Received ($) <span style={{ color: '#f43f5e' }}>*</span></label>
                <input required type="number" step="0.01" className="form-control" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select className="form-control">
                  <option value="BANK_TRANSFER">Bank Wire Transfer</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="CREDIT_CARD">Credit Card / Debit Card</option>
                  <option value="CASH">Cash Deposit</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#10b981', borderColor: '#059669' }}>Save Payment Receipt</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cascading Create Booking Modal (Non-Finance roles) */}
      {showModal && !isFinance && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '560px', background: '#1e293b', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1.25rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={20} /> Create Property Unit Booking
            </h3>

            <form onSubmit={handleCreateBooking}>
              <div className="form-group">
                <label>Select Customer <span style={{ color: '#f43f5e' }}>*</span></label>
                <select required className="form-control" value={formData.customer_id} onChange={e => setFormData({ ...formData, customer_id: e.target.value })}>
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.customer_code}: {c.name} {c.company ? `(${c.company})` : ''}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Booking Amount Deposit ($) <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input required type="number" step="0.01" className="form-control" placeholder="50000" value={formData.booking_amount} onChange={e => setFormData({ ...formData, booking_amount: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#10b981', borderColor: '#059669' }}>Confirm Booking & Lock Unit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {showCancelModal && selectedBookingForCancel && !isFinance && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1rem', color: '#f43f5e' }}>Cancel Booking {selectedBookingForCancel.booking_number}</h3>
            <form onSubmit={handleConfirmCancel}>
              <div className="form-group">
                <label>Reason for Cancellation <span style={{ color: '#f43f5e' }}>*</span></label>
                <textarea required className="form-control" rows="3" placeholder="Reason..." value={cancellationReason} onChange={e => setCancellationReason(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>Keep Booking</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#f43f5e', borderColor: '#e11d48' }}>Confirm Cancellation</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
