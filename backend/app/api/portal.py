from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import Customer, PropertyBooking, PaymentInstallment, PropertyPayment, Unit, Building, Property, Project
from app.api.payments import enrich_installment, ensure_payment_schedule

router = APIRouter(prefix="/api/portal", tags=["Customer Portal"])

@router.get("/customers/list")
def list_portal_customers(db: Session = Depends(get_db)):
    """Returns a list of customer accounts for easy switching in the Customer Portal UI."""
    customers = db.query(Customer).order_by(Customer.id.asc()).all()
    return [
        {
            "id": c.id,
            "customer_code": c.customer_code or f"CUST-{c.id:04d}",
            "name": c.name,
            "company": c.company,
            "email": c.email,
            "phone": c.phone
        } for c in customers
    ]

@router.get("/customer/{customer_id}")
def get_customer_portal_dashboard(
    customer_id: int, 
    request_role: Optional[str] = Header(None, alias="X-User-Role"),
    request_customer_id: Optional[int] = Header(None, alias="X-Customer-ID"),
    db: Session = Depends(get_db)
):
    # Customer Data Boundary Isolation Check
    if request_role and request_role.lower() == "customer":
        if request_customer_id and int(request_customer_id) != customer_id:
            raise HTTPException(
                status_code=403,
                detail="Access Denied: Customer accounts are strictly isolated and cannot access other customer records."
            )

    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer account not found in database.")

    # Fetch customer's bookings
    bookings = db.query(PropertyBooking).filter(PropertyBooking.customer_id == customer_id).order_by(PropertyBooking.created_at.desc()).all()

    active_booking = None
    unit_info = None
    payment_summary = {
        "total_booking_value": 0.0,
        "total_paid_amount": 0.0,
        "outstanding_balance": 0.0,
        "payment_progress_pct": 0.0
    }
    payment_schedule = []
    payment_history = []
    bookings_list = []

    for b in bookings:
        unit_obj = b.unit
        bld_obj = unit_obj.building if unit_obj else None
        prop_obj = bld_obj.property if bld_obj else None
        proj_obj = prop_obj.project if prop_obj else None

        insts = ensure_payment_schedule(b, db)
        inst_list = [enrich_installment(inst) for inst in insts]

        b_item = {
            "booking_id": b.id,
            "booking_number": b.booking_number,
            "booking_date": b.created_at,
            "status": (b.status or "CONFIRMED").upper(),
            "agreement_status": b.agreement_status or "Draft",
            "booking_amount": float(b.booking_amount or 0),
            "discount": float(b.discount or 0),
            "total_price": float(b.total_price or 0),
            "salesperson_name": b.salesperson.full_name if b.salesperson else None,
            "remarks": b.remarks,
            "unit_number": unit_obj.unit_number if unit_obj else "N/A",
            "unit_type": unit_obj.unit_type if unit_obj else "N/A",
            "area_sqft": float(unit_obj.area_sqft or 0) if unit_obj else 0.0,
            "building_name": bld_obj.name if bld_obj else "N/A",
            "property_name": prop_obj.name if prop_obj else "N/A",
            "project_name": proj_obj.name if proj_obj else "N/A",
            "installments": inst_list
        }
        bookings_list.append(b_item)

    if bookings and len(bookings) > 0:
        b = bookings[0]
        unit = b.unit
        building = unit.building if unit else None
        prop = building.property if building else None
        proj = prop.project if prop else None

        active_booking = {
            "id": b.id,
            "booking_number": b.booking_number,
            "booking_date": b.created_at,
            "status": (b.status or "CONFIRMED").upper(),
            "agreement_status": b.agreement_status or "Draft",
            "booking_amount": float(b.booking_amount or 0),
            "discount": float(b.discount or 0),
            "total_price": float(b.total_price or 0),
            "salesperson_name": b.salesperson.full_name if b.salesperson else None,
            "remarks": b.remarks
        }

        if unit:
            unit_info = {
                "id": unit.id,
                "unit_number": unit.unit_number,
                "unit_code": unit.unit_code,
                "unit_type": unit.unit_type,
                "floor_number": unit.floor_number,
                "area_sqft": float(unit.area_sqft or 0),
                "total_price": float(unit.total_price or 0),
                "status": (unit.status or "BOOKED").upper(),
                "building_name": building.name if building else "N/A",
                "building_code": building.code if building else None,
                "property_name": prop.name if prop else "N/A",
                "property_code": prop.code if prop else None,
                "project_name": proj.name if proj else "N/A",
                "project_code": proj.code if proj else None
            }

        # Load Payment Schedule & Transactions
        insts = ensure_payment_schedule(b, db)
        total_val = float(b.total_price or 0)
        total_paid = 0.0

        for inst in insts:
            e = enrich_installment(inst)
            payment_schedule.append(e)
            total_paid += e["paid_amount"]

        outstanding = max(0.0, total_val - total_paid)
        progress = round((total_paid / total_val * 100), 1) if total_val > 0 else 0.0

        payment_summary = {
            "total_booking_value": total_val,
            "total_paid_amount": total_paid,
            "outstanding_balance": outstanding,
            "payment_progress_pct": progress
        }

        # Payment History
        history = db.query(PropertyPayment).filter(PropertyPayment.customer_id == customer_id).order_by(PropertyPayment.payment_date.desc()).all()
        payment_history = [
            {
                "id": h.id,
                "payment_code": h.payment_code,
                "installment_name": h.installment.installment_name if h.installment else "N/A",
                "amount": float(h.amount or 0),
                "payment_date": h.payment_date,
                "payment_method": h.payment_method,
                "reference_number": h.reference_number,
                "remarks": h.remarks
            } for h in history
        ]

    return {
        "customer": {
            "id": customer.id,
            "customer_code": customer.customer_code or f"CUST-{customer.id:04d}",
            "name": customer.name,
            "company": customer.company,
            "contact_person": customer.contact_person,
            "email": customer.email,
            "phone": customer.phone,
            "customer_type": customer.customer_type or "Individual",
            "address": customer.address,
            "city": customer.city,
            "state": customer.state,
            "postal_code": customer.postal_code,
            "status": customer.status or "active",
            "created_at": customer.created_at
        },
        "booking": active_booking,
        "bookings": bookings_list,
        "unit": unit_info,
        "payment_summary": payment_summary,
        "payment_schedule": payment_schedule,
        "payment_history": payment_history
    }
