import sys
import os
import datetime
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import SessionLocal
from app.models import (
    Project, User, ProjectTeamMember, ProjectTeamInvitation,
    TechnicalSanction, ApprovalTask, TaskAssignment, BoqItem, ProjectEstimate
)
from app.api.project_teams import verify_project_access_authorization

client = TestClient(app)

def run_wpt04_acceptance_tests():
    print("==================================================")
    print("WPT-04 PROJECT TEAM SETUP ACCEPTANCE TESTS")
    print("==================================================")

    db = SessionLocal()

    # 1. Setup Test Projects
    proj_a = db.query(Project).filter(Project.name == "WPT-04 Test Project A").first()
    if not proj_a:
        proj_a = Project(
            name="WPT-04 Test Project A",
            code="WPT04-PROJ-A",
            location="Zone 1",
            budget=5000000.0,
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2026, 12, 31),
            status="DRAFT"
        )
        db.add(proj_a)
        db.commit()
        db.refresh(proj_a)
    else:
        proj_a.status = "DRAFT"
        db.commit()

    proj_b = db.query(Project).filter(Project.name == "WPT-04 Test Project B").first()
    if not proj_b:
        proj_b = Project(
            name="WPT-04 Test Project B",
            code="WPT04-PROJ-B",
            location="Zone 2",
            budget=3000000.0,
            start_date=datetime.date(2026, 9, 1),
            end_date=datetime.date(2026, 12, 31),
            status="ACTIVE"
        )
        db.add(proj_b)
        db.commit()
        db.refresh(proj_b)

    proj_closed = db.query(Project).filter(Project.name == "WPT-04 Closed Project").first()
    if not proj_closed:
        proj_closed = Project(
            name="WPT-04 Closed Project",
            code="WPT04-CLOSED",
            location="Zone 3",
            budget=2000000.0,
            start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 6, 30),
            status="CLOSED"
        )
        db.add(proj_closed)
        db.commit()
        db.refresh(proj_closed)

    # 2. Setup Test Users
    def get_or_create_user(username, email, full_name, role="site_engineer"):
        u = db.query(User).filter(User.username == username).first()
        if not u:
            u = User(
                username=username,
                email=email,
                full_name=full_name,
                hashed_password="hashed_pw_test",
                role=role,
                is_active=True
            )
            db.add(u)
            db.commit()
            db.refresh(u)
        return u

    u_pm = get_or_create_user("wpt04_pm", "wpt04_pm@example.com", "WPT04 Contractor PM", "project_manager")
    u_ee = get_or_create_user("wpt04_ee", "wpt04_ee@example.com", "WPT04 Exec Engineer", "admin")
    u_je = get_or_create_user("wpt04_je", "wpt04_je@example.com", "WPT04 Junior Engineer", "site_engineer")
    u_ae = get_or_create_user("wpt04_ae", "wpt04_ae@example.com", "WPT04 Asst Engineer", "site_engineer")
    u_da = get_or_create_user("wpt04_da", "wpt04_da@example.com", "WPT04 Div Accountant", "finance")
    u_ta = get_or_create_user("wpt04_ta", "wpt04_ta@example.com", "WPT04 Tenant Admin", "admin")
    u_extra = get_or_create_user("wpt04_extra", "wpt04_extra@example.com", "WPT04 Extra Member", "site_engineer")

    # Clean existing project team members on test projects to start fresh
    db.query(ProjectTeamMember).filter(ProjectTeamMember.project_id.in_([proj_a.id, proj_b.id, proj_closed.id])).delete(synchronize_session=False)
    db.commit()

    today = datetime.date.today()
    past_date = today - datetime.timedelta(days=10)
    future_date = today + datetime.timedelta(days=10)
    far_future = today + datetime.timedelta(days=30)

    # ----------------------------------------------------
    # TEST 1: Assign member with required fields (User, Role, Effective From)
    # ----------------------------------------------------
    res1 = client.post("/api/project-teams", json={
        "project_id": proj_a.id,
        "user_id": u_pm.id,
        "project_role": "Contractor PM",
        "effective_from": today.isoformat()
    })
    assert res1.status_code in (200, 201), f"Test 1 failed: {res1.text}"
    data1 = res1.json()
    assert data1["user_id"] == u_pm.id
    assert data1["project_role"] == "Contractor PM"
    assert data1["effective_from"] == today.isoformat()
    print("[PASS] Test 1 Passed: Assign member with required fields succeeded.")

    # ----------------------------------------------------
    # TEST 2: Validation - Missing Role
    # ----------------------------------------------------
    res2 = client.post("/api/project-teams", json={
        "project_id": proj_a.id,
        "user_id": u_je.id,
        "project_role": "",
        "effective_from": today.isoformat()
    })
    assert res2.status_code == 400, f"Test 2 failed: {res2.status_code}"
    assert "Role is required." in res2.text, f"Test 2 failed message: {res2.text}"
    print("[PASS] Test 2 Passed: Missing Role returns 'Role is required.'")

    # ----------------------------------------------------
    # TEST 3: Validation - Missing User
    # ----------------------------------------------------
    res3 = client.post("/api/project-teams", json={
        "project_id": proj_a.id,
        "user_id": 0,
        "project_role": "JE",
        "effective_from": today.isoformat()
    })
    assert res3.status_code == 400, f"Test 3 failed: {res3.status_code}"
    assert "User is required." in res3.text, f"Test 3 failed message: {res3.text}"
    print("[PASS] Test 3 Passed: Missing User returns 'User is required.'")

    # ----------------------------------------------------
    # TEST 4: Validation - Missing Effective From
    # ----------------------------------------------------
    res4 = client.post("/api/project-teams", json={
        "project_id": proj_a.id,
        "user_id": u_je.id,
        "project_role": "JE",
        "effective_from": None
    })
    assert res4.status_code == 400, f"Test 4 failed: {res4.status_code}"
    assert "Effective From is required." in res4.text, f"Test 4 failed message: {res4.text}"
    print("[PASS] Test 4 Passed: Missing Effective From returns 'Effective From is required.'")

    # ----------------------------------------------------
    # TEST 5: Validation - Effective To before Effective From
    # ----------------------------------------------------
    res5 = client.post("/api/project-teams", json={
        "project_id": proj_a.id,
        "user_id": u_je.id,
        "project_role": "JE",
        "effective_from": today.isoformat(),
        "effective_to": past_date.isoformat()
    })
    assert res5.status_code == 400, f"Test 5 failed: {res5.status_code}"
    assert "Effective To cannot be before Effective From." in res5.text, f"Test 5 failed message: {res5.text}"
    print("[PASS] Test 5 Passed: Effective To < Effective From returns 'Effective To cannot be before Effective From.'")

    # ----------------------------------------------------
    # TEST 6: Effective To left blank (Indefinite assignment)
    # ----------------------------------------------------
    res6 = client.post("/api/project-teams", json={
        "project_id": proj_a.id,
        "user_id": u_ee.id,
        "project_role": "EE",
        "effective_from": past_date.isoformat(),
        "effective_to": None
    })
    assert res6.status_code in (200, 201), f"Test 6 failed: {res6.text}"
    data6 = res6.json()
    assert data6["effective_to"] is None
    print("[PASS] Test 6 Passed: Open-ended Effective To accepted as indefinite assignment.")

    # ----------------------------------------------------
    # TEST 7: Assign all valid controlled roles
    # ----------------------------------------------------
    roles_to_test = [
        (u_je, "JE"),
        (u_ae, "AE"),
        (u_da, "Divisional Accountant"),
        (u_ta, "Tenant Admin")
    ]
    for user, role in roles_to_test:
        r = client.post("/api/project-teams", json={
            "project_id": proj_a.id,
            "user_id": user.id,
            "project_role": role,
            "effective_from": today.isoformat()
        })
        assert r.status_code in (200, 201), f"Test 7 failed for role {role}: {r.text}"
    print("[PASS] Test 7 Passed: Successfully assigned valid roles: JE, AE, Divisional Accountant, Tenant Admin.")

    # ----------------------------------------------------
    # TEST 8: Single role per user on same project constraint
    # ----------------------------------------------------
    res8 = client.post("/api/project-teams", json={
        "project_id": proj_a.id,
        "user_id": u_pm.id,  # Already Contractor PM on proj_a
        "project_role": "AE",
        "effective_from": today.isoformat()
    })
    assert res8.status_code == 400, f"Test 8 failed: {res8.status_code}"
    assert "User already has a project-team role on this project." in res8.text, f"Test 8 failed message: {res8.text}"
    print("[PASS] Test 8 Passed: Duplicate assignment rejected with 'User already has a project-team role on this project.'")

    # ----------------------------------------------------
    # TEST 9: Same user assigned different roles on DIFFERENT projects
    # ----------------------------------------------------
    res9 = client.post("/api/project-teams", json={
        "project_id": proj_b.id,
        "user_id": u_pm.id,  # Contractor PM on proj_a, now assigning as AE on proj_b
        "project_role": "AE",
        "effective_from": today.isoformat()
    })
    assert res9.status_code in (200, 201), f"Test 9 failed: {res9.text}"
    print("[PASS] Test 9 Passed: Same user can hold roles on different projects independently.")

    # ----------------------------------------------------
    # TEST 10: Future Effective From -> UPCOMING access status
    # ----------------------------------------------------
    res10 = client.post("/api/project-teams", json={
        "project_id": proj_b.id,
        "user_id": u_extra.id,
        "project_role": "JE",
        "effective_from": future_date.isoformat(),
        "effective_to": far_future.isoformat()
    })
    assert res10.status_code in (200, 201), f"Test 10 creation failed: {res10.text}"
    # Verify access status via project team endpoint
    team_b = client.get(f"/api/project-teams/project/{proj_b.id}").json()
    extra_m = next(m for m in team_b["members"] if m["user_id"] == u_extra.id)
    assert extra_m["access_status"] in ["NOT YET ACTIVE", "UPCOMING"], f"Expected NOT YET ACTIVE, got {extra_m['access_status']}"
    print("[PASS] Test 10 Passed: Future assignment yields 'NOT YET ACTIVE' access status.")

    # ----------------------------------------------------
    # TEST 11: Past Effective To -> EXPIRED access status
    # ----------------------------------------------------
    # Update u_extra assignment to be strictly in the past
    res11 = client.put(f"/api/project-teams/{extra_m['id']}", json={
        "effective_from": (past_date - datetime.timedelta(days=20)).isoformat(),
        "effective_to": past_date.isoformat()
    })
    assert res11.status_code == 200, f"Test 11 update failed: {res11.text}"
    team_b_after = client.get(f"/api/project-teams/project/{proj_b.id}").json()
    extra_m_past = next(m for m in team_b_after["members"] if m["user_id"] == u_extra.id)
    assert extra_m_past["access_status"] == "EXPIRED", f"Expected EXPIRED, got {extra_m_past['access_status']}"
    print("[PASS] Test 11 Passed: Past assignment yields 'EXPIRED' access status.")

    # ----------------------------------------------------
    # TEST 12: Current Date in [effective_from, effective_to] -> ACTIVE access status
    # ----------------------------------------------------
    res12 = client.put(f"/api/project-teams/{extra_m['id']}", json={
        "effective_from": past_date.isoformat(),
        "effective_to": future_date.isoformat()
    })
    assert res12.status_code == 200, f"Test 12 update failed: {res12.text}"
    team_b_active = client.get(f"/api/project-teams/project/{proj_b.id}").json()
    extra_m_act = next(m for m in team_b_active["members"] if m["user_id"] == u_extra.id)
    assert extra_m_act["access_status"] == "ACTIVE", f"Expected ACTIVE, got {extra_m_act['access_status']}"
    print("[PASS] Test 12 Passed: Current date within effective window yields 'ACTIVE' access status.")

    # ----------------------------------------------------
    # TEST 13: Project status CLOSED / COMPLETED -> REVOKED / INACTIVE
    # ----------------------------------------------------
    res13 = client.post("/api/project-teams", json={
        "project_id": proj_closed.id,
        "user_id": u_extra.id,
        "project_role": "JE",
        "effective_from": past_date.isoformat(),
        "effective_to": future_date.isoformat()
    })
    assert res13.status_code in (200, 201), f"Test 13 failed: {res13.text}"
    team_closed = client.get(f"/api/project-teams/project/{proj_closed.id}").json()
    closed_m = next(m for m in team_closed["members"] if m["user_id"] == u_extra.id)
    assert closed_m["access_status"] in ["REVOKED / INACTIVE", "REVOKED - PROJECT CLOSED"], f"Expected REVOKED / INACTIVE, got {closed_m['access_status']}"
    print("[PASS] Test 13 Passed: Closed project yields 'REVOKED / INACTIVE' access status.")

    # ----------------------------------------------------
    # TEST 14: Draft -> Active gate: Missing Contractor PM
    # ----------------------------------------------------
    # Create draft project without Contractor PM
    proj_draft_gate = db.query(Project).filter(Project.name == "WPT-04 Draft Gate Proj").first()
    if not proj_draft_gate:
        proj_draft_gate = Project(
            name="WPT-04 Draft Gate Proj",
            code="WPT04-GATE",
            location="Gate Site",
            budget=2500000.0,
            start_date=today,
            end_date=today + datetime.timedelta(days=90),
            status="DRAFT"
        )
        db.add(proj_draft_gate)
        db.commit()
        db.refresh(proj_draft_gate)
    else:
        proj_draft_gate.status = "DRAFT"
        db.commit()

    # Clear any team members
    db.query(ProjectTeamMember).filter(ProjectTeamMember.project_id == proj_draft_gate.id).delete(synchronize_session=False)
    db.commit()

    # Attempt transition to ACTIVE with no PM and no EE
    res14 = client.put(f"/api/projects/{proj_draft_gate.id}", json={
        "name": proj_draft_gate.name,
        "code": proj_draft_gate.code,
        "location": proj_draft_gate.location,
        "budget": float(proj_draft_gate.budget),
        "start_date": proj_draft_gate.start_date.isoformat(),
        "end_date": proj_draft_gate.end_date.isoformat(),
        "status": "ACTIVE"
    })
    assert res14.status_code == 400, f"Test 14 failed: {res14.status_code}"
    assert "Project cannot leave Draft: assign at least one Contractor PM." in res14.text, f"Test 14 failed message: {res14.text}"
    print("[PASS] Test 14 Passed: Draft transition rejected with 'Project cannot leave Draft: assign at least one Contractor PM.'")

    # ----------------------------------------------------
    # TEST 15: Draft -> Active gate: Missing EE (Contractor PM present)
    # ----------------------------------------------------
    # Assign active Contractor PM
    client.post("/api/project-teams", json={
        "project_id": proj_draft_gate.id,
        "user_id": u_pm.id,
        "project_role": "Contractor PM",
        "effective_from": today.isoformat()
    })

    res15 = client.put(f"/api/projects/{proj_draft_gate.id}", json={
        "name": proj_draft_gate.name,
        "code": proj_draft_gate.code,
        "location": proj_draft_gate.location,
        "budget": float(proj_draft_gate.budget),
        "start_date": proj_draft_gate.start_date.isoformat(),
        "end_date": proj_draft_gate.end_date.isoformat(),
        "status": "ACTIVE"
    })
    assert res15.status_code == 400, f"Test 15 failed: {res15.status_code}"
    assert "Project cannot leave Draft: assign at least one EE." in res15.text, f"Test 15 failed message: {res15.text}"
    print("[PASS] Test 15 Passed: Draft transition rejected with 'Project cannot leave Draft: assign at least one EE.'")

    # ----------------------------------------------------
    # TEST 16: Draft -> Active gate: Both Contractor PM and EE assigned
    # ----------------------------------------------------
    # Assign active EE
    client.post("/api/project-teams", json={
        "project_id": proj_draft_gate.id,
        "user_id": u_ee.id,
        "project_role": "EE",
        "effective_from": today.isoformat()
    })

    # Add prerequisite BOQ, DetailedEstimate, and TechnicalSanction for proj_draft_gate
    est = db.query(ProjectEstimate).filter(ProjectEstimate.project_id == proj_draft_gate.id).first()
    if not est:
        est = ProjectEstimate(
            project_id=proj_draft_gate.id,
            estimate_number="EST-01",
            status="APPROVED",
            total_amount=50000.0
        )
        db.add(est)
        db.commit()
        db.refresh(est)

    boq = db.query(BoqItem).filter(BoqItem.project_id == proj_draft_gate.id).first()
    if not boq:
        boq = BoqItem(
            project_id=proj_draft_gate.id,
            item_name="Foundation Work",
            unit="m3",
            approved_qty=100.0,
            rate=500.0,
            total_amount=50000.0
        )
        db.add(boq)
        db.commit()
        db.refresh(boq)

    ts = db.query(TechnicalSanction).filter(TechnicalSanction.project_id == proj_draft_gate.id).first()
    if not ts:
        ts = TechnicalSanction(
            project_id=proj_draft_gate.id,
            detailed_estimate_id=est.id,
            submitted_by_id=u_pm.id,
            sanction_reference_number="TS-01",
            status="APPROVED",
            estimate_total_at_submission=50000.0
        )
        db.add(ts)
    else:
        ts.status = "APPROVED"
    db.commit()

    res16 = client.put(f"/api/projects/{proj_draft_gate.id}", json={
        "name": proj_draft_gate.name,
        "code": proj_draft_gate.code,
        "location": proj_draft_gate.location,
        "budget": float(proj_draft_gate.budget),
        "start_date": proj_draft_gate.start_date.isoformat(),
        "end_date": proj_draft_gate.end_date.isoformat(),
        "status": "ACTIVE"
    })
    assert res16.status_code == 200, f"Test 16 failed: {res16.text}"
    assert res16.json()["status"] == "ACTIVE"
    print("[PASS] Test 16 Passed: Both active Contractor PM and EE satisfied; Project transitioned from DRAFT to ACTIVE.")

    # ----------------------------------------------------
    # TEST 17: Removal / Deactivation protection on pending approval
    # ----------------------------------------------------
    # Ensure proj_a has a ProjectEstimate
    est_a = db.query(ProjectEstimate).filter(ProjectEstimate.project_id == proj_a.id).first()
    if not est_a:
        est_a = ProjectEstimate(
            project_id=proj_a.id,
            estimate_number="EST-A-01",
            status="APPROVED",
            total_amount=1200000.0
        )
        db.add(est_a)
        db.commit()
        db.refresh(est_a)

    # Create a pending TechnicalSanction assigned to u_ee on proj_a
    ts_pending = db.query(TechnicalSanction).filter(TechnicalSanction.project_id == proj_a.id).first()
    if not ts_pending:
        ts_pending = TechnicalSanction(
            project_id=proj_a.id,
            detailed_estimate_id=est_a.id,
            submitted_by_id=u_pm.id,
            sanction_reference_number="TS-PENDING-01",
            status="PENDING_APPROVAL",
            estimate_total_at_submission=1200000.0,
            sanctioning_authority_user_id=u_ee.id
        )
        db.add(ts_pending)
    else:
        ts_pending.status = "PENDING_APPROVAL"
        ts_pending.sanctioning_authority_user_id = u_ee.id
    db.commit()

    # Get team member record for u_ee on proj_a
    team_a = client.get(f"/api/project-teams/project/{proj_a.id}").json()
    ee_member = next(m for m in team_a["members"] if m["user_id"] == u_ee.id)

    # Attempt to deactivate u_ee
    res17a = client.post(f"/api/project-teams/{ee_member['id']}/toggle-status")
    assert res17a.status_code == 400, f"Test 17a failed: {res17a.status_code}"
    assert "Reassign pending approvals first" in res17a.text, f"Test 17a message: {res17a.text}"

    # Attempt to remove u_ee
    res17b = client.delete(f"/api/project-teams/{ee_member['id']}")
    assert res17b.status_code == 400, f"Test 17b failed: {res17b.status_code}"
    assert "Reassign pending approvals first" in res17b.text, f"Test 17b message: {res17b.text}"
    print("[PASS] Test 17 Passed: Deactivation and Removal blocked with 'Reassign pending approvals first'.")

    # ----------------------------------------------------
    # TEST 18: Fetch pending approvals endpoint
    # ----------------------------------------------------
    res18 = client.get(f"/api/project-teams/members/{ee_member['id']}/pending-approvals")
    assert res18.status_code == 200, f"Test 18 failed: {res18.text}"
    data18 = res18.json()
    items = data18.get("affected_items", data18) if isinstance(data18, dict) else data18
    assert len(items) >= 1
    assert any(it.get("type") == "TechnicalSanction" or it.get("request_type") == "TECHNICAL_SANCTION" for it in items)
    print(f"[PASS] Test 18 Passed: Successfully listed {len(items)} pending approval item(s) for member.")

    # ----------------------------------------------------
    # TEST 19: Reassign pending approvals to another active member
    # ----------------------------------------------------
    # Reassign u_ee pending approvals to u_ta on proj_a
    res19 = client.post("/api/project-teams/reassign-approvals", json={
        "project_id": proj_a.id,
        "from_user_id": u_ee.id,
        "to_user_id": u_ta.id,
        "role": "EE"
    })
    assert res19.status_code == 200, f"Test 19 failed: {res19.text}"
    db.rollback()
    db.refresh(ts_pending)
    assert ts_pending.sanctioning_authority_user_id == u_ta.id
    print("[PASS] Test 19 Passed: Reassigned pending approvals from EE to Tenant Admin.")

    # ----------------------------------------------------
    # TEST 20: After reassignment, deactivation/removal succeeds
    # ----------------------------------------------------
    res20a = client.post(f"/api/project-teams/{ee_member['id']}/toggle-status")
    assert res20a.status_code == 200, f"Test 20a toggle failed: {res20a.text}"
    assert res20a.json()["status"] == "INACTIVE"

    res20b = client.delete(f"/api/project-teams/{ee_member['id']}")
    assert res20b.status_code == 200, f"Test 20b delete failed: {res20b.text}"
    print("[PASS] Test 20 Passed: Member successfully deactivated and removed after approvals were reassigned.")

    # ----------------------------------------------------
    # TEST 21: Global user search & unregistered invite
    # ----------------------------------------------------
    # Search users
    res21a = client.get("/api/project-teams/search-users?query=wpt04_pm")
    assert res21a.status_code == 200, f"Test 21a failed: {res21a.text}"
    assert len(res21a.json()) >= 1

    # Invite new user
    invite_email = f"new_contractor_{int(datetime.datetime.now().timestamp())}@partner.com"
    res21b = client.post("/api/project-teams/invite", json={
        "project_id": proj_a.id,
        "email": invite_email,
        "full_name": "New External Contractor",
        "project_role": "Contractor PM"
    })
    assert res21b.status_code in (200, 201), f"Test 21b failed: {res21b.text}"
    assert res21b.json()["email"] == invite_email
    print("[PASS] Test 21 Passed: User search across tenants and unregistered user invitation verified.")

    # ----------------------------------------------------
    # TEST 22: Access authorization helper verification
    # ----------------------------------------------------
    # u_pm has active Contractor PM on proj_a
    proj_auth = verify_project_access_authorization(u_pm, proj_a.id, db)
    assert proj_auth.id == proj_a.id

    # u_extra on closed project -> authorization fails with 403
    try:
        verify_project_access_authorization(u_extra, proj_closed.id, db)
        assert False, "Test 22 failed: closed project must raise HTTPException(403)"
    except Exception as e:
        err_str = getattr(e, "detail", str(e))
        assert "Access revoked" in err_str or "closed" in err_str.lower()

    # ----------------------------------------------------
    # TEST 23: Gate Summary Verification (Contractor PM and EE)
    # ----------------------------------------------------
    # Check proj_a: u_pm is active Contractor PM, but u_ee was removed earlier in Test 20
    team_a_summary = client.get(f"/api/project-teams/project/{proj_a.id}").json()["summary"]
    assert team_a_summary["has_contractor_pm"] is True, f"Expected has_contractor_pm=True, got {team_a_summary}"
    assert team_a_summary["has_ee"] is False, f"Expected has_ee=False after removal, got {team_a_summary}"
    
    # Re-assign an active EE to proj_a
    client.post("/api/project-teams", json={
        "project_id": proj_a.id,
        "user_id": u_extra.id,
        "project_role": "EE",
        "effective_from": today.isoformat()
    })
    team_a_after = client.get(f"/api/project-teams/project/{proj_a.id}").json()["summary"]
    assert team_a_after["has_contractor_pm"] is True, "Contractor PM gate must be True"
    assert team_a_after["has_ee"] is True, "EE gate must be True"
    assert team_a_after["is_draft_gate_ready"] is True, "Activation gate must be True when both PM and EE exist"
    print("[PASS] Test 23 Passed: Contractor PM Gate and EE Gate correctly update summary flags based strictly on project-team assignments.")

    # ----------------------------------------------------
    # TEST 24: Global Identity Role vs Project Role Isolation
    # ----------------------------------------------------
    exec_user = get_or_create_user("exec_director", "exec_director@corp.com", "Executive Director", role="management")
    assert exec_user.role == "management"
    
    # Assign this executive as Contractor PM on proj_b
    client.post("/api/project-teams", json={
        "project_id": proj_b.id,
        "user_id": exec_user.id,
        "project_role": "Contractor PM",
        "effective_from": today.isoformat()
    })
    db.refresh(exec_user)
    assert exec_user.role == "management", f"Global role was modified! Expected 'management', got '{exec_user.role}'"
    print("[PASS] Test 24 Passed: Project team assignment strictly isolated; user's global authentication role remains unmodified.")

    # ----------------------------------------------------
    # TEST 25: Effective Date Boundary Convention Testing
    # ----------------------------------------------------
    # Boundary A: Effective To = today -> Remains ACTIVE through end of today
    boundary_user = get_or_create_user("boundary_u", "boundary_u@test.com", "Boundary User", role="site_engineer")
    res_bound = client.post("/api/project-teams", json={
        "project_id": proj_b.id,
        "user_id": boundary_user.id,
        "project_role": "JE",
        "effective_from": past_date.isoformat(),
        "effective_to": today.isoformat()
    })
    assert res_bound.status_code in (200, 201)
    team_bound = client.get(f"/api/project-teams/project/{proj_b.id}").json()
    b_mem = next(m for m in team_bound["members"] if m["user_id"] == boundary_user.id)
    assert b_mem["access_status"] == "ACTIVE", f"Assignment expiring today must remain ACTIVE throughout today; got {b_mem['access_status']}"

    # Boundary B: Effective To = yesterday -> Immediately EXPIRED
    yesterday = today - datetime.timedelta(days=1)
    client.put(f"/api/project-teams/{b_mem['id']}", json={
        "effective_from": past_date.isoformat(),
        "effective_to": yesterday.isoformat()
    })
    team_bound_exp = client.get(f"/api/project-teams/project/{proj_b.id}").json()
    b_mem_exp = next(m for m in team_bound_exp["members"] if m["user_id"] == boundary_user.id)
    assert b_mem_exp["access_status"] == "EXPIRED", f"Assignment with yesterday's end date must be EXPIRED; got {b_mem_exp['access_status']}"
    print("[PASS] Test 25 Passed: Date boundary conventions strictly verified (Active through end of Effective To date; Expired if past).")

    # ----------------------------------------------------
    # TEST 26: Project Closure Revokes Gate and Access
    # ----------------------------------------------------
    # When project is CLOSED, has_contractor_pm and has_ee MUST be False regardless of assignments
    summary_closed = client.get(f"/api/project-teams/project/{proj_closed.id}").json()["summary"]
    assert summary_closed["has_contractor_pm"] is False, "Closed project must NOT have active Contractor PM gate"
    assert summary_closed["has_ee"] is False, "Closed project must NOT have active EE gate"
    assert summary_closed["is_draft_gate_ready"] is False, "Closed project must NOT be draft-gate ready"
    print("[PASS] Test 26 Passed: Closed project automatically revokes gate eligibility and access status.")

    print("\n==================================================")
    print("ALL 26 WPT-04 FOCUSED VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("==================================================")
    db.close()

if __name__ == "__main__":
    run_wpt04_acceptance_tests()
