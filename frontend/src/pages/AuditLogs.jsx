import React, { useEffect, useState } from 'react';
import { ShieldCheck, History, Search, Filter, Lock, Eye, X } from 'lucide-react';
import { auditService } from '../services/api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  
  // Multi-criteria filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');

  const fetchAuditLogs = () => {
    setLoading(true);
    const params = {};
    if (roleFilter !== 'all') params.role = roleFilter;
    if (moduleFilter !== 'all') params.module = moduleFilter;
    if (actionFilter !== 'all') params.action = actionFilter;
    if (dateRangeFilter !== 'all') params.date_range = dateRangeFilter;

    auditService.getLogs(params)
      .then((res) => setLogs(res.data || []))
      .catch((err) => console.error("Error loading audit logs:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [roleFilter, moduleFilter, actionFilter, dateRangeFilter]);

  const filteredLogs = logs.filter(l => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (l.username && l.username.toLowerCase().includes(s)) ||
      (l.full_name && l.full_name.toLowerCase().includes(s)) ||
      (l.action && l.action.toLowerCase().includes(s)) ||
      (l.module && l.module.toLowerCase().includes(s)) ||
      (l.payload && l.payload.toLowerCase().includes(s))
    );
  });

  return (
    <div className="content-page">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Compliance Audit Trail & Security Logs</h1>
          <p className="page-subtitle">Centralized, immutable audit record of system activities, approvals, logins, and role modifications</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className="tag-badge tag-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <ShieldCheck size={14} /> Immutable Compliance Active
          </span>
          <span className="tag-badge tag-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Lock size={14} /> Read-Only Logs
          </span>
        </div>
      </div>

      {/* Multi-Criteria Filters Bar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'rgba(15,23,42,0.75)', border: '1px solid rgba(56,189,248,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontWeight: 600, fontSize: '0.85rem' }}>
            <Filter size={16} /> Filter Audit Trail:
          </div>

          {/* Role Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Role:</span>
            <select
              className="form-control"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">System Admin</option>
              <option value="management">Executive Management</option>
              <option value="project_manager">Project Manager</option>
              <option value="site_engineer">Site Engineer</option>
              <option value="finance">Finance & Accounting</option>
              <option value="customer">Customer Account</option>
            </select>
          </div>

          {/* Action Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Action:</span>
            <select
              className="form-control"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
            >
              <option value="all">All Actions</option>
              <option value="LOGIN">LOGIN</option>
              <option value="SUBMIT">SUBMIT</option>
              <option value="APPROVE">APPROVE</option>
              <option value="REJECT">REJECT</option>
              <option value="SEND_BACK">SEND_BACK</option>
              <option value="RECORD_PAYMENT">RECORD_PAYMENT</option>
              <option value="ROLE_CHANGE">ROLE_CHANGE</option>
            </select>
          </div>

          {/* Module Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Module:</span>
            <select
              className="form-control"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              value={moduleFilter}
              onChange={e => setModuleFilter(e.target.value)}
            >
              <option value="all">All Modules</option>
              <option value="UserSession">User Session</option>
              <option value="ApprovalTask">Approval Task</option>
              <option value="SiteLog">Site Daily Log</option>
              <option value="PropertyBooking">Property Booking</option>
              <option value="PaymentInstallment">Payment Installment</option>
              <option value="User">User Account</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Date Range:</span>
            <select
              className="form-control"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              value={dateRangeFilter}
              onChange={e => setDateRangeFilter(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Past 30 Days</option>
            </select>
          </div>

          {(roleFilter !== 'all' || moduleFilter !== 'all' || actionFilter !== 'all' || dateRangeFilter !== 'all') && (
            <button
              className="btn btn-secondary"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#f43f5e' }}
              onClick={() => {
                setRoleFilter('all');
                setModuleFilter('all');
                setActionFilter('all');
                setDateRangeFilter('all');
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Free-Text Search */}
        <div className="search-box" style={{ width: '100%' }}>
          <Search size={18} color="#64748b" />
          <input
            type="text"
            placeholder="Search audit trail by user, role, module, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="table-container">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User / Account</th>
              <th>Role</th>
              <th>Action</th>
              <th>Module / Entity</th>
              <th>Log Details / Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '2.5rem' }}>
                  {loading ? "Loading compliance audit logs..." : "No matching audit entries recorded in MySQL database."}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedAuditLog(log)}>
                  <td style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>
                    {log.full_name || log.username || `User #${log.user_id}`}
                  </td>
                  <td>
                    <span className="tag-badge tag-secondary" style={{ fontSize: '0.75rem' }}>
                      {log.user_role || 'System'}
                    </span>
                  </td>
                  <td>
                    <span className={`tag-badge ${
                      log.action === 'APPROVE' || log.action === 'CREATE' || log.action === 'LOGIN' ? 'tag-success' :
                      log.action === 'REJECT' || log.action === 'DELETE' || log.action === 'DEACTIVATED' ? 'tag-danger' :
                      log.action === 'SEND_BACK' || log.action === 'ROLE_CHANGE' ? 'tag-warning' : 'tag-info'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: '#38bdf8' }}>
                    {log.module} #{log.entity_id}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    {log.payload || '-'}
                  </td>
                  <td>
                    <span className="tag-badge tag-success" style={{ fontSize: '0.75rem' }}>
                      {log.status || 'SUCCESS'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* AUDIT LOG DETAIL INSPECTION MODAL */}
      {selectedAuditLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999 }}>
          <div className="glass-card" style={{ width: '520px', background: '#1e293b', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck color="#38bdf8" size={22} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>Audit Record #{selectedAuditLog.id} Inspection</h3>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setSelectedAuditLog(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#94a3b8' }}>Timestamp</span>
                <span style={{ fontWeight: 600, color: '#f8fafc' }}>{new Date(selectedAuditLog.created_at).toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#94a3b8' }}>Executed By User</span>
                <span style={{ fontWeight: 600, color: '#38bdf8' }}>{selectedAuditLog.full_name} ({selectedAuditLog.username})</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#94a3b8' }}>Assigned User Role</span>
                <span className="tag-badge tag-secondary">{selectedAuditLog.user_role}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#94a3b8' }}>Action Performed</span>
                <span className="tag-badge tag-success">{selectedAuditLog.action}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#94a3b8' }}>Target Module & Entity ID</span>
                <span style={{ fontWeight: 600, color: '#818cf8' }}>{selectedAuditLog.module} #{selectedAuditLog.entity_id}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#94a3b8' }}>Session IP Address</span>
                <span style={{ color: '#cbd5e1' }}>{selectedAuditLog.ip_address || "127.0.0.1"}</span>
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ color: '#94a3b8', marginBottom: '0.3rem' }}>Action Payload / Audit Description:</div>
                <div style={{ padding: '0.75rem', background: 'rgba(15,23,42,0.8)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', color: '#cbd5e1', fontSize: '0.8rem', lineHeight: '1.4' }}>
                  {selectedAuditLog.payload || "Standard system workflow operation completed successfully."}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setSelectedAuditLog(null)}>Close Inspection</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
