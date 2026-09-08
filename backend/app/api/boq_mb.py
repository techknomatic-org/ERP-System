from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import (
    BoqItem, MeasurementBook, SiteDailyLog, WbsTask, Vendor, Project, User,
    ContractorBill, ApprovalTask, PurchaseRequisition, MaterialPurchaseRequest, AuditLog
)
from app.schemas import (
    BoqItemCreate, BoqItemUpdate, BoqItemResponse,
    MeasurementBookCreate, MeasurementBookResponse
)
from app.api.audit import record_audit_log

router = APIRouter(prefix="/api/boq-mb", tags=["BOQ & Measurement Book"])

class MaterialRequestFromBoq(BaseModel):
    project_id: int
    boq_item_id: int
    material_name: str
    quantity: float
    unit: str
    estimated_cost: float
    reason: Optional[str] = "Material requirement generated from BOQ"
    preferred_vendor_id: Optional[int] = None

class ContractorBillFromBoq(BaseModel):
    project_id: int
    boq_item_id: int
    vendor_id: int
    billed_qty: float
    billed_rate: float
    remarks: Optional[str] = None

@router.get("/wbs-hierarchy/{project_id}")
def get_wbs_hierarchy(project_id: int, db: Session = Depends(get_db)):
    """Returns WBS Phases, Tasks, and Subtasks structured for cascade dropdowns."""
    phases = db.query(WbsTask).filter(
        WbsTask.project_id == project_id,
        WbsTask.task_level == "Phase"
    ).all()

    tasks = db.query(WbsTask).filter(
        WbsTask.project_id == project_id,
        WbsTask.task_level == "Task"
    ).all()

    subtasks = db.query(WbsTask).filter(
        WbsTask.project_id == project_id,
        WbsTask.task_level == "Subtask"
    ).all()

    return {
        "phases": [{"id": p.id, "wbs_code": p.wbs_code, "title": p.title} for p in phases],
        "tasks": [{"id": t.id, "wbs_code": t.wbs_code, "parent_task_id": t.parent_task_id, "title": t.title} for t in tasks],
        "subtasks": [{"id": s.id, "wbs_code": s.wbs_code, "parent_task_id": s.parent_task_id, "title": s.title} for s in subtasks]
    }

@router.get("/boq/project/{project_id}", response_model=List[BoqItemResponse])
def get_boq_items(project_id: int, db: Session = Depends(get_db)):
    """Returns all BOQ items for a specific project with calculated measurements & WBS metadata."""
    items = db.query(BoqItem).filter(BoqItem.project_id == project_id).order_by(BoqItem.id.asc()).all()
    res = []

    for item in items:
        # Compute total executed quantity from valid SiteDailyLogs & MeasurementBooks
        log_executed = db.query(func.coalesce(func.sum(SiteDailyLog.executed_qty), 0.00)).filter(
            SiteDailyLog.boq_item_id == item.id,
            SiteDailyLog.approval_status != "rejected"
        ).scalar()
        mb_executed = db.query(func.coalesce(func.sum(MeasurementBook.measured_qty), 0.00)).filter(
            MeasurementBook.boq_item_id == item.id,
            MeasurementBook.status == "APPROVED",
            MeasurementBook.site_log_id.is_(None),
            MeasurementBook.location_zone.not_like("Site Daily Log #%")
        ).scalar()

        total_executed = float(log_executed or 0.0) + float(mb_executed or 0.0)

        total_executed = float(total_executed or 0.0)
        approved_qty = float(item.approved_qty or 0.0)
        remaining_qty = max(0.0, approved_qty - total_executed)
        progress_pct = min(100.0, (total_executed / approved_qty * 100.0)) if approved_qty > 0 else 0.0

        # Auto update status to COMPLETED if progress reached 100%
        item_status = item.status or "ACTIVE"
        if progress_pct >= 100.0 and item_status != "COMPLETED":
            item_status = "COMPLETED"
            item.status = "COMPLETED"
            db.commit()

        # Resolve titles and wbs_code
        phase_title = item.phase.title if item.phase else None
        task_title = item.task.title if item.task else None
        subtask_title = item.subtask.title if item.subtask else None
        contractor_display = item.vendor.name if item.vendor else item.contractor_name
        wbs_code = item.subtask.wbs_code if (item.subtask and item.subtask.wbs_code) else (item.task.wbs_code if (item.task and item.task.wbs_code) else (item.phase.wbs_code if (item.phase and item.phase.wbs_code) else None))

        res.append({
            "id": item.id,
            "project_id": item.project_id,
            "phase_id": item.phase_id,
            "task_id": item.task_id,
            "subtask_id": item.subtask_id,
            "wbs_code": wbs_code,
            "phase_title": phase_title,
            "task_title": task_title,
            "subtask_title": subtask_title,
            "item_name": item.item_name,
            "unit": item.unit,
            "approved_qty": approved_qty,
            "rate": float(item.rate or 0.0),
            "total_amount": float(item.total_amount or (approved_qty * float(item.rate or 0.0))),
            "vendor_id": item.vendor_id,
            "contractor_name": contractor_display,
            "executed_qty": total_executed,
            "remaining_qty": remaining_qty,
            "progress_pct": round(progress_pct, 2),
            "status": item_status,
            "created_at": item.created_at
        })

    return res

