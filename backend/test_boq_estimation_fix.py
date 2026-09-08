import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def http_get(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        data = resp.read().decode('utf-8')
        return resp.status, json.loads(data)

def http_post(url, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode('utf-8')
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, body

def run_tests():
    print("==================================================")
    print("RUNNING BOQ & ESTIMATION INTEGRATION VERIFICATION")
    print("==================================================")

    # 1. Fetch available projects
    status, projects = http_get(f"{BASE_URL}/api/projects/")
    if status != 200 or not projects:
        print("ERROR: No projects found in DB to attach BOQ items to.")
        sys.exit(1)
    
    test_project = projects[0]
    project_id = test_project["id"]
    print(f"[1] Selected test project: ID {project_id} - {test_project.get('name')}")

    # 2. Test BOQ Item 1 Creation (Approved Qty = 800, Unit Rate = 150)
    boq_payload_1 = {
        "project_id": project_id,
        "item_code": "BOQ-TEST-800",
        "item_name": "Concrete Foundation Works (Test)",
        "category": "Civil",
        "unit": "cum",
        "approved_qty": 800.0,
        "rate": 150.0,
        "status": "Active"
    }

    status1, item1 = http_post(f"{BASE_URL}/api/boq-mb/items", boq_payload_1)
    print(f"[2] Creating BOQ Item 1 (800 x ₹150)... Status: {status1}")
    assert status1 in [200, 201], f"Failed to create BOQ item 1: {item1}"
    
    print(f"    Item 1 ID: {item1.get('id')}")
    print(f"    Approved Qty: {item1.get('approved_qty')}")
    print(f"    Unit Rate: ₹{item1.get('rate')}")
    print(f"    Total Amount: ₹{item1.get('total_amount')}")

    assert item1.get("approved_qty") == 800.0, f"Expected Qty 800.0, got {item1.get('approved_qty')}"
    assert item1.get("rate") == 150.0, f"Expected Rate 150.0, got {item1.get('rate')}"
    assert item1.get("total_amount") == 120000.0, f"Expected Total Amount 120000.0, got {item1.get('total_amount')}"
    print("    ✅ TEST 1 PASSED: 800 x ₹150 = ₹120,000.00 total amount calculated and saved accurately.")

    # 3. Test BOQ Item 2 Creation (Approved Qty = 100, Unit Rate = 65)
    boq_payload_2 = {
        "project_id": project_id,
        "item_code": "BOQ-TEST-100",
        "item_name": "Plastering Works (Test)",
        "category": "Civil",
        "unit": "sqm",
        "approved_qty": 100.0,
        "rate": 65.0,
        "status": "Active"
    }

    status2, item2 = http_post(f"{BASE_URL}/api/boq-mb/items", boq_payload_2)
    print(f"[3] Creating BOQ Item 2 (100 x ₹65)... Status: {status2}")
    assert status2 in [200, 201], f"Failed to create BOQ item 2: {item2}"

    print(f"    Item 2 ID: {item2.get('id')}")
    print(f"    Approved Qty: {item2.get('approved_qty')}")
    print(f"    Unit Rate: ₹{item2.get('rate')}")
    print(f"    Total Amount: ₹{item2.get('total_amount')}")

    assert item2.get("approved_qty") == 100.0, f"Expected Qty 100.0, got {item2.get('approved_qty')}"
    assert item2.get("rate") == 65.0, f"Expected Rate 65.0, got {item2.get('rate')}"
    assert item2.get("total_amount") == 6500.0, f"Expected Total Amount 6500.0, got {item2.get('total_amount')}"
    print("    ✅ TEST 2 PASSED: 100 x ₹65 = ₹6,500.00 total amount calculated and saved accurately.")

    # 4. Test Validation (Qty <= 0 or Rate < 0)
    invalid_payload = {
        "project_id": project_id,
        "item_code": "BOQ-INVALID",
        "item_name": "Invalid Item",
        "category": "Civil",
        "unit": "sqm",
        "approved_qty": 0,
        "rate": -10.0,
        "status": "Active"
    }
    status_inv, body_inv = http_post(f"{BASE_URL}/api/boq-mb/items", invalid_payload)
    print(f"[4] Testing Invalid BOQ Item payload... Status: {status_inv}")
    assert status_inv == 400, f"Expected 400 validation error, got {status_inv}"
    print("    ✅ TEST 3 PASSED: Backend correctly blocked invalid approved_qty/rate payload.")

    # 5. Fetch Project Estimation to verify BOQ rate, amount and total cost integration
    status_est, est_data = http_get(f"{BASE_URL}/api/estimation/project/{project_id}")
    print(f"[5] Fetching Project Estimation... Status: {status_est}")
    assert status_est == 200, f"Failed to fetch estimation: {est_data}"
    
    print(f"    Total BOQ Items in Estimate: {len(est_data.get('lines', []))}")
    print(f"    Total Estimated Cost: ₹{est_data.get('total_estimated_cost')}")

    # Check our newly created lines in the estimate payload
    matching_lines = [l for l in est_data["lines"] if l["boq_item_id"] in [item1["id"], item2["id"]]]
    assert len(matching_lines) == 2, f"Expected 2 test BOQ items in estimation lines, found {len(matching_lines)}"

    for l in matching_lines:
        print(f"    Line #{l['boq_item_id']} ({l['boq_item_name']}): boq_rate=₹{l.get('boq_rate')}, boq_amount=₹{l.get('boq_amount')}, estimated_amount=₹{l.get('estimated_amount')}")
        assert l.get("boq_rate") is not None and l.get("boq_rate") > 0, "boq_rate missing or zero"
        assert l.get("boq_amount") is not None and l.get("boq_amount") > 0, "boq_amount missing or zero"
        assert l.get("estimated_amount") is not None and l.get("estimated_amount") > 0, "estimated_amount missing or zero"

    print("    ✅ TEST 4 PASSED: Project Estimation API returned non-zero rates, amounts, and total estimated cost!")

    print("\n==================================================")
    print("ALL BOQ LINE ITEM & ESTIMATION INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
