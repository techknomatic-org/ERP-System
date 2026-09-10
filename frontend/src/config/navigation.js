import { 
  HardHat, Calculator, DollarSign, ShieldCheck, Award, FileCheck,
  Layers, Calendar, Target, Users, UserCheck,
  ClipboardList, FileSpreadsheet, ShieldAlert, CheckSquare,
  LayoutDashboard, Image as ImageIcon,
  Smartphone, Sparkles, FileBarChart,
  Package, ShoppingCart, Truck, Building2, Key, Sliders, UserCog, Settings,
  AlertOctagon, Wrench, Shield, Clock, BarChart3, ShoppingBag
} from 'lucide-react';

/**
 * PROJECT FLOW — 5 BUSINESS PHASES NAVIGATION ARCHITECTURE
 * 
 * Centralized, shared navigation hierarchy for Desktop Sidebar & Mobile Drawer.
 * Structured into 5 primary business phases plus an Enterprise & Administration group.
 */
export const PROJECT_FLOW_PHASES = [
  {
    key: 'phase-1',
    phaseNumber: 'PHASE 1',
    title: 'Project Creation',
    icon: HardHat,
    description: 'Statutory project inception, rate analysis, estimation & sanctions',
    items: [
      { label: 'Project / Contract Creation', path: '/projects', icon: HardHat, featureId: 'PSC-01' },
      { label: 'SOR / DSR Rate Database', path: '/sor', icon: Calculator, featureId: 'PSC-04' },
      { label: 'Detailed Estimate', path: '/estimation', icon: DollarSign, featureId: 'PSC-05' },
      { label: 'Non-SOR Rate Analysis', path: '/non-sor-rate-analysis', icon: Calculator, featureId: 'PSC-06' },
      { label: 'Technical Sanction', path: '/technical-sanction', icon: ShieldCheck, featureId: 'PSC-07' },
      { label: 'Contractor Awards', path: '/contractor-awards', icon: Award },
      { label: 'Work Orders', path: '/work-orders', icon: FileCheck },
    ]
  },
  {
    key: 'phase-2',
    phaseNumber: 'PHASE 2',
    title: 'Work Planning & Team',
    icon: Calendar,
    description: 'WBS hierarchy, BOQ linkage, milestones & team setup',
    items: [
      { label: 'Work Plan / WBS', path: '/wbs', icon: Layers, featureId: 'WPT-01' },
      { label: 'BOQ → Work Plan Mapping', path: '/work-plan', icon: Calendar, featureId: 'WPT-02' },
      { label: 'Project Milestones', path: '/milestones', icon: Target, featureId: 'WPT-03' },
      { label: 'Project Team', path: '/project-team', icon: Users, featureId: 'WPT-04' },
      { label: 'Task Assignments', path: '/task-assignments', icon: UserCheck },
    ]
  },
  {
    key: 'phase-3',
    phaseNumber: 'PHASE 3',
    title: 'Execution & Approvals',
    icon: ClipboardList,
    description: 'Field execution, digital e-MB, sampling & hindrance tracking',
    items: [
      { label: 'Daily Site Logs', path: '/site-logs', icon: ClipboardList },
      { label: 'Digital e-MB', path: '/boq-mb', icon: FileSpreadsheet, featureId: 'EXA-02' },
      { label: 'AE/EE Test-Check', path: '/test-check', icon: ShieldCheck, featureId: 'EXA-03' },
      { label: 'Hindrance Management', path: '/hindrances', icon: ShieldAlert, featureId: 'EXA-06' },
    ]
  },
  {
    key: 'phase-4',
    phaseNumber: 'PHASE 4',
    title: 'Progress & Visibility',
    icon: LayoutDashboard,
    description: 'Executive dashboards, physical/financial progress & visual gallery',
    items: [
      { label: 'Unified Project Dashboard', path: '/', icon: LayoutDashboard, featureId: 'PRV-01' },
      { label: 'Physical & Financial Progress', path: '/contractor-billing', icon: Calculator },
      { label: 'Photo Gallery', path: '/photo-gallery', icon: ImageIcon },
    ]
  },
  {
    key: 'phase-5',
    phaseNumber: 'PHASE 5',
    title: 'Intelligence & Integration',
    icon: Sparkles,
    description: 'Mobile field app, OCR analytics & external accounting sync',
    items: [
      { label: 'Mobile App', path: '/mobile', icon: Smartphone, featureId: 'INT-05' },
      { label: 'AI Analytics & OCR', path: '/ai-analytics', icon: Sparkles },
      { label: 'Tally Accounting Sync', path: '/tally', icon: FileBarChart },
    ]
  },
  {
    key: 'other-admin',
    phaseNumber: 'OTHER',
    title: 'Enterprise & Administration',
    icon: Settings,
    description: 'System governance, master assets, procurement & compliance',
    items: [
      { label: 'Approval Workflows', path: '/approvals', icon: CheckSquare, badgeKey: 'pendingApprovals' },
      { label: 'Financial Requests', path: '/financial-requests', icon: DollarSign },
      { label: 'Material Inventory', path: '/inventory', icon: Package },
      { label: 'Procurement Pipeline', path: '/procurement', icon: ShoppingCart },
      { label: 'Vendors Directory', path: '/vendors', icon: Truck },
      { label: 'Properties Master', path: '/properties', icon: Building2 },
      { label: 'Unit Inventory Master', path: '/units', icon: Key },
      { label: 'Customers Directory', path: '/customers', icon: Users },
      { label: 'CRM Leads', path: '/crm-leads', icon: UserCheck },
      { label: 'Unit Bookings', path: '/bookings', icon: Key },
      { label: 'Sales Orders & Revenue', path: '/sales', icon: ShoppingBag },
      { label: 'HSE Safety Incidents', path: '/hse', icon: ShieldCheck },
      { label: 'Quality Control Inspections', path: '/quality', icon: AlertOctagon },
      { label: 'Facility Management', path: '/facility', icon: Wrench },
      { label: 'User Accounts', path: '/users', icon: UserCheck },
      { label: 'Roles & Permissions', path: '/roles-permissions', icon: UserCog },
      { label: 'Approval Authority', path: '/approval-authority', icon: Sliders },
      { label: 'Session Management', path: '/sessions', icon: Clock },
      { label: 'Audit Trail Logs', path: '/audit-logs', icon: ShieldAlert },
      { label: 'System Settings', path: '/settings', icon: Settings },
    ]
  }
];

