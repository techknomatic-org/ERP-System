-- ERP MySQL Master Database Schema (Phase 1 to Phase 7)
CREATE DATABASE IF NOT EXISTS erp_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE erp_db;

-- 1. Users Table (Extended for RBAC)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(30) DEFAULT 'admin',
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    payload TEXT,
    ip_address VARCHAR(45),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 3. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(30) DEFAULT 'info',
    is_read TINYINT(1) DEFAULT 0,
    entity_type VARCHAR(50),
    entity_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Document Attachments Table
CREATE TABLE IF NOT EXISTS documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT DEFAULT 0,
    file_type VARCHAR(50),
    uploaded_by_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 5. Approval Tasks Table
CREATE TABLE IF NOT EXISTS approval_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    requester_id INT NOT NULL,
    current_stage VARCHAR(30) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Approval History Logs
CREATE TABLE IF NOT EXISTS approval_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    approval_task_id INT NOT NULL,
    approver_id INT NOT NULL,
    stage VARCHAR(30) NOT NULL,
    action VARCHAR(20) NOT NULL,
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (approval_task_id) REFERENCES approval_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- PHASE 2 TABLES --

CREATE TABLE IF NOT EXISTS properties (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    property_type VARCHAR(50) NOT NULL,
    location VARCHAR(255),
    status VARCHAR(30) DEFAULT 'Active',
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    description TEXT,
    total_buildings INT DEFAULT 0,
    total_units INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS buildings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    property_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    building_type VARCHAR(50) DEFAULT 'Tower',
    total_floors INT DEFAULT 1,
    total_units INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'Active',
    address VARCHAR(255),
    description TEXT,
    completion_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS property_units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    building_id INT NOT NULL,
    unit_number VARCHAR(50) NOT NULL,
    unit_code VARCHAR(50),
    unit_type VARCHAR(50) NOT NULL,
    floor_number INT DEFAULT 1,
    area_sqft DECIMAL(10, 2) NOT NULL,
    carpet_area DECIMAL(10, 2),
    builtup_area DECIMAL(10, 2),
    facing VARCHAR(50),
    configuration VARCHAR(100),
    rate_per_sqft DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'AVAILABLE',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS crm_leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    company VARCHAR(100),
    property_category VARCHAR(50) DEFAULT 'Commercial',
    interested_unit_id INT,
    project_id INT,
    property_id INT,
    preferred_unit_type VARCHAR(50),
    budget DECIMAL(12, 2) DEFAULT 0.00,
    source VARCHAR(50) DEFAULT 'Website',
    salesperson_id INT,
    stage VARCHAR(30) DEFAULT 'NEW',
    lead_type VARCHAR(30) DEFAULT 'Individual',
    priority VARCHAR(30) DEFAULT 'Medium',
    requirement TEXT,
    notes TEXT,
    qualification_notes TEXT,
    expected_closing_date DATETIME,
    requirement_confirmed BOOLEAN DEFAULT FALSE,
    budget_available BOOLEAN DEFAULT FALSE,
    decision_maker_identified BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (interested_unit_id) REFERENCES property_units(id) ON DELETE SET NULL,
    FOREIGN KEY (salesperson_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS crm_followups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT NOT NULL,
    followup_date DATETIME NOT NULL,
    followup_type VARCHAR(30) DEFAULT 'Call',
    notes TEXT,
    next_action VARCHAR(255),
    status VARCHAR(30) DEFAULT 'Scheduled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS crm_site_visits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT NOT NULL,
    property_id INT,
    visit_date DATETIME NOT NULL,
    assigned_executive_id INT,
    status VARCHAR(30) DEFAULT 'Scheduled',
    notes TEXT,
    customer_feedback TEXT,
    interest_level VARCHAR(30) DEFAULT 'Medium',
    next_action VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_executive_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS crm_lead_activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_code VARCHAR(50) UNIQUE,
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    company VARCHAR(100),
    customer_type VARCHAR(30) DEFAULT 'Individual',
    status VARCHAR(30) DEFAULT 'Active',
    source_lead_id INT,
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(30),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_lead_id) REFERENCES crm_leads(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS property_bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_number VARCHAR(50) NOT NULL UNIQUE,
    unit_id INT NOT NULL,
    customer_id INT NOT NULL,
    salesperson_id INT,
    booking_amount DECIMAL(12, 2) NOT NULL,
    discount DECIMAL(12, 2) DEFAULT 0.00,
    total_price DECIMAL(12, 2) NOT NULL,
    agreement_status VARCHAR(30) DEFAULT 'Draft',
    allotment_date DATETIME,
    expected_agreement_date DATETIME,
    status VARCHAR(30) DEFAULT 'CONFIRMED',
    remarks TEXT,
    notes TEXT,
    cancellation_reason TEXT,
    cancellation_date DATETIME,
    cancelled_by_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (unit_id) REFERENCES property_units(id) ON DELETE RESTRICT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (salesperson_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (cancelled_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_installments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    customer_id INT,
    installment_name VARCHAR(100) NOT NULL,
    sequence_number INT DEFAULT 1,
    due_date DATETIME NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    paid_amount DECIMAL(12, 2) DEFAULT 0.00,
    balance_amount DECIMAL(12, 2) DEFAULT 0.00,
    status VARCHAR(30) DEFAULT 'PENDING',
    paid_date DATETIME,
    payment_reference VARCHAR(100),
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES property_bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS property_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_code VARCHAR(50) NOT NULL UNIQUE,
    installment_id INT NOT NULL,
    booking_id INT NOT NULL,
    customer_id INT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_date DATETIME NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'Bank Transfer',
    reference_number VARCHAR(100),
    remarks TEXT,
    created_by_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (installment_id) REFERENCES payment_installments(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES property_bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- PHASE 3 TABLES --

CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    client_id INT,
    manager_id INT,
    location VARCHAR(255) NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    budget DECIMAL(14, 2) NOT NULL,
    actual_cost DECIMAL(14, 2) DEFAULT 0.00,
    status VARCHAR(30) DEFAULT 'active',
    progress_pct DECIMAL(5, 2) DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wbs_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    parent_task_id INT,
    title VARCHAR(150) NOT NULL,
    task_level VARCHAR(20) DEFAULT 'Task',
    predecessor_id INT,
    contractor_name VARCHAR(100),
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    planned_qty DECIMAL(10, 2) DEFAULT 0.00,
    actual_qty DECIMAL(10, 2) DEFAULT 0.00,
    planned_budget DECIMAL(12, 2) DEFAULT 0.00,
    actual_cost DECIMAL(12, 2) DEFAULT 0.00,
    progress_pct DECIMAL(5, 2) DEFAULT 0.00,
    status VARCHAR(30) DEFAULT 'not_started',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_task_id) REFERENCES wbs_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (predecessor_id) REFERENCES wbs_tasks(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS site_daily_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    engineer_id INT NOT NULL,
    log_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    physical_progress TEXT NOT NULL,
    labour_count INT DEFAULT 0,
    materials_consumed TEXT,
    equipment_used TEXT,
    issues_identified TEXT,
    remarks TEXT,
    approval_status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (engineer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- PHASE 4 TABLES --

CREATE TABLE IF NOT EXISTS vendors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    contact_person VARCHAR(100),
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    gst_number VARCHAR(30),
    pan_number VARCHAR(30),
    rating DECIMAL(3, 2) DEFAULT 5.00,
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_requisitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    req_number VARCHAR(50) NOT NULL UNIQUE,
    project_id INT NOT NULL,
    requester_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    estimated_cost DECIMAL(14, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_number VARCHAR(50) NOT NULL UNIQUE,
    pr_id INT,
    project_id INT NOT NULL,
    vendor_id INT NOT NULL,
    total_amount DECIMAL(14, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'approved',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pr_id) REFERENCES purchase_requisitions(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS boq_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    approved_qty DECIMAL(12, 2) NOT NULL,
    rate DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(14, 2) NOT NULL,
    contractor_name VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS measurement_books (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    boq_item_id INT NOT NULL,
    engineer_id INT NOT NULL,
    log_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    location_zone VARCHAR(100) NOT NULL,
    measured_qty DECIMAL(12, 2) NOT NULL,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (boq_item_id) REFERENCES boq_items(id) ON DELETE CASCADE,
    FOREIGN KEY (engineer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contractor_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_number VARCHAR(50) NOT NULL UNIQUE,
    project_id INT NOT NULL,
    vendor_id INT NOT NULL,
    boq_item_id INT NOT NULL,
    billed_qty DECIMAL(12, 2) NOT NULL,
    billed_rate DECIMAL(10, 2) NOT NULL,
    total_billed_amount DECIMAL(14, 2) NOT NULL,
    mb_qty DECIMAL(12, 2) NOT NULL,
    boq_qty DECIMAL(12, 2) NOT NULL,
    discrepancy_flag TINYINT(1) DEFAULT 0,
    discrepancy_reason TEXT,
    status VARCHAR(30) DEFAULT 'pending_verification',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    FOREIGN KEY (boq_item_id) REFERENCES boq_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- PHASE 5 TABLES --

CREATE TABLE IF NOT EXISTS hse_incidents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    incident_code VARCHAR(50) NOT NULL UNIQUE,
    project_id INT NOT NULL,
    reporter_id INT NOT NULL,
    incident_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    incident_type VARCHAR(30) DEFAULT 'Incident',
    severity VARCHAR(20) DEFAULT 'medium',
    title VARCHAR(150) NOT NULL,
    location VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    immediate_action TEXT,
    root_cause TEXT,
    status VARCHAR(20) DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hse_capas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    capa_code VARCHAR(50) NOT NULL UNIQUE,
    project_id INT NOT NULL,
    incident_id INT,
    problem_description TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    corrective_action TEXT NOT NULL,
    preventive_action TEXT NOT NULL,
    target_date DATETIME NOT NULL,
    responsible_user_id INT,
    status VARCHAR(20) DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (incident_id) REFERENCES hse_incidents(id) ON DELETE SET NULL,
    FOREIGN KEY (responsible_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS safety_audits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    audit_code VARCHAR(50) NOT NULL UNIQUE,
    project_id INT NOT NULL,
    auditor_id INT NOT NULL,
    audit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    checklist_type VARCHAR(50) NOT NULL,
    compliance_score_pct DECIMAL(5, 2) NOT NULL,
    issues_found TEXT,
    status VARCHAR(20) DEFAULT 'passed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (auditor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quality_inspections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inspection_code VARCHAR(50) NOT NULL UNIQUE,
    project_id INT NOT NULL,
    task_id INT,
    inspector_id INT NOT NULL,
    inspection_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    inspection_type VARCHAR(50) NOT NULL,
    result VARCHAR(20) DEFAULT 'passed',
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES wbs_tasks(id) ON DELETE SET NULL,
    FOREIGN KEY (inspector_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quality_ncrs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ncr_code VARCHAR(50) NOT NULL UNIQUE,
    project_id INT NOT NULL,
    inspection_id INT,
    inspector_id INT NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'major',
    required_action TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (inspection_id) REFERENCES quality_inspections(id) ON DELETE SET NULL,
    FOREIGN KEY (inspector_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- PHASE 6 TABLES --

CREATE TABLE IF NOT EXISTS tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    company_name VARCHAR(100),
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    unit_id INT NOT NULL,
    rent_amount DECIMAL(12, 2) NOT NULL,
    lease_start DATETIME NOT NULL,
    lease_end DATETIME NOT NULL,
    security_deposit DECIMAL(12, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (unit_id) REFERENCES property_units(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS helpdesk_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_code VARCHAR(50) NOT NULL UNIQUE,
    tenant_id INT NOT NULL,
    unit_id INT NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    subject VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    assigned_technician_id INT,
    status VARCHAR(20) DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (unit_id) REFERENCES property_units(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_technician_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS facility_work_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    work_order_code VARCHAR(50) NOT NULL UNIQUE,
    property_id INT NOT NULL,
    unit_id INT,
    technician_id INT,
    maintenance_type VARCHAR(30) DEFAULT 'Preventive',
    description TEXT NOT NULL,
    scheduled_date DATETIME NOT NULL,
    estimated_cost DECIMAL(10, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (unit_id) REFERENCES property_units(id) ON DELETE SET NULL,
    FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS utility_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_code VARCHAR(50) NOT NULL UNIQUE,
    unit_id INT NOT NULL,
    utility_type VARCHAR(30) NOT NULL,
    meter_number VARCHAR(50) NOT NULL,
    prev_reading DECIMAL(10, 2) NOT NULL,
    curr_reading DECIMAL(10, 2) NOT NULL,
    units_consumed DECIMAL(10, 2) NOT NULL,
    rate_per_unit DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    due_date DATETIME NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (unit_id) REFERENCES property_units(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS visitor_passes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pass_code VARCHAR(50) NOT NULL UNIQUE,
    property_id INT NOT NULL,
    unit_id INT,
    visitor_name VARCHAR(100) NOT NULL,
    visitor_phone VARCHAR(30) NOT NULL,
    purpose VARCHAR(150) NOT NULL,
    check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    check_out_time DATETIME,
    status VARCHAR(20) DEFAULT 'checked_in',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (unit_id) REFERENCES property_units(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- PHASE 7 TABLES (TALLY ACCOUNTING INTEGRATION LAYER) --

-- 32. Tally Sync Queue Table
CREATE TABLE IF NOT EXISTS tally_sync_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sync_code VARCHAR(50) NOT NULL UNIQUE,
    voucher_type VARCHAR(30) NOT NULL, -- Sales, Purchase, Payment, Receipt, Journal
    entity_type VARCHAR(50) NOT NULL, -- PropertyBooking, PurchaseOrder, ContractorBill, UtilityBill
    entity_id INT NOT NULL,
    payload_xml LONGTEXT NOT NULL,
    payload_json LONGTEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, synced, failed
    retry_count INT DEFAULT 0,
    error_log TEXT,
    synced_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Legacy Customer, Product, Sales Order & Items Tables
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    company VARCHAR(100),
    address VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    cost DECIMAL(10, 2) DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    min_stock_alert INT DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending',
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS site_log_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_log_id INT NOT NULL,
    project_id INT NOT NULL,
    phase_id INT,
    task_id INT,
    subtask_id INT,
    boq_item_id INT,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT DEFAULT 0,
    file_type VARCHAR(50),
    caption TEXT,
    uploaded_by_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_log_id) REFERENCES site_daily_logs(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (phase_id) REFERENCES wbs_tasks(id) ON DELETE SET NULL,
    FOREIGN KEY (task_id) REFERENCES wbs_tasks(id) ON DELETE SET NULL,
    FOREIGN KEY (subtask_id) REFERENCES wbs_tasks(id) ON DELETE SET NULL,
    FOREIGN KEY (boq_item_id) REFERENCES boq_items(id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 33. Contractor Awards Table
CREATE TABLE IF NOT EXISTS contractor_awards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    award_reference VARCHAR(50) NOT NULL UNIQUE,
    project_id INT NOT NULL,
    estimate_id INT NOT NULL,
    contractor_id INT NOT NULL,
    estimated_amount DECIMAL(14, 2) NOT NULL,
    award_amount DECIMAL(14, 2) NOT NULL,
    variance_amount DECIMAL(14, 2) NOT NULL,
    variance_percentage DECIMAL(8, 2) NOT NULL,
    award_date DATETIME NOT NULL,
    start_date DATETIME NOT NULL,
    completion_date DATETIME NOT NULL,
    status VARCHAR(30) DEFAULT 'DRAFT' NOT NULL,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (estimate_id) REFERENCES project_estimates(id) ON DELETE CASCADE,
    FOREIGN KEY (contractor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 34. Work Orders Table
CREATE TABLE IF NOT EXISTS work_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    work_order_number VARCHAR(50) NOT NULL UNIQUE,
    award_id INT NOT NULL,
    project_id INT NOT NULL,
    contractor_id INT NOT NULL,
    issue_date DATETIME NOT NULL,
    scope_of_work VARCHAR(255) NOT NULL,
    description TEXT,
    work_order_value DECIMAL(14, 2) NOT NULL,
    start_date DATETIME NOT NULL,
    completion_date DATETIME NOT NULL,
    payment_terms TEXT,
    terms_conditions TEXT,
    remarks TEXT,
    cancellation_reason TEXT,
    included_packages TEXT,
    status VARCHAR(30) DEFAULT 'DRAFT' NOT NULL,
    created_by_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (award_id) REFERENCES contractor_awards(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (contractor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;


