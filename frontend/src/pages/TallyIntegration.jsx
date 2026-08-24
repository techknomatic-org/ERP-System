import React, { useEffect, useState } from 'react';
import { Database, Plus, RefreshCw, CheckCircle2, Code2, Send, FileCode } from 'lucide-react';
import { tallyService } from '../services/api';

export default function TallyIntegration() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [payloadModalItem, setPayloadModalItem] = useState(null);

  const [formData, setFormData] = useState({
    voucher_type: 'Sales',
    entity_type: 'PropertyBooking',
    entity_id: '1',
    ledger_name: 'Real Estate Sales Revenue Account',
    amount: '',
    narration: ''
  });

  const loadQueue = () => {
    setLoading(true);
    tallyService.getQueue()
      .then((res) => setQueue(res.data))
      .catch((err) => console.error("Error loading Tally queue:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleEnqueue = (e) => {
    e.preventDefault();
    tallyService.enqueueVoucher({
      voucher_type: formData.voucher_type,
      entity_type: formData.entity_type,
      entity_id: parseInt(formData.entity_id || 1),
      ledger_name: formData.ledger_name,
      amount: parseFloat(formData.amount),
      narration: formData.narration
    })
      .then(() => {
        setShowModal(false);
        setFormData({ voucher_type: 'Sales', entity_type: 'PropertyBooking', entity_id: '1', ledger_name: 'Real Estate Sales Revenue Account', amount: '', narration: '' });
        loadQueue();
      });
  };

  const handleSyncVoucher = (syncId) => {
    tallyService.syncVoucher(syncId)
      .then(() => loadQueue());
  };

  const handleSyncAll = () => {
    tallyService.syncAll()
      .then(() => loadQueue());
  };

  return (
    <div className="content-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Tally ERP Accounting Integration</h1>
          <p className="page-subtitle">Voucher Sync Queue Engine: XML / JSON Payload Generator & Mock Tally Integration</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleSyncAll}>
            <Send size={18} /> Post All Pending Vouchers
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Enqueue Voucher
          </button>
        </div>
      </div>

      {/* Sync Queue Table */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '1.25rem' }}>Tally Financial Sync Queue</h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Sync Code</th>
                <th>Voucher Type</th>
                <th>Source ERP Entity</th>
                <th>Payload Previews</th>
                <th>Tally Sync Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '2.5rem' }}>
                    {loading ? "Loading Tally sync queue..." : "No vouchers in sync queue."}
                  </td>
                </tr>
              ) : (
                queue.map((q) => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 600, color: '#818cf8' }}>{q.sync_code}</td>
                    <td>
                      <span className={`tag-badge ${
                        q.voucher_type === 'Sales' ? 'tag-success' :
                        q.voucher_type === 'Purchase' ? 'tag-warning' : 'tag-info'
                      }`}>
                        {q.voucher_type} Voucher
                      </span>
                    </td>
                    <td>
                      <strong style={{ display: 'block', color: '#f8fafc' }}>{q.entity_type}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Entity ID #{q.entity_id}</span>
                    </td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => setPayloadModalItem(q)}>
                        <FileCode size={12} /> View XML / JSON
                      </button>
                    </td>
                    <td>
                      <span className={`tag-badge ${q.status === 'synced' ? 'tag-success' : 'tag-warning'}`}>
                        {q.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {q.status === 'pending' ? (
                        <button className="btn btn-primary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }} onClick={() => handleSyncVoucher(q.id)}>
                          <Send size={12} /> Sync to Tally
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Synced to Tally</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enqueue Voucher Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '480px', background: '#1e293b' }}>
            <h3 style={{ marginBottom: '1.25rem' }}>Enqueue Tally Voucher</h3>
            <form onSubmit={handleEnqueue}>
              <div className="form-group">
                <label>Voucher Type</label>
                <select className="form-control" value={formData.voucher_type} onChange={e => setFormData({ ...formData, voucher_type: e.target.value })}>
                  <option value="Sales">Sales Voucher</option>
                  <option value="Purchase">Purchase Voucher</option>
                  <option value="Payment">Payment Voucher</option>
                  <option value="Receipt">Receipt Voucher</option>
                  <option value="Journal">Journal Voucher</option>
                </select>
              </div>
              <div className="form-group">
                <label>Source ERP Entity Type</label>
                <select className="form-control" value={formData.entity_type} onChange={e => setFormData({ ...formData, entity_type: e.target.value })}>
                  <option value="PropertyBooking">Property Booking</option>
                  <option value="PurchaseOrder">Purchase Order (PO)</option>
                  <option value="ContractorBill">Contractor Bill</option>
                  <option value="UtilityBill">Utility Meter Bill</option>
                </select>
              </div>
              <div className="form-group">
                <label>Tally Ledger Name</label>
                <input required type="text" className="form-control" placeholder="Real Estate Sales Revenue Account" value={formData.ledger_name} onChange={e => setFormData({ ...formData, ledger_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Voucher Amount ($)</label>
                <input required type="number" step="0.01" className="form-control" placeholder="450000" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Narration</label>
                <input type="text" className="form-control" placeholder="Automated ERP Sync for Unit Booking" value={formData.narration} onChange={e => setFormData({ ...formData, narration: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate XML & Queue</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payload XML / JSON Preview Modal */}
      {payloadModalItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card" style={{ width: '640px', background: '#1e293b', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Tally Payload Preview (#{payloadModalItem.sync_code})</h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>Generated Tally XML & JSON data structures for ERP transaction sync</p>

            <h4 style={{ fontSize: '0.9rem', color: '#38bdf8', marginBottom: '0.35rem' }}>Tally Import XML Data:</h4>
            <pre style={{ background: 'rgba(15,23,42,0.8)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: '#a7f3d0', overflowX: 'auto', marginBottom: '1rem' }}>
              {payloadModalItem.payload_xml}
            </pre>

            <h4 style={{ fontSize: '0.9rem', color: '#818cf8', marginBottom: '0.35rem' }}>Tally REST JSON Data:</h4>
            <pre style={{ background: 'rgba(15,23,42,0.8)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: '#93c5fd', overflowX: 'auto' }}>
              {JSON.stringify(JSON.parse(payloadModalItem.payload_json), null, 2)}
            </pre>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={() => setPayloadModalItem(null)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
