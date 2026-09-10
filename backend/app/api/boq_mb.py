from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import (
    BoqItem, MeasurementBook, SiteDailyLog, WbsTask, Vendor, Project, User,
    ContractorBill, ApprovalTask, PurchaseRequisition, MaterialPurchaseRequest, AuditLog,
    ProjectTeamMember, TenantSetting, WorkPlanBoqMapping, TestCheckAssignment, Notification
)
from app.schemas import (
    BoqItemCreate, BoqItemUpdate, BoqItemResponse,
    MeasurementBookCreate, MeasurementBookResponse,
    EmbEntryCreate, EmbEntryUpdate, EmbSignatureRequest, EmbCorrectionCreate,
    EmbSyncRequest, EmbEntryResponse, EmbStaleEntryResponse,
    TestCheckReviewRequest, TestCheckAssignmentResponse, TestCheckSummaryResponse,
    SamplingConfigResponse, SamplingConfigUpdate
)
from app.api.auth import get_current_user
from app.api.audit import record_audit_log
from datetime import datetime, date, timedelta
import hashlib

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
            MeasurementBook.status.in_(["APPROVED", "FULLY SIGNED / SUBMITTED"]),
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

            # WPT-03: Recalculate affected milestones for this WBS node and its parent
            try:
                from app.api.milestones import recalculate_milestones_for_wbs_node
                recalculate_milestones_for_wbs_node(db, task.id)
                if task.parent_task_id:
                    recalculate_milestones_for_wbs_node(db, task.parent_task_id)
            except Exception as e:
                print(f"[Milestone Recalculation Note] {e}")


    record_audit_log(
        db=db,
        user_id=engineer_id,
        action="RECORD_MEASUREMENT",
        entity_type="MeasurementBook",
        entity_id=mb.id,
        payload=f"Recorded MB measurement of {mb.measured_qty} {boq.unit} for BOQ Line Item '{boq.item_name}' (Total Executed: {new_total}/{approved_ceiling})"
    )

    return mb


# ==============================================================================
# EXA-02: DIGITAL e-MEASUREMENT BOOK (e-MB) SYSTEM
# ==============================================================================

def format_emb_response(mb: MeasurementBook, db: Session) -> dict:
    wbs = db.query(WbsTask).filter(WbsTask.id == mb.wbs_node_id).first() if mb.wbs_node_id else (mb.task or mb.phase)
    boq = db.query(BoqItem).filter(BoqItem.id == mb.boq_item_id).first() if mb.boq_item_id else None
    proj = db.query(Project).filter(Project.id == mb.project_id).first()

    c_rep = db.query(User).filter(User.id == mb.contractor_rep_signer_id).first() if mb.contractor_rep_signer_id else None
    je = db.query(User).filter(User.id == mb.je_signer_id).first() if mb.je_signer_id else None

    has_c = mb.contractor_rep_signed_at is not None
    has_je = mb.je_signed_at is not None

    is_billable = mb.status in ["FULLY SIGNED / SUBMITTED", "APPROVED"]

    created_dt = mb.created_at or datetime.utcnow()
    age_hours = round((datetime.utcnow() - created_dt).total_seconds() / 3600.0, 1)
    is_stale = (mb.status == "PENDING CO-SIGN" and age_hours >= 48.0)

    is_superseded = db.query(MeasurementBook).filter(MeasurementBook.correction_of_id == mb.id).first() is not None

    # EXA-03 Test Check Status Calculation
    ae_check = db.query(TestCheckAssignment).filter(
        TestCheckAssignment.measurement_book_id == mb.id,
        TestCheckAssignment.authority == "AE"
    ).first()
    ee_check = db.query(TestCheckAssignment).filter(
        TestCheckAssignment.measurement_book_id == mb.id,
        TestCheckAssignment.authority == "EE"
    ).first()

    ae_status = ae_check.status if ae_check else "Not Selected"
    ee_status = ee_check.status if ee_check else "Not Selected"

    if ae_status == "Flagged" or ee_status == "Flagged":
        overall_status = "Flagged"
    elif ae_status == "Pending" or ee_status == "Pending":
        overall_status = "Pending"
    elif ae_status == "Passed" or ee_status == "Passed":
        overall_status = "Passed"
    else:
        overall_status = "No Test-Check Required"

    return {
        "id": mb.id,
        "client_uuid": mb.client_uuid,
        "project_id": mb.project_id,
        "project_name": proj.name if proj else None,
        "wbs_node_id": mb.wbs_node_id or mb.task_id or mb.phase_id,
        "wbs_node_name": wbs.title if wbs else None,
        "wbs_code": wbs.wbs_code if wbs else None,
        "boq_item_id": mb.boq_item_id,
        "boq_item_name": boq.item_name if boq else None,
        "description": mb.description or mb.remarks or "Measurement Record",
        "measurement_method": mb.measurement_method or "LBH",
        "length": float(mb.length) if mb.length is not None else None,
        "breadth": float(mb.breadth) if mb.breadth is not None else None,
        "height": float(mb.height) if mb.height is not None else None,
        "direct_quantity": float(mb.direct_quantity) if mb.direct_quantity is not None else None,
        "computed_quantity": float(mb.computed_quantity if mb.computed_quantity is not None else mb.measured_qty),
        "measured_qty": float(mb.measured_qty),
        "unit": mb.unit or (boq.unit if boq else "m³"),
        "location_zone": mb.location_zone,
        "remarks": mb.remarks,
        "status": mb.status,
        "photo_url": mb.photo_url,
        "photo_metadata": mb.photo_metadata,
        "contractor_rep_signer_id": mb.contractor_rep_signer_id,
        "contractor_rep_name": c_rep.full_name if c_rep else None,
        "contractor_rep_signed_at": mb.contractor_rep_signed_at,
        "contractor_rep_signature_reference": mb.contractor_rep_signature_reference,
        "has_contractor_rep_signed": has_c,
        "je_signer_id": mb.je_signer_id,
        "je_name": je.full_name if je else None,
        "je_signed_at": mb.je_signed_at,
        "je_signature_reference": mb.je_signature_reference,
        "has_je_signed": has_je,
        "is_billable": is_billable,
        "is_stale": is_stale,
        "age_hours": age_hours,
        "correction_of_id": mb.correction_of_id,
        "correction_reason": mb.correction_reason,
        "is_superseded": is_superseded,
        "is_offline_sync": mb.is_offline_sync or False,
        "synced_at": mb.synced_at,
        "created_by_id": mb.created_by_id or mb.engineer_id,
        "created_at": mb.created_at,
        "updated_at": mb.updated_at,
        "ae_test_check_status": ae_status,
        "ee_test_check_status": ee_status,
        "overall_test_check_status": overall_status
    }


