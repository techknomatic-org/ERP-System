from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models import (
    ContractorAward, ProjectEstimate, Project, Vendor, ApprovalTask, User
)
from app.schemas import (
    ContractorAwardCreate, ContractorAwardUpdate, ContractorAwardResponse, ReadyProjectForAward
)

router = APIRouter(prefix="/api/contractor-awards", tags=["Contractor Awards"])

def generate_award_reference(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(ContractorAward).count() + 1
    return f"AWD-{year}-{count:03d}"

def calculate_variance(estimated_amount: float, award_amount: float):
    variance_amount = round(estimated_amount - award_amount, 2)
    if estimated_amount > 0:
        variance_percentage = round((variance_amount / estimated_amount) * 100.0, 2)
    else:
        variance_percentage = 0.0
    return variance_amount, variance_percentage

@router.get("/ready-projects", response_model=List[ReadyProjectForAward])
def get_ready_projects_for_award(db: Session = Depends(get_db)):
    """
    Get all projects that have an estimate in READY_FOR_REVIEW or APPROVED status,
    and DO NOT currently have an active award (SUBMITTED, APPROVED, AWARDED).
    """
    # 1. Fetch estimates with valid status
    eligible_estimates = db.query(ProjectEstimate).filter(
        ProjectEstimate.status.in_(["READY_FOR_REVIEW", "APPROVED"])
    ).all()

    ready_list = []
    for est in eligible_estimates:
        # Check if project already has an active award
        active_award = db.query(ContractorAward).filter(
            ContractorAward.project_id == est.project_id,
            ContractorAward.status.in_(["SUBMITTED", "APPROVED", "AWARDED"])
        ).first()

        if not active_award:
            proj = db.query(Project).filter(Project.id == est.project_id).first()
            if proj:
                ready_list.append(ReadyProjectForAward(
                    project_id=proj.id,
                    project_name=proj.name,
                    project_code=proj.code or f"PRJ-{proj.id}",
                    estimate_id=est.id,
                    estimate_number=est.estimate_number,
                    estimated_amount=float(est.total_amount or 0.0),
                    estimate_status=est.status
                ))

    return ready_list

@router.get("", response_model=List[ContractorAwardResponse])
def list_contractor_awards(
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ContractorAward)
    if project_id:
        query = query.filter(ContractorAward.project_id == project_id)
    if status:
        query = query.filter(ContractorAward.status == status)

    awards = query.order_by(ContractorAward.created_at.desc()).all()

    results = []
    for award in awards:
        proj = db.query(Project).filter(Project.id == award.project_id).first()
        est = db.query(ProjectEstimate).filter(ProjectEstimate.id == award.estimate_id).first()
        vendor = db.query(Vendor).filter(Vendor.id == award.contractor_id).first()

        res = ContractorAwardResponse(
            id=award.id,
            award_reference=award.award_reference,
            project_id=award.project_id,
            estimate_id=award.estimate_id,
            contractor_id=award.contractor_id,
            estimated_amount=float(award.estimated_amount or 0.0),
            award_amount=float(award.award_amount or 0.0),
            variance_amount=float(award.variance_amount or 0.0),
            variance_percentage=float(award.variance_percentage or 0.0),
            award_date=award.award_date,
            start_date=award.start_date,
            completion_date=award.completion_date,
            remarks=award.remarks,
            status=award.status,
            created_at=award.created_at,
            updated_at=award.updated_at,
            project_name=proj.name if proj else None,
            project_code=proj.code if proj else None,
            contractor_name=vendor.name if vendor else None,
            contractor_code=vendor.code if vendor else None,
            estimate_number=est.estimate_number if est else None,
            estimate_status=est.status if est else None
        )
        results.append(res)

    return results

@router.get("/{award_id}", response_model=ContractorAwardResponse)
def get_contractor_award(award_id: int, db: Session = Depends(get_db)):
    award = db.query(ContractorAward).filter(ContractorAward.id == award_id).first()
    if not award:
        raise HTTPException(status_code=404, detail="Contractor award not found")

    proj = db.query(Project).filter(Project.id == award.project_id).first()
    est = db.query(ProjectEstimate).filter(ProjectEstimate.id == award.estimate_id).first()
    vendor = db.query(Vendor).filter(Vendor.id == award.contractor_id).first()

    return ContractorAwardResponse(
        id=award.id,
        award_reference=award.award_reference,
        project_id=award.project_id,
        estimate_id=award.estimate_id,
        contractor_id=award.contractor_id,
        estimated_amount=float(award.estimated_amount or 0.0),
        award_amount=float(award.award_amount or 0.0),
        variance_amount=float(award.variance_amount or 0.0),
        variance_percentage=float(award.variance_percentage or 0.0),
        award_date=award.award_date,
        start_date=award.start_date,
        completion_date=award.completion_date,
        remarks=award.remarks,
        status=award.status,
        created_at=award.created_at,
        updated_at=award.updated_at,
        project_name=proj.name if proj else None,
        project_code=proj.code if proj else None,
        contractor_name=vendor.name if vendor else None,
        contractor_code=vendor.code if vendor else None,
        estimate_number=est.estimate_number if est else None,
        estimate_status=est.status if est else None
    )

@router.post("", response_model=ContractorAwardResponse, status_code=status.HTTP_201_CREATED)
def create_contractor_award(
    payload: ContractorAwardCreate,
    db: Session = Depends(get_db)
):
    # 1. Validate project
    proj = db.query(Project).filter(Project.id == payload.project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    # 2. Find eligible estimate for project
    est = db.query(ProjectEstimate).filter(
        ProjectEstimate.project_id == payload.project_id
    ).order_by(ProjectEstimate.created_at.desc()).first()

    if not est or est.status not in ["READY_FOR_REVIEW", "APPROVED"]:
        raise HTTPException(
            status_code=400,
            detail="Project is not ready for contractor award. Complete and approve the project estimate first."
        )

    # 3. Check for existing active award for this project
    existing_active = db.query(ContractorAward).filter(
        ContractorAward.project_id == payload.project_id,
        ContractorAward.status.in_(["SUBMITTED", "APPROVED", "AWARDED"])
    ).first()
    if existing_active:
        raise HTTPException(
            status_code=400,
            detail="This project already has an active contractor award."
        )

    # 4. Validate vendor/contractor
    vendor = db.query(Vendor).filter(Vendor.id == payload.contractor_id).first()
    if not vendor or vendor.status != "active":
        raise HTTPException(status_code=400, detail="Selected contractor is invalid or inactive")

    # 5. Calculate financials
    estimated_amount = float(est.total_amount or 0.0)
    award_amount = float(payload.award_amount or 0.0)
    variance_amount, variance_percentage = calculate_variance(estimated_amount, award_amount)

    award_ref = generate_award_reference(db)
    award_status = payload.status if payload.status in ["DRAFT", "SUBMITTED"] else "DRAFT"

    award_date = payload.award_date or datetime.utcnow()
    start_date = payload.start_date or datetime.utcnow()
    completion_date = payload.completion_date or (datetime.utcnow() + timedelta(days=90))

    award = ContractorAward(
        award_reference=award_ref,
        project_id=payload.project_id,
        estimate_id=est.id,
        contractor_id=payload.contractor_id,
        estimated_amount=estimated_amount,
        award_amount=award_amount,
        variance_amount=variance_amount,
        variance_percentage=variance_percentage,
        award_date=award_date,
        start_date=start_date,
        completion_date=completion_date,
        remarks=payload.remarks,
        status=award_status
    )
    db.add(award)
    db.commit()
    db.refresh(award)

    # If submitted directly, create approval task
    if award_status == "SUBMITTED":
        app_task = ApprovalTask(
            title=f"Contractor Award Approval - {award_ref} ({proj.name})",
            entity_type="ContractorAward",
            entity_id=award.id,
            requester_id=1,
            current_stage="Project Manager",
            status="pending"
        )
        db.add(app_task)
        db.commit()

    return ContractorAwardResponse(
        id=award.id,
        award_reference=award.award_reference,
        project_id=award.project_id,
        estimate_id=award.estimate_id,
        contractor_id=award.contractor_id,
        estimated_amount=float(award.estimated_amount),
        award_amount=float(award.award_amount),
        variance_amount=float(award.variance_amount),
        variance_percentage=float(award.variance_percentage),
        award_date=award.award_date,
        start_date=award.start_date,
        completion_date=award.completion_date,
        remarks=award.remarks,
        status=award.status,
        created_at=award.created_at,
        updated_at=award.updated_at,
        project_name=proj.name,
        project_code=proj.code,
        contractor_name=vendor.name,
        contractor_code=vendor.code,
        estimate_number=est.estimate_number,
        estimate_status=est.status
    )

@router.put("/{award_id}", response_model=ContractorAwardResponse)
def update_contractor_award(
    award_id: int,
    payload: ContractorAwardUpdate,
    db: Session = Depends(get_db)
):
    award = db.query(ContractorAward).filter(ContractorAward.id == award_id).first()
    if not award:
        raise HTTPException(status_code=404, detail="Contractor award not found")

    if award.status in ["AWARDED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot edit award in {award.status} status")

    if payload.contractor_id:
        vendor = db.query(Vendor).filter(Vendor.id == payload.contractor_id).first()
        if not vendor or vendor.status != "active":
            raise HTTPException(status_code=400, detail="Invalid or inactive contractor")
        award.contractor_id = payload.contractor_id

    if payload.award_amount is not None:
        award.award_amount = float(payload.award_amount)
        est_amount = float(award.estimated_amount)
        var_amt, var_pct = calculate_variance(est_amount, award.award_amount)
        award.variance_amount = var_amt
        award.variance_percentage = var_pct

    if payload.award_date:
        award.award_date = payload.award_date
    if payload.start_date:
        award.start_date = payload.start_date
    if payload.completion_date:
        award.completion_date = payload.completion_date
    if payload.remarks is not None:
        award.remarks = payload.remarks
    if payload.status:
        award.status = payload.status

    award.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(award)

    proj = db.query(Project).filter(Project.id == award.project_id).first()
    est = db.query(ProjectEstimate).filter(ProjectEstimate.id == award.estimate_id).first()
    vendor = db.query(Vendor).filter(Vendor.id == award.contractor_id).first()

    return ContractorAwardResponse(
        id=award.id,
        award_reference=award.award_reference,
        project_id=award.project_id,
        estimate_id=award.estimate_id,
        contractor_id=award.contractor_id,
        estimated_amount=float(award.estimated_amount),
        award_amount=float(award.award_amount),
        variance_amount=float(award.variance_amount),
        variance_percentage=float(award.variance_percentage),
        award_date=award.award_date,
        start_date=award.start_date,
        completion_date=award.completion_date,
        remarks=award.remarks,
        status=award.status,
        created_at=award.created_at,
        updated_at=award.updated_at,
        project_name=proj.name if proj else None,
        project_code=proj.code if proj else None,
        contractor_name=vendor.name if vendor else None,
        contractor_code=vendor.code if vendor else None,
        estimate_number=est.estimate_number if est else None,
        estimate_status=est.status if est else None
    )

@router.post("/{award_id}/submit", response_model=ContractorAwardResponse)
def submit_contractor_award_for_approval(
    award_id: int,
    db: Session = Depends(get_db)
):
    award = db.query(ContractorAward).filter(ContractorAward.id == award_id).first()
    if not award:
        raise HTTPException(status_code=404, detail="Contractor award not found")

    if award.status not in ["DRAFT", "REJECTED"]:
        raise HTTPException(status_code=400, detail=f"Award in status {award.status} cannot be submitted")

    award.status = "SUBMITTED"
    award.updated_at = datetime.utcnow()

    proj = db.query(Project).filter(Project.id == award.project_id).first()
    proj_name = proj.name if proj else f"Project #{award.project_id}"

    # Create ApprovalTask
    app_task = ApprovalTask(
        title=f"Contractor Award Approval - {award.award_reference} ({proj_name})",
        entity_type="ContractorAward",
        entity_id=award.id,
        requester_id=1,
        current_stage="Project Manager",
        status="pending"
    )
    db.add(app_task)
    db.commit()
    db.refresh(award)

    est = db.query(ProjectEstimate).filter(ProjectEstimate.id == award.estimate_id).first()
    vendor = db.query(Vendor).filter(Vendor.id == award.contractor_id).first()

    return ContractorAwardResponse(
        id=award.id,
        award_reference=award.award_reference,
        project_id=award.project_id,
        estimate_id=award.estimate_id,
        contractor_id=award.contractor_id,
        estimated_amount=float(award.estimated_amount),
        award_amount=float(award.award_amount),
        variance_amount=float(award.variance_amount),
        variance_percentage=float(award.variance_percentage),
        award_date=award.award_date,
        start_date=award.start_date,
        completion_date=award.completion_date,
        remarks=award.remarks,
        status=award.status,
        created_at=award.created_at,
        updated_at=award.updated_at,
        project_name=proj.name if proj else None,
        project_code=proj.code if proj else None,
        contractor_name=vendor.name if vendor else None,
        contractor_code=vendor.code if vendor else None,
        estimate_number=est.estimate_number if est else None,
        estimate_status=est.status if est else None
    )

@router.post("/{award_id}/finalize", response_model=ContractorAwardResponse)
def finalize_contractor_award(
    award_id: int,
    db: Session = Depends(get_db)
):
    award = db.query(ContractorAward).filter(ContractorAward.id == award_id).first()
    if not award:
        raise HTTPException(status_code=404, detail="Contractor award not found")

    if award.status != "APPROVED":
        raise HTTPException(
            status_code=400,
            detail=f"Only APPROVED awards can be finalized. Current status is {award.status}"
        )

    award.status = "AWARDED"
    award.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(award)

    proj = db.query(Project).filter(Project.id == award.project_id).first()
    est = db.query(ProjectEstimate).filter(ProjectEstimate.id == award.estimate_id).first()
    vendor = db.query(Vendor).filter(Vendor.id == award.contractor_id).first()

    return ContractorAwardResponse(
        id=award.id,
        award_reference=award.award_reference,
        project_id=award.project_id,
        estimate_id=award.estimate_id,
        contractor_id=award.contractor_id,
        estimated_amount=float(award.estimated_amount),
        award_amount=float(award.award_amount),
        variance_amount=float(award.variance_amount),
        variance_percentage=float(award.variance_percentage),
        award_date=award.award_date,
        start_date=award.start_date,
        completion_date=award.completion_date,
        remarks=award.remarks,
        status=award.status,
        created_at=award.created_at,
        updated_at=award.updated_at,
        project_name=proj.name if proj else None,
        project_code=proj.code if proj else None,
        contractor_name=vendor.name if vendor else None,
        contractor_code=vendor.code if vendor else None,
        estimate_number=est.estimate_number if est else None,
        estimate_status=est.status if est else None
    )

@router.post("/{award_id}/cancel", response_model=ContractorAwardResponse)
def cancel_contractor_award(
    award_id: int,
    db: Session = Depends(get_db)
):
    award = db.query(ContractorAward).filter(ContractorAward.id == award_id).first()
    if not award:
        raise HTTPException(status_code=404, detail="Contractor award not found")

    if award.status == "AWARDED":
        raise HTTPException(status_code=400, detail="Cannot cancel an already AWARDED contract")

    award.status = "CANCELLED"
    award.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(award)

    proj = db.query(Project).filter(Project.id == award.project_id).first()
    est = db.query(ProjectEstimate).filter(ProjectEstimate.id == award.estimate_id).first()
    vendor = db.query(Vendor).filter(Vendor.id == award.contractor_id).first()

    return ContractorAwardResponse(
        id=award.id,
        award_reference=award.award_reference,
        project_id=award.project_id,
        estimate_id=award.estimate_id,
        contractor_id=award.contractor_id,
        estimated_amount=float(award.estimated_amount),
        award_amount=float(award.award_amount),
        variance_amount=float(award.variance_amount),
        variance_percentage=float(award.variance_percentage),
        award_date=award.award_date,
        start_date=award.start_date,
        completion_date=award.completion_date,
        remarks=award.remarks,
        status=award.status,
        created_at=award.created_at,
        updated_at=award.updated_at,
        project_name=proj.name if proj else None,
        project_code=proj.code if proj else None,
        contractor_name=vendor.name if vendor else None,
        contractor_code=vendor.code if vendor else None,
        estimate_number=est.estimate_number if est else None,
        estimate_status=est.status if est else None
    )
