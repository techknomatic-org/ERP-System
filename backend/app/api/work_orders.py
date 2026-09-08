from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import WorkOrder, ContractorAward, Project, Vendor, User
from app.schemas import (
    WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse, EligibleAwardForWO, WorkOrderCancelRequest
)

router = APIRouter(prefix="/api/work-orders", tags=["Work Orders"])

def generate_work_order_number(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(WorkOrder).count() + 1
    return f"WO-{year}-{count:03d}"

@router.get("/eligible-awards", response_model=List[EligibleAwardForWO])
def get_eligible_awards_for_wo(db: Session = Depends(get_db)):
    """
    Get all contractor awards that are in AWARDED status and DO NOT have an active Work Order
    (DRAFT, ISSUED, ACTIVE, COMPLETED).
    """
    awarded_awards = db.query(ContractorAward).filter(ContractorAward.status == "AWARDED").all()
    
    eligible = []
    for award in awarded_awards:
        existing_wo = db.query(WorkOrder).filter(
            WorkOrder.award_id == award.id,
            WorkOrder.status.in_(["DRAFT", "ISSUED", "ACTIVE", "COMPLETED"])
        ).first()

        if not existing_wo:
            proj = db.query(Project).filter(Project.id == award.project_id).first()
            vendor = db.query(Vendor).filter(Vendor.id == award.contractor_id).first()
            if proj and vendor:
                eligible.append(EligibleAwardForWO(
                    award_id=award.id,
                    award_reference=award.award_reference,
                    project_id=proj.id,
                    project_name=proj.name,
                    project_code=proj.code or f"PRJ-{proj.id}",
                    contractor_id=vendor.id,
                    contractor_name=vendor.name,
                    contractor_code=vendor.code or f"VND-{vendor.id}",
                    award_amount=float(award.award_amount or 0.0),
                    award_date=award.award_date,
                    start_date=award.start_date,
                    completion_date=award.completion_date
                ))
    return eligible

def build_wo_response(wo: WorkOrder, db: Session) -> WorkOrderResponse:
    # Auto-promote ISSUED -> ACTIVE if start_date <= today
    if wo.status == "ISSUED" and wo.start_date <= datetime.utcnow():
        wo.status = "ACTIVE"
        wo.updated_at = datetime.utcnow()
        db.commit()

    award = db.query(ContractorAward).filter(ContractorAward.id == wo.award_id).first()
    proj = db.query(Project).filter(Project.id == wo.project_id).first()
    vendor = db.query(Vendor).filter(Vendor.id == wo.contractor_id).first()

    return WorkOrderResponse(
        id=wo.id,
        work_order_number=wo.work_order_number,
        award_id=wo.award_id,
        project_id=wo.project_id,
        contractor_id=wo.contractor_id,
        issue_date=wo.issue_date,
        scope_of_work=wo.scope_of_work,
        description=wo.description,
        work_order_value=float(wo.work_order_value or 0.0),
        start_date=wo.start_date,
        completion_date=wo.completion_date,
        payment_terms=wo.payment_terms,
        terms_conditions=wo.terms_conditions,
        remarks=wo.remarks,
        cancellation_reason=wo.cancellation_reason,
        included_packages=wo.included_packages,
        status=wo.status,
        award_reference=award.award_reference if award else None,
        award_amount=float(award.award_amount) if award else None,
        award_date=award.award_date if award else None,
        project_name=proj.name if proj else None,
        project_code=proj.code if proj else None,
        contractor_name=vendor.name if vendor else None,
        contractor_code=vendor.code if vendor else None,
        created_at=wo.created_at,
        updated_at=wo.updated_at
    )

@router.get("", response_model=List[WorkOrderResponse])
def list_work_orders(
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(WorkOrder)
    if project_id:
        query = query.filter(WorkOrder.project_id == project_id)
    if status:
        query = query.filter(WorkOrder.status == status)

    wos = query.order_by(WorkOrder.created_at.desc()).all()
    return [build_wo_response(wo, db) for wo in wos]

@router.get("/{wo_id}", response_model=WorkOrderResponse)
def get_work_order(wo_id: int, db: Session = Depends(get_db)):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    return build_wo_response(wo, db)

@router.post("", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
def create_work_order(
    payload: WorkOrderCreate,
    db: Session = Depends(get_db)
):
    # 1. Validate award exists and is in AWARDED status
    award = db.query(ContractorAward).filter(ContractorAward.id == payload.award_id).first()
    if not award:
        raise HTTPException(status_code=404, detail="Contractor award not found")

    if award.status != "AWARDED":
        raise HTTPException(
            status_code=400,
            detail=f"Work Order can only be generated from an AWARDED contractor award. Current award status is '{award.status}'."
        )

    # 2. Prevent duplicate active work orders for this award
    existing_wo = db.query(WorkOrder).filter(
        WorkOrder.award_id == payload.award_id,
        WorkOrder.status.in_(["DRAFT", "ISSUED", "ACTIVE", "COMPLETED"])
    ).first()
    if existing_wo:
        raise HTTPException(
            status_code=400,
            detail=f"Work Order already exists for Award {award.award_reference} ({existing_wo.work_order_number})."
        )

    # 3. Validate project and contractor
    proj = db.query(Project).filter(Project.id == payload.project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    vendor = db.query(Vendor).filter(Vendor.id == payload.contractor_id).first()
    if not vendor or vendor.status != "active":
        raise HTTPException(status_code=400, detail="Invalid or inactive contractor")

    # 4. Dates & WO Number
    wo_number = generate_work_order_number(db)
    issue_date = payload.issue_date or datetime.utcnow()
    start_date = payload.start_date or award.start_date
    completion_date = payload.completion_date or award.completion_date

    wo_status = payload.status if payload.status in ["DRAFT", "ISSUED"] else "DRAFT"
    if wo_status == "ISSUED" and start_date <= datetime.utcnow():
        wo_status = "ACTIVE"

    wo = WorkOrder(
        work_order_number=wo_number,
        award_id=payload.award_id,
        project_id=payload.project_id,
        contractor_id=payload.contractor_id,
        issue_date=issue_date,
        scope_of_work=payload.scope_of_work or "General Construction Scope",
        description=payload.description,
        work_order_value=float(payload.work_order_value or award.award_amount or 0.0),
        start_date=start_date,
        completion_date=completion_date,
        payment_terms=payload.payment_terms,
        terms_conditions=payload.terms_conditions,
        remarks=payload.remarks,
        included_packages=payload.included_packages,
        status=wo_status
    )
    db.add(wo)
    db.commit()
    db.refresh(wo)

    return build_wo_response(wo, db)

@router.put("/{wo_id}", response_model=WorkOrderResponse)
def update_work_order(
    wo_id: int,
    payload: WorkOrderUpdate,
    db: Session = Depends(get_db)
):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    if wo.status in ["COMPLETED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot edit Work Order in '{wo.status}' status")

    if payload.scope_of_work:
        wo.scope_of_work = payload.scope_of_work
    if payload.description is not None:
        wo.description = payload.description
    if payload.work_order_value is not None:
        wo.work_order_value = float(payload.work_order_value)
    if payload.issue_date:
        wo.issue_date = payload.issue_date
    if payload.start_date:
        wo.start_date = payload.start_date
    if payload.completion_date:
        wo.completion_date = payload.completion_date
    if payload.payment_terms is not None:
        wo.payment_terms = payload.payment_terms
    if payload.terms_conditions is not None:
        wo.terms_conditions = payload.terms_conditions
    if payload.remarks is not None:
        wo.remarks = payload.remarks
    if payload.included_packages is not None:
        wo.included_packages = payload.included_packages
    if payload.status:
        wo.status = payload.status

    wo.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(wo)

    return build_wo_response(wo, db)

@router.post("/{wo_id}/issue", response_model=WorkOrderResponse)
def issue_work_order(
    wo_id: int,
    db: Session = Depends(get_db)
):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    if wo.status != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Only DRAFT work orders can be issued. Current status is '{wo.status}'.")

    # Validate required fields
    if not wo.scope_of_work:
        raise HTTPException(status_code=400, detail="Scope of Work is required to issue a Work Order.")
    if not wo.work_order_value or float(wo.work_order_value) <= 0:
        raise HTTPException(status_code=400, detail="Work Order Value must be greater than 0.")
    if wo.completion_date < wo.start_date:
        raise HTTPException(status_code=400, detail="Completion Date cannot be earlier than Start Date.")

    wo_status = "ISSUED"
    if wo.start_date <= datetime.utcnow():
        wo_status = "ACTIVE"

    wo.status = wo_status
    wo.issue_date = datetime.utcnow()
    wo.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(wo)

    return build_wo_response(wo, db)

@router.post("/{wo_id}/cancel", response_model=WorkOrderResponse)
def cancel_work_order(
    wo_id: int,
    req: WorkOrderCancelRequest,
    db: Session = Depends(get_db)
):
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    if wo.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Cannot cancel a COMPLETED work order.")

    if not req.cancellation_reason or not req.cancellation_reason.strip():
        raise HTTPException(status_code=400, detail="Cancellation reason is required.")

    wo.status = "CANCELLED"
    wo.cancellation_reason = req.cancellation_reason.strip()
    wo.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(wo)

    return build_wo_response(wo, db)
