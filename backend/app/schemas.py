from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# User & Auth Schemas
class UserBase(BaseModel):
    username: str
    email: str
    full_name: str
    role: str
    is_active: Optional[bool] = True

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Audit Log Schemas
class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    entity_type: str
    entity_id: int
    payload: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Notification Schemas
class NotificationCreate(BaseModel):
    user_id: int
    title: str
    message: str
    notification_type: Optional[str] = "info"
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Document Schemas
class DocumentResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    file_name: str
    file_path: str
    file_size: int
    file_type: Optional[str] = None
    uploaded_by_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Approval Engine Schemas
class ApprovalTaskCreate(BaseModel):
    title: str
    entity_type: str
    entity_id: int
    current_stage: Optional[str] = None
    request_type: Optional[str] = None
    request_category: Optional[str] = None
    source_module: Optional[str] = None

class ApprovalAction(BaseModel):
    action: str
    comments: Optional[str] = None

class ApprovalLogResponse(BaseModel):
    id: int
    approval_task_id: int
    approver_id: int
    stage: str
    action: str
    comments: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ApprovalStageDetail(BaseModel):
    role: str
    status: str
    approvedBy: Optional[dict] = None
    approvedAt: Optional[str] = None
    rejectedBy: Optional[dict] = None
    rejectedAt: Optional[str] = None
    comments: Optional[str] = None

class ApprovalTaskResponse(BaseModel):
    id: int
    title: str
    entity_type: str
    entity_id: int
    requester_id: int
    current_stage: str
    status: str
    created_at: datetime
    logs: List[ApprovalLogResponse] = []
    is_financial: Optional[bool] = False
    category: Optional[str] = "NON-FINANCIAL (SiteLog)"
    project_id: Optional[int] = None
    approval_stages: Optional[List[dict]] = []

    taskId: Optional[int] = None
    sourceType: Optional[str] = None
    sourceId: Optional[int] = None
    projectId: Optional[int] = None
    submittedBy: Optional[int] = None
    currentApprovalRole: Optional[str] = None
    overallStatus: Optional[str] = None
    approvalStages: Optional[List[dict]] = []

    class Config:
        from_attributes = True

# --- PHASE 2 SCHEMAS ---

class PropertyBase(BaseModel):
    name: str
    code: Optional[str] = None
    property_type: str
    project_id: Optional[int] = None
    location: Optional[str] = None
    status: Optional[str] = "Active"
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    description: Optional[str] = None
    total_buildings: Optional[int] = 0
    total_units: Optional[int] = 0

class PropertyCreate(PropertyBase):
    pass

class BuildingBase(BaseModel):
    property_id: int
    name: str
    code: str
    building_type: Optional[str] = "Tower"
    total_floors: Optional[int] = 1
    total_units: Optional[int] = 0
    status: Optional[str] = "Active"
    address: Optional[str] = None
    description: Optional[str] = None
    completion_date: Optional[datetime] = None

class BuildingCreate(BuildingBase):
    pass

class UnitBase(BaseModel):
    building_id: int
    unit_number: str
    unit_code: Optional[str] = None
    unit_type: str
    floor_number: Optional[int] = 1
    area_sqft: float
    carpet_area: Optional[float] = None
    builtup_area: Optional[float] = None
    facing: Optional[str] = None
    configuration: Optional[str] = None
    rate_per_sqft: Optional[float] = 0.0
    total_price: Optional[float] = 0.0
    status: Optional[str] = "AVAILABLE"
    description: Optional[str] = None

class UnitCreate(UnitBase):
    pass

class UnitResponse(UnitBase):
    id: int
    total_price: float
    created_at: datetime
    building_name: Optional[str] = None
    property_name: Optional[str] = None
    property_id: Optional[int] = None
    project_name: Optional[str] = None
    project_id: Optional[int] = None

    class Config:
        from_attributes = True

class BuildingResponse(BuildingBase):
    id: int
    created_at: datetime
    units: List[UnitResponse] = []

    class Config:
        from_attributes = True

class PropertyResponse(PropertyBase):
    id: int
    created_at: datetime
    buildings: List[BuildingResponse] = []

    class Config:
        from_attributes = True

