import React, { useState } from 'react';
import { ShieldCheck, UserCog, Check, X, Lock, Save, Edit, RefreshCw } from 'lucide-react';

const INITIAL_ROLES = [
  {
    role_key: 'admin',
    role_name: 'System Administrator',
    description: 'Highest administrative authority with complete system, user, configuration, and audit access.',
    users_count: 1,
    permissions: { VIEW: true, CREATE: true, EDIT: true, DELETE: true, APPROVE: true, EXPORT: true }
  },
  {
    role_key: 'management',
    role_name: 'Executive Management',
    description: 'Centralized executive monitoring, high-level financial reports, and final stage approval authority.',
    users_count: 1,
    permissions: { VIEW: true, CREATE: true, EDIT: true, DELETE: false, APPROVE: true, EXPORT: true }
  },
  {
    role_key: 'project_manager',
    role_name: 'Project Manager',
    description: 'Manages construction projects, WBS timelines, site logs, BOQ, and Stage 1 approvals.',
    users_count: 1,
    permissions: { VIEW: true, CREATE: true, EDIT: true, DELETE: false, APPROVE: true, EXPORT: true }
  },
  {
    role_key: 'site_engineer',
    role_name: 'Site Engineer',
    description: 'Operational site management, daily site progress logs creation, and submission for approvals.',
    users_count: 1,
    permissions: { VIEW: true, CREATE: true, EDIT: true, DELETE: false, APPROVE: false, EXPORT: false }
  },
  {
    role_key: 'finance',
    role_name: 'Finance & Accounting',
    description: 'Financial management, booking payments, installment schedules, contractor billing, and Stage 2 approvals.',
    users_count: 1,
    permissions: { VIEW: true, CREATE: true, EDIT: true, DELETE: false, APPROVE: true, EXPORT: true }
  },
  {
    role_key: 'procurement',
    role_name: 'Procurement Officer',
    description: 'Vendor management, purchase requisitions (PR), purchase orders (PO), and inventory materials.',
    users_count: 1,
    permissions: { VIEW: true, CREATE: true, EDIT: true, DELETE: false, APPROVE: true, EXPORT: true }
  },
  {
    role_key: 'crm',
    role_name: 'CRM / Sales Manager',
    description: 'Lead generation, customer qualification, site visit scheduling, and unit booking creation.',
    users_count: 1,
    permissions: { VIEW: true, CREATE: true, EDIT: true, DELETE: false, APPROVE: false, EXPORT: true }
  },
  {
    role_key: 'hse',
    role_name: 'HSE Safety Manager',
    description: 'Safety compliance, hazard reporting, incident logging, and CAPA corrective actions.',
    users_count: 1,
    permissions: { VIEW: true, CREATE: true, EDIT: true, DELETE: false, APPROVE: true, EXPORT: true }
  },
  {
    role_key: 'qc',
    role_name: 'Quality Control Officer',
    description: 'Quality inspections, material testing, Non-Conformance Reports (NCR), and sign-offs.',
    users_count: 1,
    permissions: { VIEW: true, CREATE: true, EDIT: true, DELETE: false, APPROVE: true, EXPORT: true }
  },
  {
    role_key: 'facility_manager',
    role_name: 'Facility Manager',
    description: 'Post-handover property maintenance, SLA tracking, and work order management.',
    users_count: 1,
    permissions: { VIEW: true, CREATE: true, EDIT: true, DELETE: false, APPROVE: true, EXPORT: true }
  },
  {
    role_key: 'customer',
    role_name: 'Client Customer Account',
    description: 'Strictly isolated self-service customer portal access to personal unit, booking, and payment receipts.',
    users_count: 1,
    permissions: { VIEW: true, CREATE: false, EDIT: false, DELETE: false, APPROVE: false, EXPORT: true }
  }
];

