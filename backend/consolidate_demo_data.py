"""
Consolidate Demo Data & End-to-End Connectivity
Idempotent script to:
1. Ensure is_active column exists on `projects`.
2. Keep EXACTLY 4 active demo projects:
   - Metro Tower Construction Phase 1 (ID: 29, PRJ-PRV01-A)
   - Greenfield Data Center Park (ID: 2, PROJ-GREENFIELD)
   - Riverside Commercial Complex – Phase 1 (ID: 1, PROJ-RIVERSIDE)
   - Heritage Plaza Restoration (ID: 30, PRJ-PRV01-B)
3. Archive all other projects (is_active = False, status = 'ARCHIVED') without deleting any data.
4. Establish 100% end-to-end linked records in MySQL for the top 3 projects:
   Project -> BOQ -> Estimate -> Technical Sanction -> Award -> Work Order ->
   WBS -> BOQ Mapping -> Team -> Tasks -> Milestones -> Site Logs -> e-MB -> Hindrance.
"""

import sys
import os
from pathlib import Path
from datetime import datetime, date, timedelta
from decimal import Decimal
import pymysql

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.database import engine, SessionLocal
from app.config import settings
from app.models import (
    Project, BoqItem, ProjectEstimate, TechnicalSanction, ContractorAward,
    WorkOrder, WorkPlan, WbsTask, WorkPlanBoqMapping, ProjectTeamMember,
    TaskAssignment, ProjectMilestone, SiteDailyLog, MeasurementBook,
    Hindrance, Vendor, User, Customer, Division, TestCheckAssignment
)

ACTIVE_PROJECT_IDS = [29, 2, 1, 30]

def step1_ensure_columns():
    print("=== Step 1: Checking schema column migrations ===")
    cfg = settings.parsed_db_config
    conn = pymysql.connect(
        host=cfg["host"],
        port=int(cfg["port"]),
        user=cfg["user"],
        password=cfg["password"],
        database=cfg["database"]
    )
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'is_active';",
            (cfg["database"],)
        )
        has_is_active = cursor.fetchone()[0] > 0
        if not has_is_active:
            print("Adding 'is_active' column to 'projects' table...")
            cursor.execute("ALTER TABLE projects ADD COLUMN is_active BOOLEAN DEFAULT TRUE;")
            conn.commit()
            print("Column 'is_active' added.")
        else:
            print("Column 'is_active' already exists.")
    conn.close()

def step2_archive_non_demo_projects(db):
    print("\n=== Step 2: Setting active scope (4 active demo projects) ===")
    # Archive all non-demo projects
    archived_count = db.query(Project).filter(~Project.id.in_(ACTIVE_PROJECT_IDS)).update(
        {Project.is_active: False, Project.status: "ARCHIVED"},
        synchronize_session=False
    )
    db.commit()
    print(f"Archived {archived_count} non-demo projects (preserved in database with is_active=False).")

    # Ensure 4 demo projects are active
    active_projects = db.query(Project).filter(Project.id.in_(ACTIVE_PROJECT_IDS)).all()
    for p in active_projects:
        p.is_active = True
        if p.status == "ARCHIVED" or not p.status:
            p.status = "ACTIVE"
        if p.id == 1:
            p.name = "Riverside Commercial Complex – Phase 1"
            p.code = "PROJ-RIVERSIDE"
            p.location = "Riverfront Boulevard, Sector 4, Ahmedabad"
            p.budget = Decimal("65000000.00")
            p.currency = "INR"
            p.status = "ACTIVE"
            p.progress_pct = Decimal("28.00")
        elif p.id == 2:
            p.name = "Greenfield Data Center Park"
            p.code = "PROJ-GREENFIELD"
            p.location = "Tech Corridor Zone 4, Bengaluru"
            p.budget = Decimal("120000000.00")
            p.currency = "INR"
            p.status = "ACTIVE"
            p.progress_pct = Decimal("45.00")
        elif p.id == 29:
            p.name = "Metro Tower Construction Phase 1"
            p.code = "PRJ-PRV01-A"
            p.location = "Cyber City Sector 62, Gurugram"
            p.budget = Decimal("85000000.00")
            p.currency = "INR"
            p.status = "ACTIVE"
            p.progress_pct = Decimal("32.50")
        elif p.id == 30:
            p.name = "Heritage Plaza Restoration"
            p.code = "PRJ-PRV01-B"
            p.location = "Old Fort Heritage Zone, Jaipur"
            p.budget = Decimal("18500000.00")
            p.currency = "INR"
            p.status = "ACTIVE"
            p.progress_pct = Decimal("12.00")

    db.commit()
    print(f"Activated exactly {len(active_projects)} demo projects: {[p.name for p in active_projects]}")

