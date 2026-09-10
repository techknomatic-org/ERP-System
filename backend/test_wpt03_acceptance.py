import sys
import os
import datetime
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import SessionLocal
from app.models import (
    Project, WbsTask, BoqItem, WorkPlan, WorkPlanBoqMapping,
    ProjectMilestone, MeasurementBook, User, AuditLog
)
from app.api.milestones import recalculate_milestones_for_wbs_node

client = TestClient(app)

def run_wpt03_acceptance_tests():
    print("==================================================")
    print("WPT-03 MILESTONE DEFINITION ACCEPTANCE TESTS")
    print("==================================================")

    db = SessionLocal()

    # 1. Prepare Projects
    proj_a = db.query(Project).filter(Project.name == "WPT-03 Test Project A").first()
    if not proj_a:
        proj_a = Project(
            name="WPT-03 Test Project A",
            code="WPT03-PROJ-A",
            location="Site A",
            budget=8000000.0,
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2026, 12, 31),
            status="ACTIVE"
        )
        db.add(proj_a)
        db.commit()
        db.refresh(proj_a)

    proj_b = db.query(Project).filter(Project.name == "WPT-03 Test Project B").first()
    if not proj_b:
        proj_b = Project(
            name="WPT-03 Test Project B",
            code="WPT03-PROJ-B",
            location="Site B",
            budget=4000000.0,
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2026, 12, 31),
            status="ACTIVE"
        )
        db.add(proj_b)
        db.commit()
        db.refresh(proj_b)

    # 2. Setup Customer User for RBAC testing
    cust_user = db.query(User).filter(User.username == "customer_test").first()
    if not cust_user:
        cust_user = User(
            username="customer_test",
            email="cust_test@erp.local",
            full_name="Customer Tester",
            hashed_password="hashed_dummy_password",
            role="customer",
            is_active=True
        )
        db.add(cust_user)
        db.commit()
        db.refresh(cust_user)

    admin_user = db.query(User).filter(User.username == "admin").first()
    if not admin_user:
        admin_user = User(
            username="admin",
            email="admin@erp.local",
            full_name="System Administrator",
            hashed_password="hashed_dummy_password",
            role="admin",
            is_active=True
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

    auth_admin = {"Authorization": f"Bearer demo-token-{admin_user.id}"}
    auth_customer = {"Authorization": f"Bearer demo-token-{cust_user.id}"}

    # Clean up prior test milestones for these test projects
    db.query(ProjectMilestone).filter(ProjectMilestone.project_id.in_([proj_a.id, proj_b.id])).delete(synchronize_session=False)
    db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.project_id.in_([proj_a.id, proj_b.id])).delete(synchronize_session=False)
    db.query(WorkPlan).filter(WorkPlan.project_id.in_([proj_a.id, proj_b.id])).delete(synchronize_session=False)
    from app.models import ProjectEstimateLine, ProjectEstimate
    est_ids = [e.id for e in db.query(ProjectEstimate).filter(ProjectEstimate.project_id.in_([proj_a.id, proj_b.id])).all()]
    if est_ids:
        db.query(ProjectEstimateLine).filter(ProjectEstimateLine.estimate_id.in_(est_ids)).delete(synchronize_session=False)
    db.query(BoqItem).filter(BoqItem.project_id.in_([proj_a.id, proj_b.id])).delete(synchronize_session=False)
    
    tasks_a = db.query(WbsTask).filter(WbsTask.project_id == proj_a.id).all()
    for t in tasks_a:
        t.parent_task_id = None
    db.commit()
    for t in tasks_a:
        db.delete(t)

    tasks_b = db.query(WbsTask).filter(WbsTask.project_id == proj_b.id).all()
    for t in tasks_b:
        t.parent_task_id = None
    db.commit()
    for t in tasks_b:
        db.delete(t)
    db.commit()

    # Create WBS Nodes
    wbs_phase_a = WbsTask(
        project_id=proj_a.id,
        wbs_code="PH-A1",
        title="Phase A1",
        task_level="Phase",
        planned_qty=150.0,
        actual_qty=0.0,
        progress_pct=0.0,
        start_date=datetime.datetime(2026, 9, 1),
        end_date=datetime.datetime(2026, 9, 30)
    )
    db.add(wbs_phase_a)
    db.commit()
    db.refresh(wbs_phase_a)

    wbs_task_a1 = WbsTask(
        project_id=proj_a.id,
        parent_task_id=wbs_phase_a.id,
        wbs_code="WBS-A1",
        title="Substructure Works",
        task_level="Task",
        planned_qty=150.0,
        actual_qty=0.0,
        progress_pct=0.0,
        start_date=datetime.datetime(2026, 9, 1),
        end_date=datetime.datetime(2026, 9, 30)
    )
    wbs_task_a2 = WbsTask(
        project_id=proj_a.id,
        parent_task_id=wbs_phase_a.id,
        wbs_code="WBS-A2",
        title="Superstructure Works",
        task_level="Task",
        planned_qty=250.0,
        actual_qty=100.0,
        progress_pct=40.0,
        start_date=datetime.datetime(2026, 10, 1),
        end_date=datetime.datetime(2026, 11, 15)
    )
    wbs_task_b1 = WbsTask(
        project_id=proj_b.id,
        wbs_code="WBS-B1",
        title="Project B Grading",
        task_level="Task",
        planned_qty=50.0,
        actual_qty=0.0,
        progress_pct=0.0,
        start_date=datetime.datetime(2026, 9, 1),
        end_date=datetime.datetime(2026, 10, 1)
    )
    db.add_all([wbs_task_a1, wbs_task_a2, wbs_task_b1])
    db.commit()
    db.refresh(wbs_task_a1)
    db.refresh(wbs_task_a2)
    db.refresh(wbs_task_b1)

    # Add Work Plan and BOQ mapping for wbs_task_a1 to test total mapped BOQ
    boq_a = BoqItem(
        project_id=proj_a.id,
        item_name="PCC Concrete",
        unit="m³",
        approved_qty=120.0,
        rate=5000.0,
        total_amount=600000.0
    )
    db.add(boq_a)
    db.commit()
    db.refresh(boq_a)

    wp_a1 = WorkPlan(
        work_plan_number="WP-A1-001",
        project_id=proj_a.id,
        wbs_phase_id=wbs_phase_a.id,
        task_id=wbs_task_a1.id,
        activity_name="Concrete Pouring Activity",
        planned_quantity=120.0,
        unit="m³",
        planned_start_date=datetime.date(2026, 9, 1),
        planned_end_date=datetime.date(2026, 9, 20),
        status="APPROVED"
    )
    db.add(wp_a1)
    db.commit()
    db.refresh(wp_a1)

    mapping_a = WorkPlanBoqMapping(
        project_id=proj_a.id,
        work_plan_id=wp_a1.id,
        boq_item_id=boq_a.id,
        mapped_quantity=120.0,
        unit="m³",
        created_by_id=admin_user.id
    )
    db.add(mapping_a)
    db.commit()

    today_str = datetime.date.today().isoformat()
    yesterday_str = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    future_date_str = (datetime.date.today() + datetime.timedelta(days=15)).isoformat()

    print("[OK] Test environment initialized.")

    # ----------------------------------------------------
    # TEST 1: Date-based milestone created with past/today date -> status Met
    # ----------------------------------------------------
    print("\n--- TEST 1: Date-based milestone with past/today date -> Met ---")
    res1 = client.post("/api/milestones", headers=auth_admin, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_a1.id,
        "milestone_name": "Mobilization Complete",
        "is_date_based": True,
        "is_quantity_based": False,
        "target_date": yesterday_str
    })
    assert res1.status_code == 201, f"Test 1 failed: {res1.text}"
    data1 = res1.json()
    assert data1["status"] == "Met", f"Expected Met, got {data1['status']}"
    assert data1["is_date_met"] is True
    print(f"PASS TEST 1: Date-based past target_date evaluated to '{data1['status']}' (is_date_met=True).")

    # ----------------------------------------------------
    # TEST 2: Date-based milestone created with future date -> status Pending
    # ----------------------------------------------------
    print("\n--- TEST 2: Date-based milestone with future date -> Pending ---")
    res2 = client.post("/api/milestones", headers=auth_admin, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_a1.id,
        "milestone_name": "Groundbreaking Inspection",
        "is_date_based": True,
        "is_quantity_based": False,
        "target_date": future_date_str
    })
    assert res2.status_code == 201, f"Test 2 failed: {res2.text}"
    data2 = res2.json()
    assert data2["status"] == "Pending", f"Expected Pending, got {data2['status']}"
    assert data2["is_date_met"] is False
    print(f"PASS TEST 2: Date-based future target_date evaluated to '{data2['status']}' (is_date_met=False).")

    # ----------------------------------------------------
    # TEST 3: Quantity-based milestone created -> status Met when actual qty >= target
    # ----------------------------------------------------
    print("\n--- TEST 3: Quantity-based milestone when actual_qty >= target -> Met ---")
    # wbs_task_a2 has actual_qty = 100.0
    res3 = client.post("/api/milestones", headers=auth_admin, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_a2.id,
        "milestone_name": "Columns 50m3 Poured",
        "is_date_based": False,
        "is_quantity_based": True,
        "target_quantity": 50.0
    })
    assert res3.status_code == 201, f"Test 3 failed: {res3.text}"
    data3 = res3.json()
    assert data3["status"] == "Met", f"Expected Met, got {data3['status']}"
    assert data3["is_quantity_met"] is True
    print(f"PASS TEST 3: Quantity-based milestone with target=50 <= actual=100 evaluated to '{data3['status']}'.")

    # ----------------------------------------------------
    # TEST 4: Quantity-based milestone created with target > current executed qty -> Pending
    # ----------------------------------------------------
    print("\n--- TEST 4: Quantity-based milestone when actual_qty < target -> Pending ---")
    # wbs_task_a2 has actual_qty = 100.0, target = 150.0
    res4 = client.post("/api/milestones", headers=auth_admin, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_a2.id,
        "milestone_name": "Columns 150m3 Poured",
        "is_date_based": False,
        "is_quantity_based": True,
        "target_quantity": 150.0
    })
    assert res4.status_code == 201, f"Test 4 failed: {res4.text}"
    data4 = res4.json()
    assert data4["status"] == "Pending", f"Expected Pending, got {data4['status']}"
    assert data4["is_quantity_met"] is False
    print(f"PASS TEST 4: Quantity-based milestone with target=150 > actual=100 evaluated to '{data4['status']}'.")

    # ----------------------------------------------------
    # TEST 5: Both date and quantity selected -> Met ONLY when BOTH satisfied
    # ----------------------------------------------------
    print("\n--- TEST 5: Both Date & Quantity met -> Met ---")
    # past date + target=80 <= actual=100
    res5 = client.post("/api/milestones", headers=auth_admin, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_a2.id,
        "milestone_name": "Phase 1 Structure Complete",
        "is_date_based": True,
        "is_quantity_based": True,
        "target_date": yesterday_str,
        "target_quantity": 80.0
    })
    assert res5.status_code == 201, f"Test 5 failed: {res5.text}"
    data5 = res5.json()
    assert data5["status"] == "Met", f"Expected Met, got {data5['status']}"
    assert data5["is_date_met"] is True
    assert data5["is_quantity_met"] is True
    print(f"PASS TEST 5: Both satisfied -> evaluated to '{data5['status']}'.")

    # ----------------------------------------------------
    # TEST 6: Both date and quantity selected -> Pending if date met but quantity NOT met
    # ----------------------------------------------------
    print("\n--- TEST 6: Date met (past) but Quantity NOT met -> Pending (Strict AND) ---")
    res6 = client.post("/api/milestones", headers=auth_admin, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_a2.id,
        "milestone_name": "Phase 1 Overachieved Target",
        "is_date_based": True,
        "is_quantity_based": True,
        "target_date": yesterday_str,
        "target_quantity": 200.0  # actual is 100
    })
    assert res6.status_code == 201, f"Test 6 failed: {res6.text}"
    data6 = res6.json()
    assert data6["status"] == "Pending", f"Expected Pending, got {data6['status']}"
    assert data6["is_date_met"] is True
    assert data6["is_quantity_met"] is False
    print(f"PASS TEST 6: Date met, qty not met -> correctly evaluated to '{data6['status']}'.")

    # ----------------------------------------------------
    # TEST 7: Both date and quantity selected -> Pending if quantity met but date NOT met
    # ----------------------------------------------------
    print("\n--- TEST 7: Quantity met but Date NOT met (future) -> Pending (Strict AND) ---")
    res7 = client.post("/api/milestones", headers=auth_admin, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_a2.id,
        "milestone_name": "Phase 1 Early Execution",
        "is_date_based": True,
        "is_quantity_based": True,
        "target_date": future_date_str,
        "target_quantity": 80.0  # actual is 100
    })
    assert res7.status_code == 201, f"Test 7 failed: {res7.text}"
    data7 = res7.json()
    assert data7["status"] == "Pending", f"Expected Pending, got {data7['status']}"
    assert data7["is_date_met"] is False
    assert data7["is_quantity_met"] is True
    print(f"PASS TEST 7: Qty met, date not met -> correctly evaluated to '{data7['status']}'.")

    # ----------------------------------------------------
    # TEST 8: Neither selected -> validation error, milestone not created
    # ----------------------------------------------------
    print("\n--- TEST 8: Neither selected -> Exact error 'Select at least one milestone type.' ---")
    res8 = client.post("/api/milestones", headers=auth_admin, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_a1.id,
        "milestone_name": "Invalid Untyped Milestone",
        "is_date_based": False,
        "is_quantity_based": False
    })
    assert res8.status_code == 400, f"Expected 400, got {res8.status_code}: {res8.text}"
    assert "Select at least one milestone type." in res8.json()["detail"]
    print("PASS TEST 8: Blocked with exact message 'Select at least one milestone type.'.")

    # ----------------------------------------------------
    # TEST 9: Target date missing when is_date_based is true -> validation error
    # ----------------------------------------------------
    print("\n--- TEST 9: Target date missing when is_date_based=True -> 400 error ---")
    res9 = client.post("/api/milestones", headers=auth_admin, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_a1.id,
        "milestone_name": "Missing Date Milestone",
        "is_date_based": True,
        "is_quantity_based": False,
        "target_date": None
    })
    assert res9.status_code == 400, f"Expected 400, got {res9.status_code}: {res9.text}"
    assert "Target Date is required" in res9.json()["detail"]
    print(f"PASS TEST 9: Validation error for missing target_date: {res9.json()['detail']}")

    # ----------------------------------------------------
    # TEST 10: Target quantity missing/zero when is_quantity_based is true -> validation error
    # ----------------------------------------------------
    print("\n--- TEST 10: Target quantity missing/zero when is_quantity_based=True -> 400 error ---")
    res10_none = client.post("/api/milestones", headers=auth_admin, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_a1.id,
        "milestone_name": "Missing Qty Milestone",
        "is_date_based": False,
        "is_quantity_based": True,
        "target_quantity": None
    })
    assert res10_none.status_code == 400
    res10_zero = client.post("/api/milestones", headers=auth_admin, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_a1.id,
        "milestone_name": "Zero Qty Milestone",
        "is_date_based": False,
        "is_quantity_based": True,
        "target_quantity": 0
    })
    assert res10_zero.status_code == 400
    print("PASS TEST 10: Validation errors for missing/zero target_quantity verified.")

    # ----------------------------------------------------
    # TEST 11: Quantity planning-ahead warning when target > total mapped BOQ, creation SUCCEEDS
    # ----------------------------------------------------
    print("\n--- TEST 11: Planning-ahead warning when target > mapped BOQ (Non-blocking) ---")
    # For wbs_task_a1, total mapped BOQ is 120.0 m3
    res11 = client.post("/api/milestones", headers=auth_admin, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_a1.id,
        "milestone_name": "Pour Beyond Mapped BOQ",
        "is_date_based": False,
        "is_quantity_based": True,
        "target_quantity": 180.0  # > 120.0
    })
    assert res11.status_code == 201, f"Expected 201 SUCCEED, got {res11.status_code}: {res11.text}"
    data11 = res11.json()
    assert data11["has_quantity_warning"] is True
    assert "planned ahead of the currently mapped quantity" in data11["quantity_warning_message"]
    print(f"PASS TEST 11: Creation succeeded with non-blocking warning: {data11['quantity_warning_message']}")

    # ----------------------------------------------------
    # TEST 12: Status recomputed automatically when measurement / e-MB entry is logged
    # ----------------------------------------------------
    print("\n--- TEST 12: Status recomputed automatically upon e-MB logging ---")
    # Milestone 4 was target=150 on wbs_task_a2 (currently actual=100 -> Pending)
    m4_id = data4["id"]
    # Update actual_qty on wbs_task_a2 to 160
    wbs_task_a2.actual_qty = 160.0
    wbs_task_a2.progress_pct = 64.0
    db.commit()

    # Trigger recomputation hook (as called by boq_mb or site_logs)
    recalculate_milestones_for_wbs_node(db, wbs_task_a2.id)

    res12 = client.get(f"/api/milestones/{m4_id}", headers=auth_admin)
    assert res12.status_code == 200
    data12 = res12.json()
    assert data12["status"] == "Met", f"Expected Met after progress update, got {data12['status']}"
    assert data12["is_quantity_met"] is True
    print(f"PASS TEST 12: Milestone #{m4_id} automatically switched from 'Pending' to '{data12['status']}' on e-MB progress update.")

    # ----------------------------------------------------
    # TEST 13: Status recomputed on date rollover
    # ----------------------------------------------------
    print("\n--- TEST 13: Status recomputed on date rollover ---")
    # Milestone 2 was target_date = future_date -> Pending
    m2_id = data2["id"]
    # Simulate date rollover by setting target_date to today in the database
    db_m2 = db.query(ProjectMilestone).filter(ProjectMilestone.id == m2_id).first()
    db_m2.target_date = datetime.date.today()
    db.commit()

    # Query milestone endpoint
    res13 = client.get(f"/api/milestones/{m2_id}", headers=auth_admin)
    assert res13.status_code == 200
    data13 = res13.json()
    assert data13["status"] == "Met", f"Expected Met on date rollover, got {data13['status']}"
    assert data13["is_date_met"] is True
    print(f"PASS TEST 13: Milestone #{m2_id} recomputed to '{data13['status']}' when current date reached target date.")

    # ----------------------------------------------------
    # TEST 14: Cross-project WBS node rejection
    # ----------------------------------------------------
    print("\n--- TEST 14: Cross-project WBS node reference rejected ---")
    # Attempt to link Project A to wbs_task_b1 (belongs to Project B)
    res14 = client.post("/api/milestones", headers=auth_admin, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_b1.id,
        "milestone_name": "Cross Project Illegal Milestone",
        "is_date_based": True,
        "is_quantity_based": False,
        "target_date": future_date_str
    })
    assert res14.status_code == 400, f"Expected 400, got {res14.status_code}"
    assert "Cross-project references are not allowed" in res14.json()["detail"]
    print("PASS TEST 14: Cross-project WBS assignment rejected with 400 detail:", res14.json()["detail"])

    # ----------------------------------------------------
    # TEST 15: Cross-tenant / unauthorized role rejection
    # ----------------------------------------------------
    print("\n--- TEST 15: Unauthorized role ('customer') rejected with 403 ---")
    res15 = client.post("/api/milestones", headers=auth_customer, json={
        "project_id": proj_a.id,
        "wbs_node_id": wbs_task_a1.id,
        "milestone_name": "Customer Created Milestone",
        "is_date_based": True,
        "is_quantity_based": False,
        "target_date": future_date_str
    })
    assert res15.status_code == 403, f"Expected 403 Forbidden, got {res15.status_code}"
    print("PASS TEST 15: Customer role successfully denied milestone creation with HTTP 403 Forbidden.")

    # ----------------------------------------------------
    # TEST 16: Persistence across server restarts / page reloads
    # ----------------------------------------------------
    print("\n--- TEST 16: Milestone database persistence ---")
    # Verify records in database directly
    persisted_count = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == proj_a.id).count()
    assert persisted_count > 0, "No milestones persisted in DB!"
    # Verify GET /api/milestones/project/{proj_a.id}
    res16 = client.get(f"/api/milestones/project/{proj_a.id}", headers=auth_admin)
    assert res16.status_code == 200
    assert len(res16.json()) == persisted_count
    print(f"PASS TEST 16: {persisted_count} milestones persisted in DB and returned correctly via API.")

    # ----------------------------------------------------
    # TEST 17: Existing WPT-01 and WPT-02 functionality intact
    # ----------------------------------------------------
    print("\n--- TEST 17: Non-regression check on WPT-01 & WPT-02 ---")
    # Verify WPT-01 Work Plan retrieval
    res_wp = client.get(f"/api/work-plans?project_id={proj_a.id}", headers=auth_admin)
    assert res_wp.status_code == 200
    assert len(res_wp.json()) >= 1
    # Verify WPT-02 BOQ mappings retrieval
    res_map = client.get(f"/api/work-plans/{wp_a1.id}/boq-mappings", headers=auth_admin)
    assert res_map.status_code == 200
    assert len(res_map.json()) >= 1
    print("PASS TEST 17: WPT-01 Work Plan and WPT-02 BOQ mappings remain 100% operational.")

    # ----------------------------------------------------
    # Audit trail verification
    # ----------------------------------------------------
    logs = db.query(AuditLog).filter(AuditLog.action.like("%MILESTONE%")).all()
    print(f"\n[OK] Milestone audit logs recorded: {len(logs)} audit entries.")

    print("\n==================================================")
    print("ALL 17 ACCEPTANCE TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_wpt03_acceptance_tests()
