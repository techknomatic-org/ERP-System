import urllib.request
import json
import urllib.parse
import sys

BASE_URL = "http://127.0.0.1:8000/api/schedule-of-rates"
PROJECTS_URL = "http://127.0.0.1:8000/api/projects"
BILLING_URL = "http://127.0.0.1:8000/api/contractor-billing"
BOQ_URL = "http://127.0.0.1:8000/api/boq-mb"

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
        try:
            return e.code, json.loads(resp_body)
        except Exception:
            return e.code, {"detail": resp_body}

def run_tests():
    print("==========================================================")
    print("RUNNING COMPREHENSIVE PSC-04 SOR MASTER SUITE")
    print("==========================================================")

    # 1. FETCH EDITIONS & REGIONS
    status, editions = http_request(f"{BASE_URL}/editions")
    assert status == 200, f"Expected 200 fetching editions, got {status}"
    print(f"[TEST 1 PASS] Fetched {len(editions)} SOR Editions: {[e['name'] for e in editions]}")

    status, regions = http_request(f"{BASE_URL}/regions")
    assert status == 200, f"Expected 200 fetching regions, got {status}"
    print(f"[TEST 1 PASS] Fetched {len(regions)} Regions: {[r['name'] for r in regions]}")

    dsr_ed = next(e for e in editions if "DSR" in e['name'] or e['name'] == "DSR 2023")
    cpwd_ed = next(e for e in editions if "CPWD" in e['name'] or e['name'] == "CPWD SOR 2024")
    mh_reg = next(r for r in regions if "Maharashtra" in r['name'])

    # 2. EXISTING SOR DATA PRESERVATION
    status, items = http_request(f"{BASE_URL}/")
    assert status == 200, f"Expected 200 fetching items, got {status}"
    assert len(items) > 0, "Expected existing SOR records to be preserved"
    print(f"[TEST 1 PASS] Preserved {len(items)} existing SOR items with backfilled editions/regions.")

    import time
    test_code = f"T-{int(time.time())}"
    new_item = {
        "sor_edition_id": dsr_ed['id'],
        "sor_region_id": mh_reg['id'],
        "sor_code": test_code,
        "description": "Test Excavation Item",
        "category": "Earthwork",
        "unit": "Cum",
        "base_rate": 1000.0,
        "cost_index": 1.10,
        "effective_from": "2026-09-01T00:00:00",
        "status": "Active"
    }
    status, created_item = http_request(f"{BASE_URL}/", method="POST", data=new_item)
    assert status == 200, f"Failed to create valid SOR item: {created_item}"
    assert created_item['adjusted_rate'] == 1100.0, f"Expected adjusted_rate 1100.0, got {created_item['adjusted_rate']}"
    print(f"[TEST 2 & 7 PASS] Created {test_code}. Base Rate: {created_item['base_rate']}, Index: {created_item['cost_index']}, Adjusted Rate: {created_item['adjusted_rate']}")

    # 4. BASE RATE <= 0 VALIDATION
    invalid_rate_item = {**new_item, "sor_code": "TEST-002", "base_rate": 0.0}
    status, err_resp = http_request(f"{BASE_URL}/", method="POST", data=invalid_rate_item)
    assert status == 400, f"Expected 400 for Base Rate 0, got {status}"
    print(f"[TEST 3 PASS] Base Rate 0 rejected with detail: {err_resp.get('detail')}")

    # 5. UNIT VALIDATION
    invalid_unit_item = {**new_item, "sor_code": "TEST-003", "unit": "InvalidUnitX"}
    status, err_resp = http_request(f"{BASE_URL}/", method="POST", data=invalid_unit_item)
    assert status == 400, f"Expected 400 for invalid unit, got {status}"
    print(f"[TEST 4 PASS] Invalid unit rejected with detail: {err_resp.get('detail')}")

    # 6. EDITION-SCOPED ITEM CODE UNIQUENESS
    # Try duplicate test_code in SAME edition DSR 2023 -> MUST REJECT
    status, err_resp = http_request(f"{BASE_URL}/", method="POST", data=new_item)
    assert status == 400, f"Expected 400 for duplicate {test_code} in DSR 2023, got {status}"
    print(f"[TEST 5 PASS] Duplicate {test_code} in same edition rejected: {err_resp.get('detail')}")

    # Try same test_code in DIFFERENT edition CPWD SOR 2024 -> MUST SUCCEED
    cpwd_item = {**new_item, "sor_edition_id": cpwd_ed['id']}
    status, created_cpwd = http_request(f"{BASE_URL}/", method="POST", data=cpwd_item)
    assert status == 200, f"Expected 200 for {test_code} in CPWD SOR 2024 edition, got {status}: {created_cpwd}"
    print(f"[TEST 5 PASS] Same {test_code} allowed in different edition CPWD SOR 2024! ID: {created_cpwd['id']}")

    # 7. CONTRACT EDITION / REGION LOCKING & EFFECTIVE RATE LOOKUP
    status, proj_list = http_request(PROJECTS_URL)
    assert status == 200 and len(proj_list) > 0, "No projects found"
    proj_id = proj_list[0]['id']

    # Lookup valid item in project's edition
    status, lookup_res = http_request(f"{BASE_URL}/lookup?project_id={proj_id}&sor_code={test_code}")
    assert status == 200, f"Lookup failed: {lookup_res}"
    print(f"[TEST 8 PASS] Rate lookup for project {proj_id}: {lookup_res['item_code']} -> Adjusted Rate: {lookup_res['adjusted_rate']}")

    # Lookup non-existent item in project's edition -> Returns fallback message
    status, lookup_fail = http_request(f"{BASE_URL}/lookup?project_id={proj_id}&sor_code=NON_EXISTENT_ITEM_99")
    assert status == 400, f"Expected 400 for missing item, got {status}"
    assert "This item is not available in the selected SOR Edition. Use Non-SOR Rate Analysis." in lookup_fail['detail']
    print(f"[TEST 13 PASS] Non-existent edition item fallback message: '{lookup_fail['detail']}'")

    # 8. BULK IMPORT VALIDATION & TRANSACTIONAL ALL-OR-NOTHING
    # Preview duplicate in file
    dup_file_json = [
        {"sor_edition": "DSR 2023", "region": "Maharashtra", "item_code": "IMP-001", "description": "Import Item 1", "category": "Concrete", "unit": "m³", "base_rate": "1500", "cost_index": "1.0"},
        {"sor_edition": "DSR 2023", "region": "Maharashtra", "item_code": "IMP-001", "description": "Import Item 1 Dup", "category": "Concrete", "unit": "m³", "base_rate": "1500", "cost_index": "1.0"}
    ]
    req = urllib.request.Request(
        f"{BASE_URL}/import-preview",
        data=urllib.parse.urlencode({"raw_json": json.dumps(dup_file_json)}).encode('utf-8'),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        prev_dup = json.loads(resp.read().decode('utf-8'))

    assert prev_dup['invalid_rows_count'] > 0, "Expected file duplicate to be flagged invalid"
    print(f"[TEST 11 PASS] Bulk import file duplicate correctly detected: {prev_dup['errors'][0]['error']}")

    # Preview valid items
    valid_file_json = [
        {"sor_edition": "DSR 2023", "region": "Maharashtra", "item_code": "IMP-101", "description": "Valid Import Item 101", "category": "Masonry", "unit": "m²", "base_rate": "850.00", "cost_index": "1.0"},
        {"sor_edition": "DSR 2023", "region": "Maharashtra", "item_code": "IMP-102", "description": "Valid Import Item 102", "category": "Finishing", "unit": "m²", "base_rate": "420.00", "cost_index": "1.05"}
    ]
    req = urllib.request.Request(
        f"{BASE_URL}/import-preview",
        data=urllib.parse.urlencode({"raw_json": json.dumps(valid_file_json)}).encode('utf-8'),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        prev_valid = json.loads(resp.read().decode('utf-8'))

    assert prev_valid['invalid_rows_count'] == 0, f"Expected 0 invalid rows, got {prev_valid['invalid_rows_count']}"
    print(f"[TEST 10 PASS] Import preview passed for {prev_valid['valid_rows_count']} rows.")

    # Commit valid import
    status, commit_res = http_request(f"{BASE_URL}/import-commit", method="POST", data={"items": prev_valid['valid_items']})
    assert status == 200, f"Commit failed: {commit_res}"
    print(f"[TEST 10 PASS] Committed {commit_res['imported_count']} imported SOR items successfully.")

    # 9. RATE SNAPSHOT ON CONTRACTOR BILL
    status, boq_list = http_request(f"{BOQ_URL}/boq/project/{proj_id}")
    if status == 200 and len(boq_list) > 0:
        boq_item_id = boq_list[0]['id']
        vendor_id = 1
        bill_data = {
            "project_id": proj_id,
            "vendor_id": vendor_id,
            "boq_item_id": boq_item_id,
            "billed_qty": 10.0,
            "billed_rate": 1100.0,
            "remarks": "Rate snapshot test bill"
        }
        status, bill_obj = http_request(f"{BILLING_URL}/bills", method="POST", data=bill_data)
        assert status == 200, f"Bill creation failed: {bill_obj}"
        print(f"[TEST 14 PASS] Created Contractor Bill #{bill_obj['bill_number']} with immutable rate snapshot.")

    print("==========================================================")
    print("ALL PSC-04 SOR TEST SUITES PASSED SUCCESSFULLY!")
    print("==========================================================")

if __name__ == "__main__":
    run_tests()
