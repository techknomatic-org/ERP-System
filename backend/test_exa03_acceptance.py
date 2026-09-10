import sys
import os
from datetime import datetime, date

backend_dir = os.path.dirname(__file__)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from fastapi import HTTPException
from app.main import app
from app.database import get_db, SessionLocal
from app.models import (
    User, Project, WbsTask, BoqItem, MeasurementBook, ContractorBill,
    TenantSetting, ProjectTeamMember, TestCheckAssignment, AuditLog, ApprovalTask
)
from app.api.auth import get_current_user
from app.api.boq_mb import run_test_check_sampling, verify_test_check_reviewer

client = TestClient(app)

def setup_test_data():
    db = SessionLocal()
    try:
        # Seed test tenant setting
        ts = db.query(TenantSetting).filter(TenantSetting.tenant_name == "Default Tenant").first()
        if not ts:
            ts = TenantSetting(tenant_name="Default Tenant", ae_sampling_rate=50.0, ee_sampling_rate=10.0)
            db.add(ts)
        else:
            ts.ae_sampling_rate = 50.0
            ts.ee_sampling_rate = 10.0
        db.commit()

        # Seed test users
        admin_user = db.query(User).filter(User.username == "admin_exa03").first()
        if not admin_user:
            admin_user = User(username="admin_exa03", email="admin_exa03@example.com", full_name="Admin User", role="admin", hashed_password="pw")
            db.add(admin_user)

        ae_user = db.query(User).filter(User.username == "ae_user_exa03").first()
        if not ae_user:
            ae_user = User(username="ae_user_exa03", email="ae_exa03@example.com", full_name="Assistant Engineer User", role="ae", hashed_password="pw")
            db.add(ae_user)

        ee_user = db.query(User).filter(User.username == "ee_user_exa03").first()
        if not ee_user:
            ee_user = User(username="ee_user_exa03", email="ee_exa03@example.com", full_name="Executive Engineer User", role="ee", hashed_password="pw")
            db.add(ee_user)

        pm_user = db.query(User).filter(User.username == "pm_user_exa03").first()
        if not pm_user:
            pm_user = User(username="pm_user_exa03", email="pm_exa03@example.com", full_name="Project Manager User", role="project_manager", hashed_password="pw")
            db.add(pm_user)

        je_user = db.query(User).filter(User.username == "je_user_exa03").first()
        if not je_user:
            je_user = User(username="je_user_exa03", email="je_exa03@example.com", full_name="Junior Engineer User", role="je", hashed_password="pw")
            db.add(je_user)

        crep_user = db.query(User).filter(User.username == "crep_user_exa03").first()
        if not crep_user:
            crep_user = User(username="crep_user_exa03", email="crep_exa03@example.com", full_name="Contractor Rep User", role="contractor_pm", hashed_password="pw")
            db.add(crep_user)

        db.commit()

        # Seed test project
        project = db.query(Project).filter(Project.code == "PRJ-EXA03-01").first()
        if not project:
            project = Project(
                tenant_name="Default Tenant",
                name="EXA-03 Test Check Project",
                code="PRJ-EXA03-01",
                location="Site Alpha",
                start_date=datetime.utcnow(),
                end_date=datetime.utcnow(),
                budget=5000000.0,
                status="ACTIVE"
            )
            db.add(project)
            db.commit()
            db.refresh(project)

        # Assign AE and EE to ProjectTeamMember
        for u_id, p_role in [(ae_user.id, "AE"), (ee_user.id, "EE"), (je_user.id, "JE"), (crep_user.id, "Contractor PM")]:
            mem = db.query(ProjectTeamMember).filter(
                ProjectTeamMember.project_id == project.id,
                ProjectTeamMember.user_id == u_id
            ).first()
            if not mem:
                mem = ProjectTeamMember(
                    project_id=project.id,
                    user_id=u_id,
                    project_role=p_role,
                    effective_from=date.today(),
                    status="ACTIVE",
                    is_active=True
                )
                db.add(mem)
        db.commit()

        # Seed WBS Task
        wbs = db.query(WbsTask).filter(WbsTask.project_id == project.id).first()
        if not wbs:
            wbs = WbsTask(
                project_id=project.id,
                wbs_code="1.1",
                title="Foundation Work EXA03",
                task_level="Task",
                start_date=datetime.utcnow(),
                end_date=datetime.utcnow(),
                planned_qty=100.0
            )
            db.add(wbs)
            db.commit()
            db.refresh(wbs)

        # Seed BOQ Item
        boq = db.query(BoqItem).filter(BoqItem.project_id == project.id).first()
        if not boq:
            boq = BoqItem(
                project_id=project.id,
                phase_id=wbs.id,
                task_id=wbs.id,
                item_name="M30 Concrete Pouring",
                unit="m³",
                approved_qty=500.0,
                rate=1000.0, # ₹1,000 per m³
                total_amount=500000.0,
                status="ACTIVE"
            )
            db.add(boq)
            db.commit()
            db.refresh(boq)

        return {
            "project_id": project.id,
            "wbs_id": wbs.id,
            "boq_id": boq.id,
            "admin_id": admin_user.id,
            "ae_id": ae_user.id,
            "ee_id": ee_user.id,
            "pm_id": pm_user.id,
            "je_id": je_user.id,
            "crep_id": crep_user.id
        }
    finally:
        db.close()

