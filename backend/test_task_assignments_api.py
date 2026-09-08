import urllib.request
import json
from datetime import date, timedelta

BASE_URL = "http://127.0.0.1:8000/api"

def make_request(url, method="GET", data=None):
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        res_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(res_body)
        except Exception:
            parsed = {"detail": res_body}
        return e.code, parsed

def run_tests():
    print("==================================================")
    print("RUNNING TASK ASSIGNMENT USER & ROLE VALIDATION TEST SUITE")
    print("==================================================")

    # 1. Fetch available project, WBS tasks, and users
    status, projects = make_request(f"{BASE_URL}/projects/")
    assert status == 200 and len(projects) > 0, "No projects found!"
    proj = projects[0] # Greenfield Data Center Park
    proj_id = proj["id"]
    print(f"[PASS] Using Project: {proj['name']} (ID: {proj_id})")

    status, wbs_items = make_request(f"{BASE_URL}/wbs/project/{proj_id}")
    assert status == 200 and len(wbs_items) > 0, "No WBS items found for project!"

    # Find Phase -> Task -> Subtask
    phase = None
    task = None
    subtask = None

    for item in wbs_items:
        if item.get("parent_task_id") is None or item.get("task_level") == "Phase":
            phase = item
            break
    
    for item in wbs_items:
        if phase and item.get("parent_task_id") == phase["id"]:
            task = item
            break

    for item in wbs_items:
        if task and item.get("parent_task_id") == task["id"]:
            subtask = item
            break

    assert phase and task, "WBS Phase/Task hierarchy incomplete!"

    status, users = make_request(f"{BASE_URL}/auth/users")
    assert status == 200, "Failed to fetch system users!"

    # Identify legitimate internal project team members and external customer accounts
    internal_users = [u for u in users if u["role"] != "customer"]
    customer_users = [u for u in users if u["role"] == "customer"]

    assert len(internal_users) >= 2, "Need at least 2 internal users for tests!"
    user1 = internal_users[0] # System Admin or Site Engineer
    user2 = internal_users[1] # Project Manager or Management
    cust_user = customer_users[0] if customer_users else None

    print(f"[PASS] Internal Team Member 1: '{user1['full_name']}' (ID: {user1['id']}, Role: {user1['role']})")
    print(f"[PASS] Internal Team Member 2: '{user2['full_name']}' (ID: {user2['id']}, Role: {user2['role']})")
    if cust_user:
        print(f"[PASS] External Customer User: '{cust_user['full_name']}' (ID: {cust_user['id']}, Role: {cust_user['role']})")

    # Clean up test assignments for repeatability
    target_sub_id = subtask["id"] if subtask else None
    status, existing = make_request(f"{BASE_URL}/task-assignments?project_id={proj_id}")
    if status == 200 and isinstance(existing, list):
        for e in existing:
            if e.get("subtask_id") == target_sub_id or (target_sub_id is None and e.get("task_id") == task["id"]):
                make_request(f"{BASE_URL}/task-assignments/{e['id']}", "DELETE")

    # Ensure user1 and user2 belong to project team for test repeatability
    for u in [user1, user2]:
        team_payload = {
            "project_id": proj_id,
            "user_id": u["id"],
            "project_role": "PROJECT MANAGER" if u["id"] == user2["id"] else "SITE ENGINEER",
            "department": "Execution",
            "joining_date": date.today().isoformat(),
            "status": "ACTIVE"
        }
        make_request(f"{BASE_URL}/project-teams", "POST", team_payload)

    today = date.today()
    start_str = (today + timedelta(days=10)).isoformat()
    due_str = (today + timedelta(days=40)).isoformat()

    # --------------------------------------------------
    # TEST 1: Valid Internal Team Member Assignment
    # --------------------------------------------------
    print("\n--- TEST 1: Valid Internal Team Member Assignment ---")
    payload1 = {
        "project_id": proj_id,
        "wbs_phase_id": phase["id"],
        "task_id": task["id"],
        "subtask_id": subtask["id"] if subtask else None,
        "assigned_user_id": user1["id"],
        "role": "", # Auto-populate from user role
        "priority": "HIGH",
        "start_date": start_str,
        "due_date": due_str,
        "remarks": "Assigned to internal project engineer"
    }
    status, res1 = make_request(f"{BASE_URL}/task-assignments", "POST", payload1)
    assert status == 201, f"TEST 1 Failed: Expected 201, got {status} ({res1})"
    assign_id1 = res1["id"]
    assign_ref1 = res1["assignment_ref"]
    print(f"[PASS] TEST 1 PASSED: Created Task Assignment {assign_ref1} for '{res1['assigned_user_name']}' (Role: '{res1['role']}')")

    # --------------------------------------------------
    # TEST 2: Customer Account Assignment Rejection
    # --------------------------------------------------
    if cust_user:
        print("\n--- TEST 2: Customer Account Assignment Backend Rejection ---")
        payload_cust = dict(payload1)
        payload_cust["assigned_user_id"] = cust_user["id"]
        status, res_cust = make_request(f"{BASE_URL}/task-assignments", "POST", payload_cust)
        assert status == 400, f"TEST 2 Failed: Expected 400 Bad Request, got {status} ({res_cust})"
        print(f"[PASS] TEST 2 PASSED: Backend rejected customer account assignment: {res_cust.get('detail')}")

    # --------------------------------------------------
    # TEST 3: Reassign to Internal Team Member
    # --------------------------------------------------
    print("\n--- TEST 3: Reassign to Legitimate Internal Team Member ---")
    reassign_payload = {
        "new_user_id": user2["id"],
        "remarks": "Reassigned to internal project manager"
    }
    status, res3 = make_request(f"{BASE_URL}/task-assignments/{assign_id1}/reassign", "POST", reassign_payload)
    assert status == 200, f"TEST 3 Failed: Expected 200, got {status} ({res3})"
    assert res3["assigned_user_id"] == user2["id"]
    print(f"[PASS] TEST 3 PASSED: Task reassigned to '{res3['assigned_user_name']}' (Role: '{res3['role']}')")

    # --------------------------------------------------
    # TEST 4: Reassign to Customer Account Rejection
    # --------------------------------------------------
    if cust_user:
        print("\n--- TEST 4: Reassign to Customer Account Backend Rejection ---")
        reassign_cust_payload = {
            "new_user_id": cust_user["id"],
            "remarks": "Attempting invalid customer reassignment"
        }
        status, res4 = make_request(f"{BASE_URL}/task-assignments/{assign_id1}/reassign", "POST", reassign_cust_payload)
        assert status == 400, f"TEST 4 Failed: Expected 400 Bad Request, got {status} ({res4})"
        print(f"[PASS] TEST 4 PASSED: Backend rejected reassignment to customer: {res4.get('detail')}")

    # --------------------------------------------------
    # TEST 5: Persistence & Role Consistency
    # --------------------------------------------------
    print("\n--- TEST 5: Persistence & Role Consistency Verification ---")
    status, res5 = make_request(f"{BASE_URL}/task-assignments/{assign_id1}")
    assert status == 200 and res5["assignment_ref"] == assign_ref1
    assert "Customer" not in res5["role"], f"Role '{res5['role']}' unexpectedly contains Customer!"
    print(f"[PASS] TEST 5 PASSED: Retrieved assignment {assign_ref1} persisted with clean internal role '{res5['role']}'")

    print("\n==================================================")
    print("ALL USER & ROLE VALIDATION TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
