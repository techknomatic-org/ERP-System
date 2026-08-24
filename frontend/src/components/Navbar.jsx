import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, User, ChevronDown, LogOut } from 'lucide-react';
import { systemService, notificationService } from '../services/api';

export default function Navbar() {
  const navigate = useNavigate();

  const [dbStatus, setDbStatus] = useState('checking');
  const [notifications, setNotifications] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [activeRole, setActiveRole] = useState(localStorage.getItem('erp_role') || 'admin');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const dropdownRef = useRef(null);

  const loadNotifs = () => {
    notificationService.getUserNotifications(1)
      .then((res) => setNotifications(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    systemService.getHealth()
      .then((res) => {
        if (res.data?.database?.connected) {
          setDbStatus('connected');
        } else {
          setDbStatus('error');
        }
      })
      .catch(() => setDbStatus('error'));

    loadNotifs();

    const storedRole = localStorage.getItem('erp_role');
    if (storedRole) setActiveRole(storedRole);

    // Click outside handler
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowProfileDropdown(false);
      }
    };

    // Keyboard Escape listener
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowProfileDropdown(false);
        setShowNotifMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    localStorage.removeItem('erp_role');
    setShowProfileDropdown(false);
    navigate('/login', { replace: true });
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <header className="navbar" style={{ position: 'relative', zIndex: 9999 }}>
      <div className="search-box">
        <Search size={18} color="#64748b" />
        <input
          type="text"
          placeholder={activeRole === 'site_engineer' ? "Search my sites, tasks, BOQ, logs..." : "Search projects, BOQ, leases, tickets..."}
        />
      </div>

      <div className="nav-actions">
        <div className={`badge-status ${dbStatus === 'connected' ? 'badge-online' : 'tag-warning'}`}>
          <span className="badge-dot" />
          <span>{dbStatus === 'connected' ? 'MySQL Connected' : 'MySQL Standby'}</span>
        </div>

        {/* Notifications Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.5rem', borderRadius: '50%', position: 'relative' }}
            onClick={() => setShowNotifMenu(!showNotifMenu)}
          >
            <Bell size={18} color="#94a3b8" />
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#f43f5e', color: 'white', borderRadius: '50%', fontSize: '0.65rem', padding: '0.1rem 0.35rem', fontWeight: 700 }}>
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="glass-card" style={{ position: 'fixed', right: '120px', top: '62px', width: '340px', background: '#1e293b', zIndex: 99999, padding: '1rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem' }}>System Notifications</strong>
                <span style={{ fontSize: '0.75rem', color: '#818cf8' }}>{unreadCount} New</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center', padding: '1rem' }}>No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} style={{ padding: '0.5rem', borderRadius: '6px', background: n.is_read ? 'transparent' : 'rgba(99,102,241,0.1)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#f8fafc' }}>{n.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>{n.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', padding: '0.3rem 0.6rem', borderRadius: '8px', background: showProfileDropdown ? 'rgba(255,255,255,0.08)' : 'transparent', border: '1px solid rgba(255,255,255,0.05)' }}
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
          >
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: activeRole === 'customer' ? 'linear-gradient(135deg, #10b981, #06b6d4)' : 'linear-gradient(135deg, #6366f1, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={18} color="white" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                Local User <ChevronDown size={14} color="#94a3b8" />
              </div>
              <div style={{ fontSize: '0.7rem', color: activeRole === 'customer' ? '#10b981' : '#38bdf8', textTransform: 'capitalize', fontWeight: 600 }}>
                Role: {activeRole.replace('_', ' ')}
              </div>
            </div>
          </div>

          {/* Clean User Profile Dropdown */}
          {showProfileDropdown && (
            <div
              className="glass-card"
              style={{
                position: 'fixed',
                right: '24px',
                top: '64px',
                width: '280px',
                background: '#1e293b',
                zIndex: 999999,
                padding: '1.1rem',
                boxShadow: '0 25px 30px -5px rgba(0,0,0,0.8), 0 15px 15px -5px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px'
              }}
            >
              {/* Header: User Account Information */}
              <div style={{ paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>USER ACCOUNT INFORMATION</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>Local User</div>
                <div style={{ fontSize: '0.8rem', color: activeRole === 'customer' ? '#10b981' : '#38bdf8', fontWeight: 600, marginTop: '0.25rem' }}>
                  Current Role: {activeRole.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              {/* Quick Navigation Links */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem', justifyContent: 'center' }} onClick={() => { setShowProfileDropdown(false); navigate('/sessions'); }}>
                  Active Sessions
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '0.4rem', justifyContent: 'center' }} onClick={() => { setShowProfileDropdown(false); navigate('/settings'); }}>
                  System Settings
                </button>
              </div>

              {/* Logout Button */}
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    justify: 'center',
                    background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                    borderColor: '#e11d48',
                    gap: '0.5rem',
                    padding: '0.6rem',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                  onClick={handleLogout}
                >
                  <LogOut size={16} /> Logout Session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
