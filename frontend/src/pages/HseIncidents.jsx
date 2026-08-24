import React, { useEffect, useState } from 'react';
import { ShieldAlert, Plus, AlertTriangle, CheckCircle2, FileText, Activity } from 'lucide-react';
import { hseService, projectService } from '../services/api';

export default function HseIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [capas, setCapas] = useState([]);
  const [audits, setAudits] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    project_id: '',
    incident_type: 'Incident',
    severity: 'medium',
    title: '',
    location: '',
    description: '',
    immediate_action: '',
    root_cause: ''
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      hseService.getIncidents(),
      hseService.getCapas(),
      hseService.getAudits(),
      projectService.getProjects()
    ])
      .then(([incRes, capaRes, audRes, prjRes]) => {
        setIncidents(incRes.data);
        setCapas(capaRes.data);
        setAudits(audRes.data);
        setProjects(prjRes.data);
        if (prjRes.data.length > 0) {
          setFormData(f => ({ ...f, project_id: prjRes.data[0].id }));
        }
      })
      .catch((err) => console.error("Error loading HSE data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateIncident = (e) => {
    e.preventDefault();
    hseService.createIncident({
      project_id: parseInt(formData.project_id),
      incident_type: formData.incident_type,
      severity: formData.severity,
      title: formData.title,
      location: formData.location,
      description: formData.description,
      immediate_action: formData.immediate_action,
      root_cause: formData.root_cause
    })
      .then(() => {
        setShowModal(false);
        setFormData({ project_id: projects[0]?.id || '', incident_type: 'Incident', severity: 'medium', title: '', location: '', description: '', immediate_action: '', root_cause: '' });
        loadData();
      })
      .catch((err) => alert("Failed to log safety report"));
  };

  return (
    <div className="content-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">HSE Safety & CAPA Management</h1>
          <p className="page-subtitle">Incident Reports, Near Misses, CAPA Action Tracker & Digital Safety Audits</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Report Incident / Near Miss
        </button>
      </div>

      {/* Incident Reports Feed */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.25rem' }}>Safety Incidents & Near Miss Log</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {incidents.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
              {loading ? "Loading safety logs..." : "No safety incidents reported."}
            </div>
          ) : (
            incidents.map((inc) => (
              <div key={inc.id} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`tag-badge ${inc.severity === 'high' || inc.severity === 'critical' ? 'tag-danger' : 'tag-warning'}`}>
                      {inc.severity.toUpperCase()} SEVERITY
                    </span>
                    <span className="tag-badge tag-info">{inc.incident_type}</span>
                    <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{inc.title}</strong>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{new Date(inc.incident_date).toLocaleDateString()}</span>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>{inc.description}</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Location: </span>
                    <strong style={{ color: '#38bdf8' }}>{inc.location}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Immediate Action Taken: </span>
                    <span style={{ color: '#fca5a5' }}>{inc.immediate_action || 'None recorded'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CAPA Tracker */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '1.25rem' }}>CAPA Action Tracker (Corrective & Preventive Actions)</h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>CAPA Code</th>
                <th>Root Cause Analysis</th>
                <th>Corrective Action Plan</th>
                <th>Preventive Action Plan</th>
                <th>Target Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {capas.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: '#818cf8' }}>{c.capa_code}</td>
                  <td style={{ fontSize: '0.85rem' }}>{c.root_cause}</td>
                  <td style={{ fontSize: '0.85rem', color: '#fca5a5' }}>{c.corrective_action}</td>
                  <td style={{ fontSize: '0.85rem', color: '#38bdf8' }}>{c.preventive_action}</td>
                  <td>{new Date(c.target_date).toLocaleDateString()}</td>
                  <td>
                    <span className={`tag-badge ${c.status === 'closed' ? 'tag-success' : 'tag-warning'}`}>
                      {c.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Incident Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '520px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Log HSE Incident / Near Miss</h3>
            <form onSubmit={handleCreateIncident}>
              <div className="form-group">
                <label>Select Project</label>
                <select required className="form-control" value={formData.project_id} onChange={e => setFormData({ ...formData, project_id: e.target.value })}>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Type</label>
                  <select className="form-control" value={formData.incident_type} onChange={e => setFormData({ ...formData, incident_type: e.target.value })}>
                    <option value="Incident">Incident</option>
                    <option value="Near Miss">Near Miss</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Severity</label>
                  <select className="form-control" value={formData.severity} onChange={e => setFormData({ ...formData, severity: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Incident Title</label>
                <input required type="text" className="form-control" placeholder="Scaffolding Plank Slipped at Level 4" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Location on Site</label>
                <input required type="text" className="form-control" placeholder="Tower A - West Facade" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Description of Event</label>
                <textarea required className="form-control" rows="2" placeholder="Describe how event occurred..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Immediate Action Taken</label>
                <input type="text" className="form-control" placeholder="Area cordoned off immediately..." value={formData.immediate_action} onChange={e => setFormData({ ...formData, immediate_action: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Report & Alert HSE</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
