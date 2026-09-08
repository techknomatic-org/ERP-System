from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import (
    TechnicalSanction, ProjectEstimate, ProjectEstimateLine, Project, 
    User, AuditLog, Notification, ApprovalTask, ProjectTeamMember
)
from app.schemas import (
    TechnicalSanctionSubmitRequest, TechnicalSanctionApproveRequest, 
    TechnicalSanctionRejectRequest, TechnicalSanctionResponse
)
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/technical-sanctions", tags=["PSC-07 Technical Sanction Workflow"])

AUTHORIZED_EE_ROLES = ["admin", "executive_engineer", "ee", "project_manager", "management"]

def resolve_sanctioning_authority(project_id: int, db: Session) -> Optional[User]:
    """
    Dynamically resolves the authorized Executive Engineer (EE) for the workflow chain.
    First checks project team assignments, then searches for users with EE role.
    """
    # 1. Check ProjectTeamMember for this project
    team_members = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_id == project_id,
        ProjectTeamMember.is_active == True
    ).all()

    for tm in team_members:
        role_str = (tm.project_role or "").lower()
        if "executive" in role_str or "ee" in role_str or "sanction" in role_str:
            user = db.query(User).filter(User.id == tm.user_id, User.is_active == True).first()
            if user:
                return user

    # 2. Search for User with role 'executive_engineer' or 'ee'
    ee_users = db.query(User).filter(
        User.is_active == True,
        User.role.in_(["executive_engineer", "ee"])
    ).order_by(User.id.asc()).all()

    if ee_users and len(ee_users) > 0:
        return ee_users[0]

    return None

def build_ts_response(ts: TechnicalSanction, db: Session) -> TechnicalSanctionResponse:
    authority_user = db.query(User).filter(User.id == ts.sanctioning_authority_user_id).first() if ts.sanctioning_authority_user_id else None
    sub_user = db.query(User).filter(User.id == ts.submitted_by_id).first() if ts.submitted_by_id else None
    app_user = db.query(User).filter(User.id == ts.approved_by_id).first() if ts.approved_by_id else None
    rej_user = db.query(User).filter(User.id == ts.rejected_by_id).first() if ts.rejected_by_id else None

    authority_name = f"Executive Engineer — {authority_user.full_name}" if authority_user else "Unassigned (Vacant)"

    return TechnicalSanctionResponse(
        id=ts.id,
        project_id=ts.project_id,
        detailed_estimate_id=ts.detailed_estimate_id,
        sanctioning_authority_user_id=ts.sanctioning_authority_user_id,
        sanctioning_authority_name=authority_name,
        sanction_reference_number=ts.sanction_reference_number,
        sanction_date=ts.sanction_date,
        remarks=ts.remarks,
        status=ts.status,
        rejection_reason=ts.rejection_reason,
        submitted_at=ts.submitted_at,
        submitted_by_id=ts.submitted_by_id,
        submitted_by_name=sub_user.full_name if sub_user else "System",
        approved_at=ts.approved_at,
        approved_by_id=ts.approved_by_id,
        approved_by_name=app_user.full_name if app_user else None,
        rejected_at=ts.rejected_at,
        rejected_by_id=ts.rejected_by_id,
        rejected_by_name=rej_user.full_name if rej_user else None,
        estimate_revision=ts.estimate_revision or 0,
        estimate_total_at_submission=float(ts.estimate_total_at_submission) if ts.estimate_total_at_submission is not None else 0.0,
        created_at=ts.created_at,
        updated_at=ts.updated_at
    )

