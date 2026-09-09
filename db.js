/**
 * db.js
 * Database Connection & Seeding Utility for ERP System
 * Schema based on schema.sql (37+ Tables across Phase 1 to Phase 7)
 */

let mysql;
try {
    mysql = require('mysql2/promise');
} catch (e) {
    mysql = null;
}

const fs = require('fs');
const path = require('path');

// Read backend .env if available to get DB credentials
const envPath = path.join(__dirname, 'backend', '.env');
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'erp_db',
    multipleStatements: true
};

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, val] = trimmed.split('=');
            if (key.trim() === 'DB_HOST') dbConfig.host = val.trim();
            if (key.trim() === 'DB_PORT') dbConfig.port = parseInt(val.trim(), 10);
            if (key.trim() === 'DB_USER') dbConfig.user = val.trim();
            if (key.trim() === 'DB_PASSWORD') dbConfig.password = val.trim();
            if (key.trim() === 'DB_NAME') dbConfig.database = val.trim();
        }
    });
}

// Seed Data Definition for each table in schema.sql
const seedData = {
    // 1. Users
    users: [
        {
            id: 1,
            username: 'admin',
            email: 'admin@erp.com',
            full_name: 'System Administrator',
            hashed_password: '$2b$12$rbnoD/CNA.9caZIAAKqETev3FLbImsHxAfK6FVmGe27jChSeHswtC',
            role: 'admin',
            is_active: 1
        },
        {
            id: 2,
            username: 'project_mgr',
            email: 'manager@erp.com',
            full_name: 'John Doe (Project Manager)',
            hashed_password: '$2b$12$eWzX...hashpassword',
            role: 'project_manager',
            is_active: 1
        },
        {
            id: 3,
            username: 'site_eng',
            email: 'engineer@erp.com',
            full_name: 'Jane Smith (Site Engineer)',
            hashed_password: '$2b$12$eWzX...hashpassword',
            role: 'site_engineer',
            is_active: 1
        }
    ],

    // 2. Audit Logs
    audit_logs: [
        {
            id: 1,
            user_id: 1,
            action: 'INITIALIZE',
            entity_type: 'System',
            entity_id: 1,
            payload: '{"message": "Database initialized"}',
            ip_address: '127.0.0.1'
        },
        {
            id: 2,
            user_id: 2,
            action: 'CREATE_PROJECT',
            entity_type: 'Project',
            entity_id: 1,
            payload: '{"project_name": "Skyline Towers"}',
            ip_address: '192.168.1.5'
        }
    ],

    // 3. Notifications
    notifications: [
        {
            id: 1,
            user_id: 1,
            title: 'Welcome to ERP',
            message: 'System setup completed successfully.',
            notification_type: 'info',
            is_read: 0,
            entity_type: 'System',
            entity_id: 1
        },
        {
            id: 2,
            user_id: 2,
            title: 'Project Assigned',
            message: 'You have been assigned as Project Manager for Skyline Towers.',
            notification_type: 'success',
            is_read: 0,
            entity_type: 'Project',
            entity_id: 1
        }
    ],

    // 4. Documents
    documents: [
        {
            id: 1,
            entity_type: 'Project',
            entity_id: 1,
            file_name: 'skyline_architectural_plan.pdf',
            file_path: '/uploads/projects/skyline_architectural_plan.pdf',
            file_size: 2048500,
            file_type: 'application/pdf',
            uploaded_by_id: 2
        }
    ],

    // 5. Approval Tasks
    approval_tasks: [
        {
            id: 1,
            title: 'PO Approval - Structural Steel',
            entity_type: 'PurchaseOrder',
            entity_id: 1,
            requester_id: 3,
            current_stage: 'Manager Approval',
            status: 'pending'
        }
    ],

    // 6. Approval Logs
    approval_logs: [
        {
            id: 1,
            approval_task_id: 1,
            approver_id: 2,
            stage: 'Initial Review',
            action: 'forwarded',
            comments: 'Verified technical specifications and quantities.'
        }
    ],

    // 7. Customers
    customers: [
        {
            id: 1,
            customer_code: 'CUST-001',
            name: 'Acme Corporation',
            contact_person: 'Alice Johnson',
            email: 'alice@acme.com',
            phone: '+1234567890',
            company: 'Acme Corp',
            customer_type: 'Corporate',
            status: 'Active',
            source_lead_id: null,
            address: '100 Business Park Suite 400',
            city: 'Metropolis',
            state: 'NY',
            postal_code: '10001',
            notes: 'Key commercial tenant'
        },
        {
            id: 2,
            customer_code: 'CUST-002',
            name: 'Robert Davis',
            contact_person: 'Robert Davis',
            email: 'robert.davis@example.com',
            phone: '+1987654321',
            company: 'Individual',
            customer_type: 'Individual',
            status: 'Active',
            source_lead_id: null,
            address: '45 Park Avenue',
            city: 'Metropolis',
            state: 'NY',
            postal_code: '10002',
            notes: 'Residential Buyer'
        }
    ],

    // 8. Projects
    projects: [
        {
            id: 1,
            name: 'Skyline Towers',
            code: 'PROJ-001',
            client_id: 1,
            manager_id: 2,
            location: 'Downtown Financial District',
            start_date: '2026-01-01 00:00:00',
            end_date: '2027-12-31 00:00:00',
            budget: 5000000.00,
            actual_cost: 1200000.00,
            status: 'active',
            progress_pct: 24.50
        },
        {
            id: 2,
            name: 'Green Valley Residency',
            code: 'PROJ-002',
            client_id: 2,
            manager_id: 2,
            location: 'Suburban Sector 4',
            start_date: '2026-03-15 00:00:00',
            end_date: '2028-06-30 00:00:00',
            budget: 8000000.00,
            actual_cost: 500000.00,
            status: 'active',
            progress_pct: 10.00
        }
    ],

    // 9. Properties
    properties: [
        {
            id: 1,
            project_id: 1,
            name: 'Skyline Commercial Center',
            code: 'PROP-001',
            property_type: 'Commercial',
            location: 'Downtown Financial District',
            status: 'Active',
            address: '100 Main Street',
            city: 'Metropolis',
            state: 'NY',
            pincode: '10001',
            description: 'Modern Commercial Hub',
            total_buildings: 2,
            total_units: 50
        }
    ],

    // 10. Buildings
    buildings: [
        {
            id: 1,
            property_id: 1,
            name: 'Tower A',
            code: 'BLD-A',
            building_type: 'Tower',
            total_floors: 15,
            total_units: 25,
            status: 'Active',
            address: '100 Main Street - Tower A',
            description: 'North Commercial Tower',
            completion_date: '2027-06-30 00:00:00'
        }
    ],

    // 11. Property Units
    property_units: [
        {
            id: 1,
            building_id: 1,
            unit_number: '101',
            unit_code: 'UNIT-101',
            unit_type: 'Office Space',
            floor_number: 1,
            area_sqft: 1200.00,
            carpet_area: 1000.00,
            builtup_area: 1200.00,
            facing: 'East',
            configuration: 'Open Layout',
            rate_per_sqft: 150.00,
            total_price: 180000.00,
            status: 'AVAILABLE',
            description: 'Corner Office with City View'
        },
        {
            id: 2,
            building_id: 1,
            unit_number: '102',
            unit_code: 'UNIT-102',
            unit_type: 'Office Space',
            floor_number: 1,
            area_sqft: 1500.00,
            carpet_area: 1300.00,
            builtup_area: 1500.00,
            facing: 'North',
            configuration: 'Executive Suite',
            rate_per_sqft: 160.00,
            total_price: 240000.00,
            status: 'BOOKED',
            description: 'Executive Office Suite'
        }
    ],

    // 12. CRM Leads
    crm_leads: [
        {
            id: 1,
            customer_name: 'Charlie Brown',
            email: 'charlie@leads.com',
            phone: '+1122334455',
            company: 'Brown Enterprise',
            property_category: 'Commercial',
            interested_unit_id: 1,
            project_id: 1,
            property_id: 1,
            preferred_unit_type: 'Office Space',
            budget: 200000.00,
            source: 'Website',
            salesperson_id: 2,
            stage: 'QUALIFIED',
            lead_type: 'Individual',
            priority: 'High',
            requirement: 'Requires 1200 sqft office space',
            notes: 'Schedule site visit next week',
            qualification_notes: 'Budget confirmed',
            expected_closing_date: '2026-10-15 00:00:00',
            requirement_confirmed: 1,
            budget_available: 1,
            decision_maker_identified: 1
        }
    ],

    // 13. CRM Followups
    crm_followups: [
        {
            id: 1,
            lead_id: 1,
            followup_date: '2026-09-15 10:00:00',
            followup_type: 'Call',
            notes: 'Discussed unit pricing and discount options.',
            next_action: 'Send formal proposal package',
            status: 'Scheduled'
        }
    ],

    // 14. CRM Site Visits
    crm_site_visits: [
        {
            id: 1,
            lead_id: 1,
            property_id: 1,
            visit_date: '2026-09-12 14:00:00',
            assigned_executive_id: 2,
            status: 'Completed',
            notes: 'Toured Unit 101 and 102.',
            customer_feedback: 'Impression was highly positive.',
            interest_level: 'High',
            next_action: 'Prepare agreement draft'
        }
    ],

    // 15. CRM Lead Activities
    crm_lead_activities: [
        {
            id: 1,
            lead_id: 1,
            activity_type: 'EMAIL_SENT',
            description: 'Emailed brochure and floor plan to customer.'
        }
    ],

    // 16. Property Bookings
    property_bookings: [
        {
            id: 1,
            booking_number: 'BK-2026-001',
            unit_id: 2,
            customer_id: 1,
            salesperson_id: 2,
            booking_amount: 20000.00,
            discount: 5000.00,
            total_price: 235000.00,
            agreement_status: 'Draft',
            allotment_date: '2026-09-01 00:00:00',
            expected_agreement_date: '2026-09-20 00:00:00',
            status: 'CONFIRMED',
            remarks: 'Booking deposit confirmed via wire transfer.',
            notes: 'Client requested customized interior partition.'
        }
    ],

    // 17. Payment Installments
    payment_installments: [
        {
            id: 1,
            booking_id: 1,
            customer_id: 1,
            installment_name: 'Booking Token',
            sequence_number: 1,
            due_date: '2026-09-01 00:00:00',
            amount: 20000.00,
            paid_amount: 20000.00,
            balance_amount: 0.00,
            status: 'PAID',
            paid_date: '2026-09-01 00:00:00',
            payment_reference: 'TXN-TOKEN-001'
        },
        {
            id: 2,
            booking_id: 1,
            customer_id: 1,
            installment_name: 'Installment 1 (10%)',
            sequence_number: 2,
            due_date: '2026-10-01 00:00:00',
            amount: 23500.00,
            paid_amount: 0.00,
            balance_amount: 23500.00,
            status: 'PENDING',
            paid_date: null,
            payment_reference: null
        }
    ],

    // 18. Property Payments
    property_payments: [
        {
            id: 1,
            payment_code: 'PAY-2026-001',
            installment_id: 1,
            booking_id: 1,
            customer_id: 1,
            amount: 20000.00,
            payment_date: '2026-09-01 11:30:00',
            payment_method: 'Bank Transfer',
            reference_number: 'TXN-TOKEN-001',
            remarks: 'Received via NEFT from Acme Corp',
            created_by_id: 1
        }
    ],

    // 19. WBS Tasks
    wbs_tasks: [
        {
            id: 1,
            project_id: 1,
            parent_task_id: null,
            title: 'Foundation & Substructure',
            task_level: 'Phase',
            predecessor_id: null,
            contractor_name: 'BuildCorp Infrastructure',
            start_date: '2026-01-05 00:00:00',
            end_date: '2026-03-31 00:00:00',
            planned_qty: 100.00,
            actual_qty: 100.00,
            planned_budget: 500000.00,
            actual_cost: 480000.00,
            progress_pct: 100.00,
            status: 'completed'
        },
        {
            id: 2,
            project_id: 1,
            parent_task_id: 1,
            title: 'Superstructure Framing - Floor 1-5',
            task_level: 'Task',
            predecessor_id: 1,
            contractor_name: 'BuildCorp Infrastructure',
            start_date: '2026-04-01 00:00:00',
            end_date: '2026-08-31 00:00:00',
            planned_qty: 100.00,
            actual_qty: 60.00,
            planned_budget: 1200000.00,
            actual_cost: 720000.00,
            progress_pct: 60.00,
            status: 'in_progress'
        }
    ],

    // 20. Site Daily Logs
    site_daily_logs: [
        {
            id: 1,
            project_id: 1,
            engineer_id: 3,
            log_date: '2026-09-08 17:00:00',
            physical_progress: 'Poured RCC columns for 3rd floor Block A',
            labour_count: 35,
            materials_consumed: 'Cement 250 bags, Steel 6.2 Tons',
            equipment_used: 'Concrete Pump, Tower Crane',
            issues_identified: 'None reported',
            remarks: 'Weather clear, target achieved.',
            approval_status: 'approved'
        }
    ],

    // 21. Vendors
    vendors: [
        {
            id: 1,
            name: 'Apex Building Materials Ltd',
            code: 'VEN-001',
            contact_person: 'David Miller',
            email: 'sales@apexmaterials.com',
            phone: '+1555666777',
            gst_number: '29ABCDE1234F1Z5',
            pan_number: 'ABCDE1234F',
            rating: 4.80,
            status: 'active'
        },
        {
            id: 2,
            name: 'BuildCorp Infrastructure',
            code: 'VEN-002',
            contact_person: 'Sarah Connor',
            email: 'contact@buildcorp.com',
            phone: '+1555888999',
            gst_number: '27XYZAB5678G2Z1',
            pan_number: 'XYZAB5678G',
            rating: 4.60,
            status: 'active'
        }
    ],

    // 22. Purchase Requisitions
    purchase_requisitions: [
        {
            id: 1,
            req_number: 'PR-2026-001',
            project_id: 1,
            requester_id: 3,
            title: 'Procurement of TMT Steel Bars (Grade Fe500)',
            estimated_cost: 150000.00,
            status: 'approved'
        }
    ],

    // 23. Purchase Orders
    purchase_orders: [
        {
            id: 1,
            po_number: 'PO-2026-001',
            pr_id: 1,
            project_id: 1,
            vendor_id: 1,
            total_amount: 145000.00,
            status: 'approved'
        }
    ],

    // 24. BOQ Items
    boq_items: [
        {
            id: 1,
            project_id: 1,
            item_name: 'Reinforced Concrete M30 Grade',
            unit: 'Cum',
            approved_qty: 500.00,
            rate: 4500.00,
            total_amount: 2250000.00,
            contractor_name: 'BuildCorp Infrastructure'
        },
        {
            id: 2,
            project_id: 1,
            item_name: 'Structural Steel Fe500',
            unit: 'MT',
            approved_qty: 50.00,
            rate: 65000.00,
            total_amount: 3250000.00,
            contractor_name: 'Apex Building Materials Ltd'
        }
    ],

    // 25. Measurement Books
    measurement_books: [
        {
            id: 1,
            project_id: 1,
            boq_item_id: 1,
            engineer_id: 3,
            log_date: '2026-09-05 00:00:00',
            location_zone: 'Zone A Floor 3 Column C1-C12',
            measured_qty: 45.00,
            remarks: 'Inspected and certified by lead engineer.'
        }
    ],

    // 26. Contractor Bills
    contractor_bills: [
        {
            id: 1,
            bill_number: 'BILL-2026-001',
            project_id: 1,
            vendor_id: 2,
            boq_item_id: 1,
            billed_qty: 45.00,
            billed_rate: 4500.00,
            total_billed_amount: 202500.00,
            mb_qty: 45.00,
            boq_qty: 500.00,
            discrepancy_flag: 0,
            discrepancy_reason: null,
            status: 'verified'
        }
    ],

    // 27. HSE Incidents
    hse_incidents: [
        {
            id: 1,
            incident_code: 'HSE-2026-001',
            project_id: 1,
            reporter_id: 3,
            incident_date: '2026-09-02 11:15:00',
            incident_type: 'Near Miss',
            severity: 'medium',
            title: 'Loose Scaffolding Clamp on 3rd Floor',
            location: 'Tower A - Floor 3',
            description: 'Scaffolding clamp was found loose during morning audit.',
            immediate_action: 'Work paused, clamp tightened immediately.',
            root_cause: 'Vibration from heavy concrete pouring nearby.',
            status: 'closed'
        }
    ],

    // 28. HSE CAPAs
    hse_capas: [
        {
            id: 1,
            capa_code: 'CAPA-2026-001',
            project_id: 1,
            incident_id: 1,
            problem_description: 'Scaffolding clamp loose on 3rd Floor',
            root_cause: 'Vibration slackening standard clamp bolts',
            corrective_action: 'Tighten all clamps on Floor 3',
            preventive_action: 'Introduce daily pre-shift scaffolding inspection',
            target_date: '2026-09-10 00:00:00',
            responsible_user_id: 3,
            status: 'completed'
        }
    ],

    // 29. Safety Audits
    safety_audits: [
        {
            id: 1,
            audit_code: 'AUD-2026-001',
            project_id: 1,
            auditor_id: 2,
            audit_date: '2026-09-01 09:00:00',
            checklist_type: 'Monthly Safety Audit',
            compliance_score_pct: 95.00,
            issues_found: 'Minor PPE non-compliance rectified on spot',
            status: 'passed'
        }
    ],

    // 30. Quality Inspections
    quality_inspections: [
        {
            id: 1,
            inspection_code: 'INSP-2026-001',
            project_id: 1,
            task_id: 2,
            inspector_id: 3,
            inspection_date: '2026-09-04 14:30:00',
            inspection_type: 'Concrete Slump Test',
            result: 'passed',
            remarks: 'Concrete slump within target range 100-120mm'
        }
    ],

    // 31. Quality NCRs
    quality_ncrs: [
        {
            id: 1,
            ncr_code: 'NCR-2026-001',
            project_id: 1,
            inspection_id: 1,
            inspector_id: 3,
            description: 'Minor honeycomb patch on column C4 base',
            severity: 'minor',
            required_action: 'Apply non-shrink polymer mortar finish',
            status: 'closed'
        }
    ],

    // 32. Tenants
    tenants: [
        {
            id: 1,
            tenant_code: 'TNT-001',
            name: 'Nexus Technologies',
            company_name: 'Nexus Tech Pvt Ltd',
            email: 'contact@nexustech.com',
            phone: '+1999888777',
            unit_id: 2,
            rent_amount: 3500.00,
            lease_start: '2026-01-01 00:00:00',
            lease_end: '2027-12-31 00:00:00',
            security_deposit: 10500.00,
            status: 'active'
        }
    ],

    // 33. Helpdesk Tickets
    helpdesk_tickets: [
        {
            id: 1,
            ticket_code: 'TKT-2026-001',
            tenant_id: 1,
            unit_id: 2,
            category: 'HVAC',
            priority: 'medium',
            subject: 'AC Thermostat Error',
            description: 'Thermostat in main hall displaying error code E4',
            assigned_technician_id: 3,
            status: 'open'
        }
    ],

    // 34. Facility Work Orders
    facility_work_orders: [
        {
            id: 1,
            work_order_code: 'FWO-2026-001',
            property_id: 1,
            unit_id: 2,
            technician_id: 3,
            maintenance_type: 'Preventive',
            description: 'Quarterly HVAC filter replacement and inspection',
            scheduled_date: '2026-09-20 09:00:00',
            estimated_cost: 250.00,
            status: 'open'
        }
    ],

    // 35. Utility Bills
    utility_bills: [
        {
            id: 1,
            bill_code: 'UTIL-2026-09-01',
            unit_id: 2,
            utility_type: 'Electricity',
            meter_number: 'MTR-884920',
            prev_reading: 1450.00,
            curr_reading: 1820.00,
            units_consumed: 370.00,
            rate_per_unit: 0.15,
            total_amount: 55.50,
            due_date: '2026-09-30 00:00:00',
            status: 'pending'
        }
    ],

    // 36. Visitor Passes
    visitor_passes: [
        {
            id: 1,
            pass_code: 'VP-2026-001',
            property_id: 1,
            unit_id: 2,
            visitor_name: 'Edward Norton',
            visitor_phone: '+1444555666',
            purpose: 'Client Executive Meeting with Nexus Tech',
            check_in_time: '2026-09-09 10:00:00',
            check_out_time: '2026-09-09 11:30:00',
            status: 'checked_out'
        }
    ],

    // 37. Tally Sync Queue
    tally_sync_queue: [
        {
            id: 1,
            sync_code: 'TSYNC-001',
            voucher_type: 'Sales',
            entity_type: 'PropertyBooking',
            entity_id: 1,
            payload_xml: '<VOUCHER><TYPE>Sales</TYPE></VOUCHER>',
            payload_json: '{"voucher_type":"Sales","booking_id":1}',
            status: 'synced',
            retry_count: 0,
            error_log: null,
            synced_at: '2026-09-01 12:00:00'
        }
    ],

    // 38. Products
    products: [
        {
            id: 1,
            sku: 'SKU-CEMENT-01',
            name: 'Portland Cement 50kg Bag',
            category: 'Building Materials',
            price: 8.50,
            cost: 6.00,
            stock: 1000,
            min_stock_alert: 50
        },
        {
            id: 2,
            sku: 'SKU-STEEL-01',
            name: 'TMT Bar 12mm (per kg)',
            category: 'Steel',
            price: 0.95,
            cost: 0.70,
            stock: 5000,
            min_stock_alert: 500
        }
    ],

    // 39. Sales Orders
    sales_orders: [
        {
            id: 1,
            order_number: 'SO-2026-001',
            customer_id: 1,
            total_amount: 1250.00,
            status: 'completed',
            order_date: '2026-09-02 10:00:00'
        }
    ],

    // 40. Order Items
    order_items: [
        {
            id: 1,
            order_id: 1,
            product_id: 1,
            quantity: 100,
            unit_price: 8.50,
            total_price: 850.00
        },
        {
            id: 2,
            order_id: 1,
            product_id: 2,
            quantity: 400,
            unit_price: 1.00,
            total_price: 400.00
        }
    ],

    // 41. Site Log Photos
    site_log_photos: [
        {
            id: 1,
            site_log_id: 1,
            project_id: 1,
            phase_id: null,
            task_id: 1,
            subtask_id: null,
            boq_item_id: 1,
            file_name: 'foundation_pour.jpg',
            file_path: '/uploads/photos/foundation_pour.jpg',
            file_size: 1048576,
            file_type: 'image/jpeg',
            caption: 'Concrete pouring progress on foundation',
            uploaded_by_id: 3
        }
    ],

    // 42. Contractor Awards (If applicable)
    contractor_awards: [
        {
            id: 1,
            award_reference: 'AWD-2026-001',
            project_id: 1,
            estimate_id: 1,
            contractor_id: 2,
            estimated_amount: 500000.00,
            award_amount: 480000.00,
            variance_amount: -20000.00,
            variance_percentage: -4.00,
            award_date: '2026-01-02 00:00:00',
            start_date: '2026-01-05 00:00:00',
            completion_date: '2026-06-30 00:00:00',
            status: 'DRAFT',
            remarks: 'Contract awarded after tender process'
        }
    ],

    // 43. Work Orders (If applicable)
    work_orders: [
        {
            id: 1,
            work_order_number: 'WO-2026-001',
            award_id: 1,
            project_id: 1,
            contractor_id: 2,
            issue_date: '2026-01-03 00:00:00',
            scope_of_work: 'Civil and Structural Construction',
            description: 'Scope includes foundation, RCC frame, masonry',
            work_order_value: 480000.00,
            start_date: '2026-01-05 00:00:00',
            completion_date: '2026-06-30 00:00:00',
            payment_terms: 'Milestone 30-60-10',
            terms_conditions: 'Standard ERP T&C',
            remarks: 'Work order active',
            cancellation_reason: null,
            included_packages: 'Package 1 - Civil',
            status: 'DRAFT',
            created_by_id: 1
        }
    ]
};