/**
 * Helper to determine which phase a route belongs to.
 * Ensures consistent phase detection across Desktop Sidebar and Mobile Navigation.
 */
export function getPhaseKeyForPath(pathname) {
  if (!pathname || pathname === '/') return 'phase-4';
  
  if (
    pathname.startsWith('/projects') || 
    pathname.startsWith('/sor') || 
    pathname.startsWith('/estimation') || 
    pathname.startsWith('/non-sor-rate-analysis') || 
    pathname.startsWith('/technical-sanction') || 
    pathname.startsWith('/contractor-awards') || 
    pathname.startsWith('/work-orders')
  ) {
    return 'phase-1';
  }

  if (
    pathname.startsWith('/wbs') || 
    pathname.startsWith('/work-plan') || 
    pathname.startsWith('/milestones') || 
    pathname.startsWith('/project-team') || 
    pathname.startsWith('/task-assignments')
  ) {
    return 'phase-2';
  }

  if (
    pathname.startsWith('/site-logs') || 
    pathname.startsWith('/boq-mb') || 
    pathname.startsWith('/test-check') || 
    pathname.startsWith('/hindrances')
  ) {
    return 'phase-3';
  }

  if (
    pathname === '/' || 
    pathname.startsWith('/contractor-billing') || 
    pathname.startsWith('/physical-financial-progress') || 
    pathname.startsWith('/photo-gallery')
  ) {
    return 'phase-4';
  }

  if (
    pathname.startsWith('/mobile') || 
    pathname.startsWith('/ai-analytics') || 
    pathname.startsWith('/tally')
  ) {
    return 'phase-5';
  }

  return 'other-admin';
}
