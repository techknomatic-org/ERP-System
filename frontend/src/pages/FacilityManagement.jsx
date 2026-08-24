import React, { useEffect, useState } from 'react';
import { Wrench, Plus, Users, LifeBuoy, Zap, ShieldCheck, Clock, CheckCircle2, DollarSign, Calendar } from 'lucide-react';
import { facilityService, propertyService } from '../services/api';

export default function FacilityManagement() {
  const [activeTab, setActiveTab] = useState('tickets');
  const [tenants, setTenants] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [utilityBills, setUtilityBills] = useState([]);
  const [visitorPasses, setVisitorPasses] = useState([]);
  const [units, setUnits] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [showUtilityModal, setShowUtilityModal] = useState(false);
  const [showVisitorModal, setShowVisitorModal] = useState(false);

  // Form states
  const [ticketForm, setTicketForm] = useState({ tenant_id: '', unit_id: '', category: 'HVAC', priority: 'medium', subject: '', description: '' });
  const [woForm, setWoForm] = useState({ property_id: '', maintenance_type: 'Preventive', description: '', scheduled_date: '', estimated_cost: '' });
  const [utilForm, setUtilForm] = useState({ unit_id: '', utility_type: 'Electricity', meter_number: '', prev_reading: '', curr_reading: '', rate_per_unit: '0.18', due_date: '' });
  const [visitorForm, setVisitorForm] = useState({ property_id: '', visitor_name: '', visitor_phone: '', purpose: '' });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      facilityService.getTenants(),
      facilityService.getTickets(),
      facilityService.getWorkOrders(),
      facilityService.getUtilityBills(),
      facilityService.getVisitorPasses(),
      propertyService.getUnits(),
      propertyService.getProperties()
    ])
      .then(([tRes, tckRes, woRes, uRes, vRes, unitRes, propRes]) => {
        setTenants(tRes.data);
        setTickets(tckRes.data);
        setWorkOrders(woRes.data);
        setUtilityBills(uRes.data);
        setVisitorPasses(vRes.data);
        setUnits(unitRes.data);
        setProperties(propRes.data);

        if (tRes.data.length > 0 && unitRes.data.length > 0) {
          setTicketForm(f => ({ ...f, tenant_id: tRes.data[0].id, unit_id: unitRes.data[0].id }));
          setUtilForm(f => ({ ...f, unit_id: unitRes.data[0].id }));
        }
        if (propRes.data.length > 0) {
          setWoForm(f => ({ ...f, property_id: propRes.data[0].id }));
          setVisitorForm(f => ({ ...f, property_id: propRes.data[0].id }));
        }
      })
      .catch((err) => console.error("Error loading facility management data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTicket = (e) => {
    e.preventDefault();
    facilityService.createTicket({
      tenant_id: parseInt(ticketForm.tenant_id),
      unit_id: parseInt(ticketForm.unit_id),
      category: ticketForm.category,
      priority: ticketForm.priority,
      subject: ticketForm.subject,
      description: ticketForm.description
    })
      .then(() => {
        setShowTicketModal(false);
        setTicketForm({ tenant_id: tenants[0]?.id || '', unit_id: units[0]?.id || '', category: 'HVAC', priority: 'medium', subject: '', description: '' });
        loadData();
      });
  };

  const handleCreateWorkOrder = (e) => {
    e.preventDefault();
    facilityService.createWorkOrder({
      property_id: parseInt(woForm.property_id),
      maintenance_type: woForm.maintenance_type,
      description: woForm.description,
      scheduled_date: new Date(woForm.scheduled_date).toISOString(),
      estimated_cost: parseFloat(woForm.estimated_cost || 0)
    })
      .then(() => {
        setShowWorkOrderModal(false);
        setWoForm({ property_id: properties[0]?.id || '', maintenance_type: 'Preventive', description: '', scheduled_date: '', estimated_cost: '' });
        loadData();
      });
  };

  const handleCreateUtilityBill = (e) => {
    e.preventDefault();
    facilityService.createUtilityBill({
      unit_id: parseInt(utilForm.unit_id),
      utility_type: utilForm.utility_type,
      meter_number: utilForm.meter_number,
      prev_reading: parseFloat(utilForm.prev_reading),
      curr_reading: parseFloat(utilForm.curr_reading),
      rate_per_unit: parseFloat(utilForm.rate_per_unit),
      due_date: new Date(utilForm.due_date).toISOString()
    })
      .then(() => {
        setShowUtilityModal(false);
        loadData();
      })
      .catch((err) => alert(err.response?.data?.detail || "Utility billing failed"));
  };

  const handleCreateVisitorPass = (e) => {
    e.preventDefault();
    facilityService.createVisitorPass({
      property_id: parseInt(visitorForm.property_id),
      visitor_name: visitorForm.visitor_name,
      visitor_phone: visitorForm.visitor_phone,
      purpose: visitorForm.purpose
    })
      .then(() => {
        setShowVisitorModal(false);
        loadData();
      });
  };

  const handleCheckoutVisitor = (passId) => {
    facilityService.checkoutVisitorPass(passId)
      .then(() => loadData());
  };

  return (
    <div className="content-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Facility Management Hub</h1>
          <p className="page-subtitle">Tenants, Service Helpdesk, Work Orders, Utility Billing & Gate Passes</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowTicketModal(true)}><Plus size={16} /> New Ticket</button>
          <button className="btn btn-secondary" onClick={() => setShowWorkOrderModal(true)}><Plus size={16} /> Work Order</button>
          <button className="btn btn-secondary" onClick={() => setShowUtilityModal(true)}><Plus size={16} /> Utility Bill</button>
          <button className="btn btn-primary" onClick={() => setShowVisitorModal(true)}><Plus size={16} /> Gate Pass</button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem' }}>
        <button className={`nav-link ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>
          <LifeBuoy size={16} /> Service Tickets ({tickets.length})
        </button>
        <button className={`nav-link ${activeTab === 'tenants' ? 'active' : ''}`} onClick={() => setActiveTab('tenants')}>
          <Users size={16} /> Tenants & Leases ({tenants.length})
        </button>
        <button className={`nav-link ${activeTab === 'workorders' ? 'active' : ''}`} onClick={() => setActiveTab('workorders')}>
          <Wrench size={16} /> Work Orders ({workOrders.length})
        </button>
        <button className={`nav-link ${activeTab === 'utility' ? 'active' : ''}`} onClick={() => setActiveTab('utility')}>
          <Zap size={16} /> Utility Billing ({utilityBills.length})
        </button>
        <button className={`nav-link ${activeTab === 'visitors' ? 'active' : ''}`} onClick={() => setActiveTab('visitors')}>
          <ShieldCheck size={16} /> Visitor Gate Passes ({visitorPasses.length})
        </button>
      </div>

      {/* TAB 1: Helpdesk Service Tickets */}
      {activeTab === 'tickets' && (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Ticket Ref</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Subject & Description</th>
                <th>Assigned Tech</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600, color: '#818cf8' }}>{t.ticket_code}</td>
                  <td><span className="tag-badge tag-info">{t.category}</span></td>
                  <td>
                    <span className={`tag-badge ${t.priority === 'urgent' || t.priority === 'high' ? 'tag-danger' : 'tag-warning'}`}>
                      {t.priority.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ maxWidth: '280px' }}>
                    <strong style={{ display: 'block', color: '#f8fafc' }}>{t.subject}</strong>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t.description}</span>
                  </td>
                  <td>{t.assigned_technician_id ? `Tech #${t.assigned_technician_id}` : 'Unassigned'}</td>
                  <td>
                    <select 
                      className="form-control" 
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                      value={t.status}
                      onChange={e => facilityService.updateTicketStatus(t.id, e.target.value).then(() => loadData())}
                    >
                      <option value="open">OPEN</option>
                      <option value="assigned">ASSIGNED</option>
                      <option value="in_progress">IN PROGRESS</option>
                      <option value="resolved">RESOLVED</option>
                      <option value="closed">CLOSED</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Tenants Directory & Lease */}
      {activeTab === 'tenants' && (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Tenant Code</th>
                <th>Tenant Name / Company</th>
                <th>Email / Phone</th>
                <th>Unit ID</th>
                <th>Monthly Rent</th>
                <th>Lease Expiry</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tn) => (
                <tr key={tn.id}>
                  <td style={{ fontWeight: 600, color: '#38bdf8' }}>{tn.tenant_code}</td>
                  <td>
                    <strong style={{ display: 'block', color: '#f8fafc' }}>{tn.name}</strong>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{tn.company_name}</span>
                  </td>
                  <td>{tn.email}</td>
                  <td>Unit #{tn.unit_id}</td>
                  <td style={{ fontWeight: 700, color: '#10b981' }}>${tn.rent_amount.toLocaleString()}/mo</td>
                  <td>{new Date(tn.lease_end).toLocaleDateString()}</td>
                  <td><span className="tag-badge tag-success">{tn.status.toUpperCase()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: Work Orders */}
      {activeTab === 'workorders' && (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>WO Ref</th>
                <th>Maintenance Type</th>
                <th>Property ID</th>
                <th>Description</th>
                <th>Scheduled Date</th>
                <th>Est. Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((w) => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 600, color: '#818cf8' }}>{w.work_order_code}</td>
                  <td><span className="tag-badge tag-warning">{w.maintenance_type}</span></td>
                  <td>Property #{w.property_id}</td>
                  <td style={{ maxWidth: '280px', fontSize: '0.85rem' }}>{w.description}</td>
                  <td>{new Date(w.scheduled_date).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 700 }}>${w.estimated_cost}</td>
                  <td><span className="tag-badge tag-info">{w.status.toUpperCase()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: Utility Meter Billing */}
      {activeTab === 'utility' && (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Bill Ref</th>
                <th>Unit ID</th>
                <th>Utility Type</th>
                <th>Meter #</th>
                <th>Readings (Prev ──► Curr)</th>
                <th>Units Consumed</th>
                <th>Total Billed Amount</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {utilityBills.map((ub) => (
                <tr key={ub.id}>
                  <td style={{ fontWeight: 600, color: '#38bdf8' }}>{ub.bill_code}</td>
                  <td>Unit #{ub.unit_id}</td>
                  <td><span className="tag-badge tag-info">{ub.utility_type}</span></td>
                  <td>{ub.meter_number}</td>
                  <td style={{ fontSize: '0.85rem' }}>{ub.prev_reading} ──► {ub.curr_reading}</td>
                  <td style={{ fontWeight: 600 }}>{ub.units_consumed} units</td>
                  <td style={{ fontWeight: 700, color: '#10b981' }}>${ub.total_amount.toFixed(2)}</td>
                  <td>{new Date(ub.due_date).toLocaleDateString()}</td>
                  <td><span className="tag-badge tag-warning">{ub.status.toUpperCase()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: Visitor Gate Passes */}
      {activeTab === 'visitors' && (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Gate Pass Ref</th>
                <th>Visitor Name</th>
                <th>Phone</th>
                <th>Purpose of Visit</th>
                <th>Check-In Time</th>
                <th>Check-Out Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visitorPasses.map((vp) => (
                <tr key={vp.id}>
                  <td style={{ fontWeight: 600, color: '#818cf8' }}>{vp.pass_code}</td>
                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>{vp.visitor_name}</td>
                  <td>{vp.visitor_phone}</td>
                  <td style={{ fontSize: '0.85rem' }}>{vp.purpose}</td>
                  <td>{new Date(vp.check_in_time).toLocaleTimeString()}</td>
                  <td>{vp.check_out_time ? new Date(vp.check_out_time).toLocaleTimeString() : 'In Premises'}</td>
                  <td>
                    {vp.status === 'checked_in' ? (
                      <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleCheckoutVisitor(vp.id)}>
                        Check Out
                      </button>
                    ) : (
                      <span className="tag-badge tag-success">CHECKED OUT</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showTicketModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Create Service Helpdesk Ticket</h3>
            <form onSubmit={handleCreateTicket}>
              <div className="form-group">
                <label>Select Tenant</label>
                <select className="form-control" value={ticketForm.tenant_id} onChange={e => setTicketForm({ ...ticketForm, tenant_id: e.target.value })}>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.company_name})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select className="form-control" value={ticketForm.category} onChange={e => setTicketForm({ ...ticketForm, category: e.target.value })}>
                  <option value="HVAC">HVAC / Air Conditioning</option>
                  <option value="Electrical">Electrical Power</option>
                  <option value="Plumbing">Plumbing & Water</option>
                  <option value="Elevator">Elevator / Lift Service</option>
                  <option value="Janitorial">Janitorial / Cleaning</option>
                </select>
              </div>
              <div className="form-group">
                <label>Subject</label>
                <input required type="text" className="form-control" placeholder="Server Room AC Failure" value={ticketForm.subject} onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea required className="form-control" rows="2" placeholder="Detailed issue notes..." value={ticketForm.description} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTicketModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Utility Bill Modal */}
      {showUtilityModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Generate Utility Meter Bill</h3>
            <form onSubmit={handleCreateUtilityBill}>
              <div className="form-group">
                <label>Meter Number</label>
                <input required type="text" className="form-control" placeholder="MTR-ELEC-4091" value={utilForm.meter_number} onChange={e => setUtilForm({ ...utilForm, meter_number: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Previous Reading</label>
                  <input required type="number" step="0.01" className="form-control" placeholder="14200" value={utilForm.prev_reading} onChange={e => setUtilForm({ ...utilForm, prev_reading: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Current Reading</label>
                  <input required type="number" step="0.01" className="form-control" placeholder="15850" value={utilForm.curr_reading} onChange={e => setUtilForm({ ...utilForm, curr_reading: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Rate per Unit ($)</label>
                  <input required type="number" step="0.01" className="form-control" placeholder="0.18" value={utilForm.rate_per_unit} onChange={e => setUtilForm({ ...utilForm, rate_per_unit: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input required type="date" className="form-control" value={utilForm.due_date} onChange={e => setUtilForm({ ...utilForm, due_date: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUtilityModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Visitor Gate Pass Modal */}
      {showVisitorModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Issue Visitor Gate Pass</h3>
            <form onSubmit={handleCreateVisitorPass}>
              <div className="form-group">
                <label>Visitor Full Name</label>
                <input required type="text" className="form-control" placeholder="Alexander Vance" value={visitorForm.visitor_name} onChange={e => setVisitorForm({ ...visitorForm, visitor_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input required type="text" className="form-control" placeholder="+1 555-3310" value={visitorForm.visitor_phone} onChange={e => setVisitorForm({ ...visitorForm, visitor_phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Purpose of Visit</label>
                <input required type="text" className="form-control" placeholder="Server Rack Audit" value={visitorForm.purpose} onChange={e => setVisitorForm({ ...visitorForm, purpose: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowVisitorModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Issue Pass</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