def step3_seed_metro_tower(db):
    print("\n=== Step 3: Establishing End-to-End Chain for Metro Tower (Project 29) ===")
    p_id = 29
    project = db.query(Project).get(p_id)
    if not project:
        print("Error: Project 29 not found!")
        return

    # Ensure Vendor exists
    vendor = db.query(Vendor).first()
    if not vendor:
        vendor = Vendor(name="Apex Structural Concrete Corp", code="VND-APX", email="contact@apexstructural.com")
        db.add(vendor)
        db.commit()

    # 1. BOQ Items
    boq_data = [
        ("RCC Column Concrete M35 Grade", "m³", Decimal("500.00"), Decimal("8000.00")),
        ("Earthwork Excavation in Ordinary Rock / Soil", "m³", Decimal("2500.00"), Decimal("450.00")),
        ("TMT Fe500D High Strength Reinforcement Steel", "tonnes", Decimal("120.00"), Decimal("68000.00")),
        ("AAC Lightweight Block Masonry 200mm Thick", "m³", Decimal("850.00"), Decimal("4200.00")),
        ("Internal Cement Plastering 1:4 Mix 12mm", "m²", Decimal("4500.00"), Decimal("280.00")),
    ]

    existing_boqs = db.query(BoqItem).filter(BoqItem.project_id == p_id).all()
    created_boqs = list(existing_boqs)

    # Fix encoding of existing item 189
    if existing_boqs:
        existing_boqs[0].unit = "m³"
        db.commit()

    existing_names = [b.item_name for b in existing_boqs]
    for name, unit, qty, rate in boq_data:
        if name not in existing_names:
            b = BoqItem(
                project_id=p_id,
                item_name=name,
                unit=unit,
                approved_qty=qty,
                rate=rate,
                total_amount=qty * rate,
                vendor_id=vendor.id,
                contractor_name=vendor.name,
                status="ACTIVE"
            )
            db.add(b)
            db.commit()
            created_boqs.append(b)
            print(f"  Added BOQ: {name}")

    # 2. Detailed Estimate
    estimate = db.query(ProjectEstimate).filter(ProjectEstimate.project_id == p_id).first()
    est_total = sum([float(b.total_amount or (b.approved_qty * b.rate)) for b in created_boqs])
    if not estimate:
        estimate = ProjectEstimate(
            project_id=p_id,
            estimate_number="EST-PRV01-001",
            version=1,
            revision_number=0,
            base_cost=Decimal(str(est_total)),
            contingency_pct=Decimal("3.00"),
            contingency_amount=Decimal(str(round(est_total * 0.03, 2))),
            departmental_charges_pct=Decimal("2.00"),
            departmental_charges_amount=Decimal(str(round(est_total * 0.02, 2))),
            total_amount=Decimal(str(round(est_total * 1.05, 2))),
            status="APPROVED",
            ts_status="APPROVED",
            is_ts_locked=True
        )
        db.add(estimate)
        db.commit()
        print(f"  Created Estimate: {estimate.estimate_number}")
    else:
        estimate.status = "APPROVED"
        estimate.ts_status = "APPROVED"
        estimate.is_ts_locked = True
        estimate.base_cost = Decimal(str(est_total))
        estimate.total_amount = Decimal(str(round(est_total * 1.05, 2)))
        db.commit()
        print(f"  Updated Estimate: {estimate.estimate_number} (APPROVED)")

    # 3. Technical Sanction
    ts = db.query(TechnicalSanction).filter(TechnicalSanction.project_id == p_id).first()
    if not ts:
        ts = TechnicalSanction(
            project_id=p_id,
            detailed_estimate_id=estimate.id,
            sanction_reference_number="TS/SE/2026/089",
            sanction_date=date.today() - timedelta(days=60),
            remarks="Sanctioned in full compliance with CPWD Specifications & approved architectural drawings.",
            status="APPROVED",
            submitted_by_id=1,
            approved_by_id=1,
            approved_at=datetime.utcnow() - timedelta(days=58),
            estimate_total_at_submission=estimate.total_amount
        )
        db.add(ts)
        db.commit()
        print(f"  Created Technical Sanction: {ts.sanction_reference_number}")

    # 4. Contractor Award
    award = db.query(ContractorAward).filter(ContractorAward.project_id == p_id).first()
    if not award:
        awd_amt = Decimal(str(round(float(estimate.total_amount) * 0.98, 2)))
        award = ContractorAward(
            award_reference="AWD-2026-METRO-01",
            project_id=p_id,
            estimate_id=estimate.id,
            contractor_id=vendor.id,
            estimated_amount=estimate.total_amount,
            award_amount=awd_amt,
            variance_amount=awd_amt - estimate.total_amount,
            variance_percentage=Decimal("-2.00"),
            award_date=date.today() - timedelta(days=50),
            start_date=date.today() - timedelta(days=45),
            completion_date=date.today() + timedelta(days=320),
            status="AWARDED",
            remarks="Lowest responsive bidder after competitive tendering."
        )
        db.add(award)
        db.commit()
        print(f"  Created Contractor Award: {award.award_reference}")

    # 5. Work Order
    wo = db.query(WorkOrder).filter(WorkOrder.project_id == p_id).first()
    if not wo:
        wo = WorkOrder(
            work_order_number="WO-2026-METRO-001",
            award_id=award.id,
            project_id=p_id,
            contractor_id=vendor.id,
            issue_date=date.today() - timedelta(days=45),
            scope_of_work="Civil, Structural and Concrete Construction of Metro Tower Phase 1",
            description="Comprehensive substructure and superstructure execution as per approved schedule.",
            work_order_value=award.award_amount,
            start_date=date.today() - timedelta(days=40),
            completion_date=date.today() + timedelta(days=320),
            payment_terms="Milestone-based billing against verified digital e-MB with 10% retention.",
            status="ACTIVE",
            created_by_id=1
        )
        db.add(wo)
        db.commit()
        print(f"  Created Work Order: {wo.work_order_number}")

    # 6. WBS Tasks
    wbs_tasks = db.query(WbsTask).filter(WbsTask.project_id == p_id).all()
    print(f"  Existing WBS tasks count: {len(wbs_tasks)}")

    # 7. Work Plan & BOQ Mappings
    wp = db.query(WorkPlan).filter(WorkPlan.project_id == p_id).first()
    first_wbs_task = db.query(WbsTask).filter(WbsTask.project_id == p_id, WbsTask.task_level == "Task").first()
    first_phase = db.query(WbsTask).filter(WbsTask.project_id == p_id, WbsTask.task_level == "Phase").first()

    if not wp and first_wbs_task:
        wp = WorkPlan(
            work_plan_number="WP-METRO-01",
            project_id=p_id,
            wbs_phase_id=first_phase.id if first_phase else first_wbs_task.id,
            task_id=first_wbs_task.id,
            activity_name="Foundation & RCC Column Execution",
            description="Substructure excavation and column casting",
            planned_quantity=Decimal("500.00"),
            unit="m³",
            planned_start_date=date.today() - timedelta(days=40),
            planned_end_date=date.today() + timedelta(days=60),
            priority="HIGH",
            status="IN_PROGRESS",
            created_by_id=1
        )
        db.add(wp)
        db.commit()
        print(f"  Created Work Plan: {wp.work_plan_number}")

    if wp and created_boqs:
        mapping = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.project_id == p_id).first()
        if not mapping:
            mapping = WorkPlanBoqMapping(
                work_plan_id=wp.id,
                boq_item_id=created_boqs[0].id,
                project_id=p_id,
                mapped_quantity=Decimal("500.00"),
                unit=created_boqs[0].unit or "m³",
                created_by_id=1
            )
            db.add(mapping)
            db.commit()
            print(f"  Created BOQ Mapping: BOQ {created_boqs[0].id} -> WP {wp.id}")

    # 8. Project Team Members
    team_configs = [
        (4, "Project Manager", "Senior Project Manager"),
        (26, "EE", "Executive Engineer"),
        (25, "AE", "Assistant Engineer"),
        (5, "JE", "Junior Engineer"),
        (29, "Contractor PM", "Contractor Representative"),
    ]
    for uid, role, resp in team_configs:
        u = db.query(User).get(uid)
        if u:
            existing_tm = db.query(ProjectTeamMember).filter(
                ProjectTeamMember.project_id == p_id,
                ProjectTeamMember.user_id == uid
            ).first()
            if not existing_tm:
                tm = ProjectTeamMember(
                    project_id=p_id,
                    user_id=uid,
                    project_role=role,
                    department="Civil Engineering",
                    responsibility=resp,
                    joining_date=date.today() - timedelta(days=60),
                    status="ACTIVE",
                    is_active=True,
                    created_by_id=1,
                    effective_from=date.today() - timedelta(days=60)
                )
                db.add(tm)
                db.commit()
                print(f"  Added Team Member: {u.full_name} ({role})")

    # 9. Task Assignments
    if first_wbs_task:
        task_assign = db.query(TaskAssignment).filter(TaskAssignment.project_id == p_id).first()
        if not task_assign:
            task_assign = TaskAssignment(
                assignment_ref="TSK-METRO-001",
                project_id=p_id,
                wbs_phase_id=first_phase.id if first_phase else first_wbs_task.id,
                task_id=first_wbs_task.id,
                assigned_user_id=5,  # Site engineer
                role="Site Engineer",
                priority="HIGH",
                start_date=date.today() - timedelta(days=30),
                due_date=date.today() + timedelta(days=30),
                status="IN_PROGRESS",
                remarks="Supervise RCC casting and cube test sampling.",
                created_by_id=1
            )
            db.add(task_assign)
            db.commit()
            print(f"  Created Task Assignment: {task_assign.assignment_ref}")

    # 10. Project Milestones
    existing_ms = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == p_id).all()
    existing_ms_names = [m.milestone_name for m in existing_ms]
    milestone_defs = [
        ("Substructure Excavation & Soil Prep", True, date.today() - timedelta(days=25), "Met"),
        ("Plinth Level Column Casting (500 m³)", True, date.today() + timedelta(days=20), "Pending"),
        ("Floor 1-5 Structural Slab Casting", True, date.today() + timedelta(days=90), "Pending"),
    ]
    for name, is_date, dt, status in milestone_defs:
        if name not in existing_ms_names and first_wbs_task:
            ms = ProjectMilestone(
                project_id=p_id,
                wbs_node_id=first_wbs_task.id,
                milestone_name=name,
                is_date_based=is_date,
                is_quantity_based=False,
                target_date=dt,
                status=status,
                created_by_id=1
            )
            db.add(ms)
            db.commit()
            print(f"  Added Milestone: {name} ({status})")

    # 11. Daily Site Logs
    logs = db.query(SiteDailyLog).filter(SiteDailyLog.project_id == p_id).all()
    if not logs and created_boqs:
        for day_offset, progress_txt, qty in [
            (5, "Completed column reinforcement binding grid B", Decimal("25.00")),
            (4, "Concreted 4 columns in basement sector 2", Decimal("30.00")),
            (2, "Concreted 6 foundation columns with M35 mix", Decimal("40.00")),
            (1, "Formwork stripping and 7-day curing verified", Decimal("15.00")),
        ]:
            log = SiteDailyLog(
                project_id=p_id,
                engineer_id=5,
                log_date=datetime.utcnow() - timedelta(days=day_offset),
                physical_progress=progress_txt,
                labour_count=32,
                materials_consumed="M35 Concrete, Fe500D Rebar, Curing compound",
                equipment_used="Concrete Transit Mixer, Tower Crane 1, Needle Vibrators",
                approval_status="approved",
                boq_item_id=created_boqs[0].id,
                executed_qty=qty
            )
            db.add(log)
            db.commit()
            print(f"  Added Site Daily Log: {progress_txt[:40]}...")

    # 12. Measurement Book (e-MB)
    emb = db.query(MeasurementBook).filter(MeasurementBook.project_id == p_id).all()
    if not emb and created_boqs:
        for offset, qty, remarks in [
            (4, Decimal("30.00"), "Basement grid B columns 1-4 measured and verified."),
            (2, Decimal("40.00"), "Foundation columns grid C 1-6 measured."),
        ]:
            mb_entry = MeasurementBook(
                project_id=p_id,
                boq_item_id=created_boqs[0].id,
                engineer_id=5,
                log_date=datetime.utcnow() - timedelta(days=offset),
                location_zone="Basement Level 1 - Grid B/C",
                measured_qty=qty,
                remarks=remarks,
                unit="m³",
                status="APPROVED",
                description="Column RCC M35 execution",
                measurement_method="Standard Geometric Measurement",
                length=Decimal("4.00"),
                breadth=Decimal("2.50"),
                height=Decimal("3.00"),
                computed_quantity=qty,
                created_by_id=5,
                contractor_rep_signer_id=29,
                contractor_rep_signed_at=datetime.utcnow() - timedelta(days=offset),
                je_signer_id=5,
                je_signed_at=datetime.utcnow() - timedelta(days=offset)
            )
            db.add(mb_entry)
            db.commit()
            print(f"  Added e-MB entry: {remarks[:40]}...")

    # 13. Hindrance
    hindrance = db.query(Hindrance).filter(Hindrance.project_id == p_id).first()
    if not hindrance and first_wbs_task:
        hindrance = Hindrance(
            project_id=p_id,
            wbs_node_id=first_wbs_task.id,
            hindrance_type="Utility Shift Delay",
            date_occurred=date.today() - timedelta(days=15),
            delay_start_date=date.today() - timedelta(days=15),
            delay_end_date=date.today() - timedelta(days=5),
            description="Municipal corporation main water pipeline relocation clearance delayed along north boundary.",
            raised_by_id=5,
            raised_at=datetime.utcnow() - timedelta(days=15),
            current_status="Decided",
            ee_id=26,
            ee_decision="Accepted",
            ee_remarks="10 days extension of time recommended without liquidated damages.",
            decided_at=datetime.utcnow() - timedelta(days=7),
            sla_due_at=datetime.utcnow() - timedelta(days=12)
        )
        db.add(hindrance)
        db.commit()
        print(f"  Added Hindrance record: {hindrance.hindrance_type}")

    print("=== Metro Tower Chain Complete ===")