class CrmLeadBase(BaseModel):
    customer_name: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    property_category: Optional[str] = "Commercial"
    interested_unit_id: Optional[int] = None
    project_id: Optional[int] = None
    property_id: Optional[int] = None
    preferred_unit_type: Optional[str] = None
    budget: Optional[float] = 0.0
    source: Optional[str] = "Website"
    salesperson_id: Optional[int] = None
    stage: Optional[str] = "NEW"
    lead_type: Optional[str] = "Individual"
    priority: Optional[str] = "Medium"
    requirement: Optional[str] = None
    notes: Optional[str] = None
    qualification_notes: Optional[str] = None
    expected_closing_date: Optional[datetime] = None
    requirement_confirmed: Optional[bool] = False
    budget_available: Optional[bool] = False
    decision_maker_identified: Optional[bool] = False

class CrmLeadCreate(CrmLeadBase):
    pass

class CrmFollowupCreate(BaseModel):
    followup_date: datetime
    followup_type: Optional[str] = "Call"
    notes: Optional[str] = None
    next_action: Optional[str] = None
    status: Optional[str] = "Scheduled"

class CrmSiteVisitCreate(BaseModel):
    property_id: Optional[int] = None
    visit_date: datetime
    assigned_executive_id: Optional[int] = None
    notes: Optional[str] = None
    customer_feedback: Optional[str] = None
    interest_level: Optional[str] = "Medium"
    next_action: Optional[str] = None
    status: Optional[str] = "Scheduled"

class LeadQualificationCreate(BaseModel):
    requirement_confirmed: bool = True
    budget_available: bool = True
    property_interest: Optional[str] = None
    decision_maker_identified: bool = True
    expected_purchase_timeline: Optional[str] = None
    qualification_notes: Optional[str] = None

class CrmLeadResponse(CrmLeadBase):
    id: int
    created_at: datetime
    salesperson_name: Optional[str] = None
    property_name: Optional[str] = None
    project_name: Optional[str] = None
    customer_id: Optional[int] = None
    converted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CustomerBase(BaseModel):
    customer_code: Optional[str] = None
    name: str
    contact_person: Optional[str] = None
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    customer_type: Optional[str] = "Individual"
    status: Optional[str] = "active"
    source_lead_id: Optional[int] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    notes: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class PropertyBookingCreate(BaseModel):
    unit_id: int
    customer_id: int
    salesperson_id: Optional[int] = None
    booking_amount: float
    discount: Optional[float] = 0.0
    agreement_status: Optional[str] = "Draft"
    expected_agreement_date: Optional[datetime] = None
    status: Optional[str] = "CONFIRMED"
    remarks: Optional[str] = None
    notes: Optional[str] = None

class BookingCancelRequest(BaseModel):
    cancellation_reason: str

class RecordPaymentRequest(BaseModel):
    payment_amount: float
    payment_date: datetime
    payment_method: Optional[str] = "Bank Transfer"
    reference_number: Optional[str] = None
    remarks: Optional[str] = None

class PaymentInstallmentResponse(BaseModel):
    id: int
    booking_id: int
    installment_name: str
    due_date: datetime
    amount: float
    status: str
    paid_date: Optional[datetime] = None

    class Config:
        from_attributes = True

class PropertyBookingResponse(BaseModel):
    id: int
    booking_number: str
    unit_id: int
    customer_id: int
    booking_amount: float
    total_price: float
    agreement_status: str
    allotment_date: Optional[datetime] = None
    status: str
    created_at: datetime
    unit: Optional[UnitResponse] = None
    installments: List[PaymentInstallmentResponse] = []

    class Config:
        from_attributes = True

# --- PHASE 3 SCHEMAS ---

class ProjectBase(BaseModel):
    name: str
    code: str
    client_id: Optional[int] = None
    manager_id: Optional[int] = None
    location: str
    start_date: datetime
    end_date: datetime
    budget: float
    status: Optional[str] = "active"

class ProjectCreate(ProjectBase):
    pass

class WbsTaskBase(BaseModel):
    project_id: int
    parent_task_id: Optional[int] = None
    title: str
    task_level: Optional[str] = "Task"
    predecessor_id: Optional[int] = None
    contractor_name: Optional[str] = None
    start_date: datetime
    end_date: datetime
    planned_qty: Optional[float] = 0.0
    actual_qty: Optional[float] = 0.0
    planned_budget: Optional[float] = 0.0
    actual_cost: Optional[float] = 0.0