@router.post("/boq", response_model=BoqItemResponse)
def create_boq_item(boq_in: BoqItemCreate, user_id: int = 1, db: Session = Depends(get_db)):
    if not boq_in.item_name or not boq_in.item_name.strip():
        raise HTTPException(status_code=400, detail="BOQ Item Description is required.")

    if boq_in.approved_qty is None or float(boq_in.approved_qty) <= 0:
        raise HTTPException(status_code=400, detail="Approved Quantity must be greater than 0.")

    if boq_in.rate is None or float(boq_in.rate) < 0:
        raise HTTPException(status_code=400, detail="Unit Rate must be greater than or equal to 0.")

    total = round(float(boq_in.approved_qty) * float(boq_in.rate), 2)
    
    # Resolve vendor name if vendor_id provided
    vendor_name = boq_in.contractor_name
    if boq_in.vendor_id:
        v = db.query(Vendor).filter(Vendor.id == boq_in.vendor_id).first()
        if v:
            vendor_name = v.name

    boq = BoqItem(
        project_id=boq_in.project_id,
        phase_id=boq_in.phase_id,
        task_id=boq_in.task_id,
        subtask_id=boq_in.subtask_id,
        item_name=boq_in.item_name,
        unit=boq_in.unit,
        approved_qty=boq_in.approved_qty,
        rate=boq_in.rate,
        total_amount=total,
        vendor_id=boq_in.vendor_id,
        contractor_name=vendor_name,
        created_by_id=user_id,
        status="ACTIVE"
    )
    db.add(boq)
    db.commit()
    db.refresh(boq)

    record_audit_log(
        db=db,
        user_id=user_id,
        action="CREATE_BOQ_ITEM",
        entity_type="BoqItem",
        entity_id=boq.id,
        payload=f"Created BOQ Item '{boq.item_name}' (Qty: {boq.approved_qty} {boq.unit} @ {boq.rate}/unit = {total}) for Project #{boq.project_id}"
    )

    return get_boq_items(boq_in.project_id, db)[-1]