def step4_seed_greenfield(db):
    print("\n=== Step 4: Completing End-to-End Chain for Greenfield Data Center (Project 2) ===")
    p_id = 2
    project = db.query(Project).get(p_id)
    if not project:
        return

    # Technical Sanction
    estimate = db.query(ProjectEstimate).filter(ProjectEstimate.project_id == p_id).first()
    if estimate:
        estimate.status = "APPROVED"
        estimate.ts_status = "APPROVED"
        estimate.is_ts_locked = True
        db.commit()

        ts = db.query(TechnicalSanction).filter(TechnicalSanction.project_id == p_id).first()
        if not ts:
            ts = TechnicalSanction(
                project_id=p_id,
                detailed_estimate_id=estimate.id,
                sanction_reference_number="TS/SE/2026/GDC-01",
                sanction_date=date.today() - timedelta(days=90),
                remarks="Technically sanctioned for Hyperscale Tier IV data center civil & power infrastructure.",
                status="APPROVED",
                submitted_by_id=1,
                approved_by_id=1,
                approved_at=datetime.utcnow() - timedelta(days=88),
                estimate_total_at_submission=estimate.total_amount
            )
            db.add(ts)
            db.commit()
            print("  Added Technical Sanction for Greenfield")

    # Milestones
    first_wbs = db.query(WbsTask).filter(WbsTask.project_id == p_id, WbsTask.task_level == "Task").first()
    ms_count = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == p_id).count()
    if ms_count == 0 and first_wbs:
        for name, dt, status in [
            ("Data Center Shell & Core Structural Handover", date.today() - timedelta(days=30), "Met"),
            ("Dual 66kV Primary Substation Power Energization", date.today() + timedelta(days=45), "Pending"),
            ("Tier IV Chilled Water Loop Hydrostatic Testing", date.today() + timedelta(days=90), "Pending"),
        ]:
            ms = ProjectMilestone(
                project_id=p_id,
                wbs_node_id=first_wbs.id,
                milestone_name=name,
                is_date_based=True,
                is_quantity_based=False,
                target_date=dt,
                status=status,
                created_by_id=1
            )
            db.add(ms)
        db.commit()
        print("  Added Milestones for Greenfield")

    # Hindrance
    hind_count = db.query(Hindrance).filter(Hindrance.project_id == p_id).count()
    if hind_count == 0 and first_wbs:
        hindrance = Hindrance(
            project_id=p_id,
            wbs_node_id=first_wbs.id,
            hindrance_type="Equipment Delivery Delay",
            date_occurred=date.today() - timedelta(days=20),
            delay_start_date=date.today() - timedelta(days=20),
            delay_end_date=date.today() - timedelta(days=10),
            description="Custom 2500kVA generator transit delayed at regional border checkpost.",
            raised_by_id=4,
            raised_at=datetime.utcnow() - timedelta(days=20),
            current_status="Decided",
            ee_id=1,
            ee_decision="Accepted",
            ee_remarks="Equipment cleared; revised delivery schedule integrated.",
            decided_at=datetime.utcnow() - timedelta(days=10),
            sla_due_at=datetime.utcnow() - timedelta(days=17)
        )
        db.add(hindrance)
        db.commit()
        print("  Added Hindrance for Greenfield")

    print("=== Greenfield Chain Complete ===")

