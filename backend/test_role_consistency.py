import sys
from fastapi.testclient import TestClient

sys.path.append(r'c:\Users\khushi.gurave\Desktop\ERP\backend')
from app.main import app

client = TestClient(app)

def test_roles():
    print("=== EXECUTING ROLE CONSISTENCY & AUTHENTICATION VERIFICATION ===")

    # 1. Test Login as Procurement
    res = client.post("/api/auth/login", json={"username_or_email": "procurement@erp.local", "password": "procurement123"})
    assert res.status_code == 200, f"Failed procurement login: {res.text}"
    data = res.json()
    assert data["user"]["role"] == "procurement", f"Expected role 'procurement', got '{data['user']['role']}'"
    assert data["user"]["default_route"] == "/procurement", f"Expected default route '/procurement', got '{data['user']['default_route']}'"
    print(f"PASS 1: Procurement Login Successful! Role: '{data['user']['role']}', Default Route: '{data['user']['default_route']}'")

    proc_user_id = data["user"]["id"]

    # 2. Test Login for all 6 demo accounts
    demo_roles = [
        ("admin@erp.local", "admin123", "admin", "/"),
        ("pm@erp.local", "pm123", "project_manager", "/projects"),
        ("site@erp.local", "site123", "site_engineer", "/site-logs"),
        ("finance@erp.local", "finance123", "finance", "/bookings"),
        ("procurement@erp.local", "procurement123", "procurement", "/procurement"),
        ("customer@abccorp.com", "customer123", "customer", "/portal"),
    ]

    for email, passw, expected_role, expected_route in demo_roles:
        r = client.post("/api/auth/login", json={"username_or_email": email, "password": passw})
        assert r.status_code == 200, f"Login failed for {email}: {r.text}"
        u_data = r.json()["user"]
        assert u_data["role"] == expected_role, f"Role mismatch for {email}: expected {expected_role}, got {u_data['role']}"
        assert u_data["default_route"] == expected_route, f"Route mismatch for {email}: expected {expected_route}, got {u_data['default_route']}"
        print(f"PASS: Demo User '{email}' authenticated as '{expected_role}' -> Route: '{expected_route}'")

    # 3. Test Role Switching to Procurement
    sw_res = client.post(f"/api/auth/switch-role/{proc_user_id}/procurement")
    assert sw_res.status_code == 200, f"Role switch failed: {sw_res.text}"
    sw_data = sw_res.json()
    assert sw_data["role"] == "procurement"
    assert sw_data["default_route"] == "/procurement"
    print(f"PASS 3: Role Switch to Procurement verified -> Route: '{sw_data['default_route']}'")

    print("\n[SUCCESS] ALL ROLE CONSISTENCY & AUTHENTICATION TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_roles()
