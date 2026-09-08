import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000/api"

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
    print("--- TESTING PROJECT ESTIMATION DATA MAPPING & VALIDATION ---")

    # 1. Fetch Projects
    status, projects = http_request(f"{BASE_URL}/projects/")
    assert status == 200, f"Failed to fetch projects: {projects}"
    assert len(projects) > 0, "No projects found in database!"
    project_id = projects[0]['id']
    project_name = projects[0]['name']
    print(f"[PASS] Selected existing project #{project_id}: '{project_name}'")

    # 2. Fetch Active SOR items
    status, sor_items = http_request(f"{BASE_URL}/schedule-of-rates/?status=Active")
    assert status == 200, f"Failed to fetch SOR items: {sor_items}"
    assert len(sor_items) > 0, "No active SOR items found!"
    print(f"[PASS] Loaded {len(sor_items)} active SOR master items.")

    # 3. Get Project Estimate
    status, estimate = http_request(f"{BASE_URL}/estimation/project/{project_id}")
    assert status == 200, f"Failed to fetch estimate for project #{project_id}: {estimate}"
    estimate_id = estimate['id']
    lines = estimate['lines']
    print(f"[PASS] Fetched Estimate '{estimate['estimate_number']}' for project #{project_id} with {len(lines)} BOQ items.")

    # Find Cement item (Bags) and Excavation SOR (m³)
    excavation_line = next((l for l in lines if 'excavation' in l['boq_item_name'].lower()), None)
    cement_line = next((l for l in lines if 'cement' in l['boq_item_name'].lower() or l['boq_unit'].lower() == 'bags'), None)
    sor_excavation = next((s for s in sor_items if 'excavation' in s['description'].lower()), sor_items[0])

    # 4. Test Incompatible Unit Mapping (e.g. Cement Bags -> Excavation m³)
    if cement_line:
        lines_payload = [{
            "boq_item_id": cement_line['boq_item_id'],
            "sor_item_id": sor_excavation['id'], # Unit mismatch: Bags vs m³
            "quantity": cement_line['quantity'],
            "sor_rate_snapshot": float(sor_excavation['rate'])
        }]
        status, saved_est = http_request(f"{BASE_URL}/estimation/save", method="POST", data={"project_id": project_id, "lines": lines_payload})
        assert status == 200
        mismatched_res_line = next(l for l in saved_est['lines'] if l['boq_item_id'] == cement_line['boq_item_id'])
        print(f"[PASS] Unit mismatch test: BOQ ({cement_line['boq_unit']}) vs SOR ({sor_excavation['unit']}) => is_compatible = {mismatched_res_line['is_unit_compatible']}, estimated_amount = {mismatched_res_line['estimated_amount']}")
        assert mismatched_res_line['is_unit_compatible'] == False
        assert mismatched_res_line['estimated_amount'] is None
        assert saved_est['status'] == 'PARTIALLY_MAPPED' or saved_est['status'] == 'DRAFT'

        # Try Submit for Review with unit mismatch => MUST FAIL
        status, err_res = http_request(f"{BASE_URL}/estimation/submit-review/{estimate_id}", method="POST")
        assert status == 400, f"Expected 400 rejection for unit mismatch submit, got {status}"
        print(f"[PASS] Rejection on submit for review with unit mismatch: {err_res.get('detail')}")

    # 5. Test Compatible Mapping (e.g. Excavation m³ -> Excavation m³)
    if excavation_line:
        lines_payload = [{
            "boq_item_id": excavation_line['boq_item_id'],
            "sor_item_id": sor_excavation['id'], # Compatible: m³ vs m³
            "quantity": excavation_line['quantity'],
            "sor_rate_snapshot": float(sor_excavation['rate'])
        }]
        status, saved_est = http_request(f"{BASE_URL}/estimation/save", method="POST", data={"project_id": project_id, "lines": lines_payload})
        assert status == 200
        comp_res_line = next(l for l in saved_est['lines'] if l['boq_item_id'] == excavation_line['boq_item_id'])
        print(f"[PASS] Compatible unit test: BOQ ({excavation_line['boq_unit']}) vs SOR ({sor_excavation['unit']}) => is_compatible = {comp_res_line['is_unit_compatible']}, estimated_amount = INR {comp_res_line['estimated_amount']}")
        assert comp_res_line['is_unit_compatible'] == True
        assert comp_res_line['estimated_amount'] is not None

    print("--- ALL DATA MAPPING & VALIDATION TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_tests()