def step5_seed_riverside(db):
    print("\n=== Step 5: Completing End-to-End Chain for Riverside Commercial (Project 1) ===")
    p_id = 1
    project = db.query(Project).get(p_id)
    if not project:
        return

    # Technical Sanction
    estimate = db.query(ProjectEstimate).filter(ProjectEstimate.project_id == p_id).first()
    if estimate:
        estimate.status = "APPROVED"
        estimate.ts_status = "APPROVED"
        estimate.is_ts_locked = True
        db.commit()

        ts = db.query(TechnicalSanction).filter(TechnicalSanction.project_id == p_id).first()
        if not ts:
            ts = TechnicalSanction(
                project_id=p_id,
                detailed_estimate_id=estimate.id,
                sanction_reference_number="TS/SE/2026/RIV-01",
                sanction_date=date.today() - timedelta(days=75),
                remarks="Technically sanctioned for Riverside Commercial Complex Phase 1.",
                status="APPROVED",
                submitted_by_id=1,
                approved_by_id=1,
                approved_at=datetime.utcnow() - timedelta(days=73),
                estimate_total_at_submission=estimate.total_amount
            )
            db.add(ts)
            db.commit()
            print("  Added Technical Sanction for Riverside")

    vendor = db.query(Vendor).first()

    # Contractor Award
    award = db.query(ContractorAward).filter(ContractorAward.project_id == p_id).first()
    if not award and estimate and vendor:
        award = ContractorAward(
            award_reference="AWD-2026-RIVERSIDE-01",
            project_id=p_id,
            estimate_id=estimate.id,
            contractor_id=vendor.id,
            estimated_amount=estimate.total_amount,
            award_amount=estimate.total_amount,
            variance_amount=Decimal("0.00"),
            variance_percentage=Decimal("0.00"),
            award_date=date.today() - timedelta(days=70),
            start_date=date.today() - timedelta(days=65),
            completion_date=date.today() + timedelta(days=300),
            status="AWARDED",
            remarks="Contractor appointed under item-rate tender."
        )
        db.add(award)
        db.commit()
        print("  Added Contractor Award for Riverside")

    # Work Order
    if award:
        wo = db.query(WorkOrder).filter(WorkOrder.project_id == p_id).first()
        if not wo:
            wo = WorkOrder(
                work_order_number="WO-2026-RIV-001",
                award_id=award.id,
                project_id=p_id,
                contractor_id=vendor.id,
                issue_date=date.today() - timedelta(days=65),
                scope_of_work="Civil and Foundation Works for Riverside Commercial Complex",
                description="Riverfront retaining wall, deep foundation piling and lower concourse.",
                work_order_value=award.award_amount,
                start_date=date.today() - timedelta(days=60),
                completion_date=date.today() + timedelta(days=300),
                status="ACTIVE",
                created_by_id=1
            )
            db.add(wo)
            db.commit()
            print("  Added Work Order for Riverside")

    # Work Plan & BOQ Mapping
    wp = db.query(WorkPlan).filter(WorkPlan.project_id == p_id).first()
    first_wbs = db.query(WbsTask).filter(WbsTask.project_id == p_id, WbsTask.task_level == "Task").first()
    first_boq = db.query(BoqItem).filter(BoqItem.project_id == p_id).first()
    if not wp and first_wbs:
        wp = WorkPlan(
            work_plan_number="WP-RIV-01",
            project_id=p_id,
            wbs_phase_id=first_wbs.id,
            task_id=first_wbs.id,
            activity_name="Riverfront Retaining Wall & Foundation",
            description="Deep sheet piling and reinforced foundation slab",
            planned_quantity=Decimal("1200.00"),
            unit="m³",
            planned_start_date=date.today() - timedelta(days=60),
            planned_end_date=date.today() + timedelta(days=120),
            priority="HIGH",
            status="IN_PROGRESS",
            created_by_id=1
        )
        db.add(wp)
        db.commit()
        print("  Added Work Plan for Riverside")

    if wp and first_boq:
        mapping = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.project_id == p_id).first()
        if not mapping:
            mapping = WorkPlanBoqMapping(
                work_plan_id=wp.id,
                boq_item_id=first_boq.id,
                project_id=p_id,
                mapped_quantity=first_boq.approved_qty,
                unit=first_boq.unit or "m³",
                created_by_id=1
            )
            db.add(mapping)
            db.commit()
            print("  Added BOQ Mapping for Riverside")

    # Team Members
    team_configs = [
        (4, "Project Manager", "Lead Project Manager"),
        (26, "EE", "Executive Engineer"),
        (25, "AE", "Assistant Engineer"),
        (5, "JE", "Junior Engineer"),
        (29, "Contractor PM", "Contractor Representative"),
    ]
    for uid, role, resp in team_configs:
        existing_tm = db.query(ProjectTeamMember).filter(
            ProjectTeamMember.project_id == p_id,
            ProjectTeamMember.user_id == uid
        ).first()
        if not existing_tm:
            tm = ProjectTeamMember(
                project_id=p_id,
                user_id=uid,
                project_role=role,
                department="Civil Engineering",
                responsibility=resp,
                joining_date=date.today() - timedelta(days=60),
                status="ACTIVE",
                is_active=True,
                created_by_id=1,
                effective_from=date.today() - timedelta(days=60)
            )
            db.add(tm)
        else:
            existing_tm.is_active = True
            existing_tm.status = "ACTIVE"
    db.commit()

    # Tasks
    if first_wbs:
        task_assign = db.query(TaskAssignment).filter(TaskAssignment.project_id == p_id).first()
        if not task_assign:
            task_assign = TaskAssignment(
                assignment_ref="TSK-RIV-001",
                project_id=p_id,
                wbs_phase_id=first_wbs.id,
                task_id=first_wbs.id,
                assigned_user_id=4,
                role="Senior Project Manager",
                priority="HIGH",
                start_date=date.today() - timedelta(days=50),
                due_date=date.today() + timedelta(days=50),
                status="IN_PROGRESS",
                remarks="Manage riverfront geotechnical safety protocols.",
                created_by_id=1
            )
            db.add(task_assign)
            db.commit()
            print("  Added Task Assignment for Riverside")

    # Milestones
    ms_count = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == p_id).count()
    if ms_count == 0 and first_wbs:
        for name, dt, status in [
            ("Riverfront Sheet Piling & Cofferdam Sealing", date.today() - timedelta(days=20), "Met"),
            ("Basement Retaining Wall Concrete Pour", date.today() + timedelta(days=35), "Pending"),
            ("Podium Level Commercial Deck Casting", date.today() + timedelta(days=110), "Pending"),
        ]:
            ms = ProjectMilestone(
                project_id=p_id,
                wbs_node_id=first_wbs.id,
                milestone_name=name,
                is_date_based=True,
                is_quantity_based=False,
                target_date=dt,
                status=status,
                created_by_id=1
            )
            db.add(ms)
        db.commit()
        print("  Added Milestones for Riverside")

    # Hindrance
    hind_count = db.query(Hindrance).filter(Hindrance.project_id == p_id).count()
    if hind_count == 0 and first_wbs:
        hindrance = Hindrance(
            project_id=p_id,
            wbs_node_id=first_wbs.id,
            hindrance_type="Environmental Clearance Delay",
            date_occurred=date.today() - timedelta(days=35),
            delay_start_date=date.today() - timedelta(days=35),
            delay_end_date=date.today() - timedelta(days=20),
            description="State River Basin Authority ecological sediment test report awaited.",
            raised_by_id=4,
            raised_at=datetime.utcnow() - timedelta(days=35),
            current_status="Decided",
            ee_id=1,
            ee_decision="Accepted",
            ee_remarks="15 days time extension authorized.",
            decided_at=datetime.utcnow() - timedelta(days=18),
            sla_due_at=datetime.utcnow() - timedelta(days=32)
        )
        db.add(hindrance)
        db.commit()
        print("  Added Hindrance for Riverside")

    print("=== Riverside Chain Complete ===")

