from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models import PropertyBooking, PaymentInstallment, PropertyPayment, Customer, AuditLog, Notification
from app.schemas import RecordPaymentRequest

router = APIRouter(prefix="/api", tags=["Payment & Installment Management"])

def calculate_installment_status(inst: PaymentInstallment) -> str:
    total_amt = float(inst.amount or 0)
    paid_amt = float(inst.paid_amount or 0)
    balance_amt = total_amt - paid_amt
    inst.balance_amount = max(0.0, balance_amt)

    if paid_amt >= total_amt:
        return "PAID"
    elif paid_amt > 0:
        return "PARTIALLY_PAID"
    else:
        # Check overdue if due_date < current date
        if inst.due_date and inst.due_date < datetime.utcnow():
            return "OVERDUE"
        return "PENDING"

def enrich_installment(inst: PaymentInstallment) -> dict:
    st = calculate_installment_status(inst)
    inst.status = st

    return {
        "id": inst.id,
        "booking_id": inst.booking_id,
        "customer_id": inst.customer_id,
        "milestone_name": inst.installment_name,
        "sequence_number": inst.sequence_number or 1,
        "due_date": inst.due_date,
        "amount": float(inst.amount or 0),
        "paid_amount": float(inst.paid_amount or 0),
        "balance_amount": float(inst.balance_amount or 0),
        "status": st,
        "paid_date": inst.paid_date,
        "payment_reference": inst.payment_reference,
        "remarks": inst.remarks,
        "created_at": inst.created_at,
        "payments": [
            {
                "id": p.id,
                "payment_code": p.payment_code,
                "amount": float(p.amount or 0),
                "payment_date": p.payment_date,
                "payment_method": p.payment_method,
                "reference_number": p.reference_number,
                "remarks": p.remarks,
                "created_at": p.created_at
            } for p in sorted(inst.payments or [], key=lambda x: x.payment_date, reverse=True)
        ]
    }

def ensure_payment_schedule(booking: PropertyBooking, db: Session) -> List[PaymentInstallment]:
    """Generates a default 4-milestone payment schedule for a booking if none exists."""
    existing = db.query(PaymentInstallment).filter(PaymentInstallment.booking_id == booking.id).order_by(PaymentInstallment.sequence_number).all()
    if existing and len(existing) > 0:
        return existing

    total_val = float(booking.total_price or booking.booking_amount or 500000.0)
    dep_amt = float(booking.booking_amount or (total_val * 0.10))
    rem_amt = max(0.0, total_val - dep_amt)

    # 4 Milestones: Deposit (10%), Foundation (30%), Structure (30%), Possession (30%)
    fnd_amt = rem_amt * (30 / 90)
    str_amt = rem_amt * (30 / 90)
    pos_amt = rem_amt * (30 / 90)

    now = datetime.utcnow()

    inst1 = PaymentInstallment(
        booking_id=booking.id,
        customer_id=booking.customer_id,
        installment_name="Booking Deposit",
        sequence_number=1,
        due_date=now,
        amount=dep_amt,
        paid_amount=dep_amt,
        balance_amount=0.0,
        status="PAID",
        paid_date=now,
        payment_reference="DEP-INIT",
        remarks="Initial booking deposit"
    )

    inst2 = PaymentInstallment(
        booking_id=booking.id,
        customer_id=booking.customer_id,
        installment_name="Foundation Milestone (30%)",
        sequence_number=2,
        due_date=now + timedelta(days=30),
        amount=round(fnd_amt, 2),
        paid_amount=0.0,
        balance_amount=round(fnd_amt, 2),
        status="PENDING"
    )

    inst3 = PaymentInstallment(
        booking_id=booking.id,
        customer_id=booking.customer_id,
        installment_name="Structure Milestone (30%)",
        sequence_number=3,
        due_date=now + timedelta(days=60),
        amount=round(str_amt, 2),
        paid_amount=0.0,
        balance_amount=round(str_amt, 2),
        status="PENDING"
    )

    inst4 = PaymentInstallment(
        booking_id=booking.id,
        customer_id=booking.customer_id,
        installment_name="Possession Handover (30%)",
        sequence_number=4,
        due_date=now + timedelta(days=90),
        amount=round(pos_amt, 2),
        paid_amount=0.0,
        balance_amount=round(pos_amt, 2),
        status="PENDING"
    )

    db.add_all([inst1, inst2, inst3, inst4])
    db.commit()

    # Add initial payment transaction record for the deposit
    p1 = PropertyPayment(
        payment_code=f"PAY-{(db.query(PropertyPayment).count() + 1):04d}",
        installment_id=inst1.id,
        booking_id=booking.id,
        customer_id=booking.customer_id,
        amount=dep_amt,
        payment_date=now,
        payment_method="Bank Transfer",
        reference_number="DEP-INIT-TXN",
        remarks="Initial deposit transaction"
    )
    db.add(p1)
    db.commit()

    return db.query(PaymentInstallment).filter(PaymentInstallment.booking_id == booking.id).order_by(PaymentInstallment.sequence_number).all()

