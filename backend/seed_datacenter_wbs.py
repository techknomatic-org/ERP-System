import sys
import os
from datetime import datetime

# Add app to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import Project, WbsTask, BoqItem, SiteDailyLog

DATA_CENTER_WBS = [
    # 1.0
    {
        "code": "1.0", "title": "1.0 PROJECT MANAGEMENT & PRE-CONSTRUCTION", "level": "Phase",
        "start": "2026-10-01", "end": "2027-03-31",
        "children": [
            {
                "code": "1.1", "title": "1.1 Project Management", "level": "Task",
                "start": "2026-10-01", "end": "2027-03-31",
                "children": [
                    {"code": "1.1.1", "title": "1.1.1 Master Schedule Development (CPM)", "level": "Subtask", "start": "2026-10-01", "end": "2026-10-31"},
                    {"code": "1.1.2", "title": "1.1.2 Budgeting and Cost Control", "level": "Subtask", "start": "2026-10-01", "end": "2027-03-31"},
                    {"code": "1.1.3", "title": "1.1.3 Stakeholder Management & Governance", "level": "Subtask", "start": "2026-10-01", "end": "2027-03-31"},
                ]
            },
            {
                "code": "1.2", "title": "1.2 Permitting & Approvals", "level": "Task",
                "start": "2026-10-15", "end": "2027-02-28",
                "children": [
                    {"code": "1.2.1", "title": "1.2.1 Zoning and Land Use Variances", "level": "Subtask", "start": "2026-10-15", "end": "2026-12-31"},
                    {"code": "1.2.2", "title": "1.2.2 Environmental Impact Studies (EIS)", "level": "Subtask", "start": "2026-11-01", "end": "2027-01-31"},
                    {"code": "1.2.3", "title": "1.2.3 Building and Utility Interconnect Permits", "level": "Subtask", "start": "2026-12-01", "end": "2027-02-28"},
                ]
            },
            {
                "code": "1.3", "title": "1.3 Site Preparation", "level": "Task",
                "start": "2027-01-02", "end": "2027-03-31",
                "children": [
                    {"code": "1.3.1", "title": "1.3.1 Land Surveying & Topography", "level": "Subtask", "start": "2027-01-02", "end": "2027-01-20"},
                    {"code": "1.3.2", "title": "1.3.2 Geotechnical Investigation", "level": "Subtask", "start": "2027-01-15", "end": "2027-02-15"},
                    {"code": "1.3.3", "title": "1.3.3 Site Demolition & Environmental Remediation", "level": "Subtask", "start": "2027-02-01", "end": "2027-03-31"},
                ]
            }
        ]
    },
    # 2.0
    {
        "code": "2.0", "title": "2.0 CIVIL, STRUCTURAL, & ARCHITECTURAL (CSA)", "level": "Phase",
        "start": "2027-04-01", "end": "2027-12-31",
        "children": [
            {
                "code": "2.1", "title": "2.1 Substructure & Foundation", "level": "Task",
                "start": "2027-04-01", "end": "2027-07-15",
                "children": [
                    {"code": "2.1.1", "title": "2.1.1 Site Excavation & Earthwork", "level": "Subtask", "start": "2027-04-01", "end": "2027-05-15", "planned_qty": 5000.0},
                    {"code": "2.1.2", "title": "2.1.2 Piling & Deep Foundations", "level": "Subtask", "start": "2027-05-01", "end": "2027-06-15"},
                    {"code": "2.1.3", "title": "2.1.3 Concrete Slabs & Seismic Reinforcement", "level": "Subtask", "start": "2027-06-01", "end": "2027-07-15", "planned_qty": 1000.0},
                ]
            },
            {
                "code": "2.2", "title": "2.2 Superstructure & Exterior", "level": "Task",
                "start": "2027-07-01", "end": "2027-10-31",
                "children": [
                    {"code": "2.2.1", "title": "2.2.1 Structural Steel Framing / Concrete Core", "level": "Subtask", "start": "2027-07-01", "end": "2027-08-31"},
                    {"code": "2.2.2", "title": "2.2.2 Roof Systems & Waterproofing", "level": "Subtask", "start": "2027-08-15", "end": "2027-09-30"},
                    {"code": "2.2.3", "title": "2.2.3 Exterior Cladding & Curtain Walls", "level": "Subtask", "start": "2027-09-01", "end": "2027-10-31"},
                ]
            },
            {
                "code": "2.3", "title": "2.3 Interior Architecture", "level": "Task",
                "start": "2027-09-01", "end": "2027-12-31",
                "children": [
                    {"code": "2.3.1", "title": "2.3.1 Raised Access Flooring Systems", "level": "Subtask", "start": "2027-09-01", "end": "2027-10-31"},
                    {"code": "2.3.2", "title": "2.3.2 Drywall Partitions & Fire-Rated Walls", "level": "Subtask", "start": "2027-10-01", "end": "2027-11-30"},
                    {"code": "2.3.3", "title": "2.3.3 Security Doors & Acoustic Treatments", "level": "Subtask", "start": "2027-11-01", "end": "2027-12-31"},
                ]
            }
        ]
    },
    # 3.0
    {
        "code": "3.0", "title": "3.0 MECHANICAL & HVAC SYSTEMS", "level": "Phase",
        "start": "2027-07-01", "end": "2028-03-31",
        "children": [
            {
                "code": "3.1", "title": "3.1 Cooling Infrastructure", "level": "Task",
                "start": "2027-07-01", "end": "2027-11-30",
                "children": [
                    {"code": "3.1.1", "title": "3.1.1 Chillers & Cooling Towers Installation", "level": "Subtask", "start": "2027-07-01", "end": "2027-09-30"},
                    {"code": "3.1.2", "title": "3.1.2 Chilled Water Pumps & Piping Networks", "level": "Subtask", "start": "2027-08-01", "end": "2027-10-31"},
                    {"code": "3.1.3", "title": "3.1.3 Thermal Storage Tanks", "level": "Subtask", "start": "2027-09-01", "end": "2027-11-30"},
                ]
            },
            {
                "code": "3.2", "title": "3.2 Air Handling & Containment", "level": "Task",
                "start": "2027-10-01", "end": "2028-01-31",
                "children": [
                    {"code": "3.2.1", "title": "3.2.1 CRAH / CRAC Units Installation", "level": "Subtask", "start": "2027-10-01", "end": "2027-12-31"},
                    {"code": "3.2.2", "title": "3.2.2 Hot/Cold Aisle Containment Systems", "level": "Subtask", "start": "2027-11-01", "end": "2028-01-15"},
                    {"code": "3.2.3", "title": "3.2.3 Ductwork & Ventilation Grills", "level": "Subtask", "start": "2027-11-15", "end": "2028-01-31"},
                ]
            },
            {
                "code": "3.3", "title": "3.3 Plumbing & Fire Suppression", "level": "Task",
                "start": "2027-12-01", "end": "2028-03-31",
                "children": [
                    {"code": "3.3.1", "title": "3.3.1 Domestic Water & Floor Drains", "level": "Subtask", "start": "2027-12-01", "end": "2028-01-31"},
                    {"code": "3.3.2", "title": "3.3.2 Pre-Action Sprinkler Piping & Valves", "level": "Subtask", "start": "2028-01-01", "end": "2028-02-28"},
                    {"code": "3.3.3", "title": "3.3.3 Gaseous Clean-Agent Suppression Systems", "level": "Subtask", "start": "2028-02-01", "end": "2028-03-31"},
                ]
            }
        ]
    },
    # 4.0
    {
        "code": "4.0", "title": "4.0 ELECTRICAL & POWER SYSTEMS", "level": "Phase",
        "start": "2027-07-01", "end": "2028-04-30",
        "children": [
            {
                "code": "4.1", "title": "4.1 High-Voltage & Distribution", "level": "Task",
                "start": "2027-07-01", "end": "2027-10-31",
                "children": [
                    {"code": "4.1.1", "title": "4.1.1 Utility Substation Equipment", "level": "Subtask", "start": "2027-07-01", "end": "2027-08-31"},
                    {"code": "4.1.2", "title": "4.1.2 Main Power Transformers & Switchgear", "level": "Subtask", "start": "2027-08-01", "end": "2027-09-30"},
                    {"code": "4.1.3", "title": "4.1.3 Medium Voltage Cabling", "level": "Subtask", "start": "2027-09-01", "end": "2027-10-31"},
                ]
            },
            {
                "code": "4.2", "title": "4.2 Backup Power", "level": "Task",
                "start": "2027-09-01", "end": "2027-12-31",
                "children": [
                    {"code": "4.2.1", "title": "4.2.1 Diesel Generator Sets", "level": "Subtask", "start": "2027-09-01", "end": "2027-11-15"},
                    {"code": "4.2.2", "title": "4.2.2 Bulk Fuel Storage Tanks & Piping", "level": "Subtask", "start": "2027-10-01", "end": "2027-11-30"},
                    {"code": "4.2.3", "title": "4.2.3 Fuel Transfer & Polishing Systems", "level": "Subtask", "start": "2027-11-15", "end": "2027-12-31"},
                ]
            },
            {
                "code": "4.3", "title": "4.3 Power Conditioning & Delivery", "level": "Task",
                "start": "2027-11-01", "end": "2028-03-31",
                "children": [
                    {"code": "4.3.1", "title": "4.3.1 Uninterruptible Power Supply (UPS) Modules", "level": "Subtask", "start": "2027-11-01", "end": "2028-01-31"},
                    {"code": "4.3.2", "title": "4.3.2 Power Distribution Units (PDUs)", "level": "Subtask", "start": "2027-12-01", "end": "2028-02-28"},
                    {"code": "4.3.3", "title": "4.3.3 Remote Power Panels (RPPs) & Busways", "level": "Subtask", "start": "2028-01-01", "end": "2028-03-31"},
                ]
            },
            {
                "code": "4.4", "title": "4.4 Grounding & Protection", "level": "Task",
                "start": "2028-02-01", "end": "2028-04-30",
                "children": [
                    {"code": "4.4.1", "title": "4.4.1 Main Ground Grid & Earth Pits", "level": "Subtask", "start": "2028-02-01", "end": "2028-03-31"},
                    {"code": "4.4.2", "title": "4.4.2 Surge Protection Devices (SPDs)", "level": "Subtask", "start": "2028-03-01", "end": "2028-04-30"},
                ]
            }
        ]
    },
    # 5.0
    {
        "code": "5.0", "title": "5.0 LOW-VOLTAGE, IT, & SECURITY SYSTEMS", "level": "Phase",
        "start": "2028-01-01", "end": "2028-05-31",
        "children": [
            {
                "code": "5.1", "title": "5.1 Telecommunications", "level": "Task",
                "start": "2028-01-01", "end": "2028-04-30",
                "children": [
                    {"code": "5.1.1", "title": "5.1.1 Structured Cabling (Fiber/Copper Pathways)", "level": "Subtask", "start": "2028-01-01", "end": "2028-03-31"},
                    {"code": "5.1.2", "title": "5.1.2 Meet-Me-Rooms (MMR) & Entrance Facilities", "level": "Subtask", "start": "2028-02-01", "end": "2028-04-30"},
                ]
            },
            {
                "code": "5.2", "title": "5.2 Monitoring & Management", "level": "Task",
                "start": "2028-02-01", "end": "2028-05-15",
                "children": [
                    {"code": "5.2.1", "title": "5.2.1 Building Management System (BMS) Sensors", "level": "Subtask", "start": "2028-02-01", "end": "2028-04-15"},
                    {"code": "5.2.2", "title": "5.2.2 DCIM Integration", "level": "Subtask", "start": "2028-03-15", "end": "2028-05-15"},
                ]
            },
            {
                "code": "5.3", "title": "5.3 Physical Security", "level": "Task",
                "start": "2028-03-01", "end": "2028-05-31",
                "children": [
                    {"code": "5.3.1", "title": "5.3.1 Biometric & Keycard Access Control", "level": "Subtask", "start": "2028-03-01", "end": "2028-04-30"},
                    {"code": "5.3.2", "title": "5.3.2 CCTV Surveillance & Perimeter Intrusion", "level": "Subtask", "start": "2028-04-01", "end": "2028-05-31"},
                ]
            }
        ]
    },
    # 6.0
    {
        "code": "6.0", "title": "6.0 COMMISSIONING & HANDOVER", "level": "Phase",
        "start": "2028-04-01", "end": "2028-06-30",
        "children": [
            {
                "code": "6.1", "title": "6.1 Pre-Functional Testing", "level": "Task",
                "start": "2028-04-01", "end": "2028-05-15",
                "children": [
                    {"code": "6.1.1", "title": "6.1.1 Level 1: Factory Acceptance Testing (FAT)", "level": "Subtask", "start": "2028-04-01", "end": "2028-04-15"},
                    {"code": "6.1.2", "title": "6.1.2 Level 2: Component Verification Checks", "level": "Subtask", "start": "2028-04-10", "end": "2028-04-30"},
                    {"code": "6.1.3", "title": "6.1.3 Level 3: Pre-Functional Testing (PFT)", "level": "Subtask", "start": "2028-05-01", "end": "2028-05-15"},
                ]
            },
            {
                "code": "6.2", "title": "6.2 Integrated Testing & Closeout", "level": "Task",
                "start": "2028-05-16", "end": "2028-06-30",
                "children": [
                    {"code": "6.2.1", "title": "6.2.1 Level 4: Integrated Systems Testing (IST) & Load Banks", "level": "Subtask", "start": "2028-05-16", "end": "2028-05-31"},
                    {"code": "6.2.2", "title": "6.2.2 Level 5: Operational Readiness & Utility Failover", "level": "Subtask", "start": "2028-06-01", "end": "2028-06-15"},
                    {"code": "6.2.3", "title": "6.2.3 Project Closeout, As-Builts, & Municipal Sign-offs", "level": "Subtask", "start": "2028-06-16", "end": "2028-06-30"},
                ]
            }
        ]
    }
]

