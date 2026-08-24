import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Key, ArrowLeft, Building2, HardHat, Layers, ChevronRight, DollarSign, MapPin, CheckCircle2, UserCheck, Calendar, ShieldAlert, FileText, Phone, Mail, PlusCircle, CreditCard, Clock } from 'lucide-react';
import { bookingService, paymentService } from '../services/api';

export default function BookingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal State for Record Payment
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Bank Transfer',
    reference_number: '',
    remarks: ''
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      bookingService.getBookingById(id),
      paymentService.getPaymentSchedule(id)
    ])
      .then(([bRes, pRes]) => {
        setBooking(bRes.data);
        setSchedule(pRes.data);
      })
      .catch((err) => console.error("Error loading Booking details:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleOpenRecordModal = (inst) => {
    setSelectedInstallment(inst);
    setPaymentForm({
      payment_amount: inst.balance_amount.toString(),
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'Bank Transfer',
      reference_number: '',
      remarks: ''
    });
    setShowPaymentModal(true);
  };

  const handleRecordPaymentSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(paymentForm.payment_amount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid payment amount greater than 0.");
      return;
    }
    if (amt > selectedInstallment.balance_amount + 0.01) {
      alert(`Payment amount ($${amt.toLocaleString()}) cannot exceed the current outstanding balance ($${selectedInstallment.balance_amount.toLocaleString()}).`);
      return;
    }

    paymentService.recordPayment(selectedInstallment.id, {
      payment_amount: amt,
      payment_date: new Date(paymentForm.payment_date).toISOString(),
      payment_method: paymentForm.payment_method,
      reference_number: paymentForm.reference_number,
      remarks: paymentForm.remarks
    })
      .then(() => {
        setShowPaymentModal(false);
        loadData();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to record payment"));
  };

  if (loading) {
    return (
      <div className="content-page">
        <p style={{ color: '#94a3b8' }}>Loading Booking & Payment Schedule from database...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="content-page">
        <button className="btn btn-secondary" onClick={() => navigate('/bookings')} style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={18} /> Back to Bookings
        </button>
        <p style={{ color: '#f43f5e' }}>Booking record not found in MySQL database.</p>
      </div>
    );
  }

  return (
    <div className="content-page">
      {/* Top Header Navigation */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/bookings')}>
            <ArrowLeft size={16} /> Back to Bookings
          </button>
          {booking.customer_id && (
            <button className="btn btn-secondary" style={{ color: '#38bdf8' }} onClick={() => navigate(`/customers/${booking.customer_id}`)}>
              <UserCheck size={16} /> View Customer Profile
            </button>
          )}
          {booking.unit_id && (
            <button className="btn btn-secondary" style={{ color: '#10b981' }} onClick={() => navigate(`/units/${booking.unit_id}`)}>
              <Key size={16} /> View Unit Specifications
            </button>
          )}
        </div>

        <span className={`tag-badge ${booking.status === 'CONFIRMED' ? 'tag-success' : booking.status === 'CANCELLED' ? 'tag-danger' : 'tag-warning'}`} style={{ fontSize: '0.9rem', padding: '0.45rem 0.9rem' }}>
          STATUS: {(booking.status || 'CONFIRMED').toUpperCase()}
        </span>
      </div>

      {/* Header Banner */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="tag-badge tag-info" style={{ fontSize: '0.85rem' }}>{booking.booking_number}</span>
          <h1 className="page-title" style={{ margin: 0 }}>Unit {booking.unit_number} Booking & Payment Management</h1>
        </div>
        <p className="page-subtitle" style={{ marginTop: '0.2rem' }}>
          Customer: <strong>{booking.customer_name}</strong> | Building: <strong>{booking.building_name}</strong> | Property: <strong>{booking.property_name}</strong>
        </p>
      </div>

      {/* Payment KPI & Summary Cards */}
      {schedule && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.1rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Unit Booking Value</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
              ${schedule.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.1rem', borderTop: '3px solid #10b981' }}>
            <div style={{ fontSize: '0.8rem', color: '#10b981' }}>Total Paid Amount</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>
              ${schedule.total_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.1rem', borderTop: '3px solid #f59e0b' }}>
            <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>Outstanding Balance</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.2rem' }}>
              ${schedule.total_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.1rem', borderTop: '3px solid #38bdf8' }}>
            <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Payment Progress</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
              {schedule.progress_pct}%
            </div>
            {/* Progress bar */}
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '0.5rem', overflow: 'hidden' }}>
              <div style={{ width: `${schedule.progress_pct}%`, height: '100%', background: '#38bdf8' }} />
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Schedule vs Specs */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

        {/* LEFT COLUMN: Payment Schedule Table & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* PAYMENT SCHEDULE TABLE */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Calendar color="#10b981" size={22} /> Milestone Payment Schedule
              </h3>
              {schedule?.next_due_payment && (
                <div style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem', background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', borderRadius: '6px', color: '#f59e0b' }}>
                  Next Due: <strong>{schedule.next_due_payment.milestone_name}</strong> (${schedule.next_due_payment.amount.toLocaleString()})
                </div>
              )}
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Milestone Name</th>
                    <th>Due Date</th>
                    <th>Installment Amount</th>
                    <th>Paid Amount</th>
                    <th>Outstanding Balance</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule?.installments.map((inst) => (
                    <tr key={inst.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{inst.milestone_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Seq #{inst.sequence_number}</div>
                      </td>
                      <td style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
                        {inst.due_date ? new Date(inst.due_date).toLocaleDateString() : 'Immediate'}
                      </td>
                      <td style={{ fontWeight: 600 }}>${inst.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style={{ color: '#10b981', fontWeight: 600 }}>${inst.paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style={{ color: inst.balance_amount > 0 ? '#f59e0b' : '#94a3b8', fontWeight: 600 }}>
                        ${inst.balance_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className={`tag-badge ${inst.status === 'PAID' ? 'tag-success' : inst.status === 'PARTIALLY_PAID' ? 'tag-info' : inst.status === 'OVERDUE' ? 'tag-danger' : 'tag-warning'}`}>
                          {inst.status}
                        </span>
                      </td>
                      <td>
                        {inst.status !== 'PAID' ? (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', background: '#10b981', borderColor: '#059669' }}
                            onClick={() => handleOpenRecordModal(inst)}
                          >
                            <PlusCircle size={14} /> Record Payment
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <CheckCircle2 size={14} /> Fully Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PAYMENT TRANSACTION HISTORY LOG */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard color="#38bdf8" size={20} /> Payment Transaction History
            </h3>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Milestone</th>
                    <th>Amount Paid</th>
                    <th>Payment Date</th>
                    <th>Method</th>
                    <th>Reference / TXN #</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {!schedule?.payment_history || schedule.payment_history.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                        No payment transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    schedule.payment_history.map((h) => (
                      <tr key={h.id}>
                        <td><span className="tag-badge tag-info" style={{ fontSize: '0.75rem' }}>{h.payment_code}</span></td>
                        <td style={{ fontWeight: 600, color: '#f8fafc' }}>{h.installment_name}</td>
                        <td style={{ color: '#10b981', fontWeight: 700 }}>${h.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{new Date(h.payment_date).toLocaleDateString()}</td>
                        <td><span className="tag-badge tag-secondary">{h.payment_method}</span></td>
                        <td style={{ color: '#38bdf8', fontSize: '0.85rem' }}>{h.reference_number || '-'}</td>
                        <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{h.remarks || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Customer & Unit Specification Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Core Specs Card */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
              <FileText color="#38bdf8" size={18} /> Booking Terms
            </h3>
            <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div>
                <span style={{ color: '#94a3b8' }}>Salesperson: </span>
                <span style={{ color: '#818cf8', fontWeight: 600 }}>{booking.salesperson_name || 'N/A'}</span>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Agreement: </span>
                <span style={{ color: '#06b6d4', fontWeight: 600 }}>{booking.agreement_status || 'Draft'}</span>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>Discount: </span>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>${booking.discount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Customer Card */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
              <UserCheck color="#38bdf8" size={18} /> Customer Account
            </h3>
            <div style={{ padding: '0.75rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{booking.customer_code}</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.1rem' }}>{booking.customer_name}</div>
              <div style={{ fontSize: '0.8rem', color: '#818cf8' }}>{booking.customer_company || 'Individual Account'}</div>
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }} onClick={() => navigate(`/customers/${booking.customer_id}`)}>
              View Customer Profile
            </button>
          </div>

          {/* Unit Card */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
              <Key color="#10b981" size={18} /> Booked Unit Property
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              <div style={{ padding: '0.4rem 0.6rem', background: 'rgba(15,23,42,0.6)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Project: </span>
                <span style={{ fontWeight: 600, color: '#38bdf8' }}>{booking.project_name}</span>
              </div>
              <div style={{ padding: '0.4rem 0.6rem', background: 'rgba(15,23,42,0.6)', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Property: </span>
                <span style={{ fontWeight: 600, color: '#f59e0b' }}>{booking.property_name}</span>
              </div>
              <div style={{ padding: '0.4rem 0.6rem', background: 'rgba(15,23,42,0.6)', borderRadius: '6px', borderLeft: '3px solid #10b981' }}>
                <span style={{ color: '#94a3b8' }}>Unit: </span>
                <span style={{ fontWeight: 600, color: '#f8fafc' }}>{booking.unit_number} ({booking.unit_type})</span>
              </div>
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }} onClick={() => navigate(`/units/${booking.unit_id}`)}>
              View Unit Specifications
            </button>
          </div>

        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      {showPaymentModal && selectedInstallment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '520px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={22} /> Record Installment Payment
            </h3>

            <div style={{ padding: '0.85rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', marginBottom: '1.25rem', borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Selected Milestone:</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.1rem' }}>
                {selectedInstallment.milestone_name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#cbd5e1' }}>Installment Total: <strong>${selectedInstallment.amount.toLocaleString()}</strong></span>
                <span style={{ color: '#f59e0b' }}>Outstanding Balance: <strong>${selectedInstallment.balance_amount.toLocaleString()}</strong></span>
              </div>
            </div>

            <form onSubmit={handleRecordPaymentSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Payment Amount ($) <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="form-control"
                    placeholder="Enter amount..."
                    value={paymentForm.payment_amount}
                    onChange={e => setPaymentForm({ ...paymentForm, payment_amount: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Payment Date <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input
                    required
                    type="date"
                    className="form-control"
                    value={paymentForm.payment_date}
                    onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Payment Method <span style={{ color: '#f43f5e' }}>*</span></label>
                  <select
                    className="form-control"
                    value={paymentForm.payment_method}
                    onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Reference / TXN #</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="TXN-998877"
                    value={paymentForm.reference_number}
                    onChange={e => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Payment Remarks / Notes</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Partial / full payment installment received..."
                  value={paymentForm.remarks}
                  onChange={e => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#10b981', borderColor: '#059669' }}>
                  Confirm & Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
