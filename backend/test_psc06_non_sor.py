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
    SorRegion, Document, NonSorRateAnalysis
)
from app.main import app
from fastapi.testclient import TestClient

# Single-connection SQLite in-memory engine for fast, isolated test suite
SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}, 
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create all tables on engine
Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

class TestPsc06NonSorRateAnalysis(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.db = TestingSessionLocal()

        # Clean all existing data before each test
        for table in reversed(Base.metadata.sorted_tables):
            self.db.execute(table.delete())
        self.db.commit()

        # Seed default users
        self.admin_user = User(
            username="admin",
            full_name="Default System Admin",
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
        self.edition = SorEdition(
            name="DSR 2023",
            description="DSR Edition 2023",
            effective_date=datetime.utcnow()
        )
        self.edition_v2 = SorEdition(
            name="DSR 2026",
            description="DSR Edition 2026",
            effective_date=datetime.utcnow()
        )
        self.region = SorRegion(
            name="Maharashtra Zone 1",
            code="MH-Z1"
        )
        self.db.add_all([self.edition, self.edition_v2, self.region])
        self.db.commit()

        # Project
        self.project = Project(
            name="Metro Bridge Construction",
            code="PRJ-METRO-01",
            sor_edition_id=self.edition.id,
            sor_region_id=self.region.id,
            budget=1000000.0,
            location="Mumbai",
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow(),
            status="planning"
        )
        self.db.add(self.project)
        self.db.commit()

        # SOR Item
        self.sor_item = ScheduleOfRates(
            sor_code="SOR-CONC-01",
            category="Civil Works",
            description="Plain Cement Concrete (PCC) M15 grade including shuttering",
            unit="m³",
            base_rate=4500.00,
            rate=4500.00,
            cost_index=1.05,
            effective_from=datetime.utcnow(),
            sor_edition_id=self.edition.id,
            sor_region_id=self.region.id,
            status="Active"
        )
        self.db.add(self.sor_item)
        self.db.commit()

        # BOQ Items (1 matching SOR, 1 non-matching)
        self.boq_sor = BoqItem(
            project_id=self.project.id,
            item_name="Plain Cement Concrete (PCC) M15 grade including shuttering",
            unit="m³",
            approved_qty=100.0,
            rate=4500.0,
            total_amount=450000.0
        )
        self.boq_non_sor = BoqItem(
            project_id=self.project.id,
            item_name="Specialized Epoxy Anti-Corrosive Coating for Submerged Steel Support",
            unit="m²",
            approved_qty=250.0,
            rate=1200.0,
            total_amount=300000.0
        )
        self.db.add_all([self.boq_sor, self.boq_non_sor])
        self.db.commit()

        # Supporting Document
        self.doc = Document(
            entity_type="NonSorRateAnalysis",
            entity_id=0,
            file_name="vendor_quote_epoxy_coat.pdf",
            file_path="/uploads/vendor_quote_epoxy_coat.pdf",
            file_type="application/pdf",
            file_size=102450
        )
        self.db.add(self.doc)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    # -------------------------------------------------------------
    # TEST 1: SOR-First Rule Enforcement
    # -------------------------------------------------------------
    def test_01_sor_first_rule_rejection(self):
        """Reject Non-SOR creation if an active matching SOR rate exists."""
        payload = {
            "project_id": self.project.id,
            "boq_item_id": self.boq_sor.id,
            "item_description": self.boq_sor.item_name,
            "unit": self.boq_sor.unit,
            "market_rate_source": "Manual Entry",
            "market_rate": 5000.0,
            "analysis_remarks": "Requesting manual market rate for PCC."
        }
        res = self.client.post(
            "/api/non-sor-rate-analysis",
            json=payload,
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("already exists", res.json()["detail"])

    # -------------------------------------------------------------
    # TEST 2: Non-SOR Creation Success (No SOR Match)
    # -------------------------------------------------------------
    def test_02_non_sor_creation_success(self):
        """Create Non-SOR analysis successfully when no matching SOR exists."""
        payload = {
            "project_id": self.project.id,
            "boq_item_id": self.boq_non_sor.id,
            "item_description": self.boq_non_sor.item_name,
            "unit": self.boq_non_sor.unit,
            "market_rate_source": "Manual Entry",
            "market_rate": 1350.0,
            "analysis_remarks": "Epoxy coating vendor quote based rate analysis."
        }
        res = self.client.post(
            "/api/non-sor-rate-analysis",
            json=payload,
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "PENDING_EE_REVIEW")
        self.assertEqual(data["rate_type"], "Market Rate")
        self.assertEqual(data["market_rate"], 1350.0)

    # -------------------------------------------------------------
    # TEST 3: Mandatory Document for Vendor Quotation Rejection (Acceptance Test A)
    # -------------------------------------------------------------
    def test_03_vendor_quotation_missing_doc_rejection(self):
        """TEST A: Require supporting document when market_rate_source is Vendor Quotation."""
        payload = {
            "project_id": self.project.id,
            "boq_item_id": self.boq_non_sor.id,
            "item_description": self.boq_non_sor.item_name,
            "unit": self.boq_non_sor.unit,
            "market_rate_source": "Vendor Quotation",
            "market_rate": 4500.0,
            "analysis_remarks": "Quotation from Asian Paints Commercial Division."
        }
        res = self.client.post(
            "/api/non-sor-rate-analysis",
            json=payload,
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("supporting document", res.json()["detail"].lower())

    # -------------------------------------------------------------
    # TEST 3B: Published Index Without Document Success (Acceptance Test B)
    # -------------------------------------------------------------
    def test_03b_published_index_no_doc_success(self):
        """TEST B: Published Index succeeds without supporting document."""
        payload = {
            "project_id": self.project.id,
            "boq_item_id": self.boq_non_sor.id,
            "item_description": "Published Index Specialized Epoxy Coating",
            "unit": self.boq_non_sor.unit,
            "market_rate_source": "Published Index",
            "market_rate": 3000.0,
            "supporting_document_id": None,
            "analysis_remarks": "Based on RBI/CPWD construction index bulletin."
        }
        res = self.client.post(
            "/api/non-sor-rate-analysis",
            json=payload,
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "PENDING_EE_REVIEW")
        self.assertEqual(data["market_rate_source"], "Published Index")
        self.assertEqual(data["market_rate"], 3000.0)
        self.assertIsNone(data["supporting_document_id"])

    # -------------------------------------------------------------
    # TEST 3C: Manual Entry Without Document Success (Acceptance Test C)
    # -------------------------------------------------------------
    def test_03c_manual_entry_no_doc_success(self):
        """TEST C: Manual Entry succeeds without supporting document."""
        payload = {
            "project_id": self.project.id,
            "boq_item_id": self.boq_non_sor.id,
            "item_description": "Manual Entry Specialized Epoxy Coating",
            "unit": self.boq_non_sor.unit,
            "market_rate_source": "Manual Entry",
            "market_rate": 3000.0,
            "supporting_document_id": None,
            "analysis_remarks": "Manual rate estimate analysis."
        }
        res = self.client.post(
            "/api/non-sor-rate-analysis",
            json=payload,
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "PENDING_EE_REVIEW")
        self.assertEqual(data["market_rate_source"], "Manual Entry")
        self.assertEqual(data["market_rate"], 3000.0)
        self.assertIsNone(data["supporting_document_id"])

    # -------------------------------------------------------------
    # TEST 3D: Switch Published Index -> Vendor Quotation Requires Document (Acceptance Test D)
    # -------------------------------------------------------------
    def test_03d_switch_published_index_to_vendor_quotation_requires_doc(self):
        """TEST D: Updating analysis from Published Index to Vendor Quotation without document is rejected."""
        # First create Published Index without doc
        analysis = NonSorRateAnalysis(
            project_id=self.project.id,
            boq_item_id=self.boq_non_sor.id,
            item_description="Published Index Coating",
            unit=self.boq_non_sor.unit,
            market_rate_source="Published Index",
            market_rate=3000.0,
            supporting_document_id=None,
            status="PENDING_EE_REVIEW",
            rate_type="Market Rate",
            created_by_id=self.site_user.id
        )
        self.db.add(analysis)
        self.db.commit()

        # Update to Vendor Quotation without attaching a document -> expected 400
        res = self.client.put(
            f"/api/non-sor-rate-analysis/{analysis.id}",
            json={"market_rate_source": "Vendor Quotation"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("supporting document", res.json()["detail"].lower())

    # -------------------------------------------------------------
    # TEST 3E: Switch Vendor Quotation -> Published Index Document Becomes Optional (Acceptance Test E)
    # -------------------------------------------------------------
    def test_03e_switch_vendor_quotation_to_published_index_optional_doc(self):
        """TEST E: Updating analysis from Vendor Quotation to Published Index makes document optional."""
        analysis = NonSorRateAnalysis(
            project_id=self.project.id,
            boq_item_id=self.boq_non_sor.id,
            item_description="Vendor Quotation Coating",
            unit=self.boq_non_sor.unit,
            market_rate_source="Vendor Quotation",
            market_rate=4500.0,
            supporting_document_id=self.doc.id,
            status="PENDING_EE_REVIEW",
            rate_type="Market Rate",
            created_by_id=self.site_user.id
        )
        self.db.add(analysis)
        self.db.commit()

        # Update to Published Index -> document remains optional and update succeeds
        res = self.client.put(
            f"/api/non-sor-rate-analysis/{analysis.id}",
            json={"market_rate_source": "Published Index"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["market_rate_source"], "Published Index")

    # -------------------------------------------------------------
    # TEST 4: Vendor Quotation with Document Success
    # -------------------------------------------------------------
    def test_04_vendor_quotation_with_doc_success(self):
        """Vendor Quotation succeeds when document_id is provided."""
        payload = {
            "project_id": self.project.id,
            "boq_item_id": self.boq_non_sor.id,
            "item_description": self.boq_non_sor.item_name,
            "unit": self.boq_non_sor.unit,
            "market_rate_source": "Vendor Quotation",
            "market_rate": 1400.0,
            "supporting_document_id": self.doc.id,
            "analysis_remarks": "Quotation attached from Asian Paints Commercial Division."
        }
        res = self.client.post(
            "/api/non-sor-rate-analysis",
            json=payload,
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["supporting_document_id"], self.doc.id)
        self.assertIsNotNone(data["supporting_document_name"])
        self.assertEqual(data["supporting_document_name"], "vendor_quote_epoxy_coat.pdf")

    # -------------------------------------------------------------
    # TEST 5: Mandatory Item Description Validation
    # -------------------------------------------------------------
    def test_05_mandatory_item_description(self):
        """Verify item_description is required and cannot be empty."""
        payload = {
            "project_id": self.project.id,
            "boq_item_id": self.boq_non_sor.id,
            "item_description": "   ",
            "unit": self.boq_non_sor.unit,
            "market_rate_source": "Manual Entry",
            "market_rate": 1350.0,
            "analysis_remarks": "Test remarks"
        }
        res = self.client.post(
            "/api/non-sor-rate-analysis",
            json=payload,
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Item Description is required", res.json()["detail"])

    # -------------------------------------------------------------
    # TEST 6: EE Approval Workflow
    # -------------------------------------------------------------
    def test_06_ee_approval_workflow(self):
        """Executive Engineer approves pending Non-SOR analysis."""
        analysis = NonSorRateAnalysis(
            project_id=self.project.id,
            boq_item_id=self.boq_non_sor.id,
            item_description=self.boq_non_sor.item_name,
            unit=self.boq_non_sor.unit,
            market_rate_source="Manual Entry",
            market_rate=1350.0,
            analysis_remarks="Calculated market rate analysis.",
            status="PENDING_EE_REVIEW",
            rate_type="Market Rate",
            created_by_id=self.site_user.id
        )
        self.db.add(analysis)
        self.db.commit()

        res = self.client.post(
            f"/api/non-sor-rate-analysis/{analysis.id}/approve",
            headers={"Authorization": f"Bearer demo-token-{self.ee_user.id}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "APPROVED")
        self.assertEqual(data["reviewed_by_id"], self.ee_user.id)
        self.assertIsNotNone(data["reviewed_at"])

    # -------------------------------------------------------------
    # TEST 7: EE Rejection Workflow
    # -------------------------------------------------------------
    def test_07_ee_rejection_workflow(self):
        """Executive Engineer rejects pending Non-SOR analysis."""
        analysis = NonSorRateAnalysis(
            project_id=self.project.id,
            boq_item_id=self.boq_non_sor.id,
            item_description=self.boq_non_sor.item_name,
            unit=self.boq_non_sor.unit,
            market_rate_source="Manual Entry",
            market_rate=2500.0,
            analysis_remarks="Inflated rate requested.",
            status="PENDING_EE_REVIEW",
            rate_type="Market Rate",
            created_by_id=self.site_user.id
        )
        self.db.add(analysis)
        self.db.commit()

        res = self.client.post(
            f"/api/non-sor-rate-analysis/{analysis.id}/reject",
            json={"action": "REJECT", "rejection_reason": "Rate is 80% higher than market benchmarks. Rejected."},
            headers={"Authorization": f"Bearer demo-token-{self.ee_user.id}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "REJECTED")
        self.assertEqual(data["reviewed_by_id"], self.ee_user.id)
        self.assertEqual(data["rejection_reason"], "Rate is 80% higher than market benchmarks. Rejected.")

    # -------------------------------------------------------------
    # TEST 8: Role Authorization Control
    # -------------------------------------------------------------
    def test_08_role_authorization_rejection(self):
        """Unauthorized role (e.g. site_engineer) cannot approve or reject analysis."""
        analysis = NonSorRateAnalysis(
            project_id=self.project.id,
            boq_item_id=self.boq_non_sor.id,
            item_description=self.boq_non_sor.item_name,
            unit=self.boq_non_sor.unit,
            market_rate_source="Manual Entry",
            market_rate=1350.0,
            analysis_remarks="Calculated market rate analysis.",
            status="PENDING_EE_REVIEW",
            rate_type="Market Rate",
            created_by_id=self.site_user.id
        )
        self.db.add(analysis)
        self.db.commit()

        res = self.client.post(
            f"/api/non-sor-rate-analysis/{analysis.id}/approve",
            headers={"Authorization": f"Bearer demo-token-{self.site_user.id}"}
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("Only authorized Executive Engineer", res.json()["detail"])

    # -------------------------------------------------------------
    # TEST 9: Approved Market Rates Available for PSC-05 Detailed Estimate
    # -------------------------------------------------------------
    def test_09_approved_market_rates_available_for_psc05(self):
        """Only APPROVED market rates are returned for PSC-05 estimate lookup."""
        analysis = NonSorRateAnalysis(
            project_id=self.project.id,
            boq_item_id=self.boq_non_sor.id,
            item_description=self.boq_non_sor.item_name,
            unit=self.boq_non_sor.unit,
            market_rate_source="Manual Entry",
            market_rate=1350.0,
            analysis_remarks="Verified epoxy rate.",
            status="APPROVED",
            rate_type="Market Rate",
            created_by_id=self.site_user.id,
            reviewed_by_id=self.ee_user.id,
            reviewed_at=datetime.utcnow()
        )
        self.db.add(analysis)
        self.db.commit()

        res = self.client.get(f"/api/non-sor-rate-analysis/approved/{self.project.id}")
        self.assertEqual(res.status_code, 200)
        items = res.json()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], analysis.id)
        self.assertEqual(items[0]["rate_type"], "Market Rate")
        self.assertEqual(items[0]["market_rate"], 1350.0)

    # -------------------------------------------------------------
    # TEST 10: Pending Non-SOR Protection from PSC-05 Detailed Estimate
    # -------------------------------------------------------------
    def test_10_pending_market_rate_protection(self):
        """Unapproved pending rates are excluded from approved market rates list."""
        analysis_pending = NonSorRateAnalysis(
            project_id=self.project.id,
            boq_item_id=self.boq_non_sor.id,
            item_description=self.boq_non_sor.item_name,
            unit=self.boq_non_sor.unit,
            market_rate_source="Manual Entry",
            market_rate=1350.0,
            analysis_remarks="Pending approval.",
            status="PENDING_EE_REVIEW",
            rate_type="Market Rate",
            created_by_id=self.site_user.id
        )
        self.db.add(analysis_pending)
        self.db.commit()

        res = self.client.get(f"/api/non-sor-rate-analysis/approved/{self.project.id}")
        self.assertEqual(res.status_code, 200)
        items = res.json()
        self.assertEqual(len(items), 0)

    # -------------------------------------------------------------
    # TEST 11: Reconcile Rates Report Generation
    # -------------------------------------------------------------
    def test_11_reconcile_rates_report(self):
        """Report detects when a new SOR edition adds an item matching an existing Non-SOR analysis."""
        analysis = NonSorRateAnalysis(
            project_id=self.project.id,
            boq_item_id=self.boq_non_sor.id,
            item_description="Specialized Epoxy Anti-Corrosive Coating for Submerged Steel Support",
            unit="m²",
            market_rate_source="Manual Entry",
            market_rate=1350.0,
            analysis_remarks="Approved custom epoxy coating.",
            status="APPROVED",
            rate_type="Market Rate",
            created_by_id=self.site_user.id,
            reviewed_by_id=self.ee_user.id,
            reviewed_at=datetime.utcnow()
        )
        self.db.add(analysis)
        self.db.commit()

        # Add matching item in DSR 2026 (newer edition)
        sor_new = ScheduleOfRates(
            sor_code="SOR-2026-COAT-99",
            category="Specialized Coating",
            description="Specialized Epoxy Anti-Corrosive Coating for Submerged Steel Support",
            unit="m²",
            base_rate=1280.00,
            rate=1280.00,
            cost_index=1.00,
            effective_from=datetime.utcnow(),
            sor_edition_id=self.edition_v2.id,
            sor_region_id=self.region.id,
            status="Active"
        )
        self.db.add(sor_new)
        self.db.commit()

        # Call reconcile report
        res = self.client.get(f"/api/non-sor-rate-analysis/reconcile-report/{self.project.id}")
        self.assertEqual(res.status_code, 200)
        report = res.json()
        self.assertEqual(len(report), 1)
        item = report[0]
        self.assertEqual(item["id"], analysis.id)
        self.assertTrue(item["is_reconciled"])
        self.assertEqual(item["newer_sor_code"], "SOR-2026-COAT-99")
        self.assertEqual(item["newer_sor_edition"], self.edition_v2.name)
        self.assertEqual(item["newer_sor_rate"], 1280.00)
        # Historical rate remains unaltered
        self.assertEqual(analysis.market_rate, 1350.0)

    # -------------------------------------------------------------
    # TEST 12: Document Upload Endpoint
    # -------------------------------------------------------------
    def test_12_upload_document_endpoint(self):
        """Upload file via endpoint and verify Document record creation."""
        file_content = b"%PDF-1.4 Mock PDF Content For Vendor Quotation"
        files = {"file": ("vendor_quotation_xyz.pdf", file_content, "application/pdf")}
        res = self.client.post("/api/non-sor-rate-analysis/upload-document", files=files)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["file_name"], "vendor_quotation_xyz.pdf")
        self.assertTrue(os.path.exists(data["file_path"]))
        # Cleanup file
        if os.path.exists(data["file_path"]):
            os.remove(data["file_path"])

    # -------------------------------------------------------------
    # TEST 13: Update Pending Non-SOR
    # -------------------------------------------------------------
    def test_13_update_pending_analysis(self):
        """Update fields of a pending Non-SOR analysis."""
        analysis = NonSorRateAnalysis(
            project_id=self.project.id,
            boq_item_id=self.boq_non_sor.id,
            item_description=self.boq_non_sor.item_name,
            unit=self.boq_non_sor.unit,
            market_rate_source="Manual Entry",
            market_rate=1350.0,
            analysis_remarks="Initial draft.",
            status="PENDING_EE_REVIEW",
            rate_type="Market Rate",
            created_by_id=self.site_user.id
        )
        self.db.add(analysis)
        self.db.commit()

        update_payload = {
            "market_rate": 1380.0,
            "analysis_remarks": "Updated after revised site measurement."
        }
        res = self.client.put(
            f"/api/non-sor-rate-analysis/{analysis.id}",
            json=update_payload
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["market_rate"], 1380.0)
        self.assertEqual(data["analysis_remarks"], "Updated after revised site measurement.")

    # -------------------------------------------------------------
    # TEST 14: Get Project Non-SOR List
    # -------------------------------------------------------------
    def test_14_get_project_analyses_list(self):
        """Get all Non-SOR rate analyses for a project."""
        a1 = NonSorRateAnalysis(
            project_id=self.project.id,
            boq_item_id=self.boq_non_sor.id,
            item_description="Item 1",
            unit="m²",
            market_rate_source="Manual Entry",
            market_rate=100.0,
            analysis_remarks="Analysis 1",
            status="PENDING_EE_REVIEW",
            rate_type="Market Rate",
            created_by_id=self.site_user.id
        )
        a2 = NonSorRateAnalysis(
            project_id=self.project.id,
            boq_item_id=self.boq_non_sor.id,
            item_description="Item 2",
            unit="m²",
            market_rate_source="Manual Entry",
            market_rate=200.0,
            analysis_remarks="Analysis 2",
            status="APPROVED",
            rate_type="Market Rate",
            created_by_id=self.site_user.id
        )
        self.db.add_all([a1, a2])
        self.db.commit()

        res_all = self.client.get(f"/api/non-sor-rate-analysis/project/{self.project.id}")
        self.assertEqual(res_all.status_code, 200)
        self.assertEqual(len(res_all.json()), 2)

if __name__ == "__main__":
    unittest.main()
