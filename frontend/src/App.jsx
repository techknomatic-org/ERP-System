import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AiAnalytics from './pages/AiAnalytics';
import TallyIntegration from './pages/TallyIntegration';
import FacilityManagement from './pages/FacilityManagement';
import HseIncidents from './pages/HseIncidents';
import QualityControl from './pages/QualityControl';
import ContractorBilling from './pages/ContractorBilling';
import BoqMb from './pages/BoqMb';
import Vendors from './pages/Vendors';
import Procurement from './pages/Procurement';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import WbsGantt from './pages/WbsGantt';
import SiteLogs from './pages/SiteLogs';
import Properties from './pages/Properties';
import PropertyDetails from './pages/PropertyDetails';
import Units from './pages/Units';
import UnitDetails from './pages/UnitDetails';
import CrmLeads from './pages/CrmLeads';
import CrmLeadDetails from './pages/CrmLeadDetails';
import Bookings from './pages/Bookings';
import BookingDetails from './pages/BookingDetails';
import CustomerPortal from './pages/CustomerPortal';
import Approvals from './pages/Approvals';
import FinancialRequests from './pages/FinancialRequests';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Customers from './pages/Customers';
import CustomerDetails from './pages/CustomerDetails';
import UsersPage from './pages/Users';
import RolesPermissions from './pages/RolesPermissions';
import ApprovalAuthority from './pages/ApprovalAuthority';
import SessionManagement from './pages/SessionManagement';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';

import { ROLE_PERMITTED_ROUTES, ROLE_DEFAULT_ROUTES as ROLE_DEFAULT_DESTINATION } from './config/roles';

// Role & Permission Route Guard Component
function RoleProtectedRouteGuard({ children, path }) {
  const token = localStorage.getItem('erp_token');
  const role = (localStorage.getItem('erp_role') || '').toLowerCase();

  if (!token && !role) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'customer') {
    if (path !== '/portal') {
      return <Navigate to="/portal" replace />;
    }
    return children;
  }

  const allowed = ROLE_PERMITTED_ROUTES[role] || ["*"];
  if (
    !allowed.includes("*") && 
    !allowed.includes(path) && 
    !path.startsWith('/projects/') && 
    !path.startsWith('/properties/') && 
    !path.startsWith('/units/') && 
    !path.startsWith('/crm/leads/') && 
    !path.startsWith('/bookings/') && 
    !path.startsWith('/customers/') &&
    !path.startsWith('/procurement')
  ) {
    const dest = ROLE_DEFAULT_DESTINATION[role] || '/';
    return <Navigate to={dest} replace />;
  }

  return children;
}

