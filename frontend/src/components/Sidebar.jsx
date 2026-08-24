import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingCart, Users, Settings, Database, 
  CheckSquare, ShieldAlert, Building2, HardHat, FileText, Wrench, UserCheck, Key, Layers, ClipboardList,
  Calculator, Truck, FileSpreadsheet, ShieldCheck, AlertOctagon, LifeBuoy, FileCode, Sparkles,
  ChevronDown, ChevronRight, ChevronLeft, UserCog, Sliders, Activity, Briefcase, FileBarChart, Shield, DollarSign, TrendingUp
} from 'lucide-react';
import { approvalService } from '../services/api';

const ROLE_PERMITTED_PATHS = {
  admin: ["*"],
  management: ["*"],
  project_manager: ["/", "/projects", "/wbs", "/site-logs", "/boq-mb", "/approvals", "/procurement", "/financial-requests"],
  site_engineer: ["/", "/projects", "/wbs", "/site-logs", "/boq-mb", "/procurement", "/inventory", "/hse", "/approvals", "/ai-analytics", "/financial-requests"],
  finance: ["/", "/bookings", "/financial-requests", "/approvals"],
  procurement: ["/procurement", "/vendors", "/boq-mb", "/inventory", "/approvals", "/financial-requests"],
  hse: ["/hse", "/quality", "/approvals"],
  qc: ["/quality", "/hse", "/approvals"],
  facility_manager: ["/facility", "/inventory", "/approvals"],
  customer: ["/portal"]
};

