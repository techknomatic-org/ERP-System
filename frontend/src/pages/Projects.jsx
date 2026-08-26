import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, Plus, Calendar, MapPin, ArrowRight, Layers, ClipboardList, AlertTriangle, ShoppingCart } from 'lucide-react';
import { projectService } from '../services/api';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [userRole, setUserRole] = useState(localStorage.getItem('erp_role') || 'admin');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    location: '',
    start_date: '',
    end_date: '',
    budget: ''
  });

  const loadProjects = () => {
    setLoading(true);
    const storedRole = localStorage.getItem('erp_role');
    if (storedRole) setUserRole(storedRole);

    projectService.getProjects()
      .then((res) => setProjects(res.data))
      .catch((err) => console.error("Error loading projects:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = (e) => {
    e.preventDefault();
    projectService.createProject({
      ...formData,
      budget: parseFloat(formData.budget),
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString()
    })
      .then(() => {
        setShowModal(false);
        setFormData({ name: '', code: '', location: '', start_date: '', end_date: '', budget: '' });
        loadProjects();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to create project"));
  };

  const isSE = (userRole || '').toLowerCase() === 'site_engineer';

  return (
    <div className="content-page">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">{isSE ? "My Sites" : "Construction Projects"}</h1>
          <p className="page-subtitle">
            {isSE ? "View and execute your assigned construction sites" : "Manage and monitor your assigned construction projects"}
          </p>
        </div>
        {!isSE && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> New Construction Project
          </button>
        )}
      </div>

      {/* Compact Site Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {projects.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            {loading ? "Loading sites..." : "No assigned sites registered."}
          </div>
        ) : (
          projects.map((p) => (
            <div
              key={p.id}
              className="glass-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
                padding: '1.25rem',
                border: '1px solid rgba(255,255,255,0.08)',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div>
                {/* Title & Icon */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      🏗️ {p.name}
                    </h3>
                    <span className="tag-badge tag-info" style={{ marginTop: '0.35rem', display: 'inline-block' }}>{p.code}</span>
                  </div>
                  <span className={`tag-badge ${p.status === 'active' ? 'tag-success' : 'tag-warning'}`} style={{ fontSize: '0.75rem' }}>
                    {p.status ? p.status.toUpperCase() : 'ACTIVE'}
                  </span>
                </div>

                {/* Location & Dates */}
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={14} color="#06b6d4" /> {p.location}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={14} color="#818cf8" /> {new Date(p.start_date).toLocaleDateString()} ──► {new Date(p.end_date).toLocaleDateString()}
                  </span>
                </div>

                {/* Physical Progress */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: '#94a3b8' }}>Physical Progress</span>
                    <strong style={{ color: '#10b981' }}>{p.progress_pct}%</strong>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ width: `${p.progress_pct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #06b6d4)', borderRadius: '9999px' }} />
                  </div>
                </div>

                {/* Site Execution Counts (Requirement 6) */}
                {isSE && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'rgba(15,23,42,0.6)', padding: '0.65rem', borderRadius: '8px', marginBottom: '0.85rem', fontSize: '0.78rem', color: '#cbd5e1' }}>
                    <div>Today's Tasks: <strong style={{ color: '#38bdf8' }}>8</strong></div>
                    <div>Pending Logs: <strong style={{ color: '#f59e0b' }}>1</strong></div>
                    <div>Open Issues: <strong style={{ color: '#ef4444' }}>2</strong></div>
                    <div>Material Requests: <strong style={{ color: '#10b981' }}>1</strong></div>
                  </div>
                )}
              </div>

              {/* Clean Action Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.82rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: isSE ? 'linear-gradient(135deg, #10b981, #059669)' : undefined,
                    borderColor: isSE ? '#059669' : undefined
                  }}
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  <span>{isSE ? "Open Site" : "Open Project"}</span> <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Project Modal */}
      {showModal && !isSE && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Register Construction Project</h3>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label>Project Name</label>
                <input required type="text" className="form-control" placeholder="Riverside Commercial Complex – Phase 2" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Project Code</label>
                <input required type="text" className="form-control" placeholder="PROJ-RIVERSIDE-02" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Site Location</label>
                <input required type="text" className="form-control" placeholder="700 Financial Way, Austin, TX" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Start Date</label>
                  <input required type="date" className="form-control" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Target End Date</label>
                  <input required type="date" className="form-control" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Approved Budget ($)</label>
                <input required type="number" step="0.01" className="form-control" placeholder="4500000" value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
