import pymysql
import json
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import (
    Customer, Product, SalesOrder, OrderItem, User, Notification, 
    ApprovalTask, ApprovalLog, AuditLog, Property, Building, Unit, 
    CrmLead, PropertyBooking, PaymentInstallment,
    Project, WbsTask, SiteDailyLog,
    Vendor, PurchaseRequisition, PurchaseOrder, BoqItem, MeasurementBook, ContractorBill,
    HseIncident, HseCapa, SafetyAudit, QualityInspection, QualityNcr,
    Tenant, HelpdeskTicket, FacilityWorkOrder, UtilityBill, VisitorPass,
    TallySyncQueue
)
from app.api.tally import generate_tally_xml
from passlib.context import CryptContext
from datetime import datetime, timedelta

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def ensure_database_exists():
    """Ensure the target database exists in MySQL."""
    try:
        connection = pymysql.connect(
            host=settings.DB_HOST,
            port=int(settings.DB_PORT),
            user=settings.DB_USER,
            password=settings.DB_PASSWORD
        )
        with connection.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {settings.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        connection.close()
        print(f"[+] MySQL Database '{settings.DB_NAME}' verified/created.")
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
        # Seed Admin User if missing
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                email="admin@erp.com",
                full_name="System Administrator",
                hashed_password=pwd_context.hash("admin123"),
                role="admin",
                is_active=True
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)

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

        # Seed Projects
        proj1 = db.query(Project).filter(Project.code == "PRJ-SCT-01").first()
        if not proj1:
            proj1 = Project(
                name="Skyline Commercial Tower - Phase 1 Construction",
                code="PRJ-SCT-01",
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

        proj2 = db.query(Project).filter(Project.code == "PROJ-SKYLINE").first()
        if not proj2:
            proj2 = Project(
                name="Skyline Business Tower",
                code="PROJ-SKYLINE",
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

        # Seed Property & Buildings & Units for PROJ-SKYLINE
        prop = db.query(Property).filter(Property.code == "PROP-SKYLINE").first()
        if not prop:
            prop = Property(
                project_id=proj2.id,
                name="Skyline Business Complex",
                code="PROP-SKYLINE",
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
            prop.name = "Skyline Business Complex"
            prop.property_type = "Commercial"
            prop.location = "Financial District Plaza, Central Avenue"
            prop.status = "Active"
            prop.total_buildings = 2
            db.commit()

        b1 = db.query(Building).filter(Building.code == "BLD-TOWER-A").first()
        if not b1:
            b1 = Building(property_id=prop.id, name="Skyline Tower A", code="BLD-TOWER-A", building_type="Tower", total_floors=10, status="Active")
            db.add(b1)
            db.commit()

        b2 = db.query(Building).filter(Building.code == "BLD-TOWER-B").first()
        if not b2:
            b2 = Building(property_id=prop.id, name="Skyline Tower B", code="BLD-TOWER-B", building_type="Tower", total_floors=12, status="Active")
            db.add(b2)
            db.commit()

        # Seed Units for Skyline Tower A (Story 3 sample inventory)
        if b1 and db.query(Unit).filter(Unit.building_id == b1.id).count() == 0:
            u1 = Unit(building_id=b1.id, unit_number="Office 101", unit_code="U-TOWER-A-101", unit_type="Office", floor_number=1, area_sqft=2500.0, rate_per_sqft=180.0, total_price=450000.0, status="AVAILABLE", facing="North", configuration="Executive Office", description="Prime ground floor office space")
            u2 = Unit(building_id=b1.id, unit_number="Office 102", unit_code="U-TOWER-A-102", unit_type="Office", floor_number=1, area_sqft=3000.0, rate_per_sqft=190.0, total_price=570000.0, status="AVAILABLE", facing="East", configuration="Corner Suite", description="Spacious corner unit with east view")
            u3 = Unit(building_id=b1.id, unit_number="Office 103", unit_code="U-TOWER-A-103", unit_type="Office", floor_number=1, area_sqft=1500.0, rate_per_sqft=200.0, total_price=300000.0, status="HELD", facing="North-East", configuration="Standard Suite", description="Temporarily held for client review")
            u4 = Unit(building_id=b1.id, unit_number="Office 104", unit_code="U-TOWER-A-104", unit_type="Office", floor_number=1, area_sqft=1800.0, rate_per_sqft=210.0, total_price=378000.0, status="BOOKED", facing="South", configuration="Executive Office", description="Booked unit under sales process")
            u5 = Unit(building_id=b1.id, unit_number="Retail 01", unit_code="U-TOWER-A-R01", unit_type="Retail Shop", floor_number=1, area_sqft=1200.0, rate_per_sqft=250.0, total_price=300000.0, status="SOLD", facing="West", configuration="High-Street Retail", description="Sold retail store location")
            db.add_all([u1, u2, u3, u4, u5])
            b1.total_units = 5
            if prop:
                prop.total_units = 5
            db.commit()

        # Seed WBS Tasks for PROJ-SKYLINE
        if proj2 and db.query(WbsTask).filter(WbsTask.project_id == proj2.id).count() == 0:
            # 1. Foundation Phase
            ph_f = WbsTask(project_id=proj2.id, title="Foundation", task_level="Phase", start_date=datetime.utcnow() - timedelta(days=60), end_date=datetime.utcnow() - timedelta(days=10), planned_budget=500000.0, actual_cost=490000.0, progress_pct=100.0, status="completed")
            db.add(ph_f)
            db.commit()

            t1 = WbsTask(project_id=proj2.id, parent_task_id=ph_f.id, title="Site Preparation", task_level="Task", contractor_name="Apex Excavation", start_date=datetime.utcnow() - timedelta(days=60), end_date=datetime.utcnow() - timedelta(days=45), planned_budget=100000.0, actual_cost=98000.0, progress_pct=100.0, status="completed")
            t2 = WbsTask(project_id=proj2.id, parent_task_id=ph_f.id, title="Excavation", task_level="Task", contractor_name="Apex Excavation", start_date=datetime.utcnow() - timedelta(days=45), end_date=datetime.utcnow() - timedelta(days=25), planned_budget=200000.0, actual_cost=195000.0, progress_pct=100.0, status="completed")
            t3 = WbsTask(project_id=proj2.id, parent_task_id=ph_f.id, title="Foundation Concrete", task_level="Task", contractor_name="Apex Concrete", start_date=datetime.utcnow() - timedelta(days=25), end_date=datetime.utcnow() - timedelta(days=10), planned_budget=200000.0, actual_cost=197000.0, progress_pct=100.0, status="completed")
            db.add_all([t1, t2, t3])

            # 2. Structure Phase
            ph_s = WbsTask(project_id=proj2.id, title="Structure", task_level="Phase", start_date=datetime.utcnow() - timedelta(days=10), end_date=datetime.utcnow() + timedelta(days=60), planned_budget=1200000.0, actual_cost=630000.0, progress_pct=45.0, status="in_progress")
            db.add(ph_s)
            db.commit()

            t4 = WbsTask(project_id=proj2.id, parent_task_id=ph_s.id, title="Columns", task_level="Task", contractor_name="Titan Structural", start_date=datetime.utcnow() - timedelta(days=10), end_date=datetime.utcnow() + timedelta(days=15), planned_budget=400000.0, actual_cost=280000.0, progress_pct=70.0, status="in_progress")
            t5 = WbsTask(project_id=proj2.id, parent_task_id=ph_s.id, title="Beams", task_level="Task", contractor_name="Titan Structural", start_date=datetime.utcnow() + timedelta(days=5), end_date=datetime.utcnow() + timedelta(days=35), planned_budget=400000.0, actual_cost=160000.0, progress_pct=40.0, status="in_progress")
            t6 = WbsTask(project_id=proj2.id, parent_task_id=ph_s.id, title="Slabs", task_level="Task", contractor_name="Titan Structural", start_date=datetime.utcnow() + timedelta(days=20), end_date=datetime.utcnow() + timedelta(days=60), planned_budget=400000.0, actual_cost=100000.0, progress_pct=25.0, status="in_progress")
            db.add_all([t4, t5, t6])

            # 3. MEP Phase
            ph_mep = WbsTask(project_id=proj2.id, title="MEP", task_level="Phase", start_date=datetime.utcnow() + timedelta(days=40), end_date=datetime.utcnow() + timedelta(days=120), planned_budget=800000.0, actual_cost=0.0, progress_pct=0.0, status="not_started")
            db.add(ph_mep)
            db.commit()

            t7 = WbsTask(project_id=proj2.id, parent_task_id=ph_mep.id, title="Electrical", task_level="Task", contractor_name="Volt Electro Corp", start_date=datetime.utcnow() + timedelta(days=40), end_date=datetime.utcnow() + timedelta(days=90), planned_budget=450000.0, actual_cost=0.0, progress_pct=0.0, status="not_started")
            t8 = WbsTask(project_id=proj2.id, parent_task_id=ph_mep.id, title="Plumbing", task_level="Task", contractor_name="HydroFlow Piping", start_date=datetime.utcnow() + timedelta(days=50), end_date=datetime.utcnow() + timedelta(days=120), planned_budget=350000.0, actual_cost=0.0, progress_pct=0.0, status="not_started")
            db.add_all([t7, t8])

            # 4. Finishing Phase
            ph_fin = WbsTask(project_id=proj2.id, title="Finishing", task_level="Phase", start_date=datetime.utcnow() + timedelta(days=100), end_date=datetime.utcnow() + timedelta(days=180), planned_budget=600000.0, actual_cost=0.0, progress_pct=0.0, status="not_started")
            db.add(ph_fin)
            db.commit()

            t9 = WbsTask(project_id=proj2.id, parent_task_id=ph_fin.id, title="Flooring", task_level="Task", contractor_name="Royal Finishes", start_date=datetime.utcnow() + timedelta(days=100), end_date=datetime.utcnow() + timedelta(days=140), planned_budget=350000.0, actual_cost=0.0, progress_pct=0.0, status="not_started")
            t10 = WbsTask(project_id=proj2.id, parent_task_id=ph_fin.id, title="Painting", task_level="Task", contractor_name="Royal Finishes", start_date=datetime.utcnow() + timedelta(days=130), end_date=datetime.utcnow() + timedelta(days=180), planned_budget=250000.0, actual_cost=0.0, progress_pct=0.0, status="not_started")
            db.add_all([t9, t10])

            db.commit()

            # Recalculate project progress
            tasks = db.query(WbsTask).filter(WbsTask.project_id == proj2.id).all()
            if tasks:
                avg_p = sum(float(t.progress_pct) for t in tasks) / len(tasks)
                proj2.progress_pct = round(avg_p, 2)
                db.commit()

        # Seed BOQ Items for PROJ-SKYLINE
        if proj2 and db.query(BoqItem).filter(BoqItem.project_id == proj2.id).count() == 0:
            boq1 = BoqItem(project_id=proj2.id, item_name="Cement (PPC Grade 53)", unit="Bags", approved_qty=10000.00, rate=8.50, total_amount=85000.00, contractor_name="Apex Concrete")
            boq2 = BoqItem(project_id=proj2.id, item_name="Reinforcement Steel Fe500", unit="Tonnes", approved_qty=450.00, rate=750.00, total_amount=337500.00, contractor_name="Titan Structural")
            boq3 = BoqItem(project_id=proj2.id, item_name="Ready Mix Concrete M30 Grade", unit="cu.m", approved_qty=3500.00, rate=120.00, total_amount=420000.00, contractor_name="Apex Concrete")
            boq4 = BoqItem(project_id=proj2.id, item_name="Bricks & AAC Blocks 600x200x150mm", unit="Units", approved_qty=25000.00, rate=3.20, total_amount=80000.00, contractor_name="Royal Finishes")
            boq5 = BoqItem(project_id=proj2.id, item_name="Sand & Coarse Aggregates", unit="cu.m", approved_qty=2000.00, rate=45.00, total_amount=90000.00, contractor_name="Apex Excavation")
            boq6 = BoqItem(project_id=proj2.id, item_name="Electrical Materials & Heavy Cabling", unit="Lot", approved_qty=1.00, rate=250000.00, total_amount=250000.00, contractor_name="Volt Electro Corp")
            boq7 = BoqItem(project_id=proj2.id, item_name="Plumbing CPVC Pipes & Valves", unit="Lot", approved_qty=1.00, rate=180000.00, total_amount=180000.00, contractor_name="HydroFlow Piping")
            db.add_all([boq1, boq2, boq3, boq4, boq5, boq6, boq7])
            db.commit()

        # Seed Site Daily Logs & Approval Tasks for PROJ-SKYLINE
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
                title=f"Site Daily Log Approval - Skyline Business Tower ({log2.log_date.strftime('%Y-%m-%d')})",
                entity_type="SiteLog",
                entity_id=log2.id,
                requester_id=admin.id,
                current_stage="Site Engineer",
                status="pending"
            )
            db.add(app_task)
            db.commit()

        print("[+] Seed dataset for PROJ-SKYLINE verified/created successfully!")
    except Exception as e:
        db.rollback()
        print(f"[-] Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_tables_and_seed()
