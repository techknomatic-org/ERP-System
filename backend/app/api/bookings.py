from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import PropertyBooking, Unit, Customer, User, Building, Property, Project, AuditLog, Notification
from app.schemas import PropertyBookingCreate, BookingCancelRequest

router = APIRouter(prefix="/api/bookings", tags=["Property Bookings & Allotments"])

def enrich_booking(booking: PropertyBooking) -> dict:
    unit = booking.unit
    customer = booking.customer
    building = unit.building if unit else None
    property_obj = building.property if building else None
    project = property_obj.project if property_obj else None

    salesperson_name = booking.salesperson.full_name if booking.salesperson else None
    cancelled_by_name = booking.cancelled_by.full_name if booking.cancelled_by else None

    return {
        "id": booking.id,
        "booking_number": booking.booking_number,
        "unit_id": booking.unit_id,
        "unit_number": unit.unit_number if unit else "N/A",
        "unit_code": unit.unit_code if unit else None,
        "unit_type": unit.unit_type if unit else None,
        "unit_floor": unit.floor_number if unit else None,
        "unit_area": float(unit.area_sqft) if unit else 0.0,
        "unit_base_price": float(unit.total_price) if unit else 0.0,
        "unit_status": (unit.status if unit else "AVAILABLE").upper(),
        "customer_id": booking.customer_id,
        "customer_code": customer.customer_code if customer else None,
        "customer_name": customer.name if customer else "N/A",
        "customer_company": customer.company if customer else None,
        "customer_phone": customer.phone if customer else None,
        "customer_email": customer.email if customer else None,
        "building_id": building.id if building else None,
        "building_name": building.name if building else "N/A",
        "building_code": building.code if building else None,
        "property_id": property_obj.id if property_obj else None,
        "property_name": property_obj.name if property_obj else "N/A",
        "property_code": property_obj.code if property_obj else None,
        "project_id": project.id if project else None,
        "project_name": project.name if project else "N/A",
        "project_code": project.code if project else None,
        "salesperson_id": booking.salesperson_id,
        "salesperson_name": salesperson_name,
        "booking_amount": float(booking.booking_amount or 0),
        "discount": float(booking.discount or 0),
        "total_price": float(booking.total_price or 0),
        "status": (booking.status or "CONFIRMED").upper(),
        "agreement_status": booking.agreement_status or "Draft",
        "expected_agreement_date": booking.expected_agreement_date,
        "created_at": booking.created_at,
        "remarks": booking.remarks,
        "notes": booking.notes,
        "cancellation_reason": booking.cancellation_reason,
        "cancellation_date": booking.cancellation_date,
        "cancelled_by_name": cancelled_by_name
    }

@router.get("/kpis")
def get_booking_kpis(db: Session = Depends(get_db)):
    bookings = db.query(PropertyBooking).all()
    kpis = {
        "total": len(bookings),
        "confirmed": 0,
        "pending": 0,
        "cancelled": 0,
        "total_booking_value": 0.0
    }
    for b in bookings:
        st = (b.status or "CONFIRMED").upper()
        if st in ["CONFIRMED", "BOOKED"]:
            kpis["confirmed"] += 1
            kpis["total_booking_value"] += float(b.booking_amount or 0)
        elif st == "PENDING":
            kpis["pending"] += 1
        elif st == "CANCELLED":
            kpis["cancelled"] += 1
        else:
            kpis["confirmed"] += 1
            kpis["total_booking_value"] += float(b.booking_amount or 0)

    return kpis

