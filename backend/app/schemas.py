from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime, date

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

# Division Schemas
class DivisionBase(BaseModel):
    name: str
    code: str
    tenant_name: Optional[str] = "Default Tenant"
    is_active: Optional[bool] = True

class DivisionCreate(DivisionBase):
    pass

class DivisionResponse(DivisionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Tenant Setting Schemas
class TenantSettingResponse(BaseModel):
    id: int
    tenant_name: str
    is_p2_enabled: bool
    is_funding_mode_enabled: bool
    updated_at: datetime

    class Config:
        from_attributes = True

class TenantSettingUpdate(BaseModel):
    is_p2_enabled: Optional[bool] = None
    is_funding_mode_enabled: Optional[bool] = None

class ProjectBase(BaseModel):
    name: str
    code: str
    tenant_name: Optional[str] = "Default Tenant"
    division_id: Optional[int] = None
    division_name: Optional[str] = None
    contract_type: Optional[str] = "Item Rate"
    funding_mode: Optional[str] = "Budgeted"
    client_id: Optional[int] = None
    manager_id: Optional[int] = None
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_date: datetime
    end_date: datetime
    contract_duration_days: Optional[int] = 0
    budget: float
    status: Optional[str] = "DRAFT"

class ProjectCreate(ProjectBase):
    pass

class WbsTaskBase(BaseModel):
    project_id: int
    parent_task_id: Optional[int] = None
    wbs_code: Optional[str] = None
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
    wbs_code: Optional[str] = None
    title: Optional[str] = None
    contractor_name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    planned_qty: Optional[float] = None
    planned_budget: Optional[float] = None
    progress_pct: Optional[float] = None

class WbsTaskResponse(WbsTaskBase):
    id: int
    progress_pct: Optional[float] = 0.0
    status: Optional[str] = "not_started"
    created_at: datetime
    required_till_now: Optional[float] = 0.0
    remaining_budget: Optional[float] = 0.0
    budget_utilization_pct: Optional[float] = 0.0
    linked_boqs: Optional[List[dict]] = []
    has_date_inconsistency: Optional[bool] = False
    inconsistency_warning: Optional[str] = None

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

class SiteLogPhotoResponse(BaseModel):
    id: int
    site_log_id: int
    project_id: int
    phase_id: Optional[int] = None
    task_id: Optional[int] = None
    subtask_id: Optional[int] = None
    boq_item_id: Optional[int] = None
    file_name: str
    file_path: str
    file_size: Optional[int] = 0
    file_type: Optional[str] = None
    caption: Optional[str] = None
    uploaded_by_id: Optional[int] = None
    created_at: datetime
    uploader_name: Optional[str] = None
    project_name: Optional[str] = None
    phase_name: Optional[str] = None
    task_name: Optional[str] = None

    class Config:
        from_attributes = True

class DailyTaskMonitoringBase(BaseModel):
    project_id: Optional[int] = None
    work_plan_id: int
    boq_mapping_id: Optional[int] = None
    boq_item_id: Optional[int] = None
    log_date: Optional[datetime] = None
    task_status: Optional[str] = "NOT STARTED"
    executed_quantity: Optional[float] = 0.0
    unit: Optional[str] = None
    execution_notes: Optional[str] = None
    delay_reason: Optional[str] = None

class DailyTaskMonitoringCreate(DailyTaskMonitoringBase):
    pass

class DailyTaskMonitoringResponse(DailyTaskMonitoringBase):
    id: int
    daily_site_log_id: int
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    work_plan_number: Optional[str] = None
    activity_name: Optional[str] = None
    work_plan_name: Optional[str] = None
    wbs_phase_id: Optional[int] = None
    task_id: Optional[int] = None
    subtask_id: Optional[int] = None
    phase_name: Optional[str] = None
    task_name: Optional[str] = None
    subtask_name: Optional[str] = None
    planned_quantity: float = 0.0
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    priority: Optional[str] = None
    boq_code: Optional[str] = None
    boq_description: Optional[str] = None
    is_future_activity: bool = False
    is_delayed_activity: bool = False
    warning_message: Optional[str] = None

    class Config:
        from_attributes = True

class SiteDailyLogCreate(SiteDailyLogBase):
    daily_tasks: Optional[List[DailyTaskMonitoringCreate]] = []

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
    new_cumulative_qty: Optional[float] = 0.0
    total_executed_qty: Optional[float] = 0.0
    remaining_qty: Optional[float] = 0.0
    execution_pct: Optional[float] = 0.0
    photos: List[SiteLogPhotoResponse] = []
    daily_tasks: List[DailyTaskMonitoringResponse] = []
    execution_history: List[dict] = []
    phase_name: Optional[str] = None
    task_name: Optional[str] = None
    subtask_name: Optional[str] = None

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

class BoqItemUpdate(BaseModel):
    project_id: Optional[int] = None
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
    wbs_code: Optional[str] = None
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

# --- SCHEDULE OF RATES (SOR) SCHEMAS ---

class SorEditionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    effective_date: Optional[datetime] = None
    status: Optional[str] = "Active"

class SorEditionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    effective_date: Optional[datetime] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class SorRegionCreate(BaseModel):
    code: Optional[str] = None
    name: str
    status: Optional[str] = "Active"

class SorRegionResponse(BaseModel):
    id: int
    code: Optional[str] = None
    name: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ScheduleOfRatesBase(BaseModel):
    sor_edition_id: Optional[int] = None
    sor_region_id: Optional[int] = None
    sor_edition_name: Optional[str] = None
    sor_region_name: Optional[str] = None
    sor_code: str
    description: str
    category: str
    unit: str
    base_rate: Optional[float] = None
    cost_index: Optional[float] = 1.0000
    rate: Optional[float] = None  # Backward compatibility
    effective_from: datetime
    status: Optional[str] = "Active"

class ScheduleOfRatesCreate(BaseModel):
    sor_edition_id: Optional[int] = None
    sor_region_id: Optional[int] = None
    sor_edition_name: Optional[str] = None
    sor_region_name: Optional[str] = None
    sor_code: str
    description: str
    category: str
    unit: str
    base_rate: Optional[float] = None
    rate: Optional[float] = None
    cost_index: Optional[float] = 1.0000
    effective_from: datetime
    status: Optional[str] = "Active"

class ScheduleOfRatesUpdate(BaseModel):
    sor_edition_id: Optional[int] = None
    sor_region_id: Optional[int] = None
    sor_code: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    base_rate: Optional[float] = None
    rate: Optional[float] = None
    cost_index: Optional[float] = None
    effective_from: Optional[datetime] = None
    status: Optional[str] = None

class ScheduleOfRatesResponse(ScheduleOfRatesBase):
    id: int
    base_rate: float
    cost_index: float
    adjusted_rate: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SorImportRowError(BaseModel):
    row_number: int
    field: str
    error: str
    existing_value: Optional[str] = None

class SorImportPreviewResponse(BaseModel):
    total_rows: int
    valid_rows_count: int
    invalid_rows_count: int
    warnings_count: int
    errors: List[SorImportRowError]
    valid_items: List[dict]

class SorImportCommitRequest(BaseModel):
    items: List[dict]


# --- PROJECT ESTIMATION SCHEMAS ---

class EstimateLineSaveInput(BaseModel):
    boq_item_id: int
    sor_item_id: Optional[int] = None
    rate_source: Optional[str] = "SOR"  # "SOR", "NON_SOR", "MANUAL_OVERRIDE"
    quantity: float
    manual_rate: Optional[float] = None
    is_manual_override: Optional[bool] = False
    justification_note: Optional[str] = None
    sor_rate_snapshot: Optional[float] = None
    estimated_amount: Optional[float] = None

class EstimateSaveRequest(BaseModel):
    project_id: int
    status: Optional[str] = "DRAFT"
    contingency_percent: Optional[float] = 5.0
    departmental_charges_percent: Optional[float] = 2.0
    lines: List[EstimateLineSaveInput]

class EstimateLineResponse(BaseModel):
    id: int
    estimate_id: int
    boq_item_id: int
    sor_item_id: Optional[int] = None
    rate_source: Optional[str] = "SOR"
    quantity: float
    manual_rate: Optional[float] = None
    is_manual_override: Optional[bool] = False
    justification_note: Optional[str] = None
    sor_rate_snapshot: Optional[float] = None
    effective_rate: Optional[float] = None
    estimated_amount: Optional[float] = None
    boq_item_name: Optional[str] = None
    boq_unit: Optional[str] = None
    boq_category: Optional[str] = None
    boq_rate: Optional[float] = None
    boq_amount: Optional[float] = None
    sor_code: Optional[str] = None
    sor_description: Optional[str] = None
    sor_unit: Optional[str] = None
    sor_rate: Optional[float] = None
    is_unit_compatible: Optional[bool] = True

    class Config:
        from_attributes = True

class CategoryEstimateSummary(BaseModel):
    category: str
    total_amount: float
    item_count: int

class ProjectEstimateResponse(BaseModel):
    id: int
    estimate_number: str
    project_id: int
    project_name: Optional[str] = None
    status: str
    base_amount: Optional[float] = 0.0
    contingency_percent: Optional[float] = 5.0
    contingency_amount: Optional[float] = 0.0
    departmental_charges_percent: Optional[float] = 2.0
    departmental_charges_amount: Optional[float] = 0.0
    total_amount: float
    is_ee_review_required: Optional[bool] = False
    ee_review_reason: Optional[str] = None
    ts_status: Optional[str] = "PENDING"
    is_ts_locked: Optional[bool] = False
    revision_number: Optional[int] = 0
    original_estimate_id: Optional[int] = None
    is_revised: Optional[bool] = False
    total_boq_items: int
    mapped_count: int
    unmapped_count: int
    created_at: datetime
    updated_at: datetime
    lines: List[EstimateLineResponse] = []
    category_summaries: List[CategoryEstimateSummary] = []

    class Config:
        from_attributes = True

# --- CONTRACTOR AWARD SCHEMAS ---

class ContractorAwardBase(BaseModel):
    project_id: int
    contractor_id: int
    award_amount: Optional[float] = 0.0
    award_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    remarks: Optional[str] = None
    status: Optional[str] = "DRAFT"

class ContractorAwardCreate(ContractorAwardBase):
    pass

class ContractorAwardUpdate(BaseModel):
    contractor_id: Optional[int] = None
    award_amount: Optional[float] = None
    award_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    remarks: Optional[str] = None
    status: Optional[str] = None

class ContractorAwardResponse(ContractorAwardBase):
    id: int
    award_reference: str
    estimate_id: int
    estimated_amount: float
    variance_amount: float
    variance_percentage: float
    created_at: datetime
    updated_at: datetime
    project_name: Optional[str] = None
    project_code: Optional[str] = None
    contractor_name: Optional[str] = None
    contractor_code: Optional[str] = None
    estimate_number: Optional[str] = None
    estimate_status: Optional[str] = None

    class Config:
        from_attributes = True

class ReadyProjectForAward(BaseModel):
    project_id: int
    project_name: str
    project_code: str
    estimate_id: int
    estimate_number: str
    estimated_amount: float
    estimate_status: str

    class Config:
        from_attributes = True

# --- WORK ORDER SCHEMAS ---

class WorkOrderBase(BaseModel):
    award_id: int
    project_id: int
    contractor_id: int
    issue_date: Optional[datetime] = None
    scope_of_work: str
    description: Optional[str] = None
    work_order_value: float
    start_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    payment_terms: Optional[str] = None
    terms_conditions: Optional[str] = None
    remarks: Optional[str] = None
    included_packages: Optional[str] = None
    status: Optional[str] = "DRAFT"

class WorkOrderCreate(WorkOrderBase):
    pass

class WorkOrderUpdate(BaseModel):
    scope_of_work: Optional[str] = None
    description: Optional[str] = None
    work_order_value: Optional[float] = None
    issue_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    payment_terms: Optional[str] = None
    terms_conditions: Optional[str] = None
    remarks: Optional[str] = None
    included_packages: Optional[str] = None
    status: Optional[str] = None

class WorkOrderCancelRequest(BaseModel):
    cancellation_reason: str

class WorkOrderResponse(WorkOrderBase):
    id: int
    work_order_number: str
    cancellation_reason: Optional[str] = None
    award_reference: Optional[str] = None
    award_amount: Optional[float] = None
    award_date: Optional[datetime] = None
    project_name: Optional[str] = None
    project_code: Optional[str] = None
    contractor_name: Optional[str] = None
    contractor_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class EligibleAwardForWO(BaseModel):
    award_id: int
    award_reference: str
    project_id: int
    project_name: str
    project_code: str
    contractor_id: int
    contractor_name: str
    contractor_code: str
    award_amount: float
    award_date: datetime
    start_date: datetime
    completion_date: datetime

    class Config:
        from_attributes = True


class WorkPlanBase(BaseModel):
    project_id: int
    wbs_phase_id: int
    task_id: int
    subtask_id: Optional[int] = None
    activity_name: str
    description: Optional[str] = None
    planned_quantity: float = Field(default=0.0, ge=0.0)
    unit: str = "m³"
    planned_start_date: datetime
    planned_end_date: datetime
    priority: Optional[str] = "MEDIUM"
    dependency_id: Optional[int] = None
    responsible_team_id: Optional[int] = None
    responsible_user_id: Optional[int] = None
    remarks: Optional[str] = None

class WorkPlanCreate(WorkPlanBase):
    pass

class WorkPlanUpdate(BaseModel):
    activity_name: Optional[str] = None
    description: Optional[str] = None
    planned_quantity: Optional[float] = None
    unit: Optional[str] = None
    planned_start_date: Optional[datetime] = None
    planned_end_date: Optional[datetime] = None
    priority: Optional[str] = None
    dependency_id: Optional[int] = None
    responsible_team_id: Optional[int] = None
    responsible_user_id: Optional[int] = None
    remarks: Optional[str] = None
    status: Optional[str] = None

class WorkPlanResponse(WorkPlanBase):
    id: int
    work_plan_number: str
    status: str
    is_archived: bool
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    project_name: Optional[str] = None
    project_code: Optional[str] = None
    phase_name: Optional[str] = None
    task_name: Optional[str] = None
    subtask_name: Optional[str] = None
    dependency_activity_name: Optional[str] = None
    responsible_user_name: Optional[str] = None
    progress_percentage: float = 0.0

    mapped_boq_count: int = 0
    total_boq_mapped_qty: float = 0.0
    boq_mapping_status: str = "Not Mapped"

    class Config:
        from_attributes = True


class WorkPlanBoqMappingBase(BaseModel):
    boq_item_id: int
    mapped_quantity: float = Field(..., gt=0.0)
    unit: Optional[str] = None

class WorkPlanBoqMappingCreate(WorkPlanBoqMappingBase):
    pass

class WorkPlanBoqMappingUpdate(BaseModel):
    mapped_quantity: float = Field(..., gt=0.0)

class WorkPlanBoqMappingResponse(BaseModel):
    id: int
    work_plan_id: int
    boq_item_id: int
    project_id: int
    mapped_quantity: float
    unit: str
    created_at: datetime
    updated_at: datetime

    boq_code: Optional[str] = None
    boq_description: Optional[str] = None
    boq_unit: Optional[str] = None
    boq_total_quantity: float = 0.0
    total_allocated_quantity: float = 0.0
    remaining_quantity: float = 0.0
    rate: float = 0.0
    estimated_amount: float = 0.0
    mapping_status: str = "PARTIALLY MAPPED"

    class Config:
        from_attributes = True

class EligibleBoqItemForMappingResponse(BaseModel):
    boq_item_id: int
    boq_code: str
    item_name: str
    unit: str
    approved_qty: float
    total_allocated_qty: float
    remaining_unmapped_qty: float
    rate: float
    total_amount: float
    is_unit_compatible: bool = True
    compatibility_warning: Optional[str] = None

    class Config:
        from_attributes = True


class TaskAssignmentBase(BaseModel):
    project_id: int
    wbs_phase_id: int
    task_id: int
    subtask_id: Optional[int] = None
    assigned_user_id: int
    role: Optional[str] = None
    priority: str = "MEDIUM"
    start_date: date
    due_date: date
    remarks: Optional[str] = None

class TaskAssignmentCreate(TaskAssignmentBase):
    pass

class TaskAssignmentUpdate(BaseModel):
    assigned_user_id: Optional[int] = None
    role: Optional[str] = None
    priority: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    remarks: Optional[str] = None
    status: Optional[str] = None

class TaskAssignmentReassign(BaseModel):
    new_user_id: int
    role: Optional[str] = None
    remarks: Optional[str] = None

class TaskAssignmentAuditResponse(BaseModel):
    id: int
    assignment_id: int
    action: str
    previous_user_id: Optional[int] = None
    previous_user_name: Optional[str] = None
    new_user_id: Optional[int] = None
    new_user_name: Optional[str] = None
    changed_by_user_id: Optional[int] = None
    changed_by_user_name: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class WorkPlanReferenceResponse(BaseModel):
    id: int
    work_plan_number: str
    activity_name: str
    planned_quantity: float
    unit: str
    planned_start_date: datetime
    planned_end_date: datetime
    progress_percentage: float = 0.0
    status: str

    class Config:
        from_attributes = True

class TaskAssignmentResponse(TaskAssignmentBase):
    id: int
    assignment_ref: str
    status: str
    is_active: bool
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    project_name: Optional[str] = None
    project_code: Optional[str] = None
    phase_name: Optional[str] = None
    task_name: Optional[str] = None
    subtask_name: Optional[str] = None
    assigned_user_name: Optional[str] = None
    assigned_user_email: Optional[str] = None
    created_by_name: Optional[str] = None

    work_plan_ref: Optional[WorkPlanReferenceResponse] = None
    audits: List[TaskAssignmentAuditResponse] = []

    class Config:
        from_attributes = True


# --- PROJECT TEAM SCHEMAS ---

class ProjectTeamMemberBase(BaseModel):
    project_id: int
    user_id: int
    project_role: str
    department: Optional[str] = None
    responsibility: Optional[str] = None
    joining_date: Optional[date] = None
    remarks: Optional[str] = None

class ProjectTeamMemberCreate(ProjectTeamMemberBase):
    status: Optional[str] = "ACTIVE"

class ProjectTeamMemberUpdate(BaseModel):
    project_role: Optional[str] = None
    department: Optional[str] = None
    responsibility: Optional[str] = None
    joining_date: Optional[date] = None
    status: Optional[str] = None
    remarks: Optional[str] = None

class ProjectTeamAuditResponse(BaseModel):
    id: int
    team_member_id: int
    action: str
    changed_by_user_id: Optional[int] = None
    changed_by_user_name: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ProjectTeamMemberResponse(ProjectTeamMemberBase):
    id: int
    status: str
    is_active: bool
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_app_role: Optional[str] = None
    project_name: Optional[str] = None
    project_code: Optional[str] = None
    task_assignment_count: int = 0
    assigned_tasks: List[TaskAssignmentResponse] = []
    audits: List[ProjectTeamAuditResponse] = []

    class Config:
        from_attributes = True

class ProjectTeamSummary(BaseModel):
    total_members: int = 0
    active_members: int = 0
    project_managers: int = 0
    execution_members: int = 0


# --- NON-SOR RATE ANALYSIS SCHEMAS ---

class NonSorAnalysisCreate(BaseModel):
    project_id: int
    boq_item_id: Optional[int] = None
    item_description: str
    unit: Optional[str] = "Nos"
    market_rate_source: str  # "Vendor Quotation", "Published Index", "Manual Entry"
    market_rate: float
    supporting_document_id: Optional[int] = None
    analysis_remarks: Optional[str] = None

class NonSorAnalysisUpdate(BaseModel):
    item_description: Optional[str] = None
    unit: Optional[str] = None
    market_rate_source: Optional[str] = None
    market_rate: Optional[float] = None
    supporting_document_id: Optional[int] = None
    analysis_remarks: Optional[str] = None

class NonSorAnalysisApproval(BaseModel):
    action: str  # "APPROVE" or "REJECT"
    rejection_reason: Optional[str] = None

class NonSorAnalysisResponse(BaseModel):
    id: int
    project_id: int
    boq_item_id: Optional[int] = None
    item_description: str
    unit: Optional[str] = None
    market_rate_source: str
    market_rate: float
    supporting_document_id: Optional[int] = None
    supporting_document_path: Optional[str] = None
    supporting_document_name: Optional[str] = None
    analysis_remarks: Optional[str] = None
    status: str
    rate_type: str
    is_reconciled: bool
    reconciled_sor_id: Optional[int] = None
    created_by_id: int
    created_by_name: Optional[str] = None
    reviewed_by_id: Optional[int] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ReconcileReportItem(BaseModel):
    id: int
    project_id: int
    item_description: str
    unit: Optional[str] = None
    market_rate: float
    market_rate_source: str
    status: str
    rate_type: str
    is_reconciled: bool
    newer_sor_id: Optional[int] = None
    newer_sor_code: Optional[str] = None
    newer_sor_description: Optional[str] = None
    newer_sor_rate: Optional[float] = None
    newer_sor_edition: Optional[str] = None


# --- TECHNICAL SANCTION SCHEMAS (PSC-07) ---

class TechnicalSanctionSubmitRequest(BaseModel):
    project_id: int
    estimate_id: int
    remarks: Optional[str] = None

class TechnicalSanctionApproveRequest(BaseModel):
    remarks: Optional[str] = None

class TechnicalSanctionRejectRequest(BaseModel):
    rejection_reason: str

class TechnicalSanctionResponse(BaseModel):
    id: int
    project_id: int
    detailed_estimate_id: int
    sanctioning_authority_user_id: Optional[int] = None
    sanctioning_authority_name: Optional[str] = None
    sanction_reference_number: Optional[str] = None
    sanction_date: Optional[datetime] = None
    remarks: Optional[str] = None
    status: str
    rejection_reason: Optional[str] = None
    submitted_at: datetime
    submitted_by_id: int
    submitted_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    approved_by_id: Optional[int] = None
    approved_by_name: Optional[str] = None
    rejected_at: Optional[datetime] = None
    rejected_by_id: Optional[int] = None
    rejected_by_name: Optional[str] = None
    estimate_revision: int
    estimate_total_at_submission: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
