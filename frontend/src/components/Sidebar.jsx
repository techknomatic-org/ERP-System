import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingCart, Users, Settings, 
  CheckSquare, ShieldAlert, Building2, HardHat, FileText, UserCheck, Key, Layers, ClipboardList,
  Calculator, Truck, FileSpreadsheet, ShieldCheck, AlertOctagon, Sparkles, Wrench,
  ChevronDown, ChevronRight, ChevronLeft, UserCog, Sliders, Activity, FileBarChart, DollarSign, TrendingUp, Briefcase, Award, FileCheck, Calendar
} from 'lucide-react';
import { approvalService } from '../services/api';

import { ROLE_PERMITTED_ROUTES as ROLE_PERMITTED_PATHS } from '../config/roles';

export default function Sidebar() {
  const [pendingCount, setPendingCount] = useState(0);
  const [userRole, setUserRole] = useState(localStorage.getItem('erp_role') || 'admin');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [openGroups, setOpenGroups] = useState({
    admin: true, master: false, ops: true, finance: true, procurement: true, quality: false, analytics: false,
    pm_projects: true, pm_planning: true, pm_materials: false, pm_approvals: true,
    se_dashboard: true, se_execution: true, se_materials: false, se_control: true,
    fin_dashboard: true, fin_receivables: true,
    proc_dashboard: true, proc_pipeline: true,
    mgmt_dashboard: true, mgmt_portfolio: true
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

  // 1. SYSTEM ADMIN Nav (System & Security Administration)
  const adminNavSections = [
    {
      key: 'admin',
      title: 'SYSTEM ADMINISTRATION',
      items: [
        { label: 'Admin Overview', icon: LayoutDashboard, path: '/' },
        { label: 'User Accounts', icon: UserCheck, path: '/users' },
        { label: 'Roles & Permissions', icon: UserCog, path: '/roles-permissions' },
        { label: 'Approval Authority', icon: Sliders, path: '/approval-authority' },
        { label: 'Audit Trail Logs', icon: ShieldAlert, path: '/audit-logs' },
        { label: 'System Settings', icon: Settings, path: '/settings' },
      ]
    },
    {
      key: 'master',
      title: 'MASTER DATA & ASSETS',
      items: [
        { label: 'Construction Projects', icon: HardHat, path: '/projects' },
        { label: 'Properties Master', icon: Building2, path: '/properties' },
        { label: 'Unit Inventory Master', icon: Key, path: '/units' },
        { label: 'Customers Directory', icon: Users, path: '/customers' },
        { label: 'Vendor Directory', icon: Truck, path: '/vendors' },
      ]
    },
    {
      key: 'ops',
      title: 'CONSTRUCTION OPERATIONS',
      items: [
        { label: 'WBS & Task Tree', icon: Layers, path: '/wbs' },
        { label: 'Work Plan', icon: Calendar, path: '/work-plan' },
        { label: 'Task Assignments', icon: UserCheck, path: '/task-assignments' },
        { label: 'Project Team', icon: Users, path: '/project-team' },
        { label: 'Daily Site Logs', icon: ClipboardList, path: '/site-logs' },
        { label: 'BOQ & Measurement Book', icon: FileSpreadsheet, path: '/boq-mb' },
        { label: 'Schedule of Rates', icon: Calculator, path: '/sor' },
        { label: 'Non-SOR Rate Analysis', icon: Calculator, path: '/non-sor-rate-analysis' },
        { label: 'Project Estimation', icon: DollarSign, path: '/estimation' },
        { label: 'Contractor Awards', icon: Award, path: '/contractor-awards' },
        { label: 'Work Orders', icon: FileCheck, path: '/work-orders' },
        { label: 'CRM Leads', icon: UserCheck, path: '/crm-leads' },
        { label: 'Unit Bookings', icon: Key, path: '/bookings' },
      ]
    },
    {
      key: 'finance',
      title: 'FINANCE & PAYMENTS',
      items: [
        { label: 'Financial Requests', icon: DollarSign, path: '/financial-requests' },
        { label: 'Contractor Billing', icon: Calculator, path: '/contractor-billing' },
        { label: 'Tally Accounting Sync', icon: FileBarChart, path: '/tally' },
      ]
    },
    {
      key: 'procurement',
      title: 'PROCUREMENT & INVENTORY',
      items: [
        { label: 'Procurement Pipeline', icon: ShoppingCart, path: '/procurement' },
        { label: 'Material Inventory', icon: Package, path: '/inventory' },
        { label: 'Vendors Directory', icon: Truck, path: '/vendors' },
      ]
    },
    {
      key: 'quality',
      title: 'APPROVALS & COMPLIANCE',
      items: [
        { label: 'Approval Workflows', icon: CheckSquare, path: '/approvals', badge: pendingCount > 0 ? pendingCount : null },
        { label: 'HSE Safety Incidents', icon: ShieldCheck, path: '/hse' },
        { label: 'Quality Control Inspections', icon: AlertOctagon, path: '/quality' },
        { label: 'Facility Management', icon: Wrench, path: '/facility' },
      ]
    },
    {
      key: 'analytics',
      title: 'EXECUTIVE AI ANALYTICS',
      items: [
        { label: 'AI Analytics & OCR', icon: Sparkles, path: '/ai-analytics' },
      ]
    }
  ];

  // 2. EXECUTIVE MANAGEMENT Nav (Portfolio Governance & Profitability)
  const mgmtNavSections = [
    {
      key: 'mgmt_dashboard',
      title: 'EXECUTIVE PORTFOLIO',
      items: [
        { label: 'Executive Portfolio Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'Portfolio Construction Projects', icon: HardHat, path: '/projects' },
        { label: 'WBS Milestones & Schedule', icon: Layers, path: '/wbs' }
      ]
    },
    {
      key: 'mgmt_portfolio',
      title: 'GOVERNANCE & ANALYTICS',
      items: [
        { label: 'Executive Approvals Queue', icon: CheckSquare, path: '/approvals', badge: pendingCount > 0 ? pendingCount : null },
        { label: 'Financial Requests Overview', icon: DollarSign, path: '/financial-requests' },
        { label: 'AI Analytics & Predictive Insights', icon: Sparkles, path: '/ai-analytics' }
      ]
    }
  ];

  // 3. PROJECT MANAGER Nav
  const pmNavSections = [
    {
      key: 'pm_projects',
      title: 'PROJECT MANAGEMENT',
      items: [
        { label: 'PM Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'Construction Projects', icon: HardHat, path: '/projects' },
        { label: 'Project Estimation', icon: DollarSign, path: '/estimation' },
        { label: 'Non-SOR Rate Analysis', icon: Calculator, path: '/non-sor-rate-analysis' },
        { label: 'Contractor Awards', icon: Award, path: '/contractor-awards' },
        { label: 'Work Orders', icon: FileCheck, path: '/work-orders' }
      ]
    },
    {
      key: 'pm_planning',
      title: 'PLANNING & EXECUTION',
      items: [
        { label: 'WBS & Task Tree', icon: Layers, path: '/wbs' },
        { label: 'Work Plan', icon: Calendar, path: '/work-plan' },
        { label: 'Task Assignments', icon: UserCheck, path: '/task-assignments' },
        { label: 'Project Team', icon: Users, path: '/project-team' },
        { label: 'Daily Site Logs', icon: ClipboardList, path: '/site-logs' },
        { label: 'BOQ & Measurement Book', icon: FileSpreadsheet, path: '/boq-mb' },
        { label: 'Schedule of Rates', icon: Calculator, path: '/sor' },
        { label: 'Non-SOR Rate Analysis', icon: Calculator, path: '/non-sor-rate-analysis' }
      ]
    },
    {
      key: 'pm_materials',
      title: 'RESOURCES & INVENTORY',
      items: [
        { label: 'Procurement Pipeline', icon: ShoppingCart, path: '/procurement' },
        { label: 'Material Inventory', icon: Package, path: '/inventory' },
        { label: 'Vendor Directory', icon: Truck, path: '/vendors' }
      ]
    },
    {
      key: 'pm_approvals',
      title: 'WORKFLOW & FINANCIALS',
      items: [
        { label: 'My Pending Approvals', icon: CheckSquare, path: '/approvals', badge: pendingCount > 0 ? pendingCount : null },
        { label: 'Financial Requests', icon: DollarSign, path: '/financial-requests' },
        { label: 'Executive Analytics', icon: Sparkles, path: '/ai-analytics' }
      ]
    }
  ];

  // 4. SITE ENGINEER Nav
  const seNavSections = [
    {
      key: 'se_dashboard',
      title: 'SITE CONTROL',
      items: [
        { label: 'Site Engineer Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'My Assigned Projects', icon: HardHat, path: '/projects' }
      ]
    },
    {
      key: 'se_execution',
      title: 'SITE EXECUTION',
      items: [
        { label: 'WBS & Task Hierarchy', icon: Layers, path: '/wbs' },
        { label: 'Daily Site Progress Log', icon: ClipboardList, path: '/site-logs' },
        { label: 'BOQ & Measurement Book', icon: FileSpreadsheet, path: '/boq-mb' },
        { label: 'Schedule of Rates', icon: Calculator, path: '/sor' },
        { label: 'Non-SOR Rate Analysis', icon: Calculator, path: '/non-sor-rate-analysis' },
        { label: 'Project Estimation', icon: DollarSign, path: '/estimation' }
      ]
    },
    {
      key: 'se_materials',
      title: 'MATERIALS & SAFETY',
      items: [
        { label: 'Material Stock & Requests', icon: Package, path: '/inventory' },
        { label: 'HSE Safety Incidents', icon: AlertOctagon, path: '/hse' },
        { label: 'Financial Requests', icon: DollarSign, path: '/financial-requests' },
        { label: 'My Pending Approvals', icon: CheckSquare, path: '/approvals', badge: pendingCount > 0 ? pendingCount : null }
      ]
    }
  ];

  // 5. FINANCE Nav
  const financeNavSections = [
    {
      key: 'fin_dashboard',
      title: 'FINANCIAL MANAGEMENT',
      items: [
        { label: 'Finance Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'Financial Requests Queue', icon: DollarSign, path: '/financial-requests' },
        { label: 'Contractor Bill 3-Way Match', icon: Calculator, path: '/contractor-billing' }
      ]
    },
    {
      key: 'fin_receivables',
      title: 'PAYMENTS & ACCOUNTING',
      items: [
        { label: 'Approval Tasks Queue', icon: CheckSquare, path: '/approvals', badge: pendingCount > 0 ? pendingCount : null },
        { label: 'Unit Bookings & Payments', icon: Key, path: '/bookings' },
        { label: 'AI Invoice OCR & Verification', icon: Sparkles, path: '/ai-analytics' },
        { label: 'Tally Accounting Sync', icon: FileBarChart, path: '/tally' }
      ]
    }
  ];

  // 6. PROCUREMENT Nav (PR / PO / GRN / Inventory / Vendors)
  const procurementNavSections = [
    {
      key: 'proc_dashboard',
      title: 'PROCUREMENT HUB',
      items: [
        { label: 'Procurement Dashboard', icon: LayoutDashboard, path: '/' },
        { label: 'Procurement Pipeline (PR/PO/GRN)', icon: ShoppingCart, path: '/procurement' }
      ]
    },
    {
      key: 'proc_pipeline',
      title: 'INVENTORY & VENDORS',
      items: [
        { label: 'Material Inventory Stock', icon: Package, path: '/inventory' },
        { label: 'Vendor Directory', icon: Truck, path: '/vendors' },
        { label: 'BOQ Material Verification', icon: FileSpreadsheet, path: '/boq-mb' },
        { label: 'Pending Approvals', icon: CheckSquare, path: '/approvals', badge: pendingCount > 0 ? pendingCount : null }
      ]
    }
  ];

  // 7. CUSTOMER PORTAL Sidebar
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

  const activeNavSections = 
    roleLower === 'management' ? mgmtNavSections :
    roleLower.includes('finance') ? financeNavSections : 
    roleLower.includes('procure') ? procurementNavSections :
    roleLower.includes('site') ? seNavSections : 
    roleLower.includes('pm') || roleLower.includes('project') ? pmNavSections : adminNavSections;

  const sidebarWidth = isCollapsed ? '72px' : '260px';

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
      {/* Brand Header */}
      <div className="brand-header" style={{ justifyContent: isCollapsed ? 'center' : 'space-between' }}>
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
              <div className="brand-name">Project Flow</div>
              <div
                style={{
                  fontSize: '0.68rem',
                  color: '#06b6d4',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  letterSpacing: '0.05em'
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
            justify: 'center'
          }}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Navigation Accordions */}
      <nav style={{ paddingBottom: '2rem' }}>
        <ul className="nav-list">
          {activeNavSections.map(section => {
            const validItems = section.items.filter(item => isPathAllowed(item.path));
            if (validItems.length === 0) return null;

            const isOpen = openGroups[section.key] === true;

            return (
              <li key={section.key} style={{ marginTop: isCollapsed ? '0.4rem' : '0.6rem' }}>
                {!isCollapsed ? (
                  <div
                    onClick={() => toggleGroup(section.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      userSelect: 'none'
                    }}
                  >
                    <span>{section.title}</span>
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </div>
                ) : (
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.4rem 0' }} />
                )}

                {(isOpen || isCollapsed) && (
                  <ul style={{ listStyle: 'none', paddingLeft: 0, marginTop: '0.2rem' }}>
                    {validItems.map(item => {
                      const Icon = item.icon;
                      return (
                        <li key={item.path + item.label}>
                          <NavLink
                            to={item.path}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                            style={{
                              padding: isCollapsed ? '0.6rem 0' : '0.5rem 0.75rem',
                              justify: isCollapsed ? 'center' : 'flex-start',
                              fontSize: '0.83rem'
                            }}
                            title={isCollapsed ? item.label : undefined}
                          >
                            <Icon size={16} />
                            {!isCollapsed && <span>{item.label}</span>}
                            {!isCollapsed && item.badge && (
                              <span className="tag-badge tag-warning" style={{ marginLeft: 'auto', borderRadius: '9999px', fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
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
