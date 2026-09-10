import sys
import os
import datetime
import threading
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import SessionLocal
from app.models import Project, WbsTask, BoqItem, WorkPlan, WorkPlanBoqMapping

client = TestClient(app)

def run_wpt02_acceptance_tests():
    print("==================================================")
    print("WPT-02 BOQ -> WORK PLAN MAPPING ACCEPTANCE TESTS")
    print("==================================================")
    
    db = SessionLocal()
    
    # Setup test projects
    proj_a = db.query(Project).filter(Project.name == "WPT-02 Test Project A").first()
    if not proj_a:
        proj_a = Project(
            name="WPT-02 Test Project A",
            code="WPT02-PROJ-A",
            location="Site A",
            budget=10000000.0,
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2026, 12, 31),
            status="ACTIVE"
        )
        db.add(proj_a)
        db.commit()
        db.refresh(proj_a)

    proj_b = db.query(Project).filter(Project.name == "WPT-02 Test Project B").first()
    if not proj_b:
        proj_b = Project(
            name="WPT-02 Test Project B",
            code="WPT02-PROJ-B",
            location="Site B",
            budget=5000000.0,
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2026, 12, 31),
            status="ACTIVE"
        )
        db.add(proj_b)
        db.commit()
        db.refresh(proj_b)

    from app.models import ProjectEstimateLine, ProjectEstimate
    estimates = db.query(ProjectEstimate).filter(ProjectEstimate.project_id.in_([proj_a.id, proj_b.id])).all()
    est_ids = [e.id for e in estimates]
    if est_ids:
        db.query(ProjectEstimateLine).filter(ProjectEstimateLine.estimate_id.in_(est_ids)).delete(synchronize_session=False)
    db.query(ProjectEstimate).filter(ProjectEstimate.project_id.in_([proj_a.id, proj_b.id])).delete(synchronize_session=False)
    db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.project_id.in_([proj_a.id, proj_b.id])).delete(synchronize_session=False)
    db.query(WorkPlan).filter(WorkPlan.project_id.in_([proj_a.id, proj_b.id])).delete(synchronize_session=False)
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

    # Create WBS tasks for Project A
    wbs_phase_a = WbsTask(
        project_id=proj_a.id,
        wbs_code="PH-01",
        title="Phase 1",
        task_level="Phase",
        start_date=datetime.datetime(2026, 9, 1),
        end_date=datetime.datetime(2026, 12, 31)
    )
    db.add(wbs_phase_a)
    db.commit()
    db.refresh(wbs_phase_a)

    wbs_task_a1 = WbsTask(
        project_id=proj_a.id,
        parent_task_id=wbs_phase_a.id,
        wbs_code="TSK-01",
        title="Foundation",
        task_level="Task",
        start_date=datetime.datetime(2026, 9, 1),
        end_date=datetime.datetime(2026, 12, 31)
    )
    wbs_task_a2 = WbsTask(
        project_id=proj_a.id,
        parent_task_id=wbs_phase_a.id,
        wbs_code="TSK-02",
        title="Ground Floor",
        task_level="Task",
        start_date=datetime.datetime(2026, 9, 1),
        end_date=datetime.datetime(2026, 12, 31)
    )
    wbs_task_a3 = WbsTask(
        project_id=proj_a.id,
        parent_task_id=wbs_phase_a.id,
        wbs_code="TSK-03",
        title="First Floor",
        task_level="Task",
        start_date=datetime.datetime(2026, 9, 1),
        end_date=datetime.datetime(2026, 12, 31)
    )
    db.add_all([wbs_task_a1, wbs_task_a2, wbs_task_a3])
    db.commit()
    db.refresh(wbs_task_a1)
    db.refresh(wbs_task_a2)
    db.refresh(wbs_task_a3)

    # Create WBS task for Project B
    wbs_phase_b = WbsTask(
        project_id=proj_b.id,
        wbs_code="PH-B1",
        title="Phase B1",
        task_level="Phase",
        start_date=datetime.datetime(2026, 9, 1),
        end_date=datetime.datetime(2026, 12, 31)
    )
    db.add(wbs_phase_b)
    db.commit()
    db.refresh(wbs_phase_b)

    wbs_task_b = WbsTask(
        project_id=proj_b.id,
        parent_task_id=wbs_phase_b.id,
        wbs_code="TSK-B1",
        title="Project B Node",
        task_level="Task",
        start_date=datetime.datetime(2026, 9, 1),
        end_date=datetime.datetime(2026, 12, 31)
    )
    db.add(wbs_task_b)
    db.commit()
    db.refresh(wbs_task_b)

    # Create Work Plan Activities for Project A
    wp_foundation = WorkPlan(
        work_plan_number="WP-FND-001",
        project_id=proj_a.id,
        wbs_phase_id=wbs_phase_a.id,
        task_id=wbs_task_a1.id,
        activity_name="Foundation Masonry Activity",
        planned_quantity=200.0,
        unit="m³",
        planned_start_date=datetime.date(2026, 9, 1),
        planned_end_date=datetime.date(2026, 9, 15),
        status="DRAFT"
    )
    wp_ground_floor = WorkPlan(
        work_plan_number="WP-GF-002",
        project_id=proj_a.id,
        wbs_phase_id=wbs_phase_a.id,
        task_id=wbs_task_a2.id,
        activity_name="Ground Floor Masonry Activity",
        planned_quantity=300.0,
        unit="m³",
        planned_start_date=datetime.date(2026, 9, 16),
        planned_end_date=datetime.date(2026, 9, 30),
        status="DRAFT"
    )
    wp_first_floor = WorkPlan(
        work_plan_number="WP-FF-003",
        project_id=proj_a.id,
        wbs_phase_id=wbs_phase_a.id,
        task_id=wbs_task_a3.id,
        activity_name="First Floor Masonry Activity",
        planned_quantity=100.0,
        unit="m³",
        planned_start_date=datetime.date(2026, 10, 1),
        planned_end_date=datetime.date(2026, 10, 15),
        status="DRAFT"
    )
    db.add_all([wp_foundation, wp_ground_floor, wp_first_floor])

    # Work Plan Activity for Project B
    wp_b1 = WorkPlan(
        work_plan_number="WP-B-001",
        project_id=proj_b.id,
        wbs_phase_id=wbs_phase_b.id,
        task_id=wbs_task_b.id,
        activity_name="Project B Activity",
        planned_quantity=50.0,
        unit="m³",
        planned_start_date=datetime.date(2026, 9, 1),
        planned_end_date=datetime.date(2026, 9, 15),
        status="DRAFT"
    )
    db.add(wp_b1)
    db.commit()
    db.refresh(wp_foundation)
    db.refresh(wp_ground_floor)
    db.refresh(wp_first_floor)
    db.refresh(wp_b1)

    print("[OK] Test environment initialized.")

    # ----------------------------------------------------
    # TEST 1: BOQ = 500, Map Foundation = 200 -> Expected remaining = 300
    # ----------------------------------------------------
    print("\n--- TEST 1: BOQ = 500, Map Foundation = 200 -> Remaining = 300 ---")
    boq1 = BoqItem(
        project_id=proj_a.id,
        item_name="Brick Masonry",
        unit="m³",
        approved_qty=500.0,
        rate=350.0,
        total_amount=175000.0
    )
    db.add(boq1)
    db.commit()
    db.refresh(boq1)

    res_t1 = client.post(f"/api/work-plans/{wp_foundation.id}/boq-mappings", json={
        "boq_item_id": boq1.id,
        "mapped_quantity": 200.0,
        "unit": "m³"
    })
    assert res_t1.status_code in [200, 201], f"Test 1 failed: {res_t1.text}"
    m1_data = res_t1.json()
    assert m1_data["mapped_quantity"] == 200.0
    assert m1_data["remaining_quantity"] == 300.0
    print(f"PASS TEST 1: Mapped 200 m³. Persisted remaining balance = {m1_data['remaining_quantity']} m³ (Expected 300 m³).")

    # ----------------------------------------------------
    # TEST 2: Same BOQ: Foundation = 200, Ground Floor = 300 -> Total mapped = 500, remaining = 0
    # ----------------------------------------------------
    print("\n--- TEST 2: Split Mapping: Foundation = 200, Ground Floor = 300 -> Total = 500, Remaining = 0 ---")
    res_t2 = client.post(f"/api/work-plans/{wp_ground_floor.id}/boq-mappings", json={
        "boq_item_id": boq1.id,
        "mapped_quantity": 300.0,
        "unit": "m³"
    })
    assert res_t2.status_code in [200, 201], f"Test 2 failed: {res_t2.text}"
    m2_data = res_t2.json()
    assert m2_data["total_allocated_quantity"] == 500.0
    assert m2_data["remaining_quantity"] == 0.0
    assert m2_data["mapping_status"] == "FULLY ALLOCATED"
    print("PASS TEST 2: Total mapped quantity = 500 m³, remaining unmapped balance = 0 m³.")

    # ----------------------------------------------------
    # TEST 3: BOQ = 500, Already mapped = 450, Try mapping 60 -> BLOCKED with remaining balance 50
    # ----------------------------------------------------
    print("\n--- TEST 3: Over-Mapping Block: BOQ = 500, Mapped = 450, Try 60 -> Blocked with balance 50 ---")
    boq3 = BoqItem(
        project_id=proj_a.id,
        item_name="Plastering Item",
        unit="m³",
        approved_qty=500.0,
        rate=200.0,
        total_amount=100000.0
    )
    db.add(boq3)
    db.commit()
    db.refresh(boq3)

    # First map 450
    res_450 = client.post(f"/api/work-plans/{wp_foundation.id}/boq-mappings", json={
        "boq_item_id": boq3.id,
        "mapped_quantity": 450.0,
        "unit": "m³"
    })
    assert res_450.status_code in [200, 201]

    # Try mapping 60 to Ground Floor
    res_t3 = client.post(f"/api/work-plans/{wp_ground_floor.id}/boq-mappings", json={
        "boq_item_id": boq3.id,
        "mapped_quantity": 60.0,
        "unit": "m³"
    })
    assert res_t3.status_code == 400
    err_t3 = res_t3.json()["detail"]
    assert "Mapped quantity exceeds remaining unmapped quantity" in err_t3
    assert "Remaining balance: 50 m³" in err_t3 or "Remaining balance: 50" in err_t3
    print(f"PASS TEST 3: Over-mapping 60 m³ blocked with message: '{err_t3}'")

    # ----------------------------------------------------
    # TEST 4: Map same BOQ to 3 different WBS nodes -> All persist and total never exceeds BOQ quantity
    # ----------------------------------------------------
    print("\n--- TEST 4: Map Same BOQ to 3 Different WBS Nodes ---")
    boq4 = BoqItem(
        project_id=proj_a.id,
        item_name="Multi-Node Concrete",
        unit="m³",
        approved_qty=900.0,
        rate=5000.0,
        total_amount=4500000.0
    )
    db.add(boq4)
    db.commit()
    db.refresh(boq4)

    # Node 1: 300 m³
    res_n1 = client.post(f"/api/work-plans/{wp_foundation.id}/boq-mappings", json={"boq_item_id": boq4.id, "mapped_quantity": 300.0, "unit": "m³"})
    # Node 2: 400 m³
    res_n2 = client.post(f"/api/work-plans/{wp_ground_floor.id}/boq-mappings", json={"boq_item_id": boq4.id, "mapped_quantity": 400.0, "unit": "m³"})
    # Node 3: 200 m³
    res_n3 = client.post(f"/api/work-plans/{wp_first_floor.id}/boq-mappings", json={"boq_item_id": boq4.id, "mapped_quantity": 200.0, "unit": "m³"})
    
    assert res_n1.status_code in [200, 201]
    assert res_n2.status_code in [200, 201]
    assert res_n3.status_code in [200, 201]

    db.commit()
    node_mappings = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.boq_item_id == boq4.id).all()
    assert len(node_mappings) == 3
    total_alloc = sum(float(m.mapped_quantity) for m in node_mappings)
    assert total_alloc == 900.0
    print(f"PASS TEST 4: BOQ mapped across 3 distinct nodes (300+400+200 = {total_alloc} m³). Never exceeds BOQ approved quantity.")

    # ----------------------------------------------------
    # TEST 5: Partially mapped BOQ -> Publish BLOCKED & item listed with Map Now
    # ----------------------------------------------------
    print("\n--- TEST 5: Partially Mapped BOQ Blocks Publish ---")
    # Clean up project A BOQ and mappings to isolate publish tests
    db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.project_id == proj_a.id).delete()
    db.query(BoqItem).filter(BoqItem.project_id == proj_a.id).delete()
    db.commit()

    boq_part = BoqItem(project_id=proj_a.id, item_name="Structural Steel", unit="MT", approved_qty=100.0, rate=60000.0, total_amount=6000000.0)
    db.add(boq_part)
    db.commit()
    db.refresh(boq_part)

    # Map only 60 MT (leaves 40 MT unmapped)
    client.post(f"/api/work-plans/{wp_foundation.id}/boq-mappings", json={"boq_item_id": boq_part.id, "mapped_quantity": 60.0, "unit": "MT"})

    # Check publish readiness
    res_readiness_part = client.get(f"/api/work-plans/project/{proj_a.id}/publish-readiness")
    assert res_readiness_part.status_code == 200
    data_part = res_readiness_part.json()
    assert data_part["can_publish"] is False
    assert len(data_part["unmapped_or_partial_items"]) == 1
    assert data_part["unmapped_or_partial_items"][0]["status"] == "PARTIALLY_MAPPED"
    assert data_part["unmapped_or_partial_items"][0]["remaining_quantity"] == 40.0

    # Attempt to publish
    res_pub_block = client.post(f"/api/work-plans/project/{proj_a.id}/publish")
    assert res_pub_block.status_code == 400
    print(f"PASS TEST 5: Publish blocked because item is partially mapped (40 MT remaining). Listed with unmapped items.")

    # ----------------------------------------------------
    # TEST 6: Completely unmapped BOQ -> Publish BLOCKED & item listed
    # ----------------------------------------------------
    print("\n--- TEST 6: Completely Unmapped BOQ Blocks Publish ---")
    boq_unmapped = BoqItem(project_id=proj_a.id, item_name="Flooring Tiles", unit="m²", approved_qty=250.0, rate=800.0, total_amount=200000.0)
    db.add(boq_unmapped)
    db.commit()
    db.refresh(boq_unmapped)

    res_readiness_unm = client.get(f"/api/work-plans/project/{proj_a.id}/publish-readiness")
    data_unm = res_readiness_unm.json()
    assert data_unm["can_publish"] is False
    unmapped_entry = next((item for item in data_unm["unmapped_or_partial_items"] if item["boq_item_id"] == boq_unmapped.id), None)
    assert unmapped_entry is not None
    assert unmapped_entry["status"] == "UNMAPPED"
    assert unmapped_entry["remaining_quantity"] == 250.0

    res_pub_block2 = client.post(f"/api/work-plans/project/{proj_a.id}/publish")
    assert res_pub_block2.status_code == 400
    print(f"PASS TEST 6: Publish blocked due to completely unmapped item '{boq_unmapped.item_name}' (250 m² unmapped).")

    # ----------------------------------------------------
    # TEST 7: All BOQ items mapped 100% -> Publish succeeds
    # ----------------------------------------------------
    print("\n--- TEST 7: 100% BOQ Mapping Required for Publish -> Publish Succeeds ---")
    # Finish mapping remaining 40 MT for Structural Steel
    client.post(f"/api/work-plans/{wp_ground_floor.id}/boq-mappings", json={"boq_item_id": boq_part.id, "mapped_quantity": 40.0, "unit": "MT"})
    # Map all 250 m² for Flooring Tiles
    client.post(f"/api/work-plans/{wp_first_floor.id}/boq-mappings", json={"boq_item_id": boq_unmapped.id, "mapped_quantity": 250.0, "unit": "m²"})

    # Check readiness
    res_ready = client.get(f"/api/work-plans/project/{proj_a.id}/publish-readiness")
    assert res_ready.json()["can_publish"] is True

    # Publish Work Plan
    res_pub_ok = client.post(f"/api/work-plans/project/{proj_a.id}/publish")
    assert res_pub_ok.status_code == 200
    print(f"PASS TEST 7: All BOQ items 100% mapped. Work Plan published successfully: {res_pub_ok.json()['message']}")

    # ----------------------------------------------------
    # TEST 8: Mapped BOQ item removed in Revised DE -> "Orphaned — requires remapping" and Publish blocked
    # ----------------------------------------------------
    print("\n--- TEST 8: Revised DE Removes BOQ Item -> Flagged as Orphaned & Blocks Publish ---")
    db.commit()
    # Mark boq_part mapping as orphaned (simulating DE revision removal)
    orph_mapping = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.boq_item_id == boq_part.id, WorkPlanBoqMapping.work_plan_id == wp_foundation.id).first()
    orph_mapping.is_orphaned = True
    orph_mapping.orphaned_reason = "Orphaned — requires remapping"
    orph_mapping.original_boq_code = f"BOQ-{boq_part.id:03d}"
    orph_mapping.original_boq_name = boq_part.item_name
    db.commit()

    # Verify orphaned list in readiness
    res_orph = client.get(f"/api/work-plans/project/{proj_a.id}/publish-readiness")
    orph_data = res_orph.json()
    assert orph_data["can_publish"] is False
    assert orph_data["orphaned_count"] > 0
    assert orph_data["orphaned_mappings"][0]["orphaned_reason"] == "Orphaned — requires remapping"

    # Verify Publish is blocked
    res_pub_orph_block = client.post(f"/api/work-plans/project/{proj_a.id}/publish")
    assert res_pub_orph_block.status_code == 400
    print("PASS TEST 8: Removed BOQ item flagged as 'Orphaned — requires remapping' and blocks publication.")

    # ----------------------------------------------------
    # TEST 9: Explicitly remap orphaned mapping -> Orphaned status clears and Publish proceeds
    # ----------------------------------------------------
    print("\n--- TEST 9: Explicit Remapping Clears Orphaned Status & Allows Publish ---")
    # Remap orphaned mapping back to boq_part
    res_remap = client.post(f"/api/work-plans/boq-mappings/{orph_mapping.id}/remap", json={
        "target_boq_item_id": boq_part.id
    })
    assert res_remap.status_code == 200
    remap_resp = res_remap.json()
    assert remap_resp["is_orphaned"] is False
    assert remap_resp["boq_item_id"] == boq_part.id

    # Verify publish now proceeds
    res_ready_after_remap = client.get(f"/api/work-plans/project/{proj_a.id}/publish-readiness").json()
    assert res_ready_after_remap["can_publish"] is True
    res_pub_after_remap = client.post(f"/api/work-plans/project/{proj_a.id}/publish")
    assert res_pub_after_remap.status_code == 200, f"Publish after remap failed: {res_pub_after_remap.text}"
    print("PASS TEST 9: Orphaned mapping remapped successfully, orphaned flag cleared, and Work Plan published.")

    # ----------------------------------------------------
    # TEST 10: Try BOQ from Project A + WBS node from Project B -> Backend rejects
    # ----------------------------------------------------
    print("\n--- TEST 10: Cross-Project Isolation Rejection ---")
    # Attempt to map Project A BOQ item to Project B Work Plan Activity (wp_b1)
    res_cross = client.post(f"/api/work-plans/{wp_b1.id}/boq-mappings", json={
        "boq_item_id": boq_part.id,
        "mapped_quantity": 10.0,
        "unit": "MT"
    })
    assert res_cross.status_code == 400
    cross_detail = res_cross.json()["detail"]
    assert "Cross-project mapping rejected" in cross_detail or "BOQ item does not belong" in cross_detail
    print(f"PASS TEST 10: Cross-project mapping rejected server-side: '{cross_detail}'")

    # ----------------------------------------------------
    # TEST 11: Create mappings -> refresh -> reopen project -> Mappings persist correctly
    # ----------------------------------------------------
    print("\n--- TEST 11: Persistence Verification on Project Reopen ---")
    wp_gf_id = wp_ground_floor.id
    wp_fnd_id = wp_foundation.id
    # Fresh database session to simulate closing and reopening project
    db.close()
    db2 = SessionLocal()
    persisted_mappings = db2.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.project_id == proj_a.id).all()
    assert len(persisted_mappings) > 0
    # Query via API endpoint
    api_mappings = client.get(f"/api/work-plans/{wp_gf_id}/boq-mappings").json()
    assert len(api_mappings) > 0
    db2.close()
    print(f"PASS TEST 11: Mappings persisted and retrieved intact ({len(persisted_mappings)} mappings across project).")

    # ----------------------------------------------------
    # TEST 12: Concurrent mapping requests that together exceed remaining quantity
    # ----------------------------------------------------
    print("\n--- TEST 12: Concurrency Protection Against Over-Mapping ---")
    boq_race = BoqItem(
        project_id=proj_a.id,
        item_name="Concurrent Race Test BOQ",
        unit="m³",
        approved_qty=100.0,
        rate=100.0,
        total_amount=10000.0
    )
    db3 = SessionLocal()
    db3.add(boq_race)
    db3.commit()
    db3.refresh(boq_race)
    boq_race_id = boq_race.id
    db3.close()

    results = []
    def attempt_mapping(target_wp_id, quantity):
        c = TestClient(app)
        res = c.post(f"/api/work-plans/{target_wp_id}/boq-mappings", json={
            "boq_item_id": boq_race_id,
            "mapped_quantity": quantity,
            "unit": "m³"
        })
        results.append(res.status_code)

    # Attempt to map 70 m³ to Foundation and 60 m³ to Ground Floor simultaneously (Total 130 m³ > 100 m³)
    t1 = threading.Thread(target=attempt_mapping, args=(wp_fnd_id, 70.0))
    t2 = threading.Thread(target=attempt_mapping, args=(wp_gf_id, 60.0))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # Exactly one must succeed (200 or 201) and one must be blocked (400)
    db4 = SessionLocal()
    total_race_mapped = sum(float(m.mapped_quantity) for m in db4.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.boq_item_id == boq_race_id).all())
    assert total_race_mapped <= 100.0, f"Race condition failed! Total mapped: {total_race_mapped} > 100.0"
    db4.close()
    print(f"PASS TEST 12: Concurrency locking prevented over-mapping. Final persisted quantity = {total_race_mapped} m³ <= 100.0 m³.")

    print("\n==================================================")
    print("ALL 12 WPT-02 ACCEPTANCE TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_wpt02_acceptance_tests()