def verify_emb_signer(project_id: int, user: User, target_role: str, db: Session) -> bool:
    """Validates server-side that user has project team role authority to sign."""
    today = date.today()
    assignment = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_id == project_id,
        ProjectTeamMember.user_id == user.id,
        ProjectTeamMember.status == "ACTIVE",
        ProjectTeamMember.is_active == True,
        ProjectTeamMember.effective_from <= today,
        (ProjectTeamMember.effective_to.is_(None) | (ProjectTeamMember.effective_to >= today))
    ).first()

    u_role = (user.role or "").lower()

    if target_role == "Contractor PM":
        if assignment and assignment.project_role in ["Contractor PM", "Contractor Representative"]:
            return True
        if u_role in ["contractor_pm", "contractor", "contractor pm"]:
            return True
        return False
    elif target_role == "JE":
        if assignment and assignment.project_role in ["JE", "Junior Engineer"]:
            return True
        if u_role in ["je", "junior engineer", "site_engineer"]:
            return True
        return False
    return False


def verify_test_check_reviewer(project_id: int, user: User, authority: str, db: Session) -> bool:
    """Validates server-side that user has authorization as AE or EE for a project."""
    today = date.today()
    assignment = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_id == project_id,
        ProjectTeamMember.user_id == user.id,
        ProjectTeamMember.status == "ACTIVE",
        ProjectTeamMember.is_active == True,
        ProjectTeamMember.effective_from <= today,
        (ProjectTeamMember.effective_to.is_(None) | (ProjectTeamMember.effective_to >= today))
    ).first()

    u_role = (user.role or "").lower()

    if authority == "AE":
        if assignment and assignment.project_role in ["AE", "Assistant Engineer"]:
            return True
        if u_role in ["ae", "assistant_engineer", "assistant engineer"]:
            return True
        return False
    elif authority == "EE":
        if assignment and assignment.project_role in ["EE", "Executive Engineer"]:
            return True
        if u_role in ["ee", "executive_engineer", "executive engineer"]:
            return True
        return False
    return False


def run_test_check_sampling(mb: MeasurementBook, db: Session, force_ae: bool = False, force_ee: bool = False):
    """
    Executes EXA-03 Risk-Weighted AE/EE Test-Check Sampling upon dual e-MB sign-off.
    - AE mandatory minimum = 50%
    - EE mandatory minimum = 10%
    - Increases sampling probability for high-value entries (>= ₹50,000) and first-time BOQ items.
    - Creates independent TestCheckAssignment records for AE and EE.
    """
    proj = db.query(Project).filter(Project.id == mb.project_id).first()
    tenant_name = proj.tenant_name if proj else "Default Tenant"
    t_set = db.query(TenantSetting).filter(TenantSetting.tenant_name == tenant_name).first()

    target_ae_pct = float(t_set.ae_sampling_rate if t_set and t_set.ae_sampling_rate is not None else 50.0)
    target_ee_pct = float(t_set.ee_sampling_rate if t_set and t_set.ee_sampling_rate is not None else 10.0)

    # CPWD mandatory minimum enforcement
    target_ae_pct = max(50.0, target_ae_pct)
    target_ee_pct = max(10.0, target_ee_pct)

    # 1. Determine Entry Value
    boq = db.query(BoqItem).filter(BoqItem.id == mb.boq_item_id).first() if mb.boq_item_id else None
    rate = float(boq.rate) if boq else 0.0
    computed_qty = float(mb.computed_quantity if mb.computed_quantity is not None else mb.measured_qty)
    entry_value = computed_qty * rate

    # 2. Determine First-Time Occurrence
    prior_count = 0
    if mb.boq_item_id:
        prior_count = db.query(MeasurementBook).filter(
            MeasurementBook.project_id == mb.project_id,
            MeasurementBook.boq_item_id == mb.boq_item_id,
            MeasurementBook.id != mb.id,
            MeasurementBook.status.in_(["APPROVED", "FULLY SIGNED / SUBMITTED"])
        ).count()
    is_first_item = (prior_count == 0)

    # 3. Calculate Risk Factors & Score
    risk_factors = []
    risk_score = 1.0

    if is_first_item:
        risk_factors.append("FIRST_TIME_ITEM")
        risk_score += 1.5

    if entry_value >= 250000.0:
        risk_factors.append("HIGH_VALUE_TIER3")
        risk_score += 3.0
    elif entry_value >= 100000.0:
        risk_factors.append("HIGH_VALUE_TIER2")
        risk_score += 2.0
    elif entry_value >= 50000.0:
        risk_factors.append("HIGH_VALUE_TIER1")
        risk_score += 1.5

    risk_factors_str = ",".join(risk_factors) if risk_factors else "STANDARD_SAMPLING"

    # 4. Deterministic Hash Metric
    hash_str = f"EXA03-SAMPLING-P{mb.project_id}-MB{mb.id}-{mb.client_uuid or mb.created_at}"
    hash_val = int(hashlib.sha256(hash_str.encode('utf-8')).hexdigest()[:8], 16) / float(0xFFFFFFFF)

    # Risk-adjusted probabilities
    prob_ae = min(1.0, (target_ae_pct / 100.0) * (1.0 + (risk_score - 1.0) * 0.25))
    prob_ee = min(1.0, (target_ee_pct / 100.0) * (1.0 + (risk_score - 1.0) * 0.25))

    select_ae = force_ae or (hash_val <= prob_ae)
    select_ee = force_ee or (hash_val <= prob_ee)

    # 5. Create TestCheckAssignment records independently
    if select_ae:
        existing_ae = db.query(TestCheckAssignment).filter(
            TestCheckAssignment.measurement_book_id == mb.id,
            TestCheckAssignment.authority == "AE"
        ).first()
        if not existing_ae:
            reason = f"AE mandatory sample ({target_ae_pct}% rule) - Risk Score: {risk_score:.2f} ({risk_factors_str})"
            ae_assign = TestCheckAssignment(
                measurement_book_id=mb.id,
                project_id=mb.project_id,
                authority="AE",
                sampling_percentage=target_ae_pct,
                risk_score=risk_score,
                risk_factors=risk_factors_str,
                sampling_reason=reason,
                status="Pending"
            )
            db.add(ae_assign)

            # Notify AE team members
            ae_members = db.query(ProjectTeamMember).filter(
                ProjectTeamMember.project_id == mb.project_id,
                ProjectTeamMember.project_role.in_(["AE", "Assistant Engineer"]),
                ProjectTeamMember.status == "ACTIVE"
            ).all()
            for ae in ae_members:
                notif = Notification(
                    user_id=ae.user_id,
                    title=f"AE Test-Check Assigned: MB-{mb.id:04d}",
                    message=f"e-MB entry MB-{mb.id:04d} ({mb.description}) selected for AE Test-Check.",
                    notification_type="warning",
                    entity_type="TestCheckAssignment",
                    entity_id=mb.id
                )
                db.add(notif)

            record_audit_log(
                db=db,
                user_id=1,
                action="TEST_CHECK_SAMPLED_AE",
                entity_type="MeasurementBook",
                entity_id=mb.id,
                payload=f"e-MB MB-{mb.id:04d} selected for AE Test-Check ({target_ae_pct}% rate, Risk: {risk_score:.2f}, Factors: {risk_factors_str})"
            )

    if select_ee:
        existing_ee = db.query(TestCheckAssignment).filter(
            TestCheckAssignment.measurement_book_id == mb.id,
            TestCheckAssignment.authority == "EE"
        ).first()
        if not existing_ee:
            reason = f"EE mandatory sample ({target_ee_pct}% rule) - Risk Score: {risk_score:.2f} ({risk_factors_str})"
            ee_assign = TestCheckAssignment(
                measurement_book_id=mb.id,
                project_id=mb.project_id,
                authority="EE",
                sampling_percentage=target_ee_pct,
                risk_score=risk_score,
                risk_factors=risk_factors_str,
                sampling_reason=reason,
                status="Pending"
            )
            db.add(ee_assign)

            # Notify EE team members
            ee_members = db.query(ProjectTeamMember).filter(
                ProjectTeamMember.project_id == mb.project_id,
                ProjectTeamMember.project_role.in_(["EE", "Executive Engineer"]),
                ProjectTeamMember.status == "ACTIVE"
            ).all()
            for ee in ee_members:
                notif = Notification(
                    user_id=ee.user_id,
                    title=f"EE Test-Check Assigned: MB-{mb.id:04d}",
                    message=f"e-MB entry MB-{mb.id:04d} ({mb.description}) selected for EE Test-Check.",
                    notification_type="warning",
                    entity_type="TestCheckAssignment",
                    entity_id=mb.id
                )
                db.add(notif)

            record_audit_log(
                db=db,
                user_id=1,
                action="TEST_CHECK_SAMPLED_EE",
                entity_type="MeasurementBook",
                entity_id=mb.id,
                payload=f"e-MB MB-{mb.id:04d} selected for EE Test-Check ({target_ee_pct}% rate, Risk: {risk_score:.2f}, Factors: {risk_factors_str})"
            )

    db.commit()


