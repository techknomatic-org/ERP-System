import React, { useEffect, useState } from 'react';
import { ShieldAlert, Plus, CheckCircle2, AlertOctagon, RefreshCw } from 'lucide-react';
import { qualityService, projectService } from '../services/api';

export default function QualityControl() {
  const [inspections, setInspections] = useState([]);
  const [ncrs, setNcrs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    project_id: '',
    inspection_type: 'Concrete Core Strength Test',
    result: 'passed',
    remarks: ''
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      qualityService.getInspections(),
      qualityService.getNcrs(),
      projectService.getProjects()
    ])
      .then(([inspRes, ncrRes, prjRes]) => {
        setInspections(inspRes.data);
        setNcrs(ncrRes.data);
        setProjects(prjRes.data);
        if (prjRes.data.length > 0) {
          setFormData(f => ({ ...f, project_id: prjRes.data[0].id }));
        }
      })
      .catch((err) => console.error("Error loading quality control data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateInspection = (e) => {
    e.preventDefault();
    qualityService.createInspection({
      project_id: parseInt(formData.project_id),
      inspection_type: formData.inspection_type,
      result: formData.result,
      remarks: formData.remarks
    })
      .then(() => {
        setShowModal(false);
        setFormData({ project_id: projects[0]?.id || '', inspection_type: 'Concrete Core Strength Test', result: 'passed', remarks: '' });
        loadData();
      })
      .catch((err) => alert("Failed to log QC inspection"));
  };

  const handleStatusChange = (ncrId, newStatus) => {
    qualityService.updateNcrStatus(ncrId, newStatus)
      .then(() => loadData());
  };

  return (
    <div className="content-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Quality Control & Non-Conformance (NCR) Engine</h1>
          <p className="page-subtitle">Site Quality Control Inspections: Auto-triggers Quality NCR on inspection failure</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Record QC Inspection
        </button>
      </div>

      {/* Auto-Triggered NCR Banner Alert */}
      {ncrs.filter(n => n.status === 'open').length > 0 && (
        <div className="glass-card" style={{ marginBottom: '1.5rem', background: 'rgba(244,63,94,0.1)', borderColor: 'rgba(244,63,94,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertOctagon size={24} color="#f43f5e" />
            <div>
              <strong style={{ color: '#fca5a5', fontSize: '0.95rem' }}>CRITICAL QUALITY NCRs ACTION REQUIRED</strong>
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                There are <strong>{ncrs.filter(n => n.status === 'open').length} Open Non-Conformance Reports (NCR)</strong> triggered from failed QC inspections. Work on affected structural zones must be re-inspected before proceeding.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Non-Conformance Reports (NCR) Feed */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.25rem' }}>Non-Conformance Reports (NCR) Triggered</h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>NCR Ref #</th>
                <th>Project ID</th>
                <th>Non-Conformance Summary</th>
                <th>Severity</th>
                <th>Required Remediation Action</th>
                <th>Disposition Status</th>
              </tr>
            </thead>
            <tbody>
              {ncrs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '2.5rem' }}>
                    {loading ? "Loading NCRs..." : "No Quality Non-Conformance Reports recorded."}
                  </td>
                </tr>
              ) : (
                ncrs.map((ncr) => (
                  <tr key={ncr.id}>
                    <td style={{ fontWeight: 600, color: '#f43f5e' }}>{ncr.ncr_code}</td>
                    <td>Project #{ncr.project_id}</td>
                    <td style={{ fontWeight: 500, maxWidth: '280px' }}>{ncr.description}</td>
                    <td>
                      <span className={`tag-badge ${ncr.severity === 'critical' ? 'tag-danger' : 'tag-warning'}`}>
                        {ncr.severity.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#cbd5e1', maxWidth: '300px' }}>{ncr.required_action}</td>
                    <td>
                      <select 
                        className="form-control" 
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: ncr.status === 'closed' ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)' }}
                        value={ncr.status} 
                        onChange={e => handleStatusChange(ncr.id, e.target.value)}
                      >
                        <option value="open">OPEN (Work Stopped)</option>
                        <option value="reworked">REWORKED (Pending QC)</option>
                        <option value="verified">VERIFIED</option>
                        <option value="closed">CLOSED</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quality Control Inspections Log */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '1.25rem' }}>QC Inspection Log History</h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Inspection Ref #</th>
                <th>Inspection Test Category</th>
                <th>Inspector ID</th>
                <th>Inspection Date</th>
                <th>Result</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((insp) => (
                <tr key={insp.id}>
                  <td style={{ fontWeight: 600, color: '#818cf8' }}>{insp.inspection_code}</td>
                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>{insp.inspection_type}</td>
                  <td>Inspector #{insp.inspector_id}</td>
                  <td>{new Date(insp.inspection_date).toLocaleDateString()}</td>
                  <td>
                    <span className={`tag-badge ${insp.result === 'passed' ? 'tag-success' : 'tag-danger'}`}>
                      {insp.result.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{insp.remarks || 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create QC Inspection Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Record Quality Control (QC) Inspection</h3>
            <form onSubmit={handleCreateInspection}>
              <div className="form-group">
                <label>Select Project</label>
                <select required className="form-control" value={formData.project_id} onChange={e => setFormData({ ...formData, project_id: e.target.value })}>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Inspection Test Category</label>
                <select className="form-control" value={formData.inspection_type} onChange={e => setFormData({ ...formData, inspection_type: e.target.value })}>
                  <option value="Concrete Core Strength Test">Concrete Core Strength Test (M30)</option>
                  <option value="Rebar Tensile Inspection">Rebar Tensile & Spacing Inspection</option>
                  <option value="Structural Steel Welding NDT">Structural Steel Welding NDT</option>
                  <option value="Plumbing & Hydrostatic Pressure Test">Plumbing Hydrostatic Pressure Test</option>
                  <option value="Electrical Insulation Resistance Test">Electrical Insulation Resistance Test</option>
                </select>
              </div>

              <div className="form-group">
                <label>Inspection Result</label>
                <select className="form-control" value={formData.result} onChange={e => setFormData({ ...formData, result: e.target.value })}>
                  <option value="passed">PASSED</option>
                  <option value="failed">FAILED (Auto-Triggers Quality NCR)</option>
                  <option value="conditional">CONDITIONAL APPROVAL</option>
                </select>
              </div>

              <div className="form-group">
                <label>Inspection Notes / Remarks</label>
                <textarea className="form-control" rows="2" placeholder="Cube test strength results, gauge readings..." value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Inspection</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
