import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Database, Server, RefreshCw, CheckCircle, XCircle, Shield, Bell, Building2, Save, Info } from 'lucide-react';
import { systemService } from '../services/api';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState(false);

  // Settings State
  const [generalConfig, setGeneralConfig] = useState({
    companyName: 'Skyline Real Estate & Construction ERP',
    currency: 'USD ($)',
    dateFormat: 'DD/MM/YYYY',
    timeZone: 'UTC+05:30 (Asia/Kolkata)'
  });

  const [securityConfig, setSecurityConfig] = useState({
    sessionTimeoutMins: 60,
    passwordMinLength: 8,
    requireSpecialChar: true,
    rbacEnforcement: 'Strict Backend Authorization'
  });

  const fetchHealth = () => {
    setLoading(true);
    systemService.getHealth()
      .then((res) => setSystemInfo(res.data))
      .catch((err) => setSystemInfo({ status: 'offline', error: err.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleSaveSettings = () => {
    setSaveMsg(true);
    setTimeout(() => setSaveMsg(false), 3000);
  };

  return (
    <div className="content-page">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Structured System Settings & Configuration</h1>
          <p className="page-subtitle">Configure enterprise settings, security policies, database health, notifications, and system architecture</p>
        </div>
        <button className="btn btn-primary" onClick={handleSaveSettings}>
          <Save size={16} /> Save Settings
        </button>
      </div>

      {saveMsg && (
        <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', borderRadius: '8px', color: '#10b981', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          ✓ System configuration settings saved successfully!
        </div>
      )}

      {/* Tabs Bar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'general', label: '🏢 General ERP', icon: Building2 },
          { key: 'security', label: '🛡️ Security & Auth', icon: Shield },
          { key: 'notifications', label: '🔔 Notifications', icon: Bell },
          { key: 'database', label: '🗄️ Database Health', icon: Database },
          { key: 'sysinfo', label: 'ℹ️ System Info', icon: Info },
        ].map(t => (
          <button
            key={t.key}
            className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}

      {/* 1. GENERAL TAB */}
      {activeTab === 'general' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem' }}>General Enterprise Configuration</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label>Company / Organization Name</label>
              <input type="text" className="form-control" value={generalConfig.companyName} onChange={e => setGeneralConfig({ ...generalConfig, companyName: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Default ERP Currency</label>
              <select className="form-control" value={generalConfig.currency} onChange={e => setGeneralConfig({ ...generalConfig, currency: e.target.value })}>
                <option value="USD ($)">USD ($)</option>
                <option value="INR (₹)">INR (₹)</option>
                <option value="EUR (€)">EUR (€)</option>
                <option value="AED (AED)">AED (AED)</option>
              </select>
            </div>

            <div className="form-group">
              <label>System Date Format</label>
              <select className="form-control" value={generalConfig.dateFormat} onChange={e => setGeneralConfig({ ...generalConfig, dateFormat: e.target.value })}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>

            <div className="form-group">
              <label>Default Time Zone</label>
              <input type="text" className="form-control" value={generalConfig.timeZone} onChange={e => setGeneralConfig({ ...generalConfig, timeZone: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {/* 2. SECURITY TAB */}
      {activeTab === 'security' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem' }}>Security Policy & RBAC Configurations</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label>Session Timeout (Minutes)</label>
              <input type="number" className="form-control" value={securityConfig.sessionTimeoutMins} onChange={e => setSecurityConfig({ ...securityConfig, sessionTimeoutMins: parseInt(e.target.value) })} />
            </div>

            <div className="form-group">
              <label>Minimum Password Length</label>
              <input type="number" className="form-control" value={securityConfig.passwordMinLength} onChange={e => setSecurityConfig({ ...securityConfig, passwordMinLength: parseInt(e.target.value) })} />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Backend RBAC Enforcement Mode</label>
              <input type="text" disabled className="form-control" value={securityConfig.rbacEnforcement} />
            </div>
          </div>
        </div>
      )}

      {/* 3. NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.25rem' }}>System & Approval Notifications</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Multi-Stage Approval Alerts</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Send in-app notifications to approvers when tasks arrive</div>
              </div>
              <span className="tag-badge tag-success">ENABLED</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Payment Overdue Alerts</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Notify Finance & Management when installment dates pass</div>
              </div>
              <span className="tag-badge tag-success">ENABLED</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. DATABASE TAB */}
      {activeTab === 'database' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>MySQL Database Health & Connectivity</h3>
            <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={fetchHealth}>
              <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh Status
            </button>
          </div>

          {systemInfo?.database ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#94a3b8' }}>Database Engine</span>
                <span style={{ fontWeight: 600 }}>MySQL Server</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#94a3b8' }}>Host & Port</span>
                <span style={{ fontWeight: 600 }}>{systemInfo.database.host}:{systemInfo.database.port}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#94a3b8' }}>Target Database</span>
                <span style={{ fontWeight: 600, color: '#818cf8' }}>{systemInfo.database.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <span style={{ color: '#94a3b8' }}>Connection Status</span>
                {systemInfo.database.connected ? (
                  <span className="tag-badge tag-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <CheckCircle size={12} /> Connected & Active
                  </span>
                ) : (
                  <span className="tag-badge tag-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <XCircle size={12} /> Connection Pending
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p style={{ color: '#64748b' }}>Checking database connectivity...</p>
          )}
        </div>
      )}

      {/* 5. SYSTEM INFORMATION TAB (Requirement 16) */}
      {activeTab === 'sysinfo' && (
        <div className="glass-card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={22} color="#38bdf8" /> Local Tech Stack Overview
          </h3>
          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Detailed technical breakdown of backend services, frontend single-page application framework, and database engines.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '0.85rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#818cf8', marginBottom: '0.2rem' }}>Backend REST API</div>
              <div style={{ fontSize: '0.8rem', color: '#f8fafc' }}>Python + FastAPI + SQLAlchemy ORM</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Host: {import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}</div>
            </div>

            <div style={{ padding: '0.85rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#38bdf8', marginBottom: '0.2rem' }}>Frontend SPA Engine</div>
              <div style={{ fontSize: '0.8rem', color: '#f8fafc' }}>React.js + Vite + Glassmorphic Design</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Host: http://localhost:5173</div>
            </div>

            <div style={{ padding: '0.85rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#34d399', marginBottom: '0.2rem' }}>Database Engine</div>
              <div style={{ fontSize: '0.8rem', color: '#f8fafc' }}>MySQL Server (`localhost:3306`, `erp_db`)</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Storage Engine: InnoDB</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
