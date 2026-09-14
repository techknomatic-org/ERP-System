import React, { useEffect, useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Building2, ChevronDown, ChevronRight, ChevronLeft, FileText,
  Smartphone, HardHat
} from 'lucide-react';
import { approvalService } from '../services/api';
import { ROLE_PERMITTED_ROUTES as ROLE_PERMITTED_PATHS } from '../config/roles';
import { PROJECT_FLOW_PHASES, getPhaseKeyForPath, PROJECT_CREATION_NAV_ITEM } from '../config/navigation';

export default function Sidebar() {
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [userRole, setUserRole] = useState(localStorage.getItem('erp_role') || 'admin');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Initialize open groups: active phase open, others compact
  const [openGroups, setOpenGroups] = useState(() => {
    const activeKey = getPhaseKeyForPath(window.location.pathname, window.location.search);
    return {
      'phase-1': activeKey === 'phase-1',
      'phase-2': activeKey === 'phase-2',
      'phase-3': activeKey === 'phase-3',
      'phase-4': activeKey === 'phase-4',
      'phase-5': activeKey === 'phase-5',
      'other-admin': activeKey === 'other-admin'
    };
  });

  // Auto-expand the phase that contains the current active route
  useEffect(() => {
    const activePhaseKey = getPhaseKeyForPath(location.pathname, location.search);
    if (activePhaseKey) {
      setOpenGroups(prev => ({
        ...prev,
        [activePhaseKey]: true
      }));
    }
  }, [location.pathname, location.search]);

  // Toggle expand/collapse of navigation groups independently
  const toggleGroup = (key) => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    setOpenGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  useEffect(() => {
    approvalService.getTasks()
      .then((res) => {
        const pending = res.data.filter(t => t.status === 'pending').length;
        setPendingCount(pending);
      })
      .catch(() => {});

    const storedRole = localStorage.getItem('erp_role');
    if (storedRole) setUserRole(storedRole);
  }, []);

  const roleLower = (userRole || 'admin').toLowerCase();
  const allowed = ROLE_PERMITTED_PATHS[roleLower] || ["*"];

  const isPathAllowed = (path) => {
    if (allowed.includes("*")) return true;
    if (path === '/mobile') return true;
    if (path === '/technical-sanction' && allowed.includes('/estimation')) return true;
    if (path === '/test-check' && allowed.includes('/boq-mb')) return true;
    if (path === '/photo-gallery' && allowed.includes('/site-logs')) return true;
    if (path === '/contractor-billing' && (allowed.includes('/contractor-billing') || allowed.includes('/physical-financial-progress'))) return true;
    if (path === '/physical-financial-progress' && (allowed.includes('/contractor-billing') || allowed.includes('/physical-financial-progress'))) return true;
    const basePath = path.split('?')[0];
    return allowed.some(a => path === a || basePath === a || path.startsWith(a));
  };

  // CUSTOMER PORTAL Sidebar
  if (roleLower === 'customer') {
    return (
      <aside className="sidebar" style={{ width: '260px' }}>
        <div className="brand-header">
          <div className="brand-icon" style={{ background: '#10b981' }}>
            <FileText size={20} color="white" />
          </div>
          <div>
            <div className="brand-name">Customer Portal</div>
            <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>Verified Client Access</div>
          </div>
        </div>
        <nav style={{ padding: '1rem 0.5rem' }}>
          <ul className="nav-list">
            <li>
              <NavLink to="/portal" className="nav-link active">
                <FileText size={18} />
                <span>My Property Portal</span>
              </NavLink>
            </li>
          </ul>
        </nav>
      </aside>
    );
  }

  const sidebarWidth = isCollapsed ? '72px' : '278px';

  // Phase color accents for enterprise visual polish
  const PHASE_COLORS = {
    'phase-1': { badgeBg: 'rgba(56, 189, 248, 0.12)', badgeColor: '#38bdf8', border: '#0284c7' },
    'phase-2': { badgeBg: 'rgba(245, 158, 11, 0.12)', badgeColor: '#f59e0b', border: '#d97706' },
    'phase-3': { badgeBg: 'rgba(16, 185, 129, 0.12)', badgeColor: '#10b981', border: '#059669' },
    'phase-4': { badgeBg: 'rgba(99, 102, 241, 0.12)', badgeColor: '#818cf8', border: '#6366f1' },
    'phase-5': { badgeBg: 'rgba(168, 85, 247, 0.12)', badgeColor: '#c084fc', border: '#9333ea' },
    'other-admin': { badgeBg: 'rgba(148, 163, 184, 0.1)', badgeColor: '#94a3b8', border: '#64748b' }
  };

  const isItemActive = (item) => {
    if (item.path === '/boq-mb?tab=boq') {
      return location.pathname === '/boq-mb' && location.search.includes('tab=boq');
    }
    if (item.path === '/boq-mb') {
      return location.pathname === '/boq-mb' && !location.search.includes('tab=boq');
    }
    if (item.path === '/') {
      return location.pathname === '/';
    }
    if (item.path === '/contractor-billing' && location.pathname === '/physical-financial-progress') {
      return true;
    }
    if (item.path === '/projects' && location.pathname.startsWith('/projects/')) {
      return true;
    }
    if (item.path === '/properties' && location.pathname.startsWith('/properties/')) {
      return true;
    }
    if (item.path === '/units' && location.pathname.startsWith('/units/')) {
      return true;
    }
    if (item.path === '/crm-leads' && location.pathname.startsWith('/crm/leads/')) {
      return true;
    }
    if (item.path === '/bookings' && location.pathname.startsWith('/bookings/')) {
      return true;
    }
    if (item.path === '/customers' && location.pathname.startsWith('/customers/')) {
      return true;
    }
    return location.pathname === item.path;
  };

  return (
    <aside
      className="sidebar custom-modal-scroll"
      style={{
        width: sidebarWidth,
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#080e1e'
      }}
    >
      {/* Brand Header */}
      <div className="brand-header" style={{ justifyContent: isCollapsed ? 'center' : 'space-between', padding: isCollapsed ? '0' : '0 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            className="brand-icon"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #06b6d4)'
            }}
          >
            <Building2 size={20} color="white" />
          </div>
          {!isCollapsed && (
            <div>
              <div className="brand-name" style={{ letterSpacing: '-0.02em', fontSize: '1.05rem' }}>Project Flow</div>
              <div
                style={{
                  fontSize: '0.66rem',
                  color: '#06b6d4',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  letterSpacing: '0.06em'
                }}
              >
                {roleLower.replace('_', ' ')}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '0.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s ease'
          }}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* 5 Business Phases Navigation */}
      <nav style={{ paddingBottom: '2.5rem', flex: 1, padding: isCollapsed ? '0.5rem 0' : '0.5rem' }}>
        <ul className="nav-list" style={{ padding: 0, margin: 0 }}>
          {/* PROJECT / CONTRACT CREATION - Separate Top-Level Entry above Phase 1 */}
          {!isCollapsed && isPathAllowed(PROJECT_CREATION_NAV_ITEM.path) && (
            <li style={{ listStyle: 'none', marginBottom: '0.65rem' }}>
              <NavLink
                to={PROJECT_CREATION_NAV_ITEM.path}
                className={`nav-link ${isItemActive(PROJECT_CREATION_NAV_ITEM) ? 'active' : ''}`}
                style={{
                  padding: '0.52rem 0.65rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.01em',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  borderLeft: isItemActive(PROJECT_CREATION_NAV_ITEM) ? '3px solid #38bdf8' : '3px solid transparent',
                  background: isItemActive(PROJECT_CREATION_NAV_ITEM) ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  transition: 'all 0.15s ease'
                }}
              >
                <HardHat size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
                <span style={{ 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  flex: 1,
                  color: isItemActive(PROJECT_CREATION_NAV_ITEM) ? '#f8fafc' : '#cbd5e1',
                  fontWeight: 700
                }}>
                  {PROJECT_CREATION_NAV_ITEM.label.toUpperCase()}
                </span>
              </NavLink>
            </li>
          )}

          {PROJECT_FLOW_PHASES.map((phase) => {
            const validItems = phase.items.filter(item => isPathAllowed(item.path));
            if (validItems.length === 0) return null;

            const isOpen = openGroups[phase.key] === true;
            const colors = PHASE_COLORS[phase.key] || PHASE_COLORS['other-admin'];
            const PhaseIcon = phase.icon;
            const isPhaseActive = validItems.some(item => isItemActive(item)) ||
              (phase.key === 'phase-1' && (location.pathname === '/projects' || location.pathname.startsWith('/projects/')));

            const handlePhaseClick = () => {
              if (isCollapsed) {
                setIsCollapsed(false);
                setOpenGroups(prev => ({
                  ...prev,
                  [phase.key]: true
                }));
              } else {
                toggleGroup(phase.key);
              }
            };

            return (
              <li key={phase.key} style={{ marginTop: isCollapsed ? '0.25rem' : '0.45rem', listStyle: 'none' }}>
                {isCollapsed && phase.key === 'other-admin' && (
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0.45rem 0.5rem' }} />
                )}

                {!isCollapsed ? (
                  <div
                    onClick={handlePhaseClick}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.48rem 0.65rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: isPhaseActive ? '#f8fafc' : '#94a3b8',
                      background: isPhaseActive 
                        ? 'rgba(255, 255, 255, 0.04)' 
                        : 'transparent',
                      borderLeft: isPhaseActive 
                        ? `3px solid ${colors.border}` 
                        : '3px solid transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.15s ease'
                    }}
                    title={phase.description}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', overflow: 'hidden', flex: 1 }}>
                      {PhaseIcon && (
                        <PhaseIcon 
                          size={16} 
                          style={{ 
                            color: isPhaseActive ? colors.badgeColor : '#64748b', 
                            flexShrink: 0 
                          }} 
                        />
                      )}
                      <span style={{ 
                        whiteSpace: 'nowrap', 
                        textOverflow: 'ellipsis', 
                        overflow: 'hidden',
                        letterSpacing: '-0.01em',
                        fontSize: '0.78rem',
                        fontWeight: isPhaseActive ? 700 : 600,
                        color: isPhaseActive ? '#f8fafc' : '#cbd5e1'
                      }}>
                        {phase.title}
                      </span>
                    </div>
                    <div style={{ color: '#64748b', flexShrink: 0, marginLeft: '0.35rem' }}>
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={handlePhaseClick}
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      margin: '0.25rem 0',
                      cursor: 'pointer',
                      padding: '0.55rem 0.4rem',
                      borderRadius: '8px',
                      background: isPhaseActive ? colors.badgeBg : 'transparent',
                      border: isPhaseActive ? `1px solid ${colors.border}` : '1px solid transparent',
                      transition: 'all 0.2s ease'
                    }}
                    title={phase.title}
                  >
                    {PhaseIcon ? (
                      <PhaseIcon size={20} color={isPhaseActive ? colors.badgeColor : '#94a3b8'} />
                    ) : (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.badgeColor }} />
                    )}
                  </div>
                )}

                {/* Only render child navigation items when sidebar is EXPANDED and phase is OPEN */}
                {!isCollapsed && isOpen && (
                  <ul 
                    style={{ 
                      listStyle: 'none', 
                      paddingLeft: '0.5rem', 
                      margin: '0.2rem 0 0 0',
                      borderLeft: '1px solid rgba(255,255,255,0.05)',
                      marginLeft: '0.75rem'
                    }}
                  >
                    {validItems.map((item) => {
                      const Icon = item.icon;
                      const badge = item.badgeKey === 'pendingApprovals' && pendingCount > 0 ? pendingCount : null;
                      const active = isItemActive(item);

                      return (
                        <li key={item.path + item.label} style={{ listStyle: 'none' }}>
                          <NavLink
                            to={item.path}
                            className={`nav-link ${active ? 'active' : ''}`}
                            style={{
                              padding: '0.42rem 0.55rem',
                              justifyContent: 'flex-start',
                              fontSize: '0.8rem',
                              margin: '0.1rem 0',
                              borderRadius: '6px'
                            }}
                          >
                            <Icon size={16} style={{ flexShrink: 0 }} />
                            <span style={{ 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              flex: 1 
                            }}>
                              {item.label}
                            </span>
                            {badge && (
                              <span 
                                className="tag-badge tag-warning" 
                                style={{ 
                                  marginLeft: 'auto', 
                                  borderRadius: '9999px', 
                                  fontSize: '0.66rem', 
                                  padding: '0.05rem 0.38rem', 
                                  fontWeight: 700 
                                }}
                              >
                                {badge}
                              </span>
                            )}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
