import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, Filter, ArrowLeft, Eye, Edit3, MapPin, CheckCircle2, ChevronRight } from 'lucide-react';
import { propertyService, projectService } from '../services/api';

export default function Properties() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlProjectId = searchParams.get('projectId');

  const [properties, setProperties] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId || '');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProp, setEditingProp] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    property_type: 'Commercial',
    project_id: urlProjectId || '',
    location: '',
    status: 'Active',
    address: '',
    city: '',
    state: '',
    pincode: '',
    description: '',
    total_buildings: 0
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      projectService.getProjects(),
      propertyService.getProperties(selectedProjectId || null, statusFilter === 'All' ? null : statusFilter)
    ])
      .then(([projRes, propRes]) => {
        setProjects(projRes.data);
        setProperties(propRes.data);
      })
      .catch((err) => console.error("Error loading property data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [selectedProjectId, statusFilter]);

  const currentProject = projects.find(p => p.id === parseInt(selectedProjectId));

  const handleOpenAddModal = () => {
    setEditingProp(null);
    setFormData({
      name: '',
      code: '',
      property_type: 'Commercial',
      project_id: selectedProjectId || (projects.length > 0 ? projects[0].id : ''),
      location: currentProject ? currentProject.location : '',
      status: 'Active',
      address: '',
      city: '',
      state: '',
      pincode: '',
      description: '',
      total_buildings: 0
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (p, e) => {
    e.stopPropagation();
    setEditingProp(p);
    setFormData({
      name: p.name || '',
      code: p.code || '',
      property_type: p.property_type || 'Commercial',
      project_id: p.project_id || '',
      location: p.location || '',
      status: p.status || 'Active',
      address: p.address || '',
      city: p.city || '',
      state: p.state || '',
      pincode: p.pincode || '',
      description: p.description || '',
      total_buildings: p.total_buildings || 0
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.property_type || !formData.location || !formData.status) {
      alert("Please fill in all required fields (Name, Type, Location, Status).");
      return;
    }

    const payload = {
      ...formData,
      project_id: formData.project_id ? parseInt(formData.project_id) : null,
      total_buildings: parseInt(formData.total_buildings || 0)
    };

    if (editingProp) {
      propertyService.updateProperty(editingProp.id, payload)
        .then(() => {
          setShowModal(false);
          loadData();
        })
        .catch((err) => alert(err.response?.data?.detail || "Failed to update property"));
    } else {
      propertyService.createProperty(payload)
        .then(() => {
          setShowModal(false);
          loadData();
        })
        .catch((err) => alert(err.response?.data?.detail || "Failed to create property"));
    }
  };

  const filteredProperties = properties.filter(p => {
    const query = searchQuery.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.code && p.code.toLowerCase().includes(query)) ||
      (p.location && p.location.toLowerCase().includes(query)) ||
      (p.property_type && p.property_type.toLowerCase().includes(query))
    );
  });

  return (
    <div className="content-page">
      {/* Navigation & Context Banner */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {selectedProjectId ? (
            <button className="btn btn-secondary" onClick={() => navigate(`/projects/${selectedProjectId}`)} style={{ marginBottom: '0.5rem' }}>
              <ArrowLeft size={16} /> Back to Project Details
            </button>
          ) : <div />}

          {/* Breadcrumb Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#94a3b8' }}>
            <span style={{ cursor: 'pointer', color: '#38bdf8' }} onClick={() => navigate('/projects')}>Construction Projects</span>
            <ChevronRight size={14} />
            {currentProject ? (
              <>
                <span style={{ cursor: 'pointer', color: '#38bdf8' }} onClick={() => navigate(`/projects/${currentProject.id}`)}>{currentProject.name}</span>
                <ChevronRight size={14} />
              </>
            ) : null}
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>Property Management</span>
          </div>
        </div>

        {currentProject && (
          <span className="tag-badge tag-info" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
            Project: <strong>{currentProject.name}</strong> | {currentProject.code}
          </span>
        )}
      </div>

      {/* Top Action Bar */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Real Estate Property Master</h1>
          <p className="page-subtitle">Manage properties, building structures, and link them to Construction Projects</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAddModal}>
          <Plus size={18} /> Add New Property
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2.4rem' }}
              placeholder="Search properties by name, code, location, or type..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Planning">Planning</option>
              <option value="Under Construction">Under Construction</option>
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div>
            <select className="form-control" value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
              <option value="">All Construction Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Properties Table */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 color="#f59e0b" size={22} /> Property Inventory ({filteredProperties.length})
        </h3>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Property Name & Code</th>
                <th>Property Type</th>
                <th>Linked Construction Project</th>
                <th>Location</th>
                <th>Buildings</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProperties.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                    {loading ? "Loading property records from database..." : "No properties found matching criteria."}
                  </td>
                </tr>
              ) : (
                filteredProperties.map((p) => {
                  const linkedProj = projects.find(proj => proj.id === p.project_id);
                  return (
                    <tr
                      key={p.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/properties/${p.id}${selectedProjectId ? `?projectId=${selectedProjectId}` : ''}`)}
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: '#f8fafc' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>{p.code}</div>
                      </td>
                      <td>
                        <span className="tag-badge tag-info">{p.property_type}</span>
                      </td>
                      <td>
                        {linkedProj ? (
                          <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 500 }}>
                            {linkedProj.code}: {linkedProj.name}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Unlinked</span>
                        )}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
                          <MapPin size={14} color="#06b6d4" /> {p.location || p.address || 'N/A'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, textAlign: 'center' }}>
                        {p.buildings ? p.buildings.length : (p.total_buildings || 0)}
                      </td>
                      <td>
                        <span className={`tag-badge ${
                          p.status === 'Completed' ? 'tag-success' :
                          p.status === 'Active' ? 'tag-info' :
                          p.status === 'Under Construction' ? 'tag-warning' : 'tag-secondary'
                        }`}>
                          {(p.status || 'Active').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => navigate(`/properties/${p.id}${selectedProjectId ? `?projectId=${selectedProjectId}` : ''}`)}
                          >
                            <Eye size={14} /> View Details
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={(e) => handleOpenEditModal(p, e)}
                          >
                            <Edit3 size={14} /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Property Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '560px', background: '#1e293b', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>
              {editingProp ? "Edit Property Record" : "Add Property Master Record"}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Property Name <span style={{ color: '#f43f5e' }}>*</span></label>
                <input required type="text" className="form-control" placeholder="Skyline Business Complex" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Property Type <span style={{ color: '#f43f5e' }}>*</span></label>
                  <select required className="form-control" value={formData.property_type} onChange={e => setFormData({ ...formData, property_type: e.target.value })}>
                    <option value="Commercial">Commercial</option>
                    <option value="Residential">Residential</option>
                    <option value="Mixed Use">Mixed Use</option>
                    <option value="Retail">Retail</option>
                    <option value="Corporate Office">Corporate Office</option>
                    <option value="Mini Mall">Mini Mall</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Construction Project <span style={{ color: '#f43f5e' }}>*</span></label>
                  <select required className="form-control" value={formData.project_id} onChange={e => setFormData({ ...formData, project_id: e.target.value })}>
                    <option value="">-- Select Construction Project --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Site Location / Area <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input required type="text" className="form-control" placeholder="Financial District Plaza, Central Avenue" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Status <span style={{ color: '#f43f5e' }}>*</span></label>
                  <select required className="form-control" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    <option value="Planning">Planning</option>
                    <option value="Under Construction">Under Construction</option>
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Property Code (Optional - Auto-generated if blank)</label>
                <input type="text" className="form-control" placeholder="PROP-SKYLINE" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Street Address (Optional)</label>
                <input type="text" className="form-control" placeholder="700 Financial Way" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>City</label>
                  <input type="text" className="form-control" placeholder="Metropolis" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input type="text" className="form-control" placeholder="State Capital" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Postal Code</label>
                  <input type="text" className="form-control" placeholder="78701" value={formData.pincode} onChange={e => setFormData({ ...formData, pincode: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Description / Notes (Optional)</label>
                <textarea className="form-control" rows="2" placeholder="Prime commercial office complex..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Property</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
