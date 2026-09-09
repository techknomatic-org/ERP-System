import sys
import os
import datetime
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import SessionLocal
from app.models import Project, WbsTask, BoqItem

client = TestClient(app)

def run_wpt01_acceptance_tests():
    print("==================================================")
    print("WPT-01 WORK PLAN / WBS CREATION ACCEPTANCE TESTS")
    print("==================================================")
    
    db = SessionLocal()
    
    # Setup test project and test BOQ items
    proj = db.query(Project).filter(Project.name == "WPT-01 Test Project").first()
    if not proj:
        proj = Project(
            name="WPT-01 Test Project",
            code="WPT01-PROJ",
            location="Test Site",
            budget=5000000.0,
            start_date=datetime.datetime(2026, 9, 1),
            end_date=datetime.datetime(2026, 12, 31),
            status="ACTIVE"
        )
        db.add(proj)
        db.commit()
        db.refresh(proj)
    
    # Cleanup existing tasks for this project safely
    tasks = db.query(WbsTask).filter(WbsTask.project_id == proj.id).all()
    for t in tasks:
        t.parent_task_id = None
    db.commit()
    for t in tasks:
        db.delete(t)
    db.commit()

    # Create dummy project 2 for project isolation test
    proj2 = db.query(Project).filter(Project.name == "WPT-01 Isol Project").first()
    if not proj2:
        proj2 = Project(
            name="WPT-01 Isol Project",
            code="WPT01-ISOL",
            location="Test Site 2",
            budget=2000000.0,
            start_date=datetime.datetime(2026, 9, 1),
            end_date=datetime.datetime(2026, 12, 31),
            status="ACTIVE"
        )
        db.add(proj2)
        db.commit()
        db.refresh(proj2)

    # Create BOQ items for proj and proj2
    boq1 = db.query(BoqItem).filter(BoqItem.project_id == proj.id, BoqItem.item_name == "Earthwork BOQ").first()
    if not boq1:
        boq1 = BoqItem(
            project_id=proj.id,
            item_name="Earthwork BOQ",
            unit="M3",
            approved_qty=1000.0,
            rate=150.0,
            total_amount=150000.0
        )
        db.add(boq1)
        db.commit()
        db.refresh(boq1)

    boq2 = db.query(BoqItem).filter(BoqItem.project_id == proj.id, BoqItem.item_name == "Concrete BOQ").first()
    if not boq2:
        boq2 = BoqItem(
            project_id=proj.id,
            item_name="Concrete BOQ",
            unit="M3",
            approved_qty=500.0,
            rate=4500.0,
            total_amount=2250000.0
        )
        db.add(boq2)
        db.commit()
        db.refresh(boq2)

    boq_other = db.query(BoqItem).filter(BoqItem.project_id == proj2.id, BoqItem.item_name == "Other Project BOQ").first()
    if not boq_other:
        boq_other = BoqItem(
            project_id=proj2.id,
            item_name="Other Project BOQ",
            unit="M3",
            approved_qty=100.0,
            rate=2000.0,
            total_amount=200000.0
        )
        db.add(boq_other)
        db.commit()
        db.refresh(boq_other)

    test_results = {}

    # TEST 1 — Create top-level Phase
    res1 = client.post("/api/wbs/tasks", json={
        "project_id": proj.id,
        "title": "Foundation",
        "parent_task_id": None,
        "node_type": "Phase",
        "start_date": "2026-09-01T00:00:00",
        "end_date": "2026-09-30T00:00:00"
    })
    if res1.status_code == 200 and res1.json().get("title") == "Foundation" and res1.json().get("parent_task_id") is None:
        test_results["TEST 1"] = "PASS"
        phase_id = res1.json()["id"]
        print("[PASS] TEST 1 — Create top-level Phase")
    else:
        test_results["TEST 1"] = f"FAIL ({res1.status_code}: {res1.text})"
        print(f"[FAIL] TEST 1 — {res1.text}")
        phase_id = None

    # TEST 2 — Create child Activity (with ISO timezone dates as sent by frontend)
    res2 = client.post("/api/wbs/tasks", json={
        "project_id": proj.id,
        "title": "Excavation Test",
        "parent_task_id": phase_id,
        "node_type": "Activity",
        "start_date": "2026-09-05T00:00:00.000Z",
        "end_date": "2026-09-25T00:00:00.000Z"
    })
    if res2.status_code == 200 and res2.json().get("parent_task_id") == phase_id:
        test_results["TEST 2"] = "PASS"
        activity_id = res2.json()["id"]
        print("[PASS] TEST 2 — Create child Activity")
    else:
        test_results["TEST 2"] = f"FAIL ({res2.status_code}: {res2.text})"
        print(f"[FAIL] TEST 2 — {res2.text}")
        activity_id = None

    # TEST 3 — Create Task
    res3 = client.post("/api/wbs/tasks", json={
        "project_id": proj.id,
        "title": "Shoring & Trenching",
        "parent_task_id": activity_id,
        "node_type": "Task",
        "start_date": "2026-09-06T00:00:00",
        "end_date": "2026-09-18T00:00:00"
    })
    if res3.status_code == 200 and res3.json().get("parent_task_id") == activity_id:
        test_results["TEST 3"] = "PASS"
        task_id = res3.json()["id"]
        print("[PASS] TEST 3 — Create Task under Activity")
    else:
        test_results["TEST 3"] = f"FAIL ({res3.status_code}: {res3.text})"
        print(f"[FAIL] TEST 3 — {res3.text}")
        task_id = None

    # TEST 4 — Child outside parent dates
    res4 = client.post("/api/wbs/tasks", json={
        "project_id": proj.id,
        "title": "Invalid Date Child",
        "parent_task_id": phase_id,
        "node_type": "Activity",
        "start_date": "2026-09-05T00:00:00",
        "end_date": "2026-10-05T00:00:00"  # End date is after parent end date (2026-09-30)
    })
    if res4.status_code == 400 and "Child date range must fall within the parent's planned date range." in res4.text:
        test_results["TEST 4"] = "PASS"
        print("[PASS] TEST 4 — Child outside parent dates blocked with expected message")
    else:
        test_results["TEST 4"] = f"FAIL ({res4.status_code}: {res4.text})"
        print(f"[FAIL] TEST 4 — {res4.text}")

    # TEST 5 — Circular reference
    # Attempt putting Phase under Task (Foundation parent_task_id = task_id)
    res5 = client.put(f"/api/wbs/tasks/{phase_id}", json={
        "parent_task_id": task_id
    })
    if res5.status_code == 400 and "Circular parent assignment is not allowed." in res5.text:
        test_results["TEST 5"] = "PASS"
        print("[PASS] TEST 5 — Circular reference blocked with expected error")
    else:
        test_results["TEST 5"] = f"FAIL ({res5.status_code}: {res5.text})"
        print(f"[FAIL] TEST 5 — {res5.text}")

    # TEST 6 — Delete parent with children
    res6 = client.delete(f"/api/wbs/tasks/{phase_id}")
    if res6.status_code == 400 and "Reassign or delete child nodes first." in res6.text:
        test_results["TEST 6"] = "PASS"
        print("[PASS] TEST 6 — Delete parent with children blocked with exact message")
    else:
        test_results["TEST 6"] = f"FAIL ({res6.status_code}: {res6.text})"
        print(f"[FAIL] TEST 6 — {res6.text}")

    # TEST 7 — Create without BOQ
    res7 = client.post("/api/wbs/tasks", json={
        "project_id": proj.id,
        "title": "Piling Work",
        "parent_task_id": phase_id,
        "node_type": "Activity",
        "start_date": "2026-09-20T00:00:00",
        "end_date": "2026-09-28T00:00:00",
        "boq_item_id": None
    })
    if res7.status_code == 200:
        test_results["TEST 7"] = "PASS"
        piling_id = res7.json()["id"]
        print("[PASS] TEST 7 — Create node without BOQ succeeds")
    else:
        test_results["TEST 7"] = f"FAIL ({res7.status_code}: {res7.text})"
        print(f"[FAIL] TEST 7 — {res7.text}")

    # TEST 8 — Publish with missing BOQ
    res8 = client.post(f"/api/wbs/project/{proj.id}/publish")
    if res8.status_code == 400 and "Cannot publish Work Plan. BOQ Reference is missing" in res8.text:
        test_results["TEST 8"] = "PASS"
        print("[PASS] TEST 8 — Publish blocked when nodes lack BOQ Reference")
    else:
        test_results["TEST 8"] = f"FAIL ({res8.status_code}: {res8.text})"
        print(f"[FAIL] TEST 8 — {res8.text}")

    # TEST 9 — Publish with all BOQ references
    # Assign BOQ references to all nodes
    client.put(f"/api/wbs/tasks/{phase_id}", json={"boq_item_id": boq1.id})
    client.put(f"/api/wbs/tasks/{activity_id}", json={"boq_item_id": boq1.id})
    client.put(f"/api/wbs/tasks/{task_id}", json={"boq_item_id": boq2.id})
    client.put(f"/api/wbs/tasks/{piling_id}", json={"boq_item_id": boq2.id})

    res9 = client.post(f"/api/wbs/project/{proj.id}/publish")
    if res9.status_code == 200 and "published successfully" in res9.json().get("message", ""):
        test_results["TEST 9"] = "PASS"
        print("[PASS] TEST 9 — Publish succeeds when all nodes have BOQ references")
    else:
        test_results["TEST 9"] = f"FAIL ({res9.status_code}: {res9.text})"
        print(f"[FAIL] TEST 9 — {res9.text}")

    # TEST 10 — BOQ project isolation
    res10 = client.post("/api/wbs/tasks", json={
        "project_id": proj.id,
        "title": "Cross Project Node",
        "parent_task_id": phase_id,
        "node_type": "Activity",
        "start_date": "2026-09-22T00:00:00",
        "end_date": "2026-09-25T00:00:00",
        "boq_item_id": boq_other.id  # Belongs to proj2!
    })
    if res10.status_code == 400 and "Selected BOQ item does not belong to this project." in res10.text:
        test_results["TEST 10"] = "PASS"
        print("[PASS] TEST 10 — BOQ project isolation enforced")
    else:
        test_results["TEST 10"] = f"FAIL ({res10.status_code}: {res10.text})"
        print(f"[FAIL] TEST 10 — {res10.text}")

    # TEST 11 — Direct API circular-reference attempt
    res11 = client.put(f"/api/wbs/tasks/{activity_id}", json={
        "parent_task_id": task_id
    })
    if res11.status_code == 400 and "Circular parent assignment is not allowed." in res11.text:
        test_results["TEST 11"] = "PASS"
        print("[PASS] TEST 11 — Direct API circular reference rejected")
    else:
        test_results["TEST 11"] = f"FAIL ({res11.status_code}: {res11.text})"
        print(f"[FAIL] TEST 11 — {res11.text}")

    # TEST 12 — Direct API publish bypass
    # Add a new unlinked node to proj and attempt publish
    res_unlinked = client.post("/api/wbs/tasks", json={
        "project_id": proj.id,
        "title": "Unlinked Node",
        "parent_task_id": phase_id,
        "node_type": "Activity",
        "start_date": "2026-09-25T00:00:00",
        "end_date": "2026-09-29T00:00:00"
    })
    unlinked_id = res_unlinked.json().get("id")

    res12 = client.post(f"/api/wbs/project/{proj.id}/publish")
    if res12.status_code == 400 and "Unlinked Node" in res12.text:
        test_results["TEST 12"] = "PASS"
        print("[PASS] TEST 12 — Direct API publish bypass blocked")
    else:
        test_results["TEST 12"] = f"FAIL ({res12.status_code}: {res12.text})"
        print(f"[FAIL] TEST 12 — {res12.text}")

    # Clean up unlinked node
    if unlinked_id:
        client.delete(f"/api/wbs/tasks/{unlinked_id}")

    # TEST 13 — Regression test
    res13_wbs = client.get(f"/api/wbs/project/{proj.id}")
    res13_proj = client.get(f"/api/projects/{proj.id}")
    if res13_wbs.status_code == 200 and res13_proj.status_code == 200:
        test_results["TEST 13"] = "PASS"
        print("[PASS] TEST 13 — Regression check passed cleanly")
    else:
        test_results["TEST 13"] = f"FAIL (WBS: {res13_wbs.status_code}, Proj: {res13_proj.status_code})"
        print(f"[FAIL] TEST 13 — WBS: {res13_wbs.status_code}, Proj: {res13_proj.status_code}")

    db.close()

    print("\n==================================================")
    print("SUMMARY OF ACCEPTANCE TESTS")
    print("==================================================")
    all_passed = True
    for test, result in test_results.items():
        print(f"{test}: {result}")
        if not result.startswith("PASS"):
            all_passed = False
    print("==================================================")
    return all_passed

if __name__ == "__main__":
    success = run_wpt01_acceptance_tests()
    sys.exit(0 if success else 1)
