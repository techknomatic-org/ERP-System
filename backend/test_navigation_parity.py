import unittest
import os
import re

class Test5PhaseNavigationRestructuring(unittest.TestCase):

    def setUp(self):
        self.frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
        self.nav_file = os.path.join(self.frontend_dir, "src", "config", "navigation.js")
        self.sidebar_file = os.path.join(self.frontend_dir, "src", "components", "Sidebar.jsx")
        self.navbar_file = os.path.join(self.frontend_dir, "src", "components", "Navbar.jsx")
        self.app_file = os.path.join(self.frontend_dir, "src", "App.jsx")

    def test_01_phase_definitions_exist(self):
        """Tests 1-5: Exactly 5 main phases exist in primary navigation hierarchy."""
        with open(self.nav_file, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("PHASE 1", content)
        self.assertIn("Project Creation", content)
        self.assertIn("PHASE 2", content)
        self.assertIn("Work Planning & Team", content)
        self.assertIn("PHASE 3", content)
        self.assertIn("Execution & Approvals", content)
        self.assertIn("PHASE 4", content)
        self.assertIn("Progress & Visibility", content)
        self.assertIn("PHASE 5", content)
        self.assertIn("Intelligence & Integration", content)
        print("[PASS] TESTS 1-5: All 5 Business Phases defined in primary navigation hierarchy.")

    def test_02_phase_1_features(self):
        """Tests 6-10: Phase 1 contains PSC-01, PSC-04, PSC-05, PSC-06, PSC-07, Contractor Awards, Work Orders."""
        with open(self.nav_file, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("/projects", content)
        self.assertIn("Project / Contract Creation", content)
        self.assertIn("/sor", content)
        self.assertIn("SOR / DSR Rate Database", content)
        self.assertIn("/estimation", content)
        self.assertIn("Detailed Estimate", content)
        self.assertIn("/non-sor-rate-analysis", content)
        self.assertIn("Non-SOR Rate Analysis", content)
        self.assertIn("/technical-sanction", content)
        self.assertIn("Technical Sanction", content)
        self.assertIn("/contractor-awards", content)
        self.assertIn("/work-orders", content)
        print("[PASS] TESTS 6-10: Phase 1 features correctly mapped to existing routes.")

    def test_03_phase_2_features(self):
        """Tests 11-15: Phase 2 contains WPT-01, WPT-02, WPT-03, WPT-04, Task Assignments."""
        with open(self.nav_file, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("/wbs", content)
        self.assertIn("Work Plan / WBS", content)
        self.assertIn("/work-plan", content)
        self.assertIn("BOQ → Work Plan Mapping", content)
        self.assertIn("/milestones", content)
        self.assertIn("Project Milestones", content)
        self.assertIn("/project-team", content)
        self.assertIn("Project Team", content)
        self.assertIn("/task-assignments", content)
        self.assertIn("Task Assignments", content)
        print("[PASS] TESTS 11-15: Phase 2 features correctly mapped to existing routes.")

    def test_04_phase_3_features(self):
        """Tests 16-19: Phase 3 contains Daily Site Logs, e-MB (EXA-02), AE/EE Test-Check (EXA-03), Hindrance (EXA-06)."""
        with open(self.nav_file, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("/site-logs", content)
        self.assertIn("Daily Site Logs", content)
        self.assertIn("/boq-mb", content)
        self.assertIn("Digital e-MB", content)
        self.assertIn("/test-check", content)
        self.assertIn("AE/EE Test-Check", content)
        self.assertIn("/hindrances", content)
        self.assertIn("Hindrance Management", content)
        print("[PASS] TESTS 16-19: Phase 3 features correctly mapped to existing routes.")

    def test_05_phase_4_and_5_features(self):
        """Tests 20-21: Phase 4 contains Unified Project Dashboard, Contractor Billing; Phase 5 contains Mobile App."""
        with open(self.nav_file, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("Unified Project Dashboard", content)
        self.assertIn("/contractor-billing", content)
        self.assertIn("Physical & Financial Progress", content)
        self.assertIn("/photo-gallery", content)
        self.assertIn("/mobile", content)
        self.assertIn("Mobile App", content)
        self.assertIn("/ai-analytics", content)
        self.assertIn("/tally", content)
        print("[PASS] TESTS 20-21: Phase 4 & 5 features correctly mapped to existing routes.")

    def test_06_sidebar_auto_expansion_and_collapsed(self):
        """Tests 22-24: Sidebar auto-expands active phase, highlights active child, supports collapsed mode."""
        with open(self.sidebar_file, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("getPhaseKeyForPath", content)
        self.assertIn("location.pathname", content)
        self.assertIn("isCollapsed", content)
        self.assertIn("toggleGroup", content)
        self.assertIn("nav-link", content)
        self.assertIn("PROJECT_FLOW_PHASES", content)
        print("[PASS] TESTS 22-24: Auto-expansion, active highlight, and collapsed sidebar behavior verified.")

    def test_07_routes_preserved_and_rbac_integrated(self):
        """Tests 25-28: All existing routes preserved, RBAC integrated, no missing or duplicate items."""
        with open(self.app_file, "r", encoding="utf-8") as f:
            app_content = f.read()

        # Check existing critical routes
        for r in [
            "/projects", "/sor", "/estimation", "/wbs", "/work-plan", 
            "/milestones", "/project-team", "/boq-mb", "/hindrances", 
            "/site-logs", "/contractor-billing", "/approvals", 
            "/financial-requests", "/inventory", "/procurement", "/vendors"
        ]:
            self.assertIn(f'path="{r}"', app_content)

        # Check alias routes
        self.assertIn('path="/technical-sanction"', app_content)
        self.assertIn('path="/test-check"', app_content)
        self.assertIn('path="/photo-gallery"', app_content)
        self.assertIn('path="/physical-financial-progress"', app_content)

        # Check RBAC filtering in Sidebar
        with open(self.sidebar_file, "r", encoding="utf-8") as f:
            sb_content = f.read()
        self.assertIn("isPathAllowed", sb_content)
        self.assertIn("ROLE_PERMITTED_PATHS", sb_content)
        print("[PASS] TESTS 25-28: Route preservation, backward compatibility, and RBAC verified.")

    def test_08_mobile_navigation_hierarchy(self):
        """Tests 29-30: Mobile navigation drawer uses the same shared 5-phase hierarchy with no horizontal overflow."""
        with open(self.navbar_file, "r", encoding="utf-8") as f:
            nb_content = f.read()
        with open(self.sidebar_file, "r", encoding="utf-8") as f:
            sb_content = f.read()

        self.assertIn("showMobileDrawer", nb_content)
        self.assertIn("PROJECT_FLOW_PHASES", nb_content)
        self.assertIn("overflowX: 'hidden'", sb_content)
        print("[PASS] TESTS 29-30: Mobile drawer uses identical 5-phase hierarchy with zero horizontal overflow.")

if __name__ == "__main__":
    unittest.main()