export default function Sidebar() {
  const [pendingCount, setPendingCount] = useState(0);
  const [userRole, setUserRole] = useState(localStorage.getItem('erp_role') || 'admin');

  // Sidebar Width Collapse State
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Group Accordion State
  const [openGroups, setOpenGroups] = useState({
    admin: true,
    master: false,
    ops: false,
    finance: false,
    procurement: false,
    quality: false,
    analytics: false,
    integrations: false,

    // PM Groups
    pm_projects: true,
    pm_planning: true,
    pm_materials: false,
    pm_approvals: true,

    // SE Groups
    se_dashboard: true,
    se_execution: true,
    se_materials: false,
    se_control: true,
    se_reports: false,

    // Finance Groups (Default Open)
    fin_dashboard: true,
    fin_receivables: true
  });

  const toggleGroup = (key) => {
    if (isCollapsed) setIsCollapsed(false);
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
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
    return allowed.some(a => path === a || path.startsWith(a));
  };

  // SYSTEM ADMIN Navigation
  const adminNavSections = [
    {
      key: 'admin',
      title: 'SYSTEM ADMINISTRATION',
      items: [
        { label: 'Admin Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'User Accounts', icon: UserCheck, path: '/users' },
        { label: 'Roles & Permissions', icon: UserCog, path: '/roles-permissions' },
        { label: 'Approval Authority', icon: Sliders, path: '/approval-authority' },
        { label: 'Audit Trail Logs', icon: ShieldAlert, path: '/audit-logs' },
        { label: 'Session Management', icon: Activity, path: '/sessions' },
        { label: 'System Settings', icon: Settings, path: '/settings' },
      ]
    },
    {
      key: 'master',
      title: 'MASTER DATA',
      items: [
        { label: 'Construction Projects', icon: HardHat, path: '/projects' },
        { label: 'Properties & Complexes', icon: Building2, path: '/properties' },
        { label: 'Unit Inventory Master', icon: Key, path: '/units' },
        { label: 'Customers Directory', icon: Users, path: '/customers' },
        { label: 'Vendor Directory', icon: Truck, path: '/vendors' },
      ]
    },
    {
      key: 'ops',
      title: 'BUSINESS OPERATIONS',
      items: [
        { label: 'Construction Projects', icon: HardHat, path: '/projects' },
        { label: 'WBS & Gantt Timeline', icon: Layers, path: '/wbs' },
        { label: 'Site Daily Progress Logs', icon: ClipboardList, path: '/site-logs' },
        { label: 'BOQ & Measurement Book', icon: FileSpreadsheet, path: '/boq-mb' },
        { label: 'Property Management', icon: Building2, path: '/properties' },
        { label: 'Unit Inventory', icon: Key, path: '/units' },
        { label: 'CRM Lead Pipeline', icon: UserCheck, path: '/crm-leads' },
        { label: 'Unit Bookings', icon: Key, path: '/bookings' },
        { label: 'Customer Portal', icon: FileText, path: '/portal' },
      ]
    },
    {
      key: 'finance',
      title: 'FINANCE & PAYMENTS',
      items: [
        { label: 'Financial Requests', icon: DollarSign, path: '/financial-requests' },
        { label: 'Payment Management', icon: Key, path: '/bookings' },
        { label: 'Payment Schedules', icon: Key, path: '/bookings' },
        { label: 'Payment Receipts', icon: Key, path: '/bookings' },
      ]
    },
    {
      key: 'procurement',
      title: 'PROCUREMENT & INVENTORY',
      items: [
        { label: 'Procurement', icon: ShoppingCart, path: '/procurement' },
        { label: 'Inventory & Materials', icon: Package, path: '/inventory' },
      ]
    },
    {
      key: 'quality',
      title: 'QUALITY & COMPLIANCE',
      items: [
        { label: 'Approval Workflows', icon: CheckSquare, path: '/approvals', badge: pendingCount > 0 ? pendingCount : null },
        { label: 'Financial Requests', icon: DollarSign, path: '/financial-requests' },
        { label: 'HSE', icon: ShieldCheck, path: '/hse' },
        { label: 'Quality Control', icon: AlertOctagon, path: '/quality' },
      ]
    },
    {
      key: 'analytics',
      title: 'REPORTS & ANALYTICS',
      items: [
        { label: 'Executive Reports', icon: Sparkles, path: '/ai-analytics' },
        { label: 'Business Reports', icon: FileBarChart, path: '/ai-analytics' },
      ]
    },
    {
      key: 'integrations',
      title: 'INTEGRATIONS & TOOLS',
      items: [
        { label: 'Integrations', icon: FileCode, path: '/tally' },
        { label: 'System Tools', icon: Settings, path: '/settings' },
      ]
    }
  ];

  // PM Navigation
  const pmNavSections = [
    {
      key: 'pm_projects',
      title: '🏗️ PROJECTS',
      items: [
        { label: 'My Projects', icon: HardHat, path: '/projects' }
      ]
    },
    {
      key: 'pm_planning',
      title: '📋 PLANNING & EXECUTION',
      items: [
        { label: 'WBS & Gantt', icon: Layers, path: '/wbs' },
        { label: 'Project Tasks', icon: Layers, path: '/wbs' },
        { label: 'Site Daily Logs', icon: ClipboardList, path: '/site-logs' },
        { label: 'BOQ & Measurements', icon: FileSpreadsheet, path: '/boq-mb' }
      ]
    },
    {
      key: 'pm_materials',
      title: '📦 MATERIALS',
      items: [
        { label: 'Material Inventory', icon: Package, path: '/inventory' }
      ]
    },
    {
      key: 'pm_approvals',
      title: '✅ APPROVALS',
      items: [
        { label: 'My Pending Approvals', icon: CheckSquare, path: '/approvals', badge: pendingCount > 0 ? pendingCount : null },
        { label: 'Financial Requests', icon: DollarSign, path: '/financial-requests' }
      ]
    }
  ];

  // SITE ENGINEER Navigation
  const seNavSections = [
    {
      key: 'se_dashboard',
      title: '📊 DASHBOARD',
      items: [
        { label: 'Site Dashboard', icon: LayoutDashboard, path: '/' }
      ]
    },
    {
      key: 'se_execution',
      title: 'PROJECT EXECUTION',
      items: [
        { label: 'My Sites', icon: HardHat, path: '/projects' },
        { label: 'WBS & Tasks', icon: Layers, path: '/wbs' },
        { label: 'Daily Site Logs', icon: ClipboardList, path: '/site-logs' },
        { label: 'BOQ & Measurements', icon: FileSpreadsheet, path: '/boq-mb' }
      ]
    },
    {
      key: 'se_materials',
      title: 'MATERIALS & RESOURCES',
      items: [
        { label: 'Material Inventory', icon: Package, path: '/inventory' },
        { label: 'Material Usage', icon: Package, path: '/inventory' },
        { label: 'Resources & Manpower', icon: Package, path: '/inventory' }
      ]
    },
    {
      key: 'se_control',
      title: 'SITE CONTROL',
      items: [
        { label: 'Site Issues & Delays', icon: AlertOctagon, path: '/hse' },
        { label: 'Financial Requests', icon: DollarSign, path: '/financial-requests' },
        { label: 'My Pending Approvals', icon: CheckSquare, path: '/approvals', badge: pendingCount > 0 ? pendingCount : null }
      ]
    },
    {
      key: 'se_reports',
      title: 'REPORTS',
      items: [
        { label: 'Site Progress', icon: Sparkles, path: '/ai-analytics' },
        { label: 'Material Consumption', icon: Package, path: '/inventory' },
        { label: 'Delay & Issue Report', icon: ShieldCheck, path: '/hse' }
      ]
    }
  ];

  // EXACT FINANCE SIDEBAR AS REQUESTED
  const financeNavSections = [
    {
      key: 'fin_dashboard',
      title: '💰 FINANCE',
      items: [
        { label: 'Finance Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'Financial Requests', icon: DollarSign, path: '/financial-requests' }
      ]
    },
    {
      key: 'fin_receivables',
      title: '💳 BILLING & RECEIVABLES',
      items: [
        { label: 'Invoices', icon: FileText, path: '/bookings' },
        { label: 'Payments & Collections', icon: DollarSign, path: '/bookings' },
        { label: 'Accounts Receivable', icon: Calculator, path: '/bookings' }
      ]
    }
  ];

  // Customer Sidebar
  if (roleLower === 'customer') {
    return (
      <aside className="sidebar" style={{ width: '270px' }}>
        <div className="brand-header">
          <div className="brand-icon" style={{ background: '#10b981' }}>
            <FileText size={20} color="white" />
          </div>
          <div>
            <div className="brand-name">Customer Portal</div>
            <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Verified Client Access</div>
          </div>
        </div>
        <nav>
          <ul className="nav-list">
            <li>
              <NavLink to="/portal" className="nav-link active">
                <FileText size={18} />
                <span>My Customer Portal</span>
              </NavLink>
            </li>
          </ul>
        </nav>
      </aside>
    );
  }

  const activeNavSections = 
    roleLower.includes('finance') ? financeNavSections : 
    roleLower.includes('site') ? seNavSections : 
    roleLower.includes('pm') || roleLower.includes('project') ? pmNavSections : adminNavSections;
  const sidebarWidth = isCollapsed ? '72px' : '270px';

  return (
    <aside
      className="sidebar"
      style={{
        width: sidebarWidth,
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflowY: 'auto',
        position: 'relative'
      }}
    >
      {/* Header */}
      <div className="brand-header" style={{ justifyContent: isCollapsed ? 'center' : 'space-between', padding: isCollapsed ? '0.75rem 0.5rem' : '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="brand-icon" style={{ background: roleLower === 'procurement' ? 'linear-gradient(135deg, #818cf8, #38bdf8)' : roleLower === 'finance' ? 'linear-gradient(135deg, #10b981, #6366f1)' : roleLower === 'site_engineer' ? 'linear-gradient(135deg, #10b981, #06b6d4)' : roleLower === 'project_manager' ? 'linear-gradient(135deg, #f59e0b, #38bdf8)' : undefined }}>
            {roleLower === 'procurement' ? <ShoppingCart size={20} color="white" /> : roleLower === 'finance' ? <DollarSign size={20} color="white" /> : roleLower === 'site_engineer' ? <HardHat size={20} color="white" /> : roleLower === 'project_manager' ? <HardHat size={20} color="white" /> : <Database size={20} />}
          </div>
          {!isCollapsed && (
            <div>
              <div className="brand-name">Skyline ERP</div>
              <div style={{ fontSize: '0.75rem', color: roleLower === 'procurement' ? '#818cf8' : roleLower === 'finance' ? '#10b981' : roleLower === 'site_engineer' ? '#10b981' : roleLower === 'project_manager' ? '#f59e0b' : '#38bdf8', textTransform: 'capitalize', fontWeight: 600 }}>
                {roleLower === 'procurement' ? '📦 Procurement Officer' : roleLower === 'finance' ? '💰 Finance Lead' : roleLower === 'site_engineer' ? '👷 Site Engineer' : roleLower === 'project_manager' ? '👷 Project Manager' : roleLower === 'admin' ? '🛡️ System Admin' : roleLower.replace('_', ' ')}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Width Collapse Button */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: '6px',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '0.3rem',
            display: 'flex',
            alignItems: 'center',
            justify: 'center'
          }}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav style={{ paddingBottom: '2rem' }}>
        <ul className="nav-list">
          {activeNavSections.map(section => {
            const validItems = section.items.filter(item => isPathAllowed(item.path));
            if (validItems.length === 0) return null;

            const isOpen = openGroups[section.key] === true;

            return (
              <li key={section.key} style={{ marginTop: isCollapsed ? '0.4rem' : '0.75rem' }}>
                {!isCollapsed ? (
                  <div
                    onClick={() => toggleGroup(section.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: roleLower === 'finance' ? '#10b981' : roleLower === 'site_engineer' ? '#10b981' : roleLower === 'project_manager' ? '#f59e0b' : '#94a3b8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      userSelect: 'none'
                    }}
                  >
                    <span>{section.title}</span>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                ) : (
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0.4rem 0' }} />
                )}

                {(isOpen || isCollapsed) && (
                  <ul style={{ listStyle: 'none', paddingLeft: isCollapsed ? '0' : '0.5rem', marginTop: '0.2rem' }}>
                    {validItems.map(item => {
                      const Icon = item.icon;
                      return (
                        <li key={item.path + item.label}>
                          <NavLink
                            to={item.path}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            style={{
                              padding: isCollapsed ? '0.6rem 0' : '0.45rem 0.75rem',
                              justify: isCollapsed ? 'center' : 'flex-start',
                              fontSize: '0.82rem'
                            }}
                            title={isCollapsed ? item.label : undefined}
                          >
                            <Icon size={16} />
                            {!isCollapsed && <span>{item.label}</span>}
                            {!isCollapsed && item.badge && (
                              <span className="tag-badge tag-warning" style={{ marginLeft: 'auto', borderRadius: '9999px', fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                                {item.badge}
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
