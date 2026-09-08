import json
import urllib.request
import urllib.parse
import datetime

BASE_URL = "http://127.0.0.1:8000/api"

def api_request(url, method="GET", data=None, params=None, headers=None):
    if headers is None:
        headers = {}
    headers["X-User-Role"] = "admin"
    headers["Content-Type"] = "application/json"

    if params:
        query_string = urllib.parse.urlencode(params)
        url = f"{url}?{query_string}"

    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        resp_body = e.read().decode("utf-8")
        body_json = json.loads(resp_body) if resp_body else {}
        return e.code, body_json

def test_daily_task_monitoring_workflow():
    print("\n==================================================")
    print("STARTING TEST SUITE: PHASE 3 FEATURE 1 - MONITORING OF DAILY TASK")
    print("==================================================\n")

    # 1. Fetch available projects
    status, projects = api_request(f"{BASE_URL}/projects/")
    assert status == 200, f"Expected 200, got {status}"
    assert len(projects) > 0, "At least one project should exist"
    project_id = projects[0]["id"]
    print(f"[PASS] Scenario 1 Pass: Project loaded successfully (ID: {project_id})")

    # 2. Create / Fetch active work plan for testing
    status, wbs_data = api_request(f"{BASE_URL}/wbs/project/{project_id}")
    tasks = wbs_data if isinstance(wbs_data, list) else wbs_data.get("tasks", [])
    assert len(tasks) > 0, "Project should have WBS tasks"
    phase_id = tasks[0]["id"]
    task_id = tasks[1]["id"] if len(tasks) > 1 else tasks[0]["id"]

    today = datetime.date.today()
    start_date = today.strftime("%Y-%m-%d")
    end_date = (today + datetime.timedelta(days=10)).strftime("%Y-%m-%d")

    create_wp_payload = {
        "project_id": project_id,
        "wbs_phase_id": phase_id,
        "task_id": task_id,
        "activity_name": f"Site Execution Work Plan {datetime.datetime.now().strftime('%M%S')}",
        "planned_quantity": 500.0,
        "unit": "cu.m",
        "planned_start_date": f"{start_date}T00:00:00",
        "planned_end_date": f"{end_date}T00:00:00",
        "priority": "HIGH",
        "status": "APPROVED"
    }
    status, wp_data = api_request(f"{BASE_URL}/work-plans", method="POST", data=create_wp_payload)
    assert status in [200, 201], f"Failed to create test work plan: {wp_data}"
    wp_id = wp_data["id"]
    print(f"[PASS] Scenario 2 Pass: Created fresh test Work Plan ID: {wp_id}")

    # 3. Test GET Work Plan Context Endpoint
    status, context = api_request(f"{BASE_URL}/site-logs/work-plan-context/{wp_id}")
    assert status == 200, f"Expected 200, got {status}"
    assert context["work_plan_id"] == wp_id
    assert "mapped_boq_items" in context
    assert "is_future_activity" in context
    assert "is_delayed_activity" in context
    print(f"[PASS] Scenario 3 Pass: GET /work-plan-context/{wp_id} returned valid context schema (WBS: {context['wbs_name']}, Mapped BOQs: {len(context['mapped_boq_items'])})")

    # 4. Test BOQ Mapping (if not already mapped)
    boq_item_id = None
    boq_mapping_id = None
    if len(context["mapped_boq_items"]) > 0:
        boq_item_id = context["mapped_boq_items"][0]["boq_item_id"]
        boq_mapping_id = context["mapped_boq_items"][0]["boq_mapping_id"] if "boq_mapping_id" in context["mapped_boq_items"][0] else context["mapped_boq_items"][0].get("mapping_id")
        print(f"[PASS] Using existing BOQ mapping ID: {boq_mapping_id} (BOQ Item ID: {boq_item_id})")
    else:
        status, boqs = api_request(f"{BASE_URL}/boq-mb/boq/project/{project_id}")
        matching_boq = next((b for b in boqs if b.get("unit") in ["cu.m", "m³", "m3", "cum", "M30 Concrete"]), boqs[0] if len(boqs) > 0 else None)
        if matching_boq:
            boq_item_id = matching_boq["id"]
            map_payload = {
                "boq_item_id": boq_item_id,
                "mapped_quantity": 250.0,
                "unit": matching_boq.get("unit", "cu.m")
            }
            status, map_data = api_request(f"{BASE_URL}/work-plans/{wp_id}/boq-mappings", method="POST", data=map_payload)
            if status in [200, 201]:
                boq_mapping_id = map_data["id"]
                print(f"[PASS] Created test BOQ mapping ID: {boq_mapping_id}")

    # Re-fetch context
    status, context = api_request(f"{BASE_URL}/site-logs/work-plan-context/{wp_id}")

    # 5. Test Future Activity Protection
    future_start = (datetime.date.today() + datetime.timedelta(days=60)).strftime("%Y-%m-%d")
    future_end = (datetime.date.today() + datetime.timedelta(days=90)).strftime("%Y-%m-%d")

    status, future_wp = api_request(f"{BASE_URL}/work-plans", method="POST", data={
        "project_id": project_id,
        "wbs_phase_id": phase_id,
        "task_id": task_id,
        "activity_name": "Future Phase Activity Work Plan",
        "planned_quantity": 100.0,
        "unit": "sqm",
        "planned_start_date": f"{future_start}T00:00:00",
        "planned_end_date": f"{future_end}T00:00:00",
        "priority": "MEDIUM",
        "status": "APPROVED"
    })
    assert status in [200, 201]
    future_wp_id = future_wp["id"]

    # Attempt to post executed_quantity > 0 on future activity -> MUST FAIL (400)
    invalid_future_log_payload = {
        "project_id": project_id,
        "physical_progress": "Attempting early execution of future activity",
        "labour_count": 10,
        "daily_tasks": [
            {
                "work_plan_id": future_wp_id,
                "task_status": "IN PROGRESS",
                "executed_quantity": 25.0,
                "unit": "sqm",
                "execution_notes": "Early execution attempt"
            }
        ]
    }
    status, err_resp = api_request(f"{BASE_URL}/site-logs/", method="POST", data=invalid_future_log_payload)
    assert status == 400, f"Expected 400 for future execution, got {status}"
    assert "cannot have execution quantity" in err_resp.get("detail", "").lower()
    print("[PASS] Scenario 5 Pass: Future Activity execution quantity (> 0) correctly REJECTED with 400 Bad Request.")

    # Valid log for future activity (0 quantity, NOT STARTED status) -> MUST SUCCEED
    valid_future_log_payload = {
        "project_id": project_id,
        "physical_progress": "Recording future activity status check",
        "labour_count": 5,
        "daily_tasks": [
            {
                "work_plan_id": future_wp_id,
                "task_status": "NOT STARTED",
                "executed_quantity": 0.0,
                "unit": "sqm",
                "execution_notes": "Not started yet as planned start is in future"
            }
        ]
    }
    status, future_log_res = api_request(f"{BASE_URL}/site-logs/", method="POST", data=valid_future_log_payload)
    assert status in [200, 201], f"Expected 200/201, got {status}"
    assert future_log_res["daily_tasks"][0]["is_future_activity"] is True
    print("[PASS] Scenario 5 Pass (b): Future Activity with 0 quantity and NOT STARTED status correctly ACCEPTED.")

    # 6. Test Valid Daily Task Monitoring Creation & Persistence
    valid_log_payload = {
        "project_id": project_id,
        "physical_progress": "Execution of foundation excavation ongoing as planned",
        "labour_count": 25,
        "materials_consumed": "Diesel 120L, Rebar 2 Tons",
        "equipment_used": "JCB Excavator x 2",
        "daily_tasks": [
            {
                "work_plan_id": wp_id,
                "boq_mapping_id": boq_mapping_id,
                "boq_item_id": boq_item_id,
                "task_status": "IN PROGRESS",
                "executed_quantity": 45.5,
                "unit": context.get("unit", "cu.m"),
                "execution_notes": "Excavation completed for Grid A1 to A5",
                "delay_reason": ""
            }
        ]
    }
    status, log_data = api_request(f"{BASE_URL}/site-logs/", method="POST", data=valid_log_payload)
    if status not in [200, 201]:
        print("SCENARIO 6 ERROR DETAIL:", log_data)
    assert status in [200, 201], f"Expected 200/201, got {status}: {log_data}"
    log_id = log_data["id"]
    assert len(log_data["daily_tasks"]) == 1
    monitored_task = log_data["daily_tasks"][0]
    assert monitored_task["work_plan_id"] == wp_id
    assert monitored_task["executed_quantity"] == 45.5
    print(f"[PASS] Scenario 6 Pass: Daily Site Log #{log_id} created with Daily Task Monitoring record ID #{monitored_task['id']}.")

    # 7. Test Negative Quantity Rejection
    negative_qty_payload = {
        "project_id": project_id,
        "physical_progress": "Testing negative quantity input",
        "daily_tasks": [
            {
                "work_plan_id": wp_id,
                "task_status": "IN PROGRESS",
                "executed_quantity": -10.0,
                "unit": "cu.m"
            }
        ]
    }
    status, neg_resp = api_request(f"{BASE_URL}/site-logs/", method="POST", data=negative_qty_payload)
    assert status == 400, f"Expected 400, got {status}"
    assert "cannot be negative" in neg_resp.get("detail", "").lower()
    print("[PASS] Scenario 7 Pass: Negative execution quantity correctly REJECTED.")

    # 8. Test Unit Mismatch Rejection
    unit_mismatch_payload = {
        "project_id": project_id,
        "physical_progress": "Testing unit mismatch input",
        "daily_tasks": [
            {
                "work_plan_id": wp_id,
                "task_status": "IN PROGRESS",
                "executed_quantity": 10.0,
                "unit": "INVALID_UNIT_XYZ"
            }
        ]
    }
    status, unit_resp = api_request(f"{BASE_URL}/site-logs/", method="POST", data=unit_mismatch_payload)
    assert status == 400, f"Expected 400, got {status}"
    assert "unit mismatch" in unit_resp.get("detail", "").lower()
    print("[PASS] Scenario 8 Pass: Unit mismatch correctly REJECTED.")

    # 9. Test Wrong Project Work Plan Rejection
    status, p2 = api_request(f"{BASE_URL}/projects/", method="POST", data={
        "name": "Secondary Isolated Test Project",
        "code": f"PRJ-ISO-{datetime.datetime.now().strftime('%H%M%S')}",
        "project_type": "INFRASTRUCTURE",
        "status": "ACTIVE"
    })
    if status in [200, 201]:
        p2_id = p2["id"]
        wrong_project_payload = {
            "project_id": p2_id,
            "physical_progress": "Attempting to submit log with work plan from different project",
            "daily_tasks": [
                {
                    "work_plan_id": wp_id,
                    "task_status": "IN PROGRESS",
                    "executed_quantity": 10.0,
                    "unit": "cu.m"
                }
            ]
        }
        status, wrong_resp = api_request(f"{BASE_URL}/site-logs/", method="POST", data=wrong_project_payload)
        assert status == 400, f"Expected 400, got {status}"
        assert "does not belong to project" in wrong_resp.get("detail", "").lower()
        print("[PASS] Scenario 9 Pass: Work Plan from another project correctly REJECTED.")

    # 10. Non-Regression: GET Site Logs Feed includes daily_tasks
    status, feed_logs = api_request(f"{BASE_URL}/site-logs/project/{project_id}")
    assert status == 200, f"Expected 200, got {status}"
    target_log = next((l for l in feed_logs if l["id"] == log_id), None)
    assert target_log is not None
    assert "daily_tasks" in target_log
    assert len(target_log["daily_tasks"]) == 1
    assert target_log["daily_tasks"][0]["work_plan_id"] == wp_id
    print(f"[PASS] Scenario 10 Pass: Feed endpoint returns daily_tasks array with complete context (Work Plan: {target_log['daily_tasks'][0]['work_plan_name']}).")

    print("\n==================================================")
    print("ALL 10 VERIFICATION SCENARIOS PASSED SUCCESSFULLY!")
    print("==================================================\n")

if __name__ == "__main__":
    test_daily_task_monitoring_workflow()
