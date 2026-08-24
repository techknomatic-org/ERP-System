import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Key, Building2, ShieldCheck, ArrowRight, HardHat, FileText, DollarSign, ClipboardList } from 'lucide-react';
import { authService } from '../services/api';

export default function Login() {
  const navigate = useNavigate();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    authService.login({ username_or_email: usernameOrEmail, password: password })
      .then((res) => {
        const { access_token, user } = res.data;
        localStorage.setItem('erp_token', access_token);
        localStorage.setItem('erp_user', JSON.stringify(user));
        localStorage.setItem('erp_role', user.role);

        // Role & Permission Based Destination Engine
        const roleStr = (user.role || '').toLowerCase();
        const defaultRoute = user.default_route || (
          roleStr.includes('customer') ? '/portal' :
          roleStr.includes('project') || roleStr.includes('pm') ? '/projects' :
          roleStr.includes('site') ? '/site-logs' :
          roleStr.includes('finance') ? '/bookings' :
          roleStr.includes('hse') ? '/hse' :
          roleStr.includes('qc') ? '/quality' :
          roleStr.includes('facility') ? '/facility' : '/'
        );

        navigate(defaultRoute, { replace: true });
      })
      .catch((err) => {
        setErrorMsg(err.response?.data?.detail || "Login failed. Please check credentials.");
      })
      .finally(() => setLoading(false));
  };

  const handleQuickFill = (userType) => {
    if (userType === 'admin') {
      setUsernameOrEmail('admin@erp.local');
      setPassword('admin123');
    } else if (userType === 'pm') {
      setUsernameOrEmail('pm@erp.local');
      setPassword('pm123');
    } else if (userType === 'site') {
      setUsernameOrEmail('site@erp.local');
      setPassword('site123');
    } else if (userType === 'finance') {
      setUsernameOrEmail('finance@erp.local');
      setPassword('finance123');
    } else if (userType === 'customer') {
      setUsernameOrEmail('customer@abccorp.com');
      setPassword('customer123');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top right, #1e293b, #0f172a)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="glass-card" style={{ width: '480px', background: '#1e293b', padding: '2rem', border: '1px solid rgba(255,255,255,0.12)' }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '54px', height: '54px', borderRadius: '16px', background: 'linear-gradient(135deg, #38bdf8, #6366f1)', marginBottom: '0.75rem' }}>
            <Building2 size={30} color="white" />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>Skyline ERP Portal</h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Enterprise Construction & Customer Portal Authentication
          </p>
        </div>

        {/* Demo Quick-Fill Role Credentials */}
        <div style={{ padding: '0.85rem', background: 'rgba(15,23,42,0.6)', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid rgba(56,189,248,0.2)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            TEST DEMO ROLE CREDENTIALS:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', justifyContent: 'center', padding: '0.35rem' }}
              onClick={() => handleQuickFill('admin')}
            >
              <ShieldCheck size={13} color="#6366f1" /> System Admin
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', justifyContent: 'center', padding: '0.35rem' }}
              onClick={() => handleQuickFill('pm')}
            >
              <HardHat size={13} color="#f59e0b" /> Project Manager
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', justifyContent: 'center', padding: '0.35rem' }}
              onClick={() => handleQuickFill('site')}
            >
              <ClipboardList size={13} color="#38bdf8" /> Site Engineer
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', justifyContent: 'center', padding: '0.35rem' }}
              onClick={() => handleQuickFill('finance')}
            >
              <DollarSign size={13} color="#06b6d4" /> Finance Lead
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', justifyContent: 'center', padding: '0.35rem', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}
              onClick={() => handleQuickFill('customer')}
            >
              <User size={13} color="#10b981" /> Customer
            </button>
          </div>
        </div>

        {errorMsg && (
          <div style={{ padding: '0.75rem', background: 'rgba(244,63,94,0.15)', border: '1px solid #f43f5e', borderRadius: '8px', color: '#f43f5e', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {errorMsg}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.4rem', display: 'block' }}>Username or Email</label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                required
                type="text"
                className="form-control"
                style={{ paddingLeft: '2.4rem' }}
                placeholder="pm@erp.local or customer@abccorp.com"
                value={usernameOrEmail}
                onChange={e => setUsernameOrEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.4rem', display: 'block' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                required
                type="password"
                className="form-control"
                style={{ paddingLeft: '2.4rem' }}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.95rem', background: 'linear-gradient(135deg, #38bdf8, #6366f1)' }}
            disabled={loading}
          >
            {loading ? "Authenticating & Checking Permissions..." : "Sign In & Access ERP"} <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
