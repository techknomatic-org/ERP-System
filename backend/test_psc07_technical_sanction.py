import os
import sys
import unittest
from datetime import datetime

# Add app to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.models import (
    User, Project, BoqItem, ScheduleOfRates, SorEdition, 
    SorRegion, Document, NonSorRateAnalysis, ProjectEstimate, 
    ProjectEstimateLine, TechnicalSanction, Vendor, ContractorBill, Notification
)
from app.main import app
from fastapi.testclient import TestClient

SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}, 
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

class TestPsc07TechnicalSanction(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.db = TestingSessionLocal()

        for table in reversed(Base.metadata.sorted_tables):
            self.db.execute(table.delete())
        self.db.commit()

        # Seed Users
        self.admin_user = User(
            username="admin",
            full_name="System Admin",
            email="admin@erp.local",
            role="admin",
            hashed_password="hash"
        )
        self.ee_user = User(
            username="ee_test",
            full_name="Executive Engineer",
            email="ee@test.com",
            role="executive_engineer",
            hashed_password="hash"
        )
        self.site_user = User(
            username="site_test",
            full_name="Site Engineer",
            email="site@test.com",
            role="site_engineer",
            hashed_password="hash"
        )
        self.db.add_all([self.admin_user, self.ee_user, self.site_user])
        self.db.commit()

        # SOR Edition & Region
        self.edition = SorEdition(name="DSR 2023", description="DSR 2023", effective_date=datetime.utcnow())
        self.region = SorRegion(name="Maharashtra Zone 1", code="MH-Z1")
        self.db.add_all([self.edition, self.region])
        self.db.commit()

        # Project
        self.project = Project(
            name="Highway Bridge Construction",
            code="PRJ-HW-01",
            sor_edition_id=self.edition.id,
            sor_region_id=self.region.id,
            budget=5000000.0,
            location="Pune",
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow(),
            status="planning"
        )
        self.db.add(self.project)
        self.db.commit()

        # SOR Item
        self.sor_item = ScheduleOfRates(
            sor_code="SOR-CIVIL-01",
            category="Civil Works",
            description="Reinforced Cement Concrete (RCC) M25 grade",
            unit="m³",
            base_rate=5500.00,
            rate=5500.00,
            cost_index=1.00,
            effective_from=datetime.utcnow(),
            sor_edition_id=self.edition.id,
            sor_region_id=self.region.id,
            status="Active"
        )
        self.db.add(self.sor_item)
        self.db.commit()

        # BOQ Item
        self.boq_item = BoqItem(
            project_id=self.project.id,
            item_name="Reinforced Cement Concrete (RCC) M25 grade",
            unit="m³",
            approved_qty=100.0,
            rate=5500.0,
            total_amount=550000.0
        )
        self.db.add(self.boq_item)
        self.db.commit()

        # Vendor
        self.vendor = Vendor(
            name="L&T Construction Ltd",
            code="VEN-LT-01",
            contact_person="Ramesh Kumar",
            phone="9876543210",
            email="vendor@lt.com"
        )
        self.db.add(self.vendor)
        self.db.commit()

        # Create Detailed Estimate
        self.estimate = ProjectEstimate(
            estimate_number="EST-2026-001",
            project_id=self.project.id,
            status="DRAFT",
            base_amount=550000.0,
            contingency_percent=5.0,
            contingency_amount=27500.0,
            departmental_charges_percent=2.0,
            departmental_charges_amount=11000.0,
            total_amount=588500.0,
            revision_number=0,
            is_ts_locked=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        self.db.add(self.estimate)
        self.db.commit()

        self.estimate_line = ProjectEstimateLine(
            estimate_id=self.estimate.id,
            boq_item_id=self.boq_item.id,
            sor_item_id=self.sor_item.id,
            rate_source="SOR",
            quantity=100.0,
            sor_rate_snapshot=5500.0,
            estimated_amount=550000.0
        )
        self.db.add(self.estimate_line)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    # -------------------------------------------------------------
    # TEST 1 — Normal Submission
    # -------------------------------------------------------------
    def test_01_normal_ts_submission(self):
        """Submit estimate for Technical Sanction. Verify EE auto-resolved and status = PENDING_APPROVAL."""
        payload = {
            "project_id": self.project.id,
            "estimate_id": self.estimate.id,
            "remarks": "Submitting detailed estimate for statutory Technical Sanction."
        }
        res = self.client.post(
            "/api/technical-sanctions/submit",
            json=payload,
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "PENDING_APPROVAL")
        self.assertEqual(data["sanctioning_authority_user_id"], self.ee_user.id)
        self.assertIn("Executive Engineer", data["sanctioning_authority_name"])
        self.assertIsNone(data["sanction_reference_number"])
        self.assertIsNone(data["sanction_date"])

        # Check pending sanctions list
        res_pending = self.client.get(
            "/api/technical-sanctions/pending",
            headers={"Authorization": f"Bearer demo-token-{self.ee_user.id}"}
        )
        self.assertEqual(res_pending.status_code, 200)
        self.assertTrue(len(res_pending.json()) > 0)

    # -------------------------------------------------------------
    # TEST 2 — EE Approval
    # -------------------------------------------------------------
    def test_02_ee_ts_approval(self):
        """Authorized EE approves Technical Sanction. Reference generated, date populated, estimate locked."""
        # First submit
        ts = TechnicalSanction(
            project_id=self.project.id,
            detailed_estimate_id=self.estimate.id,
            sanctioning_authority_user_id=self.ee_user.id,
            status="PENDING_APPROVAL",
            submitted_by_id=self.site_user.id,
            estimate_revision=0,
            estimate_total_at_submission=588500.0
        )
        self.db.add(ts)
        self.db.commit()

        # Approve by EE
        res = self.client.post(
            f"/api/technical-sanctions/{ts.id}/approve",
            json={"remarks": "Technical Sanction granted."},
            headers={"Authorization": f"Bearer demo-token-{self.ee_user.id}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "APPROVED")
        self.assertIsNotNone(data["sanction_reference_number"])
        self.assertTrue(data["sanction_reference_number"].startswith("TS/"))
        self.assertIsNotNone(data["sanction_date"])

        # Verify estimate is locked
        self.db.refresh(self.estimate)
        self.assertEqual(self.estimate.ts_status, "APPROVED")
        self.assertEqual(self.estimate.status, "APPROVED")
        self.assertTrue(self.estimate.is_ts_locked)

    # -------------------------------------------------------------
    # TEST 3 — Unauthorized Approval
    # -------------------------------------------------------------
    def test_03_unauthorized_ts_approval(self):
        """Non-authorized user (e.g. site engineer) cannot approve Technical Sanction."""
        ts = TechnicalSanction(
            project_id=self.project.id,
            detailed_estimate_id=self.estimate.id,
            sanctioning_authority_user_id=self.ee_user.id,
            status="PENDING_APPROVAL",
            submitted_by_id=self.site_user.id,
            estimate_revision=0,
            estimate_total_at_submission=588500.0
        )
        self.db.add(ts)
        self.db.commit()

        res = self.client.post(
            f"/api/technical-sanctions/{ts.id}/approve",
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("Only authorized Executive Engineer", res.json()["detail"])

    # -------------------------------------------------------------
    # TEST 4 — Rejection Without Reason
    # -------------------------------------------------------------
    def test_04_rejection_without_reason_blocked(self):
        """EE attempts rejection without mandatory reason -> blocked HTTP 400."""
        ts = TechnicalSanction(
            project_id=self.project.id,
            detailed_estimate_id=self.estimate.id,
            sanctioning_authority_user_id=self.ee_user.id,
            status="PENDING_APPROVAL",
            submitted_by_id=self.site_user.id,
            estimate_revision=0,
            estimate_total_at_submission=588500.0
        )
        self.db.add(ts)
        self.db.commit()

        res = self.client.post(
            f"/api/technical-sanctions/{ts.id}/reject",
            json={"rejection_reason": "   "},
            headers={"Authorization": f"Bearer demo-token-{self.ee_user.id}"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Rejection reason is mandatory", res.json()["detail"])

    # -------------------------------------------------------------
    # TEST 5 — Rejection With Reason
    # -------------------------------------------------------------
    def test_05_rejection_with_reason_returns_to_draft(self):
        """EE rejects with reason -> Status = REJECTED, Estimate returns to DRAFT."""
        ts = TechnicalSanction(
            project_id=self.project.id,
            detailed_estimate_id=self.estimate.id,
            sanctioning_authority_user_id=self.ee_user.id,
            status="PENDING_APPROVAL",
            submitted_by_id=self.site_user.id,
            estimate_revision=0,
            estimate_total_at_submission=588500.0
        )
        self.db.add(ts)
        self.db.commit()

        res = self.client.post(
            f"/api/technical-sanctions/{ts.id}/reject",
            json={"rejection_reason": "Quantities for RCC M25 are inflated by 15%. Revise."},
            headers={"Authorization": f"Bearer demo-token-{self.ee_user.id}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "REJECTED")
        self.assertEqual(data["rejection_reason"], "Quantities for RCC M25 are inflated by 15%. Revise.")

        # Estimate returns to DRAFT and unlocked
        self.db.refresh(self.estimate)
        self.assertEqual(self.estimate.status, "DRAFT")
        self.assertEqual(self.estimate.ts_status, "REJECTED")
        self.assertFalse(self.estimate.is_ts_locked)

    # -------------------------------------------------------------
    # TEST 6 — Bill Before Technical Sanction Blocked
    # -------------------------------------------------------------
    def test_06_bill_before_ts_approval_blocked(self):
        """Attempting to raise contractor bill before TS is APPROVED is blocked by backend."""
        bill_payload = {
            "project_id": self.project.id,
            "vendor_id": self.vendor.id,
            "boq_item_id": self.boq_item.id,
            "billed_qty": 50.0,
            "billed_rate": 5500.0
        }
        res = self.client.post(
            "/api/contractor-billing/bills",
            json=bill_payload,
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Technical Sanction for this estimate has not been approved", res.json()["detail"])

    # -------------------------------------------------------------
    # TEST 7 — Estimate Changed After Submission (Invalidation)
    # -------------------------------------------------------------
    def test_07_estimate_changed_after_submission_invalidated(self):
        """If estimate total changes after TS submission, TS becomes INVALIDATED and approval is blocked."""
        ts = TechnicalSanction(
            project_id=self.project.id,
            detailed_estimate_id=self.estimate.id,
            sanctioning_authority_user_id=self.ee_user.id,
            status="PENDING_APPROVAL",
            submitted_by_id=self.site_user.id,
            estimate_revision=0,
            estimate_total_at_submission=588500.0
        )
        self.db.add(ts)
        self.db.commit()

        # Modify estimate total amount
        self.estimate.total_amount = 750000.0
        self.db.commit()

        # EE attempts to approve stale TS
        res = self.client.post(
            f"/api/technical-sanctions/{ts.id}/approve",
            headers={"Authorization": f"Bearer demo-token-{self.ee_user.id}"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("no longer valid because the Detailed Estimate was changed", res.json()["detail"])

        self.db.refresh(ts)
        self.assertEqual(ts.status, "INVALIDATED")

    # -------------------------------------------------------------
    # TEST 8 — Vacant EE Role Edge Case
    # -------------------------------------------------------------
    def test_08_vacant_ee_role_blocks_submission(self):
        """When no EE user is assigned in system, TS submission is blocked and admin is notified."""
        # Unassign EE role from users
        self.ee_user.role = "site_engineer"
        self.db.commit()

        payload = {
            "project_id": self.project.id,
            "estimate_id": self.estimate.id,
            "remarks": "Test submission without EE"
        }
        res = self.client.post(
            "/api/technical-sanctions/submit",
            json=payload,
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Sanctioning Authority (EE) is not assigned", res.json()["detail"])

        # Check Admin Notification
        admin_notif = self.db.query(Notification).filter(Notification.user_id == self.admin_user.id).first()
        self.assertIsNotNone(admin_notif)
        self.assertIn("Vacant", admin_notif.title)

    # -------------------------------------------------------------
    # TEST 9 — Resubmission After Rejection
    # -------------------------------------------------------------
    def test_09_resubmission_after_rejection(self):
        """After TS rejection, estimate can be updated and resubmitted."""
        ts_old = TechnicalSanction(
            project_id=self.project.id,
            detailed_estimate_id=self.estimate.id,
            sanctioning_authority_user_id=self.ee_user.id,
            status="REJECTED",
            rejection_reason="Need breakdown",
            submitted_by_id=self.site_user.id,
            estimate_revision=0,
            estimate_total_at_submission=588500.0
        )
        self.db.add(ts_old)
        self.db.commit()

        # Resubmit
        payload = {
            "project_id": self.project.id,
            "estimate_id": self.estimate.id,
            "remarks": "Resubmitting revised detailed estimate."
        }
        res = self.client.post(
            "/api/technical-sanctions/submit",
            json=payload,
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "PENDING_APPROVAL")
        self.assertNotEqual(data["id"], ts_old.id)

    # -------------------------------------------------------------
    # TEST 10 — Tenant & Role Authorization Security
    # -------------------------------------------------------------
    def test_10_role_authorization_security(self):
        """Verify unauthorized users cannot execute approval or rejection endpoints."""
        ts = TechnicalSanction(
            project_id=self.project.id,
            detailed_estimate_id=self.estimate.id,
            sanctioning_authority_user_id=self.ee_user.id,
            status="PENDING_APPROVAL",
            submitted_by_id=self.site_user.id,
            estimate_revision=0,
            estimate_total_at_submission=588500.0
        )
        self.db.add(ts)
        self.db.commit()

        res_app = self.client.post(
            f"/api/technical-sanctions/{ts.id}/approve",
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res_app.status_code, 403)

        res_rej = self.client.post(
            f"/api/technical-sanctions/{ts.id}/reject",
            json={"rejection_reason": "Test"},
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res_rej.status_code, 403)

    # -------------------------------------------------------------
    # TEST 11 — Direct API Status Manipulation Blocked
    # -------------------------------------------------------------
    def test_11_direct_api_status_manipulation_blocked(self):
        """Invalid state transitions or approving non-pending TS are rejected by server."""
        ts = TechnicalSanction(
            project_id=self.project.id,
            detailed_estimate_id=self.estimate.id,
            sanctioning_authority_user_id=self.ee_user.id,
            status="APPROVED",
            submitted_by_id=self.site_user.id,
            estimate_revision=0,
            estimate_total_at_submission=588500.0
        )
        self.db.add(ts)
        self.db.commit()

        res = self.client.post(
            f"/api/technical-sanctions/{ts.id}/approve",
            headers={"Authorization": f"Bearer demo-token-{self.ee_user.id}"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("already approved", res.json()["detail"].lower())

    # -------------------------------------------------------------
    # TEST 12 — Regression Check (PSC-04, PSC-05, PSC-06)
    # -------------------------------------------------------------
    def test_12_regression_check(self):
        """Verify SOR lookup, estimate calculation, and Non-SOR analysis remain working."""
        # Test SOR lookup
        res_sor = self.client.get(f"/api/schedule-of-rates")
        self.assertEqual(res_sor.status_code, 200)

        # Test Estimate Get
        res_est = self.client.get(f"/api/estimation/project/{self.project.id}")
        self.assertEqual(res_est.status_code, 200)
        self.assertEqual(res_est.json()["id"], self.estimate.id)

        # Test Non-SOR
        non_sor_payload = {
            "project_id": self.project.id,
            "item_description": "Special Submerged Epoxy Paint",
            "unit": "m²",
            "market_rate_source": "Published Index",
            "market_rate": 3500.0
        }
        res_non_sor = self.client.post(
            "/api/non-sor-rate-analysis",
            json=non_sor_payload,
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res_non_sor.status_code, 200)
        self.assertEqual(res_non_sor.json()["status"], "PENDING_EE_REVIEW")

if __name__ == "__main__":
    unittest.main()