@router.put("/boq/{boq_item_id}", response_model=BoqItemResponse)
def update_boq_item(boq_item_id: int, boq_in: BoqItemUpdate, user_id: int = 1, db: Session = Depends(get_db)):
    boq = db.query(BoqItem).filter(BoqItem.id == boq_item_id).first()
    if not boq:
        raise HTTPException(status_code=404, detail="BOQ Line Item not found")

    # Technical Sanction Approval Locking Check
    from app.models import ProjectEstimate
    est = db.query(ProjectEstimate).filter(
        ProjectEstimate.project_id == boq.project_id
    ).order_by(ProjectEstimate.revision_number.desc(), ProjectEstimate.id.desc()).first()
    if est and (est.is_ts_locked or est.ts_status == "APPROVED"):
        if float(boq_in.approved_qty) != float(boq.approved_qty):
            raise HTTPException(
                status_code=400,
                detail="BOQ quantity cannot be changed after Technical Sanction approval. Create a Revised DE."
            )

    if not boq_in.item_name or not boq_in.item_name.strip():
        raise HTTPException(status_code=400, detail="BOQ Item Description is required.")

    if boq_in.approved_qty is None or float(boq_in.approved_qty) <= 0:
        raise HTTPException(status_code=400, detail="Approved Quantity must be greater than 0.")

    if boq_in.rate is None or float(boq_in.rate) < 0:
        raise HTTPException(status_code=400, detail="Unit Rate must be greater than or equal to 0.")

    # Execution & Financial safety check: compute downstream records
    log_executed = db.query(func.coalesce(func.sum(SiteDailyLog.executed_qty), 0.00)).filter(
        SiteDailyLog.boq_item_id == boq.id,
        SiteDailyLog.approval_status != "rejected"
    ).scalar()
    mb_executed = db.query(func.coalesce(func.sum(MeasurementBook.measured_qty), 0.00)).filter(
        MeasurementBook.boq_item_id == boq.id,
        MeasurementBook.status == "APPROVED",
        MeasurementBook.site_log_id.is_(None),
        MeasurementBook.location_zone.not_like("Site Daily Log #%")
    ).scalar()
    total_executed = float(log_executed or 0.0) + float(mb_executed or 0.0)

    mb_count = db.query(MeasurementBook).filter(MeasurementBook.boq_item_id == boq.id).count()
    bill_count = db.query(ContractorBill).filter(ContractorBill.boq_item_id == boq.id).count()

    has_downstream_records = (total_executed > 0 or mb_count > 0 or bill_count > 0)

    new_approved_qty = float(boq_in.approved_qty)

    # Financial/execution safety restrictions for items with historical records
    if has_downstream_records:
        if total_executed > 0 and new_approved_qty < total_executed:
            raise HTTPException(
                status_code=400,
                detail=f"Approved Quantity ({new_approved_qty} {boq_in.unit}) cannot be less than total executed quantity ({total_executed} {boq.unit}) recorded on site."
            )
        if boq_in.unit != boq.unit:
            raise HTTPException(
                status_code=400,
                detail=f"Unit cannot be changed from '{boq.unit}' to '{boq_in.unit}' because this BOQ item has downstream execution/financial records."
            )

    # Resolve vendor name if vendor_id provided
    vendor_name = boq_in.contractor_name
    if boq_in.vendor_id:
        v = db.query(Vendor).filter(Vendor.id == boq_in.vendor_id).first()
        if v:
            vendor_name = v.name

    total = round(new_approved_qty * float(boq_in.rate), 2)

    boq.item_name = boq_in.item_name.strip()
    boq.unit = boq_in.unit
    boq.approved_qty = new_approved_qty
    boq.rate = float(boq_in.rate)
    boq.total_amount = total
    boq.phase_id = boq_in.phase_id
    boq.task_id = boq_in.task_id
    boq.subtask_id = boq_in.subtask_id
    boq.vendor_id = boq_in.vendor_id
    if vendor_name:
        boq.contractor_name = vendor_name

    db.commit()
    db.refresh(boq)

    record_audit_log(
        db=db,
        user_id=user_id,
        action="UPDATE_BOQ_ITEM",
        entity_type="BoqItem",
        entity_id=boq.id,
        payload=f"Updated BOQ Item #{boq.id} '{boq.item_name}' (Qty: {boq.approved_qty} {boq.unit} @ {boq.rate}/unit = {total})"
    )

    items = get_boq_items(boq.project_id, db)
    updated_item = next((i for i in items if i["id"] == boq.id), None)
    if updated_item:
        return updated_item
    
    return {
        "id": boq.id,
        "project_id": boq.project_id,
        "phase_id": boq.phase_id,
        "task_id": boq.task_id,
        "subtask_id": boq.subtask_id,
        "wbs_code": None,
        "phase_title": None,
        "task_title": None,
        "subtask_title": None,
        "item_name": boq.item_name,
        "unit": boq.unit,
        "approved_qty": float(boq.approved_qty),
        "rate": float(boq.rate),
        "total_amount": float(boq.total_amount),
        "vendor_id": boq.vendor_id,
        "contractor_name": boq.contractor_name,
        "executed_qty": total_executed,
        "remaining_qty": max(0.0, float(boq.approved_qty) - total_executed),
        "progress_pct": round((total_executed / float(boq.approved_qty) * 100.0), 2) if float(boq.approved_qty) > 0 else 0.0,
        "status": boq.status or "ACTIVE",
        "created_at": boq.created_at
    }

