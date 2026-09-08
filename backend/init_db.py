import pymysql
import json
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import (
    Customer, Product, SalesOrder, OrderItem, User, Notification, 
    ApprovalTask, ApprovalLog, AuditLog, Property, Building, Unit, 
    CrmLead, PropertyBooking, PaymentInstallment,
    Project, WbsTask, SiteDailyLog, SiteLogPhoto,
    Vendor, PurchaseRequisition, PurchaseOrder, BoqItem, MeasurementBook, ContractorBill,
    HseIncident, HseCapa, SafetyAudit, QualityInspection, QualityNcr,
    Tenant, HelpdeskTicket, FacilityWorkOrder, UtilityBill, VisitorPass,
    TallySyncQueue, ScheduleOfRates, SorEdition, SorRegion, ProjectEstimate, ProjectEstimateLine, ContractorAward, WorkOrder, WorkPlan, WorkPlanBoqMapping,
    TaskAssignment, TaskAssignmentAudit, ProjectTeamMember, ProjectTeamAudit, DailyTaskMonitoring, Division, TenantSetting
)

from app.api.tally import generate_tally_xml
from passlib.context import CryptContext
from datetime import datetime, timedelta

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def ensure_database_exists():
    """Ensure the target database exists in MySQL and required columns exist."""
    try:
        connection = pymysql.connect(
            host=settings.DB_HOST,
            port=int(settings.DB_PORT),
            user=settings.DB_USER,
            password=settings.DB_PASSWORD
        )
        with connection.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {settings.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
            cursor.execute(f"USE {settings.DB_NAME};")

            # Check and add columns to site_daily_logs
            for col, col_type in [("phase_id", "INT NULL"), ("task_id", "INT NULL"), ("subtask_id", "INT NULL")]:
                cursor.execute(f"""
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = '{settings.DB_NAME}' 
                    AND TABLE_NAME = 'site_daily_logs' 
                    AND COLUMN_NAME = '{col}';
                """)
                if cursor.fetchone()[0] == 0:
                    cursor.execute(f"ALTER TABLE site_daily_logs ADD COLUMN {col} {col_type};")

            # Check and add column to measurement_books
            cursor.execute(f"""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = '{settings.DB_NAME}' 
                AND TABLE_NAME = 'measurement_books' 
                AND COLUMN_NAME = 'site_log_id';
            """)
            if cursor.fetchone()[0] == 0:
                cursor.execute("ALTER TABLE measurement_books ADD COLUMN site_log_id INT NULL;")

            # Check and add column to wbs_tasks
            cursor.execute(f"""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = '{settings.DB_NAME}' 
                AND TABLE_NAME = 'wbs_tasks' 
                AND COLUMN_NAME = 'wbs_code';
            """)
            if cursor.fetchone()[0] == 0:
                cursor.execute("ALTER TABLE wbs_tasks ADD COLUMN wbs_code VARCHAR(50) NULL;")

            # Check and add sor_id column to boq_items
            cursor.execute(f"""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = '{settings.DB_NAME}' 
                AND TABLE_NAME = 'boq_items' 
                AND COLUMN_NAME = 'sor_id';
            """)
            if cursor.fetchone()[0] == 0:
                cursor.execute("ALTER TABLE boq_items ADD COLUMN sor_id INT NULL;")

            # Check and add columns to projects table
            proj_cols = [
                ("tenant_name", "VARCHAR(100) NOT NULL DEFAULT 'Default Tenant'"),
                ("division_id", "INT NULL"),
                ("division_name", "VARCHAR(100) NULL"),
                ("contract_type", "VARCHAR(50) NOT NULL DEFAULT 'Item Rate'"),
                ("funding_mode", "VARCHAR(50) NOT NULL DEFAULT 'Budgeted'"),
                ("latitude", "DECIMAL(10, 8) NULL"),
                ("longitude", "DECIMAL(11, 8) NULL"),
                ("contract_duration_days", "INT NOT NULL DEFAULT 0"),
                ("sor_edition_id", "INT NULL"),
                ("sor_edition_name", "VARCHAR(100) NULL"),
                ("sor_region_id", "INT NULL"),
                ("sor_region_name", "VARCHAR(100) NULL")
            ]
            for col, col_type in proj_cols:
                cursor.execute(f"""
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = '{settings.DB_NAME}' 
                    AND TABLE_NAME = 'projects' 
                    AND COLUMN_NAME = '{col}';
                """)
                if cursor.fetchone()[0] == 0:
                    cursor.execute(f"ALTER TABLE projects ADD COLUMN {col} {col_type};")

            # Check and add columns to schedule_of_rates table
            sor_cols = [
                ("sor_edition_id", "INT NULL"),
                ("sor_region_id", "INT NULL"),
                ("sor_edition_name", "VARCHAR(100) NULL"),
                ("sor_region_name", "VARCHAR(100) NULL"),
                ("base_rate", "DECIMAL(12, 2) NULL"),
                ("cost_index", "DECIMAL(8, 4) NULL DEFAULT 1.0000")
            ]
            for col, col_type in sor_cols:
                cursor.execute(f"""
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = '{settings.DB_NAME}' 
                    AND TABLE_NAME = 'schedule_of_rates' 
                    AND COLUMN_NAME = '{col}';
                """)
                if cursor.fetchone()[0] == 0:
                    cursor.execute(f"ALTER TABLE schedule_of_rates ADD COLUMN {col} {col_type};")

            # Drop old single-column unique index on sor_code if present
            cursor.execute(f"""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                WHERE TABLE_SCHEMA = '{settings.DB_NAME}' 
                AND TABLE_NAME = 'schedule_of_rates' 
                AND INDEX_NAME = 'ix_schedule_of_rates_sor_code'
                AND NON_UNIQUE = 0;
            """)
            if cursor.fetchone()[0] > 0:
                cursor.execute("ALTER TABLE schedule_of_rates DROP INDEX ix_schedule_of_rates_sor_code;")
                cursor.execute("ALTER TABLE schedule_of_rates ADD INDEX ix_schedule_of_rates_sor_code (sor_code);")

            # Ensure edition-scoped unique constraint
            cursor.execute(f"""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                WHERE TABLE_SCHEMA = '{settings.DB_NAME}' 
                AND TABLE_NAME = 'schedule_of_rates' 
                AND INDEX_NAME = 'uix_edition_sor_code';
            """)
            if cursor.fetchone()[0] == 0:
                cursor.execute("ALTER TABLE schedule_of_rates ADD CONSTRAINT uix_edition_sor_code UNIQUE (sor_edition_id, sor_code);")

            # Check and add rate snapshot columns to contractor_bills
            cb_cols = [
                ("sor_edition_name", "VARCHAR(100) NULL"),
                ("sor_region_name", "VARCHAR(100) NULL"),
                ("sor_code", "VARCHAR(50) NULL"),
                ("base_rate", "DECIMAL(12, 2) NULL"),
                ("cost_index", "DECIMAL(8, 4) NULL"),
                ("adjusted_rate", "DECIMAL(12, 2) NULL"),
                ("snapshot_timestamp", "DATETIME NULL")
            ]
            for col, col_type in cb_cols:
                cursor.execute(f"""
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = '{settings.DB_NAME}' 
                    AND TABLE_NAME = 'contractor_bills' 
                    AND COLUMN_NAME = '{col}';
                """)
                if cursor.fetchone()[0] == 0:
                    cursor.execute(f"ALTER TABLE contractor_bills ADD COLUMN {col} {col_type};")


        connection.commit()
        connection.close()
        print(f"[+] MySQL Database '{settings.DB_NAME}' verified/created with required schema migrations.")
    except Exception as e:
        print(f"[!] MySQL Connection Note: {e}")

def init_tables_and_seed():
    """Create all tables and seed sample ERP records."""
    ensure_database_exists()
    try:
        Base.metadata.create_all(bind=engine)
        print("[+] All database tables created successfully.")
    except Exception as e:
        print(f"[-] Failed to create tables: {e}")
        return

    db = SessionLocal()
    try:
        # Seed Demo User Accounts
        demo_users_seed = [
            ("admin", "admin@erp.local", "System Administrator", "admin", "admin123"),
            ("pm", "pm@erp.local", "Project Manager", "project_manager", "pm123"),
            ("site", "site@erp.local", "Site Engineer", "site_engineer", "site123"),
            ("finance", "finance@erp.local", "Finance Lead", "finance", "finance123"),
            ("procurement", "procurement@erp.local", "Procurement Officer", "procurement", "procurement123"),
            ("customer", "customer@abccorp.com", "ABC Customer Account", "customer", "customer123"),
        ]
        for uname, uemail, ufull, urole, upass in demo_users_seed:
            u_obj = db.query(User).filter((User.username == uname) | (User.email == uemail)).first()
            if not u_obj:
                u_obj = User(
                    username=uname,
                    email=uemail,
                    full_name=ufull,
                    hashed_password=pwd_context.hash(upass),
                    role=urole,
                    is_active=True
                )
                db.add(u_obj)
        db.commit()
        admin = db.query(User).filter(User.username == "admin").first()

        # Seed Customers
        c1 = db.query(Customer).filter(Customer.name == "ABC Corporation").first()
        if not c1:
            c1 = Customer(name="ABC Corporation", email="contact@abccorp.com", phone="+1-555-0199", company="ABC Corporation", address="100 Enterprise Way, Suite 400", status="active")
            db.add(c1)
        c2 = db.query(Customer).filter(Customer.name == "XYZ Enterprises").first()
        if not c2:
            c2 = Customer(name="XYZ Enterprises", email="info@xyzenterprises.com", phone="+1-555-0288", company="XYZ Enterprises", address="250 Innovation Blvd", status="active")
            db.add(c2)
        db.commit()

        # Migration / Update existing project records if present
        existing_p1 = db.query(Project).filter((Project.code == "PRJ-SCT-01") | (Project.code == "PROJ-RIVERSIDE") | (Project.name.like("%Skyline Commercial%"))).first()
        if existing_p1:
            existing_p1.name = "Riverside Commercial Complex – Phase 1"
            existing_p1.code = "PROJ-RIVERSIDE"
            db.commit()

        existing_p2 = db.query(Project).filter((Project.code == "PROJ-SKYLINE") | (Project.code == "PROJ-GREENFIELD") | (Project.name.like("%Skyline Business%"))).first()
        if existing_p2:
            existing_p2.name = "Greenfield Data Center Park"
            existing_p2.code = "PROJ-GREENFIELD"
            db.commit()

            # Ensure Data Center WBS structure exists
            from seed_datacenter_wbs import seed_data_center_wbs
            seed_data_center_wbs()

            # Ensure BOQ Items exist
            csa_ph = db.query(WbsTask).filter(WbsTask.project_id == existing_p2.id, WbsTask.wbs_code == "2.0").first()
            sub_task = db.query(WbsTask).filter(WbsTask.project_id == existing_p2.id, WbsTask.wbs_code == "2.1").first()
            st_211 = db.query(WbsTask).filter(WbsTask.project_id == existing_p2.id, WbsTask.wbs_code == "2.1.1").first()
            st_213 = db.query(WbsTask).filter(WbsTask.project_id == existing_p2.id, WbsTask.wbs_code == "2.1.3").first()

            boq_exc = db.query(BoqItem).filter(BoqItem.project_id == existing_p2.id, BoqItem.item_name.in_(["Excavation Work", "Excavation", "Site Excavation Work"])).first()
            if not boq_exc:
                boq_exc = BoqItem(project_id=existing_p2.id, phase_id=csa_ph.id if csa_ph else None, task_id=sub_task.id if sub_task else None, subtask_id=st_211.id if st_211 else None, item_name="Excavation", unit="m³", approved_qty=5000.00, rate=50.00, total_amount=250000.00, contractor_name="Apex Excavation")
                db.add(boq_exc)
                db.commit()
            else:
                boq_exc.item_name = "Excavation"
                boq_exc.unit = "m³"
                boq_exc.approved_qty = 5000.00
                boq_exc.rate = 50.00
                boq_exc.total_amount = 250000.00
                if csa_ph: boq_exc.phase_id = csa_ph.id
                if sub_task: boq_exc.task_id = sub_task.id
                if st_211: boq_exc.subtask_id = st_211.id
                db.commit()
            if not boq_exc:
                boq_exc = BoqItem(project_id=existing_p2.id, phase_id=csa_ph.id, task_id=sub_task.id, subtask_id=st_211.id, item_name="Excavation", unit="m³", approved_qty=5000.00, rate=50.00, total_amount=250000.00, contractor_name="Apex Excavation")
                db.add(boq_exc)
                db.commit()
            else:
                boq_exc.item_name = "Excavation"
                boq_exc.unit = "m³"
                boq_exc.approved_qty = 5000.00
                boq_exc.rate = 50.00
                boq_exc.total_amount = 250000.00
                boq_exc.phase_id = csa_ph.id
                boq_exc.task_id = sub_task.id
                boq_exc.subtask_id = st_211.id
                db.commit()

            # 2. M30 Concrete (1000 m3) mapped to 2.1.3
            m30_boq = db.query(BoqItem).filter(BoqItem.project_id == existing_p2.id, BoqItem.item_name.in_(["Ready Mix Concrete M30 Grade", "M30 Concrete"])).first()
            if m30_boq:
                m30_boq.item_name = "M30 Concrete"
                m30_boq.unit = "m³"
                m30_boq.approved_qty = 1000.00
                m30_boq.rate = 120.00
                m30_boq.total_amount = 120000.00
                m30_boq.phase_id = csa_ph.id
                m30_boq.task_id = sub_task.id
                m30_boq.subtask_id = st_213.id
                db.commit()

        existing_prop = db.query(Property).filter((Property.code == "PROP-SKYLINE") | (Property.code == "PROP-GREENFIELD") | (Property.name.like("%Skyline Business%"))).first()
        if existing_prop:
            existing_prop.name = "Greenfield Business Complex"
            existing_prop.code = "PROP-GREENFIELD"
            db.commit()

        b1_ex = db.query(Building).filter((Building.code == "BLD-TOWER-A") | (Building.code == "BLD-GREENFIELD-A") | (Building.name.like("%Skyline Tower A%"))).first()
        if b1_ex:
            b1_ex.name = "Greenfield Tower A"
            b1_ex.code = "BLD-GREENFIELD-A"
            db.commit()

        b2_ex = db.query(Building).filter((Building.code == "BLD-TOWER-B") | (Building.code == "BLD-GREENFIELD-B") | (Building.name.like("%Skyline Tower B%"))).first()
        if b2_ex:
            b2_ex.name = "Greenfield Tower B"
            b2_ex.code = "BLD-GREENFIELD-B"
            db.commit()

        # Update ApprovalTasks title references
        for app_t in db.query(ApprovalTask).all():
            if "Skyline Business Tower" in (app_t.title or ""):
                app_t.title = app_t.title.replace("Skyline Business Tower", "Greenfield Business Park")
            if "Skyline Commercial Tower" in (app_t.title or ""):
                app_t.title = app_t.title.replace("Skyline Commercial Tower", "Riverside Commercial Complex – Phase 1")
        db.commit()

        # Seed Divisions if not exist
        if db.query(Division).count() == 0:
            d1 = Division(name="Civil Infrastructure Division", code="DIV-CIVIL", tenant_name="Default Tenant", is_active=True)
            d2 = Division(name="Building & Commercial Circle A", code="DIV-BLDG-A", tenant_name="Default Tenant", is_active=True)
            d3 = Division(name="Electrical & Mechanical Division", code="DIV-EM", tenant_name="Default Tenant", is_active=True)
            d4 = Division(name="Special Projects Circle (Inactive)", code="DIV-INACTIVE", tenant_name="Default Tenant", is_active=False)
            db.add_all([d1, d2, d3, d4])
            db.commit()

        # Seed TenantSettings if not exist
        t_set = db.query(TenantSetting).filter(TenantSetting.tenant_name == "Default Tenant").first()
        if not t_set:
            t_set = TenantSetting(tenant_name="Default Tenant", is_p2_enabled=False, is_funding_mode_enabled=False)
            db.add(t_set)
            db.commit()

        # Seed Projects if not exist
        proj1 = db.query(Project).filter(Project.code == "PROJ-RIVERSIDE").first()
        if not proj1:
            proj1 = Project(
                name="Riverside Commercial Complex – Phase 1",
                code="PROJ-RIVERSIDE",
                client_id=c1.id,
                manager_id=admin.id,
                location="700 Financial Way, Austin, TX",
                start_date=datetime.utcnow() - timedelta(days=60),
                end_date=datetime.utcnow() + timedelta(days=300),
                budget=4500000.00,
                actual_cost=1250000.00,
                status="active",
                progress_pct=35.00
            )
            db.add(proj1)

        proj2 = db.query(Project).filter(Project.code == "PROJ-GREENFIELD").first()
        if not proj2:
            proj2 = Project(
                name="Greenfield Business Park",
                code="PROJ-GREENFIELD",
                client_id=c1.id,
                manager_id=admin.id,
                location="Financial District Plaza, Central Avenue",
                start_date=datetime.utcnow() - timedelta(days=90),
                end_date=datetime.utcnow() + timedelta(days=270),
                budget=3100000.00,
                actual_cost=1120000.00,
                status="active",
                progress_pct=47.08
            )
            db.add(proj2)

        db.commit()
        if proj2:
            db.refresh(proj2)

        # Seed Property & Buildings & Units for PROJ-GREENFIELD
        prop = db.query(Property).filter(Property.code == "PROP-GREENFIELD").first()
        if not prop:
            prop = Property(
                project_id=proj2.id,
                name="Greenfield Business Complex",
                code="PROP-GREENFIELD",
                property_type="Commercial",
                location="Financial District Plaza, Central Avenue",
                address="Financial District Plaza, Central Avenue",
                city="Metropolis",
                state="State Capital",
                status="Active",
                total_buildings=2,
                total_units=4
            )
            db.add(prop)
            db.commit()
            db.refresh(prop)
        else:
            prop.project_id = proj2.id
            prop.name = "Greenfield Business Complex"
            prop.property_type = "Commercial"
            prop.location = "Financial District Plaza, Central Avenue"
            prop.status = "Active"
            prop.total_buildings = 2
            db.commit()

        b1 = db.query(Building).filter(Building.code == "BLD-GREENFIELD-A").first()
        if not b1:
            b1 = Building(property_id=prop.id, name="Greenfield Tower A", code="BLD-GREENFIELD-A", building_type="Tower", total_floors=10, status="Active")
            db.add(b1)
            db.commit()

        b2 = db.query(Building).filter(Building.code == "BLD-GREENFIELD-B").first()
        if not b2:
            b2 = Building(property_id=prop.id, name="Greenfield Tower B", code="BLD-GREENFIELD-B", building_type="Tower", total_floors=12, status="Active")
            db.add(b2)
            db.commit()

        # Seed Units for Greenfield Tower A (Story 3 sample inventory)
        if b1 and db.query(Unit).filter(Unit.building_id == b1.id).count() == 0:
            u1 = Unit(building_id=b1.id, unit_number="Office 101", unit_code="U-GREENFIELD-A-101", unit_type="Office", floor_number=1, area_sqft=2500.0, rate_per_sqft=180.0, total_price=450000.0, status="AVAILABLE", facing="North", configuration="Executive Office", description="Prime ground floor office space")
            u2 = Unit(building_id=b1.id, unit_number="Office 102", unit_code="U-GREENFIELD-A-102", unit_type="Office", floor_number=1, area_sqft=3000.0, rate_per_sqft=190.0, total_price=570000.0, status="AVAILABLE", facing="East", configuration="Corner Suite", description="Spacious corner unit with east view")
            u3 = Unit(building_id=b1.id, unit_number="Office 103", unit_code="U-GREENFIELD-A-103", unit_type="Office", floor_number=1, area_sqft=1500.0, rate_per_sqft=200.0, total_price=300000.0, status="HELD", facing="North-East", configuration="Standard Suite", description="Temporarily held for client review")
            u4 = Unit(building_id=b1.id, unit_number="Office 104", unit_code="U-GREENFIELD-A-104", unit_type="Office", floor_number=1, area_sqft=1800.0, rate_per_sqft=210.0, total_price=378000.0, status="BOOKED", facing="South", configuration="Executive Office", description="Booked unit under sales process")
            u5 = Unit(building_id=b1.id, unit_number="Retail 01", unit_code="U-GREENFIELD-A-R01", unit_type="Retail Shop", floor_number=1, area_sqft=1200.0, rate_per_sqft=250.0, total_price=300000.0, status="SOLD", facing="West", configuration="High-Street Retail", description="Sold retail store location")
            db.add_all([u1, u2, u3, u4, u5])
            b1.total_units = 5
            if prop:
                prop.total_units = 5
            db.commit()



        # Seed BOQ Items for PROJ-GREENFIELD
        if proj2 and db.query(BoqItem).filter(BoqItem.project_id == proj2.id).count() == 0:
            ph_f_task = db.query(WbsTask).filter(WbsTask.project_id == proj2.id, WbsTask.title == "Foundation").first()
            cw_task = db.query(WbsTask).filter(WbsTask.project_id == proj2.id, WbsTask.title == "Concrete Work").first()

            boq1 = BoqItem(project_id=proj2.id, phase_id=ph_f_task.id if ph_f_task else None, task_id=cw_task.id if cw_task else None, item_name="M30 Concrete", unit="m³", approved_qty=1000.00, rate=120.00, total_amount=120000.00, contractor_name="Apex Concrete")
            boq2 = BoqItem(project_id=proj2.id, item_name="Reinforcement Steel Fe500", unit="Tonnes", approved_qty=450.00, rate=750.00, total_amount=337500.00, contractor_name="Titan Structural")
            boq3 = BoqItem(project_id=proj2.id, item_name="Cement (PPC Grade 53)", unit="Bags", approved_qty=10000.00, rate=8.50, total_amount=85000.00, contractor_name="Apex Concrete")
            boq4 = BoqItem(project_id=proj2.id, item_name="Bricks & AAC Blocks 600x200x150mm", unit="Units", approved_qty=25000.00, rate=3.20, total_amount=80000.00, contractor_name="Royal Finishes")
            boq5 = BoqItem(project_id=proj2.id, item_name="Sand & Coarse Aggregates", unit="m³", approved_qty=2000.00, rate=45.00, total_amount=90000.00, contractor_name="Apex Excavation")
            db.add_all([boq1, boq2, boq3, boq4, boq5])
            db.commit()

        # Seed Site Daily Logs & Approval Tasks for PROJ-GREENFIELD
        if proj2 and db.query(SiteDailyLog).filter(SiteDailyLog.project_id == proj2.id).count() == 0:
            log1 = SiteDailyLog(
                project_id=proj2.id,
                engineer_id=admin.id,
                log_date=datetime.utcnow() - timedelta(days=3),
                physical_progress="Completed 70% of Column reinforcement binding on Floor 3.",
                labour_count=45,
                materials_consumed="12 Tonnes Reinforcement Steel Fe500, 250 Bags Cement",
                equipment_used="2 Tower Cranes, 1 Concrete Mixer",
                issues_identified="Minor delay due to morning rainfall.",
                remarks="Work completed as per safety protocols.",
                approval_status="approved"
            )
            db.add(log1)

            log2 = SiteDailyLog(
                project_id=proj2.id,
                engineer_id=admin.id,
                log_date=datetime.utcnow(),
                physical_progress="Started shuttering for 4th Floor Slab Pour. Poured 120 cu.m M30 Concrete.",
                labour_count=52,
                materials_consumed="120 cu.m Ready Mix Concrete M30",
                equipment_used="Tower Crane A, Concrete Boom Pump",
                issues_identified="None",
                remarks="Submitted for Site Engineer and Project Manager approval.",
                approval_status="pending"
            )
            db.add(log2)
            db.commit()
            db.refresh(log2)

            # Generate pending ApprovalTask for log2
            app_task = ApprovalTask(
                title=f"Site Daily Log Approval - Greenfield Business Park ({log2.log_date.strftime('%Y-%m-%d')})",
                entity_type="SiteLog",
                entity_id=log2.id,
                requester_id=admin.id,
                current_stage="Site Engineer",
                status="pending"
            )
            db.add(app_task)
            db.commit()

        # Seed Active Vendors
        if db.query(Vendor).count() == 0:
            v1 = Vendor(code="V-001", name="ABC Concrete", contact_person="Rajesh Sharma", email="sales@abcconcrete.com", phone="+91 98765 43210", gst_number="27AAAAA0000A1Z5", status="active")
            v2 = Vendor(code="V-002", name="Apex Structural", contact_person="Anil Kumar", email="info@apexstructural.com", phone="+91 98765 43211", gst_number="27BBBBB0000B1Z6", status="active")
            v3 = Vendor(code="V-003", name="XYZ Materials", contact_person="Vikram Singh", email="orders@xyzmaterials.com", phone="+91 98765 43212", gst_number="27CCCCC0000C1Z7", status="active")
        # Seed Schedule of Rates (SOR) Master Data
        if db.query(ScheduleOfRates).count() == 0:
            effective_dt = datetime(2027, 4, 1, 0, 0, 0)
            sor_records = [
                ScheduleOfRates(sor_code="SOR-001", description="Excavation in ordinary soil", category="Earthwork", unit="m³", rate=500.00, effective_from=effective_dt, status="Active"),
                ScheduleOfRates(sor_code="SOR-002", description="PCC M10", category="Concrete", unit="m³", rate=5500.00, effective_from=effective_dt, status="Active"),
                ScheduleOfRates(sor_code="SOR-003", description="RCC M30", category="Concrete", unit="m³", rate=8500.00, effective_from=effective_dt, status="Active"),
                ScheduleOfRates(sor_code="SOR-004", description="Reinforcement Steel Fe500", category="Structural", unit="Tonnes", rate=65000.00, effective_from=effective_dt, status="Active"),
                ScheduleOfRates(sor_code="SOR-005", description="Brick Masonry", category="Masonry", unit="m³", rate=7000.00, effective_from=effective_dt, status="Active"),
                ScheduleOfRates(sor_code="SOR-006", description="Internal Plaster", category="Finishing", unit="m²", rate=350.00, effective_from=effective_dt, status="Active"),
                ScheduleOfRates(sor_code="SOR-007", description="External Plaster", category="Finishing", unit="m²", rate=425.00, effective_from=effective_dt, status="Active"),
                ScheduleOfRates(sor_code="SOR-008", description="Structural Steel Fabrication", category="Structural", unit="Tonnes", rate=72000.00, effective_from=effective_dt, status="Active"),
                ScheduleOfRates(sor_code="SOR-009", description="Flooring", category="Finishing", unit="m²", rate=950.00, effective_from=effective_dt, status="Active"),
                ScheduleOfRates(sor_code="SOR-010", description="Excavation by machine", category="Earthwork", unit="m³", rate=350.00, effective_from=effective_dt, status="Active"),
            ]
            db.add_all(sor_records)
            db.commit()
            print("[+] Seeded 10 sample Schedule of Rates (SOR) master records!")

        # Seed Sample Work Plan Activities if empty
        if db.query(WorkPlan).count() == 0:
            proj = db.query(Project).filter(Project.code == "PROJ-GREENFIELD").first()
            if proj:
                phase = db.query(WbsTask).filter(WbsTask.project_id == proj.id, WbsTask.task_level == "Phase").first()
                if phase:
                    tasks = db.query(WbsTask).filter(WbsTask.project_id == proj.id, WbsTask.parent_task_id == phase.id).all()
                    task1 = tasks[0] if tasks else phase
                    task2 = tasks[1] if len(tasks) > 1 else task1
                    task3 = tasks[2] if len(tasks) > 2 else task1

                    wp1 = WorkPlan(
                        work_plan_number="WP-2026-001",
                        project_id=proj.id,
                        wbs_phase_id=phase.id,
                        task_id=task1.id,
                        activity_name="Site Excavation & Earthwork",
                        description="Excavation of main building foundation footprint to required depth.",
                        planned_quantity=5000.00,
                        unit="m³",
                        planned_start_date=datetime(2027, 4, 1, 0, 0, 0),
                        planned_end_date=datetime(2027, 5, 15, 0, 0, 0),
                        priority="HIGH",
                        remarks="Heavy machinery mobilization required on Day 1.",
                        status="NOT STARTED"
                    )
                    db.add(wp1)
                    db.commit()

                    wp2 = WorkPlan(
                        work_plan_number="WP-2026-002",
                        project_id=proj.id,
                        wbs_phase_id=phase.id,
                        task_id=task2.id,
                        activity_name="Foundation PCC Plain Concrete",
                        description="PCC M10 bed layer preparation over excavated area.",
                        planned_quantity=500.00,
                        unit="m³",
                        planned_start_date=datetime(2027, 5, 16, 0, 0, 0),
                        planned_end_date=datetime(2027, 5, 31, 0, 0, 0),
                        priority="MEDIUM",
                        dependency_id=wp1.id,
                        remarks="Depends on completion of site excavation.",
                        status="NOT STARTED"
                    )
                    db.add(wp2)
                    db.commit()

                    wp3 = WorkPlan(
                        work_plan_number="WP-2026-003",
                        project_id=proj.id,
                        wbs_phase_id=phase.id,
                        task_id=task3.id,
                        activity_name="RCC Foundation & Column Pedestals",
                        description="Reinforced concrete foundation casting and rebar tying.",
                        planned_quantity=750.00,
                        unit="m³",
                        planned_start_date=datetime(2027, 6, 1, 0, 0, 0),
                        planned_end_date=datetime(2027, 6, 30, 0, 0, 0),
                        priority="CRITICAL",
                        dependency_id=wp2.id,
                        remarks="Requires continuous pour approval.",
                        status="NOT STARTED"
                    )
                    db.add(wp3)
                    db.commit()
                    print("[+] Seeded 3 sample Work Plan activities for PROJ-GREENFIELD!")

        # Seed Sample Project Team Members if empty
        if db.query(ProjectTeamMember).count() == 0:
            proj = db.query(Project).filter((Project.code == "PROJ-GREENFIELD") | (Project.name.like("%Greenfield%"))).first()
            if proj:
                u_pm = db.query(User).filter(User.username == "pm").first()
                u_site = db.query(User).filter(User.username == "site").first()
                u_admin = db.query(User).filter(User.username == "admin").first()
                u_fin = db.query(User).filter(User.username == "finance").first()

                team_seeds = [
                    (u_pm, "PROJECT MANAGER", "Project Management", "Overall project execution & governance", datetime(2026, 1, 15)),
                    (u_site, "SITE ENGINEER", "Execution", "Foundation and structural civil execution supervision", datetime(2026, 2, 1)),
                    (u_admin, "PROJECT SPONSOR", "Executive Management", "Executive sponsorship & client alignment", datetime(2026, 1, 10)),
                    (u_fin, "FINANCE", "Finance", "Budget allocation and invoice verification", datetime(2026, 2, 10)),
                ]

                for user_obj, role_str, dept_str, resp_str, join_dt in team_seeds:
                    if user_obj:
                        tm = ProjectTeamMember(
                            project_id=proj.id,
                            user_id=user_obj.id,
                            project_role=role_str,
                            department=dept_str,
                            responsibility=resp_str,
                            joining_date=join_dt,
                            status="ACTIVE",
                            created_by_id=admin.id if admin else user_obj.id
                        )
                        db.add(tm)
                        db.commit()
                        db.refresh(tm)

                        aud = ProjectTeamAudit(
                            team_member_id=tm.id,
                            action="ADDED",
                            changed_by_user_id=admin.id if admin else user_obj.id,
                            remarks=f"Initial team onboarding as {role_str}"
                        )
                        db.add(aud)
                        db.commit()

                print("[+] Seeded 4 sample Project Team Members for Greenfield project!")

        # Seed SOR Editions & Regions if empty / missing
        e_dsr = db.query(SorEdition).filter(SorEdition.name == "DSR 2023").first()
        if not e_dsr:
            e_dsr = SorEdition(name="DSR 2023", description="Delhi Schedule of Rates 2023", status="Active", effective_date=datetime(2023, 4, 1))
            db.add(e_dsr)
            db.commit()
            db.refresh(e_dsr)

        e_cpwd = db.query(SorEdition).filter(SorEdition.name == "CPWD SOR 2024").first()
        if not e_cpwd:
            e_cpwd = SorEdition(name="CPWD SOR 2024", description="CPWD Schedule of Rates 2024", status="Active", effective_date=datetime(2024, 1, 1))
            db.add(e_cpwd)
            db.commit()

        r_mh = db.query(SorRegion).filter(SorRegion.name == "Maharashtra").first()
        if not r_mh:
            r_mh = SorRegion(code="MH", name="Maharashtra", status="Active")
            db.add(r_mh)
            db.commit()
            db.refresh(r_mh)

        r_dl = db.query(SorRegion).filter(SorRegion.name == "Delhi").first()
        if not r_dl:
            r_dl = SorRegion(code="DL", name="Delhi", status="Active")
            db.add(r_dl)
            db.commit()

        r_ka = db.query(SorRegion).filter(SorRegion.name == "Karnataka").first()
        if not r_ka:
            r_ka = SorRegion(code="KA", name="Karnataka", status="Active")
            db.add(r_ka)
            db.commit()

        # Backfill existing schedule_of_rates without edition/region
        sors = db.query(ScheduleOfRates).all()
        for s in sors:
            changed = False
            if not s.sor_edition_id:
                s.sor_edition_id = e_dsr.id
                s.sor_edition_name = e_dsr.name
                changed = True
            if not s.sor_region_id:
                s.sor_region_id = r_mh.id
                s.sor_region_name = r_mh.name
                changed = True
            if s.base_rate is None:
                s.base_rate = s.rate or 0.0
                changed = True
            if s.cost_index is None:
                s.cost_index = 1.0000
                changed = True
            if changed:
                db.commit()

        # Set default edition & region on existing Projects if missing
        projs = db.query(Project).all()
        for p in projs:
            p_changed = False
            if not p.sor_edition_id:
                p.sor_edition_id = e_dsr.id
                p.sor_edition_name = e_dsr.name
                p_changed = True
            if not p.sor_region_id:
                p.sor_region_id = r_mh.id
                p.sor_region_name = r_mh.name
                p_changed = True
            if p_changed:
                db.commit()

        print("[+] Seed dataset for PROJ-GREENFIELD verified/created successfully!")

    except Exception as e:
        db.rollback()
        print(f"[-] Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_tables_and_seed()