def step6_verify():
    print("\n=== Step 6: Verification & Data Summary ===")
    db = SessionLocal()
    try:
        active_projects = db.query(Project).filter(Project.is_active == True).all()
        print(f"Active Projects in DB: {len(active_projects)}")
        for p in active_projects:
            pid = p.id
            boq_c = db.query(BoqItem).filter(BoqItem.project_id == pid).count()
            est_c = db.query(ProjectEstimate).filter(ProjectEstimate.project_id == pid).count()
            ts_c = db.query(TechnicalSanction).filter(TechnicalSanction.project_id == pid).count()
            awd_c = db.query(ContractorAward).filter(ContractorAward.project_id == pid).count()
            wo_c = db.query(WorkOrder).filter(WorkOrder.project_id == pid).count()
            wp_c = db.query(WorkPlan).filter(WorkPlan.project_id == pid).count()
            wbs_c = db.query(WbsTask).filter(WbsTask.project_id == pid).count()
            map_c = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.project_id == pid).count()
            tm_c = db.query(ProjectTeamMember).filter(ProjectTeamMember.project_id == pid).count()
            tsk_c = db.query(TaskAssignment).filter(TaskAssignment.project_id == pid).count()
            ms_c = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == pid).count()
            log_c = db.query(SiteDailyLog).filter(SiteDailyLog.project_id == pid).count()
            mb_c = db.query(MeasurementBook).filter(MeasurementBook.project_id == pid).count()
            hind_c = db.query(Hindrance).filter(Hindrance.project_id == pid).count()

            print(f"ID {p.id:2d} | Code: {p.code:15s} | Status: {p.status:8s} | Name: {p.name}")
            print(f"   BOQ:{boq_c} | Est:{est_c} | TS:{ts_c} | Award:{awd_c} | WO:{wo_c} | WP:{wp_c} | WBS:{wbs_c}")
            print(f"   Map:{map_c} | Team:{tm_c} | Tasks:{tsk_c} | MS:{ms_c} | Logs:{log_c} | eMB:{mb_c} | Hind:{hind_c}")
            print("-" * 80)
    finally:
        db.close()

def main():
    step1_ensure_columns()
    db = SessionLocal()
    try:
        from app.seed_demo_projects import ensure_demo_projects_and_data
        ensure_demo_projects_and_data(db)
    finally:
        db.close()
    step6_verify()

if __name__ == "__main__":
    main()
