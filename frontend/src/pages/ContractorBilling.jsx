import React, { useEffect, useState } from 'react';
import { ShieldAlert, Plus, CheckCircle2, AlertTriangle, FileText, Calculator } from 'lucide-react';
import { contractorBillingService, boqMbService, vendorService, projectService } from '../services/api';

export default function ContractorBilling() {
  const [bills, setBills] = useState([]);
  const [projects, setProjects] = useState([]);
  const [boqs, setBoqs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    project_id: '',
    vendor_id: '',
    boq_item_id: '',
    billed_qty: '',
    billed_rate: ''
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      contractorBillingService.getBills(),
      projectService.getProjects(),
      vendorService.getVendors()
    ])
      .then(([billRes, prjRes, vndRes]) => {
        setBills(billRes.data);
        setProjects(prjRes.data);
        setVendors(vndRes.data);
        if (prjRes.data.length > 0) {
          setFormData(f => ({ ...f, project_id: prjRes.data[0].id }));
          boqMbService.getBoqItems(prjRes.data[0].id)
            .then(bRes => setBoqs(bRes.data));
        }
      })
      .catch((err) => console.error("Error loading contractor bills:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProjectChange = (projectId) => {
    setFormData(f => ({ ...f, project_id: projectId, boq_item_id: '' }));
    boqMbService.getBoqItems(projectId)
      .then(bRes => setBoqs(bRes.data));
  };

  const handleSubmitBill = (e) => {
    e.preventDefault();
    contractorBillingService.submitBill({
      project_id: parseInt(formData.project_id),
      vendor_id: parseInt(formData.vendor_id),
      boq_item_id: parseInt(formData.boq_item_id),
      billed_qty: parseFloat(formData.billed_qty),
      billed_rate: parseFloat(formData.billed_rate)
    })
      .then(() => {
        setShowModal(false);
        setFormData({ project_id: projects[0]?.id || '', vendor_id: '', boq_item_id: '', billed_qty: '', billed_rate: '' });
        loadData();
      })
      .catch((err) => alert(err.response?.data?.detail || "Bill verification failed"));
  };

  return (
    <div className="content-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Contractor Billing & 3-Way Match Engine</h1>
          <p className="page-subtitle">Automated 3-Way Verification: BOQ Quantity ↔ MB Quantity ↔ Contractor Bill Quantity</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Submit Contractor Bill
        </button>
      </div>

      {/* Discrepancy Rule Banner */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Calculator size={24} color="#818cf8" />
          <div>
            <strong style={{ color: '#f8fafc', fontSize: '0.95rem' }}>3-Way Verification Rule Logic</strong>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              Bills are automatically verified against site Measurement Book (MB) recordings and approved BOQ ceilings. If <code>Billed Qty &gt; MB Qty</code> or <code>MB Qty &gt; BOQ Qty</code>, a **CRITICAL DISCREPANCY** is flagged.
            </p>
          </div>
        </div>
      </div>

      {/* Bills Data Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Bill Ref #</th>
              <th>BOQ Approved Qty</th>
              <th>MB Verified Qty</th>
              <th>Contractor Billed Qty</th>
              <th>Total Bill Amount</th>
              <th>3-Way Verification Result</th>
              <th>Discrepancy Log</th>
            </tr>
          </thead>
          <tbody>
            {bills.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '2.5rem' }}>
                  {loading ? "Loading contractor bills..." : "No contractor bills submitted."}
                </td>
              </tr>
            ) : (
              bills.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600, color: '#818cf8' }}>{b.bill_number}</td>
                  <td>{b.boq_qty} units</td>
                  <td style={{ fontWeight: 600, color: '#38bdf8' }}>{b.mb_qty} units</td>
                  <td style={{ fontWeight: 700, color: b.discrepancy_flag ? '#f43f5e' : '#10b981' }}>{b.billed_qty} units</td>
                  <td style={{ fontWeight: 700 }}>${b.total_billed_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>
                    {b.discrepancy_flag ? (
                      <span className="tag-badge tag-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <AlertTriangle size={12} /> DISCREPANCY FLAGGED
                      </span>
                    ) : (
                      <span className="tag-badge tag-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CheckCircle2 size={12} /> 3-WAY MATCH VERIFIED
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: b.discrepancy_flag ? '#fca5a5' : '#94a3b8', maxWidth: '300px' }}>
                    {b.discrepancy_reason}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Submit Bill Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '560px', background: '#1e293b', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Contractor Bill Payment Form</h3>
            <form onSubmit={handleSubmitBill}>
              <div className="form-group">
                <label>Select Project</label>
                <select required className="form-control" value={formData.project_id} onChange={e => handleProjectChange(e.target.value)}>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Contractor Name / Vendor</label>
                <select required className="form-control" value={formData.vendor_id} onChange={e => setFormData({ ...formData, vendor_id: e.target.value })}>
                  <option value="">-- Select Contractor --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Select BOQ Line Item</label>
                <select required className="form-control" value={formData.boq_item_id} onChange={e => setFormData({ ...formData, boq_item_id: e.target.value })}>
                  <option value="">-- Choose BOQ Item --</option>
                  {boqs.map(b => (
                    <option key={b.id} value={b.id}>{b.item_name} (BOQ Ceiling: {b.approved_qty} {b.unit})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Bill / Invoice Number</label>
                  <input type="text" className="form-control" placeholder="INV-502" value={formData.invoice_num || ''} onChange={e => setFormData({ ...formData, invoice_num: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Bill Date</label>
                  <input type="date" className="form-control" value={formData.bill_date || ''} onChange={e => setFormData({ ...formData, bill_date: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Billed Quantity</label>
                  <input required type="number" step="0.01" className="form-control" placeholder="1000" value={formData.billed_qty} onChange={e => setFormData({ ...formData, billed_qty: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Amount / Rate ($)</label>
                  <input required type="number" step="0.01" className="form-control" placeholder="150.00" value={formData.billed_rate} onChange={e => setFormData({ ...formData, billed_rate: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Description / Purpose</label>
                <input type="text" className="form-control" placeholder="Foundation concrete work milestone payment..." value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Supporting Invoice / Document</label>
                  <input type="text" className="form-control" placeholder="Contractor_Invoice_502.pdf" value={formData.supporting_doc || ''} onChange={e => setFormData({ ...formData, supporting_doc: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Payment Details</label>
                  <input type="text" className="form-control" placeholder="Bank Transfer / Wire Ref" value={formData.payment_details || ''} onChange={e => setFormData({ ...formData, payment_details: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Contractor Bill Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