@router.get("/", response_model=List[dict])
def list_bookings(
    search: Optional[str] = None,
    status: Optional[str] = None,
    project_id: Optional[int] = None,
    property_id: Optional[int] = None,
    building_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(PropertyBooking)

    if status and status.upper() != "ALL":
        query = query.filter(PropertyBooking.status == status.upper())

    if customer_id:
        query = query.filter(PropertyBooking.customer_id == customer_id)

    bookings = query.order_by(PropertyBooking.created_at.desc()).all()

    # Contextual Filtering & Search in Python
    filtered = []
    for b in bookings:
        unit = b.unit
        building = unit.building if unit else None
        prop = building.property if building else None
        proj = prop.project if prop else None

        if project_id and (not proj or proj.id != project_id):
            continue
        if property_id and (not prop or prop.id != property_id):
            continue
        if building_id and (not building or building.id != building_id):
            continue

        if search:
            s = search.lower()
            customer_name = (b.customer.name if b.customer else "").lower()
            booking_num = (b.booking_number or "").lower()
            unit_num = (unit.unit_number if unit else "").lower()
            if s not in customer_name and s not in booking_num and s not in unit_num:
                continue

        filtered.append(enrich_booking(b))

    return filtered

@router.get("/{booking_id}", response_model=dict)
def get_booking_by_id(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(PropertyBooking).filter(PropertyBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return enrich_booking(booking)

@router.post("/", response_model=dict)
def create_booking(booking_in: PropertyBookingCreate, db: Session = Depends(get_db)):
    # 1. Validate Customer
    customer = db.query(Customer).filter(Customer.id == booking_in.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Selected Customer record does not exist in database.")

    # 2. Row Lock Unit transactionally
    unit = db.query(Unit).filter(Unit.id == booking_in.unit_id).with_for_update().first()
    if not unit:
        raise HTTPException(status_code=404, detail="Selected Unit does not exist in database.")

    unit_st = (unit.status or "AVAILABLE").upper()
    if unit_st != "AVAILABLE":
        raise HTTPException(
            status_code=400,
            detail=f"Unit '{unit.unit_number}' is no longer available. Current status is '{unit_st}'."
        )

    # 3. Check for existing active booking for this unit
    active_bkg = db.query(PropertyBooking).filter(
        PropertyBooking.unit_id == unit.id,
        PropertyBooking.status.in_(["CONFIRMED", "PENDING", "BOOKED", "booked"])
    ).first()
    if active_bkg:
        raise HTTPException(
            status_code=400,
            detail=f"Unit '{unit.unit_number}' already has an active Booking ({active_bkg.booking_number})."
        )

    # 4. Generate unique Booking Code (BKG-0001)
    total_count = db.query(PropertyBooking).count()
    booking_code = f"BKG-{(total_count + 1):04d}"
    while db.query(PropertyBooking).filter(PropertyBooking.booking_number == booking_code).first() is not None:
        total_count += 1
        booking_code = f"BKG-{(total_count + 1):04d}"

    total_price = float(unit.total_price or 0) - float(booking_in.discount or 0)

    # 5. Create PropertyBooking Record
    booking = PropertyBooking(
        booking_number=booking_code,
        unit_id=unit.id,
        customer_id=customer.id,
        salesperson_id=booking_in.salesperson_id,
        booking_amount=booking_in.booking_amount,
        discount=booking_in.discount or 0.0,
        total_price=total_price,
        agreement_status=booking_in.agreement_status or "Draft",
        expected_agreement_date=booking_in.expected_agreement_date,
        status=(booking_in.status or "CONFIRMED").upper(),
        remarks=booking_in.remarks,
        notes=booking_in.notes
    )
    db.add(booking)

    # 6. Lock Unit status: AVAILABLE -> BOOKED
    unit.status = "BOOKED"

    # Update parent building & property counts if applicable
    db.flush()

    # Audit & Notification
    audit = AuditLog(
        user_id=1,
        action="BOOKING",
        entity_type="PropertyBooking",
        entity_id=booking.id,
        payload=f"Created Booking {booking_code} for Unit #{unit.unit_number} by Customer '{customer.name}'. Amount: ${booking_in.booking_amount}"
    )
    db.add(audit)

    notif = Notification(
        user_id=1,
        title=f"Unit #{unit.unit_number} Booked",
        message=f"Booking {booking_code} generated for {customer.name}. Unit status changed to BOOKED.",
        notification_type="alert",
        entity_type="PropertyBooking",
        entity_id=booking.id
    )
    db.add(notif)

    db.commit()
    db.refresh(booking)

    return enrich_booking(booking)

@router.post("/{booking_id}/cancel")
def cancel_booking(booking_id: int, cancel_in: BookingCancelRequest, db: Session = Depends(get_db)):
    booking = db.query(PropertyBooking).filter(PropertyBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    st = (booking.status or "").upper()
    if st == "CANCELLED":
        raise HTTPException(status_code=400, detail=f"Booking {booking.booking_number} is already cancelled.")

    # 1. Update Booking Status -> CANCELLED
    booking.status = "CANCELLED"
    booking.cancellation_reason = cancel_in.cancellation_reason
    booking.cancellation_date = datetime.utcnow()
    booking.cancelled_by_id = 1

    # 2. Return Unit status: BOOKED -> AVAILABLE
    unit = booking.unit
    if unit:
        unit.status = "AVAILABLE"

    audit = AuditLog(
        user_id=1,
        action="CANCEL_BOOKING",
        entity_type="PropertyBooking",
        entity_id=booking.id,
        payload=f"Cancelled Booking {booking.booking_number} for Unit #{unit.unit_number if unit else 'N/A'}. Reason: {cancel_in.cancellation_reason}"
    )
    db.add(audit)

    db.commit()
    return {
        "message": f"Booking {booking.booking_number} cancelled successfully and Unit returned to AVAILABLE status.",
        "booking_id": booking.id,
        "unit_status": "AVAILABLE"
    }
