import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, ArrowRight, DollarSign, Filter, Layers, UserCheck, Search, Eye, Edit3, Phone, Mail, Calendar, Building2, CheckCircle2, ChevronRight } from 'lucide-react';
import { crmLeadService, propertyService, projectService } from '../services/api';

const PIPELINE_STAGES = [
  { key: 'NEW', label: 'NEW' },
  { key: 'CONTACTED', label: 'CONTACTED' },
  { key: 'QUALIFIED', label: 'QUALIFIED' },
  { key: 'SITE_VISIT', label: 'SITE VISIT' },
  { key: 'NEGOTIATION', label: 'NEGOTIATION' },
  { key: 'BOOKING', label: 'BOOKING' }
];

export default function CrmLeads() {
  const navigate = useNavigate();

  const [kpis, setKpis] = useState({ total: 0, new: 0, contacted: 0, qualified: 0, site_visit: 0, negotiation: 0, booking: 0 });
  const [leads, setLeads] = useState([]);
  const [properties, setProperties] = useState([]);
  const [projects, setProjects] = useState([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban' or 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  const [formData, setFormData] = useState({
    customer_name: '',
    phone: '',
    email: '',
    company: '',
    source: 'Website',
    stage: 'NEW',
    lead_type: 'Individual',
    priority: 'Medium',
    project_id: '',
    property_id: '',
    preferred_unit_type: 'Office',
    budget: '',
    expected_closing_date: '',
    requirement: '',
    notes: ''
  });

  const loadData = () => {
    setLoading(true);
    const params = {};
    if (stageFilter !== 'ALL') params.stage = stageFilter;
    if (sourceFilter !== 'ALL') params.source = sourceFilter;
    if (priorityFilter !== 'ALL') params.priority = priorityFilter;

    Promise.all([
      crmLeadService.getKpis(),
      crmLeadService.getLeads(params),
      propertyService.getProperties(),
      projectService.getProjects()
    ])
      .then(([kpiRes, leadRes, propRes, projRes]) => {
        setKpis(kpiRes.data);
        setLeads(leadRes.data);
        setProperties(propRes.data);
        setProjects(projRes.data);
      })
      .catch((err) => console.error("Error loading CRM lead data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [stageFilter, sourceFilter, priorityFilter]);

  const handleOpenAddModal = () => {
    setEditingLead(null);
    setFormData({
      customer_name: '',
      phone: '',
      email: '',
      company: '',
      source: 'Website',
      stage: 'NEW',
      lead_type: 'Individual',
      priority: 'Medium',
      project_id: '',
      property_id: '',
      preferred_unit_type: 'Office',
      budget: '',
      expected_closing_date: '',
      requirement: '',
      notes: ''
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (l, e) => {
    e.stopPropagation();
    setEditingLead(l);
    setFormData({
      customer_name: l.customer_name || '',
      phone: l.phone || '',
      email: l.email || '',
      company: l.company || '',
      source: l.source || 'Website',
      stage: l.stage || 'NEW',
      lead_type: l.lead_type || 'Individual',
      priority: l.priority || 'Medium',
      project_id: l.project_id || '',
      property_id: l.property_id || '',
      preferred_unit_type: l.preferred_unit_type || 'Office',
      budget: l.budget || '',
      expected_closing_date: l.expected_closing_date ? l.expected_closing_date.split('T')[0] : '',
      requirement: l.requirement || '',
      notes: l.notes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.customer_name || !formData.email || !formData.phone || !formData.source || !formData.stage) {
      alert("Please fill in all required fields (Name, Phone, Email, Source, Stage).");
      return;
    }

    const payload = {
      ...formData,
      project_id: formData.project_id ? parseInt(formData.project_id) : undefined,
      property_id: formData.property_id ? parseInt(formData.property_id) : undefined,
      budget: formData.budget ? parseFloat(formData.budget) : 0,
      expected_closing_date: formData.expected_closing_date ? new Date(formData.expected_closing_date).toISOString() : undefined
    };

    if (editingLead) {
      crmLeadService.updateLead(editingLead.id, payload)
        .then(() => {
          setShowModal(false);
          loadData();
        })
        .catch((err) => alert(err.response?.data?.detail || "Failed to update lead"));
    } else {
      crmLeadService.createLead(payload)
        .then(() => {
          setShowModal(false);
          loadData();
        })
        .catch((err) => alert(err.response?.data?.detail || "Failed to create lead"));
    }
  };

  const handleStageMove = (leadId, currentStage, e) => {
    if (e) e.stopPropagation();
    const stageKeys = PIPELINE_STAGES.map(s => s.key);
    const currIdx = stageKeys.indexOf(currentStage);
    if (currIdx < stageKeys.length - 1) {
      const nextStage = stageKeys[currIdx + 1];
      crmLeadService.updateStage(leadId, nextStage)
        .then(() => loadData());
    }
  };

  const filteredLeads = leads.filter(l => {
    const q = searchQuery.toLowerCase();
    return (
      (l.customer_name && l.customer_name.toLowerCase().includes(q)) ||
      (l.company && l.company.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.phone && l.phone.toLowerCase().includes(q))
    );
  });

  const getPriorityTag = (p) => {
    switch ((p || '').toLowerCase()) {
      case 'critical': return 'tag-danger';
      case 'high': return 'tag-warning';
      case 'medium': return 'tag-info';
      default: return 'tag-secondary';
    }
  };

  return (
    <div className="content-page">
      {/* Top Header Action Bar */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">CRM & Lead Management Pipeline</h1>
          <p className="page-subtitle">Database-driven enquiry acquisition, pipeline stages, follow-ups, and site visits</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className={`btn ${activeTab === 'kanban' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('kanban')}>
            Kanban Board View
          </button>
          <button className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('list')}>
            Table List View
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
            <Plus size={18} /> Register New Lead
          </button>
        </div>
      </div>

      {/* Live CRM KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Leads</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>{kpis.total}</div>
        </div>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center', borderTop: '3px solid #38bdf8' }}>
          <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>NEW</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>{kpis.new}</div>
        </div>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center', borderTop: '3px solid #818cf8' }}>
          <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>CONTACTED</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#818cf8', marginTop: '0.2rem' }}>{kpis.contacted}</div>
        </div>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center', borderTop: '3px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', color: '#10b981' }}>QUALIFIED</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>{kpis.qualified}</div>
        </div>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center', borderTop: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>SITE VISITS</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.2rem' }}>{kpis.site_visit}</div>
        </div>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center', borderTop: '3px solid #c084fc' }}>
          <div style={{ fontSize: '0.75rem', color: '#c084fc' }}>NEGOTIATION</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#c084fc', marginTop: '0.2rem' }}>{kpis.negotiation}</div>
        </div>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center', borderTop: '3px solid #06b6d4' }}>
          <div style={{ fontSize: '0.75rem', color: '#06b6d4' }}>BOOKING</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#06b6d4', marginTop: '0.2rem' }}>{kpis.booking}</div>
        </div>
      </div>

      {/* Visual Pipeline Header Banner */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem', fontWeight: 600 }}>CRM LEAD PIPELINE PROGRESSION:</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {PIPELINE_STAGES.map((st, idx) => (
            <React.Fragment key={st.key}>
              <div
                style={{
                  flex: 1,
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  background: stageFilter === st.key ? 'rgba(99,102,241,0.25)' : 'rgba(15,23,42,0.6)',
                  border: stageFilter === st.key ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}
                onClick={() => setStageFilter(stageFilter === st.key ? 'ALL' : st.key)}
              >
                <div style={{ fontSize: '0.75rem', color: stageFilter === st.key ? '#818cf8' : '#94a3b8', fontWeight: 600 }}>{st.label}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.1rem' }}>
                  {leads.filter(l => (l.stage || '').toUpperCase() === st.key || (st.key === 'SITE_VISIT' && (l.stage || '').toUpperCase() === 'SITE VISIT')).length}
                </div>
              </div>
              {idx < PIPELINE_STAGES.length - 1 && <ChevronRight size={16} color="#64748b" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2.4rem' }}
              placeholder="Search by Lead Name, Company, Phone, or Email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <select className="form-control" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
              <option value="ALL">All Stages</option>
              {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <select className="form-control" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
              <option value="ALL">All Lead Sources</option>
              <option value="Website">Website</option>
              <option value="Walk-in">Walk-in</option>
              <option value="Referral">Referral</option>
              <option value="Advertisement">Advertisement</option>
              <option value="Broker">Broker</option>
              <option value="Social Media">Social Media</option>
              <option value="Campaign">Campaign</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <select className="form-control" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="ALL">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Kanban Board View */}
      {activeTab === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(240px, 1fr))', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
          {PIPELINE_STAGES.map((st) => {
            const stageLeads = filteredLeads.filter(l => (l.stage || '').toUpperCase() === st.key || (st.key === 'SITE_VISIT' && (l.stage || '').toUpperCase() === 'SITE VISIT'));
            return (
              <div key={st.key} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', minHeight: '520px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#f8fafc' }}>{st.label}</strong>
                  <span className="tag-badge tag-info">{stageLeads.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {stageLeads.map((l) => (
                    <div
                      key={l.id}
                      className="glass-card"
                      style={{ padding: '1rem', background: '#1e293b', cursor: 'pointer', borderLeft: `3px solid ${l.priority === 'Critical' ? '#f43f5e' : l.priority === 'High' ? '#f59e0b' : '#38bdf8'}` }}
                      onClick={() => navigate(`/crm/leads/${l.id}`)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600 }}>#{l.id}</span>
                        <span className={`tag-badge ${getPriorityTag(l.priority)}`} style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>{l.priority || 'Medium'}</span>
                      </div>

                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc', marginTop: '0.3rem' }}>{l.customer_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>{l.company || 'Individual Buyer'}</div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.6rem' }}>
                        <span className="tag-badge tag-secondary" style={{ fontSize: '0.7rem' }}>Src: {l.source || 'Website'}</span>
                        {l.preferred_unit_type && <span className="tag-badge tag-info" style={{ fontSize: '0.7rem' }}>{l.preferred_unit_type}</span>}
                      </div>

                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', marginTop: '0.6rem' }}>
                        Budget: ${l.budget.toLocaleString()}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ flex: 1, padding: '0.3rem', fontSize: '0.75rem', justifyContent: 'center' }}
                          onClick={(e) => { e.stopPropagation(); navigate(`/crm/leads/${l.id}`); }}
                        >
                          <Eye size={12} /> View Details
                        </button>
                        {st.key !== 'BOOKING' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', justifyContent: 'center' }}
                            onClick={(e) => handleStageMove(l.id, l.stage, e)}
                            title="Advance to next pipeline stage"
                          >
                            <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table List View */}
      {activeTab === 'list' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users color="#38bdf8" size={22} /> Lead Master Register ({filteredLeads.length})
          </h3>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Lead ID & Name</th>
                  <th>Company</th>
                  <th>Phone & Email</th>
                  <th>Source</th>
                  <th>Priority</th>
                  <th>Stage</th>
                  <th>Budget</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                      {loading ? "Loading CRM lead pipeline..." : "No leads found matching filter criteria."}
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((l) => (
                    <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/crm/leads/${l.id}`)}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{l.customer_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>ID: #{l.id}</div>
                      </td>
                      <td>{l.company || 'Individual'}</td>
                      <td>
                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Phone size={12} color="#06b6d4" /> {l.phone || 'N/A'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Mail size={12} color="#818cf8" /> {l.email}</div>
                      </td>
                      <td><span className="tag-badge tag-secondary">{l.source}</span></td>
                      <td><span className={`tag-badge ${getPriorityTag(l.priority)}`}>{l.priority || 'Medium'}</span></td>
                      <td><span className="tag-badge tag-info">{(l.stage || 'NEW').replace('_', ' ')}</span></td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>${l.budget.toLocaleString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
                          <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => navigate(`/crm/leads/${l.id}`)}>
                            <Eye size={14} /> Details
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={(e) => handleOpenEditModal(l, e)}>
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
      )}

      {/* Add / Edit Lead Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '560px', background: '#1e293b', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>
              {editingLead ? `Edit Lead Record #${editingLead.id}` : "Register New CRM Lead"}
            </h3>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Lead Name <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input required type="text" className="form-control" placeholder="John Doe / TechVentures" value={formData.customer_name} onChange={e => setFormData({ ...formData, customer_name: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Company Name (Optional)</label>
                  <input type="text" className="form-control" placeholder="TechVentures Ltd" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Phone Number <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input required type="text" className="form-control" placeholder="+1 555-0199" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Email Address <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input required type="email" className="form-control" placeholder="contact@company.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Lead Source <span style={{ color: '#f43f5e' }}>*</span></label>
                  <select required className="form-control" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })}>
                    <option value="Website">Website</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Referral">Referral</option>
                    <option value="Advertisement">Advertisement</option>
                    <option value="Broker">Broker</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Campaign">Campaign</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Stage <span style={{ color: '#f43f5e' }}>*</span></label>
                  <select required className="form-control" value={formData.stage} onChange={e => setFormData({ ...formData, stage: e.target.value })}>
                    {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select className="form-control" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Preferred Project (Optional)</label>
                  <select className="form-control" value={formData.project_id} onChange={e => setFormData({ ...formData, project_id: e.target.value })}>
                    <option value="">-- None Selected --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.code}: {p.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Preferred Property (Optional)</label>
                  <select className="form-control" value={formData.property_id} onChange={e => setFormData({ ...formData, property_id: e.target.value })}>
                    <option value="">-- None Selected --</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.code}: {p.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Preferred Unit Type</label>
                  <select className="form-control" value={formData.preferred_unit_type} onChange={e => setFormData({ ...formData, preferred_unit_type: e.target.value })}>
                    <option value="Office">Office</option>
                    <option value="Retail Shop">Retail Shop</option>
                    <option value="Commercial Space">Commercial Space</option>
                    <option value="Apartment">Apartment</option>
                    <option value="Warehouse">Warehouse</option>
                    <option value="Corporate Office">Corporate Office</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Budget Amount ($)</label>
                  <input type="number" step="0.01" className="form-control" placeholder="500000" value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Expected Closing Date</label>
                  <input type="date" className="form-control" value={formData.expected_closing_date} onChange={e => setFormData({ ...formData, expected_closing_date: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Expected Requirement Description</label>
                <textarea className="form-control" rows="2" placeholder="Looking for 2500 sq.ft office space on 5th floor..." value={formData.requirement} onChange={e => setFormData({ ...formData, requirement: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Notes / Follow-up Instructions</label>
                <textarea className="form-control" rows="2" placeholder="Initial enquiry received via website form..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Lead Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