class WbsTaskCreate(WbsTaskBase):
    pass

class WbsTaskUpdate(BaseModel):
    title: Optional[str] = None
    contractor_name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    planned_budget: Optional[float] = None
    progress_pct: Optional[float] = None

class WbsTaskResponse(WbsTaskBase):
    id: int
    created_at: datetime
    required_till_now: Optional[float] = 0.0
    remaining_budget: Optional[float] = 0.0
    budget_utilization_pct: Optional[float] = 0.0
    linked_boqs: Optional[List[dict]] = []

    class Config:
        from_attributes = True

class ProjectResponse(ProjectBase):
    id: int
    actual_cost: float
    progress_pct: float
    created_at: datetime
    tasks: List[WbsTaskResponse] = []

    class Config:
        from_attributes = True

class SiteDailyLogBase(BaseModel):
    project_id: int
    physical_progress: str
    labour_count: Optional[int] = 0
    materials_consumed: Optional[str] = None
    equipment_used: Optional[str] = None
    issues_identified: Optional[str] = None
    remarks: Optional[str] = None
    phase_id: Optional[int] = None
    task_id: Optional[int] = None
    subtask_id: Optional[int] = None
    boq_item_id: Optional[int] = None
    executed_qty: Optional[float] = 0.0

class SiteDailyLogCreate(SiteDailyLogBase):
    pass

class SiteDailyLogResponse(SiteDailyLogBase):
    id: int
    engineer_id: int
    log_date: datetime
    approval_status: str
    created_at: datetime
    boq_item_name: Optional[str] = None
    unit: Optional[str] = None
    approved_qty: Optional[float] = 0.0
    prev_executed_qty: Optional[float] = 0.0
    total_executed_qty: Optional[float] = 0.0
    remaining_qty: Optional[float] = 0.0
    execution_pct: Optional[float] = 0.0

    class Config:
        from_attributes = True

# --- PHASE 4 SCHEMAS ---

class VendorBase(BaseModel):
    name: str
    code: str
    contact_person: Optional[str] = None
    email: str
    phone: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    rating: Optional[float] = 5.0
    status: Optional[str] = "active"

class VendorCreate(VendorBase):
    pass