/**
 * SQL Generator Function: Generates executable INSERT SQL script for all tables
 */
function generateSQLDump() {
    let sqlOutput = `-- Auto-generated ERP Seed Data SQL Dump\nUSE erp_db;\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;
    let totalTables = 0;
    let totalRows = 0;

    for (const [tableName, rows] of Object.entries(seedData)) {
        if (!rows || rows.length === 0) continue;
        const columns = Object.keys(rows[0]);
        const colNamesStr = columns.map(col => `\`${col}\``).join(', ');

        sqlOutput += `-- Table: ${tableName}\n`;
        for (const row of rows) {
            const valuesFormatted = columns.map(col => {
                const val = row[col];
                if (val === null || val === undefined) return 'NULL';
                if (typeof val === 'number') return val;
                if (typeof val === 'boolean') return val ? 1 : 0;
                // Escape single quotes for SQL string literal
                const escaped = String(val).replace(/'/g, "''");
                return `'${escaped}'`;
            }).join(', ');

            const updateClause = columns.map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ');
            sqlOutput += `INSERT INTO \`${tableName}\` (${colNamesStr}) VALUES (${valuesFormatted}) ON DUPLICATE KEY UPDATE ${updateClause};\n`;
            totalRows++;
        }
        sqlOutput += `\n`;
        totalTables++;
    }

    sqlOutput += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    const sqlFilePath = path.join(__dirname, 'seed_data.sql');
    fs.writeFileSync(sqlFilePath, sqlOutput, 'utf8');
    console.log(`📄 Generated SQL dump file with ${totalRows} row(s) across ${totalTables} table(s): seed_data.sql`);
    return sqlFilePath;
}

