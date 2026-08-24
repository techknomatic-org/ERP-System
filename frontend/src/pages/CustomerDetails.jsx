import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, ArrowLeft, Phone, Mail, Building2, MapPin, Calendar, CheckCircle2, ChevronRight, UserCheck, FileText, CreditCard, DollarSign } from 'lucide-react';
import { customerService, paymentService } from '../services/api';

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      customerService.getCustomerById(id),
      paymentService.getCustomerPayments(id)
    ])
      .then(([cRes, pRes]) => {
        setCustomer(cRes.data);
        setPaymentSummary(pRes.data);
      })
      .catch((err) => console.error("Error loading Customer profile/payments:", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="content-page">
        <p style={{ color: '#94a3b8' }}>Loading Customer profile & financial records from database...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="content-page">
        <button className="btn btn-secondary" onClick={() => navigate('/customers')} style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={18} /> Back to Customers
        </button>
        <p style={{ color: '#f43f5e' }}>Customer record not found in MySQL database.</p>
      </div>
    );
  }

  return (
    <div className="content-page">
      {/* Top Navigation Bar */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/customers')}>
            <ArrowLeft size={16} /> Back to Customers
          </button>
          {customer.source_lead_id && (
            <button className="btn btn-secondary" style={{ color: '#38bdf8' }} onClick={() => navigate(`/crm/leads/${customer.source_lead_id}`)}>
              <FileText size={16} /> View Original Lead #{customer.source_lead_id}
            </button>
          )}
        </div>

        <span className={`tag-badge ${customer.status === 'active' ? 'tag-success' : 'tag-danger'}`} style={{ fontSize: '0.9rem', padding: '0.45rem 0.9rem' }}>
          STATUS: {(customer.status || 'active').toUpperCase()}
        </span>
      </div>

      {/* Header Overview Banner */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="tag-badge tag-info" style={{ fontSize: '0.85rem' }}>{customer.customer_code}</span>
          <h1 className="page-title" style={{ margin: 0 }}>{customer.name}</h1>
        </div>
        <p className="page-subtitle" style={{ marginTop: '0.2rem' }}>
          Company: <strong>{customer.company || 'Individual Account'}</strong> | Account Type: <strong>{customer.customer_type || 'Individual'}</strong>
        </p>
      </div>

      {/* Customer Financial Payment Summary KPIs */}
      {paymentSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="glass-card" style={{ padding: '1.1rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Property Bookings</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
              {paymentSummary.total_bookings_count}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.1rem', borderTop: '3px solid #38bdf8' }}>
            <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Total Bookings Value</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
              ${paymentSummary.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.1rem', borderTop: '3px solid #10b981' }}>
            <div style={{ fontSize: '0.8rem', color: '#10b981' }}>Total Payments Collected</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>
              ${paymentSummary.total_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.1rem', borderTop: '3px solid #f59e0b' }}>
            <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>Total Outstanding Balance</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.2rem' }}>
              ${paymentSummary.total_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Specifications & Payments */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* LEFT COLUMN: Customer Specifications & Payment Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Specifications */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users color="#10b981" size={22} /> Customer Account Specifications
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Customer ID</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#38bdf8', marginTop: '0.2rem' }}>{customer.customer_code}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Customer / Account Name</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>{customer.name}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Company Name</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#818cf8', marginTop: '0.2rem' }}>{customer.company || 'N/A'}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Contact Person</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#f8fafc', marginTop: '0.2rem' }}>{customer.contact_person || customer.name}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Phone Number</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#06b6d4', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Phone size={14} /> {customer.phone || 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Email Address</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#cbd5e1', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Mail size={14} color="#818cf8" /> {customer.email}
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Billing & Contact Address</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#cbd5e1', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MapPin size={16} color="#06b6d4" /> {customer.address || 'N/A'} {customer.city ? `, ${customer.city}` : ''} {customer.state ? `, ${customer.state}` : ''} {customer.postal_code || ''}
                </div>
              </div>
            </div>
          </div>

          {/* Customer Payment History Table */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard color="#38bdf8" size={20} /> Recorded Customer Payment Transactions
            </h3>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Booking Ref</th>
                    <th>Amount Paid</th>
                    <th>Payment Date</th>
                    <th>Method</th>
                    <th>Reference / TXN</th>
                  </tr>
                </thead>
                <tbody>
                  {!paymentSummary?.payment_history || paymentSummary.payment_history.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                        No payments recorded for this customer yet.
                      </td>
                    </tr>
                  ) : (
                    paymentSummary.payment_history.map((p) => (
                      <tr key={p.id}>
                        <td><span className="tag-badge tag-info" style={{ fontSize: '0.75rem' }}>{p.payment_code}</span></td>
                        <td style={{ fontWeight: 600, color: '#38bdf8' }}>{p.booking_number}</td>
                        <td style={{ color: '#10b981', fontWeight: 700 }}>${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td><span className="tag-badge tag-secondary">{p.payment_method}</span></td>
                        <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{p.reference_number || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Customer Bookings & CRM Origin */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Active Bookings List */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
              <CreditCard color="#10b981" size={18} /> Linked Property Bookings
            </h3>

            {!paymentSummary?.bookings || paymentSummary.bookings.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No active property bookings linked to this customer.</p>
            ) : (
              paymentSummary.bookings.map(b => (
                <div key={b.booking_id} style={{ padding: '0.75rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', marginBottom: '0.75rem', borderLeft: '3px solid #10b981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#38bdf8' }}>{b.booking_number}</span>
                    <span className="tag-badge tag-success" style={{ fontSize: '0.7rem' }}>{b.status}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.3rem' }}>
                    Total Value: <strong>${b.total_amount.toLocaleString()}</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#10b981' }}>
                    Paid: <strong>${b.total_paid.toLocaleString()}</strong>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', justifyContent: 'center' }}
                    onClick={() => navigate(`/bookings/${b.booking_id}`)}
                  >
                    View Payment Schedule & Bookings
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Source Lead Tracking Card */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
              <UserCheck color="#38bdf8" size={18} /> CRM Source Origin
            </h3>

            {customer.source_lead_id ? (
              <div>
                <div style={{ marginBottom: '0.75rem', padding: '0.65rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Converted From Lead:</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.1rem' }}>
                    Lead #{customer.source_lead_id}
                  </div>
                </div>

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}
                  onClick={() => navigate(`/crm/leads/${customer.source_lead_id}`)}
                >
                  <FileText size={14} /> View Original Lead
                </button>
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                Directly registered in Customer Master Directory.
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
