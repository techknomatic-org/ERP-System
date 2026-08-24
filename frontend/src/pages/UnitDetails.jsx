import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Key, ArrowLeft, Building2, HardHat, Layers, ChevronRight, DollarSign, MapPin, CheckCircle2 } from 'lucide-react';
import { unitInventoryService } from '../services/api';

export default function UnitDetails() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlBuildingId = searchParams.get('buildingId');
  const urlPropertyId = searchParams.get('propertyId');
  const urlProjectId = searchParams.get('projectId');

  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    unitInventoryService.getUnitById(id)
      .then((res) => setUnit(res.data))
      .catch((err) => console.error("Error loading Unit details:", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="content-page">
        <p style={{ color: '#94a3b8' }}>Loading Unit details from database...</p>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="content-page">
        <button className="btn btn-secondary" onClick={() => navigate('/units')} style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={18} /> Back to Unit Inventory
        </button>
        <p style={{ color: '#f43f5e' }}>Unit record not found in MySQL database.</p>
      </div>
    );
  }

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
      {/* Top Header Navigation & Hierarchy Breadcrumbs */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {urlBuildingId ? (
            <button className="btn btn-secondary" onClick={() => navigate(`/properties/${urlPropertyId || unit.property_id || ''}${urlProjectId ? `?projectId=${urlProjectId}` : ''}`)}>
              <ArrowLeft size={16} /> Back to Building
            </button>
          ) : urlPropertyId ? (
            <button className="btn btn-secondary" onClick={() => navigate(`/properties/${urlPropertyId}${urlProjectId ? `?projectId=${urlProjectId}` : ''}`)}>
              <ArrowLeft size={16} /> Back to Property
            </button>
          ) : urlProjectId ? (
            <button className="btn btn-secondary" onClick={() => navigate(`/projects/${urlProjectId}`)}>
              <ArrowLeft size={16} /> Back to Project Details
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => navigate('/units')}>
              <ArrowLeft size={16} /> Back to Unit Inventory
            </button>
          )}
        </div>

        {/* Complete Hierarchy Path Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#94a3b8' }}>
          <span style={{ cursor: 'pointer', color: '#38bdf8' }} onClick={() => navigate('/projects')}>Construction Projects</span>
          <ChevronRight size={14} />
          {unit.project_name && (
            <>
              <span style={{ cursor: 'pointer', color: '#38bdf8' }} onClick={() => navigate(`/projects/${unit.project_id}`)}>{unit.project_name}</span>
              <ChevronRight size={14} />
            </>
          )}
          {unit.property_name && (
            <>
              <span style={{ cursor: 'pointer', color: '#38bdf8' }} onClick={() => navigate(`/properties/${unit.property_id}`)}>{unit.property_name}</span>
              <ChevronRight size={14} />
            </>
          )}
          {unit.building_name && (
            <>
              <span>{unit.building_name}</span>
              <ChevronRight size={14} />
            </>
          )}
          <span style={{ color: '#f8fafc', fontWeight: 600 }}>{unit.unit_number}</span>
        </div>
      </div>

      {/* Unit Overview Title */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="tag-badge tag-info" style={{ fontSize: '0.85rem' }}>{unit.unit_code || `UNIT-${unit.id}`}</span>
            <h1 className="page-title" style={{ margin: 0 }}>{unit.unit_number}</h1>
          </div>
          <p className="page-subtitle" style={{ marginTop: '0.2rem' }}>
            Building: <strong>{unit.building_name || 'N/A'}</strong> | Property: <strong>{unit.property_name || 'N/A'}</strong> | Project: <strong>{unit.project_name || 'N/A'}</strong>
          </p>
        </div>

        <span className={`tag-badge ${getStatusTagClass(unit.status)}`} style={{ fontSize: '0.95rem', padding: '0.45rem 0.9rem' }}>
          STATUS: {(unit.status || 'AVAILABLE').toUpperCase()}
        </span>
      </div>

      {/* Main Grid Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Core Unit Specs Card */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key color="#10b981" size={22} /> Unit Technical Specifications & Dimensions
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Unit Number / Name</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>{unit.unit_number}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Unit Code</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#818cf8', marginTop: '0.2rem' }}>{unit.unit_code || `UNIT-${unit.id}`}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Unit Category / Type</div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#06b6d4', marginTop: '0.2rem' }}>{unit.unit_type}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Floor Level</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.2rem' }}>Floor {unit.floor_number}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Super Area (sq.ft)</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#cbd5e1', marginTop: '0.2rem' }}>{unit.area_sqft} sq.ft</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Carpet Area (sq.ft)</div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#cbd5e1', marginTop: '0.2rem' }}>{unit.carpet_area ? `${unit.carpet_area} sq.ft` : 'N/A'}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Built-up Area (sq.ft)</div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#cbd5e1', marginTop: '0.2rem' }}>{unit.builtup_area ? `${unit.builtup_area} sq.ft` : 'N/A'}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Facing Direction</div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#f59e0b', marginTop: '0.2rem' }}>{unit.facing || 'North'}</div>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Layout Configuration</div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#38bdf8', marginTop: '0.2rem' }}>{unit.configuration || 'Standard Commercial Layout'}</div>
            </div>

            {unit.description && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Unit Description / Features</div>
                <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.2rem' }}>{unit.description}</div>
              </div>
            )}
          </div>
        </div>

        {/* Pricing & Complete Hierarchy Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card">
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign color="#10b981" size={20} /> Financial Pricing
            </h3>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Base Price</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>
                ${(unit.total_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Rate per sq.ft</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#38bdf8', marginTop: '0.2rem' }}>
                ${(unit.rate_per_sqft || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} / sq.ft
              </div>
            </div>
          </div>

          {/* Full Hierarchy Tree Card */}
          <div className="glass-card">
            <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: 0, marginBottom: '0.75rem' }}>Complete Property Tree:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
              <div style={{ padding: '0.5rem', background: 'rgba(15,23,42,0.6)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>1. Project</div>
                <div style={{ fontWeight: 600, color: '#38bdf8' }}>{unit.project_name || 'N/A'}</div>
              </div>
              <div style={{ padding: '0.5rem', background: 'rgba(15,23,42,0.6)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>2. Property</div>
                <div style={{ fontWeight: 600, color: '#f59e0b' }}>{unit.property_name || 'N/A'}</div>
              </div>
              <div style={{ padding: '0.5rem', background: 'rgba(15,23,42,0.6)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>3. Building</div>
                <div style={{ fontWeight: 600, color: '#10b981' }}>{unit.building_name || 'N/A'}</div>
              </div>
              <div style={{ padding: '0.5rem', background: 'rgba(15,23,42,0.6)', borderRadius: '6px', borderLeft: '3px solid #818cf8' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>4. Unit</div>
                <div style={{ fontWeight: 600, color: '#f8fafc' }}>{unit.unit_number} ({unit.status})</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