def validate_dimensions(method: str, length, breadth, height, direct_quantity) -> float:
    """Structured dimension calculation engine without eval()."""
    if method == "LBH":
        if length is None or str(length).strip() == "":
            raise HTTPException(status_code=400, detail="Enter valid numeric dimensions.")
        try:
            l = float(length)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Enter valid numeric dimensions.")
        if l <= 0:
            raise HTTPException(status_code=400, detail="Enter valid numeric dimensions.")

        if breadth is None or str(breadth).strip() == "":
            raise HTTPException(status_code=400, detail="Enter valid numeric dimensions.")
        try:
            b = float(breadth)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Enter valid numeric dimensions.")
        if b <= 0:
            raise HTTPException(status_code=400, detail="Enter valid numeric dimensions.")

        if height is None or str(height).strip() == "":
            raise HTTPException(status_code=400, detail="Enter valid numeric dimensions.")
        try:
            h = float(height)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Enter valid numeric dimensions.")
        if h <= 0:
            raise HTTPException(status_code=400, detail="Enter valid numeric dimensions.")

        return round(l * b * h, 4)
    elif method == "DIRECT":
        if direct_quantity is None or str(direct_quantity).strip() == "":
            raise HTTPException(status_code=400, detail="Enter valid numeric dimensions.")
        try:
            dq = float(direct_quantity)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Enter valid numeric dimensions.")
        if dq <= 0:
            raise HTTPException(status_code=400, detail="Enter valid numeric dimensions.")
        return round(dq, 4)
    else:
        raise HTTPException(status_code=400, detail="Invalid measurement method. Choose 'LBH' or 'DIRECT'.")


@router.get("/emb/project/{project_id}", response_model=List[EmbEntryResponse])
def get_project_emb_entries(project_id: int, db: Session = Depends(get_db)):
    """Returns all e-MB measurement entries for a specific project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    entries = db.query(MeasurementBook).filter(
        MeasurementBook.project_id == project_id
    ).order_by(MeasurementBook.id.desc()).all()

    return [format_emb_response(e, db) for e in entries]


@router.get("/emb/stale", response_model=List[EmbStaleEntryResponse])
def get_stale_emb_entries(project_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Identifies e-MB entries stuck in PENDING CO-SIGN state for >= 48 hours."""
    cutoff_time = datetime.utcnow() - timedelta(hours=48)
    query = db.query(MeasurementBook).filter(
        MeasurementBook.status == "PENDING CO-SIGN",
        MeasurementBook.created_at <= cutoff_time
    )
    if project_id:
        query = query.filter(MeasurementBook.project_id == project_id)

    stale_records = query.order_by(MeasurementBook.created_at.asc()).all()
    results = []

    for r in stale_records:
        proj = db.query(Project).filter(Project.id == r.project_id).first()
        wbs = db.query(WbsTask).filter(WbsTask.id == r.wbs_node_id).first() if r.wbs_node_id else (r.task or r.phase)

        existing_sig = "Contractor Representative" if r.contractor_rep_signed_at else ("JE" if r.je_signed_at else "None")
        missing_sig = "JE" if not r.je_signed_at else "Contractor Representative"

        created_dt = r.created_at or datetime.utcnow()
        diff = datetime.utcnow() - created_dt
        age_hours = round(diff.total_seconds() / 3600.0, 1)
        age_days = round(age_hours / 24.0, 1)

        results.append(EmbStaleEntryResponse(
            entry_id=r.id,
            project_id=r.project_id,
            project_name=proj.name if proj else None,
            wbs_node_id=r.wbs_node_id or (wbs.id if wbs else None),
            wbs_node_name=wbs.title if wbs else None,
            wbs_code=wbs.wbs_code if wbs else None,
            description=r.description or r.remarks or "Measurement Record",
            quantity=float(r.computed_quantity if r.computed_quantity is not None else r.measured_qty),
            unit=r.unit or "m³",
            existing_signature=existing_sig,
            missing_signature=missing_sig,
            created_at=r.created_at,
            age_hours=age_hours,
            age_days=age_days
        ))

    return results


@router.get("/emb/{entry_id}", response_model=EmbEntryResponse)
def get_emb_entry(entry_id: int, db: Session = Depends(get_db)):
    """Fetch single e-MB entry details."""
    entry = db.query(MeasurementBook).filter(MeasurementBook.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="e-MB Entry not found")
    return format_emb_response(entry, db)


