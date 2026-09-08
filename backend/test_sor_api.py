import urllib.request
import json
import urllib.parse

BASE_URL = "http://127.0.0.1:8000/api/schedule-of-rates"

def http_request(url, method="GET", data=None):
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode('utf-8')
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        resp_body = e.read().decode('utf-8')
        return e.code, json.loads(resp_body) if resp_body else {}

def run_tests():
    print("--- TESTING SCHEDULE OF RATES (SOR) API ENDPOINTS ---")

    # 1. GET ALL
    status, items = http_request(f"{BASE_URL}/")
    assert status == 200, f"Expected 200, got {status}: {items}"
    print(f"[PASS] Fetch all SOR items: count = {len(items)}")
    assert len(items) >= 10, f"Expected at least 10 seeded items, got {len(items)}"

    # 2. SEARCH & FILTERS
    status, search_items = http_request(f"{BASE_URL}/?search=ordinary")
    assert status == 200
    print(f"[PASS] Search by 'ordinary': found {len(search_items)} items")
    assert len(search_items) >= 1

    status, cat_items = http_request(f"{BASE_URL}/?category=Concrete")
    assert status == 200
    print(f"[PASS] Filter by category 'Concrete': found {len(cat_items)} items")
    assert all(i['category'] == 'Concrete' for i in cat_items)

    # 3. CREATE VALID ITEM
    import time
    code_gen = f"SOR-9{int(time.time()) % 10000:04d}"
    new_item = {
        "sor_code": code_gen,
        "description": "Custom Test Item Excavation",
        "category": "Earthwork",
        "unit": "m³",
        "rate": 1250.50,
        "effective_from": "2027-05-01T00:00:00",
        "status": "Active"
    }
    status, created_obj = http_request(f"{BASE_URL}/", method="POST", data=new_item)
    assert status == 200, f"Create failed: {created_obj}"
    created_id = created_obj['id']
    print(f"[PASS] Created new SOR item ID {created_id}: {created_obj['sor_code']}")

    # 4. DUPLICATE CODE VALIDATION
    status, dup_err = http_request(f"{BASE_URL}/", method="POST", data=new_item)
    assert status == 400, f"Expected 400 for duplicate code, got {status}"
    print(f"[PASS] Duplicate SOR Code rejected properly: {dup_err.get('detail')}")

    # 5. INVALID RATE VALIDATION
    invalid_item = {**new_item, "sor_code": "SOR-100", "rate": -50.0}
    status, rate_err = http_request(f"{BASE_URL}/", method="POST", data=invalid_item)
    assert status == 400, f"Expected 400 for invalid rate, got {status}"
    print(f"[PASS] Negative rate rejected properly: {rate_err.get('detail')}")

    # 6. UPDATE ITEM
    update_data = {
        "description": "Updated Custom Test Item Excavation",
        "rate": 1350.00
    }
    status, updated_obj = http_request(f"{BASE_URL}/{created_id}", method="PUT", data=update_data)
    assert status == 200, f"Update failed: {updated_obj}"
    assert updated_obj['rate'] == 1350.00
    print(f"[PASS] Updated SOR item ID {created_id}: new rate = {updated_obj['rate']}")

    # 7. TOGGLE STATUS
    status, toggled_obj = http_request(f"{BASE_URL}/{created_id}/status", method="PATCH")
    assert status == 200
    assert toggled_obj['status'] == 'Inactive'
    print(f"[PASS] Toggled status to Inactive for ID {created_id}")

    status, toggled_back_obj = http_request(f"{BASE_URL}/{created_id}/status", method="PATCH")
    assert status == 200
    assert toggled_back_obj['status'] == 'Active'
    print(f"[PASS] Toggled status back to Active for ID {created_id}")

    print("--- ALL SOR API TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_tests()