@router.get("/mb/boq/{boq_item_id}", response_model=List[MeasurementBookResponse])
def get_mb_records(boq_item_id: int, db: Session = Depends(get_db)):
    """Returns all measurement book logs for a specific BOQ item."""
    return db.query(MeasurementBook).filter(MeasurementBook.boq_item_id == boq_item_id).order_by(MeasurementBook.log_date.desc()).all()

@router.post("/mb", response_model=MeasurementBookResponse)
def record_measurement_book(mb_in: MeasurementBookCreate, engineer_id: int = 1, db: Session = Depends(get_db)):
    """Records a site measurement book (MB) entry against a BOQ item & updates WBS task progress."""
    boq = db.query(BoqItem).filter(BoqItem.id == mb_in.boq_item_id).first()
    if not boq:
        raise HTTPException(status_code=404, detail="BOQ Line Item not found")

    # Compute current total executed qty
    current_executed = db.query(func.coalesce(func.sum(MeasurementBook.measured_qty), 0.00)).filter(
        MeasurementBook.boq_item_id == boq.id,
        MeasurementBook.status == "APPROVED"
    ).scalar()
    current_executed = float(current_executed or 0.0)

    # Check ceiling limit
    new_total = current_executed + float(mb_in.measured_qty)
    approved_ceiling = float(boq.approved_qty or 0.0)
    if new_total > approved_ceiling:
        raise HTTPException(
            status_code=400,
            detail=f"Executed quantity ({new_total} {boq.unit}) cannot exceed approved BOQ ceiling ({approved_ceiling} {boq.unit}). Current executed: {current_executed} {boq.unit}."
        )

    mb = MeasurementBook(
        project_id=mb_in.project_id,
        boq_item_id=mb_in.boq_item_id,
        phase_id=mb_in.phase_id or boq.phase_id,
        task_id=mb_in.task_id or boq.task_id,
        subtask_id=mb_in.subtask_id or boq.subtask_id,
        engineer_id=engineer_id,
        location_zone=mb_in.location_zone,
        measured_qty=mb_in.measured_qty,
        unit=mb_in.unit or boq.unit,
        remarks=mb_in.remarks,
        status="APPROVED"
    )
    db.add(mb)
    db.commit()
    db.refresh(mb)

    # Update WBS task actual quantity and progress if task linked
    target_task_id = mb_in.subtask_id or mb_in.task_id or boq.subtask_id or boq.task_id
    if target_task_id:
        task = db.query(WbsTask).filter(WbsTask.id == target_task_id).first()
        if task:
            task.actual_qty = float(task.actual_qty or 0.0) + float(mb_in.measured_qty)
            planned = float(task.planned_qty or 0.0)
            if planned > 0:
                task.progress_pct = min(100.0, (float(task.actual_qty) / planned) * 100.0)
            if task.progress_pct >= 100.0:
                task.status = "completed"
            elif task.progress_pct > 0:
                task.status = "in_progress"
            db.commit()

    record_audit_log(
        db=db,
        user_id=engineer_id,
        action="RECORD_MEASUREMENT",
        entity_type="MeasurementBook",
        entity_id=mb.id,
        payload=f"Recorded MB measurement of {mb.measured_qty} {boq.unit} for BOQ Line Item '{boq.item_name}' (Total Executed: {new_total}/{approved_ceiling})"
    )

    return mb

