from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import uuid
from app.database import get_db
from app.models import ContractorBill, BoqItem, MeasurementBook, Vendor, ApprovalTask, AuditLog, Notification
from app.schemas import ContractorBillCreate, ContractorBillResponse

router = APIRouter(prefix="/api/contractor-billing", tags=["3-Way Contractor Bill Verification Engine"])

@router.get("/bills", response_model=List[ContractorBillResponse])
def list_contractor_bills(db: Session = Depends(get_db)):
    return db.query(ContractorBill).order_by(ContractorBill.created_at.desc()).all()

@router.post("/bills", response_model=ContractorBillResponse)
def submit_contractor_bill(bill_in: ContractorBillCreate, db: Session = Depends(get_db)):
    boq = db.query(BoqItem).filter(BoqItem.id == bill_in.boq_item_id).first()
    if not boq:
        raise HTTPException(status_code=404, detail="BOQ Item not found")

    vendor = db.query(Vendor).filter(Vendor.id == bill_in.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    # 1. Fetch total verified quantity from Measurement Book (MB)
    mb_total_qty = db.query(func.sum(MeasurementBook.measured_qty)).filter(MeasurementBook.boq_item_id == boq.id).scalar() or 0.0
    mb_total_qty = float(mb_total_qty)
    boq_qty = float(boq.approved_qty)
    billed_qty = float(bill_in.billed_qty)
    total_billed = billed_qty * float(bill_in.billed_rate)

    # 2. Perform 3-Way Verification Comparison: BOQ ↔ MB ↔ Contractor Bill
    discrepancy = False
    reasons = []

    if billed_qty > mb_total_qty:
        discrepancy = True
        reasons.append(f"Billed quantity ({billed_qty} {boq.unit}) EXCEEDS verified site Measurement Book (MB) quantity ({mb_total_qty} {boq.unit}). Delta: +{billed_qty - mb_total_qty} {boq.unit}.")

    if mb_total_qty > boq_qty:
        discrepancy = True
        reasons.append(f"Site MB quantity ({mb_total_qty} {boq.unit}) EXCEEDS approved BOQ ceiling quantity ({boq_qty} {boq.unit}). Delta: +{mb_total_qty - boq_qty} {boq.unit}.")

    bill_code = f"CB-{uuid.uuid4().hex[:8].upper()}"
    status_state = "discrepancy_flagged" if discrepancy else "verified_matched"
    reason_str = " | ".join(reasons) if discrepancy else "3-Way Match Verified (BOQ <= MB <= Bill)"

    # Capture rate snapshot from linked SOR item if available
    sor_ed_name = None
    sor_reg_name = None
    s_code = None
    b_rate = None
    c_index = None
    a_rate = None

    if boq and boq.sor_id:
        sor_obj = boq.sor
        if sor_obj:
            sor_ed_name = sor_obj.sor_edition_name
            sor_reg_name = sor_obj.sor_region_name
            s_code = sor_obj.sor_code
            b_rate = float(sor_obj.base_rate or sor_obj.rate or 0.0)
            c_index = float(sor_obj.cost_index if sor_obj.cost_index is not None else 1.0)
            a_rate = round(b_rate * c_index, 2)

    bill = ContractorBill(
        bill_number=bill_code,
        project_id=bill_in.project_id,
        vendor_id=bill_in.vendor_id,
        boq_item_id=bill_in.boq_item_id,
        billed_qty=bill_in.billed_qty,
        billed_rate=bill_in.billed_rate,
        total_billed_amount=total_billed,
        mb_qty=mb_total_qty,
        boq_qty=boq_qty,
        discrepancy_flag=discrepancy,
        discrepancy_reason=reason_str,
        status=status_state,
        sor_edition_name=sor_ed_name,
        sor_region_name=sor_reg_name,
        sor_code=s_code,
        base_rate=b_rate,
        cost_index=c_index,
        adjusted_rate=a_rate,
        snapshot_timestamp=datetime.utcnow()
    )
    db.add(bill)
    db.flush()

    # 3. Log Audit
    audit_action = "BILL_DISCREPANCY" if discrepancy else "BILL_VERIFY"
    audit = AuditLog(
        user_id=1, 
        action=audit_action, 
        entity_type="ContractorBill", 
        entity_id=bill.id, 
        payload=f"Bill #{bill_code} Submitted. 3-Way Status: {status_state}. {reason_str}"
    )
    db.add(audit)

    # 4. Trigger Approval Workflow Task (Initial Stage = Site Engineer, Section 7)
    task = ApprovalTask(
        title=f"Contractor Bill Verification #{bill_code} ({vendor.name}) - {'DISCREPANCY FLAGGED' if discrepancy else 'MATCHED'}",
        entity_type="CONTRACTOR_BILL_PAYMENT",
        entity_id=bill.id,
        requester_id=1,
        current_stage="Site Engineer",
        status="pending",
        request_type="CONTRACTOR_BILL_PAYMENT",
        request_category="FINANCIAL",
        source_module="FINANCIAL_REQUESTS"
    )
    db.add(task)

    # 5. Notify Finance & Management
    notif = Notification(
        user_id=1,
        title=f"Contractor Bill #{bill_code} {'Discrepancy Warning' if discrepancy else 'Verified'}",
        message=f"Vendor '{vendor.name}' submitted bill for ${total_billed:.2f}. {reason_str}",
        notification_type="warning" if discrepancy else "info",
        entity_type="ContractorBill",
        entity_id=bill.id
    )
    db.add(notif)

    db.commit()
    db.refresh(bill)
    return bill