@router.get("/bookings/{booking_id}/payment-schedule")
def get_payment_schedule(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(PropertyBooking).filter(PropertyBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    installments = ensure_payment_schedule(booking, db)

    total_amount = float(booking.total_price or 0)
    total_paid = 0.0
    enriched_insts = []

    for inst in installments:
        e = enrich_installment(inst)
        enriched_insts.append(e)
        total_paid += e["paid_amount"]

    total_outstanding = max(0.0, total_amount - total_paid)
    progress_pct = round((total_paid / total_amount * 100), 1) if total_amount > 0 else 0.0

    # Next due payment
    next_due = None
    for e in enriched_insts:
        if e["status"] in ["PENDING", "PARTIALLY_PAID", "OVERDUE"]:
            next_due = {
                "milestone_name": e["milestone_name"],
                "due_date": e["due_date"],
                "amount": e["balance_amount"],
                "status": e["status"]
            }
            break

    # Payment history across all installments
    history = db.query(PropertyPayment).filter(PropertyPayment.booking_id == booking.id).order_by(PropertyPayment.payment_date.desc()).all()
    payment_history = [
        {
            "id": h.id,
            "payment_code": h.payment_code,
            "installment_id": h.installment_id,
            "installment_name": h.installment.installment_name if h.installment else "N/A",
            "amount": float(h.amount or 0),
            "payment_date": h.payment_date,
            "payment_method": h.payment_method,
            "reference_number": h.reference_number,
            "remarks": h.remarks
        } for h in history
    ]

    return {
        "booking_id": booking.id,
        "booking_number": booking.booking_number,
        "customer_id": booking.customer_id,
        "customer_name": booking.customer.name if booking.customer else "N/A",
        "total_amount": total_amount,
        "total_paid": total_paid,
        "total_outstanding": total_outstanding,
        "progress_pct": progress_pct,
        "next_due_payment": next_due,
        "installments": enriched_insts,
        "payment_history": payment_history
    }

@router.post("/installments/{installment_id}/payments")
def record_installment_payment(installment_id: int, pay_in: RecordPaymentRequest, db: Session = Depends(get_db)):
    # 1. Lock installment row for transaction safety
    inst = db.query(PaymentInstallment).filter(PaymentInstallment.id == installment_id).with_for_update().first()
    if not inst:
        raise HTTPException(status_code=404, detail="Installment record not found")

    amt = float(pay_in.payment_amount or 0)
    if amt <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than 0.")

    # 2. Calculate current balance
    total_amt = float(inst.amount or 0)
    current_paid = float(inst.paid_amount or 0)
    current_balance = max(0.0, total_amt - current_paid)

    if amt > current_balance + 0.01: # Small epsilon tolerance
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount (${amt:,.2f}) exceeds current outstanding balance (${current_balance:,.2f})."
        )

    # 3. Generate unique payment code (PAY-0001)
    cnt = db.query(PropertyPayment).count()
    pay_code = f"PAY-{(cnt + 1):04d}"
    while db.query(PropertyPayment).filter(PropertyPayment.payment_code == pay_code).first() is not None:
        cnt += 1
        pay_code = f"PAY-{(cnt + 1):04d}"

    cust_id = inst.customer_id or (inst.booking.customer_id if inst.booking else None) or 1

    # 4. Create PropertyPayment History Transaction Record
    pay_rec = PropertyPayment(
        payment_code=pay_code,
        installment_id=inst.id,
        booking_id=inst.booking_id,
        customer_id=cust_id,
        amount=amt,
        payment_date=pay_in.payment_date,
        payment_method=pay_in.payment_method or "Bank Transfer",
        reference_number=pay_in.reference_number,
        remarks=pay_in.remarks,
        created_by_id=1
    )
    db.add(pay_rec)

    # 5. Update Installment paid & balance amounts
    new_paid = current_paid + amt
    inst.paid_amount = new_paid
    new_balance = max(0.0, total_amt - new_paid)
    inst.balance_amount = new_balance

    if new_balance <= 0.01:
        inst.status = "PAID"
        inst.paid_date = pay_in.payment_date
    else:
        inst.status = "PARTIALLY_PAID"

    if pay_in.reference_number:
        inst.payment_reference = pay_in.reference_number

    db.flush()

    # Audit Log
    audit = AuditLog(
        user_id=1,
        action="RECORD_PAYMENT",
        entity_type="PropertyPayment",
        entity_id=pay_rec.id,
        payload=f"Recorded payment {pay_code} (${amt:,.2f}) for Installment '{inst.installment_name}' (Status: {inst.status})"
    )
    db.add(audit)

    db.commit()

    return {
        "message": f"Payment {pay_code} recorded successfully.",
        "payment_id": pay_rec.id,
        "payment_code": pay_code,
        "installment_id": inst.id,
        "installment_status": inst.status,
        "new_paid_amount": new_paid,
        "new_balance_amount": new_balance
    }

@router.get("/customers/{customer_id}/payments")
def get_customer_payment_summary(customer_id: int, db: Session = Depends(get_db)):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    bookings = db.query(PropertyBooking).filter(PropertyBooking.customer_id == customer_id).all()
    
    total_amount = 0.0
    total_paid = 0.0

    booking_summaries = []
    for b in bookings:
        schedule = get_payment_schedule(b.id, db)
        total_amount += schedule["total_amount"]
        total_paid += schedule["total_paid"]
        booking_summaries.append({
            "booking_id": b.id,
            "booking_number": b.booking_number,
            "total_amount": schedule["total_amount"],
            "total_paid": schedule["total_paid"],
            "outstanding": schedule["total_outstanding"],
            "status": b.status
        })

    payments = db.query(PropertyPayment).filter(PropertyPayment.customer_id == customer_id).order_by(PropertyPayment.payment_date.desc()).all()
    payment_history = [
        {
            "id": p.id,
            "payment_code": p.payment_code,
            "booking_number": p.booking.booking_number if p.booking else "N/A",
            "amount": float(p.amount or 0),
            "payment_date": p.payment_date,
            "payment_method": p.payment_method,
            "reference_number": p.reference_number
        } for p in payments
    ]

    return {
        "customer_id": cust.id,
        "customer_name": cust.name,
        "total_bookings_count": len(bookings),
        "total_amount": total_amount,
        "total_paid": total_paid,
        "total_outstanding": max(0.0, total_amount - total_paid),
        "bookings": booking_summaries,
        "payment_history": payment_history
    }