export default function RolesPermissions() {
  const [roles, setRoles] = useState(INITIAL_ROLES);
  const [selectedRole, setSelectedRole] = useState(INITIAL_ROLES[0]);
  const [editPermissions, setEditPermissions] = useState({ ...INITIAL_ROLES[0].permissions });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSelectRole = (r) => {
    setSelectedRole(r);
    setEditPermissions({ ...r.permissions });
    setSaveSuccess(false);
  };

  const togglePermission = (actionKey) => {
    setEditPermissions(prev => ({
      ...prev,
      [actionKey]: !prev[actionKey]
    }));
  };

  const handleSavePermissions = () => {
    setRoles(prev => prev.map(r => r.role_key === selectedRole.role_key ? { ...r, permissions: editPermissions } : r));
    setSelectedRole(prev => ({ ...prev, permissions: editPermissions }));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="content-page">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Roles & Permissions Management (RBAC)</h1>
          <p className="page-subtitle">Configure application role capabilities, module access, and action-level permissions</p>
        </div>
        <span className="tag-badge tag-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <ShieldCheck size={14} /> RBAC Enforcement Active
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        
        {/* Roles List */}
        <div className="glass-card" style={{ padding: '1rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserCog size={18} color="#38bdf8" /> Application Roles ({roles.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {roles.map(r => {
              const isSelected = selectedRole.role_key === r.role_key;
              return (
                <div
                  key={r.role_key}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(56,189,248,0.15)' : 'rgba(15,23,42,0.6)',
                    border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => handleSelectRole(r)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: isSelected ? '#38bdf8' : '#f8fafc', fontSize: '0.9rem' }}>
                      {r.role_name}
                    </span>
                    <span className="tag-badge tag-secondary" style={{ fontSize: '0.7rem' }}>
                      {r.users_count} Users
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem', lineHeight: '1.3' }}>
                    {r.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Role Capability & Permission Matrix */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>{selectedRole.role_name}</h3>
              <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '0.15rem' }}>Role Key: <code>{selectedRole.role_key}</code></div>
            </div>
            <button className="btn btn-primary" onClick={handleSavePermissions} style={{ fontSize: '0.85rem' }}>
              <Save size={15} /> Save Role Matrix
            </button>
          </div>

          {saveSuccess && (
            <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', borderRadius: '8px', color: '#10b981', fontSize: '0.85rem', marginBottom: '1rem' }}>
              ✓ Permissions updated and applied to role <strong>{selectedRole.role_name}</strong>!
            </div>
          )}

          <h4 style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>Action-Level Capability Matrix</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
            {['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'EXPORT'].map(act => {
              const active = editPermissions[act];
              return (
                <div
                  key={act}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    background: active ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                    border: active ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(244,63,94,0.3)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between'
                  }}
                  onClick={() => togglePermission(act)}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: active ? '#10b981' : '#f43f5e' }}>{act}</span>
                  {active ? <Check size={18} color="#10b981" /> : <X size={18} color="#f43f5e" />}
                </div>
              );
            })}
          </div>

          <h4 style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>Module Access Scope Summary</h4>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Access Scope</th>
                  <th>Permission Level</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>Construction Projects & WBS</td>
                  <td>{selectedRole.role_key === 'site_engineer' ? 'Assigned Projects Only' : 'All Projects'}</td>
                  <td><span className="tag-badge tag-info">{editPermissions.CREATE ? 'Full Management' : 'Read Only'}</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>Site Daily Progress Logs</td>
                  <td>{selectedRole.role_key === 'customer' ? 'No Access' : 'All Site Logs'}</td>
                  <td><span className="tag-badge tag-info">{editPermissions.CREATE ? 'Create / Submit' : 'Read Only'}</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>Unit Inventory & Bookings</td>
                  <td>{selectedRole.role_key === 'customer' ? 'Own Booking Only' : 'All Units & Bookings'}</td>
                  <td><span className="tag-badge tag-info">{editPermissions.APPROVE ? 'Full Approval Scope' : 'Operational Scope'}</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600, color: '#f8fafc' }}>Payment Schedules & Receipts</td>
                  <td>{selectedRole.role_key === 'customer' ? 'Own Receipts Only' : 'Financial Ledger'}</td>
                  <td><span className="tag-badge tag-info">{editPermissions.EDIT ? 'Payment Record & Sync' : 'Read Only'}</span></td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
}
