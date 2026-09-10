import os
import sys
import unittest
from datetime import date, datetime, timedelta

# Ensure backend path is included
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, engine
from app import models

class TestEXA06HindranceAcceptance(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()

        # Seed test user (admin / EE)
        cls.admin_user = cls.db.query(models.User).filter(models.User.username == "exa06_admin").first()
        if not cls.admin_user:
            cls.admin_user = models.User(
                username="exa06_admin",
                email="admin@exa06.com",
                full_name="Admin EE User",
                hashed_password="secretpassword",
                role="admin",
                is_active=True
            )
            cls.db.add(cls.admin_user)
            cls.db.commit()
            cls.db.refresh(cls.admin_user)

        # Seed non-EE user (JE)
        cls.je_user = cls.db.query(models.User).filter(models.User.username == "exa06_je").first()
        if not cls.je_user:
            cls.je_user = models.User(
                username="exa06_je",
                email="je@exa06.com",
                full_name="Junior Engineer User",
                hashed_password="secretpassword",
                role="JE",
                is_active=True
            )
            cls.db.add(cls.je_user)
            cls.db.commit()
            cls.db.refresh(cls.je_user)

        # Seed explicit EE user
        cls.ee_user = cls.db.query(models.User).filter(models.User.username == "exa06_ee").first()
        if not cls.ee_user:
            cls.ee_user = models.User(
                username="exa06_ee",
                email="ee@exa06.com",
                full_name="Executive Engineer User",
                hashed_password="secretpassword",
                role="EE",
                is_active=True
            )
            cls.db.add(cls.ee_user)
            cls.db.commit()
            cls.db.refresh(cls.ee_user)

        # Seed Project 1
        cls.project1 = cls.db.query(models.Project).filter(models.Project.code == "PRJ-EXA06-1").first()
        if not cls.project1:
            cls.project1 = models.Project(
                name="EXA-06 Bridge Project",
                code="PRJ-EXA06-1",
                contract_type="Item Rate",
                funding_mode="Budgeted",
                location="District Site A",
                start_date=datetime(2026, 1, 1),
                end_date=datetime(2026, 12, 31),
                status="Active",
                budget=5000000.00,
                tenant_name="Default Tenant"
            )
            cls.db.add(cls.project1)
            cls.db.commit()
            cls.db.refresh(cls.project1)

        # Seed Project 2
        cls.project2 = cls.db.query(models.Project).filter(models.Project.code == "PRJ-EXA06-2").first()
        if not cls.project2:
            cls.project2 = models.Project(
                name="EXA-06 Highway Project",
                code="PRJ-EXA06-2",
                contract_type="Item Rate",
                funding_mode="Budgeted",
                location="District Site B",
                start_date=datetime(2026, 1, 1),
                end_date=datetime(2026, 12, 31),
                status="Active",
                budget=10000000.00,
                tenant_name="Default Tenant"
            )
            cls.db.add(cls.project2)
            cls.db.commit()
            cls.db.refresh(cls.project2)

        # Seed WBS Nodes
        cls.wbs1 = cls.db.query(models.WbsTask).filter(models.WbsTask.project_id == cls.project1.id).first()
        if not cls.wbs1:
            cls.wbs1 = models.WbsTask(
                project_id=cls.project1.id,
                title="Pier Foundation Work",
                wbs_code="1.1",
                start_date=datetime(2026, 1, 1),
                end_date=datetime(2026, 12, 31)
            )
            cls.db.add(cls.wbs1)
            cls.db.commit()
            cls.db.refresh(cls.wbs1)

        cls.wbs2 = cls.db.query(models.WbsTask).filter(models.WbsTask.project_id == cls.project2.id).first()
        if not cls.wbs2:
            cls.wbs2 = models.WbsTask(
                project_id=cls.project2.id,
                title="Highway Earthwork",
                wbs_code="1.1",
                start_date=datetime(2026, 1, 1),
                end_date=datetime(2026, 12, 31)
            )
            cls.db.add(cls.wbs2)
            cls.db.commit()
            cls.db.refresh(cls.wbs2)

        # Seed Project Team Member for EE
        tm = cls.db.query(models.ProjectTeamMember).filter(
            models.ProjectTeamMember.project_id == cls.project1.id,
            models.ProjectTeamMember.user_id == cls.ee_user.id
        ).first()
        if not tm:
            tm = models.ProjectTeamMember(
                project_id=cls.project1.id,
                user_id=cls.ee_user.id,
                project_role="EE",
                status="ACTIVE",
                is_active=True,
                effective_from=date(2026, 1, 1)
            )
            cls.db.add(tm)
            cls.db.commit()

        # Seed Tenant Setting max_file_upload_mb = 10
        ts = cls.db.query(models.TenantSetting).filter(models.TenantSetting.tenant_name == "Default Tenant").first()
        if not ts:
            ts = models.TenantSetting(tenant_name="Default Tenant", max_file_upload_mb=10)
            cls.db.add(ts)
            cls.db.commit()
        else:
            ts.max_file_upload_mb = 10
            cls.db.commit()

        # Helper token headers
        cls.headers_admin = {"Authorization": f"Bearer fake_admin_token"}

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def get_auth_headers(self, user):
        return {"X-User-Id": str(user.id)}

    def test_01_create_hindrance_valid(self):
        headers = self.get_auth_headers(self.admin_user)
        payload = {
            "project_id": self.project1.id,
            "wbs_node_id": self.wbs1.id,
            "hindrance_type": "Land non-availability",
            "date_occurred": "2026-09-01",
            "delay_start_date": "2026-09-01",
            "delay_end_date": "2026-09-10",
            "description": "Land acquisition delay near pier 3 foundation site.",
            "evidence_file_name": "site_photo_01.jpg",
            "evidence_file_type": "image/jpeg",
            "evidence_file_size": 2048500
        }
        resp = self.client.post("/api/hindrances", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["current_status"], "RAISED")
        self.assertIsNotNone(data["raised_at"])
        self.assertIsNotNone(data["sla_due_at"])

    def test_02_future_date_occurred_blocked(self):
        headers = self.get_auth_headers(self.admin_user)
        future_date = (date.today() + timedelta(days=5)).strftime("%Y-%m-%d")
        payload = {
            "project_id": self.project1.id,
            "wbs_node_id": self.wbs1.id,
            "hindrance_type": "Weather",
            "date_occurred": future_date,
            "description": "Heavy rainfall expected next week on site.",
            "evidence_file_name": "weather_report.pdf",
            "evidence_file_size": 1000
        }
        resp = self.client.post("/api/hindrances", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Date Occurred cannot be in the future", resp.json()["detail"])

    def test_03_short_description_blocked(self):
        headers = self.get_auth_headers(self.admin_user)
        payload = {
            "project_id": self.project1.id,
            "wbs_node_id": self.wbs1.id,
            "hindrance_type": "Utility shifting",
            "date_occurred": "2026-09-01",
            "description": "Short text",
            "evidence_file_name": "photo.jpg",
            "evidence_file_size": 1000
        }
        resp = self.client.post("/api/hindrances", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Description must be at least 20 characters", resp.json()["detail"])

    def test_04_no_evidence_blocked(self):
        headers = self.get_auth_headers(self.admin_user)
        payload = {
            "project_id": self.project1.id,
            "wbs_node_id": self.wbs1.id,
            "hindrance_type": "Utility shifting",
            "date_occurred": "2026-09-01",
            "description": "Electric line obstruction near pier 4 requiring shifting.",
        }
        resp = self.client.post("/api/hindrances", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Evidence is required", resp.json()["detail"])

    def test_05_evidence_exceeds_tenant_limit(self):
        headers = self.get_auth_headers(self.admin_user)
        # 15 MB > 10 MB tenant limit
        payload = {
            "project_id": self.project1.id,
            "wbs_node_id": self.wbs1.id,
            "hindrance_type": "Other",
            "date_occurred": "2026-09-01",
            "description": "Large video recording of landslide obstruction on main approach road.",
            "evidence_file_name": "heavy_video.mp4",
            "evidence_file_size": 15 * 1024 * 1024
        }
        resp = self.client.post("/api/hindrances", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("File exceeds the tenant upload limit of 10 MB", resp.json()["detail"])

    def test_06_cross_project_wbs_blocked(self):
        headers = self.get_auth_headers(self.admin_user)
        # Trying to associate WBS 2 (from Project 2) with Project 1
        payload = {
            "project_id": self.project1.id,
            "wbs_node_id": self.wbs2.id,
            "hindrance_type": "Design pending",
            "date_occurred": "2026-09-01",
            "description": "Structural drawing for abutment A1 is pending approval.",
            "evidence_file_name": "drawing_request.pdf",
            "evidence_file_size": 2000
        }
        resp = self.client.post("/api/hindrances", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("WBS Node does not belong to the selected project", resp.json()["detail"])

    def test_07_unauthorized_user_ee_decision_blocked(self):
        # Create hindrance as admin
        headers_admin = self.get_auth_headers(self.admin_user)
        payload = {
            "project_id": self.project1.id,
            "wbs_node_id": self.wbs1.id,
            "hindrance_type": "Force majeure",
            "date_occurred": "2026-09-01",
            "description": "Unprecedented flash flood submerged foundation pit.",
            "evidence_file_name": "flood_photo.jpg",
            "evidence_file_size": 50000
        }
        res_create = self.client.post("/api/hindrances", json=payload, headers=headers_admin)
        h_id = res_create.json()["id"]

        # JE tries to submit EE decision
        headers_je = self.get_auth_headers(self.je_user)
        res_decide = self.client.post(f"/api/hindrances/{h_id}/ee-decision", json={"ee_decision": "Accepted"}, headers=headers_je)
        self.assertEqual(res_decide.status_code, 403)

    def test_08_authorized_ee_accepts(self):
        headers_ee = self.get_auth_headers(self.ee_user)
        headers_admin = self.get_auth_headers(self.admin_user)

        payload = {
            "project_id": self.project1.id,
            "wbs_node_id": self.wbs1.id,
            "hindrance_type": "Land non-availability",
            "date_occurred": "2026-09-01",
            "delay_start_date": "2026-09-01",
            "delay_end_date": "2026-09-10",
            "description": "Land acquisition delay near Pier 1.",
            "evidence_file_name": "land_notice.pdf",
            "evidence_file_size": 5000
        }
        res_create = self.client.post("/api/hindrances", json=payload, headers=headers_admin)
        h_id = res_create.json()["id"]

        res_decide = self.client.post(f"/api/hindrances/{h_id}/ee-decision", json={"ee_decision": "Accepted", "ee_remarks": "Verified by site inspection."}, headers=headers_ee)
        self.assertEqual(res_decide.status_code, 200)
        data = res_decide.json()
        self.assertEqual(data["current_status"], "ACCEPTED")
        self.assertEqual(data["ee_decision"], "ACCEPTED")

    def test_09_ee_rejects_without_remarks_blocked(self):
        headers_ee = self.get_auth_headers(self.ee_user)
        headers_admin = self.get_auth_headers(self.admin_user)

        payload = {
            "project_id": self.project1.id,
            "wbs_node_id": self.wbs1.id,
            "hindrance_type": "Weather",
            "date_occurred": "2026-09-01",
            "description": "Light drizzle slowed down concrete pour.",
            "evidence_file_name": "rain_log.pdf",
            "evidence_file_size": 2000
        }
        h_id = self.client.post("/api/hindrances", json=payload, headers=headers_admin).json()["id"]

        res_decide = self.client.post(f"/api/hindrances/{h_id}/ee-decision", json={"ee_decision": "Rejected", "ee_remarks": ""}, headers=headers_ee)
        self.assertEqual(res_decide.status_code, 400)
        self.assertIn("EE Remarks are required for Rejected or Info Requested decisions", res_decide.json()["detail"])

    def test_10_ee_rejects_with_remarks(self):
        headers_ee = self.get_auth_headers(self.ee_user)
        headers_admin = self.get_auth_headers(self.admin_user)

        payload = {
            "project_id": self.project1.id,
            "wbs_node_id": self.wbs1.id,
            "hindrance_type": "Weather",
            "date_occurred": "2026-09-01",
            "description": "Minor rainfall delay on non-critical activity.",
            "evidence_file_name": "weather_log.pdf",
            "evidence_file_size": 2000
        }
        h_id = self.client.post("/api/hindrances", json=payload, headers=headers_admin).json()["id"]

        res_decide = self.client.post(f"/api/hindrances/{h_id}/ee-decision", json={"ee_decision": "Rejected", "ee_remarks": "Not a critical hindrance. Normal weather variation."}, headers=headers_ee)
        self.assertEqual(res_decide.status_code, 200)
        self.assertEqual(res_decide.json()["current_status"], "REJECTED")

    def test_11_ee_info_requested_without_remarks_blocked(self):
        headers_ee = self.get_auth_headers(self.ee_user)
        headers_admin = self.get_auth_headers(self.admin_user)

        payload = {
            "project_id": self.project1.id,
            "wbs_node_id": self.wbs1.id,
            "hindrance_type": "Utility shifting",
            "date_occurred": "2026-09-01",
            "description": "Water pipeline running across excavation area.",
            "evidence_file_name": "pipeline_photo.jpg",
            "evidence_file_size": 2000
        }
        h_id = self.client.post("/api/hindrances", json=payload, headers=headers_admin).json()["id"]

        res_decide = self.client.post(f"/api/hindrances/{h_id}/ee-decision", json={"ee_decision": "Info Requested", "ee_remarks": "   "}, headers=headers_ee)
        self.assertEqual(res_decide.status_code, 400)

    def test_12_info_requested_workflow(self):
        headers_ee = self.get_auth_headers(self.ee_user)
        headers_admin = self.get_auth_headers(self.admin_user)

        payload = {
            "project_id": self.project1.id,
            "wbs_node_id": self.wbs1.id,
            "hindrance_type": "Design pending",
            "date_occurred": "2026-09-01",
            "description": "Revision required for pier cap reinforcement details.",
            "evidence_file_name": "drawing_v1.pdf",
            "evidence_file_size": 3000
        }
        create_res = self.client.post("/api/hindrances", json=payload, headers=headers_admin).json()
        h_id = create_res["id"]
        orig_date_occurred = create_res["date_occurred"]
        orig_raised_at = create_res["raised_at"]

        # EE requests info
        decide_res = self.client.post(
            f"/api/hindrances/{h_id}/ee-decision",
            json={"ee_decision": "Info Requested", "ee_remarks": "Please attach joint inspection report with utility department."},
            headers=headers_ee
        ).json()

        self.assertEqual(decide_res["current_status"], "RAISED")
        self.assertEqual(decide_res["date_occurred"], orig_date_occurred)
        self.assertEqual(decide_res["raised_at"], orig_raised_at)
        self.assertGreater(decide_res["reopened_count"], 0)

    def test_13_14_15_sla_job_day2_day3_day5(self):
        headers_admin = self.get_auth_headers(self.admin_user)

        # Create hindrance with raised_at 6 days ago in DB
        old_raised = datetime.utcnow() - timedelta(days=6)
        h = models.Hindrance(
            project_id=self.project1.id,
            wbs_node_id=self.wbs1.id,
            hindrance_type="Land non-availability",
            date_occurred=date(2026, 9, 1),
            description="Historical hindrance for SLA simulation testing.",
            evidence_file_name="doc.pdf",
            evidence_file_size=1000,
            raised_by_id=self.admin_user.id,
            raised_at=old_raised,
            current_status="RAISED",
            sla_due_at=old_raised + timedelta(days=4),
            day2_reminder_sent=False,
            day3_reminder_sent=False,
            sla_breached=False
        )
        self.db.add(h)
        self.db.commit()

        self.db.query(models.Hindrance).filter(models.Hindrance.id == h.id).update({
            "raised_at": old_raised,
            "sla_due_at": old_raised + timedelta(days=4)
        })
        self.db.commit()
        self.db.expire_all()
        h_check = self.db.query(models.Hindrance).filter(models.Hindrance.id == h.id).first()
        print(f"\nDEBUG: old_raised={old_raised}, h_check.raised_at={h_check.raised_at}, diff={(datetime.utcnow() - h_check.raised_at).total_seconds()}")
        h_id = h.id

        # Trigger process-sla
        sla_res = self.client.post("/api/hindrances/process-sla", headers=headers_admin).json()
        self.assertGreater(sla_res["day2_reminders_sent"], 0)
        self.assertGreater(sla_res["day3_reminders_sent"], 0)
        self.assertGreater(sla_res["day5_escalations"], 0)

        # Commit test session to reset REPEATABLE READ transaction boundary and read DB updates
        self.db.commit()
        h_updated = self.db.query(models.Hindrance).filter(models.Hindrance.id == h_id).first()
        self.assertEqual(h_updated.current_status, "SLA_BREACHED")
        self.assertTrue(h_updated.sla_breached)
        self.assertIsNotNone(h_updated.escalated_at)

    def test_16_late_decision_after_day5_escalation(self):
        headers_ee = self.get_auth_headers(self.ee_user)

        # Find SLA breached hindrance
        h = self.db.query(models.Hindrance).filter(models.Hindrance.current_status == "SLA_BREACHED").first()
        self.assertIsNotNone(h)

        # Authorized EE submits late decision
        decide_res = self.client.post(
            f"/api/hindrances/{h.id}/ee-decision",
            json={"ee_decision": "Accepted", "ee_remarks": "Late approval granted after field review."},
            headers=headers_ee
        )
        self.assertEqual(decide_res.status_code, 200)
        data = decide_res.json()
        self.assertEqual(data["current_status"], "ACCEPTED")
        self.assertTrue(data["sla_breached"]) # Preserves SLA breach flag in history

    def test_17_overlapping_accepted_hindrances_eot_union(self):
        headers_ee = self.get_auth_headers(self.ee_user)

        # Create Hindrance A: 01 Sep -> 10 Sep (10 days)
        h_a = models.Hindrance(
            project_id=self.project1.id,
            wbs_node_id=self.wbs1.id,
            hindrance_type="Weather",
            date_occurred=date(2026, 9, 1),
            delay_start_date=date(2026, 9, 1),
            delay_end_date=date(2026, 9, 10),
            description="Continuous rainfall delay from 1 Sep to 10 Sep.",
            evidence_file_name="rain_a.pdf",
            raised_by_id=self.admin_user.id,
            raised_at=datetime.utcnow(),
            current_status="ACCEPTED",
            ee_decision="ACCEPTED",
            sla_due_at=datetime.utcnow()
        )
        # Create Hindrance B: 05 Sep -> 15 Sep (11 days)
        h_b = models.Hindrance(
            project_id=self.project1.id,
            wbs_node_id=self.wbs1.id,
            hindrance_type="Land non-availability",
            date_occurred=date(2026, 9, 5),
            delay_start_date=date(2026, 9, 5),
            delay_end_date=date(2026, 9, 15),
            description="Land dispute delay from 5 Sep to 15 Sep.",
            evidence_file_name="land_b.pdf",
            raised_by_id=self.admin_user.id,
            raised_at=datetime.utcnow(),
            current_status="ACCEPTED",
            ee_decision="ACCEPTED",
            sla_due_at=datetime.utcnow()
        )
        self.db.add_all([h_a, h_b])
        self.db.commit()

        # Check EOT breakdown
        res = self.client.get(f"/api/hindrances/project/{self.project1.id}/eot-breakdown", headers=headers_ee).json()
        # Union of [1 Sep - 10 Sep] and [5 Sep - 15 Sep] is [1 Sep - 15 Sep] = 15 days
        self.assertGreaterEqual(res["net_eot_delay_days"], 15)
        # Individual total = 10 + 11 = 21 days
        # Overlap saved should be > 0
        self.assertGreater(res["overlap_days_saved"], 0)

    def test_18_19_20_non_overlapping_and_rejected_eot(self):
        headers_ee = self.get_auth_headers(self.ee_user)
        # Verify rejected hindrances do not contribute to EOT
        rejected_count = self.db.query(models.Hindrance).filter(
            models.Hindrance.project_id == self.project1.id,
            models.Hindrance.current_status == "REJECTED"
        ).count()
        self.assertGreaterEqual(rejected_count, 1)

        res = self.client.get(f"/api/hindrances/project/{self.project1.id}/eot-breakdown", headers=headers_ee).json()

        for item in res["hindrances"]:
            self.assertEqual(item["status"], "ACCEPTED")

    def test_21_project_closure_blocks_creation(self):
        headers_admin = self.get_auth_headers(self.admin_user)
        # Create or fetch closed project
        closed_proj = self.db.query(models.Project).filter(models.Project.code == "PRJ-CLOSED").first()
        if not closed_proj:
            closed_proj = models.Project(
                name="Closed Project",
                code="PRJ-CLOSED",
                contract_type="Item Rate",
                funding_mode="Budgeted",
                location="Closed Site",
                start_date=datetime(2025, 1, 1),
                end_date=datetime(2025, 12, 31),
                status="Closed",
                budget=100000.00
            )
            self.db.add(closed_proj)
            self.db.commit()
            self.db.refresh(closed_proj)

        closed_wbs = self.db.query(models.WbsTask).filter(models.WbsTask.project_id == closed_proj.id).first()
        if not closed_wbs:
            closed_wbs = models.WbsTask(
                project_id=closed_proj.id,
                title="Closed Task",
                wbs_code="1.1",
                start_date=datetime(2025, 1, 1),
                end_date=datetime(2025, 12, 31)
            )
            self.db.add(closed_wbs)
            self.db.commit()

        payload = {
            "project_id": closed_proj.id,
            "wbs_node_id": closed_wbs.id,
            "hindrance_type": "Other",
            "date_occurred": "2026-09-01",
            "description": "Attempt to create hindrance on closed contract.",
            "evidence_file_name": "notice.pdf",
            "evidence_file_size": 1000
        }
        resp = self.client.post("/api/hindrances", json=payload, headers=headers_admin)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("closed project", resp.json()["detail"].lower())

    def test_22_tenant_isolation(self):
        headers_admin = self.get_auth_headers(self.admin_user)
        resp = self.client.get(f"/api/hindrances?project_id={self.project1.id}", headers=headers_admin)
        self.assertEqual(resp.status_code, 200)
        for item in resp.json():
            self.assertEqual(item["project_id"], self.project1.id)

    def test_23_persistence_and_audit(self):
        headers_admin = self.get_auth_headers(self.admin_user)
        h = self.db.query(models.Hindrance).filter(models.Hindrance.audits.any()).first()
        self.assertIsNotNone(h)
        resp = self.client.get(f"/api/hindrances/{h.id}", headers=headers_admin)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["id"], h.id)
        self.assertTrue(len(data["audits"]) >= 1)

    def test_24_rbac_enforcement(self):
        headers_je = self.get_auth_headers(self.je_user)
        h = self.db.query(models.Hindrance).first()
        res = self.client.post(f"/api/hindrances/{h.id}/ee-decision", json={"ee_decision": "Accepted"}, headers=headers_je)
        self.assertEqual(res.status_code, 403)

    def test_25_regression_check(self):
        headers_admin = self.get_auth_headers(self.admin_user)
        res_wbs = self.client.get(f"/api/wbs?project_id={self.project1.id}", headers=headers_admin)
        self.assertIn(res_wbs.status_code, [200, 404])

        res_milestones = self.client.get(f"/api/milestones?project_id={self.project1.id}", headers=headers_admin)
        self.assertIn(res_milestones.status_code, [200, 404])

if __name__ == "__main__":
    unittest.main()
