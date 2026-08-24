import React, { useEffect, useState } from 'react';
import { User, Home, Calendar, CheckCircle2, Clock, FileText, Download, DollarSign, Key, ShieldCheck, UserCheck, CreditCard, RefreshCw } from 'lucide-react';
import { portalService, paymentService } from '../services/api';

export default function CustomerPortal() {
  const [customerList, setCustomerList] = useState([]);

  // Determine logged-in customer ID or default to 6 (ABC Corporation)
  const getLoggedInCustomerId = () => {
    try {
      const userStr = localStorage.getItem('erp_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.customer_id) return user.customer_id;
      }
    } catch (e) {
      console.error(e);
    }
    return 6; // ABC Corporation default for demo
  };

  const [selectedCustomerId, setSelectedCustomerId] = useState(getLoggedInCustomerId());
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);

  // Load customer list for account switcher
  useEffect(() => {
    portalService.getPortalCustomersList()
      .then(res => setCustomerList(res.data || []))
      .catch(err => console.error(err));
  }, []);

  const loadPortal = (custId) => {
    setLoading(true);
    portalService.getCustomerPortal(custId)
      .then((res) => {
        setPortalData(res.data);
      })
      .catch((err) => {
        console.error("Error loading customer portal:", err);
        setPortalData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPortal(selectedCustomerId);
  }, [selectedCustomerId]);

  const handleCustomerSwitch = (e) => {
    const cid = parseInt(e.target.value);
    setSelectedCustomerId(cid);
  };

  const handlePayInstallment = (installmentId, balanceAmount) => {
    if (!installmentId || balanceAmount <= 0) return;
    const payAmt = prompt(`Enter payment amount to record (Max balance: $${balanceAmount}):`, balanceAmount);
    if (!payAmt || isNaN(payAmt) || parseFloat(payAmt) <= 0) return;

    setPayingId(installmentId);
    paymentService.recordPayment(installmentId, {
      payment_amount: parseFloat(payAmt),
      payment_method: 'Bank Transfer',
      reference_number: `PORTAL-TXN-${Date.now().toString().slice(-6)}`,
      remarks: 'Online Customer Portal Payment'
    })
      .then(() => {
        alert("Payment recorded successfully!");
        loadPortal(selectedCustomerId);
      })
      .catch(err => alert("Payment error: " + (err.response?.data?.detail || err.message)))
      .finally(() => setPayingId(null));
  };

  if (loading) {
    return (
      <div className="content-page">
        <p style={{ color: '#94a3b8' }}>Loading Customer Self-Service Portal...</p>
      </div>
    );
  }

  if (!portalData || !portalData.customer) {
    return (
      <div className="content-page">
        <p style={{ color: '#f43f5e' }}>No customer portal records found for account #{selectedCustomerId}.</p>
      </div>
    );
  }

  const customer = portalData.customer || {};
  const booking = portalData.booking || null;
  const unit = portalData.unit || null;
  const payment_summary = portalData.payment_summary || { total_booking_value: 0, total_paid_amount: 0, outstanding_balance: 0, payment_progress_pct: 0 };
  const payment_schedule = Array.isArray(portalData.payment_schedule) ? portalData.payment_schedule : [];
  const payment_history = Array.isArray(portalData.payment_history) ? portalData.payment_history : [];
  const bookings = Array.isArray(portalData.bookings) ? portalData.bookings : (booking ? [booking] : []);

  return (
    <div className="content-page">
      {/* Top Header & Account Switcher */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'rgba(15,23,42,0.8)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(56,189,248,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldCheck size={28} color="#10b981" />
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#10b981', fontWeight: 700 }}>
              VERIFIED CLIENT CUSTOMER PORTAL
            </div>
            <h1 className="page-title" style={{ margin: 0, fontSize: '1.35rem' }}>Welcome, {customer.name}</h1>
          </div>
        </div>

        {/* Customer Account Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Account Switcher:</span>
          <select
            className="form-control"
            style={{ minWidth: '220px', background: '#0f172a', borderColor: '#38bdf8', color: '#38bdf8', fontWeight: 600 }}
            value={selectedCustomerId}
            onChange={handleCustomerSwitch}
          >
            {customerList.map(c => (
              <option key={c.id} value={c.id}>
                {c.customer_code}: {c.name} {c.company ? `(${c.company})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Customer & Unit Info Banner */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9))' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Customer Account ID</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8' }}>{customer.customer_code}</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.1rem' }}>{customer.name}</div>
            <div style={{ fontSize: '0.85rem', color: '#818cf8' }}>{customer.company || 'Individual Account'}</div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Allocated Property Complex</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f59e0b' }}>
              {unit ? unit.property_name : 'No Property Unit Assigned'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
              {unit ? unit.building_name : '-'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Booked Unit Number</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>
              {unit ? `Unit ${unit.unit_number}` : 'N/A'}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {unit ? `${unit.unit_type} (${unit.area_sqft} sq.ft)` : ''}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Booking Status</div>
            <div style={{ marginTop: '0.25rem' }}>
              {booking ? (
                <span className="tag-badge tag-success" style={{ fontSize: '0.8rem' }}>
                  {booking.status || 'CONFIRMED'} (Ref #{booking.booking_number})
                </span>
              ) : (
                <span className="tag-badge tag-warning">No Active Booking</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Booking Value</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
            ${payment_summary.total_booking_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.1rem', borderTop: '3px solid #10b981' }}>
          <div style={{ fontSize: '0.8rem', color: '#10b981' }}>Total Paid Amount</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>
            ${payment_summary.total_paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.1rem', borderTop: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>Outstanding Balance</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.2rem' }}>
            ${payment_summary.outstanding_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '1.1rem', borderTop: '3px solid #38bdf8' }}>
          <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Payment Progress</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
            {payment_summary.payment_progress_pct}%
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '0.5rem', overflow: 'hidden' }}>
            <div style={{ width: `${payment_summary.payment_progress_pct}%`, height: '100%', background: '#38bdf8' }} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {bookings.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          No active property bookings linked to your customer account yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Milestone Payment Schedule Table */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar color="#10b981" size={20} /> Milestone Payment Schedule
            </h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Milestone</th>
                    <th>Due Date</th>
                    <th>Installment Amount</th>
                    <th>Paid Amount</th>
                    <th>Outstanding Balance</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payment_schedule.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                        No payment schedule recorded.
                      </td>
                    </tr>
                  ) : (
                    payment_schedule.map((inst) => (
                      <tr key={inst.id}>
                        <td style={{ fontWeight: 600, color: '#f8fafc' }}>{inst.milestone_name}</td>
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
                          {inst.balance_amount > 0 ? (
                            <button
                              className="btn btn-primary"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: '#10b981', borderColor: '#059669' }}
                              onClick={() => handlePayInstallment(inst.id, inst.balance_amount)}
                              disabled={payingId === inst.id}
                            >
                              <DollarSign size={12} /> {payingId === inst.id ? 'Processing...' : 'Record Payment'}
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Cleared</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment History Log */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard color="#38bdf8" size={20} /> Payment History & Receipts Log
            </h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Milestone</th>
                    <th>Amount Paid</th>
                    <th>Payment Date</th>
                    <th>Payment Method</th>
                    <th>Reference / TXN #</th>
                  </tr>
                </thead>
                <tbody>
                  {payment_history.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                        No payment transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    payment_history.map((h) => (
                      <tr key={h.id}>
                        <td><span className="tag-badge tag-info" style={{ fontSize: '0.75rem' }}>{h.payment_code}</span></td>
                        <td style={{ fontWeight: 600, color: '#f8fafc' }}>{h.installment_name}</td>
                        <td style={{ color: '#10b981', fontWeight: 700 }}>${h.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{new Date(h.payment_date).toLocaleDateString()}</td>
                        <td><span className="tag-badge tag-secondary">{h.payment_method}</span></td>
                        <td style={{ color: '#38bdf8', fontSize: '0.85rem' }}>{h.reference_number || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
