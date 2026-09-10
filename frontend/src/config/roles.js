// Central Role & RBAC Governance Definition for Project Flow

export const ALL_ROLES = [
  { id: 'admin', label: 'System Admin', defaultRoute: '/' },
  { id: 'management', label: 'Executive Management', defaultRoute: '/' },
  { id: 'project_manager', label: 'Project Manager', defaultRoute: '/projects' },
  { id: 'site_engineer', label: 'Site Engineer', defaultRoute: '/site-logs' },
  { id: 'finance', label: 'Finance Lead', defaultRoute: '/bookings' },
  { id: 'procurement', label: 'Procurement', defaultRoute: '/procurement' },
  { id: 'crm', label: 'CRM / Sales Manager', defaultRoute: '/crm-leads' },
  { id: 'hse', label: 'HSE Safety Manager', defaultRoute: '/hse' },
  { id: 'qc', label: 'Quality Control Officer', defaultRoute: '/quality' },
  { id: 'facility_manager', label: 'Facility Manager', defaultRoute: '/facility' },
  { id: 'customer', label: 'Customer Account', defaultRoute: '/portal' },
];

export const DEMO_ROLES = [
  { id: 'admin', label: 'System Admin', userType: 'admin', email: 'admin@erp.local', pass: 'admin123', color: '#6366f1' },
  { id: 'project_manager', label: 'Project Manager', userType: 'pm', email: 'pm@erp.local', pass: 'pm123', color: '#f59e0b' },
  { id: 'site_engineer', label: 'Site Engineer', userType: 'site', email: 'site@erp.local', pass: 'site123', color: '#38bdf8' },
  { id: 'finance', label: 'Finance Lead', userType: 'finance', email: 'finance@erp.local', pass: 'finance123', color: '#06b6d4' },
  { id: 'procurement', label: 'Procurement', userType: 'procurement', email: 'procurement@erp.local', pass: 'procurement123', color: '#818cf8' },
  { id: 'customer', label: 'Customer', userType: 'customer', email: 'customer@abccorp.com', pass: 'customer123', color: '#10b981' },
];

export const SWITCHER_ROLES = [
  { id: 'admin', label: 'Admin' },
  { id: 'site_engineer', label: 'Site Engineer' },
  { id: 'project_manager', label: 'Project Manager' },
  { id: 'finance', label: 'Finance' },
  { id: 'management', label: 'Management' },
  { id: 'procurement', label: 'Procurement' },
  { id: 'customer', label: 'Customer' },
];

export const ROLE_PERMITTED_ROUTES = {
  admin: ["*"],
  management: ["*"],
  project_manager: ["/", "/projects", "/wbs", "/work-plan", "/milestones", "/hindrances", "/task-assignments", "/project-team", "/site-logs", "/boq-mb", "/sor", "/non-sor-rate-analysis", "/estimation", "/contractor-awards", "/work-orders", "/approvals", "/vendors", "/procurement", "/inventory", "/properties", "/units", "/customers", "/audit-logs", "/settings", "/ai-analytics", "/tally", "/hse", "/quality", "/facility", "/financial-requests"],
  site_engineer: ["/", "/projects", "/wbs", "/work-plan", "/milestones", "/hindrances", "/task-assignments", "/project-team", "/site-logs", "/boq-mb", "/sor", "/non-sor-rate-analysis", "/estimation", "/contractor-awards", "/work-orders", "/procurement", "/inventory", "/hse", "/approvals", "/ai-analytics", "/financial-requests"],
  finance: ["/", "/bookings", "/contractor-billing", "/projects", "/procurement", "/sor", "/non-sor-rate-analysis", "/estimation", "/contractor-awards", "/work-orders", "/work-plan", "/milestones", "/hindrances", "/task-assignments", "/project-team", "/ai-analytics", "/tally", "/approvals", "/inventory", "/customers", "/audit-logs", "/settings", "/financial-requests"],
  procurement: ["*", "/", "/procurement", "/vendors", "/boq-mb", "/sor", "/non-sor-rate-analysis", "/estimation", "/contractor-awards", "/work-orders", "/work-plan", "/milestones", "/hindrances", "/task-assignments", "/project-team", "/inventory", "/approvals", "/financial-requests"],
  hse: ["/", "/hse", "/quality", "/approvals", "/projects", "/site-logs", "/hindrances"],
  qc: ["/", "/quality", "/hse", "/approvals", "/projects", "/boq-mb", "/sor", "/non-sor-rate-analysis", "/estimation", "/hindrances"],
  facility_manager: ["/", "/facility", "/inventory", "/approvals", "/properties", "/units", "/hindrances"],
  customer: ["/portal"]
};

export const ROLE_DEFAULT_ROUTES = {
  admin: "/",
  management: "/",
  project_manager: "/projects",
  site_engineer: "/site-logs",
  finance: "/bookings",
  procurement: "/procurement",
  hse: "/hse",
  qc: "/quality",
  facility_manager: "/facility",
  customer: "/portal"
};