class VendorResponse(VendorBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class PurchaseRequisitionBase(BaseModel):
    project_id: int
    wbs_phase_id: Optional[int] = None
    wbs_task_id: Optional[int] = None
    wbs_subtask_id: Optional[int] = None
    title: str
    item_name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    estimated_cost: float
    required_date: Optional[datetime] = None
    reason: Optional[str] = None
    source_material_request_id: Optional[int] = None
    mpr_number: Optional[str] = None

class PurchaseRequisitionCreate(PurchaseRequisitionBase):
    pass

class PurchaseRequisitionResponse(PurchaseRequisitionBase):
    id: int
    req_number: str
    requester_id: int
    status: str
    created_at: datetime
    project_name: Optional[str] = None
    wbs_phase_title: Optional[str] = None
    wbs_task_title: Optional[str] = None
    wbs_subtask_title: Optional[str] = None

    class Config:
        from_attributes = True

class PurchaseOrderCreate(BaseModel):
    pr_id: Optional[int] = None
    mpr_id: Optional[int] = None
    project_id: int
    wbs_phase_id: Optional[int] = None
    wbs_task_id: Optional[int] = None
    wbs_subtask_id: Optional[int] = None
    vendor_id: int
    item_name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    delivery_date: Optional[datetime] = None
    po_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    total_amount: float
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    remarks: Optional[str] = None
    status: Optional[str] = "ISSUED"

class PurchaseOrderResponse(BaseModel):
    id: int
    po_number: str
    pr_id: Optional[int] = None
    mpr_id: Optional[int] = None
    project_id: int
    wbs_phase_id: Optional[int] = None
    wbs_task_id: Optional[int] = None
    wbs_subtask_id: Optional[int] = None
    vendor_id: int
    item_name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    delivery_date: Optional[datetime] = None
    po_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    total_amount: float
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    remarks: Optional[str] = None
    status: str
    created_at: datetime
    vendor: Optional[VendorResponse] = None
    project_name: Optional[str] = None
    wbs_phase_title: Optional[str] = None
    wbs_task_title: Optional[str] = None
    wbs_subtask_title: Optional[str] = None
    pr_number: Optional[str] = None
    mpr_number: Optional[str] = None
    received_quantity: Optional[float] = 0.0
    remaining_quantity: Optional[float] = 0.0

    class Config:
        from_attributes = True

class MaterialPurchaseRequestCreate(BaseModel):
    project_id: int
    wbs_phase_id: Optional[int] = None
    wbs_task_id: Optional[int] = None
    wbs_subtask_id: Optional[int] = None
    material_name: str
    material_category: Optional[str] = "General Construction"
    quantity: float
    unit: str
    required_date: Optional[datetime] = None
    estimated_unit_rate: Optional[float] = None
    estimated_cost: float
    reason: Optional[str] = None
    stock_availability: Optional[str] = "Not Available - Purchase Required"
    preferred_vendor_id: Optional[int] = None
    remarks: Optional[str] = None

class MaterialPurchaseRequestResponse(BaseModel):
    id: int
    request_number: str
    project_id: int
    wbs_phase_id: Optional[int] = None
    wbs_task_id: Optional[int] = None
    wbs_subtask_id: Optional[int] = None
    requested_by: int
    material_name: str
    material_category: Optional[str] = "General Construction"
    quantity: float
    unit: str
    required_date: Optional[datetime] = None
    estimated_unit_rate: Optional[float] = None
    estimated_cost: float
    reason: Optional[str] = None
    stock_availability: Optional[str] = "Not Available - Purchase Required"
    preferred_vendor_id: Optional[int] = None
    remarks: Optional[str] = None
    status: str
    current_approval_stage: str
    created_at: datetime
    project_name: Optional[str] = None
    wbs_phase_title: Optional[str] = None
    wbs_task_title: Optional[str] = None
    wbs_subtask_title: Optional[str] = None

    class Config:
        from_attributes = True

class MaterialPurchaseRequestPmAction(BaseModel):
    action: str
    comments: Optional[str] = None

class MaterialDeliveryCreate(BaseModel):
    po_id: int
    received_quantity: float
    delivery_date: Optional[datetime] = None
    delivery_location: Optional[str] = None
    inspection_remarks: Optional[str] = None
    status: Optional[str] = "FULLY_RECEIVED"

class MaterialDeliveryResponse(BaseModel):
    id: int
    delivery_code: str
    po_id: int
    vendor_id: int
    project_id: int
    material_name: str
    ordered_quantity: float
    received_quantity: float
    delivery_date: datetime
    delivery_location: Optional[str] = None
    status: str
    inspection_remarks: Optional[str] = None
    created_at: datetime
    po_number: Optional[str] = None
    vendor_name: Optional[str] = None
    project_name: Optional[str] = None

    class Config:
        from_attributes = True

class BoqItemBase(BaseModel):
    project_id: int
    item_name: str
    unit: str
    approved_qty: float
    rate: float
    contractor_name: Optional[str] = None

class BoqItemCreate(BoqItemBase):
    pass

class BoqItemResponse(BoqItemBase):
    id: int
    total_amount: float
    created_at: datetime

    class Config:
        from_attributes = True

class MeasurementBookBase(BaseModel):
    project_id: int
    boq_item_id: int
    location_zone: str
    measured_qty: float
    remarks: Optional[str] = None

class MeasurementBookCreate(MeasurementBookBase):
    pass

class MeasurementBookResponse(MeasurementBookBase):
    id: int
    engineer_id: int
    log_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True

class ContractorBillCreate(BaseModel):
    project_id: int
    vendor_id: int
    boq_item_id: int
    billed_qty: float
    billed_rate: float

class ContractorBillResponse(BaseModel):
    id: int
    bill_number: str
    project_id: int
    vendor_id: int
    boq_item_id: int
    billed_qty: float
    billed_rate: float
    total_billed_amount: float
    mb_qty: float
    boq_qty: float
    discrepancy_flag: bool
    discrepancy_reason: Optional[str] = None
    status: str
    created_at: datetime
    boq_item: Optional[BoqItemResponse] = None
    vendor: Optional[VendorResponse] = None

    class Config:
        from_attributes = True

# --- PHASE 5 SCHEMAS ---

class HseIncidentBase(BaseModel):
    project_id: int
    incident_type: Optional[str] = "Incident"
    severity: Optional[str] = "medium"
    title: str
    location: str
    description: str
    immediate_action: Optional[str] = None
    root_cause: Optional[str] = None

class HseIncidentCreate(HseIncidentBase):
    pass

class HseIncidentResponse(HseIncidentBase):
    id: int
    incident_code: str
    reporter_id: int
    incident_date: datetime
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class HseCapaBase(BaseModel):
    project_id: int
    incident_id: Optional[int] = None
    problem_description: str
    root_cause: str
    corrective_action: str
    preventive_action: str
    target_date: datetime

class HseCapaCreate(HseCapaBase):
    pass

class HseCapaResponse(HseCapaBase):
    id: int
    capa_code: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class SafetyAuditBase(BaseModel):
    project_id: int
    checklist_type: str
    compliance_score_pct: float
    issues_found: Optional[str] = None

class SafetyAuditCreate(SafetyAuditBase):
    pass

class SafetyAuditResponse(SafetyAuditBase):
    id: int
    audit_code: str
    auditor_id: int
    audit_date: datetime
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class QualityInspectionBase(BaseModel):
    project_id: int
    task_id: Optional[int] = None
    inspection_type: str
    result: Optional[str] = "passed"
    remarks: Optional[str] = None

class QualityInspectionCreate(QualityInspectionBase):
    pass

class QualityInspectionResponse(QualityInspectionBase):
    id: int
    inspection_code: str
    inspector_id: int
    inspection_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True

class QualityNcrCreate(BaseModel):
    project_id: int
    inspection_id: Optional[int] = None
    description: str
    severity: Optional[str] = "major"
    required_action: str

class QualityNcrResponse(BaseModel):
    id: int
    ncr_code: str
    project_id: int
    inspection_id: Optional[int] = None
    inspector_id: int
    description: str
    severity: str
    required_action: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- PHASE 6 SCHEMAS ---

class TenantBase(BaseModel):
    name: str
    company_name: Optional[str] = None
    email: str
    phone: Optional[str] = None
    unit_id: int
    rent_amount: float
    lease_start: datetime
    lease_end: datetime
    security_deposit: Optional[float] = 0.0

class TenantCreate(TenantBase):
    pass

class TenantResponse(TenantBase):
    id: int
    tenant_code: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class HelpdeskTicketBase(BaseModel):
    tenant_id: int
    unit_id: int
    category: str
    priority: Optional[str] = "medium"
    subject: str
    description: str

class HelpdeskTicketCreate(HelpdeskTicketBase):
    pass

class HelpdeskTicketResponse(HelpdeskTicketBase):
    id: int
    ticket_code: str
    assigned_technician_id: Optional[int] = None
    status: str
    created_at: datetime
    tenant: Optional[TenantResponse] = None

    class Config:
        from_attributes = True

class FacilityWorkOrderBase(BaseModel):
    property_id: int
    unit_id: Optional[int] = None
    technician_id: Optional[int] = None
    maintenance_type: Optional[str] = "Preventive"
    description: str
    scheduled_date: datetime
    estimated_cost: Optional[float] = 0.0

class FacilityWorkOrderCreate(FacilityWorkOrderBase):
    pass

class FacilityWorkOrderResponse(FacilityWorkOrderBase):
    id: int
    work_order_code: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class UtilityBillCreate(BaseModel):
    unit_id: int
    utility_type: str
    meter_number: str
    prev_reading: float
    curr_reading: float
    rate_per_unit: float
    due_date: datetime

class UtilityBillResponse(BaseModel):
    id: int
    bill_code: str
    unit_id: int
    utility_type: str
    meter_number: str
    prev_reading: float
    curr_reading: float
    units_consumed: float
    rate_per_unit: float
    total_amount: float
    due_date: datetime
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class VisitorPassBase(BaseModel):
    property_id: int
    unit_id: Optional[int] = None
    visitor_name: str
    visitor_phone: str
    purpose: str

class VisitorPassCreate(VisitorPassBase):
    pass

class VisitorPassResponse(VisitorPassBase):
    id: int
    pass_code: str
    check_in_time: datetime
    check_out_time: Optional[datetime] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- PHASE 7 SCHEMAS (TALLY ACCOUNTING INTEGRATION) ---

class TallySyncQueueCreate(BaseModel):
    voucher_type: str  # Sales, Purchase, Payment, Receipt, Journal
    entity_type: str  # PropertyBooking, PurchaseOrder, ContractorBill, UtilityBill
    entity_id: int
    ledger_name: str
    amount: float
    narration: Optional[str] = None

class TallySyncQueueResponse(BaseModel):
    id: int
    sync_code: str
    voucher_type: str
    entity_type: str
    entity_id: int
    payload_xml: str
    payload_json: str
    status: str
    retry_count: int
    error_log: Optional[str] = None
    synced_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Customer Schemas
class CustomerBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = "active"

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Product Schemas
class ProductBase(BaseModel):
    sku: str
    name: str
    category: str
    price: float
    cost: Optional[float] = 0.0
    stock: int
    min_stock_alert: Optional[int] = 10

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Order Schemas
class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: float

class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    total_price: float

    class Config:
        from_attributes = True

class SalesOrderCreate(BaseModel):
    customer_id: int
    status: Optional[str] = "pending"
    items: List[OrderItemCreate]

class SalesOrderResponse(BaseModel):
    id: int
    order_number: str
    customer_id: int
    total_amount: float
    status: str
    order_date: datetime
    customer: Optional[CustomerResponse] = None

    class Config:
        from_attributes = True

# Dashboard Stats Schema
class DashboardStats(BaseModel):
    total_revenue: float
    total_orders: int
    total_products: int
    total_customers: int
    low_stock_count: int
    pending_approvals_count: int = 0
    unread_notifications_count: int = 0

# BOQ & Measurement Book Schemas
class BoqItemCreate(BaseModel):
    project_id: int
    phase_id: Optional[int] = None
    task_id: Optional[int] = None
    subtask_id: Optional[int] = None
    item_name: str
    unit: str
    approved_qty: float
    rate: float
    vendor_id: Optional[int] = None
    contractor_name: Optional[str] = None

class BoqItemResponse(BaseModel):
    id: int
    project_id: int
    phase_id: Optional[int] = None
    task_id: Optional[int] = None
    subtask_id: Optional[int] = None
    phase_title: Optional[str] = None
    task_title: Optional[str] = None
    subtask_title: Optional[str] = None
    item_name: str
    unit: str
    approved_qty: float
    rate: float
    total_amount: float
    vendor_id: Optional[int] = None
    contractor_name: Optional[str] = None
    executed_qty: float = 0.0
    remaining_qty: float = 0.0
    progress_pct: float = 0.0
    status: str = "ACTIVE"
    created_at: datetime

    class Config:
        from_attributes = True

class MeasurementBookCreate(BaseModel):
    project_id: int
    boq_item_id: int
    phase_id: Optional[int] = None
    task_id: Optional[int] = None
    subtask_id: Optional[int] = None
    location_zone: str
    measured_qty: float
    unit: Optional[str] = None
    remarks: Optional[str] = None

class MeasurementBookResponse(BaseModel):
    id: int
    project_id: int
    boq_item_id: int
    phase_id: Optional[int] = None
    engineer_id: int
    location_zone: str
    measured_qty: float
    unit: Optional[str] = None
    remarks: Optional[str] = None
    log_date: datetime
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class AiChatQueryRequest(BaseModel):
    message: Optional[str] = None
    prompt: Optional[str] = None

class AiChatQueryResponse(BaseModel):
    success: bool
    intent: Optional[str] = None
    source: Optional[str] = None
    answer: Optional[str] = None
    response: Optional[str] = None
    model: Optional[str] = None
    model_used: Optional[str] = None
    error: Optional[str] = None
    target_route: Optional[str] = None
    elapsed_ms: Optional[float] = None
    timestamp: Optional[str] = None

    class Config:
        from_attributes = True