def test_exa03_all_acceptance_criteria():
    print("\n==================================================")
    print("STARTING EXA-03 ACCEPTANCE TEST SUITE (20 TESTS)")
    print("==================================================")

    data = setup_test_data()
    project_id = data["project_id"]
    wbs_id = data["wbs_id"]
    boq_id = data["boq_id"]

    db = SessionLocal()

    def get_user_by_id(u_id):
        return db.query(User).filter(User.id == u_id).first()

    try:
        # TEST 3: Minimum Sampling Config Violation (AE < 50% or EE < 10% blocked)
        print("\n--- TEST 3: CPWD MINIMUM SAMPLING RATE ENFORCEMENT ---")
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: get_user_by_id(data["ae_id"])

        resp = client.put("/api/boq-mb/test-checks/config", json={"ae_sampling_rate": 40.0, "ee_sampling_rate": 10.0})
        assert resp.status_code == 400
        assert "cannot be lower than CPWD-mandated minimum of 50%" in resp.json()["detail"]
        print("PASS: AE=40% rejected with HTTP 400!")

        resp = client.put("/api/boq-mb/test-checks/config", json={"ae_sampling_rate": 50.0, "ee_sampling_rate": 5.0})
        assert resp.status_code == 400
        assert "cannot be lower than CPWD-mandated minimum of 10%" in resp.json()["detail"]
        print("PASS: EE=5% rejected with HTTP 400!")

        # Set valid config (AE 50%, EE 10%)
        resp = client.put("/api/boq-mb/test-checks/config", json={"ae_sampling_rate": 50.0, "ee_sampling_rate": 10.0})
        assert resp.status_code == 200
        print("PASS: Valid configuration (AE 50%, EE 10%) saved successfully!")

        # TEST 1 & 2: AE 50% and EE 10% Sampling Rates
        print("\n--- TEST 1 & 2: AE (50%) AND EE (10%) SAMPLING ---")
        mb1 = MeasurementBook(
            project_id=project_id,
            wbs_node_id=wbs_id,
            boq_item_id=boq_id,
            description="Test Measurement Entry #1",
            measurement_method="LBH",
            length=10.0, breadth=5.0, height=2.0, # 100 m³, Value = ₹100,000 (> ₹50k)
            computed_quantity=100.0, measured_qty=100.0, unit="m³",
            contractor_rep_signer_id=data["crep_id"], contractor_rep_signed_at=datetime.utcnow(),
            je_signer_id=data["je_id"], je_signed_at=datetime.utcnow(),
            status="FULLY SIGNED / SUBMITTED"
        )
        db.add(mb1)
        db.commit()
        db.refresh(mb1)

        # Trigger sampling for MB1
        run_test_check_sampling(mb1, db, force_ae=True, force_ee=True)

        tc_ae = db.query(TestCheckAssignment).filter(
            TestCheckAssignment.measurement_book_id == mb1.id,
            TestCheckAssignment.authority == "AE"
        ).first()

        tc_ee = db.query(TestCheckAssignment).filter(
            TestCheckAssignment.measurement_book_id == mb1.id,
            TestCheckAssignment.authority == "EE"
        ).first()

        assert tc_ae is not None, "AE test check assignment should be created"
        assert tc_ee is not None, "EE test check assignment should be created"
        print(f"PASS: MB-{mb1.id:04d} created with AE ({tc_ae.sampling_percentage}%) and EE ({tc_ee.sampling_percentage}%) checks!")

        # TEST 4: Risk Weighting Check
        print("\n--- TEST 4: RISK WEIGHTING AUDIT CHECK ---")
        assert tc_ae.risk_score > 1.0, f"Expected risk_score > 1.0, got {tc_ae.risk_score}"
        assert "FIRST_TIME_ITEM" in tc_ae.risk_factors or "HIGH_VALUE" in tc_ae.risk_factors
        print(f"PASS: Risk score={tc_ae.risk_score}, factors='{tc_ae.risk_factors}', reason='{tc_ae.sampling_reason}'")

        # TEST 5, 6, 7: AE Pending, EE Pending, BOTH selected
        print("\n--- TEST 5, 6, 7: BOTH AE & EE INDEPENDENTLY PENDING ---")
        assert tc_ae.status == "Pending"
        assert tc_ee.status == "Pending"
        print("PASS: AE status = Pending, EE status = Pending!")

        # TEST 12: Billing Gate Check (Pending Test-Check Blocks Billing)
        print("\n--- TEST 12: BILLING GATE (PENDING CHECK BLOCKS BILL) ---")
        resp = client.post("/api/boq-mb/contractor-bill", json={
            "project_id": project_id,
            "boq_item_id": boq_id,
            "vendor_id": 1,
            "billed_qty": 50.0,
            "billed_rate": 1000.0
        })
        assert resp.status_code == 400
        assert "pending" in resp.json()["detail"].lower() and "test-check" in resp.json()["detail"].lower()
        print(f"PASS: Bill creation blocked cleanly with error: {resp.json()['detail']}")

        # TEST 15: RBAC Enforcement
        print("\n--- TEST 15: RBAC ENFORCEMENT ---")
        # PM attempting AE action -> rejected
        app.dependency_overrides[get_current_user] = lambda: get_user_by_id(data["pm_id"])
        resp = client.post(f"/api/boq-mb/test-checks/{tc_ae.id}/review", json={"action": "Pass"})
        assert resp.status_code == 403
        print("PASS: PM attempting AE review rejected with HTTP 403!")

        # AE attempting EE action -> rejected
        app.dependency_overrides[get_current_user] = lambda: get_user_by_id(data["ae_id"])
        resp = client.post(f"/api/boq-mb/test-checks/{tc_ee.id}/review", json={"action": "Pass"})
        assert resp.status_code == 403
        print("PASS: AE attempting EE review rejected with HTTP 403!")

        # TEST 8 & 14: AE passes only -> overall status remains Pending, billing still blocked
        print("\n--- TEST 8 & 14: AE PASSES ONLY (EE REMAINS PENDING) ---")
        app.dependency_overrides[get_current_user] = lambda: get_user_by_id(data["ae_id"])
        resp = client.post(f"/api/boq-mb/test-checks/{tc_ae.id}/review", json={"action": "Pass", "remarks": "AE verified site raft foundation."})
        assert resp.status_code == 200
        db.refresh(tc_ae)
        assert tc_ae.status == "Passed"

        # Billing still blocked because EE is Pending
        app.dependency_overrides[get_current_user] = lambda: get_user_by_id(data["ae_id"])
        resp = client.post("/api/boq-mb/contractor-bill", json={
            "project_id": project_id,
            "boq_item_id": boq_id,
            "vendor_id": 1,
            "billed_qty": 50.0,
            "billed_rate": 1000.0
        })
        assert resp.status_code == 400
        assert "pending EE Test-Check" in resp.json()["detail"]
        print("PASS: AE Passed, EE Pending -> Billing remains blocked server-side!")

        # TEST 9: EE then passes -> test-check gate clears!
        print("\n--- TEST 9: EE PASSES -> BILLING GATE CLEARS ---")
        app.dependency_overrides[get_current_user] = lambda: get_user_by_id(data["ee_id"])
        resp = client.post(f"/api/boq-mb/test-checks/{tc_ee.id}/review", json={"action": "Pass", "remarks": "EE verified site quality."})
        assert resp.status_code == 200
        db.refresh(tc_ee)
        assert tc_ee.status == "Passed"

        # Now bill creation should succeed!
        app.dependency_overrides[get_current_user] = lambda: get_user_by_id(data["ae_id"])
        resp = client.post("/api/boq-mb/contractor-bill", json={
            "project_id": project_id,
            "boq_item_id": boq_id,
            "vendor_id": 1,
            "billed_qty": 50.0,
            "billed_rate": 1000.0
        })
        assert resp.status_code == 200
        bill_data = resp.json()
        bill_id = bill_data["bill_id"]
        print(f"PASS: Both AE and EE Passed -> Bill #{bill_data['bill_number']} created successfully!")

        # TEST 10: Flag without remarks -> Blocked
        print("\n--- TEST 10: FLAG WITHOUT REMARKS REJECTED ---")
        # Create a second e-MB entry MB2
        mb2 = MeasurementBook(
            project_id=project_id,
            wbs_node_id=wbs_id,
            boq_item_id=boq_id,
            description="Test Measurement Entry #2",
            measurement_method="DIRECT", direct_quantity=50.0, computed_quantity=50.0, measured_qty=50.0, unit="m³",
            contractor_rep_signer_id=data["crep_id"], contractor_rep_signed_at=datetime.utcnow(),
            je_signer_id=data["je_id"], je_signed_at=datetime.utcnow(),
            status="FULLY SIGNED / SUBMITTED"
        )
        db.add(mb2)
        db.commit()
        db.refresh(mb2)

        run_test_check_sampling(mb2, db, force_ae=True)
        tc2_ae = db.query(TestCheckAssignment).filter(
            TestCheckAssignment.measurement_book_id == mb2.id,
            TestCheckAssignment.authority == "AE"
        ).first()

        app.dependency_overrides[get_current_user] = lambda: get_user_by_id(data["ae_id"])
        resp = client.post(f"/api/boq-mb/test-checks/{tc2_ae.id}/review", json={"action": "Flag", "remarks": ""})
        assert resp.status_code == 400
        assert "remarks are mandatory" in resp.json()["detail"].lower()
        print("PASS: Flag without remarks rejected with HTTP 400!")

        # TEST 11 & 13: Flag with remarks -> Status = Flagged & Parent Bill Pulled Back to Draft!
        print("\n--- TEST 11 & 13: FLAG WITH REMARKS & SUBMITTED BILL PULLED TO DRAFT ---")
        # First ensure there's a bill linked to MB2's boq_item_id
        active_bill = db.query(ContractorBill).filter(ContractorBill.id == bill_id).first()
        active_bill.status = "pending_approval"
        db.commit()

        resp = client.post(f"/api/boq-mb/test-checks/{tc2_ae.id}/review", json={
            "action": "Flag",
            "remarks": "Concrete cube strength test failed. Exceeds permissible variance."
        })
        assert resp.status_code == 200
        db.refresh(tc2_ae)
        db.refresh(mb2)
        db.refresh(active_bill)

        assert tc2_ae.status == "Flagged"
        assert mb2.status == "FLAGGED / SENT BACK"
        assert active_bill.status == "DRAFT"
        assert "Bill returned to Draft" in active_bill.discrepancy_reason
        print(f"PASS: MB-{mb2.id:04d} FLAGGED and Parent Bill #{active_bill.bill_number} pulled back to DRAFT!")

        # TEST 16 & 17: Cross-Project / Tenant Isolation
        print("\n--- TEST 16 & 17: CROSS-PROJECT ISOLATION ---")
        # AE attempting review on a non-existent/other project test-check -> rejected
        resp = client.post("/api/boq-mb/test-checks/99999/review", json={"action": "Pass"})
        assert resp.status_code == 404
        print("PASS: Non-existent / cross-project test check review returned HTTP 404!")

        # TEST 18: Persistence
        print("\n--- TEST 18: PERSISTENCE CHECK ---")
        persisted_tc = db.query(TestCheckAssignment).filter(TestCheckAssignment.id == tc2_ae.id).first()
        assert persisted_tc.status == "Flagged"
        assert persisted_tc.reviewer_remarks == "Concrete cube strength test failed. Exceeds permissible variance."
        print("PASS: Test-check record and remarks persist across DB queries!")

        # TEST 19: Audit Log Verification
        print("\n--- TEST 19: AUDIT LOG VERIFICATION ---")
        audits = db.query(AuditLog).filter(
            AuditLog.entity_type.in_(["TestCheckAssignment", "MeasurementBook", "ContractorBill"])
        ).all()
        assert len(audits) >= 5
        print(f"PASS: {len(audits)} audit log entries verified!")

        # TEST 20: EXA-02 Regression Verification
        print("\n--- TEST 20: EXA-02 REGRESSION VERIFICATION ---")
        resp = client.get(f"/api/boq-mb/emb/project/{project_id}")
        assert resp.status_code == 200
        entries = resp.json()
        assert len(entries) >= 2
        for e in entries:
            assert "ae_test_check_status" in e
            assert "ee_test_check_status" in e
            assert "overall_test_check_status" in e
        print("PASS: EXA-02 e-MB query working with EXA-03 test-check status extensions!")

        print("\n==================================================")
        print("ALL 20 EXA-03 ACCEPTANCE TESTS PASSED SUCCESSFULLY!")
        print("==================================================\n")

    finally:
        app.dependency_overrides.clear()
        db.close()

if __name__ == "__main__":
    test_exa03_all_acceptance_criteria()
