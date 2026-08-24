import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, ArrowLeft, Phone, Mail, Building2, Calendar, CheckCircle2, Clock, MapPin, Plus, Edit3, Award, MessageSquare, AlertCircle } from 'lucide-react';
import { crmLeadService, propertyService } from '../services/api';

export default function CrmLeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showQualifyModal, setShowQualifyModal] = useState(false);

  // Forms
  const [followupForm, setFollowupForm] = useState({
    followup_date: '',
    followup_type: 'Call',
    notes: '',
    next_action: '',
    status: 'Scheduled'
  });

  const [visitForm, setVisitForm] = useState({
    property_id: '',
    visit_date: '',
    notes: '',
    customer_feedback: '',
    interest_level: 'High',
    next_action: '',
    status: 'Scheduled'
  });

  const [qualifyForm, setQualifyForm] = useState({
    requirement_confirmed: true,
    budget_available: true,
    decision_maker_identified: true,
    qualification_notes: ''
  });

  const loadLeadDetails = () => {
    setLoading(true);
    Promise.all([
      crmLeadService.getLeadById(id),
      propertyService.getProperties()
    ])
      .then(([leadRes, propRes]) => {
        setLead(leadRes.data);
        setProperties(propRes.data);
      })
      .catch((err) => console.error("Error loading Lead details:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLeadDetails();
  }, [id]);

  const handleCreateFollowup = (e) => {
    e.preventDefault();
    if (!followupForm.followup_date) {
      alert("Please select a follow-up date and time.");
      return;
    }

    crmLeadService.createFollowup(id, {
      followup_date: new Date(followupForm.followup_date).toISOString(),
      followup_type: followupForm.followup_type,
      notes: followupForm.notes,
      next_action: followupForm.next_action,
      status: followupForm.status
    })
      .then(() => {
        setShowFollowupModal(false);
        setFollowupForm({ followup_date: '', followup_type: 'Call', notes: '', next_action: '', status: 'Scheduled' });
        loadLeadDetails();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to schedule follow-up"));
  };

  const handleCreateSiteVisit = (e) => {
    e.preventDefault();
    if (!visitForm.visit_date) {
      alert("Please select a site visit date and time.");
      return;
    }

    crmLeadService.createSiteVisit(id, {
      property_id: visitForm.property_id ? parseInt(visitForm.property_id) : undefined,
      visit_date: new Date(visitForm.visit_date).toISOString(),
      notes: visitForm.notes,
      customer_feedback: visitForm.customer_feedback,
      interest_level: visitForm.interest_level,
      next_action: visitForm.next_action,
      status: visitForm.status
    })
      .then(() => {
        setShowVisitModal(false);
        setVisitForm({ property_id: '', visit_date: '', notes: '', customer_feedback: '', interest_level: 'High', next_action: '', status: 'Scheduled' });
        loadLeadDetails();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to schedule site visit"));
  };

  const handleQualifyLead = (e) => {
    e.preventDefault();
    crmLeadService.qualifyLead(id, qualifyForm)
      .then(() => {
        setShowQualifyModal(false);
        loadLeadDetails();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to qualify lead"));
  };

  // Convert Modal State
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [converting, setConverting] = useState(false);

  const handleConfirmConvert = () => {
    setConverting(true);
    crmLeadService.convertLead(id)
      .then((res) => {
        setShowConvertModal(false);
        if (res.data.already_converted) {
          alert(`This lead has already been converted to customer ${res.data.customer_code}.`);
        }
        loadLeadDetails();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to convert lead"))
      .finally(() => setConverting(false));
  };

  if (loading) {
    return (
      <div className="content-page">
        <p style={{ color: '#94a3b8' }}>Loading Lead record from database...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="content-page">
        <button className="btn btn-secondary" onClick={() => navigate('/crm-leads')} style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={18} /> Back to Lead Pipeline
        </button>
        <p style={{ color: '#f43f5e' }}>Lead record not found in MySQL database.</p>
      </div>
    );
  }

  const isConverted = lead.stage === 'CONVERTED' || !!lead.customer_id;
  const isEligibleForConversion = ['QUALIFIED', 'NEGOTIATION', 'BOOKING'].includes((lead.stage || '').toUpperCase());

  return (
    <div className="content-page">
      {/* Top Header Navigation */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button className="btn btn-secondary" onClick={() => navigate('/crm-leads')} style={{ marginBottom: '0.75rem' }}>
            <ArrowLeft size={16} /> Back to Lead Pipeline
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="tag-badge tag-info" style={{ fontSize: '0.85rem' }}>LEAD #{lead.id}</span>
            <h1 className="page-title" style={{ margin: 0 }}>{lead.customer_name}</h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {isConverted ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="tag-badge tag-success" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                Conversion Status: CONVERTED
              </span>
              {lead.customer_code && (
                <span className="tag-badge tag-info" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                  Customer ID: {lead.customer_code}
                </span>
              )}
              {lead.customer_id && (
                <button className="btn btn-primary" onClick={() => navigate(`/customers/${lead.customer_id}`)}>
                  View Customer
                </button>
              )}
            </div>
          ) : isEligibleForConversion ? (
            <button className="btn btn-primary" style={{ background: '#10b981', borderColor: '#059669' }} onClick={() => setShowConvertModal(true)}>
              Convert to Customer
            </button>
          ) : (
            <button className="btn btn-primary" style={{ background: '#06b6d4', borderColor: '#0891b2' }} onClick={() => setShowQualifyModal(true)}>
              <Award size={18} /> Qualify Lead
            </button>
          )}

          <span className="tag-badge tag-info" style={{ fontSize: '0.9rem', padding: '0.45rem 0.9rem' }}>
            STAGE: {(lead.stage || 'NEW').replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Core Lead Information Card */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users color="#38bdf8" size={22} /> Lead Profile & Requirement Specifications
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Contact Person / Name</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>{lead.customer_name}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Company Name</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#818cf8', marginTop: '0.2rem' }}>{lead.company || 'Individual Prospect'}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Phone Number</div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#06b6d4', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Phone size={14} /> {lead.phone || 'N/A'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Email Address</div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#cbd5e1', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Mail size={14} color="#818cf8" /> {lead.email}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Lead Source</div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#f8fafc', marginTop: '0.2rem' }}>{lead.source || 'Website'}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Priority Level</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: lead.priority === 'Critical' ? '#f43f5e' : lead.priority === 'High' ? '#f59e0b' : '#38bdf8', marginTop: '0.2rem' }}>
                {lead.priority || 'Medium'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Preferred Property</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#38bdf8', marginTop: '0.2rem' }}>{lead.property_name || 'Not Specified'}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Preferred Unit Type</div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#cbd5e1', marginTop: '0.2rem' }}>{lead.preferred_unit_type || 'Office'}</div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Expected Requirement Description</div>
              <div style={{ fontSize: '0.95rem', color: '#f8fafc', marginTop: '0.2rem' }}>{lead.requirement || 'Standard commercial requirement.'}</div>
            </div>

            {lead.notes && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Internal Notes</div>
                <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.2rem' }}>{lead.notes}</div>
              </div>
            )}
          </div>
        </div>

        {/* Financial & Qualification Summary Side Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem' }}>Budget & Timeline</h3>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Available Budget</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>
                ${(lead.budget || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            {lead.expected_closing_date && (
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Expected Closing Date</div>
                <div style={{ fontSize: '1rem', fontWeight: 500, color: '#f59e0b', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={16} /> {new Date(lead.expected_closing_date).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          {/* Qualification Status Badges */}
          <div className="glass-card">
            <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: 0, marginBottom: '0.75rem' }}>Qualification Checklist:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(15,23,42,0.6)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.85rem' }}>Requirement Confirmed</span>
                <span className={`tag-badge ${lead.requirement_confirmed ? 'tag-success' : 'tag-secondary'}`}>{lead.requirement_confirmed ? 'YES' : 'NO'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(15,23,42,0.6)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.85rem' }}>Budget Available</span>
                <span className={`tag-badge ${lead.budget_available ? 'tag-success' : 'tag-secondary'}`}>{lead.budget_available ? 'YES' : 'NO'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(15,23,42,0.6)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.85rem' }}>Decision Maker Identified</span>
                <span className={`tag-badge ${lead.decision_maker_identified ? 'tag-success' : 'tag-secondary'}`}>{lead.decision_maker_identified ? 'YES' : 'NO'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Follow-ups & Site Visits Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Follow-ups Section */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Phone color="#38bdf8" size={20} /> Scheduled Follow-ups
            </h3>
            <button className="btn btn-primary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => setShowFollowupModal(true)}>
              <Plus size={14} /> Schedule Follow-up
            </button>
          </div>

          {lead.followups.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>No follow-ups logged yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {lead.followups.map(f => (
                <div key={f.id} style={{ background: 'rgba(15,23,42,0.6)', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: '3px solid #38bdf8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="tag-badge tag-info">{f.followup_type}</span>
                    <span className="tag-badge tag-secondary">{new Date(f.followup_date).toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#f8fafc', margin: '0.4rem 0 0.2rem 0' }}>{f.notes || 'No notes added'}</p>
                  {f.next_action && <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>Next Action: {f.next_action}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Site Visits Section */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin color="#f59e0b" size={20} /> Property Site Visits
            </h3>
            <button className="btn btn-primary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => setShowVisitModal(true)}>
              <Plus size={14} /> Schedule Site Visit
            </button>
          </div>

          {lead.site_visits.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>No site visits scheduled yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {lead.site_visits.map(sv => (
                <div key={sv.id} style={{ background: 'rgba(15,23,42,0.6)', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: '3px solid #f59e0b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>{sv.property_name || 'Property Visit'}</span>
                    <span className="tag-badge tag-warning">{new Date(sv.visit_date).toLocaleString()}</span>
                  </div>
                  {sv.customer_feedback && <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: '0.4rem 0 0.2rem 0' }}>Feedback: {sv.customer_feedback}</p>}
                  <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.2rem' }}>Interest Level: {sv.interest_level}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity Timeline Section */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock color="#818cf8" size={22} /> ACTIVITY TIMELINE
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '2px solid rgba(255,255,255,0.08)', paddingLeft: '1.25rem', marginLeft: '0.5rem' }}>
          {lead.activities.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No activity records logged.</p>
          ) : (
            lead.activities.map(act => (
              <div key={act.id} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '-1.65rem', top: '0.2rem', width: '10px', height: '10px', background: '#818cf8', borderRadius: '9999px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="tag-badge tag-info" style={{ fontSize: '0.75rem' }}>{act.activity_type}</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(act.created_at).toLocaleString()}</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#f8fafc', marginTop: '0.25rem' }}>{act.description}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Schedule Follow-up Modal */}
      {showFollowupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Schedule Follow-up Task</h3>
            <form onSubmit={handleCreateFollowup}>
              <div className="form-group">
                <label>Follow-up Date & Time <span style={{ color: '#f43f5e' }}>*</span></label>
                <input required type="datetime-local" className="form-control" value={followupForm.followup_date} onChange={e => setFollowupForm({ ...followupForm, followup_date: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Follow-up Type</label>
                  <select className="form-control" value={followupForm.followup_type} onChange={e => setFollowupForm({ ...followupForm, followup_type: e.target.value })}>
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-control" value={followupForm.status} onChange={e => setFollowupForm({ ...followupForm, status: e.target.value })}>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Discussion Notes</label>
                <textarea className="form-control" rows="2" placeholder="Discussion topics..." value={followupForm.notes} onChange={e => setFollowupForm({ ...followupForm, notes: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Next Action Required</label>
                <input type="text" className="form-control" placeholder="Send pricing proposal..." value={followupForm.next_action} onChange={e => setFollowupForm({ ...followupForm, next_action: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowFollowupModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Follow-up</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Site Visit Modal */}
      {showVisitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '500px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Schedule Site Visit</h3>
            <form onSubmit={handleCreateSiteVisit}>
              <div className="form-group">
                <label>Target Property</label>
                <select className="form-control" value={visitForm.property_id} onChange={e => setVisitForm({ ...visitForm, property_id: e.target.value })}>
                  <option value="">-- Select Property --</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.code}: {p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Visit Date & Time <span style={{ color: '#f43f5e' }}>*</span></label>
                <input required type="datetime-local" className="form-control" value={visitForm.visit_date} onChange={e => setVisitForm({ ...visitForm, visit_date: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Interest Level</label>
                  <select className="form-control" value={visitForm.interest_level} onChange={e => setVisitForm({ ...visitForm, interest_level: e.target.value })}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-control" value={visitForm.status} onChange={e => setVisitForm({ ...visitForm, status: e.target.value })}>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Customer Feedback (If completed)</label>
                <textarea className="form-control" rows="2" placeholder="Impressed with floor layout & parking..." value={visitForm.customer_feedback} onChange={e => setVisitForm({ ...visitForm, customer_feedback: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowVisitModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Site Visit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Qualification Modal */}
      {showQualifyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem', color: '#10b981' }}>Lead Qualification Checklist</h3>
            <form onSubmit={handleQualifyLead}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={qualifyForm.requirement_confirmed} onChange={e => setQualifyForm({ ...qualifyForm, requirement_confirmed: e.target.checked })} />
                  <span>1. Specific Space & Unit Requirement Confirmed</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={qualifyForm.budget_available} onChange={e => setQualifyForm({ ...qualifyForm, budget_available: e.target.checked })} />
                  <span>2. Financial Budget & Funding Source Verified</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={qualifyForm.decision_maker_identified} onChange={e => setQualifyForm({ ...qualifyForm, decision_maker_identified: e.target.checked })} />
                  <span>3. Key Decision Maker & Sign-off Authority Identified</span>
                </label>
              </div>

              <div className="form-group">
                <label>Qualification Summary Notes</label>
                <textarea className="form-control" rows="3" placeholder="Lead meets all qualification criteria and is ready for site visit / negotiation..." value={qualifyForm.qualification_notes} onChange={e => setQualifyForm({ ...qualifyForm, qualification_notes: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowQualifyModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#10b981', borderColor: '#059669' }}>Confirm Lead Qualification</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Lead to Customer Confirmation Modal */}
      {showConvertModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1rem', color: '#10b981' }}>Convert Lead to Customer Account</h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
              Are you sure you want to convert <strong>{lead.customer_name}</strong> ({lead.company || 'Individual Buyer'}) into a Customer Account?
            </p>
            <div style={{ background: 'rgba(15,23,42,0.6)', padding: '0.9rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
              • Creates active Customer Record in MySQL<br />
              • Auto-generates unique Customer Code (CUST-XXXX)<br />
              • Updates Lead Stage to <strong>CONVERTED</strong><br />
              • Preserves Lead-to-Customer source link
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowConvertModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" style={{ background: '#10b981', borderColor: '#059669' }} onClick={handleConfirmConvert} disabled={converting}>
                {converting ? "Converting..." : "Convert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