@router.post("/material-request")
def create_material_request_from_boq(req: MaterialRequestFromBoq, user_id: int = 1, db: Session = Depends(get_db)):
    """Creates a Material Request / PR from a BOQ item."""
    boq = db.query(BoqItem).filter(BoqItem.id == req.boq_item_id).first()
    if not boq:
        raise HTTPException(status_code=404, detail="BOQ Item not found")

    mpr_code = f"MPR-BOQ-{int(datetime.utcnow().timestamp())}"
    mpr = MaterialPurchaseRequest(
        request_number=mpr_code,
        project_id=req.project_id,
        requested_by=user_id,
        material_name=req.material_name or boq.item_name,
        material_category="BOQ Material Requisition",
        quantity=req.quantity,
        unit=req.unit or boq.unit,
        estimated_cost=req.estimated_cost or (float(req.quantity) * float(boq.rate)),
        preferred_vendor_id=req.preferred_vendor_id or boq.vendor_id,
        reason=f"[BOQ Ref #{boq.id}] {req.reason}",
        status="PENDING_PM_APPROVAL",
        current_approval_stage="Project Manager"
    )
    db.add(mpr)
    db.commit()
    db.refresh(mpr)

    # Trigger Non-Financial Approval Task (SE -> PM -> Completed)
    approval_task = ApprovalTask(
        title=f"BOQ Material Request: {mpr.material_name} ({mpr.quantity} {mpr.unit})",
        entity_type="MaterialPurchaseRequest",
        entity_id=mpr.id,
        requester_id=user_id,
        current_stage="Project Manager",
        status="pending",
        request_type="Material Request",
        request_category="NON-FINANCIAL",
        source_module="Material Requests"
    )
    db.add(approval_task)
    db.commit()

    record_audit_log(
        db=db,
        user_id=user_id,
        action="CREATE_MATERIAL_REQUEST",
        entity_type="MaterialPurchaseRequest",
        entity_id=mpr.id,
        payload=f"Generated Material Request #{mpr.request_number} against BOQ Item '{boq.item_name}'"
    )

    return {"message": "Material Request generated successfully", "mpr_id": mpr.id, "request_number": mpr.request_number}

@router.post("/contractor-bill")
def create_contractor_bill_from_boq(bill_in: ContractorBillFromBoq, user_id: int = 1, db: Session = Depends(get_db)):
    """Creates a Contractor Bill from approved BOQ measurements and submits a 4-Stage Financial Approval Request."""
    boq = db.query(BoqItem).filter(BoqItem.id == bill_in.boq_item_id).first()
    if not boq:
        raise HTTPException(status_code=404, detail="BOQ Line Item not found")

    # Calculate Total Executed Qty
    total_executed = db.query(func.coalesce(func.sum(MeasurementBook.measured_qty), 0.00)).filter(
        MeasurementBook.boq_item_id == boq.id,
        MeasurementBook.status == "APPROVED"
    ).scalar()
    total_executed = float(total_executed or 0.0)

    bill_amount = float(bill_in.billed_qty) * float(bill_in.billed_rate)
    bill_code = f"CB-BOQ-{int(datetime.utcnow().timestamp())}"

    contractor_bill = ContractorBill(
        bill_number=bill_code,
        project_id=bill_in.project_id,
        vendor_id=bill_in.vendor_id,
        boq_item_id=bill_in.boq_item_id,
        billed_qty=bill_in.billed_qty,
        billed_rate=bill_in.billed_rate,
        total_billed_amount=bill_amount,
        mb_qty=total_executed,
        boq_qty=float(boq.approved_qty),
        discrepancy_flag=(bill_in.billed_qty > total_executed),
        discrepancy_reason="Billed quantity exceeds verified MB executed quantity" if (bill_in.billed_qty > total_executed) else None,
        status="pending_approval"
    )
    db.add(contractor_bill)
    db.commit()
    db.refresh(contractor_bill)

    # Trigger 4-Stage FINANCIAL Approval Task (SE -> PM -> Finance -> Management -> Completed)
    approval_task = ApprovalTask(
        title=f"Contractor Bill #{contractor_bill.bill_number} - Amount: ₹{bill_amount:,.2f}",
        entity_type="ContractorBill",
        entity_id=contractor_bill.id,
        requester_id=user_id,
        current_stage="Site Engineer",
        status="pending",
        request_type="Contractor Payment",
        request_category="FINANCIAL",
        source_module="Contractor Billing"
    )
    db.add(approval_task)
    db.commit()

    record_audit_log(
        db=db,
        user_id=user_id,
        action="CREATE_CONTRACTOR_BILL",
        entity_type="ContractorBill",
        entity_id=contractor_bill.id,
        payload=f"Created Contractor Bill #{contractor_bill.bill_number} for ₹{bill_amount:,.2f} against BOQ Item '{boq.item_name}' (Submitted for 4-Stage Financial Approval)"
    )

    return {
        "message": "Contractor Bill created and submitted for 4-Stage Financial Approval",
        "bill_id": contractor_bill.id,
        "bill_number": contractor_bill.bill_number,
        "total_amount": bill_amount
    }
