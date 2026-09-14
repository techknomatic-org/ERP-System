"""
Demo Projects and End-to-End Enterprise Data Auto-Seed Service.
Ensures that regardless of deployment environment (local, container, remote VM 139.59.29.162),
the EXACT SAME 4 canonical active demo projects and their full downstream data chains
are automatically seeded, linked, and active.
"""

from datetime import datetime, date, timedelta
from decimal import Decimal
from passlib.context import CryptContext
from app.models import (
    User, Vendor, Division, TenantSetting, Project, WbsTask, BoqItem,
    ProjectEstimate, ProjectEstimateLine, TechnicalSanction, ContractorAward,
    WorkOrder, WorkPlan, WorkPlanBoqMapping, ProjectTeamMember, ProjectTeamAudit,
    TaskAssignment, ProjectMilestone, SiteDailyLog, MeasurementBook,
    Hindrance, ContractorBill, SorEdition, SorRegion, ScheduleOfRates,
    TestCheckAssignment
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

CANONICAL_PROJECT_CODES = [
    "PRJ-PRV01-A",       # Metro Tower Construction Phase 1
    "PROJ-GREENFIELD",   # Greenfield Data Center Park
    "PROJ-RIVERSIDE",    # Riverside Commercial Complex – Phase 1
    "PRJ-PRV01-B",       # Heritage Plaza Restoration
]

def resolve_or_create_demo_users(db):
    """Ensure all critical personas exist with valid user IDs for foreign key constraints."""
    user_specs = [
        ("admin", "admin@erp.local", "System Administrator", "admin", "admin123"),
        ("pm", "pm@erp.local", "Lead Project Manager", "project_manager", "pm123"),
        ("site", "site@erp.local", "Site Engineer / JE", "site_engineer", "site123"),
        ("engineer", "engineer@erp.local", "Lead Civil Engineer", "site_engineer", "engineer123"),
        ("ee_officer", "ee@erp.local", "Executive Engineer (EE)", "admin", "ee123"),
        ("ae_officer", "ae@erp.local", "Assistant Engineer (AE)", "site_engineer", "ae123"),
        ("contractor_rep", "contractor@apexstructural.com", "Contractor Representative", "customer", "contractor123"),
        ("finance", "finance@erp.local", "Finance Lead", "finance", "finance123"),
        ("procurement", "procurement@erp.local", "Procurement Officer", "procurement", "procurement123"),
    ]

    resolved = {}
    for uname, uemail, ufull, urole, upass in user_specs:
        user = db.query(User).filter((User.username == uname) | (User.email == uemail)).first()
        if not user:
            user = User(
                username=uname,
                email=uemail,
                full_name=ufull,
                hashed_password=pwd_context.hash(upass),
                role=urole,
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        resolved[uname] = user

    return resolved

def resolve_or_create_vendors(db):
    """Ensure standard contractors/vendors exist."""
    v1 = db.query(Vendor).filter((Vendor.code == "VND-APX") | (Vendor.name.like("%Apex Structural%"))).first()
    if not v1:
        v1 = Vendor(code="VND-APX", name="Apex Structural Concrete Corp", email="contact@apexstructural.com", phone="+91 98765 00001", status="active")
        db.add(v1)

    v2 = db.query(Vendor).filter((Vendor.code == "VND-TITAN") | (Vendor.name.like("%Titan Structural%"))).first()
    if not v2:
        v2 = Vendor(code="VND-TITAN", name="Titan Infrastructure & Steel", email="contracts@titaninfra.com", phone="+91 98765 00002", status="active")
        db.add(v2)

    db.commit()
    if v1: db.refresh(v1)
    if v2: db.refresh(v2)
    return {"apex": v1, "titan": v2 or v1}

def resolve_or_create_sor(db):
    """Ensure SOR Edition & Regions exist."""
    edition = db.query(SorEdition).filter(SorEdition.name == "DSR 2023").first()
    if not edition:
        edition = SorEdition(name="DSR 2023", description="Delhi Schedule of Rates 2023", status="Active", effective_date=datetime(2023, 4, 1))
        db.add(edition)

    region = db.query(SorRegion).filter(SorRegion.code == "DL").first()
    if not region:
        region = SorRegion(code="DL", name="Delhi", status="Active")
        db.add(region)

    db.commit()
    if edition: db.refresh(edition)
    if region: db.refresh(region)
    return edition, region

def ensure_wbs_hierarchy(db, project_id, project_name):
    """Ensure a robust 3-tier WBS hierarchy exists for the project."""
    existing_wbs = db.query(WbsTask).filter(WbsTask.project_id == project_id).all()
    if len(existing_wbs) >= 3:
        phase = next((t for t in existing_wbs if t.task_level == "Phase"), existing_wbs[0])
        task = next((t for t in existing_wbs if t.task_level == "Task"), existing_wbs[min(1, len(existing_wbs)-1)])
        return phase, task

    # Create standard hierarchy
    p1 = WbsTask(
        project_id=project_id,
        wbs_code="1.0",
        title="Substructure & Foundation",
        task_level="Phase",
        planned_budget=Decimal("3500000.00"),
        start_date=date.today() - timedelta(days=90),
        end_date=date.today() + timedelta(days=60),
        status="IN_PROGRESS"
    )
    db.add(p1)
    db.commit()
    db.refresh(p1)

    t1 = WbsTask(
        project_id=project_id,
        parent_task_id=p1.id,
        wbs_code="1.1",
        title="Deep Foundation & Earthwork Excavation",
        task_level="Task",
        planned_budget=Decimal("1500000.00"),
        start_date=date.today() - timedelta(days=90),
        end_date=date.today() - timedelta(days=30),
        status="COMPLETED"
    )
    t2 = WbsTask(
        project_id=project_id,
        parent_task_id=p1.id,
        wbs_code="1.2",
        title="RCC Column Footing & Raft Casting",
        task_level="Task",
        planned_budget=Decimal("2000000.00"),
        start_date=date.today() - timedelta(days=30),
        end_date=date.today() + timedelta(days=60),
        status="IN_PROGRESS"
    )
    p2 = WbsTask(
        project_id=project_id,
        wbs_code="2.0",
        title="Superstructure & MEP Works",
        task_level="Phase",
        planned_budget=Decimal("6500000.00"),
        start_date=date.today() + timedelta(days=61),
        end_date=date.today() + timedelta(days=300),
        status="NOT_STARTED"
    )
    db.add_all([t1, t2, p2])
    db.commit()
    db.refresh(t2)
    return p1, t2

def ensure_demo_projects_and_data(db):
    """
    Master self-healing, idempotent method called on server startup.
    1. Resolves all required users and contractors.
    2. Archives any project not in CANONICAL_PROJECT_CODES.
    3. Populates or activates all 4 canonical projects with complete end-to-end chains.
    """
    print("[Seed] Verifying 4 canonical demo projects and end-to-end connectivity...")
    users = resolve_or_create_demo_users(db)
    vendors = resolve_or_create_vendors(db)
    edition, region = resolve_or_create_sor(db)

    admin = users["admin"]
    pm = users["pm"]
    site = users["site"]
    ee = users.get("ee_officer", admin)
    ae = users.get("ae_officer", site)
    contractor_rep = users.get("contractor_rep", admin)
    vendor_apex = vendors["apex"]

    # 1. Archive non-canonical projects so they don't clutter the Project Register
    db.query(Project).filter(~Project.code.in_(CANONICAL_PROJECT_CODES)).update(
        {Project.is_active: False, Project.status: "ARCHIVED"},
        synchronize_session=False
    )
    db.commit()

    # 2. Canonical Project Definitions
    project_defs = [
        {
            "code": "PRJ-PRV01-A",
            "name": "Metro Tower Construction Phase 1",
            "location": "Cyber City Sector 62, Gurugram",
            "budget": Decimal("85000000.00"),
            "actual_cost": Decimal("1200000.00"),
            "progress_pct": Decimal("32.50"),
            "contract_type": "Item Rate",
            "funding_mode": "Budgeted",
            "boqs": [
                ("RCC Column Concrete M35 Grade", "m³", Decimal("500.00"), Decimal("8000.00")),
                ("Earthwork Excavation in Ordinary Rock / Soil", "m³", Decimal("2500.00"), Decimal("450.00")),
                ("TMT Fe500D High Strength Reinforcement Steel", "tonnes", Decimal("120.00"), Decimal("68000.00")),
                ("AAC Lightweight Block Masonry 200mm Thick", "m³", Decimal("850.00"), Decimal("4200.00")),
                ("Internal Cement Plastering 1:4 Mix 12mm", "m²", Decimal("4500.00"), Decimal("280.00")),
            ],
            "estimate_num": "EST-PRV01-001",
            "ts_ref": "TS/SE/2026/089",
            "award_ref": "AWD-2026-METRO-01",
            "wo_num": "WO-2026-METRO-001",
            "wp_num": "WP-METRO-01",
            "task_ref": "TSK-METRO-001",
            "milestones": [
                ("Substructure Excavation & Soil Prep", date.today() - timedelta(days=25), "Met"),
                ("Plinth Level Column Casting (500 m³)", date.today() + timedelta(days=20), "Pending"),
                ("Floor 1-5 Structural Slab Casting", date.today() + timedelta(days=90), "Pending"),
            ],
            "hindrance_type": "Utility Shift Delay",
            "hindrance_desc": "Municipal corporation main water pipeline relocation clearance delayed along north boundary."
        },
        {
            "code": "PROJ-GREENFIELD",
            "name": "Greenfield Data Center Park",
            "location": "Tech Corridor Zone 4, Bengaluru",
            "budget": Decimal("120000000.00"),
            "actual_cost": Decimal("1250000.00"),
            "progress_pct": Decimal("45.00"),
            "contract_type": "Item Rate",
            "funding_mode": "Budgeted",
            "boqs": [
                ("High Density Ready Mix Concrete M40 Grade", "m³", Decimal("1200.00"), Decimal("8500.00")),
                ("Heavy Structural Steel Rebar Fe550D", "tonnes", Decimal("250.00"), Decimal("72000.00")),
                ("Anti-Static Epoxy Flooring System", "m²", Decimal("3500.00"), Decimal("1450.00")),
                ("Precision Substation Base Foundation", "m³", Decimal("400.00"), Decimal("9200.00")),
            ],
            "estimate_num": "EST-2026-GDC-01",
            "ts_ref": "TS/SE/2026/GDC-01",
            "award_ref": "AWD-2026-GREENFIELD-01",
            "wo_num": "WO-2026-GDC-001",
            "wp_num": "WP-GDC-01",
            "task_ref": "TSK-GDC-001",
            "milestones": [
                ("Data Center Shell & Core Structural Handover", date.today() - timedelta(days=30), "Met"),
                ("Dual 66kV Primary Substation Power Energization", date.today() + timedelta(days=45), "Pending"),
                ("Tier IV Chilled Water Loop Hydrostatic Testing", date.today() + timedelta(days=90), "Pending"),
            ],
            "hindrance_type": "Equipment Delivery Delay",
            "hindrance_desc": "Custom 2500kVA generator transit delayed at regional border checkpost."
        },
        {
            "code": "PROJ-RIVERSIDE",
            "name": "Riverside Commercial Complex – Phase 1",
            "location": "Riverfront Boulevard, Sector 4, Ahmedabad",
            "budget": Decimal("65000000.00"),
            "actual_cost": Decimal("1250000.00"),
            "progress_pct": Decimal("28.00"),
            "contract_type": "Item Rate",
            "funding_mode": "Budgeted",
            "boqs": [
                ("Riverfront Diaphragm Retaining Wall RCC M35", "m³", Decimal("1200.00"), Decimal("9500.00")),
                ("Bored Cast-in-Situ Concrete Piles 800mm Dia", "m", Decimal("1800.00"), Decimal("4200.00")),
                ("Waterproof Substructure Raft Concrete", "m³", Decimal("900.00"), Decimal("8200.00")),
            ],
            "estimate_num": "EST-2026-RIV-01",
            "ts_ref": "TS/SE/2026/RIV-01",
            "award_ref": "AWD-2026-RIVERSIDE-01",
            "wo_num": "WO-2026-RIV-001",
            "wp_num": "WP-RIV-01",
            "task_ref": "TSK-RIV-001",
            "milestones": [
                ("Riverfront Sheet Piling & Cofferdam Sealing", date.today() - timedelta(days=20), "Met"),
                ("Basement Retaining Wall Concrete Pour", date.today() + timedelta(days=35), "Pending"),
                ("Podium Level Commercial Deck Casting", date.today() + timedelta(days=110), "Pending"),
            ],
            "hindrance_type": "Environmental Clearance Delay",
            "hindrance_desc": "State River Basin Authority ecological sediment test report awaited."
        },
        {
            "code": "PRJ-PRV01-B",
            "name": "Heritage Plaza Restoration",
            "location": "Old Fort Heritage Zone, Jaipur",
            "budget": Decimal("18500000.00"),
            "actual_cost": Decimal("2950000.00"),
            "progress_pct": Decimal("12.00"),
            "contract_type": "Item Rate",
            "funding_mode": "Budgeted",
            "boqs": [
                ("Lime Surkhi Heritage Mortar Pointing", "m²", Decimal("1200.00"), Decimal("850.00")),
                ("Carved Red Sandstone Arch Masonry & Conservation", "m³", Decimal("150.00"), Decimal("38000.00")),
                ("Traditional Timber Roof Truss Strengthening", "units", Decimal("24.00"), Decimal("45000.00")),
            ],
            "estimate_num": "EST-PRV01-002",
            "ts_ref": "TS/SE/2026/HP-01",
            "award_ref": "AWD-2026-HERITAGE-01",
            "wo_num": "WO-2026-HP-001",
            "wp_num": "WP-HP-01",
            "task_ref": "TSK-HP-001",
            "milestones": [
                ("Structural Heritage Facade Stabilisation", date.today() - timedelta(days=15), "Met"),
                ("Sandstone Carving Arch Restoration Phase 1", date.today() + timedelta(days=45), "Pending"),
                ("Heritage Lighting and Final Courtyard Handover", date.today() + timedelta(days=120), "Pending"),
            ],
            "hindrance_type": "Archaeological Permit Delay",
            "hindrance_desc": "Archaeological Survey approval required for heritage sandstone quarry sourcing."
        }
    ]

    for p_spec in project_defs:
        code = p_spec["code"]
        project = db.query(Project).filter(Project.code == code).first()
        if not project:
            project = Project(
                code=code,
                name=p_spec["name"],
                location=p_spec["location"],
                budget=p_spec["budget"],
                actual_cost=p_spec["actual_cost"],
                progress_pct=p_spec["progress_pct"],
                currency="INR",
                status="ACTIVE",
                is_active=True,
                contract_type=p_spec["contract_type"],
                funding_mode=p_spec["funding_mode"],
                start_date=datetime.utcnow() - timedelta(days=60),
                end_date=datetime.utcnow() + timedelta(days=300),
                contract_duration_days=360,
                sor_edition_id=edition.id if edition else None,
                sor_edition_name=edition.name if edition else "DSR 2023",
                sor_region_id=region.id if region else None,
                sor_region_name=region.name if region else "Delhi",
                tenant_name="Default Tenant"
            )
            db.add(project)
            db.commit()
            db.refresh(project)
            print(f"  [+] Created project: {project.name} ({project.code}, ID={project.id})")
        else:
            project.name = p_spec["name"]
            project.location = p_spec["location"]
            project.budget = p_spec["budget"]
            project.status = "ACTIVE"
            project.is_active = True
            project.currency = "INR"
            db.commit()

        pid = project.id

        # 3. WBS Structure
        wbs_phase, wbs_task = ensure_wbs_hierarchy(db, pid, project.name)

        # 4. Master BOQ Items
        existing_boqs = db.query(BoqItem).filter(BoqItem.project_id == pid).all()
        created_boqs = list(existing_boqs)
        existing_names = {b.item_name for b in existing_boqs}

        for name, unit, qty, rate in p_spec["boqs"]:
            if name not in existing_names:
                b = BoqItem(
                    project_id=pid,
                    phase_id=wbs_phase.id if wbs_phase else None,
                    task_id=wbs_task.id if wbs_task else None,
                    item_name=name,
                    unit=unit,
                    approved_qty=qty,
                    rate=rate,
                    total_amount=qty * rate,
                    vendor_id=vendor_apex.id,
                    contractor_name=vendor_apex.name,
                    status="ACTIVE"
                )
                db.add(b)
                db.commit()
                created_boqs.append(b)
                existing_names.add(name)

        first_boq = created_boqs[0] if created_boqs else None

        # 5. Detailed Estimate
        estimate = db.query(ProjectEstimate).filter(ProjectEstimate.project_id == pid).first()
        est_total = sum([float(b.total_amount or (b.approved_qty * b.rate)) for b in created_boqs])
        if est_total == 0:
            est_total = float(project.budget) * 0.95

        if not estimate:
            estimate = ProjectEstimate(
                project_id=pid,
                estimate_number=p_spec["estimate_num"],
                revision_number=0,
                base_amount=Decimal(str(est_total)),
                contingency_percent=Decimal("3.00"),
                contingency_amount=Decimal(str(round(est_total * 0.03, 2))),
                departmental_charges_percent=Decimal("2.00"),
                departmental_charges_amount=Decimal(str(round(est_total * 0.02, 2))),
                total_amount=Decimal(str(round(est_total * 1.05, 2))),
                status="APPROVED",
                ts_status="APPROVED",
                is_ts_locked=True
            )
            db.add(estimate)
            db.commit()
            db.refresh(estimate)
        else:
            estimate.status = "APPROVED"
            estimate.ts_status = "APPROVED"
            estimate.is_ts_locked = True
            estimate.base_amount = Decimal(str(est_total))
            estimate.total_amount = Decimal(str(round(est_total * 1.05, 2)))
            db.commit()

        # 6. Technical Sanction
        ts = db.query(TechnicalSanction).filter(TechnicalSanction.project_id == pid).first()
        if not ts:
            ts = TechnicalSanction(
                project_id=pid,
                detailed_estimate_id=estimate.id,
                sanction_reference_number=p_spec["ts_ref"],
                sanction_date=date.today() - timedelta(days=60),
                remarks="Technically sanctioned in compliance with CPWD specifications.",
                status="APPROVED",
                submitted_by_id=pm.id,
                approved_by_id=ee.id,
                approved_at=datetime.utcnow() - timedelta(days=58),
                estimate_total_at_submission=estimate.total_amount
            )
            db.add(ts)
            db.commit()

        # 7. Contractor Award
        award = db.query(ContractorAward).filter(ContractorAward.project_id == pid).first()
        if not award:
            awd_amt = Decimal(str(round(float(estimate.total_amount) * 0.98, 2)))
            award = ContractorAward(
                award_reference=p_spec["award_ref"],
                project_id=pid,
                estimate_id=estimate.id,
                contractor_id=vendor_apex.id,
                estimated_amount=estimate.total_amount,
                award_amount=awd_amt,
                variance_amount=awd_amt - estimate.total_amount,
                variance_percentage=Decimal("-2.00"),
                award_date=date.today() - timedelta(days=50),
                start_date=date.today() - timedelta(days=45),
                completion_date=date.today() + timedelta(days=320),
                status="AWARDED",
                remarks="Lowest evaluated responsive bidder after competitive tendering."
            )
            db.add(award)
            db.commit()
            db.refresh(award)

        # 8. Work Order
        wo = db.query(WorkOrder).filter(WorkOrder.project_id == pid).first()
        if not wo:
            wo = WorkOrder(
                work_order_number=p_spec["wo_num"],
                award_id=award.id,
                project_id=pid,
                contractor_id=vendor_apex.id,
                issue_date=date.today() - timedelta(days=45),
                scope_of_work=f"Complete civil, structural, and execution scope for {project.name}",
                description="Comprehensive substructure and superstructure execution as per approved schedule.",
                work_order_value=award.award_amount,
                start_date=date.today() - timedelta(days=40),
                completion_date=date.today() + timedelta(days=320),
                payment_terms="Milestone-based billing against verified digital e-MB with 10% retention.",
                status="ACTIVE",
                created_by_id=admin.id
            )
            db.add(wo)
            db.commit()

        # 9. Work Plan & BOQ Mapping
        wp = db.query(WorkPlan).filter(WorkPlan.project_id == pid).first()
        if not wp and wbs_task:
            wp = WorkPlan(
                work_plan_number=p_spec["wp_num"],
                project_id=pid,
                wbs_phase_id=wbs_phase.id if wbs_phase else wbs_task.id,
                task_id=wbs_task.id,
                activity_name=f"{wbs_task.title} Execution",
                description="Execution as per technical drawings and milestone plan.",
                planned_quantity=Decimal("500.00"),
                unit="m³",
                planned_start_date=date.today() - timedelta(days=40),
                planned_end_date=date.today() + timedelta(days=60),
                priority="HIGH",
                status="IN_PROGRESS",
                created_by_id=admin.id
            )
            db.add(wp)
            db.commit()
            db.refresh(wp)

        if wp and first_boq:
            mapping = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.project_id == pid).first()
            if not mapping:
                mapping = WorkPlanBoqMapping(
                    work_plan_id=wp.id,
                    boq_item_id=first_boq.id,
                    project_id=pid,
                    mapped_quantity=Decimal("500.00"),
                    unit=first_boq.unit or "m³",
                    created_by_id=admin.id
                )
                db.add(mapping)
                db.commit()

        # 10. Project Team Members
        team_specs = [
            (pm, "Project Manager", "Senior Project Manager"),
            (ee, "EE", "Executive Engineer"),
            (ae, "AE", "Assistant Engineer"),
            (site, "JE", "Junior Engineer"),
            (contractor_rep, "Contractor PM", "Contractor Representative"),
        ]
        for u_obj, role, resp in team_specs:
            existing_tm = db.query(ProjectTeamMember).filter(
                ProjectTeamMember.project_id == pid,
                ProjectTeamMember.user_id == u_obj.id
            ).first()
            if not existing_tm:
                tm = ProjectTeamMember(
                    project_id=pid,
                    user_id=u_obj.id,
                    project_role=role,
                    department="Civil Engineering",
                    responsibility=resp,
                    joining_date=date.today() - timedelta(days=60),
                    status="ACTIVE",
                    is_active=True,
                    created_by_id=admin.id,
                    effective_from=date.today() - timedelta(days=60)
                )
                db.add(tm)
            else:
                existing_tm.is_active = True
                existing_tm.status = "ACTIVE"
        db.commit()

        # 11. Task Assignment
        if wbs_task:
            task_assign = db.query(TaskAssignment).filter(TaskAssignment.project_id == pid).first()
            if not task_assign:
                task_assign = TaskAssignment(
                    assignment_ref=p_spec["task_ref"],
                    project_id=pid,
                    wbs_phase_id=wbs_phase.id if wbs_phase else wbs_task.id,
                    task_id=wbs_task.id,
                    assigned_user_id=site.id,
                    role="Site Engineer",
                    priority="HIGH",
                    start_date=date.today() - timedelta(days=30),
                    due_date=date.today() + timedelta(days=30),
                    status="IN_PROGRESS",
                    remarks="Supervise execution, quality compliance, and daily log documentation.",
                    created_by_id=admin.id
                )
                db.add(task_assign)
                db.commit()

        # 12. Milestones
        existing_ms = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == pid).all()
        existing_ms_names = {m.milestone_name for m in existing_ms}
        for name, dt, status in p_spec["milestones"]:
            if name not in existing_ms_names and wbs_task:
                ms = ProjectMilestone(
                    project_id=pid,
                    wbs_node_id=wbs_task.id,
                    milestone_name=name,
                    is_date_based=True,
                    is_quantity_based=False,
                    target_date=dt,
                    status=status,
                    created_by_id=admin.id
                )
                db.add(ms)
        db.commit()

        # 13. Daily Site Logs
        logs_count = db.query(SiteDailyLog).filter(SiteDailyLog.project_id == pid).count()
        if logs_count == 0 and first_boq:
            for day_offset, progress_txt, qty in [
                (5, "Substructure reinforcement binding grid completion", Decimal("25.00")),
                (4, "Concreted 4 columns in basement sector 2", Decimal("30.00")),
                (2, "Concreted 6 foundation columns with M35 mix", Decimal("40.00")),
                (1, "Formwork stripping and 7-day curing verified", Decimal("15.00")),
            ]:
                log = SiteDailyLog(
                    project_id=pid,
                    engineer_id=site.id,
                    log_date=datetime.utcnow() - timedelta(days=day_offset),
                    physical_progress=progress_txt,
                    labour_count=35,
                    materials_consumed="M35 Concrete, Fe500D Rebar, Curing compound",
                    equipment_used="Concrete Transit Mixer, Tower Crane, Needle Vibrators",
                    approval_status="approved",
                    boq_item_id=first_boq.id,
                    executed_qty=qty
                )
                db.add(log)
            db.commit()

        # 14. Measurement Book (e-MB)
        emb_count = db.query(MeasurementBook).filter(MeasurementBook.project_id == pid).count()
        if emb_count == 0 and first_boq:
            for offset, qty, remarks in [
                (4, Decimal("30.00"), "Basement grid columns 1-4 measured and verified."),
                (2, Decimal("40.00"), "Foundation columns grid C 1-6 measured."),
            ]:
                mb_entry = MeasurementBook(
                    project_id=pid,
                    boq_item_id=first_boq.id,
                    engineer_id=site.id,
                    log_date=datetime.utcnow() - timedelta(days=offset),
                    location_zone="Basement Level 1 - Grid B/C",
                    measured_qty=qty,
                    remarks=remarks,
                    unit=first_boq.unit or "m³",
                    status="APPROVED",
                    description=f"Execution of {first_boq.item_name}",
                    measurement_method="Standard Geometric Measurement",
                    length=Decimal("4.00"),
                    breadth=Decimal("2.50"),
                    height=Decimal("3.00"),
                    computed_quantity=qty,
                    created_by_id=site.id,
                    contractor_rep_signer_id=contractor_rep.id,
                    contractor_rep_signed_at=datetime.utcnow() - timedelta(days=offset),
                    je_signer_id=site.id,
                    je_signed_at=datetime.utcnow() - timedelta(days=offset)
                )
                db.add(mb_entry)
            db.commit()

        # 15. Hindrance
        hind_count = db.query(Hindrance).filter(Hindrance.project_id == pid).count()
        if hind_count == 0 and wbs_task:
            hindrance = Hindrance(
                project_id=pid,
                wbs_node_id=wbs_task.id,
                hindrance_type=p_spec["hindrance_type"],
                date_occurred=date.today() - timedelta(days=20),
                delay_start_date=date.today() - timedelta(days=20),
                delay_end_date=date.today() - timedelta(days=10),
                description=p_spec["hindrance_desc"],
                raised_by_id=site.id,
                raised_at=datetime.utcnow() - timedelta(days=20),
                current_status="Decided",
                ee_id=ee.id,
                ee_decision="Accepted",
                ee_remarks="10 days extension of time recommended without liquidated damages.",
                decided_at=datetime.utcnow() - timedelta(days=9),
                sla_due_at=datetime.utcnow() - timedelta(days=15)
            )
            db.add(hindrance)
            db.commit()

        # 16. Test Check Assignment
        first_mb = db.query(MeasurementBook).filter(MeasurementBook.project_id == pid).first()
        if first_mb:
            tc = db.query(TestCheckAssignment).filter(TestCheckAssignment.measurement_book_id == first_mb.id).first()
            if not tc:
                tc = TestCheckAssignment(
                    measurement_book_id=first_mb.id,
                    project_id=pid,
                    authority="AE",
                    sampling_percentage=Decimal("50.00"),
                    risk_score=Decimal("15.00"),
                    sampling_reason="Routine statutory sampling for high-value RCC item",
                    status="COMPLETED",
                    reviewer_id=ae.id,
                    reviewer_remarks="Measurements cross-checked on site and found within acceptable geometric tolerances.",
                    selected_at=datetime.utcnow() - timedelta(days=3),
                    reviewed_at=datetime.utcnow() - timedelta(days=2)
                )
                db.add(tc)
                db.commit()

        # 17. Contractor Bill
        bill_count = db.query(ContractorBill).filter(ContractorBill.project_id == pid).count()
        if bill_count == 0 and first_boq:
            b_qty = Decimal("40.00")
            b_rate = first_boq.rate or Decimal("8000.00")
            bill = ContractorBill(
                bill_number=f"BILL-{p_spec['code']}-001",
                project_id=pid,
                vendor_id=vendor_apex.id,
                boq_item_id=first_boq.id,
                billed_qty=b_qty,
                billed_rate=b_rate,
                total_billed_amount=b_qty * b_rate,
                mb_qty=b_qty,
                boq_qty=first_boq.approved_qty,
                discrepancy_flag=False,
                discrepancy_reason=None,
                status="APPROVED",
                snapshot_timestamp=datetime.utcnow() - timedelta(days=5)
            )
            db.add(bill)
            db.commit()

    print("[Seed] 4 canonical demo projects and downstream chains verified successfully.")
