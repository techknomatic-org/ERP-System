import json
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

print("========================================")
print("RUNNING AUTOMATED REGRESSION TESTS")
print("========================================")

# 1. Existing Projects & Phase Verification
res = client.get("/api/projects/")
assert res.status_code == 200, f"Expected 200, got {res.status_code}"
projects = res.json()
print(f"Total existing projects: {len(projects)}")
assert len(projects) > 0, "Expected existing projects to be preserved"

for p in projects[:5]:
    assert "current_phase" in p, f"Project #{p['id']} missing current_phase"
    assert "name" in p and "code" in p and "budget" in p, "Project fields missing"
    print(f"Project #{p['id']}: {p['code']} | Phase: {p['current_phase']} | Status: {p['status']} | Currency: {p.get('currency')} | Budget: {p['budget']}")

print("PASS: Project cards data and current_phase verified.")

# 2. Tenant Feature Flags RBAC and Persistence
# 2a. PM blocked
pm_headers = {"X-User-Role": "project_manager"}
res_pm = client.put("/api/projects/tenant-settings", json={"is_p2_enabled": True}, headers=pm_headers)
assert res_pm.status_code == 403, f"Expected 403 for PM, got {res_pm.status_code}"
print("PASS: Project manager blocked from updating tenant settings (403 Forbidden).")

# 2b. Admin enables P2 & Funding Mode
admin_headers = {"X-User-Role": "admin"}
res_admin = client.put("/api/projects/tenant-settings", json={"is_p2_enabled": True, "is_funding_mode_enabled": True}, headers=admin_headers)
assert res_admin.status_code == 200, f"Expected 200 for Admin, got {res_admin.status_code}"
assert res_admin.json()["is_p2_enabled"] is True
assert res_admin.json()["is_funding_mode_enabled"] is True
print("PASS: Admin enabled P2 and Funding Mode.")

# 2c. Verify GET returns persisted values
res_get = client.get("/api/projects/tenant-settings")
assert res_get.status_code == 200
assert res_get.json()["is_p2_enabled"] is True
assert res_get.json()["is_funding_mode_enabled"] is True
print("PASS: Tenant settings persisted across refresh.")

# 2d. Project creation with P2 contract type allowed when P2 is enabled
import time
ts = int(time.time())
p2_proj_payload = {
    "name": f"Regression P2 EPC Test {ts}",
    "code": f"PROJ-REG-{ts}",
    "contract_type": "EPC",
    "funding_mode": "Budgeted",
    "currency": "USD",
    "budget": 250000.0,
    "tenant_name": "Default Tenant"
}
res_p2_proj = client.post("/api/projects/", json=p2_proj_payload)
assert res_p2_proj.status_code == 200, f"Expected 200 creating EPC project with P2 enabled, got {res_p2_proj.status_code}: {res_p2_proj.text}"
p2_proj_id = res_p2_proj.json()["id"]
assert res_p2_proj.json()["currency"] == "USD"
assert res_p2_proj.json()["budget"] == 250000.0
assert res_p2_proj.json()["current_phase"] == "PHASE 1 — PROJECT CREATION"
print(f"PASS: Project #{p2_proj_id} created with EPC, USD currency, and Phase 1.")

# 2e. Admin disables P2
res_disable_p2 = client.put("/api/projects/tenant-settings", json={"is_p2_enabled": False}, headers=admin_headers)
assert res_disable_p2.status_code == 200
assert res_disable_p2.json()["is_p2_enabled"] is False

# 2f. Verify project creation with EPC rejected when P2 is disabled
rejected_payload = {
    "name": "Regression Rejected EPC Project",
    "code": "PROJ-REG-REJECT-EPC",
    "contract_type": "EPC",
    "budget": 100000.0,
    "tenant_name": "Default Tenant"
}
res_reject = client.post("/api/projects/", json=rejected_payload)
assert res_reject.status_code == 400, f"Expected 400 when P2 disabled, got {res_reject.status_code}"
print("PASS: EPC contract type successfully rejected when P2 feature flag is disabled.")

# 3. Currency Selection & Display
# Project was created with currency="USD" and budget=250000.0
res_fetch_proj = client.get(f"/api/projects/{p2_proj_id}")
assert res_fetch_proj.status_code == 200
assert res_fetch_proj.json()["currency"] == "USD"
assert res_fetch_proj.json()["budget"] == 250000.0
print("PASS: Project currency persisted as USD with exact budget amount 250000.0 (no conversion).")

# 4. Master Data Dropdown Add / Delete & In-Use Protection
# 4a. Add a new custom funding mode
mode_name = f"Mode_{ts % 1000}"
res_add_mode = client.post(f"/api/projects/master-data/option?category=funding_mode&option_value={mode_name}")
assert res_add_mode.status_code == 200
print(f"PASS: Custom funding mode '{mode_name}' added.")

# 4b. Add a new custom currency
curr_code = f"C{ts % 1000}"
res_add_curr = client.post(f"/api/projects/master-data/option?category=currency&option_value={curr_code}&option_label=Custom%20Currency")
assert res_add_curr.status_code == 200
print(f"PASS: Custom currency '{curr_code}' added.")

# 4c. Delete the unused custom funding mode -> allowed
res_del_unused = client.delete(f"/api/projects/master-data/option?category=funding_mode&option_value={mode_name}")
assert res_del_unused.status_code == 200
print(f"PASS: Unused custom funding mode '{mode_name}' successfully deleted.")

# Delete the unused custom currency -> allowed
res_del_curr = client.delete(f"/api/projects/master-data/option?category=currency&option_value={curr_code}")
assert res_del_curr.status_code == 200
print(f"PASS: Unused custom currency '{curr_code}' successfully deleted.")

# 4d. Attempt to delete in-use funding mode "Budgeted" -> BLOCKED
res_del_inuse_mode = client.delete("/api/projects/master-data/option?category=funding_mode&option_value=Budgeted")
assert res_del_inuse_mode.status_code == 400
assert "This option is already in use and cannot be deleted." in res_del_inuse_mode.json()["detail"]
print("PASS: In-use funding mode deletion safely blocked with exact message.")

# 4e. Attempt to delete in-use Division -> BLOCKED
div_inuse_id = next((p["division_id"] for p in projects if p.get("division_id")), 2)
res_del_div = client.delete(f"/api/projects/divisions/{div_inuse_id}")
assert res_del_div.status_code == 400
assert "This option is already in use and cannot be deleted." in res_del_div.json()["detail"]
print(f"PASS: In-use division #{div_inuse_id} deletion safely blocked with exact message.")

# 4f. Attempt to delete in-use Client -> BLOCKED
cust_inuse_id = next((p["client_id"] for p in projects if p.get("client_id")), 1)
res_del_cust = client.delete(f"/api/customers/{cust_inuse_id}")
assert res_del_cust.status_code == 400
assert "This option is already in use and cannot be deleted." in res_del_cust.json()["detail"]
print(f"PASS: In-use client #{cust_inuse_id} deletion safely blocked with exact message.")

# 4g. Attempt to delete in-use User (Project Manager) -> BLOCKED
res_del_user = client.delete("/api/auth/users/1")
assert res_del_user.status_code == 400
assert "This option is already in use and cannot be deleted." in res_del_user.json()["detail"]
print("PASS: In-use project manager deletion safely blocked with exact message.")

# Reset settings back to standard state
client.put("/api/projects/tenant-settings", json={"is_p2_enabled": False, "is_funding_mode_enabled": False}, headers=admin_headers)

print("========================================")
print("ALL AUTOMATED REGRESSION TESTS PASSED!")
print("========================================")
