from app.database import SessionLocal, engine
from sqlalchemy import text
from app.models import Building, Property, Unit

def update_units():
    db = SessionLocal()
    try:
        b1 = db.query(Building).filter(Building.code == "BLD-TOWER-A").first()
        if b1:
            units = db.query(Unit).all()
            for u in units:
                if u.status:
                    u.status = u.status.upper()
                if not u.building_id:
                    u.building_id = b1.id
            db.commit()

            # Ensure sample records exist for story 3
            sample_codes = ["U-TOWER-A-101", "U-TOWER-A-102", "U-TOWER-A-103", "U-TOWER-A-104", "U-TOWER-A-R01"]
            existing_codes = [u.unit_code for u in db.query(Unit).all()]

            if "U-TOWER-A-101" not in existing_codes:
                u1 = Unit(building_id=b1.id, unit_number="Office 101", unit_code="U-TOWER-A-101", unit_type="Office", floor_number=1, area_sqft=2500.0, rate_per_sqft=180.0, total_price=450000.0, status="AVAILABLE", facing="North", configuration="Executive Office", description="Prime ground floor office space")
                u2 = Unit(building_id=b1.id, unit_number="Office 102", unit_code="U-TOWER-A-102", unit_type="Office", floor_number=1, area_sqft=3000.0, rate_per_sqft=190.0, total_price=570000.0, status="AVAILABLE", facing="East", configuration="Corner Suite", description="Spacious corner unit with east view")
                u3 = Unit(building_id=b1.id, unit_number="Office 103", unit_code="U-TOWER-A-103", unit_type="Office", floor_number=1, area_sqft=1500.0, rate_per_sqft=200.0, total_price=300000.0, status="HELD", facing="North-East", configuration="Standard Suite", description="Temporarily held for client review")
                u4 = Unit(building_id=b1.id, unit_number="Office 104", unit_code="U-TOWER-A-104", unit_type="Office", floor_number=1, area_sqft=1800.0, rate_per_sqft=210.0, total_price=378000.0, status="BOOKED", facing="South", configuration="Executive Office", description="Booked unit under sales process")
                u5 = Unit(building_id=b1.id, unit_number="Retail 01", unit_code="U-TOWER-A-R01", unit_type="Retail Shop", floor_number=1, area_sqft=1200.0, rate_per_sqft=250.0, total_price=300000.0, status="SOLD", facing="West", configuration="High-Street Retail", description="Sold retail store location")
                db.add_all([u1, u2, u3, u4, u5])
                db.commit()

            # Update total units in b1 and property
            b1.total_units = db.query(Unit).filter(Unit.building_id == b1.id).count()
            if b1.property:
                b1.property.total_units = b1.total_units
            db.commit()

        print("[+] Story 3 units database update complete!")
    except Exception as e:
        db.rollback()
        print("[-] Error:", e)
    finally:
        db.close()

if __name__ == "__main__":
    update_units()
