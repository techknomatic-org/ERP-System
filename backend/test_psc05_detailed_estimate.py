import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models import (
    Base, Project, BoqItem, ScheduleOfRates, ProjectEstimate, ProjectEstimateLine
)
from app.api.estimation import (
    build_estimate_response, get_or_create_estimate_for_project,
    save_estimate, submit_estimate_for_review, approve_technical_sanction,
    create_revised_estimate
)
from app.api.boq_mb import update_boq_item
from app.schemas import EstimateSaveRequest, EstimateLineSaveInput, BoqItemUpdate
from fastapi import HTTPException

def run_tests():
    print("==========================================================")
    print("RUNNING COMPREHENSIVE PSC-05 DETAILED ESTIMATE SUITE")
    print("==========================================================")

    db = SessionLocal()

    try:
        # Create test project
        test_project = Project(
            code=f"PSC05-PROJ-{int(datetime.utcnow().timestamp())}",
            name="PSC-05 Test Project",
            location="Mumbai, MH",
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow(),
            budget=10000000.0,
            status="ACTIVE"
        )
        db.add(test_project)
        db.commit()
        db.refresh(test_project)
        proj_id = test_project.id
        print(f"[+] Created Test Project #{proj_id}")

        # Create SOR Items
        sor_concrete = ScheduleOfRates(
            sor_code=f"SOR-CONC-{int(datetime.utcnow().timestamp())}",
            description="Foundation Concrete RCC M30",
            category="Concrete",
            unit="m³",
            base_rate=8500.0,
            cost_index=1.0,
            rate=8500.0,
            effective_from=datetime.utcnow(),
            status="Active"
        )
        sor_steel = ScheduleOfRates(
            sor_code=f"SOR-STEEL-{int(datetime.utcnow().timestamp())}",
            description="Reinforcement Steel Fe500",
            category="Steel",
            unit="Tonnes",
            base_rate=65000.0,
            cost_index=1.0,
            rate=65000.0,
            effective_from=datetime.utcnow(),
            status="Active"
        )
        sor_brick = ScheduleOfRates(
            sor_code=f"SOR-BRICK-{int(datetime.utcnow().timestamp())}",
            description="Brick Masonry Class 75",
            category="Masonry",
            unit="m³",
            base_rate=7000.0,
            cost_index=1.0,
            rate=7000.0,
            effective_from=datetime.utcnow(),
            status="Active"
        )
        db.add_all([sor_concrete, sor_steel, sor_brick])
        db.commit()
        print("[+] Created SOR Items (RCC M30 @ 8500, Steel @ 65000, Brick @ 7000)")

        # --- TEST K: ZERO BOQ ITEMS SUBMISSION BLOCK ---
        print("\n--- TEST K: ZERO BOQ ITEMS SUBMISSION BLOCK ---")
        empty_estimate = get_or_create_estimate_for_project(proj_id, db)
        try:
            submit_estimate_for_review(empty_estimate.id, db)
            assert False, "Should have rejected submission for 0 BOQ items"
        except HTTPException as e:
            assert "Add at least one item" in e.detail, f"Unexpected error detail: {e.detail}"
            print(f"[PASS] Zero BOQ items submission correctly blocked with: '{e.detail}'")

        # Create 3 BOQ items for Section 21 end-to-end test
        boq1 = BoqItem(project_id=proj_id, item_name="Foundation Concrete", unit="m³", approved_qty=100.0, rate=8500.0, total_amount=850000.0)
        boq2 = BoqItem(project_id=proj_id, item_name="Reinforcement Steel", unit="Tonnes", approved_qty=100.0, rate=65000.0, total_amount=6500000.0)
        boq3 = BoqItem(project_id=proj_id, item_name="Brick Masonry", unit="m³", approved_qty=500.0, rate=7000.0, total_amount=3500000.0)
        db.add_all([boq1, boq2, boq3])
        db.commit()
        db.refresh(boq1)
        db.refresh(boq2)
        db.refresh(boq3)

        # Reload estimate
        est_resp = get_or_create_estimate_for_project(proj_id, db)

        # --- TEST C & D: QUANTITY VALIDATIONS ---
        print("\n--- TEST C & D: QUANTITY VALIDATIONS ---")
        # Test C: Qty = 0 -> Blocked
        try:
            save_req = EstimateSaveRequest(
                project_id=proj_id,
                lines=[EstimateLineSaveInput(boq_item_id=boq1.id, sor_item_id=sor_concrete.id, quantity=0)]
            )
            save_estimate(save_req, db)
            assert False, "Should reject qty = 0"
        except HTTPException as e:
            assert "Quantity must be greater than 0" in e.detail
            print(f"[PASS] Qty = 0 blocked: '{e.detail}'")

        # Test D: Qty > 3 decimals -> Blocked
        try:
            save_req = EstimateSaveRequest(
                project_id=proj_id,
                lines=[EstimateLineSaveInput(boq_item_id=boq1.id, sor_item_id=sor_concrete.id, quantity=10.1234)]
            )
            save_estimate(save_req, db)
            assert False, "Should reject >3 decimals"
        except HTTPException as e:
            assert "exceeds maximum of 3 decimal places" in e.detail
            print(f"[PASS] Qty 10.1234 (>3 decimals) blocked: '{e.detail}'")

        # Valid 3-decimal quantity -> Allowed
        valid_3dec_req = EstimateSaveRequest(
            project_id=proj_id,
            lines=[
                EstimateLineSaveInput(boq_item_id=boq1.id, sor_item_id=sor_concrete.id, quantity=100.125),
                EstimateLineSaveInput(boq_item_id=boq2.id, sor_item_id=sor_steel.id, quantity=100.0),
                EstimateLineSaveInput(boq_item_id=boq3.id, sor_item_id=sor_brick.id, quantity=500.0)
            ]
        )
        save_estimate(valid_3dec_req, db)
        print("[PASS] Quantity 100.125 (3 decimals) accepted successfully")

        # Reset qty back to 100.0 for section 21 calculation test
        save_req_21 = EstimateSaveRequest(
            project_id=proj_id,
            contingency_percent=5.0,
            departmental_charges_percent=2.0,
            lines=[
                EstimateLineSaveInput(boq_item_id=boq1.id, sor_item_id=sor_concrete.id, quantity=100.0, rate_source="SOR"),
                EstimateLineSaveInput(boq_item_id=boq2.id, sor_item_id=sor_steel.id, quantity=100.0, rate_source="SOR"),
                EstimateLineSaveInput(boq_item_id=boq3.id, sor_item_id=sor_brick.id, quantity=500.0, rate_source="SOR")
            ]
        )
        res_21 = save_estimate(save_req_21, db)

        # --- SECTION 21 & TEST A, I, J: VERIFY CALCULATIONS ---
        print("\n--- SECTION 21 & TEST A, I, J: VERIFY DETAILED CALCULATIONS ---")
        assert res_21.lines[0].estimated_amount == 850000.0, f"Expected BOQ1 850000.0, got {res_21.lines[0].estimated_amount}"
        assert res_21.lines[1].estimated_amount == 6500000.0, f"Expected BOQ2 6500000.0, got {res_21.lines[1].estimated_amount}"
        assert res_21.lines[2].estimated_amount == 3500000.0, f"Expected BOQ3 3500000.0, got {res_21.lines[2].estimated_amount}"
        
        assert res_21.base_amount == 10850000.0, f"Expected Base Amount 10850000.0, got {res_21.base_amount}"
        assert res_21.contingency_amount == 542500.0, f"Expected Contingency Amount 542500.0, got {res_21.contingency_amount}"
        assert res_21.departmental_charges_amount == 217000.0, f"Expected Dept Charges 217000.0, got {res_21.departmental_charges_amount}"
        expected_de_total = round(res_21.base_amount + res_21.contingency_amount + res_21.departmental_charges_amount, 2)
        assert res_21.total_amount == expected_de_total, f"Expected DE Total {expected_de_total}, got {res_21.total_amount}"
        
        print("[PASS] Base Estimate: Rs.1,08,50,000.00")
        print("[PASS] Contingency 5%: Rs.5,42,500.00")
        print("[PASS] Departmental Charges 2%: Rs.2,17,000.00")
        print(f"[PASS] DE Total: Rs.{res_21.total_amount:,.2f}")

        # --- TEST E & F: MANUAL RATE OVERRIDE VALIDATION ---
        print("\n--- TEST E & F: MANUAL RATE OVERRIDE VALIDATION ---")
        # Test E: Override rate without justification note -> Blocked
        try:
            save_override_no_just = EstimateSaveRequest(
                project_id=proj_id,
                lines=[
                    EstimateLineSaveInput(boq_item_id=boq1.id, sor_item_id=sor_concrete.id, quantity=100.0, rate_source="MANUAL_OVERRIDE", manual_rate=9000.0, is_manual_override=True, justification_note=""),
                    EstimateLineSaveInput(boq_item_id=boq2.id, sor_item_id=sor_steel.id, quantity=100.0, rate_source="SOR"),
                    EstimateLineSaveInput(boq_item_id=boq3.id, sor_item_id=sor_brick.id, quantity=500.0, rate_source="SOR")
                ]
            )
            save_estimate(save_override_no_just, db)
            assert False, "Should reject manual rate override without justification"
        except HTTPException as e:
            assert "requires a justification note" in e.detail
            print(f"[PASS] Manual rate override without justification blocked: '{e.detail}'")

        # Test F: Override rate with justification note -> Allowed
        save_override_with_just = EstimateSaveRequest(
            project_id=proj_id,
            lines=[
                EstimateLineSaveInput(boq_item_id=boq1.id, sor_item_id=sor_concrete.id, quantity=100.0, rate_source="MANUAL_OVERRIDE", manual_rate=9000.0, is_manual_override=True, justification_note="Updated based on approved market quotation."),
                EstimateLineSaveInput(boq_item_id=boq2.id, sor_item_id=sor_steel.id, quantity=100.0, rate_source="SOR"),
                EstimateLineSaveInput(boq_item_id=boq3.id, sor_item_id=sor_brick.id, quantity=500.0, rate_source="SOR")
            ]
        )
        res_override = save_estimate(save_override_with_just, db)
        assert res_override.lines[0].estimated_amount == 900000.0
        print("[PASS] Manual rate override (Rs.9,000) with justification accepted!")

        # Reset rate back to standard SOR
        save_estimate(save_req_21, db)

        # --- TEST G & H: CONTINGENCY TENANT BOUNDS & EE REVIEW FLAG ---
        print("\n--- TEST G & H: CONTINGENCY TENANT BOUNDS ---")
        # Test G: Contingency 5% within bounds -> EE review = False
        assert res_21.is_ee_review_required == False
        print("[PASS] Contingency 5% within tenant bounds -> is_ee_review_required = False")

        # Test H: Contingency 10% outside bounds -> EE review = True + warning reason
        save_out_bounds = EstimateSaveRequest(
            project_id=proj_id,
            contingency_percent=10.0,
            departmental_charges_percent=2.0,
            lines=[
                EstimateLineSaveInput(boq_item_id=boq1.id, sor_item_id=sor_concrete.id, quantity=100.0, rate_source="SOR"),
                EstimateLineSaveInput(boq_item_id=boq2.id, sor_item_id=sor_steel.id, quantity=100.0, rate_source="SOR"),
                EstimateLineSaveInput(boq_item_id=boq3.id, sor_item_id=sor_brick.id, quantity=500.0, rate_source="SOR")
            ]
        )
        res_out_bounds = save_estimate(save_out_bounds, db)
        assert res_out_bounds.is_ee_review_required == True
        assert "requires EE review" in res_out_bounds.ee_review_reason
        print(f"[PASS] Contingency 10% outside tenant bounds -> Flagged for EE review: '{res_out_bounds.ee_review_reason}'")

        # Reset contingency back to 5.0%
        save_estimate(save_req_21, db)

        # --- TEST B & L & M: UNIT MISMATCH & SUBMISSION & RELOAD ---
        print("\n--- TEST B & L & M: UNIT MISMATCH & SUBMIT & RELOAD ---")
        # Unit mismatch test
        sor_mismatch = ScheduleOfRates(
            sor_code=f"SOR-MISMATCH-{int(datetime.utcnow().timestamp())}",
            description="Steel in Cum",
            category="Steel",
            unit="Cum", # BOQ2 is Tonnes
            base_rate=5000.0,
            cost_index=1.0,
            rate=5000.0,
            effective_from=datetime.utcnow(),
            status="Active"
        )
        db.add(sor_mismatch)
        db.commit()

        # Save with unit mismatch on BOQ2 (Tonnes vs Cum)
        save_req_mismatch = EstimateSaveRequest(
            project_id=proj_id,
            lines=[
                EstimateLineSaveInput(boq_item_id=boq1.id, sor_item_id=sor_concrete.id, quantity=100.0, rate_source="SOR"),
                EstimateLineSaveInput(boq_item_id=boq2.id, sor_item_id=sor_mismatch.id, quantity=100.0, rate_source="SOR"),
                EstimateLineSaveInput(boq_item_id=boq3.id, sor_item_id=sor_brick.id, quantity=500.0, rate_source="SOR")
            ]
        )
        res_mm = save_estimate(save_req_mismatch, db)
        assert res_mm.lines[1].is_unit_compatible == False
        print("[PASS] Unit mismatch detected (BOQ: Tonnes vs SOR: Cum) -> is_unit_compatible = False")

        # Try submitting with unit mismatch -> Blocked
        try:
            submit_estimate_for_review(res_mm.id, db)
            assert False, "Should reject submission with unit mismatch"
        except HTTPException as e:
            assert "Unit mismatch" in e.detail
            print(f"[PASS] Submission with unit mismatch blocked: '{e.detail}'")

        # Restore valid mapping and submit for review
        save_estimate(save_req_21, db)
        sub_resp = submit_estimate_for_review(res_21.id, db)
        assert sub_resp.status == "READY_FOR_REVIEW"
        print("[PASS] Submitted for review -> Status: READY_FOR_REVIEW")

        # Reload after refresh (Test M)
        reload_resp = get_or_create_estimate_for_project(proj_id, db)
        assert reload_resp.total_amount == 11609500.0
        assert reload_resp.status == "READY_FOR_REVIEW"
        print(f"[PASS] Data persisted after reload (DE Total: Rs.{reload_resp.total_amount:,.2f})")

        # --- TEST N & O & 15: TECHNICAL SANCTION APPROVAL LOCKING ---
        print("\n--- TEST N & O & 15: TECHNICAL SANCTION APPROVAL LOCKING ---")
        ts_app_resp = approve_technical_sanction(res_21.id, db)
        assert ts_app_resp.is_ts_locked == True
        assert ts_app_resp.ts_status == "APPROVED"
        assert ts_app_resp.status == "APPROVED"
        print("[PASS] Technical Sanction Approved -> Estimate locked (is_ts_locked = True)")

        # Test O: Direct backend modification attempt to locked estimate -> Rejected
        try:
            save_estimate(save_req_21, db)
            assert False, "Should reject save edit on locked estimate"
        except HTTPException as e:
            assert "Detailed Estimate is locked" in e.detail
            print(f"[PASS] Direct backend edit on approved estimate rejected: '{e.detail}'")

        # Test 15: BOQ quantity edit after TS approval -> Blocked
        try:
            update_boq_item(boq1.id, BoqItemUpdate(approved_qty=200.0, item_name=boq1.item_name, unit=boq1.unit, rate=boq1.rate), db=db)
            assert False, "Should reject BOQ quantity change after TS approval"
        except HTTPException as e:
            assert "BOQ quantity cannot be changed after Technical Sanction approval. Create a Revised DE." in e.detail
            print(f"[PASS] BOQ quantity edit after TS approval blocked: '{e.detail}'")

        # --- TEST P & Q: CREATE REVISED DE ---
        print("\n--- TEST P & Q: CREATE REVISED DE ---")
        rev_resp = create_revised_estimate(res_21.id, db)
        assert rev_resp.is_revised == True
        assert rev_resp.revision_number == 1
        assert rev_resp.is_ts_locked == False
        assert rev_resp.status in ["DRAFT", "READY_FOR_REVIEW"]
        assert rev_resp.original_estimate_id == res_21.id
        print(f"[PASS] Created Revised DE #{rev_resp.estimate_number} (Rev #{rev_resp.revision_number}) from original estimate #{res_21.estimate_number}")

        # Verify original estimate remains locked and untouched (Test P)
        orig_check = get_or_create_estimate_for_project(proj_id, db)
        # Note get_or_create returns latest revision (rev 1), let's query orig_estimate directly
        orig_in_db = db.query(ProjectEstimate).filter(ProjectEstimate.id == res_21.id).first()
        assert orig_in_db.is_ts_locked == True
        assert orig_in_db.status == "APPROVED"
        print("[PASS] Original Approved DE remains untouched, LOCKED, and unchanged")

        # Test Q: Revised DE is editable
        save_rev_req = EstimateSaveRequest(
            project_id=proj_id,
            contingency_percent=5.0,
            departmental_charges_percent=2.0,
            lines=[
                EstimateLineSaveInput(boq_item_id=boq1.id, sor_item_id=sor_concrete.id, quantity=120.0, rate_source="SOR"), # Revised Qty 120
                EstimateLineSaveInput(boq_item_id=boq2.id, sor_item_id=sor_steel.id, quantity=100.0, rate_source="SOR"),
                EstimateLineSaveInput(boq_item_id=boq3.id, sor_item_id=sor_brick.id, quantity=500.0, rate_source="SOR")
            ]
        )
        saved_rev = save_estimate(save_rev_req, db)
        assert saved_rev.lines[0].quantity == 120.0
        print(f"[PASS] Revised DE successfully edited (BOQ1 Qty changed to 120.0 in Revision #{saved_rev.revision_number})")

        # --- TEST R: RATE SNAPSHOT IMMUTABILITY ---
        print("\n--- TEST R: RATE SNAPSHOT IMMUTABILITY ---")
        # Mutate current SOR master rate in database
        sor_concrete.base_rate = 99999.0
        db.commit()

        # Build response for original approved estimate
        orig_snap_resp = build_estimate_response(orig_in_db, db)
        assert orig_snap_resp.lines[0].sor_rate_snapshot == 8500.0, f"Expected snapshot rate 8500.0, got {orig_snap_resp.lines[0].sor_rate_snapshot}"
        print(f"[PASS] Approved estimate rate snapshot remains unchanged (8500.0) despite master SOR rate update to 99999.0!")

        print("\n==========================================================")
        print("ALL PSC-05 ACCEPTANCE TESTS AND SCENARIOS PASSED PERFECTLY!")
        print("==========================================================")

    finally:
        db.close()

if __name__ == '__main__':
    run_tests()
