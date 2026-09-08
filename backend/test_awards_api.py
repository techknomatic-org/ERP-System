import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

def request_json(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    if data is not None:
        if isinstance(data, dict) or isinstance(data, list):
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
        elif isinstance(data, str):
            body = data.encode("utf-8")
        else:
            body = data
    else:
        body = None

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed_err = json.loads(err_body)
        except Exception:
            parsed_err = err_body
        return e.code, parsed_err

def test_awards_flow():
    # 1. Login as admin using JSON body
    status, login_res = request_json(
        f"{BASE_URL}/api/auth/login",
        method="POST",
        data={"username_or_email": "admin", "password": "admin123"}
    )
    assert status == 200, f"Login failed ({status}): {login_res}"
    token = login_res["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[+] Logged in as admin successfully.")

    # Clear existing awards and ensure project #2 estimate is APPROVED for clean test execution
    from app.database import SessionLocal
    from app.models import ContractorAward, ProjectEstimate
    db = SessionLocal()
    db.query(ContractorAward).delete()
    est = db.query(ProjectEstimate).filter(ProjectEstimate.project_id == 2).first()
    if not est:
        est = ProjectEstimate(estimate_number="EST-2026-001", project_id=2, status="APPROVED", total_amount=61330000.00)
        db.add(est)
    else:
        est.status = "APPROVED"
        if not est.total_amount or float(est.total_amount) == 0:
            est.total_amount = 61330000.00
    db.commit()
    db.close()

    # 2. Get ready projects for award
    status, ready_projects = request_json(f"{BASE_URL}/api/contractor-awards/ready-projects", method="GET", headers=headers)
    assert status == 200, f"Get ready projects failed: {ready_projects}"
    print(f"[+] Found {len(ready_projects)} ready projects for award:")
    for rp in ready_projects:
        print(f"    - Project: {rp['project_name']} ({rp['project_code']}), Est Ref: {rp['estimate_number']}, Est Amount: INR {rp['estimated_amount']:,.2f}")

    if not ready_projects:
        from app.database import SessionLocal
        from app.models import ProjectEstimate
        db = SessionLocal()
        est = db.query(ProjectEstimate).filter(ProjectEstimate.project_id == 2).first()
        if not est:
            est = ProjectEstimate(estimate_number="EST-2026-001", project_id=2, status="APPROVED", total_amount=61330000.00)
            db.add(est)
        else:
            est.status = "APPROVED"
            if not est.total_amount or float(est.total_amount) == 0:
                est.total_amount = 61330000.00
        db.commit()
        db.close()
        status, ready_projects = request_json(f"{BASE_URL}/api/contractor-awards/ready-projects", method="GET", headers=headers)

    assert len(ready_projects) > 0, "Expected at least 1 ready project for award!"
    target_rp = ready_projects[0]

    # 3. Get vendors
    status, vendors = request_json(f"{BASE_URL}/api/vendors", method="GET", headers=headers)
    assert status == 200, f"Get vendors failed: {vendors}"
    assert len(vendors) > 0, "No vendors found!"
    target_vendor = vendors[0]
    print(f"[+] Selected Vendor: {target_vendor['name']} (ID: {target_vendor['id']})")

    # 4. Create Contractor Award (DRAFT)
    create_payload = {
        "project_id": target_rp["project_id"],
        "contractor_id": target_vendor["id"],
        "award_amount": target_rp["estimated_amount"] * 0.95, # 5% savings
        "award_date": "2026-09-05T00:00:00",
        "start_date": "2026-09-10T00:00:00",
        "completion_date": "2027-03-31T00:00:00",
        "remarks": "Awarded to Apex Structural based on competitive rate quotation.",
        "status": "DRAFT"
    }

    status, award = request_json(f"{BASE_URL}/api/contractor-awards", method="POST", data=create_payload, headers=headers)
    assert status == 201, f"Create award failed ({status}): {award}"
    print(f"[+] Created Draft Award: {award['award_reference']} (ID: {award['id']})")
    print(f"    Estimated Amount: INR {award['estimated_amount']:,.2f}")
    print(f"    Award Amount: INR {award['award_amount']:,.2f}")
    print(f"    Variance Amount: INR {award['variance_amount']:,.2f} ({award['variance_percentage']}%)")

    # 5. Submit Award for Approval
    status, submitted_award = request_json(f"{BASE_URL}/api/contractor-awards/{award['id']}/submit", method="POST", headers=headers)
    assert status == 200, f"Submit award failed ({status}): {submitted_award}"
    assert submitted_award["status"] == "SUBMITTED", f"Expected SUBMITTED, got {submitted_award['status']}"
    print(f"[+] Submitted Award for Approval: Status = {submitted_award['status']}")

    # 6. Check pending approval task
    status, tasks = request_json(f"{BASE_URL}/api/approvals/tasks", method="GET", headers=headers)
    assert status == 200, f"Get approval tasks failed: {tasks}"
    award_task = next((t for t in tasks if t["entity_type"] == "ContractorAward" and t["entity_id"] == award["id"]), None)
    assert award_task is not None, "Approval task for ContractorAward not found!"
    print(f"[+] Found Approval Task #{award_task['id']}: Stage = '{award_task['current_stage']}', Status = '{award_task['status']}'")

    # Pass Stage 1 (Project Manager)
    status, action1 = request_json(
        f"{BASE_URL}/api/approvals/tasks/{award_task['id']}/action",
        method="POST",
        data={"action": "approve", "comments": "Recommended by PM for award."},
        headers=headers
    )
    assert status == 200, f"Approval action 1 failed ({status}): {action1}"
    print(f"[+] Stage 1 Approved. Task status: {action1.get('status')}")

    # Pass all remaining approval stages until task status becomes approved
    while True:
        status, tasks_curr = request_json(f"{BASE_URL}/api/approvals/tasks", method="GET", headers=headers)
        t_curr = next((t for t in tasks_curr if t["id"] == award_task["id"]), None)
        if not t_curr or t_curr["status"] != "pending":
            break
        print(f"[+] Approving stage: '{t_curr['current_stage']}'")
        status, action_res = request_json(
            f"{BASE_URL}/api/approvals/tasks/{t_curr['id']}/action",
            method="POST",
            data={"action": "approve", "comments": f"Approved at {t_curr['current_stage']} stage."},
            headers=headers
        )
        assert status == 200, f"Approval action failed at {t_curr['current_stage']}: {action_res}"

    # 7. Check Award status (Should be APPROVED now)
    status, app_award = request_json(f"{BASE_URL}/api/contractor-awards/{award['id']}", method="GET", headers=headers)
    assert app_award["status"] == "APPROVED", f"Expected APPROVED, got {app_award['status']}"
    print(f"[+] Contractor Award is now APPROVED!")

    # 8. Finalize Award -> AWARDED
    status, final_award = request_json(f"{BASE_URL}/api/contractor-awards/{award['id']}/finalize", method="POST", headers=headers)
    assert status == 200, f"Finalize award failed ({status}): {final_award}"
    assert final_award["status"] == "AWARDED", f"Expected AWARDED, got {final_award['status']}"
    print(f"[+] Contractor Award successfully FINALIZED to status: {final_award['status']}")

    # 9. Verify ready projects list (the awarded project should no longer appear)
    status, ready_after = request_json(f"{BASE_URL}/api/contractor-awards/ready-projects", method="GET", headers=headers)
    awarded_in_ready = any(r["project_id"] == target_rp["project_id"] for r in ready_after)
    assert not awarded_in_ready, "Awarded project should no longer be in ready-projects!"
    print("[+] Verified: Awarded project is excluded from ready-projects list.")
    print("\n==========================================")
    print("ALL CONTRACTOR AWARD BACKEND TESTS PASSED SUCCESSFULLY!")
    print("==========================================")

if __name__ == "__main__":
    test_awards_flow()
