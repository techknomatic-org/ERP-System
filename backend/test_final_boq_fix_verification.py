import sys
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import BoqItem, ScheduleOfRates, MeasurementBook, SiteDailyLog

def run_verification():
    print("==================================================")
    print("FINAL BOQ EDIT API & INTEGRATION VERIFICATION")
    print("==================================================")

    client = TestClient(app)

    # 1. Update BOQ Item 22 (Reinforcement Steel for Project 5)
    print("\n[Step 1] Executing PUT /api/boq-mb/boq/22 with Qty=100, Rate=65, Unit=Tonnes...")
    payload = {
        "project_id": 5,
        "item_name": "Reinforcement Steel",
        "unit": "Tonnes",
        "approved_qty": 100.0,
        "rate": 65.0
    }
    res = client.put("/api/boq-mb/boq/22", json=payload)
    print(f"Status Code: {res.status_code}")
    assert res.status_code == 200, f"Failed to update BOQ item 22: {res.text}"
    
    data = res.json()
    print("Response Data:", data)
    assert data["unit"] == "Tonnes", f"Expected unit 'Tonnes', got '{data['unit']}'"
    assert data["approved_qty"] == 100.0, f"Expected approved_qty 100.0, got {data['approved_qty']}"
    assert data["rate"] == 65.0, f"Expected rate 65.0, got {data['rate']}"
    assert data["total_amount"] == 6500.0, f"Expected total_amount 6500.0, got {data['total_amount']}"
    print("[PASS] Step 1 Passed: Backend calculated total_amount = Rs. 6,500 accurately.")

    # 2. Database Persistence Check
    print("\n[Step 2] Verifying database persistence with fresh DB session...")
    db = SessionLocal()
    try:
        db_item = db.query(BoqItem).filter(BoqItem.id == 22).first()
        assert db_item is not None, "BOQ item 22 not found in DB"
        print(f"DB Record: ID={db_item.id}, Name='{db_item.item_name}', Unit='{db_item.unit}', Qty={db_item.approved_qty}, Rate={db_item.rate}, Total={db_item.total_amount}")
        assert db_item.unit == "Tonnes", f"Expected DB unit 'Tonnes', got '{db_item.unit}'"
        assert float(db_item.approved_qty) == 100.0, f"Expected DB Qty 100.0, got {db_item.approved_qty}"
        assert float(db_item.rate) == 65.0, f"Expected DB Rate 65.0, got {db_item.rate}"
        assert float(db_item.total_amount) == 6500.0, f"Expected DB Total 6500.0, got {db_item.total_amount}"
        print("[PASS] Step 2 Passed: Data is persisted in DB.")
    finally:
        db.close()

    # 3. Execution & Financial Safety Verification
    print("\n[Step 3] Verifying Execution/Financial Safety protection...")
    # Item 1 has 780 cu.m recorded executed quantity. Try reducing approved_qty below executed_qty.
    item1_res = client.put("/api/boq-mb/boq/1", json={
        "project_id": 1,
        "item_name": "Foundation Concrete Slab Pour (M30)",
        "unit": "cu.m",
        "approved_qty": 100.0,
        "rate": 150.0
    })
    print(f"Item 1 (with 780 executed qty) update status: {item1_res.status_code}, Response: {item1_res.json()}")
    assert item1_res.status_code == 400, "Safety check failed to block invalid qty reduction"
    print("[PASS] Step 3 Passed: Safety restriction correctly blocked invalid reduction below executed quantity.")

    # 4. Project Estimation Integration Test
    print("\n[Step 4] Verifying Project Estimation compatibility for Project 5...")
    est_res = client.get("/api/estimation/project/5")
    assert est_res.status_code == 200, f"Failed to fetch estimation for Project 5: {est_res.text}"
    est_data = est_res.json()
    
    line22 = next((l for l in est_data["lines"] if l["boq_item_id"] == 22), None)
    assert line22 is not None, "Line for BOQ item 22 not found in estimation"
    print(f"Estimation Line 22: Name='{line22['boq_item_name']}', BOQ Unit='{line22['boq_unit']}'")
    assert line22["boq_unit"] == "Tonnes", f"Expected BOQ unit 'Tonnes', got '{line22['boq_unit']}'"

    # Fetch SOR-004 item
    sor_res = client.get("/api/schedule-of-rates/")
    sors = sor_res.json()
    sor004 = next((s for s in sors if s["sor_code"] == "SOR-004"), None)
    assert sor004 is not None, "SOR-004 not found in SOR list"
    print(f"SOR-004 Details: Code='{sor004['sor_code']}', Desc='{sor004['description']}', Unit='{sor004['unit']}', Rate=Rs. {sor004['rate']}")

    # Save estimate with SOR-004 mapped to BOQ item 22
    save_payload = {
        "project_id": 5,
        "status": "DRAFT",
        "lines": [
            {
                "boq_item_id": 22,
                "sor_item_id": sor004["id"],
                "quantity": 100.0,
                "sor_rate_snapshot": sor004["rate"],
                "estimated_amount": 100.0 * float(sor004["rate"])
            }
        ]
    }
    save_res = client.post("/api/estimation/save", json=save_payload)
    print(f"Save Estimate Status: {save_res.status_code}")
    assert save_res.status_code == 200, f"Failed to save estimate: {save_res.text}"
    saved_est = save_res.json()

    saved_line22 = next((l for l in saved_est["lines"] if l["boq_item_id"] == 22), None)
    assert saved_line22 is not None, "Saved line 22 not found"
    print("Mapped Line Details:", saved_line22)
    assert saved_line22["is_unit_compatible"] == True, "Expected is_unit_compatible to be True"
    assert saved_line22["estimated_amount"] == 6500000.0, f"Expected estimated_amount 6,500,000, got {saved_line22['estimated_amount']}"
    print("[PASS] Step 4 Passed: SOR-004 mapped to BOQ Item 22 successfully without unit mismatch!")

    print("\n==================================================")
    print("ALL 10 REQUIREMENTS VERIFIED & PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_verification()
