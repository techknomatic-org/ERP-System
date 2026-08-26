import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, User, ChevronDown, LogOut, HardHat, Package, FileText, Layers, X } from 'lucide-react';
import { systemService, notificationService } from '../services/api';

export default function Navbar() {
  const navigate = useNavigate();

  const [dbStatus, setDbStatus] = useState('checking');
  const [notifications, setNotifications] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [activeRole, setActiveRole] = useState(localStorage.getItem('erp_role') || 'admin');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

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

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowProfileDropdown(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowProfileDropdown(false);
        setShowNotifMenu(false);
        setIsSearchFocused(false);
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

  const mockSearchResults = searchQuery.trim().length > 0 ? [
    { type: 'PROJECTS', label: 'Riverside Commercial Complex – Phase 1', route: '/projects' },
    { type: 'TASKS', label: 'Earthwork Excavation (Task #102)', route: '/wbs' },
    { type: 'MATERIALS', label: 'Ready Mix Concrete M30 Grade', route: '/inventory' },
    { type: 'INVOICES', label: 'Vendor Invoice INV-2024-001 (PO-8001)', route: '/contractor-billing' },
  ] : [];

  return (
    <header className="navbar">
      {/* Global Search */}
      <div className="search-box" ref={searchRef} style={{ position: 'relative' }}>
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          placeholder="Search projects, WBS tasks, BOQ, materials, invoices..."
        />
        <kbd style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
          ⌘K
        </kbd>

        {isSearchFocused && searchQuery.trim().length > 0 && (
          <div
            className="glass-card"
            style={{
              position: 'absolute',
              top: '46px',
              left: 0,
              width: '420px',
              background: '#0f172a',
              zIndex: 99999,
              padding: '0.75rem',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid var(--border-color-hover)'
            }}
          >
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
              SEARCH RESULTS ({mockSearchResults.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {mockSearchResults.map((res, i) => (
                <div
                  key={i}
                  onClick={() => {
                    navigate(res.route);
                    setIsSearchFocused(false);
                    setSearchQuery('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.03)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {res.type === 'PROJECTS' ? <HardHat size={14} color="#38bdf8" /> :
                     res.type === 'TASKS' ? <Layers size={14} color="#fbbf24" /> :
                     res.type === 'MATERIALS' ? <Package size={14} color="#34d399" /> :
                     <FileText size={14} color="#818cf8" />}
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500 }}>{res.label}</span>
                  </div>
                  <span className="tag-badge tag-neutral" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                    {res.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Header Actions */}
      <div className="nav-actions">
        {/* DB Connection Status */}
        <div className={`badge-status ${dbStatus === 'connected' ? '' : 'tag-warning'}`}>
          <span className="badge-dot"></span>
          <span>{dbStatus === 'connected' ? 'MySQL Connected' : 'Database Standby'}</span>
        </div>

        {/* Notifications Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            style={{ position: 'relative', borderRadius: '50%', width: '38px', height: '38px', padding: 0 }}
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            title="System Notifications"
          >
            <Bell size={17} color="var(--text-secondary)" />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  background: 'var(--accent-rose)',
                  color: 'white',
                  borderRadius: '9999px',
                  fontSize: '0.65rem',
                  padding: '0.05rem 0.35rem',
                  fontWeight: 800
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div
              className="glass-card"
              style={{
                position: 'fixed',
                right: '180px',
                top: '64px',
                width: '340px',
                background: '#0f172a',
                zIndex: 99999,
                padding: '1rem',
                boxShadow: 'var(--shadow-card)',
                border: '1px solid var(--border-color-hover)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.85rem' }}>Notifications Queue</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>{unreadCount} Unread</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                    No pending notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '0.55rem',
                        borderRadius: '6px',
                        background: n.is_read ? 'transparent' : 'rgba(99,102,241,0.1)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{n.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{n.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile / Session Menu */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
              padding: '0.35rem 0.75rem',
              borderRadius: '8px',
              background: showProfileDropdown ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-color)'
            }}
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--accent-cyan))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <User size={16} color="white" />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                Enterprise User <ChevronDown size={13} color="var(--text-muted)" />
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                {activeRole.replace('_', ' ')}
              </div>
            </div>
          </div>

          {showProfileDropdown && (
            <div
              className="glass-card"
              style={{
                position: 'fixed',
                right: '24px',
                top: '64px',
                width: '260px',
                background: '#0f172a',
                zIndex: 999999,
                padding: '1.1rem',
                boxShadow: 'var(--shadow-card)',
                border: '1px solid var(--border-color-hover)',
                borderRadius: '12px'
              }}
            >
              <div style={{ paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>ACTIVE USER SESSION</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.15rem' }}>Enterprise User</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 600, marginTop: '0.2rem' }}>
                  Role: {activeRole.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              <div style={{ paddingTop: '0.25rem' }}>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem' }}
                  onClick={handleLogout}
                >
                  <LogOut size={15} /> Logout Session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
