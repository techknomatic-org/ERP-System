from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(30), default="admin")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    approval_tasks = relationship("ApprovalTask", back_populates="requester")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    payload = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(30), default="info")
    is_read = Column(Boolean, default=False)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0)
    file_type = Column(String(50), nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    uploaded_by = relationship("User")

class ApprovalTask(Base):
    __tablename__ = "approval_tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    current_stage = Column(String(30), nullable=False)
    status = Column(String(20), default="pending")
    request_type = Column(String(50), nullable=True)
    request_category = Column(String(30), nullable=True)
    source_module = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    requester = relationship("User", back_populates="approval_tasks")
    logs = relationship("ApprovalLog", back_populates="approval_task", cascade="all, delete-orphan")

class ApprovalLog(Base):
    __tablename__ = "approval_logs"

    id = Column(Integer, primary_key=True, index=True)
    approval_task_id = Column(Integer, ForeignKey("approval_tasks.id"), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stage = Column(String(30), nullable=False)
    action = Column(String(20), nullable=False)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    approval_task = relationship("ApprovalTask", back_populates="logs")
    approver = relationship("User")

# --- PHASE 2 MODELS ---

class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    name = Column(String(150), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    property_type = Column(String(50), nullable=False)
    location = Column(String(255), nullable=True)
    status = Column(String(30), default="Active")
    address = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    description = Column(Text, nullable=True)
    total_buildings = Column(Integer, default=0)
    total_units = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", backref="properties")
    buildings = relationship("Building", back_populates="property", cascade="all, delete-orphan")

class Building(Base):
    __tablename__ = "buildings"

    id = Column(Integer, primary_key=True, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)
    building_type = Column(String(50), default="Tower")
    total_floors = Column(Integer, default=1)
    total_units = Column(Integer, default=0)
    status = Column(String(30), default="Active")
    address = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    completion_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    property = relationship("Property", back_populates="buildings")
    units = relationship("Unit", back_populates="building", cascade="all, delete-orphan")

class Unit(Base):
    __tablename__ = "property_units"

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id"), nullable=False)
    unit_number = Column(String(50), nullable=False)
    unit_code = Column(String(50), nullable=True)
    unit_type = Column(String(50), nullable=False)
    floor_number = Column(Integer, default=1)
    area_sqft = Column(Numeric(10, 2), nullable=False)
    carpet_area = Column(Numeric(10, 2), nullable=True)
    builtup_area = Column(Numeric(10, 2), nullable=True)
    facing = Column(String(50), nullable=True)
    configuration = Column(String(100), nullable=True)
    rate_per_sqft = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)
    status = Column(String(30), default="AVAILABLE")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    building = relationship("Building", back_populates="units")
    bookings = relationship("PropertyBooking", back_populates="unit")

class CrmLead(Base):
    __tablename__ = "crm_leads"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=True)
    company = Column(String(100), nullable=True)
    property_category = Column(String(50), default="Commercial")
    interested_unit_id = Column(Integer, ForeignKey("property_units.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    preferred_unit_type = Column(String(50), nullable=True)
    budget = Column(Numeric(12, 2), default=0.00)
    source = Column(String(50), default="Website")
    salesperson_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    stage = Column(String(30), default="NEW")
    lead_type = Column(String(30), default="Individual")
    priority = Column(String(30), default="Medium")
    requirement = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    qualification_notes = Column(Text, nullable=True)
    expected_closing_date = Column(DateTime, nullable=True)
    requirement_confirmed = Column(Boolean, default=False)
    budget_available = Column(Boolean, default=False)
    decision_maker_identified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    converted_at = Column(DateTime, nullable=True)

    interested_unit = relationship("Unit")
    project = relationship("Project")
    property = relationship("Property")
    salesperson = relationship("User")
    customer = relationship("Customer", foreign_keys=[customer_id])
    followups = relationship("CrmFollowup", back_populates="lead", cascade="all, delete-orphan")
    site_visits = relationship("CrmSiteVisit", back_populates="lead", cascade="all, delete-orphan")
    activities = relationship("CrmLeadActivity", back_populates="lead", cascade="all, delete-orphan")

class CrmFollowup(Base):
    __tablename__ = "crm_followups"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("crm_leads.id"), nullable=False)
    followup_date = Column(DateTime, nullable=False)
    followup_type = Column(String(30), default="Call")
    notes = Column(Text, nullable=True)
    next_action = Column(String(255), nullable=True)
    status = Column(String(30), default="Scheduled")
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("CrmLead", back_populates="followups")

class CrmSiteVisit(Base):
    __tablename__ = "crm_site_visits"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("crm_leads.id"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    visit_date = Column(DateTime, nullable=False)
    assigned_executive_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(30), default="Scheduled")
    notes = Column(Text, nullable=True)
    customer_feedback = Column(Text, nullable=True)
    interest_level = Column(String(30), default="Medium")
    next_action = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("CrmLead", back_populates="site_visits")
    property = relationship("Property")
    assigned_executive = relationship("User")

class CrmLeadActivity(Base):
    __tablename__ = "crm_lead_activities"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("crm_leads.id"), nullable=False)
    activity_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("CrmLead", back_populates="activities")

class PropertyBooking(Base):
    __tablename__ = "property_bookings"

    id = Column(Integer, primary_key=True, index=True)
    booking_number = Column(String(50), unique=True, nullable=False, index=True)
    unit_id = Column(Integer, ForeignKey("property_units.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    salesperson_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    booking_amount = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(12, 2), default=0.00)
    total_price = Column(Numeric(12, 2), nullable=False)
    agreement_status = Column(String(30), default="Draft")
    allotment_date = Column(DateTime, nullable=True)
    expected_agreement_date = Column(DateTime, nullable=True)
    status = Column(String(30), default="CONFIRMED")
    remarks = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    cancellation_date = Column(DateTime, nullable=True)
    cancelled_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    unit = relationship("Unit", back_populates="bookings")
    customer = relationship("Customer")
    salesperson = relationship("User", foreign_keys=[salesperson_id])
    cancelled_by = relationship("User", foreign_keys=[cancelled_by_id])
    installments = relationship("PaymentInstallment", back_populates="booking", cascade="all, delete-orphan")

class PaymentInstallment(Base):
    __tablename__ = "payment_installments"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("property_bookings.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    installment_name = Column(String(100), nullable=False)
    sequence_number = Column(Integer, default=1)
    due_date = Column(DateTime, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    paid_amount = Column(Numeric(12, 2), default=0.00)
    balance_amount = Column(Numeric(12, 2), default=0.00)
    status = Column(String(30), default="PENDING")
    paid_date = Column(DateTime, nullable=True)
    payment_reference = Column(String(100), nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    booking = relationship("PropertyBooking", back_populates="installments")
    customer = relationship("Customer")
    payments = relationship("PropertyPayment", back_populates="installment", cascade="all, delete-orphan")

class PropertyPayment(Base):
    __tablename__ = "property_payments"

    id = Column(Integer, primary_key=True, index=True)
    payment_code = Column(String(50), unique=True, nullable=False, index=True)
    installment_id = Column(Integer, ForeignKey("payment_installments.id"), nullable=False)
    booking_id = Column(Integer, ForeignKey("property_bookings.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(DateTime, nullable=False)
    payment_method = Column(String(50), default="Bank Transfer")
    reference_number = Column(String(100), nullable=True)
    remarks = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    installment = relationship("PaymentInstallment", back_populates="payments")
    booking = relationship("PropertyBooking")
    customer = relationship("Customer")
    created_by = relationship("User")

# --- PHASE 3 MODELS ---

class Division(Base):
    __tablename__ = "divisions"

    id = Column(Integer, primary_key=True, index=True)
    tenant_name = Column(String(100), default="Default Tenant", nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class TenantSetting(Base):
    __tablename__ = "tenant_settings"

    id = Column(Integer, primary_key=True, index=True)
    tenant_name = Column(String(100), default="Default Tenant", nullable=False, unique=True)
    is_p2_enabled = Column(Boolean, default=False)
    is_funding_mode_enabled = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    tenant_name = Column(String(100), default="Default Tenant", nullable=False)
    name = Column(String(150), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    division_id = Column(Integer, ForeignKey("divisions.id"), nullable=True)
    division_name = Column(String(100), nullable=True)
    contract_type = Column(String(50), default="Item Rate", nullable=False)
    funding_mode = Column(String(50), default="Budgeted", nullable=False)
    client_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    location = Column(String(255), nullable=False)
    latitude = Column(Numeric(10, 8), nullable=True)
    longitude = Column(Numeric(11, 8), nullable=True)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    contract_duration_days = Column(Integer, default=0, nullable=False)
    sor_edition_id = Column(Integer, ForeignKey("sor_editions.id"), nullable=True)
    sor_edition_name = Column(String(100), nullable=True)
    sor_region_id = Column(Integer, ForeignKey("sor_regions.id"), nullable=True)
    sor_region_name = Column(String(100), nullable=True)
    budget = Column(Numeric(14, 2), nullable=False)
    actual_cost = Column(Numeric(14, 2), default=0.00)
    status = Column(String(30), default="DRAFT")
    progress_pct = Column(Numeric(5, 2), default=0.00)
    created_at = Column(DateTime, default=datetime.utcnow)

    division = relationship("Division")
    sor_edition = relationship("SorEdition")
    sor_region = relationship("SorRegion")
    client = relationship("Customer")
    manager = relationship("User")
    tasks = relationship("WbsTask", back_populates="project", cascade="all, delete-orphan")
    site_logs = relationship("SiteDailyLog", back_populates="project", cascade="all, delete-orphan")

class WbsTask(Base):
    __tablename__ = "wbs_tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    parent_task_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    wbs_code = Column(String(50), nullable=True)
    title = Column(String(150), nullable=False)
    task_level = Column(String(20), default="Task")
    predecessor_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    contractor_name = Column(String(100), nullable=True)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    planned_qty = Column(Numeric(10, 2), default=0.00)
    actual_qty = Column(Numeric(10, 2), default=0.00)
    planned_budget = Column(Numeric(12, 2), default=0.00)
    actual_cost = Column(Numeric(12, 2), default=0.00)
    progress_pct = Column(Numeric(5, 2), default=0.00)
    status = Column(String(30), default="not_started")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="tasks")
    subtasks = relationship("WbsTask", backref="parent_task", remote_side=[id], foreign_keys=[parent_task_id])

class SiteDailyLog(Base):
    __tablename__ = "site_daily_logs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    phase_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    task_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    subtask_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    engineer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_date = Column(DateTime, default=datetime.utcnow)
    physical_progress = Column(Text, nullable=False)
    labour_count = Column(Integer, default=0)
    materials_consumed = Column(Text, nullable=True)
    equipment_used = Column(Text, nullable=True)
    issues_identified = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)
    approval_status = Column(String(20), default="pending")
    wbs_task_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    boq_item_id = Column(Integer, ForeignKey("boq_items.id"), nullable=True)
    executed_qty = Column(Numeric(12, 2), default=0.00)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="site_logs")
    engineer = relationship("User")
    wbs_task = relationship("WbsTask", foreign_keys=[wbs_task_id])
    phase = relationship("WbsTask", foreign_keys=[phase_id])
    task = relationship("WbsTask", foreign_keys=[task_id])
    subtask = relationship("WbsTask", foreign_keys=[subtask_id])
    boq_item = relationship("BoqItem")
    photos = relationship("SiteLogPhoto", back_populates="site_log", cascade="all, delete-orphan")
    daily_tasks = relationship("DailyTaskMonitoring", back_populates="daily_site_log", cascade="all, delete-orphan")


class DailyTaskMonitoring(Base):
    __tablename__ = "daily_task_monitoring"

    id = Column(Integer, primary_key=True, index=True)
    daily_site_log_id = Column(Integer, ForeignKey("site_daily_logs.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    work_plan_id = Column(Integer, ForeignKey("work_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    boq_mapping_id = Column(Integer, ForeignKey("work_plan_boq_mappings.id", ondelete="SET NULL"), nullable=True)
    boq_item_id = Column(Integer, ForeignKey("boq_items.id", ondelete="SET NULL"), nullable=True)
    log_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    task_status = Column(String(30), default="NOT STARTED", nullable=False)
    executed_quantity = Column(Numeric(14, 2), default=0.00, nullable=False)
    unit = Column(String(30), nullable=False)
    execution_notes = Column(Text, nullable=True)
    delay_reason = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    daily_site_log = relationship("SiteDailyLog", back_populates="daily_tasks")
    project = relationship("Project")
    work_plan = relationship("WorkPlan")
    boq_mapping = relationship("WorkPlanBoqMapping")
    boq_item = relationship("BoqItem")
    created_by = relationship("User")

class SiteLogPhoto(Base):
    __tablename__ = "site_log_photos"

    id = Column(Integer, primary_key=True, index=True)
    site_log_id = Column(Integer, ForeignKey("site_daily_logs.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    phase_id = Column(Integer, ForeignKey("wbs_tasks.id", ondelete="SET NULL"), nullable=True)
    task_id = Column(Integer, ForeignKey("wbs_tasks.id", ondelete="SET NULL"), nullable=True)
    subtask_id = Column(Integer, ForeignKey("wbs_tasks.id", ondelete="SET NULL"), nullable=True)
    boq_item_id = Column(Integer, ForeignKey("boq_items.id", ondelete="SET NULL"), nullable=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0)
    file_type = Column(String(50), nullable=True)
    caption = Column(Text, nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    site_log = relationship("SiteDailyLog", back_populates="photos")
    project = relationship("Project")
    uploaded_by = relationship("User")
    phase = relationship("WbsTask", foreign_keys=[phase_id])
    task = relationship("WbsTask", foreign_keys=[task_id])
    subtask = relationship("WbsTask", foreign_keys=[subtask_id])
    boq_item = relationship("BoqItem")

# --- PHASE 4 MODELS ---

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    contact_person = Column(String(100), nullable=True)
    email = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=True)
    gst_number = Column(String(30), nullable=True)
    pan_number = Column(String(30), nullable=True)
    rating = Column(Numeric(3, 2), default=5.00)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

class PurchaseRequisition(Base):
    __tablename__ = "purchase_requisitions"

    id = Column(Integer, primary_key=True, index=True)
    req_number = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    wbs_phase_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    wbs_task_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    wbs_subtask_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False)
    item_name = Column(String(150), nullable=True)
    quantity = Column(Numeric(12, 2), nullable=True)
    unit = Column(String(30), nullable=True)
    estimated_cost = Column(Numeric(14, 2), nullable=False)
    required_date = Column(DateTime, nullable=True)
    reason = Column(Text, nullable=True)
    source_material_request_id = Column(Integer, ForeignKey("material_purchase_requests.id"), nullable=True)
    status = Column(String(30), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    wbs_phase = relationship("WbsTask", foreign_keys=[wbs_phase_id])
    wbs_task = relationship("WbsTask", foreign_keys=[wbs_task_id])
    wbs_subtask = relationship("WbsTask", foreign_keys=[wbs_subtask_id])
    requester = relationship("User")
    mpr = relationship("MaterialPurchaseRequest", foreign_keys=[source_material_request_id])

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(50), unique=True, nullable=False, index=True)
    pr_id = Column(Integer, ForeignKey("purchase_requisitions.id"), nullable=True)
    mpr_id = Column(Integer, ForeignKey("material_purchase_requests.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    wbs_phase_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    wbs_task_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    wbs_subtask_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    item_name = Column(String(150), nullable=True)
    quantity = Column(Numeric(12, 2), nullable=True)
    unit = Column(String(30), nullable=True)
    unit_price = Column(Numeric(12, 2), nullable=True)
    delivery_date = Column(DateTime, nullable=True)
    po_date = Column(DateTime, default=datetime.utcnow)
    expected_delivery_date = Column(DateTime, nullable=True)
    total_amount = Column(Numeric(14, 2), nullable=False)
    payment_terms = Column(Text, nullable=True)
    delivery_terms = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(30), default="ISSUED")
    created_at = Column(DateTime, default=datetime.utcnow)

    pr = relationship("PurchaseRequisition")
    mpr = relationship("MaterialPurchaseRequest", foreign_keys=[mpr_id])
    project = relationship("Project")
    wbs_phase = relationship("WbsTask", foreign_keys=[wbs_phase_id])
    wbs_task = relationship("WbsTask", foreign_keys=[wbs_task_id])
    wbs_subtask = relationship("WbsTask", foreign_keys=[wbs_subtask_id])
    vendor = relationship("Vendor")
    created_by = relationship("User", foreign_keys=[created_by_id])

class MaterialPurchaseRequest(Base):
    __tablename__ = "material_purchase_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_number = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    wbs_phase_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    wbs_task_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    wbs_subtask_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    material_name = Column(String(150), nullable=False)
    material_category = Column(String(50), default="General Construction")
    quantity = Column(Numeric(12, 2), nullable=False)
    unit = Column(String(30), nullable=False)
    required_date = Column(DateTime, nullable=True)
    estimated_unit_rate = Column(Numeric(12, 2), nullable=True)
    estimated_cost = Column(Numeric(14, 2), nullable=False)
    reason = Column(Text, nullable=True)
    stock_availability = Column(String(50), default="Not Available - Purchase Required")
    preferred_vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    remarks = Column(Text, nullable=True)
    status = Column(String(30), default="SUBMITTED")
    current_approval_stage = Column(String(30), default="Project Manager")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    wbs_phase = relationship("WbsTask", foreign_keys=[wbs_phase_id])
    wbs_task = relationship("WbsTask", foreign_keys=[wbs_task_id])
    wbs_subtask = relationship("WbsTask", foreign_keys=[wbs_subtask_id])
    requester = relationship("User")
    preferred_vendor = relationship("Vendor")

class MaterialDelivery(Base):
    __tablename__ = "material_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    delivery_code = Column(String(50), unique=True, nullable=False, index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    material_name = Column(String(150), nullable=False)
    ordered_quantity = Column(Numeric(12, 2), nullable=False)
    received_quantity = Column(Numeric(12, 2), nullable=False)
    delivery_date = Column(DateTime, default=datetime.utcnow)
    delivery_location = Column(String(150), nullable=True)
    status = Column(String(30), default="PENDING")
    inspection_remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    po = relationship("PurchaseOrder")
    vendor = relationship("Vendor")
    project = relationship("Project")

class BoqItem(Base):
    __tablename__ = "boq_items"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    phase_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    task_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    subtask_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    item_name = Column(String(150), nullable=False)
    unit = Column(String(30), nullable=False)
    approved_qty = Column(Numeric(12, 2), nullable=False)
    rate = Column(Numeric(10, 2), nullable=False)
    total_amount = Column(Numeric(14, 2), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    contractor_name = Column(String(100), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sor_id = Column(Integer, ForeignKey("schedule_of_rates.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(30), default="ACTIVE")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    phase = relationship("WbsTask", foreign_keys=[phase_id])
    task = relationship("WbsTask", foreign_keys=[task_id])
    subtask = relationship("WbsTask", foreign_keys=[subtask_id])
    vendor = relationship("Vendor")
    created_by = relationship("User")
    sor = relationship("ScheduleOfRates")
    mb_records = relationship("MeasurementBook", back_populates="boq_item", cascade="all, delete-orphan")

class MeasurementBook(Base):
    __tablename__ = "measurement_books"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    boq_item_id = Column(Integer, ForeignKey("boq_items.id"), nullable=False)
    site_log_id = Column(Integer, ForeignKey("site_daily_logs.id", ondelete="CASCADE"), nullable=True)
    phase_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    task_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    subtask_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    engineer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_date = Column(DateTime, default=datetime.utcnow)
    location_zone = Column(String(100), nullable=False)
    measured_qty = Column(Numeric(12, 2), nullable=False)
    unit = Column(String(30), nullable=True)
    remarks = Column(Text, nullable=True)
    status = Column(String(30), default="APPROVED")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    boq_item = relationship("BoqItem", back_populates="mb_records")
    site_log = relationship("SiteDailyLog")
    engineer = relationship("User")
    phase = relationship("WbsTask", foreign_keys=[phase_id])
    task = relationship("WbsTask", foreign_keys=[task_id])
    subtask = relationship("WbsTask", foreign_keys=[subtask_id])

class ContractorBill(Base):
    __tablename__ = "contractor_bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_number = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    boq_item_id = Column(Integer, ForeignKey("boq_items.id"), nullable=False)
    billed_qty = Column(Numeric(12, 2), nullable=False)
    billed_rate = Column(Numeric(10, 2), nullable=False)
    total_billed_amount = Column(Numeric(14, 2), nullable=False)
    mb_qty = Column(Numeric(12, 2), nullable=False)
    boq_qty = Column(Numeric(12, 2), nullable=False)
    discrepancy_flag = Column(Boolean, default=False)
    discrepancy_reason = Column(Text, nullable=True)
    status = Column(String(30), default="pending_verification")
    sor_edition_name = Column(String(100), nullable=True)
    sor_region_name = Column(String(100), nullable=True)
    sor_code = Column(String(50), nullable=True)
    base_rate = Column(Numeric(12, 2), nullable=True)
    cost_index = Column(Numeric(8, 4), nullable=True)
    adjusted_rate = Column(Numeric(12, 2), nullable=True)
    snapshot_timestamp = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    vendor = relationship("Vendor")
    boq_item = relationship("BoqItem")

# --- PHASE 5 MODELS ---

class HseIncident(Base):
    __tablename__ = "hse_incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_code = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    incident_date = Column(DateTime, default=datetime.utcnow)
    incident_type = Column(String(30), default="Incident")
    severity = Column(String(20), default="medium")
    title = Column(String(150), nullable=False)
    location = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    immediate_action = Column(Text, nullable=True)
    root_cause = Column(Text, nullable=True)
    status = Column(String(20), default="open")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    reporter = relationship("User")

class HseCapa(Base):
    __tablename__ = "hse_capas"

    id = Column(Integer, primary_key=True, index=True)
    capa_code = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    incident_id = Column(Integer, ForeignKey("hse_incidents.id"), nullable=True)
    problem_description = Column(Text, nullable=False)
    root_cause = Column(Text, nullable=False)
    corrective_action = Column(Text, nullable=False)
    preventive_action = Column(Text, nullable=False)
    target_date = Column(DateTime, nullable=False)
    responsible_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="open")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    incident = relationship("HseIncident")
    responsible_user = relationship("User")

class SafetyAudit(Base):
    __tablename__ = "safety_audits"

    id = Column(Integer, primary_key=True, index=True)
    audit_code = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    auditor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    audit_date = Column(DateTime, default=datetime.utcnow)
    checklist_type = Column(String(50), nullable=False)
    compliance_score_pct = Column(Numeric(5, 2), nullable=False)
    issues_found = Column(Text, nullable=True)
    status = Column(String(20), default="passed")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    auditor = relationship("User")

class QualityInspection(Base):
    __tablename__ = "quality_inspections"

    id = Column(Integer, primary_key=True, index=True)
    inspection_code = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    inspector_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    inspection_date = Column(DateTime, default=datetime.utcnow)
    inspection_type = Column(String(50), nullable=False)
    result = Column(String(20), default="passed")
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    task = relationship("WbsTask")
    inspector = relationship("User")

class QualityNcr(Base):
    __tablename__ = "quality_ncrs"

    id = Column(Integer, primary_key=True, index=True)
    ncr_code = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    inspection_id = Column(Integer, ForeignKey("quality_inspections.id"), nullable=True)
    inspector_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(20), default="major")
    required_action = Column(Text, nullable=False)
    status = Column(String(20), default="open")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project")
    inspection = relationship("QualityInspection")
    inspector = relationship("User")

# --- PHASE 6 MODELS ---

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    tenant_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    company_name = Column(String(100), nullable=True)
    email = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=True)
    unit_id = Column(Integer, ForeignKey("property_units.id"), nullable=False)
    rent_amount = Column(Numeric(12, 2), nullable=False)
    lease_start = Column(DateTime, nullable=False)
    lease_end = Column(DateTime, nullable=False)
    security_deposit = Column(Numeric(12, 2), default=0.00)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    unit = relationship("Unit")

class HelpdeskTicket(Base):
    __tablename__ = "helpdesk_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_code = Column(String(50), unique=True, nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("property_units.id"), nullable=False)
    category = Column(String(50), nullable=False)
    priority = Column(String(20), default="medium")
    subject = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    assigned_technician_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="open")
    created_at = Column(DateTime, default=datetime.utcnow)

    tenant = relationship("Tenant")
    unit = relationship("Unit")
    assigned_technician = relationship("User")

class FacilityWorkOrder(Base):
    __tablename__ = "facility_work_orders"

    id = Column(Integer, primary_key=True, index=True)
    work_order_code = Column(String(50), unique=True, nullable=False, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("property_units.id"), nullable=True)
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    maintenance_type = Column(String(30), default="Preventive")
    description = Column(Text, nullable=False)
    scheduled_date = Column(DateTime, nullable=False)
    estimated_cost = Column(Numeric(10, 2), default=0.00)
    status = Column(String(20), default="open")
    created_at = Column(DateTime, default=datetime.utcnow)

    property = relationship("Property")
    unit = relationship("Unit")
    technician = relationship("User")

class UtilityBill(Base):
    __tablename__ = "utility_bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_code = Column(String(50), unique=True, nullable=False, index=True)
    unit_id = Column(Integer, ForeignKey("property_units.id"), nullable=False)
    utility_type = Column(String(30), nullable=False)
    meter_number = Column(String(50), nullable=False)
    prev_reading = Column(Numeric(10, 2), nullable=False)
    curr_reading = Column(Numeric(10, 2), nullable=False)
    units_consumed = Column(Numeric(10, 2), nullable=False)
    rate_per_unit = Column(Numeric(10, 2), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    due_date = Column(DateTime, nullable=False)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    unit = relationship("Unit")

class VisitorPass(Base):
    __tablename__ = "visitor_passes"

    id = Column(Integer, primary_key=True, index=True)
    pass_code = Column(String(50), unique=True, nullable=False, index=True)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("property_units.id"), nullable=True)
    visitor_name = Column(String(100), nullable=False)
    visitor_phone = Column(String(30), nullable=False)
    purpose = Column(String(150), nullable=False)
    check_in_time = Column(DateTime, default=datetime.utcnow)
    check_out_time = Column(DateTime, nullable=True)
    status = Column(String(20), default="checked_in")
    created_at = Column(DateTime, default=datetime.utcnow)

    property = relationship("Property")
    unit = relationship("Unit")

# --- PHASE 7 MODELS (TALLY ACCOUNTING INTEGRATION) ---

class TallySyncQueue(Base):
    __tablename__ = "tally_sync_queue"

    id = Column(Integer, primary_key=True, index=True)
    sync_code = Column(String(50), unique=True, nullable=False, index=True)
    voucher_type = Column(String(30), nullable=False)  # Sales, Purchase, Payment, Receipt, Journal
    entity_type = Column(String(50), nullable=False)  # PropertyBooking, PurchaseOrder, ContractorBill, UtilityBill
    entity_id = Column(Integer, nullable=False)
    payload_xml = Column(Text, nullable=False)
    payload_json = Column(Text, nullable=False)
    status = Column(String(20), default="pending")  # pending, synced, failed
    retry_count = Column(Integer, default=0)
    error_log = Column(Text, nullable=True)
    synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Legacy Models
class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    customer_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    contact_person = Column(String(100), nullable=True)
    email = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=True)
    company = Column(String(100), nullable=True)
    customer_type = Column(String(30), default="Individual")
    status = Column(String(20), default="active")
    source_lead_id = Column(Integer, ForeignKey("crm_leads.id"), nullable=True)
    address = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(30), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    source_lead = relationship("CrmLead", foreign_keys=[source_lead_id])
    orders = relationship("SalesOrder", back_populates="customer", cascade="all, delete-orphan")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    category = Column(String(50), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    cost = Column(Numeric(10, 2), default=0.00)
    stock = Column(Integer, nullable=False, default=0)
    min_stock_alert = Column(Integer, default=10)
    created_at = Column(DateTime, default=datetime.utcnow)

    order_items = relationship("OrderItem", back_populates="product")

class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(30), default="pending")
    order_date = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)

    order = relationship("SalesOrder", back_populates="items")
    product = relationship("Product", back_populates="order_items")

class ModuleSetting(Base):
    __tablename__ = "module_settings"

    id = Column(Integer, primary_key=True, index=True)
    module_key = Column(String(50), unique=True, nullable=False)
    module_name = Column(String(100), nullable=False)
    is_enabled = Column(Boolean, default=True)
    version = Column(String(20), default="1.0.0")

class OcrDocument(Base):
    __tablename__ = "ocr_documents"

    id = Column(Integer, primary_key=True, index=True)
    document_code = Column(String(50), unique=True, nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    invoice_number = Column(String(100), nullable=True)
    po_number = Column(String(100), nullable=True)
    pr_number = Column(String(100), nullable=True)
    gst_number = Column(String(50), nullable=True)
    total_amount = Column(Numeric(14, 2), default=0.00)
    tax_amount = Column(Numeric(14, 2), default=0.00)
    extraction_status = Column(String(30), default="COMPLETED")
    match_status = Column(String(30), default="PENDING")
    verification_status = Column(String(30), default="UNVERIFIED")
    approval_status = Column(String(30), default="PENDING")
    extracted_data_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    uploaded_by = relationship("User")
    project = relationship("Project")
    vendor = relationship("Vendor")

class SorEdition(Base):
    __tablename__ = "sor_editions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    effective_date = Column(DateTime, nullable=True)
    status = Column(String(20), default="Active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SorRegion(Base):
    __tablename__ = "sor_regions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    status = Column(String(20), default="Active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ScheduleOfRates(Base):
    __tablename__ = "schedule_of_rates"
    __table_args__ = (
        UniqueConstraint("sor_edition_id", "sor_code", name="uix_edition_sor_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    sor_edition_id = Column(Integer, ForeignKey("sor_editions.id"), nullable=False)
    sor_region_id = Column(Integer, ForeignKey("sor_regions.id"), nullable=False)
    sor_edition_name = Column(String(100), nullable=True)
    sor_region_name = Column(String(100), nullable=True)
    sor_code = Column(String(50), nullable=False, index=True)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False, index=True)
    unit = Column(String(30), nullable=False)
    base_rate = Column(Numeric(12, 2), nullable=False)
    cost_index = Column(Numeric(8, 4), default=1.0000, nullable=False)
    rate = Column(Numeric(12, 2), nullable=False)  # Preserved column, adjusted rate = base_rate * cost_index
    effective_from = Column(DateTime, nullable=False)
    status = Column(String(20), default="Active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sor_edition = relationship("SorEdition")
    sor_region = relationship("SorRegion")

    @property
    def adjusted_rate(self) -> float:
        b_rate = float(self.base_rate or self.rate or 0.0)
        c_index = float(self.cost_index if self.cost_index is not None else 1.0)
        return round(b_rate * c_index, 2)


class ProjectEstimate(Base):
    __tablename__ = "project_estimates"

    id = Column(Integer, primary_key=True, index=True)
    estimate_number = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    status = Column(String(30), default="DRAFT")
    base_amount = Column(Numeric(14, 2), default=0.00)
    contingency_percent = Column(Numeric(5, 2), default=5.00)
    contingency_amount = Column(Numeric(14, 2), default=0.00)
    departmental_charges_percent = Column(Numeric(5, 2), default=2.00)
    departmental_charges_amount = Column(Numeric(14, 2), default=0.00)
    total_amount = Column(Numeric(14, 2), default=0.00)
    is_ee_review_required = Column(Boolean, default=False)
    ee_review_reason = Column(Text, nullable=True)
    ts_status = Column(String(30), default="PENDING")  # "PENDING", "SUBMITTED", "APPROVED", "REJECTED"
    is_ts_locked = Column(Boolean, default=False)
    revision_number = Column(Integer, default=0)
    original_estimate_id = Column(Integer, ForeignKey("project_estimates.id"), nullable=True)
    is_revised = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    lines = relationship("ProjectEstimateLine", back_populates="estimate", cascade="all, delete-orphan")
    original_estimate = relationship("ProjectEstimate", remote_side=[id])

class ProjectEstimateLine(Base):
    __tablename__ = "project_estimate_lines"

    id = Column(Integer, primary_key=True, index=True)
    estimate_id = Column(Integer, ForeignKey("project_estimates.id", ondelete="CASCADE"), nullable=False)
    boq_item_id = Column(Integer, ForeignKey("boq_items.id"), nullable=False)
    sor_item_id = Column(Integer, ForeignKey("schedule_of_rates.id"), nullable=True)
    rate_source = Column(String(30), default="SOR")  # "SOR", "NON_SOR", "MANUAL_OVERRIDE"
    quantity = Column(Numeric(12, 3), nullable=False, default=0.000)
    manual_rate = Column(Numeric(12, 2), nullable=True)
    is_manual_override = Column(Boolean, default=False)
    justification_note = Column(Text, nullable=True)
    sor_rate_snapshot = Column(Numeric(12, 2), nullable=True)
    estimated_amount = Column(Numeric(14, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    estimate = relationship("ProjectEstimate", back_populates="lines")
    boq_item = relationship("BoqItem")
    sor_item = relationship("ScheduleOfRates")

class ContractorAward(Base):
    __tablename__ = "contractor_awards"

    id = Column(Integer, primary_key=True, index=True)
    award_reference = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    estimate_id = Column(Integer, ForeignKey("project_estimates.id"), nullable=False)
    contractor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    estimated_amount = Column(Numeric(14, 2), nullable=False)
    award_amount = Column(Numeric(14, 2), nullable=False)
    variance_amount = Column(Numeric(14, 2), nullable=False)
    variance_percentage = Column(Numeric(8, 2), nullable=False)
    award_date = Column(DateTime, nullable=False)
    start_date = Column(DateTime, nullable=False)
    completion_date = Column(DateTime, nullable=False)
    status = Column(String(30), default="DRAFT", nullable=False)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    estimate = relationship("ProjectEstimate")
    contractor = relationship("Vendor")


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    work_order_number = Column(String(50), unique=True, nullable=False, index=True)
    award_id = Column(Integer, ForeignKey("contractor_awards.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    contractor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    issue_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    scope_of_work = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    work_order_value = Column(Numeric(14, 2), nullable=False)
    start_date = Column(DateTime, nullable=False)
    completion_date = Column(DateTime, nullable=False)
    payment_terms = Column(Text, nullable=True)
    terms_conditions = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    included_packages = Column(Text, nullable=True)
    status = Column(String(30), default="DRAFT", nullable=False) # DRAFT, ISSUED, ACTIVE, COMPLETED, CANCELLED
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    award = relationship("ContractorAward")
    project = relationship("Project")
    contractor = relationship("Vendor")
    created_by = relationship("User")


class WorkPlan(Base):
    __tablename__ = "work_plans"

    id = Column(Integer, primary_key=True, index=True)
    work_plan_number = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    wbs_phase_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=False)
    subtask_id = Column(Integer, ForeignKey("wbs_tasks.id"), nullable=True)
    activity_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    planned_quantity = Column(Numeric(14, 2), nullable=False, default=0.00)
    unit = Column(String(30), nullable=False, default="m³")
    planned_start_date = Column(DateTime, nullable=False)
    planned_end_date = Column(DateTime, nullable=False)
    priority = Column(String(20), default="MEDIUM", nullable=False)
    dependency_id = Column(Integer, ForeignKey("work_plans.id"), nullable=True)
    responsible_team_id = Column(Integer, nullable=True)
    responsible_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    remarks = Column(Text, nullable=True)
    status = Column(String(30), default="NOT STARTED", nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    wbs_phase = relationship("WbsTask", foreign_keys=[wbs_phase_id])
    wbs_task = relationship("WbsTask", foreign_keys=[task_id])
    wbs_subtask = relationship("WbsTask", foreign_keys=[subtask_id])
    dependency = relationship("WorkPlan", remote_side=[id], foreign_keys=[dependency_id])
    responsible_user = relationship("User", foreign_keys=[responsible_user_id])
    created_by = relationship("User", foreign_keys=[created_by_id])


class WorkPlanBoqMapping(Base):
    __tablename__ = "work_plan_boq_mappings"

    id = Column(Integer, primary_key=True, index=True)
    work_plan_id = Column(Integer, ForeignKey("work_plans.id", ondelete="CASCADE"), nullable=False)
    boq_item_id = Column(Integer, ForeignKey("boq_items.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    mapped_quantity = Column(Numeric(14, 2), nullable=False)
    unit = Column(String(30), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    work_plan = relationship("WorkPlan")
    boq_item = relationship("BoqItem")
    project = relationship("Project")
    created_by = relationship("User")


class TaskAssignment(Base):
    __tablename__ = "task_assignments"

    id = Column(Integer, primary_key=True, index=True)
    assignment_ref = Column(String(50), unique=True, index=True, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    wbs_phase_id = Column(Integer, ForeignKey("wbs_tasks.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("wbs_tasks.id", ondelete="CASCADE"), nullable=False)
    subtask_id = Column(Integer, ForeignKey("wbs_tasks.id", ondelete="SET NULL"), nullable=True)
    assigned_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(100), nullable=True)
    priority = Column(String(20), default="MEDIUM", nullable=False)
    start_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    status = Column(String(30), default="ASSIGNED", nullable=False)
    remarks = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    wbs_phase = relationship("WbsTask", foreign_keys=[wbs_phase_id])
    task = relationship("WbsTask", foreign_keys=[task_id])
    subtask = relationship("WbsTask", foreign_keys=[subtask_id])
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    audits = relationship("TaskAssignmentAudit", back_populates="assignment", cascade="all, delete-orphan")


class TaskAssignmentAudit(Base):
    __tablename__ = "task_assignment_audits"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("task_assignments.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)
    previous_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    new_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assignment = relationship("TaskAssignment", back_populates="audits")
    previous_user = relationship("User", foreign_keys=[previous_user_id])
    new_user = relationship("User", foreign_keys=[new_user_id])
    changed_by = relationship("User", foreign_keys=[changed_by_user_id])


class ProjectTeamMember(Base):
    __tablename__ = "project_team_members"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_role = Column(String(100), nullable=False)
    department = Column(String(100), nullable=True)
    responsibility = Column(Text, nullable=True)
    joining_date = Column(Date, nullable=True)
    status = Column(String(20), default="ACTIVE", nullable=False)
    remarks = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")
    user = relationship("User", foreign_keys=[user_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    audits = relationship("ProjectTeamAudit", back_populates="team_member", cascade="all, delete-orphan")


class ProjectTeamAudit(Base):
    __tablename__ = "project_team_audits"

    id = Column(Integer, primary_key=True, index=True)
    team_member_id = Column(Integer, ForeignKey("project_team_members.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)
    changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    team_member = relationship("ProjectTeamMember", back_populates="audits")
    changed_by = relationship("User", foreign_keys=[changed_by_user_id])








