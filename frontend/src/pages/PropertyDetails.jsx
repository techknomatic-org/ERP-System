import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Building2, Plus, ArrowLeft, MapPin, Calendar, Layers, ChevronRight, HardHat, CheckCircle2 } from 'lucide-react';
import { propertyService, buildingService, projectService } from '../services/api';

export default function PropertyDetails() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlProjectId = searchParams.get('projectId');

  const [property, setProperty] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuildingModal, setShowBuildingModal] = useState(false);

  const [buildingForm, setBuildingForm] = useState({
    name: '',
    code: '',
    building_type: 'Tower',
    total_floors: 1,
    total_units: 0,
    status: 'Active',
    address: '',
    description: '',
    completion_date: ''
  });

  const loadPropertyDetails = () => {
    setLoading(true);
    Promise.all([
      propertyService.getPropertyById(id),
      buildingService.getBuildings(id),
      projectService.getProjects()
    ])
      .then(([propRes, bldRes, projRes]) => {
        setProperty(propRes.data);
        setBuildings(bldRes.data);
        setProjects(projRes.data);
      })
      .catch((err) => console.error("Error loading Property details:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPropertyDetails();
  }, [id]);

  const currentProject = projects.find(p => p.id === (property?.project_id || parseInt(urlProjectId)));

  const handleCreateBuilding = (e) => {
    e.preventDefault();
    if (!buildingForm.name || !buildingForm.code || !buildingForm.building_type || !buildingForm.status) {
      alert("Please fill in all required fields (Name, Code, Building Type, Status).");
      return;
    }

    buildingService.createBuilding({
      property_id: parseInt(id),
      name: buildingForm.name,
      code: buildingForm.code,
      building_type: buildingForm.building_type,
      total_floors: parseInt(buildingForm.total_floors || 1),
      total_units: parseInt(buildingForm.total_units || 0),
      status: buildingForm.status,
      address: buildingForm.address,
      description: buildingForm.description,
      completion_date: buildingForm.completion_date ? new Date(buildingForm.completion_date).toISOString() : null
    })
      .then(() => {
        setShowBuildingModal(false);
        setBuildingForm({
          name: '',
          code: '',
          building_type: 'Tower',
          total_floors: 1,
          total_units: 0,
          status: 'Active',
          address: '',
          description: '',
          completion_date: ''
        });
        loadPropertyDetails();
      })
      .catch((err) => alert(err.response?.data?.detail || "Failed to create building"));
  };

  if (loading) {
    return (
      <div className="content-page">
        <p style={{ color: '#94a3b8' }}>Loading Property details from database...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="content-page">
        <button className="btn btn-secondary" onClick={() => navigate('/properties')} style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={18} /> Back to Property Management
        </button>
        <p style={{ color: '#f43f5e' }}>Property not found in MySQL database.</p>
      </div>
    );
  }

  return (
    <div className="content-page">
      {/* Top Header Navigation & Context */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {urlProjectId ? (
            <button className="btn btn-secondary" onClick={() => navigate(`/projects/${urlProjectId}`)} style={{ marginBottom: '0.5rem' }}>
              <ArrowLeft size={16} /> Back to Project Details
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => navigate('/properties')} style={{ marginBottom: '0.5rem' }}>
              <ArrowLeft size={16} /> Back to Property Management
            </button>
          )}

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
            <span style={{ cursor: 'pointer', color: '#38bdf8' }} onClick={() => navigate(`/properties${urlProjectId ? `?projectId=${urlProjectId}` : ''}`)}>Property</span>
            <ChevronRight size={14} />
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>{property.name}</span>
          </div>
        </div>

        {currentProject && (
          <span className="tag-badge tag-info" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
            Project: <strong>{currentProject.name}</strong> | {currentProject.code}
          </span>
        )}
      </div>

      {/* Property Overview Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="tag-badge tag-info" style={{ fontSize: '0.85rem' }}>{property.code}</span>
            <h1 className="page-title" style={{ margin: 0 }}>{property.name}</h1>
          </div>
          <p className="page-subtitle" style={{ marginTop: '0.2rem' }}>
            Property Type: <strong>{property.property_type}</strong> | Location: <strong>{property.location || property.address}</strong>
          </p>
        </div>

        <span className={`tag-badge ${property.status === 'Completed' ? 'tag-success' : 'tag-warning'}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
          STATUS: {(property.status || 'ACTIVE').toUpperCase()}
        </span>
      </div>

      {/* Main Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Property Metadata Card */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 color="#f59e0b" size={22} /> Property Core Information
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Property Name</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>{property.name}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Property Code</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#818cf8', marginTop: '0.2rem' }}>{property.code}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Property Type</div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#06b6d4', marginTop: '0.2rem' }}>{property.property_type}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Linked Construction Project</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#38bdf8', marginTop: '0.2rem' }}>
                {currentProject ? `${currentProject.code}: ${currentProject.name}` : "Unlinked"}
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Site Location & Address</div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#cbd5e1', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MapPin size={16} color="#06b6d4" /> {property.location || property.address || 'N/A'}, {property.city || ''} {property.state || ''}
              </div>
            </div>

            {property.description && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Description</div>
                <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.2rem' }}>{property.description}</div>
              </div>
            )}
          </div>
        </div>

        {/* Property Stats Side Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem' }}>Structure Summary</h3>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Buildings</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.2rem' }}>
                {buildings.length}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Property Status</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#10b981', marginTop: '0.2rem' }}>
                {property.status || 'Active'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Buildings Section */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers color="#38bdf8" size={22} /> BUILDINGS IN THIS PROPERTY
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>Building blocks registered under {property.name}</p>
          </div>

          <button className="btn btn-primary" onClick={() => setShowBuildingModal(true)}>
            <Plus size={18} /> Add Building
          </button>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Building Name</th>
                <th>Building Code</th>
                <th>Building Type</th>
                <th>Floors</th>
                <th>Total Units</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {buildings.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                    No buildings have been added to this property yet.
                    <div style={{ marginTop: '0.75rem' }}>
                      <button className="btn btn-secondary" onClick={() => setShowBuildingModal(true)}>
                        <Plus size={16} /> Add First Building
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                buildings.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{b.name}</td>
                    <td><span className="tag-badge tag-info">{b.code}</span></td>
                    <td>{b.building_type || 'Tower'}</td>
                    <td style={{ fontWeight: 600 }}>{b.total_floors} Floors</td>
                    <td style={{ color: '#94a3b8' }}>{b.units ? b.units.length : (b.total_units || 0)} Units</td>
                    <td>
                      <span className={`tag-badge ${
                        b.status === 'Completed' ? 'tag-success' :
                        b.status === 'Active' ? 'tag-info' : 'tag-warning'
                      }`}>
                        {(b.status || 'Active').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                        onClick={() => navigate(`/units?buildingId=${b.id}&propertyId=${property.id}${urlProjectId ? `&projectId=${urlProjectId}` : ''}`)}
                      >
                        + Manage Units ({b.total_units || 0})
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Building Modal */}
      {showBuildingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '520px', background: '#1e293b', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Add Building under {property.name}</h3>

            <form onSubmit={handleCreateBuilding}>
              <div className="form-group">
                <label>Parent Property</label>
                <input disabled type="text" className="form-control" value={`${property.code}: ${property.name}`} style={{ opacity: 0.7 }} />
              </div>

              <div className="form-group">
                <label>Building Name <span style={{ color: '#f43f5e' }}>*</span></label>
                <input required type="text" className="form-control" placeholder="Skyline Tower A" value={buildingForm.name} onChange={e => setBuildingForm({ ...buildingForm, name: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Building Code <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input required type="text" className="form-control" placeholder="BLD-TOWER-A" value={buildingForm.code} onChange={e => setBuildingForm({ ...buildingForm, code: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Building Type <span style={{ color: '#f43f5e' }}>*</span></label>
                  <select required className="form-control" value={buildingForm.building_type} onChange={e => setBuildingForm({ ...buildingForm, building_type: e.target.value })}>
                    <option value="Tower">Tower</option>
                    <option value="Office Building">Office Building</option>
                    <option value="Retail Block">Retail Block</option>
                    <option value="Commercial Building">Commercial Building</option>
                    <option value="Residential Tower">Residential Tower</option>
                    <option value="Mall Block">Mall Block</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Number of Floors <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input required type="number" min="1" className="form-control" placeholder="10" value={buildingForm.total_floors} onChange={e => setBuildingForm({ ...buildingForm, total_floors: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Status <span style={{ color: '#f43f5e' }}>*</span></label>
                  <select required className="form-control" value={buildingForm.status} onChange={e => setBuildingForm({ ...buildingForm, status: e.target.value })}>
                    <option value="Planning">Planning</option>
                    <option value="Under Construction">Under Construction</option>
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description / Notes (Optional)</label>
                <textarea className="form-control" rows="2" placeholder="Executive office wing containing floors 1-10..." value={buildingForm.description} onChange={e => setBuildingForm({ ...buildingForm, description: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBuildingModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Building</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