export default function App() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Navbar />
        <Routes>
          <Route path="/" element={<RoleProtectedRouteGuard path="/"><Dashboard /></RoleProtectedRouteGuard>} />
          <Route path="/login" element={<Login />} />
          <Route path="/ai-analytics" element={<RoleProtectedRouteGuard path="/ai-analytics"><AiAnalytics /></RoleProtectedRouteGuard>} />
          <Route path="/tally" element={<RoleProtectedRouteGuard path="/tally"><TallyIntegration /></RoleProtectedRouteGuard>} />
          <Route path="/facility" element={<RoleProtectedRouteGuard path="/facility"><FacilityManagement /></RoleProtectedRouteGuard>} />
          <Route path="/hse" element={<RoleProtectedRouteGuard path="/hse"><HseIncidents /></RoleProtectedRouteGuard>} />
          <Route path="/quality" element={<RoleProtectedRouteGuard path="/quality"><QualityControl /></RoleProtectedRouteGuard>} />
          <Route path="/contractor-billing" element={<RoleProtectedRouteGuard path="/contractor-billing"><ContractorBilling /></RoleProtectedRouteGuard>} />
          <Route path="/boq-mb" element={<RoleProtectedRouteGuard path="/boq-mb"><BoqMb /></RoleProtectedRouteGuard>} />
          <Route path="/vendors" element={<RoleProtectedRouteGuard path="/vendors"><Vendors /></RoleProtectedRouteGuard>} />
          <Route path="/procurement" element={<RoleProtectedRouteGuard path="/procurement"><Procurement /></RoleProtectedRouteGuard>} />
          <Route path="/procurement/*" element={<RoleProtectedRouteGuard path="/procurement"><Procurement /></RoleProtectedRouteGuard>} />
          <Route path="/projects" element={<RoleProtectedRouteGuard path="/projects"><Projects /></RoleProtectedRouteGuard>} />
          <Route path="/projects/:id" element={<RoleProtectedRouteGuard path="/projects"><ProjectDetails /></RoleProtectedRouteGuard>} />
          <Route path="/wbs" element={<RoleProtectedRouteGuard path="/wbs"><WbsGantt /></RoleProtectedRouteGuard>} />
          <Route path="/site-logs" element={<RoleProtectedRouteGuard path="/site-logs"><SiteLogs /></RoleProtectedRouteGuard>} />
          <Route path="/properties" element={<RoleProtectedRouteGuard path="/properties"><Properties /></RoleProtectedRouteGuard>} />
          <Route path="/properties/:id" element={<RoleProtectedRouteGuard path="/properties"><PropertyDetails /></RoleProtectedRouteGuard>} />
          <Route path="/units" element={<RoleProtectedRouteGuard path="/units"><Units /></RoleProtectedRouteGuard>} />
          <Route path="/units/:id" element={<RoleProtectedRouteGuard path="/units"><UnitDetails /></RoleProtectedRouteGuard>} />
          <Route path="/crm-leads" element={<RoleProtectedRouteGuard path="/crm-leads"><CrmLeads /></RoleProtectedRouteGuard>} />
          <Route path="/crm/leads/:id" element={<RoleProtectedRouteGuard path="/crm-leads"><CrmLeadDetails /></RoleProtectedRouteGuard>} />
          <Route path="/bookings" element={<RoleProtectedRouteGuard path="/bookings"><Bookings /></RoleProtectedRouteGuard>} />
          <Route path="/bookings/:id" element={<RoleProtectedRouteGuard path="/bookings"><BookingDetails /></RoleProtectedRouteGuard>} />
          <Route path="/portal" element={<RoleProtectedRouteGuard path="/portal"><CustomerPortal /></RoleProtectedRouteGuard>} />
          <Route path="/approvals" element={<RoleProtectedRouteGuard path="/approvals"><Approvals /></RoleProtectedRouteGuard>} />
          <Route path="/financial-requests" element={<RoleProtectedRouteGuard path="/financial-requests"><FinancialRequests /></RoleProtectedRouteGuard>} />
          <Route path="/sales" element={<RoleProtectedRouteGuard path="/sales"><Sales /></RoleProtectedRouteGuard>} />
          <Route path="/inventory" element={<RoleProtectedRouteGuard path="/inventory"><Inventory /></RoleProtectedRouteGuard>} />
          <Route path="/customers" element={<RoleProtectedRouteGuard path="/customers"><Customers /></RoleProtectedRouteGuard>} />
          <Route path="/customers/:id" element={<RoleProtectedRouteGuard path="/customers"><CustomerDetails /></RoleProtectedRouteGuard>} />
          <Route path="/users" element={<RoleProtectedRouteGuard path="/users"><UsersPage /></RoleProtectedRouteGuard>} />
          <Route path="/roles-permissions" element={<RoleProtectedRouteGuard path="/roles-permissions"><RolesPermissions /></RoleProtectedRouteGuard>} />
          <Route path="/approval-authority" element={<RoleProtectedRouteGuard path="/approval-authority"><ApprovalAuthority /></RoleProtectedRouteGuard>} />
          <Route path="/sessions" element={<RoleProtectedRouteGuard path="/sessions"><SessionManagement /></RoleProtectedRouteGuard>} />
          <Route path="/audit-logs" element={<RoleProtectedRouteGuard path="/audit-logs"><AuditLogs /></RoleProtectedRouteGuard>} />
          <Route path="/settings" element={<RoleProtectedRouteGuard path="/settings"><Settings /></RoleProtectedRouteGuard>} />
        </Routes>
      </div>
    </div>
  );
}
