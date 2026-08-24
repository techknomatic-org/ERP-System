from app.database import SessionLocal
from app.models import PropertyBooking, Unit, Customer, User
from datetime import datetime

def seed_bookings():
    db = SessionLocal()
    try:
        cust = db.query(Customer).filter(Customer.email == "contact@abccorp.com").first()
        u1 = db.query(Unit).filter(Unit.unit_number == "Office 104").first()
        u2 = db.query(Unit).filter(Unit.unit_number == "Office 101").first()

        if cust and u1:
            b1 = db.query(PropertyBooking).filter(PropertyBooking.unit_id == u1.id).first()
            if not b1:
                b1 = PropertyBooking(
                    booking_number="BKG-0001",
                    unit_id=u1.id,
                    customer_id=cust.id,
                    booking_amount=37800.0,
                    discount=0.0,
                    total_price=float(u1.total_price or 378000.0),
                    agreement_status="Draft",
                    status="CONFIRMED",
                    remarks="10% Initial Deposit Received from ABC Corporation"
                )
                u1.status = "BOOKED"
                db.add(b1)
                db.commit()

        if cust and u2:
            b2 = db.query(PropertyBooking).filter(PropertyBooking.unit_id == u2.id).first()
            if not b2:
                b2 = PropertyBooking(
                    booking_number="BKG-0002",
                    unit_id=u2.id,
                    customer_id=cust.id,
                    booking_amount=45000.0,
                    discount=0.0,
                    total_price=float(u2.total_price or 450000.0),
                    agreement_status="Draft",
                    status="CONFIRMED",
                    remarks="10% Booking Deposit Received"
                )
                u2.status = "BOOKED"
                db.add(b2)
                db.commit()

        print("[+] Story 6 sample Bookings seeded successfully in MySQL!")
    except Exception as e:
        db.rollback()
        print("[-] Error seeding bookings:", e)
    finally:
        db.close()

if __name__ == "__main__":
    seed_bookings()
