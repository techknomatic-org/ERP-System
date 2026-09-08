import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const role = localStorage.getItem('erp_role');
  if (role) {
    config.headers['X-User-Role'] = role;
  }
  return config;
});

export const authService = {
  getUsers: () => api.get('/auth/users'),
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  switchRole: (userId, newRole) => api.post(`/auth/switch-role/${userId}/${newRole}`),
  updateUserProfile: (userId, data) => api.put(`/auth/users/${userId}`, data),
  toggleUserStatus: (userId) => api.post(`/auth/users/${userId}/toggle-status`),
  resetUserPassword: (userId, newPassword) => api.post(`/auth/users/${userId}/reset-password`, { new_password: newPassword }),
};

export const dashboardService = {
  getSummary: (params = {}) => api.get('/dashboard/summary', { params }),
  getStats: () => api.get('/dashboard/stats'),
  getRecentOrders: () => api.get('/dashboard/recent-orders'),
};

export const inventoryService = {
  getProducts: () => api.get('/inventory/products'),
  createProduct: (data) => api.post('/inventory/products', data),
  updateProduct: (id, data) => api.put(`/inventory/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/inventory/products/${id}`),
};

export const salesService = {
  getOrders: () => api.get('/sales/orders'),
  createOrder: (data) => api.post('/sales/orders', data),
};

export const customerService = {
  getCustomers: (params = {}) => api.get('/customers/', { params }),
  getCustomerById: (id) => api.get(`/customers/${id}`),
  createCustomer: (data) => api.post('/customers/', data),
  updateCustomer: (id, data) => api.put(`/customers/${id}`, data),
};

export const approvalService = {
  getTasks: (userRole = null, statusFilter = 'pending') => {
    const params = {};
    if (userRole) params.user_role = userRole;
    if (statusFilter) params.status_filter = statusFilter;
    return api.get('/approvals/tasks', { params });
  },
  createTask: (data) => api.post('/approvals/tasks', data),
  processAction: (taskId, action, comments, userRole = null) => {
    const params = userRole ? { user_role_param: userRole } : {};
    return api.post(`/approvals/tasks/${taskId}/action`, { action, comments }, { params });
  },
  getTaskDetails: (taskId) => api.get(`/approvals/tasks/${taskId}/details`),
};

export const notificationService = {
  getUserNotifications: (userId = 1) => api.get(`/notifications/user/${userId}`),
  markAsRead: (notifId) => api.put(`/notifications/${notifId}/read`),
};

export const auditService = {
  getLogs: (params = {}) => api.get('/audit/logs', { params }),
};

