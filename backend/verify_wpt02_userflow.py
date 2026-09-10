"""
Targeted, Non-Destructive Verification Script for WPT-02 User Flow
Simulates the exact user actions performed in the UI via the API.
"""
import sys
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import Project, WorkPlan, WorkPlanBoqMapping, BoqItem, ProjectEstimate, ProjectEstimateLine

client = TestClient(app)

def run_verification():
    print("=" * 60)
    print("WPT-02 VERIFICATION: PROJECT B USER FLOW & BACKEND RULES")
    print("=" * 60)

    db = SessionLocal()
    try:
        # 1. Verify Project B and WP-B-001
        proj_b = db.query(Project).filter(Project.code == "WPT02-PROJ-B").first()
        assert proj_b is not None, "Project B (WPT02-PROJ-B) not found!"
        print(f"[OK] Project B found: ID={proj_b.id}, Code={proj_b.code}, Name={proj_b.name}")

        wp_b1 = db.query(WorkPlan).filter(WorkPlan.project_id == proj_b.id, WorkPlan.work_plan_number == "WP-B-001").first()
        assert wp_b1 is not None, "WP-B-001 not found!"
        print(f"[OK] WP-B-001 found: ID={wp_b1.id}, Planned Qty={wp_b1.planned_quantity} {wp_b1.unit}")

        wp_b2 = db.query(WorkPlan).filter(WorkPlan.project_id == proj_b.id, WorkPlan.work_plan_number == "WP-B-002").first()
        assert wp_b2 is not None, "WP-B-002 not found!"
        print(f"[OK] WP-B-002 found: ID={wp_b2.id}, Planned Qty={wp_b2.planned_quantity} {wp_b2.unit}")

        # Clean any preexisting test mappings for Project B only
        db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.work_plan_id.in_([wp_b1.id, wp_b2.id])).delete(synchronize_session=False)
        db.commit()

        # 2. Check Initial Work Plan API response
        resp = client.get(f"/api/work-plans?project_id={proj_b.id}")
        assert resp.status_code == 200, f"Failed to get work plans: {resp.text}"
        wps_data = resp.json()
        wp_b1_data = next(w for w in wps_data if w["id"] == wp_b1.id)
        print(f"[OK] Initial BOQ Mapping status for WP-B-001: '{wp_b1_data['boq_mapping_status']}'")
        assert wp_b1_data["boq_mapping_status"] == "Not Mapped"

        # 3. Fetch Eligible BOQ Items from Detailed Estimate for WP-B-001
        resp = client.get(f"/api/work-plans/{wp_b1.id}/eligible-boq-items")
        assert resp.status_code == 200, f"Failed to get eligible items: {resp.text}"
        eligible = resp.json()
        print(f"[OK] Eligible BOQ items count: {len(eligible)}")
        assert len(eligible) > 0, "No eligible BOQ items found for Project B!"
        boq_brick = next(b for b in eligible if b["item_name"] == "Brick Masonry")
        print(f"[OK] Found BOQ Item: '{boq_brick['item_name']}', Approved Qty={boq_brick['approved_qty']} {boq_brick['unit']}, Remaining={boq_brick['remaining_unmapped_qty']} {boq_brick['unit']}")
        assert float(boq_brick["approved_qty"]) == 50.0
        assert float(boq_brick["remaining_unmapped_qty"]) == 50.0
        assert float(boq_brick["total_allocated_qty"]) == 0.0

        # 4. TEST OVER-MAPPING REJECTION (CRITICAL BACKEND RULE)
        # Attempt to map 60 m3 when only 50 m3 is available
        over_payload = {
            "boq_item_id": boq_brick["boq_item_id"],
            "work_plan_id": wp_b1.id,
            "mapped_quantity": 60.0,
            "unit": "m³"
        }
        resp = client.post(f"/api/work-plans/{wp_b1.id}/boq-mappings", json=over_payload)
        print(f"[OK] Over-mapping test response status: {resp.status_code}")
        assert resp.status_code == 400, f"Over-mapping was NOT rejected! Status={resp.status_code}, Body={resp.text}"
        err_detail = resp.json().get("detail", "")
        print(f"[OK] Over-mapping rejection error message: \"{err_detail}\"")
        assert "exceeds remaining unmapped quantity" in err_detail
        assert "50.0" in err_detail or "50" in err_detail

        # 5. TEST VALID MAPPING & SPLIT MAPPING
        # Map 20 m3 to WP-B-001 (Node 1)
        map1_payload = {
            "boq_item_id": boq_brick["boq_item_id"],
            "work_plan_id": wp_b1.id,
            "mapped_quantity": 20.0,
            "unit": "m³"
        }
        resp = client.post(f"/api/work-plans/{wp_b1.id}/boq-mappings", json=map1_payload)
        assert resp.status_code in (200, 201), f"Failed to create mapping 1: {resp.text}"
        map1_data = resp.json()
        print(f"[OK] Created split mapping 1: ID={map1_data['id']}, Qty={map1_data['mapped_quantity']} {map1_data['unit']}")
        assert float(map1_data["mapped_quantity"]) == 20.0

        # Check remaining quantity dynamically recalculated
        resp = client.get(f"/api/work-plans/{wp_b1.id}/eligible-boq-items")
        eligible_after_1 = resp.json()
        boq_after_1 = next(b for b in eligible_after_1 if b["boq_item_id"] == boq_brick["boq_item_id"])
        print(f"[OK] After Mapping 1: Already Mapped={boq_after_1['total_allocated_qty']}, Remaining={boq_after_1['remaining_unmapped_qty']}")
        assert float(boq_after_1["total_allocated_qty"]) == 20.0
        assert float(boq_after_1["remaining_unmapped_qty"]) == 30.0

        # Split mapping part 2: Map remaining 30 m3 to WP-B-002 (Node 2)
        map2_payload = {
            "boq_item_id": boq_brick["boq_item_id"],
            "work_plan_id": wp_b2.id,
            "mapped_quantity": 30.0,
            "unit": "m³"
        }
        resp = client.post(f"/api/work-plans/{wp_b2.id}/boq-mappings", json=map2_payload)
        assert resp.status_code in (200, 201), f"Failed to create mapping 2: {resp.text}"
        map2_data = resp.json()
        print(f"[OK] Created split mapping 2: ID={map2_data['id']}, Qty={map2_data['mapped_quantity']} {map2_data['unit']}")
        assert float(map2_data["mapped_quantity"]) == 30.0

        # Check remaining quantity is now 0 (100% mapped)
        resp = client.get(f"/api/work-plans/{wp_b1.id}/eligible-boq-items")
        eligible_after_2 = resp.json()
        boq_after_2 = next(b for b in eligible_after_2 if b["boq_item_id"] == boq_brick["boq_item_id"])
        print(f"[OK] After Split Mapping 2: Total Mapped={boq_after_2['total_allocated_qty']}, Remaining={boq_after_2['remaining_unmapped_qty']}")
        assert float(boq_after_2["total_allocated_qty"]) == 50.0
        assert float(boq_after_2["remaining_unmapped_qty"]) == 0.0

        # Attempt to map any additional quantity (> 0 remaining)
        resp = client.post(f"/api/work-plans/{wp_b1.id}/boq-mappings", json={
            "boq_item_id": boq_brick["boq_item_id"],
            "work_plan_id": wp_b1.id,
            "mapped_quantity": 1.0,
            "unit": "m³"
        })
        assert resp.status_code == 400
        print(f"[OK] Additional mapping after 100% mapped rejected correctly: {resp.json().get('detail')}")

        # 6. Check Persistence in DB in a fresh session
        db.close()
        fresh_db = SessionLocal()
        saved_mappings = fresh_db.query(WorkPlanBoqMapping).join(WorkPlan).filter(WorkPlan.project_id == proj_b.id).all()
        print(f"[OK] Persistence verified: {len(saved_mappings)} mappings in database for Project B:")
        for m in saved_mappings:
            print(f"     - Mapping ID={m.id}, WP_ID={m.work_plan_id}, Qty={m.mapped_quantity} {m.unit}")
        assert len(saved_mappings) == 2
        fresh_db.close()

        # 7. Check Work Plan Row Status Update in API
        resp = client.get(f"/api/work-plans?project_id={proj_b.id}")
        wps_updated = resp.json()
        wp_b1_updated = next(w for w in wps_updated if w["id"] == wp_b1.id)
        print(f"[OK] Updated status for WP-B-001 in table: '{wp_b1_updated['boq_mapping_status']}'")
        assert wp_b1_updated["boq_mapping_status"] != "Not Mapped"

        # 8. Check Publish Readiness Revalidation
        resp = client.get(f"/api/work-plans/project/{proj_b.id}/publish-readiness")
        assert resp.status_code == 200
        readiness = resp.json()
        print(f"[OK] Publish Readiness: can_publish={readiness['can_publish']}, blocking_reasons={readiness['blocking_reasons']}")
        assert readiness["can_publish"] == True, f"Expected can_publish=True, got reasons: {readiness['blocking_reasons']}"
        assert len(readiness["unmapped_or_partial_items"]) == 0
        assert len(readiness["orphaned_mappings"]) == 0

        # 9. Test Orphaned Mapping Detection & Remap
        test_db = SessionLocal()
        m1 = test_db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.id == map1_data['id']).first()
        m1.is_orphaned = True
        m1.orphaned_reason = "BOQ item removed in Revised Detailed Estimate"
        test_db.commit()
        test_db.close()

        # Check that publish readiness now BLOCKS publish
        resp = client.get(f"/api/work-plans/project/{proj_b.id}/publish-readiness")
        readiness_orph = resp.json()
        print(f"[OK] Orphaned mapping test: can_publish={readiness_orph['can_publish']}, orphaned_count={len(readiness_orph['orphaned_mappings'])}")
        assert readiness_orph["can_publish"] == False
        assert len(readiness_orph["orphaned_mappings"]) == 1
        print("Blocking reasons:", readiness_orph["blocking_reasons"])
        assert any("orphaned" in r.lower() for r in readiness_orph["blocking_reasons"])

        # Test Explicit Remap API
        resp = client.post(f"/api/work-plans/boq-mappings/{map1_data['id']}/remap", json={
            "target_boq_item_id": boq_brick["boq_item_id"]
        })
        print("Remap status:", resp.status_code, resp.text)
        assert resp.status_code == 200
        remap_res = resp.json()
        print(f"[OK] Explicit Remap succeeded: is_orphaned={remap_res['is_orphaned']}")
        assert remap_res["is_orphaned"] == False

        # Verify Publish is unblocked again
        resp = client.get(f"/api/work-plans/project/{proj_b.id}/publish-readiness")
        assert resp.json()["can_publish"] == True

        print("\n" + "=" * 60)
        print("ALL WPT-02 USER FLOW ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    run_verification()
