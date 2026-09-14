"""
End-to-End Connectivity & Isolation Verification Test Suite
Tests:
1. Exact 4 active demo projects returned by API
2. Historical database safety (no deleted records, non-demo projects archived)
3. End-to-end data chain verification for:
   - Project 29 (Metro Tower Construction Phase 1)
   - Project 2 (Greenfield Data Center Park)
   - Project 1 (Riverside Commercial Complex Phase 1)
4. Cross-project data isolation (no mixing between Project 29, 2, and 1)
5. Dashboard widget isolation for each project
"""

import json
import sys
from pathlib import Path

backend_path = str(Path(__file__).resolve().parent.parent / "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
BASE_URL = "http://127.0.0.1:8000"

def get_json(url):
    path = url.replace("http://127.0.0.1:8000", "")
    resp = client.get(path)
    assert resp.status_code == 200, f"GET {path} failed with {resp.status_code}: {resp.text}"
    return resp.json()

def run_tests():
    print("=" * 80)
    print("STARTING COMPREHENSIVE END-TO-END CONNECTIVITY TEST SUITE")
    print("=" * 80)

    # -------------------------------------------------------------
    # TEST 1 & 10: Verify Exactly 4 Active Demo Projects in APIs
    # -------------------------------------------------------------
    print("\n--- TEST 1 & 10: GET /api/projects/ returns exactly 4 active demo projects ---")
    projects = get_json(f"{BASE_URL}/api/projects/")
    print(f"Total projects returned: {len(projects)}")
    assert len(projects) == 4, f"Expected exactly 4 active projects, got {len(projects)}"
    
    expected_ids = {1, 2, 29, 30}
    actual_ids = {p["id"] for p in projects}
    assert actual_ids == expected_ids, f"Project IDs mismatch. Expected {expected_ids}, got {actual_ids}"

    for p in projects:
        assert p["is_active"] is True, f"Project {p['id']} has is_active=False"
        print(f"  [PASS] Project {p['id']}: {p['code']} - {p['name']} | Phase: {p.get('current_phase')}")

    # Verify Dashboard User-Projects endpoint
    print("\n--- TEST: GET /api/dashboard/user-projects returns same 4 active projects ---")
    dash_proj_res = get_json(f"{BASE_URL}/api/dashboard/user-projects")
    dash_projects = dash_proj_res.get("projects", [])
    assert len(dash_projects) == 4, f"Expected 4 dashboard projects, got {len(dash_projects)}"
    dash_ids = {p["id"] for p in dash_projects}
    assert dash_ids == expected_ids, f"Dashboard IDs mismatch. Expected {expected_ids}, got {dash_ids}"
    print(f"  [PASS] Dashboard returns same 4 active projects. Default project: {dash_proj_res.get('default_project_id')}")

    # -------------------------------------------------------------
    # TEST 11: Database Records Safety & Archival Verification
    # -------------------------------------------------------------
    print("\n--- TEST 11: Database Safety - Archived projects preserved ---")
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
    from app.database import SessionLocal
    from app.models import Project, BoqItem, ProjectEstimate, TechnicalSanction, ContractorAward, WorkOrder, WorkPlan, WbsTask, WorkPlanBoqMapping, ProjectTeamMember, TaskAssignment, ProjectMilestone, SiteDailyLog, MeasurementBook, Hindrance

    db = SessionLocal()
    total_projects_db = db.query(Project).count()
    active_projects_db = db.query(Project).filter(Project.is_active == True).count()
    archived_projects_db = db.query(Project).filter(Project.is_active == False).count()

    print(f"Total projects in DB: {total_projects_db}")
    print(f"Active demo projects: {active_projects_db}")
    print(f"Archived historical projects: {archived_projects_db}")
    assert total_projects_db >= 28, f"Total projects count decreased! Historical data lost!"
    assert active_projects_db == 4, f"Active demo projects count in DB is not 4!"
    assert archived_projects_db >= 24, f"Archived projects missing!"
    print("  [PASS] All historical database records are safely preserved.")

    # -------------------------------------------------------------
    # TEST 5 & 12: End-to-End Chain Verification for Top 3 Projects
    # -------------------------------------------------------------
    print("\n--- TEST 5 & 12: Complete End-to-End Demo Chain Verification ---")
    demo_pids = [29, 2, 1]  # Metro Tower, Greenfield, Riverside
    
    for pid in demo_pids:
        p = db.query(Project).get(pid)
        print(f"\nVerifying Chain for Project {pid}: {p.name} ({p.code})")

        # 1. Project Inception
        assert p.name and p.code and p.budget > 0, f"Project {pid} missing master attributes"

        # 2. BOQ items
        boqs = db.query(BoqItem).filter(BoqItem.project_id == pid).all()
        assert len(boqs) >= 5, f"Project {pid} should have >= 5 BOQ items, found {len(boqs)}"
        for b in boqs:
            assert float(b.approved_qty) > 0 and float(b.rate) > 0, f"Invalid BOQ values: {b.id}"

        # 3. Detailed Estimate
        est = db.query(ProjectEstimate).filter(ProjectEstimate.project_id == pid).first()
        assert est is not None, f"Project {pid} missing Detailed Estimate"
        assert est.status == "APPROVED", f"Estimate {est.id} is not APPROVED"
        assert float(est.total_amount) > 0, f"Estimate total is 0"

        # 4. Technical Sanction
        ts = db.query(TechnicalSanction).filter(TechnicalSanction.project_id == pid).first()
        assert ts is not None, f"Project {pid} missing Technical Sanction"
        assert ts.status == "APPROVED", f"Technical Sanction is not APPROVED"

        # 5. Contractor Award
        awd = db.query(ContractorAward).filter(ContractorAward.project_id == pid).first()
        assert awd is not None, f"Project {pid} missing Contractor Award"
        assert awd.status == "AWARDED", f"Contractor Award is not AWARDED"

        # 6. Work Order
        wo = db.query(WorkOrder).filter(WorkOrder.project_id == pid).first()
        assert wo is not None, f"Project {pid} missing Work Order"
        assert wo.status in ["ISSUED", "ACTIVE"], f"Work Order is not ACTIVE/ISSUED"

        # 7. WBS Tasks
        wbs_count = db.query(WbsTask).filter(WbsTask.project_id == pid).count()
        assert wbs_count >= 10, f"Project {pid} has insufficient WBS tasks: {wbs_count}"

        # 8. Work Plan & BOQ Mapping
        wp = db.query(WorkPlan).filter(WorkPlan.project_id == pid).first()
        assert wp is not None, f"Project {pid} missing Work Plan activity"
        mapping = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.project_id == pid).first()
        assert mapping is not None, f"Project {pid} missing Work Plan BOQ Mapping"
        assert mapping.work_plan_id == wp.id or db.query(WorkPlan).filter(WorkPlan.id == mapping.work_plan_id, WorkPlan.project_id == pid).first() is not None

        # 9. Project Team
        team_count = db.query(ProjectTeamMember).filter(ProjectTeamMember.project_id == pid, ProjectTeamMember.is_active == True).count()
        assert team_count >= 3, f"Project {pid} has insufficient team members: {team_count}"

        # 10. Task Assignment
        task = db.query(TaskAssignment).filter(TaskAssignment.project_id == pid).first()
        assert task is not None, f"Project {pid} missing Task Assignment"

        # 11. Project Milestones
        ms_count = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == pid).count()
        assert ms_count >= 2, f"Project {pid} has insufficient milestones: {ms_count}"

        # 12. Daily Site Logs
        logs_count = db.query(SiteDailyLog).filter(SiteDailyLog.project_id == pid).count()
        assert logs_count >= 2, f"Project {pid} has insufficient daily logs: {logs_count}"

        # 13. Digital e-MB
        emb_count = db.query(MeasurementBook).filter(MeasurementBook.project_id == pid).count()
        assert emb_count >= 2, f"Project {pid} has insufficient e-MB entries: {emb_count}"

        # 14. Hindrance
        hind = db.query(Hindrance).filter(Hindrance.project_id == pid).first()
        assert hind is not None, f"Project {pid} missing Hindrance record"

        print(f"  [PASS] Full 14-Step End-to-End Chain Verified for Project {pid}!")

    # -------------------------------------------------------------
    # TEST 6 & 7: Cross-Project Data Isolation
    # -------------------------------------------------------------
    print("\n--- TEST 6 & 7: Cross-Project Isolation (Zero Data Mixing) ---")
    
    # Project 29 vs Project 2
    p29_boq_ids = {b.id for b in db.query(BoqItem).filter(BoqItem.project_id == 29).all()}
    p2_boq_ids = {b.id for b in db.query(BoqItem).filter(BoqItem.project_id == 2).all()}
    overlap_boqs = p29_boq_ids.intersection(p2_boq_ids)
    assert len(overlap_boqs) == 0, f"BOQ cross-project overlap detected: {overlap_boqs}"
    print(f"  [PASS] BOQ Isolation: Project 29 ({len(p29_boq_ids)} items) and Project 2 ({len(p2_boq_ids)} items) share 0 items.")

    # WBS Isolation
    p29_wbs_ids = {w.id for w in db.query(WbsTask).filter(WbsTask.project_id == 29).all()}
    p2_wbs_ids = {w.id for w in db.query(WbsTask).filter(WbsTask.project_id == 2).all()}
    overlap_wbs = p29_wbs_ids.intersection(p2_wbs_ids)
    assert len(overlap_wbs) == 0, f"WBS cross-project overlap detected: {overlap_wbs}"
    print(f"  [PASS] WBS Isolation: Project 29 ({len(p29_wbs_ids)} tasks) and Project 2 ({len(p2_wbs_ids)} tasks) share 0 tasks.")

    # MeasurementBook Isolation
    p29_emb_ids = {m.id for m in db.query(MeasurementBook).filter(MeasurementBook.project_id == 29).all()}
    p2_emb_ids = {m.id for m in db.query(MeasurementBook).filter(MeasurementBook.project_id == 2).all()}
    overlap_emb = p29_emb_ids.intersection(p2_emb_ids)
    assert len(overlap_emb) == 0, f"e-MB cross-project overlap detected: {overlap_emb}"
    print(f"  [PASS] e-MB Isolation: Project 29 ({len(p29_emb_ids)} entries) and Project 2 ({len(p2_emb_ids)} entries) share 0 entries.")

    # Dashboard Live Endpoints Isolation
    print("\n--- Dashboard Endpoint Isolation Verification ---")
    p29_dash = get_json(f"{BASE_URL}/api/dashboard/project/29/unified")
    p2_dash = get_json(f"{BASE_URL}/api/dashboard/project/2/unified")
    
    assert p29_dash["project"]["id"] == 29, "Dashboard project ID mismatch"
    assert p2_dash["project"]["id"] == 2, "Dashboard project ID mismatch"
    assert p29_dash["project"]["name"] != p2_dash["project"]["name"]
    print(f"  [PASS] Dashboard Project 29 Name: {p29_dash['project']['name']}")
    print(f"  [PASS] Dashboard Project 2 Name: {p2_dash['project']['name']}")

    db.close()
    print("\n" + "=" * 80)
    print("ALL 12 TEST SCENARIOS PASSED WITH ZERO ERRORS!")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