export const documentService = {
  getDocuments: (entityType, entityId) => api.get(`/documents/${entityType}/${entityId}`),
  uploadDocument: (formData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

// PHASE 2 SERVICES
export const propertyService = {
  getProperties: (projectId = null, status = null) => api.get('/properties/', { params: { project_id: projectId, status } }),
  getPropertyById: (id) => api.get(`/properties/${id}`),
  createProperty: (data) => api.post('/properties/', data),
  updateProperty: (id, data) => api.put(`/properties/${id}`, data),
  createBuilding: (data) => api.post('/properties/buildings', data),
  getUnits: (status = null) => api.get('/properties/units', { params: { status } }),
  createUnit: (data) => api.post('/properties/units', data),
};

export const buildingService = {
  getBuildings: (propertyId = null, status = null) => api.get('/buildings/', { params: { property_id: propertyId, status } }),
  getBuildingById: (id) => api.get(`/buildings/${id}`),
  createBuilding: (data) => api.post('/buildings/', data),
  updateBuilding: (id, data) => api.put(`/buildings/${id}`, data),
};

export const unitInventoryService = {
  getUnits: (params = {}) => api.get('/units/', { params }),
  getKpis: () => api.get('/units/kpis'),
  getUnitById: (id) => api.get(`/units/${id}`),
  createUnit: (data) => api.post('/units/', data),
  updateUnit: (id, data) => api.put(`/units/${id}`, data),
};

export const crmLeadService = {
  getLeads: (params = {}) => api.get('/crm/leads/', { params: typeof params === 'string' ? { stage: params } : params }),
  getKpis: () => api.get('/crm/leads/kpis'),
  getLeadById: (id) => api.get(`/crm/leads/${id}`),
  createLead: (data) => api.post('/crm/leads/', data),
  updateLead: (id, data) => api.put(`/crm/leads/${id}`, data),
  updateStage: (leadId, newStage) => api.put(`/crm/leads/${leadId}/stage`, null, { params: { new_stage: newStage } }),
  qualifyLead: (leadId, data) => api.post(`/crm/leads/${leadId}/qualify`, data),
  getFollowups: (leadId) => api.get(`/crm/leads/${leadId}/followups`),
  createFollowup: (leadId, data) => api.post(`/crm/leads/${leadId}/followups`, data),
  updateFollowup: (followupId, data) => api.put(`/crm/leads/followups/${followupId}`, data),
  getSiteVisits: (leadId) => api.get(`/crm/leads/${leadId}/site-visits`),
  createSiteVisit: (leadId, data) => api.post(`/crm/leads/${leadId}/site-visits`, data),
  updateSiteVisit: (siteVisitId, data) => api.put(`/crm/leads/site-visits/${siteVisitId}`, data),
  convertLead: (leadId) => api.post(`/crm/leads/${leadId}/convert`),
};

export const bookingService = {
  getBookings: (params = {}) => api.get('/bookings/', { params }),
  getKpis: () => api.get('/bookings/kpis'),
  getBookingById: (id) => api.get(`/bookings/${id}`),
  createBooking: (data) => api.post('/bookings/', data),
  cancelBooking: (id, data) => api.post(`/bookings/${id}/cancel`, data),
  allotUnit: (bookingId) => api.put(`/bookings/${bookingId}/allot`),
  payInstallment: (installmentId) => api.put(`/bookings/installments/${installmentId}/pay`),
};

export const paymentService = {
  getPaymentSchedule: (bookingId) => api.get(`/bookings/${bookingId}/payment-schedule`),
  recordPayment: (installmentId, data) => api.post(`/installments/${installmentId}/payments`, data),
  getCustomerPayments: (customerId) => api.get(`/customers/${customerId}/payments`),
};

export const portalService = {
  getCustomerPortal: (customerId = 6) => api.get(`/portal/customer/${customerId}`),
  getPortalCustomersList: () => api.get('/portal/customers/list'),
};

// PHASE 3 SERVICES
export const projectService = {
  getProjects: (status = null) => api.get('/projects/', { params: { status } }),
  getProjectById: (id) => api.get(`/projects/${id}`),
  createProject: (data) => api.post('/projects/', data),
  updateProject: (id, data) => api.put(`/projects/${id}`, data),
  getDivisions: (activeOnly = true) => api.get('/projects/divisions', { params: { active_only: activeOnly } }),
  createDivision: (data) => api.post('/projects/divisions', data),
  toggleDivisionActive: (id, isActive = null) => api.put(`/projects/divisions/${id}/deactivate`, null, { params: { is_active: isActive } }),
  getTenantSettings: () => api.get('/projects/tenant-settings'),
  updateTenantSettings: (data) => api.put('/projects/tenant-settings', data),
};

export const wbsService = {
  getProjectWbs: (projectId) => api.get(`/wbs/project/${projectId}`),
  createTask: (data) => api.post('/wbs/tasks', data),
  updateTask: (taskId, data) => api.put(`/wbs/tasks/${taskId}`, data),
  updateProgress: (taskId, progressPct, actualQty = null, actualCost = null) => 
    api.put(`/wbs/tasks/${taskId}/progress`, null, { params: { progress_pct: progressPct, actual_qty: actualQty, actual_cost: actualCost } }),
  deleteTask: (taskId) => api.delete(`/wbs/tasks/${taskId}`),
};

export const siteLogService = {
  getProjectLogs: (projectId) => api.get(`/site-logs/project/${projectId}`),
  getLogById: (logId) => api.get(`/site-logs/${logId}`),
  createLog: (data) => api.post('/site-logs/', data),
  updateLog: (logId, data) => api.put(`/site-logs/${logId}`, data),
  getWorkPlanContext: (wpId) => api.get(`/site-logs/work-plan-context/${wpId}`),
  uploadPhotos: (siteLogId, formData) => api.post(`/site-logs/${siteLogId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getPhotoGallery: (params = {}) => api.get('/site-logs/photos/gallery', { params }),
  deletePhoto: (photoId) => api.delete(`/site-logs/photos/${photoId}`),
};

// PHASE 4 SERVICES
export const vendorService = {
  getVendors: () => api.get('/vendors/'),
  createVendor: (data) => api.post('/vendors/', data),
};

export const procurementService = {
  getKpis: () => api.get('/procurement/kpis'),
  getActiveVendors: () => api.get('/procurement/active-vendors'),
  getMaterialRequests: (status = null) => api.get('/procurement/material-requests', { params: { status } }),
  getApprovedMprs: () => api.get('/procurement/approved-mprs'),
  createMaterialRequest: (data) => api.post('/procurement/material-requests', data),
  processMprPmAction: (mprId, action, comments) => api.post(`/procurement/material-requests/${mprId}/pm-action`, { action, comments }),
  createLowStockMpr: (productId) => api.post(`/procurement/create-low-stock-mpr/${productId}`),
  getPrs: () => api.get('/procurement/pr'),
  getApprovedPrs: () => api.get('/procurement/approved-prs'),
  createPr: (data) => api.post('/procurement/pr', data),
  getPos: () => api.get('/procurement/po'),
  createPo: (data) => api.post('/procurement/po', data),
  getDeliveries: () => api.get('/procurement/deliveries'),
  recordDelivery: (data) => api.post('/procurement/deliveries', data),
  getHistory: () => api.get('/procurement/history'),
  getTraceabilityChain: () => api.get('/procurement/traceability'),
};

export const boqMbService = {
  getBoqItems: (projectId) => api.get(`/boq-mb/boq/project/${projectId}`),
  getWbsHierarchy: (projectId) => api.get(`/boq-mb/wbs-hierarchy/${projectId}`),
  createBoqItem: (data) => api.post('/boq-mb/boq', data),
  updateBoqItem: (boqId, data) => api.put(`/boq-mb/boq/${boqId}`, data),
  getMbRecords: (boqItemId) => api.get(`/boq-mb/mb/boq/${boqItemId}`),
  recordMb: (data) => api.post('/boq-mb/mb', data),
  createMaterialRequest: (data) => api.post('/boq-mb/material-request', data),
  createContractorBill: (data) => api.post('/boq-mb/contractor-bill', data),
};

export const contractorBillingService = {
  getBills: () => api.get('/contractor-billing/bills'),
  submitBill: (data) => api.post('/contractor-billing/bills', data),
};

// PHASE 5 SERVICES
export const hseService = {
  getIncidents: () => api.get('/hse/incidents'),
  createIncident: (data) => api.post('/hse/incidents', data),
  getCapas: () => api.get('/hse/capas'),
  createCapa: (data) => api.post('/hse/capas', data),
  getAudits: () => api.get('/hse/audits'),
  createAudit: (data) => api.post('/hse/audits', data),
};

export const qualityService = {
  getInspections: () => api.get('/quality/inspections'),
  createInspection: (data) => api.post('/quality/inspections', data),
  getNcrs: () => api.get('/quality/ncrs'),
  updateNcrStatus: (ncrId, status) => api.put(`/quality/ncrs/${ncrId}/status`, null, { params: { new_status: status } }),
};

// PHASE 6 SERVICES
export const facilityService = {
  getTenants: () => api.get('/facility/tenants'),
  createTenant: (data) => api.post('/facility/tenants', data),
  getTickets: () => api.get('/facility/tickets'),
  createTicket: (data) => api.post('/facility/tickets', data),
  updateTicketStatus: (ticketId, status) => api.put(`/facility/tickets/${ticketId}/status`, null, { params: { new_status: status } }),
  getWorkOrders: () => api.get('/facility/work-orders'),
  createWorkOrder: (data) => api.post('/facility/work-orders', data),
  getUtilityBills: () => api.get('/facility/utility-bills'),
  createUtilityBill: (data) => api.post('/facility/utility-bills', data),
  getVisitorPasses: () => api.get('/facility/visitor-passes'),
  createVisitorPass: (data) => api.post('/facility/visitor-passes', data),
  checkoutVisitorPass: (passId) => api.put(`/facility/visitor-passes/${passId}/checkout`),
};

// PHASE 7 SERVICES
export const tallyService = {
  getQueue: () => api.get('/tally/queue'),
  enqueueVoucher: (data) => api.post('/tally/queue', data),
  syncVoucher: (syncId) => api.post(`/tally/queue/${syncId}/sync`),
  syncAll: () => api.post('/tally/sync-all'),
};

// PHASE 8 SERVICES
export const aiService = {
  getInsights: () => api.get('/ai/analytics/insights'),
  parseInvoiceOcr: (fileName = 'vendor_invoice_sample.pdf') => {
    const formData = new FormData();
    formData.append('file_name', fileName);
    return api.post('/ai/ocr/parse-invoice', formData);
  },
  uploadInvoiceOcr: (formData) => api.post('/ai/ocr/upload-invoice', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  verifyAndMatchOcr: (data) => api.post('/ai/ocr/verify-and-match', data),
  submitOcrFinancialRequest: (data) => api.post('/ai/ocr/submit-financial-request', data),
  queryChat: (prompt, role = null) => {
    const headers = role ? { 'X-User-Role': role } : {};
    return api.post('/ai/chat', { message: prompt }, { headers, timeout: 10000 });
  },
};

export const sorService = {
  getSorItems: (params = {}) => api.get('/schedule-of-rates/', { params }),
  getSorById: (id) => api.get(`/schedule-of-rates/${id}`),
  createSorItem: (data) => api.post('/schedule-of-rates/', data),
  updateSorItem: (id, data) => api.put(`/schedule-of-rates/${id}`, data),
  toggleSorStatus: (id, newStatus = null) => api.patch(`/schedule-of-rates/${id}/status`, null, { params: { new_status: newStatus } }),
  getEditions: () => api.get('/schedule-of-rates/editions'),
  createEdition: (data) => api.post('/schedule-of-rates/editions', data),
  updateEditionCostIndex: (editionId, costIndex, regionId = null) => api.put(`/schedule-of-rates/editions/${editionId}/cost-index`, null, { params: { cost_index: costIndex, region_id: regionId } }),
  getRegions: () => api.get('/schedule-of-rates/regions'),
  createRegion: (data) => api.post('/schedule-of-rates/regions', data),
  lookupSorRate: (params) => api.get('/schedule-of-rates/lookup', { params }),
  importPreview: (formData) => api.post('/schedule-of-rates/import-preview', formData),
  importCommit: (items) => api.post('/schedule-of-rates/import-commit', { items }),
};

export const estimationService = {
  getEstimateByProject: (projectId) => api.get(`/estimation/project/${projectId}`),
  saveEstimate: (data) => api.post('/estimation/save', data),
  submitForReview: (estimateId) => api.post(`/estimation/submit-review/${estimateId}`),
  approveTs: (estimateId) => api.post(`/estimation/approve-ts/${estimateId}`),
  createRevisedDe: (estimateId) => api.post(`/estimation/create-revised-de/${estimateId}`),
  getEstimatesList: () => api.get('/estimation/list'),
};

export const contractorAwardsService = {
  getReadyProjects: () => api.get('/contractor-awards/ready-projects'),
  getAwards: (params = {}) => api.get('/contractor-awards', { params }),
  getAwardById: (id) => api.get(`/contractor-awards/${id}`),
  createAward: (data) => api.post('/contractor-awards', data),
  updateAward: (id, data) => api.put(`/contractor-awards/${id}`, data),
  submitForApproval: (id) => api.post(`/contractor-awards/${id}/submit`),
  finalizeAward: (id) => api.post(`/contractor-awards/${id}/finalize`),
  cancelAward: (id) => api.post(`/contractor-awards/${id}/cancel`),
};

export const workOrderService = {
  getEligibleAwards: () => api.get('/work-orders/eligible-awards'),
  getWorkOrders: (params = {}) => api.get('/work-orders', { params }),
  getWorkOrderById: (id) => api.get(`/work-orders/${id}`),
  createWorkOrder: (data) => api.post('/work-orders', data),
  updateWorkOrder: (id, data) => api.put(`/work-orders/${id}`, data),
  issueWorkOrder: (id) => api.post(`/work-orders/${id}/issue`),
  cancelWorkOrder: (id, reason) => api.post(`/work-orders/${id}/cancel`, { cancellation_reason: reason }),
};

export const workPlanService = {
  getWorkPlans: (params = {}) => api.get('/work-plans', { params }),
  getWorkPlanById: (id) => api.get(`/work-plans/${id}`),
  createWorkPlan: (data) => api.post('/work-plans', data),
  updateWorkPlan: (id, data) => api.put(`/work-plans/${id}`, data),
  deleteWorkPlan: (id) => api.delete(`/work-plans/${id}`),
  getBoqMappings: (wpId) => api.get(`/work-plans/${wpId}/boq-mappings`),
  getEligibleBoqItems: (wpId) => api.get(`/work-plans/${wpId}/eligible-boq-items`),
  createBoqMapping: (wpId, data) => api.post(`/work-plans/${wpId}/boq-mappings`, data),
  updateBoqMapping: (mappingId, data) => api.put(`/work-plans/boq-mappings/${mappingId}`, data),
  deleteBoqMapping: (mappingId) => api.delete(`/work-plans/boq-mappings/${mappingId}`),
};

export const userService = {
  getUsers: () => api.get('/auth/users'),
};

export const taskAssignmentService = {
  getAssignments: (params = {}) => api.get('/task-assignments', { params }),
  getAssignmentById: (id) => api.get(`/task-assignments/${id}`),
  createAssignment: (data) => api.post('/task-assignments', data),
  updateAssignment: (id, data) => api.put(`/task-assignments/${id}`, data),
  reassignTask: (id, data) => api.post(`/task-assignments/${id}/reassign`, data),
  deleteAssignment: (id) => api.delete(`/task-assignments/${id}`),
};

export const projectTeamService = {
  getEligibleUsers: () => api.get('/project-teams/eligible-users'),
  getProjectTeam: (projectId) => api.get(`/project-teams/project/${projectId}`),
  getTeamMemberDetail: (memberId) => api.get(`/project-teams/${memberId}`),
  createTeamMember: (data) => api.post('/project-teams', data),
  updateTeamMember: (memberId, data) => api.put(`/project-teams/${memberId}`, data),
  toggleMemberStatus: (memberId) => api.post(`/project-teams/${memberId}/toggle-status`),
  removeTeamMember: (memberId) => api.delete(`/project-teams/${memberId}`),
};

export const systemService = {
  getHealth: () => api.get('/system/health'),
};

export default api;