def parse_date(date_str):
    return datetime.strptime(date_str, "%Y-%m-%d")

def seed_data_center_wbs():
    db = SessionLocal()
    try:
        projects = db.query(Project).all()
        for proj in projects:
            print(f"[*] Processing project #{proj.id}: {proj.code} - {proj.name}")

            # First, unlink BoqItems and SiteDailyLogs from existing WBS tasks for this project
            # to prevent foreign key errors when deleting old tasks
            boqs = db.query(BoqItem).filter(BoqItem.project_id == proj.id).all()
            for b in boqs:
                b.phase_id = None
                b.task_id = None
                b.subtask_id = None
            db.commit()

            logs = db.query(SiteDailyLog).filter(SiteDailyLog.project_id == proj.id).all()
            for l in logs:
                if hasattr(l, 'phase_id'): l.phase_id = None
                if hasattr(l, 'task_id'): l.task_id = None
                if hasattr(l, 'subtask_id'): l.subtask_id = None
            db.commit()

            # Delete all old dummy WBS tasks for this project
            db.commit()

            # Insert the new Data Center WBS structure
            inserted_wbs_map = {} # wbs_code -> WbsTask instance

            for p_data in DATA_CENTER_WBS:
                phase_task = WbsTask(
                    project_id=proj.id,
                    wbs_code=p_data["code"],
                    title=p_data["title"],
                    task_level="Phase",
                    start_date=parse_date(p_data["start"]),
                    end_date=parse_date(p_data["end"]),
                    status="not_started"
                )
                db.add(phase_task)
                db.commit()
                db.refresh(phase_task)
                inserted_wbs_map[p_data["code"]] = phase_task

                for t_data in p_data.get("children", []):
                    task_obj = WbsTask(
                        project_id=proj.id,
                        parent_task_id=phase_task.id,
                        wbs_code=t_data["code"],
                        title=t_data["title"],
                        task_level="Task",
                        start_date=parse_date(t_data["start"]),
                        end_date=parse_date(t_data["end"]),
                        status="not_started"
                    )
                    db.add(task_obj)
                    db.commit()
                    db.refresh(task_obj)
                    inserted_wbs_map[t_data["code"]] = task_obj

                    for st_data in t_data.get("children", []):
                        subtask_obj = WbsTask(
                            project_id=proj.id,
                            parent_task_id=task_obj.id,
                            wbs_code=st_data["code"],
                            title=st_data["title"],
                            task_level="Subtask",
                            start_date=parse_date(st_data["start"]),
                            end_date=parse_date(st_data["end"]),
                            planned_qty=st_data.get("planned_qty", 0.0),
                            status="not_started"
                        )
                        db.add(subtask_obj)
                        db.commit()
                        db.refresh(subtask_obj)
                        inserted_wbs_map[st_data["code"]] = subtask_obj

            print(f"[+] Successfully loaded {len(inserted_wbs_map)} Data Center WBS nodes for project #{proj.id}!")

            # Re-map BOQ items to appropriate Data Center WBS subtasks
            # e.g., Excavation -> 2.1.1 (Site Excavation & Earthwork)
            # e.g., M30 Concrete -> 2.1.3 (Concrete Slabs & Seismic Reinforcement)
            st_211 = inserted_wbs_map.get("2.1.1")
            st_213 = inserted_wbs_map.get("2.1.3")
            task_21 = inserted_wbs_map.get("2.1")
            phase_20 = inserted_wbs_map.get("2.0")

            boq_exc = db.query(BoqItem).filter(BoqItem.project_id == proj.id, BoqItem.item_name.like("%Excavation%")).first()
            if boq_exc and st_211:
                boq_exc.phase_id = phase_20.id if phase_20 else None
                boq_exc.task_id = task_21.id if task_21 else None
                boq_exc.subtask_id = st_211.id
                st_211.planned_qty = boq_exc.approved_qty or 5000.0
                db.commit()

            boq_conc = db.query(BoqItem).filter(BoqItem.project_id == proj.id, BoqItem.item_name.like("%Concrete%")).first()
            if boq_conc and st_213:
                boq_conc.phase_id = phase_20.id if phase_20 else None
                boq_conc.task_id = task_21.id if task_21 else None
                boq_conc.subtask_id = st_213.id
                st_213.planned_qty = boq_conc.approved_qty or 1000.0
                db.commit()

    except Exception as e:
        db.rollback()
        print(f"[!] Error seeding Data Center WBS: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_data_center_wbs()