@router.post("/emb", response_model=EmbEntryResponse, status_code=201)
def create_emb_entry(
    entry_in: EmbEntryCreate,
    x_app_version: Optional[str] = Header(None, alias="X-App-Version"),
    x_app_schema_version: Optional[str] = Header(None, alias="X-App-Schema-Version"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Creates a structured digital e-MB measurement entry."""
    # 0. Client Version / Schema Compatibility Check
    if x_app_schema_version is not None:
        try:
            if int(x_app_schema_version) < 2:
                raise HTTPException(status_code=426, detail="Please update the app")
        except (ValueError, TypeError):
            raise HTTPException(status_code=426, detail="Please update the app")
    if x_app_version is not None:
        try:
            if int(x_app_version.strip().split(".")[0]) < 2:
                raise HTTPException(status_code=426, detail="Please update the app")
        except Exception:
            raise HTTPException(status_code=426, detail="Please update the app")

    # 1. Client UUID Idempotency Check
    if entry_in.client_uuid:
        existing = db.query(MeasurementBook).filter(MeasurementBook.client_uuid == entry_in.client_uuid).first()
        if existing:
            return format_emb_response(existing, db)

    # 2. Project & Closure Validation
    project = db.query(Project).filter(Project.id == entry_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if (project.status or "").upper() == "CLOSED":
        raise HTTPException(status_code=400, detail="Project is closed. New measurements cannot be recorded.")

    # 3. WBS Node & Cross-Project Validation
    wbs_node = db.query(WbsTask).filter(WbsTask.id == entry_in.wbs_node_id).first()
    if not wbs_node:
        raise HTTPException(status_code=404, detail="WBS Node not found")
    if wbs_node.project_id != project.id:
        raise HTTPException(status_code=400, detail="Cross-project WBS references are not allowed.")

    # 4. Description Validation
    if not entry_in.description or not entry_in.description.strip():
        raise HTTPException(status_code=400, detail="Measurement Description is required.")

    # 5. Formula & Dimension Validation
    computed_qty = validate_dimensions(
        method=entry_in.measurement_method,
        length=entry_in.length,
        breadth=entry_in.breadth,
        height=entry_in.height,
        direct_quantity=entry_in.direct_quantity
    )

    # 6. Tenant P2 GPS-Tagging Policy Check
    tenant_setting = db.query(TenantSetting).filter(TenantSetting.tenant_name == project.tenant_name).first()
    if tenant_setting and tenant_setting.is_p2_enabled:
        if not entry_in.photo_url:
            raise HTTPException(status_code=400, detail="Photo evidence is required when P2 GPS-tagging is enabled.")

    # 7. BOQ Item Linkage
    resolved_boq_id = entry_in.boq_item_id
    if resolved_boq_id:
        boq = db.query(BoqItem).filter(BoqItem.id == resolved_boq_id).first()
        if not boq or boq.project_id != project.id:
            raise HTTPException(status_code=400, detail="Referenced BOQ item does not belong to this project.")
    else:
        # Trace mapped BOQ item from WorkPlanBoqMapping if present
        mapping = db.query(WorkPlanBoqMapping).filter(
            WorkPlanBoqMapping.project_id == project.id,
            WorkPlanBoqMapping.is_orphaned == False
        ).first()
        if mapping:
            resolved_boq_id = mapping.boq_item_id

    # 8. Create Entry
    loc_zone = entry_in.location_zone or wbs_node.title or f"WBS Task #{wbs_node.id}"
    resolved_unit = entry_in.unit or wbs_node.unit or "m³"

    mb = MeasurementBook(
        client_uuid=entry_in.client_uuid,
        project_id=project.id,
        wbs_node_id=wbs_node.id,
        boq_item_id=resolved_boq_id,
        phase_id=wbs_node.id if wbs_node.task_level == "Phase" else wbs_node.parent_task_id,
        task_id=wbs_node.id,
        engineer_id=current_user.id,
        created_by_id=current_user.id,
        log_date=datetime.utcnow(),
        location_zone=loc_zone,
        description=entry_in.description.strip(),
        measurement_method=entry_in.measurement_method,
        length=entry_in.length,
        breadth=entry_in.breadth,
        height=entry_in.height,
        direct_quantity=entry_in.direct_quantity,
        computed_quantity=computed_qty,
        measured_qty=computed_qty,
        unit=resolved_unit,
        remarks=entry_in.remarks,
        photo_url=entry_in.photo_url,
        photo_metadata=entry_in.photo_metadata,
        status="DRAFT"
    )
    db.add(mb)
    db.commit()
    db.refresh(mb)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action="CREATE_EMB_ENTRY",
        entity_type="MeasurementBook",
        entity_id=mb.id,
        payload=f"Created e-MB draft #{mb.id} for Project #{project.id}, WBS #{wbs_node.id}: {mb.description} (Qty: {computed_qty} {resolved_unit})"
    )

    return format_emb_response(mb, db)


@router.post("/emb/{entry_id}/sign/contractor-rep", response_model=EmbEntryResponse)
def sign_emb_contractor_rep(
    entry_id: int,
    sig_req: EmbSignatureRequest = EmbSignatureRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Signs an e-MB entry as Contractor Representative."""
    mb = db.query(MeasurementBook).filter(MeasurementBook.id == entry_id).first()
    if not mb:
        raise HTTPException(status_code=404, detail="e-MB Entry not found")

    # Guard against user ID tampering
    if sig_req.signer_id is not None and sig_req.signer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot submit signature on behalf of another user ID.")

    # Validate signing authority
    if not verify_emb_signer(mb.project_id, current_user, "Contractor PM", db):
        raise HTTPException(status_code=403, detail="User is not authorized as Contractor Representative for this project.")

    # Record signature
    mb.contractor_rep_signer_id = current_user.id
    mb.contractor_rep_signed_at = datetime.utcnow()
    mb.contractor_rep_signature_reference = sig_req.signature_text or sig_req.signature_token or f"DIGISIG-CREP-{current_user.id}-{int(datetime.utcnow().timestamp())}"

    # Update state machine
    if mb.je_signed_at:
        mb.status = "FULLY SIGNED / SUBMITTED"
        audit_act = "MEASUREMENT_FULLY_SIGNED"

        # Trigger EXA-03 Risk-Weighted Test-Check Sampling
        try:
            run_test_check_sampling(mb, db)
        except Exception as e:
            print(f"[EXA-03 Sampling Error] {e}")

        # Update WBS Task actual quantity & milestone recalculation
        if mb.wbs_node_id:
            task = db.query(WbsTask).filter(WbsTask.id == mb.wbs_node_id).first()
            if task:
                task.actual_qty = float(task.actual_qty or 0.0) + float(mb.measured_qty)
                planned = float(task.planned_qty or 0.0)
                if planned > 0:
                    task.progress_pct = min(100.0, (float(task.actual_qty) / planned) * 100.0)
                if task.progress_pct >= 100.0:
                    task.status = "completed"
                elif task.progress_pct > 0:
                    task.status = "in_progress"
                db.commit()

                try:
                    from app.api.milestones import recalculate_milestones_for_wbs_node
                    recalculate_milestones_for_wbs_node(db, task.id)
                    if task.parent_task_id:
                        recalculate_milestones_for_wbs_node(db, task.parent_task_id)
                except Exception as e:
                    print(f"[Milestone Recalculation Note] {e}")
    else:
        mb.status = "PENDING CO-SIGN"
        audit_act = "MEASUREMENT_SIGNED_CONTRACTOR_REP"

    db.commit()
    db.refresh(mb)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action=audit_act,
        entity_type="MeasurementBook",
        entity_id=mb.id,
        payload=f"e-MB #{mb.id} signed by Contractor Representative ({current_user.full_name}). New Status: {mb.status}"
    )

    return format_emb_response(mb, db)


@router.post("/emb/{entry_id}/sign/je", response_model=EmbEntryResponse)
def sign_emb_je(
    entry_id: int,
    sig_req: EmbSignatureRequest = EmbSignatureRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Signs an e-MB entry as Junior Engineer (JE)."""
    mb = db.query(MeasurementBook).filter(MeasurementBook.id == entry_id).first()
    if not mb:
        raise HTTPException(status_code=404, detail="e-MB Entry not found")

    # Guard against user ID tampering
    if sig_req.signer_id is not None and sig_req.signer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot submit signature on behalf of another user ID.")

    # Validate signing authority
    if not verify_emb_signer(mb.project_id, current_user, "JE", db):
        raise HTTPException(status_code=403, detail="User is not authorized as Junior Engineer (JE) for this project.")

    # Record signature
    mb.je_signer_id = current_user.id
    mb.engineer_id = current_user.id
    mb.je_signed_at = datetime.utcnow()
    mb.je_signature_reference = sig_req.signature_text or sig_req.signature_token or f"DIGISIG-JE-{current_user.id}-{int(datetime.utcnow().timestamp())}"

    # Update state machine
    if mb.contractor_rep_signed_at:
        mb.status = "FULLY SIGNED / SUBMITTED"
        audit_act = "MEASUREMENT_FULLY_SIGNED"

        # Trigger EXA-03 Risk-Weighted Test-Check Sampling
        try:
            run_test_check_sampling(mb, db)
        except Exception as e:
            print(f"[EXA-03 Sampling Error] {e}")

        # Update WBS Task actual quantity & milestone recalculation
        if mb.wbs_node_id:
            task = db.query(WbsTask).filter(WbsTask.id == mb.wbs_node_id).first()
            if task:
                task.actual_qty = float(task.actual_qty or 0.0) + float(mb.measured_qty)
                planned = float(task.planned_qty or 0.0)
                if planned > 0:
                    task.progress_pct = min(100.0, (float(task.actual_qty) / planned) * 100.0)
                if task.progress_pct >= 100.0:
                    task.status = "completed"
                elif task.progress_pct > 0:
                    task.status = "in_progress"
                db.commit()

                try:
                    from app.api.milestones import recalculate_milestones_for_wbs_node
                    recalculate_milestones_for_wbs_node(db, task.id)
                    if task.parent_task_id:
                        recalculate_milestones_for_wbs_node(db, task.parent_task_id)
                except Exception as e:
                    print(f"[Milestone Recalculation Note] {e}")
    else:
        mb.status = "PENDING CO-SIGN"
        audit_act = "MEASUREMENT_SIGNED_JE"

    db.commit()
    db.refresh(mb)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action=audit_act,
        entity_type="MeasurementBook",
        entity_id=mb.id,
        payload=f"e-MB #{mb.id} signed by JE ({current_user.full_name}). New Status: {mb.status}"
    )

    return format_emb_response(mb, db)


@router.put("/emb/{entry_id}", response_model=EmbEntryResponse)
def update_emb_entry(
    entry_id: int,
    entry_in: EmbEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update draft e-MB entry. Append-only enforcement for signed entries."""
    mb = db.query(MeasurementBook).filter(MeasurementBook.id == entry_id).first()
    if not mb:
        raise HTTPException(status_code=404, detail="e-MB Entry not found")

    # Append-Only Rule: Once fully signed or approved, block in-place mutation
    if mb.status in ["FULLY SIGNED / SUBMITTED", "APPROVED"] or (mb.contractor_rep_signed_at and mb.je_signed_at):
        raise HTTPException(
            status_code=400,
            detail="Signed measurements are append-only. Mutation blocked. Use 'Create Correction' instead."
        )

    if entry_in.description is not None:
        if not entry_in.description.strip():
            raise HTTPException(status_code=400, detail="Measurement Description is required.")
        mb.description = entry_in.description.strip()

    method = entry_in.measurement_method or mb.measurement_method or "LBH"
    l = entry_in.length if entry_in.length is not None else mb.length
    b = entry_in.breadth if entry_in.breadth is not None else mb.breadth
    h = entry_in.height if entry_in.height is not None else mb.height
    dq = entry_in.direct_quantity if entry_in.direct_quantity is not None else mb.direct_quantity

    computed_qty = validate_dimensions(method, l, b, h, dq)

    mb.measurement_method = method
    mb.length = l
    mb.breadth = b
    mb.height = h
    mb.direct_quantity = dq
    mb.computed_quantity = computed_qty
    mb.measured_qty = computed_qty
    if entry_in.unit:
        mb.unit = entry_in.unit
    if entry_in.remarks is not None:
        mb.remarks = entry_in.remarks
    if entry_in.photo_url is not None:
        mb.photo_url = entry_in.photo_url
    if entry_in.photo_metadata is not None:
        mb.photo_metadata = entry_in.photo_metadata

    db.commit()
    db.refresh(mb)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action="UPDATE_EMB_DRAFT",
        entity_type="MeasurementBook",
        entity_id=mb.id,
        payload=f"Updated draft e-MB #{mb.id} (New Qty: {computed_qty})"
    )

    return format_emb_response(mb, db)


@router.post("/emb/{entry_id}/correct", response_model=EmbEntryResponse, status_code=201)
def create_emb_correction(
    entry_id: int,
    corr_in: EmbCorrectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Creates a linked correction for an append-only signed e-MB entry."""
    orig = db.query(MeasurementBook).filter(MeasurementBook.id == entry_id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Original e-MB entry not found")

    # Correction Reason is required
    if not corr_in.correction_reason or not corr_in.correction_reason.strip():
        raise HTTPException(status_code=400, detail="Correction Reason is required.")

    # SUBMITTED CONTRACTOR BILL GUARD (Requirement 12)
    # If the original entry is already included in an active/submitted contractor bill: BLOCK
    if orig.boq_item_id:
        submitted_bill = db.query(ContractorBill).filter(
            ContractorBill.project_id == orig.project_id,
            ContractorBill.boq_item_id == orig.boq_item_id,
            ContractorBill.status.in_(["pending_approval", "verified_matched", "discrepancy_flagged", "approved", "submitted"])
        ).first()

        if submitted_bill:
            record_audit_log(
                db=db,
                user_id=current_user.id,
                action="CORRECTION_BLOCKED_BILL_SUBMITTED",
                entity_type="MeasurementBook",
                entity_id=orig.id,
                payload=f"Correction blocked for MB #{orig.id}: Included in submitted bill #{submitted_bill.bill_number}"
            )
            raise HTTPException(
                status_code=400,
                detail="Correction blocked because this measurement is included in a submitted bill. Send the bill back first or scope the correction to future billing."
            )

    # Validate new dimensions
    computed_qty = validate_dimensions(
        method=corr_in.measurement_method,
        length=corr_in.length,
        breadth=corr_in.breadth,
        height=corr_in.height,
        direct_quantity=corr_in.direct_quantity
    )

    # Check client UUID
    if corr_in.client_uuid:
        existing = db.query(MeasurementBook).filter(MeasurementBook.client_uuid == corr_in.client_uuid).first()
        if existing:
            return format_emb_response(existing, db)

    # Create new correction record referencing orig.id
    corr_mb = MeasurementBook(
        client_uuid=corr_in.client_uuid,
        project_id=orig.project_id,
        wbs_node_id=orig.wbs_node_id,
        boq_item_id=orig.boq_item_id,
        phase_id=orig.phase_id,
        task_id=orig.task_id,
        subtask_id=orig.subtask_id,
        engineer_id=current_user.id,
        created_by_id=current_user.id,
        log_date=datetime.utcnow(),
        location_zone=corr_in.location_zone or orig.location_zone,
        description=corr_in.description.strip(),
        measurement_method=corr_in.measurement_method,
        length=corr_in.length,
        breadth=corr_in.breadth,
        height=corr_in.height,
        direct_quantity=corr_in.direct_quantity,
        computed_quantity=computed_qty,
        measured_qty=computed_qty,
        unit=corr_in.unit or orig.unit,
        remarks=corr_in.remarks or f"Correction of MB-{orig.id}",
        photo_url=corr_in.photo_url or orig.photo_url,
        photo_metadata=corr_in.photo_metadata or orig.photo_metadata,
        correction_of_id=orig.id,
        correction_reason=corr_in.correction_reason.strip(),
        status="DRAFT"  # Requires new dual signatures!
    )
    db.add(corr_mb)
    db.commit()
    db.refresh(corr_mb)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action="CREATE_CORRECTION_ENTRY",
        entity_type="MeasurementBook",
        entity_id=corr_mb.id,
        payload=f"Created correction e-MB #{corr_mb.id} for MB #{orig.id}. Reason: {corr_mb.correction_reason}"
    )

    return format_emb_response(corr_mb, db)


@router.post("/emb/sync")
def sync_offline_emb_entries(
    sync_req: EmbSyncRequest,
    x_app_version: Optional[str] = Header(None, alias="X-App-Version"),
    x_app_schema_version: Optional[str] = Header(None, alias="X-App-Schema-Version"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Synchronizes queued offline e-MB entries with client UUID idempotency."""
    # Client Version / Schema Compatibility Check
    if x_app_schema_version is not None:
        try:
            if int(x_app_schema_version) < 2:
                raise HTTPException(status_code=426, detail="Please update the app")
        except (ValueError, TypeError):
            raise HTTPException(status_code=426, detail="Please update the app")
    if x_app_version is not None:
        try:
            if int(x_app_version.strip().split(".")[0]) < 2:
                raise HTTPException(status_code=426, detail="Please update the app")
        except Exception:
            raise HTTPException(status_code=426, detail="Please update the app")

    synced_items = []
    conflicts = []

    for item in sync_req.items:
        # Idempotency check: does this client_uuid already exist?
        existing = db.query(MeasurementBook).filter(MeasurementBook.client_uuid == item.client_uuid).first()
        if existing:
            synced_items.append(format_emb_response(existing, db))
            continue

        # Project check & closure conflict
        project = db.query(Project).filter(Project.id == item.project_id).first()
        if not project:
            conflicts.append({
                "client_uuid": item.client_uuid,
                "reason": "Referenced project does not exist"
            })
            continue

        if (project.status or "").upper() == "CLOSED":
            conflicts.append({
                "client_uuid": item.client_uuid,
                "reason": "Project was closed before sync"
            })
            continue

        # WBS Node check & deleted conflict
        wbs_node = db.query(WbsTask).filter(WbsTask.id == item.wbs_node_id).first()
        if not wbs_node or wbs_node.project_id != project.id:
            conflicts.append({
                "client_uuid": item.client_uuid,
                "reason": "Referenced WBS node no longer exists"
            })
            continue

        # Validate formula
        try:
            computed_qty = validate_dimensions(
                item.measurement_method, item.length, item.breadth, item.height, item.direct_quantity
            )
        except HTTPException as e:
            conflicts.append({
                "client_uuid": item.client_uuid,
                "reason": f"Dimension calculation error: {e.detail}"
            })
            continue

        # Offline signatures verification
        has_c = False
        c_signed_at = None
        c_sig_ref = None
        c_signer_id = None

        if item.contractor_rep_signer_id:
            c_user = db.query(User).filter(User.id == item.contractor_rep_signer_id).first()
            if c_user and verify_emb_signer(project.id, c_user, "Contractor PM", db):
                has_c = True
                c_signed_at = item.created_at or datetime.utcnow()
                c_sig_ref = item.contractor_rep_signature_reference or f"OFFLINE-SIG-CREP-{c_user.id}"
                c_signer_id = c_user.id
            else:
                conflicts.append({
                    "client_uuid": item.client_uuid,
                    "reason": "Contractor Representative offline signature could not be verified"
                })
                continue

        has_je = False
        je_signed_at = None
        je_sig_ref = None
        je_signer_id = None

        if item.je_signer_id:
            j_user = db.query(User).filter(User.id == item.je_signer_id).first()
            if j_user and verify_emb_signer(project.id, j_user, "JE", db):
                has_je = True
                je_signed_at = item.created_at or datetime.utcnow()
                je_sig_ref = item.je_signature_reference or f"OFFLINE-SIG-JE-{j_user.id}"
                je_signer_id = j_user.id
            else:
                conflicts.append({
                    "client_uuid": item.client_uuid,
                    "reason": "Junior Engineer (JE) offline signature could not be verified"
                })
                continue

        status_val = "DRAFT"
        if has_c and has_je:
            status_val = "FULLY SIGNED / SUBMITTED"
        elif has_c or has_je:
            status_val = "PENDING CO-SIGN"

        # Create record
        mb = MeasurementBook(
            client_uuid=item.client_uuid,
            project_id=project.id,
            wbs_node_id=wbs_node.id,
            boq_item_id=item.boq_item_id,
            phase_id=wbs_node.id if wbs_node.task_level == "Phase" else wbs_node.parent_task_id,
            task_id=wbs_node.id,
            engineer_id=je_signer_id or current_user.id,
            created_by_id=current_user.id,
            log_date=item.created_at or datetime.utcnow(),
            location_zone=item.location_zone or wbs_node.title,
            description=item.description.strip(),
            measurement_method=item.measurement_method,
            length=item.length,
            breadth=item.breadth,
            height=item.height,
            direct_quantity=item.direct_quantity,
            computed_quantity=computed_qty,
            measured_qty=computed_qty,
            unit=item.unit or getattr(wbs_node, "unit", None) or "m³",
            remarks=item.remarks,
            photo_url=item.photo_url,
            photo_metadata=item.photo_metadata,
            contractor_rep_signer_id=c_signer_id,
            contractor_rep_signed_at=c_signed_at,
            contractor_rep_signature_reference=c_sig_ref,
            je_signer_id=je_signer_id,
            je_signed_at=je_signed_at,
            je_signature_reference=je_sig_ref,
            status=status_val,
            is_offline_sync=True,
            synced_at=datetime.utcnow()
        )
        db.add(mb)
        db.commit()
        db.refresh(mb)

        # If fully signed, update WBS & milestones
        if status_val == "FULLY SIGNED / SUBMITTED":
            wbs_node.actual_qty = float(wbs_node.actual_qty or 0.0) + float(mb.measured_qty)
            planned = float(wbs_node.planned_qty or 0.0)
            if planned > 0:
                wbs_node.progress_pct = min(100.0, (float(wbs_node.actual_qty) / planned) * 100.0)
            if wbs_node.progress_pct >= 100.0:
                wbs_node.status = "completed"
            elif wbs_node.progress_pct > 0:
                wbs_node.status = "in_progress"
            db.commit()

            try:
                from app.api.milestones import recalculate_milestones_for_wbs_node
                recalculate_milestones_for_wbs_node(db, wbs_node.id)
            except Exception as e:
                print(f"[Milestone Recalculation Note] {e}")

        record_audit_log(
            db=db,
            user_id=current_user.id,
            action="OFFLINE_EMB_SYNCED",
            entity_type="MeasurementBook",
            entity_id=mb.id,
            payload=f"Synced offline e-MB entry #{mb.id} (UUID: {mb.client_uuid}). Status: {mb.status}"
        )

        synced_items.append(format_emb_response(mb, db))

    return {
        "synced": synced_items,
        "conflicts": conflicts
    }

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

    # EXA-03 SERVER-SIDE BILLING GATE
    mb_entries = db.query(MeasurementBook).filter(
        MeasurementBook.boq_item_id == boq.id,
        MeasurementBook.status.in_(["APPROVED", "FULLY SIGNED / SUBMITTED"])
    ).all()

    for mb_rec in mb_entries:
        test_checks = db.query(TestCheckAssignment).filter(
            TestCheckAssignment.measurement_book_id == mb_rec.id
        ).all()
        for tc in test_checks:
            if tc.status == "Pending":
                raise HTTPException(
                    status_code=400,
                    detail=f"Bill cannot be raised because e-MB MB-{mb_rec.id:04d} has a pending {tc.authority} Test-Check."
                )
            elif tc.status == "Flagged":
                raise HTTPException(
                    status_code=400,
                    detail=f"Bill cannot be raised because e-MB MB-{mb_rec.id:04d} was flagged during {tc.authority} Test-Check."
                )

    # Calculate Total Executed Qty
    total_executed = db.query(func.coalesce(func.sum(MeasurementBook.measured_qty), 0.00)).filter(
        MeasurementBook.boq_item_id == boq.id,
        MeasurementBook.status.in_(["APPROVED", "FULLY SIGNED / SUBMITTED"])
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


# =========================================================================
# EXA-03 — AE/EE TEST-CHECK SAMPLING ENDPOINTS
# =========================================================================

@router.get("/test-checks/project/{project_id}")
def get_project_test_checks(project_id: int, db: Session = Depends(get_db)):
    """Returns all AE and EE test check assignments and summary for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    t_set = db.query(TenantSetting).filter(TenantSetting.tenant_name == project.tenant_name).first()
    ae_rate = float(t_set.ae_sampling_rate if t_set and t_set.ae_sampling_rate is not None else 50.0)
    ee_rate = float(t_set.ee_sampling_rate if t_set and t_set.ee_sampling_rate is not None else 10.0)

    assignments = db.query(TestCheckAssignment).filter(
        TestCheckAssignment.project_id == project_id
    ).order_by(TestCheckAssignment.id.desc()).all()

    ae_pending = sum(1 for a in assignments if a.authority == "AE" and a.status == "Pending")
    ae_passed = sum(1 for a in assignments if a.authority == "AE" and a.status == "Passed")
    ae_flagged = sum(1 for a in assignments if a.authority == "AE" and a.status == "Flagged")

    ee_pending = sum(1 for a in assignments if a.authority == "EE" and a.status == "Pending")
    ee_passed = sum(1 for a in assignments if a.authority == "EE" and a.status == "Passed")
    ee_flagged = sum(1 for a in assignments if a.authority == "EE" and a.status == "Flagged")

    formatted_assignments = []
    for a in assignments:
        mb = a.measurement_book
        wbs = db.query(WbsTask).filter(WbsTask.id == mb.wbs_node_id).first() if (mb and mb.wbs_node_id) else None
        reviewer = db.query(User).filter(User.id == a.reviewer_id).first() if a.reviewer_id else None

        qty = float(mb.computed_quantity if mb.computed_quantity is not None else mb.measured_qty) if mb else 0.0
        boq = db.query(BoqItem).filter(BoqItem.id == mb.boq_item_id).first() if (mb and mb.boq_item_id) else None
        rate = float(boq.rate) if boq else 0.0
        val = qty * rate

        formatted_assignments.append({
            "id": a.id,
            "measurement_book_id": a.measurement_book_id,
            "mb_reference": f"MB-{a.measurement_book_id:04d}",
            "project_id": a.project_id,
            "project_name": project.name,
            "wbs_node_name": wbs.title if wbs else None,
            "description": mb.description if mb else "Measurement Record",
            "quantity": qty,
            "unit": mb.unit if mb else "m³",
            "total_value": val,
            "authority": a.authority,
            "sampling_percentage": float(a.sampling_percentage),
            "risk_score": float(a.risk_score or 1.0),
            "risk_factors": a.risk_factors,
            "sampling_reason": a.sampling_reason,
            "status": a.status,
            "reviewer_id": a.reviewer_id,
            "reviewer_name": reviewer.full_name if reviewer else None,
            "reviewer_remarks": a.reviewer_remarks,
            "selected_at": a.selected_at,
            "reviewed_at": a.reviewed_at,
            "created_at": a.created_at
        })

    summary = {
        "project_id": project_id,
        "ae_sampling_rate": ae_rate,
        "ee_sampling_rate": ee_rate,
        "ae_pending": ae_pending,
        "ae_passed": ae_passed,
        "ae_flagged": ae_flagged,
        "ee_pending": ee_pending,
        "ee_passed": ee_passed,
        "ee_flagged": ee_flagged,
        "total_assignments": len(assignments)
    }

    return {"summary": summary, "assignments": formatted_assignments}


@router.get("/test-checks/config", response_model=SamplingConfigResponse)
def get_sampling_config(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns tenant sampling configuration."""
    tenant_name = "Default Tenant"
    t_set = db.query(TenantSetting).filter(TenantSetting.tenant_name == tenant_name).first()
    ae_rate = float(t_set.ae_sampling_rate if t_set and t_set.ae_sampling_rate is not None else 50.0)
    ee_rate = float(t_set.ee_sampling_rate if t_set and t_set.ee_sampling_rate is not None else 10.0)

    return SamplingConfigResponse(
        tenant_name=tenant_name,
        ae_sampling_rate=ae_rate,
        ee_sampling_rate=ee_rate,
        min_ae_sampling_rate=50.0,
        min_ee_sampling_rate=10.0
    )


@router.put("/test-checks/config", response_model=SamplingConfigResponse)
def update_sampling_config(
    config_in: SamplingConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates tenant sampling rates with strict CPWD minimum enforcement (AE >= 50%, EE >= 10%)."""
    if config_in.ae_sampling_rate < 50.0:
        raise HTTPException(
            status_code=400,
            detail="AE sampling percentage cannot be lower than CPWD-mandated minimum of 50%."
        )

    if config_in.ee_sampling_rate < 10.0:
        raise HTTPException(
            status_code=400,
            detail="EE sampling percentage cannot be lower than CPWD-mandated minimum of 10%."
        )

    tenant_name = "Default Tenant"
    t_set = db.query(TenantSetting).filter(TenantSetting.tenant_name == tenant_name).first()
    if not t_set:
        t_set = TenantSetting(
            tenant_name=tenant_name,
            ae_sampling_rate=config_in.ae_sampling_rate,
            ee_sampling_rate=config_in.ee_sampling_rate
        )
        db.add(t_set)
    else:
        t_set.ae_sampling_rate = config_in.ae_sampling_rate
        t_set.ee_sampling_rate = config_in.ee_sampling_rate

    db.commit()
    db.refresh(t_set)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action="UPDATE_SAMPLING_CONFIG",
        entity_type="TenantSetting",
        entity_id=t_set.id,
        payload=f"Updated sampling config: AE = {config_in.ae_sampling_rate}%, EE = {config_in.ee_sampling_rate}%"
    )

    return SamplingConfigResponse(
        tenant_name=tenant_name,
        ae_sampling_rate=float(t_set.ae_sampling_rate),
        ee_sampling_rate=float(t_set.ee_sampling_rate),
        min_ae_sampling_rate=50.0,
        min_ee_sampling_rate=10.0
    )


@router.post("/test-checks/{assignment_id}/review")
def review_test_check(
    assignment_id: int,
    req: TestCheckReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reviews an AE or EE Test-Check assignment (Pass or Flag)."""
    assignment = db.query(TestCheckAssignment).filter(TestCheckAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Test-Check Assignment not found")

    # Validate server-side RBAC for assignment.authority
    if not verify_test_check_reviewer(assignment.project_id, current_user, assignment.authority, db):
        raise HTTPException(
            status_code=403,
            detail=f"User is not authorized as {assignment.authority} reviewer for this project."
        )

    action = (req.action or "").strip()
    if action not in ["Pass", "Flag"]:
        raise HTTPException(status_code=400, detail="Invalid review action. Choose 'Pass' or 'Flag'.")

    mb = assignment.measurement_book

    if action == "Flag":
        if not req.remarks or not req.remarks.strip():
            raise HTTPException(status_code=400, detail="Reviewer remarks are mandatory when flagging a test-check.")

        assignment.status = "Flagged"
        assignment.reviewer_id = current_user.id
        assignment.reviewed_at = datetime.utcnow()
        assignment.reviewer_remarks = req.remarks.strip()

        # Update e-MB status to FLAGGED / SENT BACK
        if mb:
            mb.status = "FLAGGED / SENT BACK"

            # FLAGGED AFTER BILL SUBMISSION (Requirement 12)
            active_bills = db.query(ContractorBill).filter(
                ContractorBill.project_id == mb.project_id,
                ContractorBill.boq_item_id == mb.boq_item_id,
                ContractorBill.status.in_(["pending_approval", "verified_matched", "discrepancy_flagged", "approved", "submitted", "pending_verification"])
            ).all()

            for bill in active_bills:
                bill.status = "DRAFT"
                bill.discrepancy_reason = f"Bill returned to Draft because e-MB MB-{mb.id:04d} was flagged during {assignment.authority} Test-Check. Reviewer: {current_user.full_name} ({assignment.authority}). Remarks: {req.remarks.strip()}"
                
                app_task = db.query(ApprovalTask).filter(
                    ApprovalTask.entity_type.in_(["ContractorBill", "CONTRACTOR_BILL", "CONTRACTOR_BILL_PAYMENT"]),
                    ApprovalTask.entity_id == bill.id
                ).first()
                if app_task:
                    app_task.status = "sent_back"

                record_audit_log(
                    db=db,
                    user_id=current_user.id,
                    action="BILL_RETURNED_TO_DRAFT_TEST_CHECK_FLAGGED",
                    entity_type="ContractorBill",
                    entity_id=bill.id,
                    payload=f"Bill #{bill.bill_number} automatically returned to Draft because linked e-MB MB-{mb.id:04d} failed {assignment.authority} Test-Check. Remarks: {req.remarks.strip()}"
                )

        record_audit_log(
            db=db,
            user_id=current_user.id,
            action=f"TEST_CHECK_FLAGGED_{assignment.authority}",
            entity_type="TestCheckAssignment",
            entity_id=assignment.id,
            payload=f"e-MB MB-{assignment.measurement_book_id:04d} FLAGGED during {assignment.authority} Test-Check by {current_user.full_name}. Remarks: {req.remarks.strip()}"
        )

    elif action == "Pass":
        assignment.status = "Passed"
        assignment.reviewer_id = current_user.id
        assignment.reviewed_at = datetime.utcnow()
        assignment.reviewer_remarks = req.remarks.strip() if req.remarks else f"Test-check passed by {current_user.full_name} ({assignment.authority})"

        record_audit_log(
            db=db,
            user_id=current_user.id,
            action=f"TEST_CHECK_PASSED_{assignment.authority}",
            entity_type="TestCheckAssignment",
            entity_id=assignment.id,
            payload=f"e-MB MB-{assignment.measurement_book_id:04d} PASSED {assignment.authority} Test-Check by {current_user.full_name}."
        )

    db.commit()
    db.refresh(assignment)

    return {
        "message": f"Test-Check {assignment.authority} record updated to {assignment.status}",
        "assignment_id": assignment.id,
        "authority": assignment.authority,
        "status": assignment.status,
        "reviewer_remarks": assignment.reviewer_remarks
    }


@router.get("/test-checks/{assignment_id}/audits")
def get_test_check_audits(assignment_id: int, db: Session = Depends(get_db)):
    """Fetch audit log records associated with a test-check assignment."""
    assignment = db.query(TestCheckAssignment).filter(TestCheckAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Test-Check Assignment not found")

    audits = db.query(AuditLog).filter(
        AuditLog.entity_type.in_(["TestCheckAssignment", "MeasurementBook"]),
        AuditLog.entity_id.in_([assignment.id, assignment.measurement_book_id])
    ).order_by(AuditLog.created_at.desc()).all()

    return audits