/**
 * Seed Function: Inserts sample data into each table in database
 */
async function seedDatabase() {
    // Always generate the seed_data.sql dump first
    generateSQLDump();

    if (!mysql) {
        console.log('ℹ️  Node module "mysql2" is not installed. To execute direct database seeding via Node, run: npm install mysql2');
        console.log('💡 You can also import "seed_data.sql" directly into MySQL workbench or via command line!');
        return;
    }

    let connection;
    console.log(`🔌 Connecting to MySQL database '${dbConfig.database}' on ${dbConfig.host}:${dbConfig.port}...`);

    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected successfully to MySQL.');

        // Disable Foreign Key checks for clean insertion
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

        let totalTables = 0;
        let totalRows = 0;

        for (const [tableName, rows] of Object.entries(seedData)) {
            if (!rows || rows.length === 0) continue;

            const columns = Object.keys(rows[0]);
            const colNamesStr = columns.map(col => `\`${col}\``).join(', ');

            for (const row of rows) {
                const values = columns.map(col => row[col]);
                const placeholders = columns.map(() => '?').join(', ');

                const updateStr = columns.map(col => `\`${col}\` = VALUES(\`${col}\`)`).join(', ');

                const sql = `INSERT INTO \`${tableName}\` (${colNamesStr}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateStr};`;

                try {
                    await connection.execute(sql, values);
                    totalRows++;
                } catch (err) {
                    console.warn(`⚠️ Warning inserting into table '${tableName}': ${err.message}`);
                }
            }
            totalTables++;
            console.log(`🌱 Seeded ${rows.length} row(s) into table: ${tableName}`);
        }

        // Re-enable Foreign Key checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

        console.log(`\n🎉 Seed process completed successfully!`);
        console.log(`📊 Summary: Populated ${totalRows} row(s) across ${totalTables} tables.`);

    } catch (error) {
        console.error('❌ Error executing database seed:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔒 Connection closed.');
        }
    }
}

// Export seedData, dbConfig, seedDatabase, and generateSQLDump
module.exports = {
    dbConfig,
    seedData,
    seedDatabase,
    generateSQLDump
};

// Execute if run directly via node db.js
if (require.main === module) {
    seedDatabase();
}


