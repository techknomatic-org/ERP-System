import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Key, Plus, Search, Filter, ArrowLeft, Eye, Edit3, Layers, Building2, HardHat, CheckCircle2, AlertOctagon, ChevronRight, DollarSign } from 'lucide-react';
import { unitInventoryService, buildingService, propertyService, projectService } from '../services/api';

export default function Units() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlBuildingId = searchParams.get('buildingId');
  const urlPropertyId = searchParams.get('propertyId');
  const urlProjectId = searchParams.get('projectId');

  const [kpis, setKpis] = useState({ total: 0, available: 0, held: 0, booked: 0, allocated: 0, sold: 0, blocked: 0 });
  const [units, setUnits] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [projects, setProjects] = useState([]);

  const [selectedProjectId, setSelectedProjectId] = useState(urlProjectId || '');
  const [selectedPropertyId, setSelectedPropertyId] = useState(urlPropertyId || '');
  const [selectedBuildingId, setSelectedBuildingId] = useState(urlBuildingId || '');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [unitTypeFilter, setUnitTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);

  const [formData, setFormData] = useState({
    unit_number: '',
    unit_code: '',
    building_id: urlBuildingId || '',
    unit_type: 'Office',
    floor_number: 1,
    area_sqft: '',
    carpet_area: '',
    builtup_area: '',
    facing: 'North',
    configuration: '',
    rate_per_sqft: '',
    total_price: '',
    status: 'AVAILABLE',
    description: ''
  });

  const loadData = () => {
    setLoading(true);
    const params = {};
    if (selectedBuildingId) params.building_id = selectedBuildingId;
    else if (selectedPropertyId) params.property_id = selectedPropertyId;
    else if (selectedProjectId) params.project_id = selectedProjectId;

    if (statusFilter !== 'ALL') params.status = statusFilter;
    if (unitTypeFilter !== 'ALL') params.unit_type = unitTypeFilter;

    Promise.all([
      unitInventoryService.getKpis(),
      unitInventoryService.getUnits(params),
      buildingService.getBuildings(selectedPropertyId || null),
      propertyService.getProperties(selectedProjectId || null),
      projectService.getProjects()
    ])
      .then(([kpiRes, unitRes, bldRes, propRes, projRes]) => {
        setKpis(kpiRes.data);
        setUnits(unitRes.data);
        setBuildings(bldRes.data);
        setProperties(propRes.data);
        setProjects(projRes.data);
      })
      .catch((err) => console.error("Error loading units:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [selectedProjectId, selectedPropertyId, selectedBuildingId, statusFilter, unitTypeFilter]);

  const currentBuilding = buildings.find(b => b.id === parseInt(selectedBuildingId));
  const currentProperty = properties.find(p => p.id === (currentBuilding?.property_id || parseInt(selectedPropertyId)));
  const currentProject = projects.find(p => p.id === (currentProperty?.project_id || parseInt(selectedProjectId)));

  const handleOpenAddModal = () => {
    setEditingUnit(null);
    setFormData({
      unit_number: '',
      unit_code: '',
      building_id: selectedBuildingId || (buildings.length > 0 ? buildings[0].id : ''),
      unit_type: 'Office',
      floor_number: 1,
      area_sqft: '',
      carpet_area: '',
      builtup_area: '',
      facing: 'North',
      configuration: '',
      rate_per_sqft: '',
      total_price: '',
      status: 'AVAILABLE',
      description: ''
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (u, e) => {
    e.stopPropagation();
    setEditingUnit(u);
    setFormData({
      unit_number: u.unit_number || '',
      unit_code: u.unit_code || '',
      building_id: u.building_id || '',
      unit_type: u.unit_type || 'Office',
      floor_number: u.floor_number || 1,
      area_sqft: u.area_sqft || '',
      carpet_area: u.carpet_area || '',
      builtup_area: u.builtup_area || '',
      facing: u.facing || 'North',
      configuration: u.configuration || '',
      rate_per_sqft: u.rate_per_sqft || '',
      total_price: u.total_price || '',
      status: u.status || 'AVAILABLE',
      description: u.description || ''
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.unit_number || !formData.building_id || !formData.unit_type || !formData.area_sqft || !formData.status) {
      alert("Please fill in all required fields (Unit Number, Building, Type, Area, Status).");
      return;
    }

    const payload = {
      building_id: parseInt(formData.building_id),
      unit_number: formData.unit_number,
      unit_code: formData.unit_code || undefined,
      unit_type: formData.unit_type,
      floor_number: parseInt(formData.floor_number || 1),
      area_sqft: parseFloat(formData.area_sqft),
      carpet_area: formData.carpet_area ? parseFloat(formData.carpet_area) : undefined,
      builtup_area: formData.builtup_area ? parseFloat(formData.builtup_area) : undefined,
      facing: formData.facing || undefined,
      configuration: formData.configuration || undefined,
      rate_per_sqft: formData.rate_per_sqft ? parseFloat(formData.rate_per_sqft) : 0,
      total_price: formData.total_price ? parseFloat(formData.total_price) : 0,
      status: formData.status,
      description: formData.description || undefined
    };

    if (editingUnit) {
      unitInventoryService.updateUnit(editingUnit.id, payload)
        .then(() => {
          setShowModal(false);
          loadData();
        })
        .catch((err) => alert(err.response?.data?.detail || "Failed to update unit"));
    } else {
      unitInventoryService.createUnit(payload)
        .then(() => {
          setShowModal(false);
          loadData();
        })
        .catch((err) => alert(err.response?.data?.detail || "Failed to create unit"));
    }
  };

  const filteredUnits = units.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      (u.unit_number && u.unit_number.toLowerCase().includes(q)) ||
      (u.unit_code && u.unit_code.toLowerCase().includes(q)) ||
      (u.building_name && u.building_name.toLowerCase().includes(q)) ||
      (u.property_name && u.property_name.toLowerCase().includes(q))
    );
  });

  const getStatusTagClass = (st) => {
    switch ((st || '').toUpperCase()) {
      case 'AVAILABLE': return 'tag-success';
      case 'HELD': return 'tag-warning';
      case 'BOOKED': return 'tag-info';
      case 'ALLOCATED': return 'tag-purple';
      case 'SOLD': return 'tag-danger';
      case 'BLOCKED': return 'tag-secondary';
      default: return 'tag-info';
    }
  };

  return (
    <div className="content-page">
      {/* Navigation Header & Context Banner */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {urlBuildingId ? (
            <button className="btn btn-secondary" onClick={() => navigate(`/properties/${urlPropertyId || ''}${urlProjectId ? `?projectId=${urlProjectId}` : ''}`)} style={{ marginBottom: '0.5rem' }}>
              <ArrowLeft size={16} /> Back to Building
            </button>
          ) : urlPropertyId ? (
            <button className="btn btn-secondary" onClick={() => navigate(`/properties/${urlPropertyId}${urlProjectId ? `?projectId=${urlProjectId}` : ''}`)} style={{ marginBottom: '0.5rem' }}>
              <ArrowLeft size={16} /> Back to Property Details
            </button>
          ) : urlProjectId ? (
            <button className="btn btn-secondary" onClick={() => navigate(`/projects/${urlProjectId}`)} style={{ marginBottom: '0.5rem' }}>
              <ArrowLeft size={16} /> Back to Project Details
            </button>
          ) : <div />}

          {/* Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#94a3b8' }}>
            <span style={{ cursor: 'pointer', color: '#38bdf8' }} onClick={() => navigate('/projects')}>Construction Projects</span>
            <ChevronRight size={14} />
            {currentProject && (
              <>
                <span style={{ cursor: 'pointer', color: '#38bdf8' }} onClick={() => navigate(`/projects/${currentProject.id}`)}>{currentProject.name}</span>
                <ChevronRight size={14} />
              </>
            )}
            {currentProperty && (
              <>
                <span style={{ cursor: 'pointer', color: '#38bdf8' }} onClick={() => navigate(`/properties/${currentProperty.id}${urlProjectId ? `?projectId=${urlProjectId}` : ''}`)}>{currentProperty.name}</span>
                <ChevronRight size={14} />
              </>
            )}
            {currentBuilding && (
              <>
                <span>{currentBuilding.name}</span>
                <ChevronRight size={14} />
              </>
            )}
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>Unit Inventory</span>
          </div>
        </div>

        {(currentProject || currentProperty || currentBuilding) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
            {currentProject && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Project: <strong style={{ color: '#38bdf8' }}>{currentProject.name}</strong></span>}
            {currentProperty && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Property: <strong style={{ color: '#f59e0b' }}>{currentProperty.name}</strong></span>}
            {currentBuilding && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Building: <strong style={{ color: '#10b981' }}>{currentBuilding.name}</strong></span>}
          </div>
        )}
      </div>

      {/* Page Title & Action */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Unit Inventory Management</h1>
          <p className="page-subtitle">Real-time unit availability, floor plan allocation, pricing, and lifecycle status tracking</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAddModal}>
          <Plus size={18} /> Add New Unit
        </button>
      </div>

      {/* Inventory Live KPI Summary Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Units</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>{kpis.total}</div>
        </div>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center', borderTop: '3px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Available</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>{kpis.available}</div>
        </div>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center', borderTop: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Held</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b', marginTop: '0.2rem' }}>{kpis.held}</div>
        </div>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center', borderTop: '3px solid #06b6d4' }}>
          <div style={{ fontSize: '0.75rem', color: '#06b6d4' }}>Booked</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#06b6d4', marginTop: '0.2rem' }}>{kpis.booked}</div>
        </div>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center', borderTop: '3px solid #818cf8' }}>
          <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>Allocated</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#818cf8', marginTop: '0.2rem' }}>{kpis.allocated}</div>
        </div>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center', borderTop: '3px solid #f43f5e' }}>
          <div style={{ fontSize: '0.75rem', color: '#f43f5e' }}>Sold</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f43f5e', marginTop: '0.2rem' }}>{kpis.sold}</div>
        </div>
        <div className="glass-card" style={{ padding: '0.9rem', textAlign: 'center', borderTop: '3px solid #64748b' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Blocked</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#94a3b8', marginTop: '0.2rem' }}>{kpis.blocked}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2.4rem' }}
              placeholder="Search by unit number, code, building..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="HELD">HELD</option>
              <option value="BOOKED">BOOKED</option>
              <option value="ALLOCATED">ALLOCATED</option>
              <option value="SOLD">SOLD</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </div>

          <div>
            <select className="form-control" value={unitTypeFilter} onChange={e => setUnitTypeFilter(e.target.value)}>
              <option value="ALL">All Unit Types</option>
              <option value="Office">Office</option>
              <option value="Retail Shop">Retail Shop</option>
              <option value="Commercial Space">Commercial Space</option>
              <option value="Apartment">Apartment</option>
              <option value="Warehouse">Warehouse</option>
              <option value="Corporate Office">Corporate Office</option>
            </select>
          </div>

          <div>
            <select className="form-control" value={selectedBuildingId} onChange={e => setSelectedBuildingId(e.target.value)}>
              <option value="">All Buildings</option>
              {buildings.map(b => (
                <option key={b.id} value={b.id}>{b.code}: {b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Units Table */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Key color="#10b981" size={22} /> Unit Master Records ({filteredUnits.length})
        </h3>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Unit Number & Code</th>
                <th>Project / Property / Building</th>
                <th>Unit Type</th>
                <th>Floor</th>
                <th>Area (sq.ft)</th>
                <th>Base Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                    {loading ? "Loading unit inventory from database..." : "No units found matching criteria."}
                  </td>
                </tr>
              ) : (
                filteredUnits.map((u) => (
                  <tr
                    key={u.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/units/${u.id}${urlBuildingId ? `?buildingId=${urlBuildingId}` : ''}${urlPropertyId ? `&propertyId=${urlPropertyId}` : ''}${urlProjectId ? `&projectId=${urlProjectId}` : ''}`)}
                  >
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{u.unit_number}</div>
                      <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>{u.unit_code || `UNIT-${u.id}`}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>{u.building_name || 'Building'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{u.property_name} | {u.project_name}</div>
                    </td>
                    <td><span className="tag-badge tag-info">{u.unit_type}</span></td>
                    <td style={{ fontWeight: 600 }}>Floor {u.floor_number}</td>
                    <td>{u.area_sqft} sq.ft</td>
                    <td style={{ fontWeight: 700, color: '#10b981' }}>
                      ${(u.total_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`tag-badge ${getStatusTagClass(u.status)}`}>
                        {u.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => navigate(`/units/${u.id}${urlBuildingId ? `?buildingId=${urlBuildingId}` : ''}`)}
                        >
                          <Eye size={14} /> View
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={(e) => handleOpenEditModal(u, e)}
                        >
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

      {/* Add / Edit Unit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '560px', background: '#1e293b', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>
              {editingUnit ? `Edit Unit: ${editingUnit.unit_number}` : "Create New Inventory Unit"}
            </h3>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Unit Number / Name <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input required type="text" className="form-control" placeholder="Office 501" value={formData.unit_number} onChange={e => setFormData({ ...formData, unit_number: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Building <span style={{ color: '#f43f5e' }}>*</span></label>
                  <select required className="form-control" value={formData.building_id} onChange={e => setFormData({ ...formData, building_id: e.target.value })}>
                    <option value="">-- Select Building --</option>
                    {buildings.map(b => (
                      <option key={b.id} value={b.id}>{b.code}: {b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Unit Type <span style={{ color: '#f43f5e' }}>*</span></label>
                  <select required className="form-control" value={formData.unit_type} onChange={e => setFormData({ ...formData, unit_type: e.target.value })}>
                    <option value="Office">Office</option>
                    <option value="Retail Shop">Retail Shop</option>
                    <option value="Commercial Space">Commercial Space</option>
                    <option value="Apartment">Apartment</option>
                    <option value="Warehouse">Warehouse</option>
                    <option value="Corporate Office">Corporate Office</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Floor Level <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input required type="number" min="0" className="form-control" placeholder="5" value={formData.floor_number} onChange={e => setFormData({ ...formData, floor_number: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Super Area (sq.ft) <span style={{ color: '#f43f5e' }}>*</span></label>
                  <input required type="number" step="0.01" className="form-control" placeholder="2500" value={formData.area_sqft} onChange={e => setFormData({ ...formData, area_sqft: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Carpet Area (sq.ft)</label>
                  <input type="number" step="0.01" className="form-control" placeholder="2000" value={formData.carpet_area} onChange={e => setFormData({ ...formData, carpet_area: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Built-up Area (sq.ft)</label>
                  <input type="number" step="0.01" className="form-control" placeholder="2200" value={formData.builtup_area} onChange={e => setFormData({ ...formData, builtup_area: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Rate per sq.ft ($)</label>
                  <input type="number" step="0.01" className="form-control" placeholder="180" value={formData.rate_per_sqft} onChange={e => setFormData({ ...formData, rate_per_sqft: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Base Price ($)</label>
                  <input type="number" step="0.01" className="form-control" placeholder="450000" value={formData.total_price} onChange={e => setFormData({ ...formData, total_price: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Status <span style={{ color: '#f43f5e' }}>*</span></label>
                  <select required className="form-control" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="HELD">HELD</option>
                    <option value="BOOKED">BOOKED</option>
                    <option value="ALLOCATED">ALLOCATED</option>
                    <option value="SOLD">SOLD</option>
                    <option value="BLOCKED">BLOCKED</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Facing Direction</label>
                  <select className="form-control" value={formData.facing} onChange={e => setFormData({ ...formData, facing: e.target.value })}>
                    <option value="North">North</option>
                    <option value="East">East</option>
                    <option value="West">West</option>
                    <option value="South">South</option>
                    <option value="North-East">North-East</option>
                    <option value="South-East">South-East</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Configuration</label>
                  <input type="text" className="form-control" placeholder="Corner Executive Suite" value={formData.configuration} onChange={e => setFormData({ ...formData, configuration: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Unit Code (Optional - Auto-generated if blank)</label>
                <input type="text" className="form-control" placeholder="U-BLD-TOWER-A-501" value={formData.unit_code} onChange={e => setFormData({ ...formData, unit_code: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Description / Features (Optional)</label>
                <textarea className="form-control" rows="2" placeholder="High floor unit with road view..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Unit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
