import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def http_req(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    
    encoded_data = None
    if data is not None:
        if isinstance(data, dict):
            headers["Content-Type"] = "application/json"
            encoded_data = json.dumps(data).encode("utf-8")
        elif isinstance(data, bytes):
            encoded_data = data

    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        resp_body = e.read().decode("utf-8")
        try:
            body_json = json.loads(resp_body)
        except Exception:
            body_json = {"detail": resp_body}
        return e.code, body_json

def run_tests():
    print("=" * 70)
    print("RUNNING AUTOMATED TEST SUITE: PROJECT TEAM CREATION & INTEGRATION")
    print("=" * 70)

    # 0. Login as admin
    status_code, login_res = http_req(
        f"{BASE_URL}/api/auth/login",
        method="POST",
        data={"username_or_email": "admin", "password": "admin123"}
    )
    if status_code != 200:
        print(f"[FAIL] Authentication failed: {status_code} {login_res}")
        sys.exit(1)
    
    token = login_res["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] Authentication successful as admin")

    # Fetch projects
    _, projects = http_req(f"{BASE_URL}/api/projects", method="GET", headers=headers)
    
    greenfield = next((p for p in projects if "Greenfield" in p["name"]), None)
    riverside = next((p for p in projects if "Riverside" in p["name"]), None)

    if not greenfield or not riverside:
        print("[FAIL] Test projects not found!")
        sys.exit(1)

    print(f"[*] Greenfield Project ID: {greenfield['id']} ({greenfield['name']})")
    print(f"[*] Riverside Project ID: {riverside['id']} ({riverside['name']})")

    # Fetch eligible users
    _, eligible_users = http_req(f"{BASE_URL}/api/project-teams/eligible-users", method="GET", headers=headers)
    print(f"[*] Eligible Users Found: {len(eligible_users)}")

    procurement_user = next((u for u in eligible_users if u["username"] == "procurement"), None)
    if not procurement_user:
        procurement_user = eligible_users[0]

    # TEST 1: Add team member
    print("\n--- TEST 1: Add Team Member ---")
    add_payload = {
        "project_id": greenfield["id"],
        "user_id": procurement_user["id"],
        "project_role": "SITE ENGINEER",
        "department": "Execution",
        "responsibility": "Foundation concrete execution supervision",
        "joining_date": "2026-03-01",
        "remarks": "Assigned for Phase 2 site supervision",
        "status": "ACTIVE"
    }

    # Clean up existing test record for procurement_user on greenfield if any
    _, existing_team = http_req(f"{BASE_URL}/api/project-teams/project/{greenfield['id']}", method="GET", headers=headers)
    for m in existing_team.get("members", []):
        if m["user_id"] == procurement_user["id"]:
            http_req(f"{BASE_URL}/api/project-teams/{m['id']}", method="DELETE", headers=headers)

    add_code, new_member = http_req(f"{BASE_URL}/api/project-teams", method="POST", data=add_payload, headers=headers)
    assert add_code == 201, f"Expected 201, got {add_code}: {new_member}"
    member_id = new_member["id"]
    assert new_member["status"] == "ACTIVE"
    assert new_member["project_role"] == "SITE ENGINEER"
    print(f"[PASS] Added user '{procurement_user['full_name']}' to project as ACTIVE {new_member['project_role']} (ID #{member_id})")

    # TEST 2: Persistence
    print("\n--- TEST 2: Persistence Verification ---")
    list_code, team_list = http_req(f"{BASE_URL}/api/project-teams/project/{greenfield['id']}", method="GET", headers=headers)
    assert list_code == 200
    members = team_list["members"]
    persisted = next((m for m in members if m["id"] == member_id), None)
    assert persisted is not None
    assert persisted["status"] == "ACTIVE"
    print("[PASS] Team membership persisted across API requests")

    # TEST 3: Duplicate Active Membership Prevention
    print("\n--- TEST 3: Duplicate Membership Rejection ---")
    dup_code, dup_res = http_req(f"{BASE_URL}/api/project-teams", method="POST", data=add_payload, headers=headers)
    assert dup_code == 400, f"Expected 400 Bad Request, got {dup_code}: {dup_res}"
    print(f"[PASS] Duplicate active membership correctly rejected: {dup_res['detail']}")

    # TEST 4: Multiple Projects Membership
    print("\n--- TEST 4: Multiple Projects Membership ---")
    multi_payload = {
        "project_id": riverside["id"],
        "user_id": procurement_user["id"],
        "project_role": "PROCUREMENT LEAD",
        "department": "Procurement",
        "responsibility": "Vendor coordination for Riverside project",
        "joining_date": "2026-03-05",
        "remarks": "Allowed to belong to multiple projects",
        "status": "ACTIVE"
    }

    # Clean existing for riverside if any
    _, river_team = http_req(f"{BASE_URL}/api/project-teams/project/{riverside['id']}", method="GET", headers=headers)
    for m in river_team.get("members", []):
        if m["user_id"] == procurement_user["id"]:
            http_req(f"{BASE_URL}/api/project-teams/{m['id']}", method="DELETE", headers=headers)

    multi_code, multi_member = http_req(f"{BASE_URL}/api/project-teams", method="POST", data=multi_payload, headers=headers)
    assert multi_code == 201, f"Expected 201, got {multi_code}: {multi_member}"
    print(f"[PASS] User successfully added to second project (Riverside) as {multi_member['project_role']}")

    # TEST 5: Deactivate Member
    print("\n--- TEST 5: Deactivate Member ---")
    deact_code, deact_member = http_req(f"{BASE_URL}/api/project-teams/{member_id}/toggle-status", method="POST", headers=headers)
    assert deact_code == 200
    assert deact_member["status"] == "INACTIVE"
    print(f"[PASS] Member #{member_id} status toggled to INACTIVE")

    # TEST 6: Task Assignment Restriction (Inactive / Non-member user)
    print("\n--- TEST 6: Task Assignment Restriction ---")
    _, wbs_nodes = http_req(f"{BASE_URL}/api/wbs/project/{greenfield['id']}", method="GET", headers=headers)
    if not wbs_nodes:
        print("[FAIL] WBS nodes empty")
        sys.exit(1)
    
    phases = [w for w in wbs_nodes if (w.get("task_level") or "").lower() == "phase" or not w.get("parent_task_id")]
    phase_id = phases[0]["id"] if phases else wbs_nodes[0]["id"]
    tasks = [w for w in wbs_nodes if w.get("parent_task_id") == phase_id]
    task_id = tasks[0]["id"] if tasks else wbs_nodes[0]["id"]

    invalid_task_payload = {
        "project_id": greenfield["id"],
        "wbs_phase_id": phase_id,
        "task_id": task_id,
        "assigned_user_id": procurement_user["id"], # INACTIVE on greenfield!
        "role": "Site Engineer",
        "priority": "HIGH",
        "start_date": "2026-09-10",
        "due_date": "2026-09-20",
        "remarks": "Test assignment for inactive user"
    }
    task_fail_code, task_fail_res = http_req(f"{BASE_URL}/api/task-assignments", method="POST", data=invalid_task_payload, headers=headers)
    assert task_fail_code == 400, f"Expected 400 Bad Request, got {task_fail_code}: {task_fail_res}"
    print(f"[PASS] Backend rejected task assignment for INACTIVE member: {task_fail_res['detail']}")

    # Re-activate procurement_user for Test 7
    http_req(f"{BASE_URL}/api/project-teams/{member_id}/toggle-status", method="POST", headers=headers)

    # Clean up existing test assignment if present
    _, existing_assignments = http_req(f"{BASE_URL}/api/task-assignments?project_id={greenfield['id']}", method="GET", headers=headers)
    for a in existing_assignments:
        if a["assigned_user_id"] == procurement_user["id"] and a["task_id"] == task_id:
            http_req(f"{BASE_URL}/api/task-assignments/{a['id']}", method="DELETE", headers=headers)

    # TEST 7: Valid Task Assignment for ACTIVE team member
    print("\n--- TEST 7: Valid Task Assignment ---")
    valid_task_payload = {
        "project_id": greenfield["id"],
        "wbs_phase_id": phase_id,
        "task_id": task_id,
        "assigned_user_id": procurement_user["id"], # Now ACTIVE!
        "role": "Site Engineer",
        "priority": "HIGH",
        "start_date": "2026-09-10",
        "due_date": "2026-09-20",
        "remarks": "Valid task assignment for active member"
    }
    task_pass_code, created_assignment = http_req(f"{BASE_URL}/api/task-assignments", method="POST", data=valid_task_payload, headers=headers)
    assert task_pass_code == 201, f"Expected 201, got {task_pass_code}: {created_assignment}"
    print(f"[PASS] Task assignment created successfully: Ref {created_assignment['assignment_ref']}")

    # TEST 8: Existing Assignments Verification
    print("\n--- TEST 8: Existing Task Assignments Verification ---")
    assign_code, all_assignments = http_req(f"{BASE_URL}/api/task-assignments?project_id={greenfield['id']}", method="GET", headers=headers)
    assert assign_code == 200
    assert len(all_assignments) > 0
    print(f"[PASS] Existing task assignments remain intact ({len(all_assignments)} assignments found)")

    # TEST 9: Work Plan & BOQ Non-Regression
    print("\n--- TEST 9: Non-Regression Check (Work Plan & BOQ) ---")
    wp_code, work_plans = http_req(f"{BASE_URL}/api/work-plans?project_id={greenfield['id']}", method="GET", headers=headers)
    assert wp_code == 200
    print(f"[PASS] Work Plan API working cleanly ({len(work_plans)} work plans found)")

    boq_code, boq_items = http_req(f"{BASE_URL}/api/boq-mb/boq/project/{greenfield['id']}", method="GET", headers=headers)
    assert boq_code == 200
    print(f"[PASS] BOQ Items API working cleanly ({len(boq_items)} BOQ items found)")

    # TEST 10: Audit Trail & Detail View
    print("\n--- TEST 10: Audit Trail & Detail View ---")
    det_code, detail = http_req(f"{BASE_URL}/api/project-teams/{member_id}", method="GET", headers=headers)
    assert det_code == 200
    assert detail["task_assignment_count"] >= 1
    assert len(detail["audits"]) >= 2  # ADDED, DEACTIVATED, ACTIVATED
    print(f"[PASS] Team member detail view returns {detail['task_assignment_count']} assigned tasks and {len(detail['audits'])} audit log entries")

    print("=" * 70)
    print("ALL 10 TEST SCENARIOS PASSED PERFECTLY (100% SUCCESS)")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