@router.post("", response_model=TechnicalSanctionResponse)
@router.post("/submit", response_model=TechnicalSanctionResponse)
def submit_technical_sanction(
    req: TechnicalSanctionSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    estimate = db.query(ProjectEstimate).filter(ProjectEstimate.id == req.estimate_id).first()
    if not estimate:
        raise HTTPException(status_code=404, detail="Detailed Estimate not found")

    if estimate.project_id != req.project_id:
        raise HTTPException(status_code=400, detail="Estimate does not belong to the specified project.")

    # Validation: Estimate must contain at least 1 BOQ item
    lines = db.query(ProjectEstimateLine).filter(ProjectEstimateLine.estimate_id == estimate.id).all()
    if not lines or len(lines) == 0:
        raise HTTPException(status_code=400, detail="Add at least one item")

    # Resolve EE Sanctioning Authority
    ee_user = resolve_sanctioning_authority(req.project_id, db)

    # VACANT EE EDGE CASE CHECK
    if not ee_user:
        # Notify Tenant Admin
        admins = db.query(User).filter(User.role == "admin", User.is_active == True).all()
        for admin in admins:
            notif = Notification(
                user_id=admin.id,
                title="Vacant Sanctioning Authority Alert",
                message=f"Technical Sanction submission for Project '{project.name}' failed because no Executive Engineer (EE) is assigned.",
                notification_type="warning",
                entity_type="Project",
                entity_id=project.id
            )
            db.add(notif)
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Technical Sanction cannot be submitted because the Sanctioning Authority (EE) is not assigned. Please contact the Tenant Admin to assign the EE role."
        )

    # Create Technical Sanction record
    ts = TechnicalSanction(
        project_id=req.project_id,
        detailed_estimate_id=estimate.id,
        sanctioning_authority_user_id=ee_user.id,
        sanction_reference_number=None,
        sanction_date=None,
        remarks=req.remarks.strip() if req.remarks else None,
        status="PENDING_APPROVAL",
        submitted_at=datetime.utcnow(),
        submitted_by_id=current_user.id,
        estimate_revision=estimate.revision_number or 0,
        estimate_total_at_submission=float(estimate.total_amount or 0.0),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(ts)
    db.flush()

    # Update ProjectEstimate TS status
    estimate.ts_status = "PENDING_APPROVAL"
    estimate.updated_at = datetime.utcnow()

    # Create ApprovalTask for Approvals queue
    task = ApprovalTask(
        title=f"Technical Sanction Approval: Estimate #{estimate.estimate_number} ({project.name})",
        entity_type="TECHNICAL_SANCTION",
        entity_id=ts.id,
        requester_id=current_user.id,
        current_stage="Executive Engineer",
        status="pending",
        request_type="TECHNICAL_SANCTION",
        request_category="FINANCIAL",
        source_module="FINANCIAL_REQUESTS"
    )
    db.add(task)

    # Notify EE
    ee_notif = Notification(
        user_id=ee_user.id,
        title="Technical Sanction Pending Review",
        message=f"Detailed Estimate #{estimate.estimate_number} for Project '{project.name}' has been submitted for Technical Sanction.",
        notification_type="info",
        entity_type="TechnicalSanction",
        entity_id=ts.id
    )
    db.add(ee_notif)

    # Audit Log
    audit = AuditLog(
        user_id=current_user.id,
        action="SUBMIT_TECHNICAL_SANCTION",
        entity_type="TechnicalSanction",
        entity_id=ts.id,
        payload=f"Submitted Detailed Estimate #{estimate.estimate_number} for Technical Sanction to EE {ee_user.full_name}"
    )
    db.add(audit)

    db.commit()
    db.refresh(ts)
    return build_ts_response(ts, db)

@router.get("/project/{project_id}", response_model=List[TechnicalSanctionResponse])
def get_sanctions_for_project(project_id: int, db: Session = Depends(get_db)):
    sanctions = db.query(TechnicalSanction).filter(
        TechnicalSanction.project_id == project_id
    ).order_by(TechnicalSanction.id.desc()).all()
    return [build_ts_response(s, db) for s in sanctions]

@router.get("/pending", response_model=List[TechnicalSanctionResponse])
def get_pending_sanctions(db: Session = Depends(get_db)):
    sanctions = db.query(TechnicalSanction).filter(
        TechnicalSanction.status == "PENDING_APPROVAL"
    ).order_by(TechnicalSanction.id.desc()).all()
    return [build_ts_response(s, db) for s in sanctions]

@router.get("/{ts_id}", response_model=TechnicalSanctionResponse)
def get_sanction_by_id(ts_id: int, db: Session = Depends(get_db)):
    ts = db.query(TechnicalSanction).filter(TechnicalSanction.id == ts_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Technical Sanction record not found")
    return build_ts_response(ts, db)

@router.post("/{ts_id}/approve", response_model=TechnicalSanctionResponse)
def approve_technical_sanction(
    ts_id: int,
    approval_req: Optional[TechnicalSanctionApproveRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # RBAC & Security Verification
    user_role = (current_user.role or "").lower().strip()
    if user_role not in AUTHORIZED_EE_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Only authorized Executive Engineer (EE) or Management roles can approve Technical Sanction."
        )

    ts = db.query(TechnicalSanction).filter(TechnicalSanction.id == ts_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Technical Sanction record not found")

    if ts.status == "APPROVED":
        raise HTTPException(status_code=400, detail="Technical Sanction is already approved.")

    if ts.status != "PENDING_APPROVAL":
        raise HTTPException(status_code=400, detail=f"Cannot approve Technical Sanction in '{ts.status}' state.")

    estimate = db.query(ProjectEstimate).filter(ProjectEstimate.id == ts.detailed_estimate_id).first()
    if not estimate:
        raise HTTPException(status_code=404, detail="Associated Detailed Estimate not found")

    # ESTIMATE INTEGRITY SNAPSHOT CHECK (Requirement 11)
    current_revision = estimate.revision_number or 0
    current_total = round(float(estimate.total_amount or 0.0), 2)
    submitted_total = round(float(ts.estimate_total_at_submission or 0.0), 2)

    if current_revision != ts.estimate_revision or current_total != submitted_total:
        ts.status = "INVALIDATED"
        estimate.ts_status = "INVALIDATED"
        ts.updated_at = datetime.utcnow()
        db.commit()

        # Audit invalidation
        audit = AuditLog(
            user_id=current_user.id,
            action="INVALIDATE_TECHNICAL_SANCTION",
            entity_type="TechnicalSanction",
            entity_id=ts.id,
            payload=f"Technical Sanction #{ts.id} INVALIDATED because estimate total/revision changed after submission."
        )
        db.add(audit)
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="This Technical Sanction request is no longer valid because the Detailed Estimate was changed after submission. Please resubmit the revised estimate for Technical Sanction."
        )

    # Generate Sanction Reference Number (Requirement 6)
    year = datetime.utcnow().year
    ref_number = f"TS/{year}/{ts.id:06d}"

    # Update Technical Sanction
    ts.status = "APPROVED"
    ts.sanction_reference_number = ref_number
    ts.sanction_date = datetime.utcnow()
    ts.approved_at = datetime.utcnow()
    ts.approved_by_id = current_user.id
    if approval_req and approval_req.remarks:
        ts.remarks = approval_req.remarks.strip()
    ts.updated_at = datetime.utcnow()

    # Update Detailed Estimate status and lock it (Requirement 12 & 15)
    estimate.ts_status = "APPROVED"
    estimate.status = "APPROVED"
    estimate.is_ts_locked = True
    estimate.updated_at = datetime.utcnow()

    # Update associated ApprovalTask if present
    task = db.query(ApprovalTask).filter(
        ApprovalTask.entity_type == "TECHNICAL_SANCTION",
        ApprovalTask.entity_id == ts.id
    ).first()
    if task:
        task.status = "approved"

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="APPROVE_TECHNICAL_SANCTION",
        entity_type="TechnicalSanction",
        entity_id=ts.id,
        payload=f"EE Approved Technical Sanction #{ref_number} for Estimate #{estimate.estimate_number}"
    )
    db.add(audit)

    # Notify requester
    notif = Notification(
        user_id=ts.submitted_by_id,
        title="Technical Sanction Approved",
        message=f"Technical Sanction #{ref_number} for Detailed Estimate #{estimate.estimate_number} has been APPROVED by {current_user.full_name}.",
        notification_type="info",
        entity_type="TechnicalSanction",
        entity_id=ts.id
    )
    db.add(notif)

    db.commit()
    db.refresh(ts)
    return build_ts_response(ts, db)

@router.post("/{ts_id}/reject", response_model=TechnicalSanctionResponse)
def reject_technical_sanction(
    ts_id: int,
    reject_req: TechnicalSanctionRejectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # RBAC & Security Verification
    user_role = (current_user.role or "").lower().strip()
    if user_role not in AUTHORIZED_EE_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Only authorized Executive Engineer (EE) or Management roles can reject Technical Sanction."
        )

    # MANDATORY REJECTION REASON CHECK (Requirement 13)
    if not reject_req or not reject_req.rejection_reason or not reject_req.rejection_reason.strip():
        raise HTTPException(
            status_code=400,
            detail="Rejection reason is mandatory."
        )

    ts = db.query(TechnicalSanction).filter(TechnicalSanction.id == ts_id).first()
    if not ts:
        raise HTTPException(status_code=404, detail="Technical Sanction record not found")

    if ts.status == "APPROVED":
        raise HTTPException(status_code=400, detail="Cannot reject an already approved Technical Sanction.")

    estimate = db.query(ProjectEstimate).filter(ProjectEstimate.id == ts.detailed_estimate_id).first()
    if not estimate:
        raise HTTPException(status_code=404, detail="Associated Detailed Estimate not found")

    reason_str = reject_req.rejection_reason.strip()

    # Update Technical Sanction
    ts.status = "REJECTED"
    ts.rejection_reason = reason_str
    ts.rejected_at = datetime.utcnow()
    ts.rejected_by_id = current_user.id
    ts.updated_at = datetime.utcnow()

    # Send-back mechanic: Return estimate status to DRAFT and unlock (Requirement 13)
    estimate.ts_status = "REJECTED"
    estimate.status = "DRAFT"
    estimate.is_ts_locked = False
    estimate.updated_at = datetime.utcnow()

    # Update associated ApprovalTask if present
    task = db.query(ApprovalTask).filter(
        ApprovalTask.entity_type == "TECHNICAL_SANCTION",
        ApprovalTask.entity_id == ts.id
    ).first()
    if task:
        task.status = "rejected"

    # Audit Log
    audit = AuditLog(
        user_id=current_user.id,
        action="REJECT_TECHNICAL_SANCTION",
        entity_type="TechnicalSanction",
        entity_id=ts.id,
        payload=f"EE Rejected Technical Sanction for Estimate #{estimate.estimate_number}. Reason: {reason_str}"
    )
    db.add(audit)

    # Notify requester
    notif = Notification(
        user_id=ts.submitted_by_id,
        title="Technical Sanction Rejected",
        message=f"Technical Sanction for Detailed Estimate #{estimate.estimate_number} was REJECTED by {current_user.full_name}. Reason: {reason_str}",
        notification_type="warning",
        entity_type="TechnicalSanction",
        entity_id=ts.id
    )
    db.add(notif)

    db.commit()
    db.refresh(ts)
    return build_ts_response(ts, db)
