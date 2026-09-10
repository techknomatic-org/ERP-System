from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional
from datetime import datetime, date, timedelta

from app.database import get_db
from app import models, schemas
from app.api.auth import get_current_user
from app.api.audit import record_audit_log

router = APIRouter(prefix="/api/project-teams", tags=["Project Teams (WPT-04)"])

EXACT_PROJECT_ROLES = [
    "Contractor PM",
    "JE",
    "AE",
    "EE",
    "Divisional Accountant",
    "Tenant Admin"
]

GOVERNMENT_ROLES = ["JE", "AE", "EE", "Divisional Accountant"]

ROLE_CANONICAL_MAP = {
    "contractor pm": "Contractor PM",
    "contractor_pm": "Contractor PM",
    "je": "JE",
    "junior engineer": "JE",
    "ae": "AE",
    "assistant engineer": "AE",
    "ee": "EE",
    "executive engineer": "EE",
    "divisional accountant": "Divisional Accountant",
    "divisional_accountant": "Divisional Accountant",
    "tenant admin": "Tenant Admin",
    "tenant_admin": "Tenant Admin",
    # Legacy fallbacks:
    "project manager": "Contractor PM",
    "site engineer": "JE",
    "finance": "Divisional Accountant",
    "admin": "Tenant Admin"
}


def normalize_project_role(role_raw: Optional[str]) -> str:
    if not role_raw or not role_raw.strip():
        return ""
    key = role_raw.strip().lower()
    return ROLE_CANONICAL_MAP.get(key, role_raw.strip())


def get_user_pending_approvals_for_project(user_id: int, project_id: int, db: Session) -> list:
    """
    Checks whether a user currently has pending approval actions assigned on the specified project.
    Inspects:
    1. TechnicalSanctions where sanctioning_authority_user_id == user_id and status == 'PENDING_APPROVAL'.
    2. ApprovalTasks where status == 'pending' linked to this project and where the current_stage matches
       the user's project role on this project.
    """
    affected_items = []
    prj = db.query(models.Project).filter(models.Project.id == project_id).first()
    prj_name = prj.name if prj else f"Project #{project_id}"

    # 1. TechnicalSanction where user is the sanctioning authority
    ts_list = db.query(models.TechnicalSanction).filter(
        models.TechnicalSanction.project_id == project_id,
        models.TechnicalSanction.sanctioning_authority_user_id == user_id,
        models.TechnicalSanction.status == "PENDING_APPROVAL"
    ).all()
    for ts in ts_list:
        affected_items.append({
            "request_id": ts.id,
            "reference_id": ts.sanction_reference_number or f"TS-{ts.id}",
            "type": "TechnicalSanction",
            "title": f"Technical Sanction (Estimate #{ts.detailed_estimate_id})",
            "request_type": "TECHNICAL_SANCTION",
            "request_category": "FINANCIAL",
            "category": "FINANCIAL",
            "amount": float(ts.estimate_total_at_submission or 0.0),
            "project_id": project_id,
            "project_name": prj_name,
            "current_stage": "Executive Engineer",
            "status": "PENDING_APPROVAL",
            "submitted_date": ts.submitted_at.isoformat() if ts.submitted_at else None,
            "submission_date": ts.submitted_at.isoformat() if ts.submitted_at else None
        })

    # 2. Check user's project-team role on this project
    member = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.project_id == project_id,
        models.ProjectTeamMember.user_id == user_id,
        models.ProjectTeamMember.status == "ACTIVE",
        models.ProjectTeamMember.is_active == True
    ).first()

    if member:
        role_norm = normalize_project_role(member.project_role)
        stages_for_role = []
        if role_norm == "Contractor PM":
            stages_for_role.extend(["Project Manager", "Contractor PM"])
        elif role_norm == "EE":
            stages_for_role.extend(["Executive Engineer", "EE"])
        elif role_norm in ["JE", "AE"]:
            stages_for_role.extend(["Site Engineer", "JE", "AE"])
        elif role_norm == "Divisional Accountant":
            stages_for_role.extend(["Finance", "Divisional Accountant"])
        elif role_norm == "Tenant Admin":
            stages_for_role.extend(["Management", "Tenant Admin"])

        if stages_for_role:
            pending_tasks = db.query(models.ApprovalTask).filter(
                models.ApprovalTask.status == "pending",
                models.ApprovalTask.current_stage.in_(stages_for_role)
            ).all()

            for task in pending_tasks:
                task_proj_id = None
                if task.entity_type in ["SiteLog", "SiteDailyLog", "SITE_LOG", "SITE_DAILY_LOG"]:
                    log_rec = db.query(models.SiteDailyLog).filter(models.SiteDailyLog.id == task.entity_id).first()
                    if log_rec: task_proj_id = log_rec.project_id
                elif task.entity_type in ["ContractorBill", "CONTRACTOR_BILL", "CONTRACTOR_BILL_PAYMENT"]:
                    b_rec = db.query(models.ContractorBill).filter(models.ContractorBill.id == task.entity_id).first()
                    if b_rec: task_proj_id = b_rec.project_id
                elif task.entity_type in ["PR", "PurchaseRequisition", "PURCHASE_REQUEST", "MATERIAL_PURCHASE_REQUEST"]:
                    pr_rec = db.query(models.PurchaseRequisition).filter(models.PurchaseRequisition.id == task.entity_id).first()
                    if pr_rec: task_proj_id = pr_rec.project_id
                elif task.entity_type in ["ContractorAward", "CONTRACTOR_AWARD"]:
                    aw_rec = db.query(models.ContractorAward).filter(models.ContractorAward.id == task.entity_id).first()
                    if aw_rec: task_proj_id = aw_rec.project_id
                elif task.entity_type in ["TECHNICAL_SANCTION", "TechnicalSanction"]:
                    ts_rec = db.query(models.TechnicalSanction).filter(models.TechnicalSanction.id == task.entity_id).first()
                    if ts_rec: task_proj_id = ts_rec.project_id

                if task_proj_id == project_id:
                    affected_items.append({
                        "request_id": task.id,
                        "reference_id": f"APP-{task.id}",
                        "type": task.request_type or task.entity_type,
                        "title": task.title,
                        "request_type": task.request_type or task.entity_type,
                        "request_category": task.request_category or "NON_FINANCIAL",
                        "category": task.request_category or "NON_FINANCIAL",
                        "project_id": project_id,
                        "project_name": prj_name,
                        "current_stage": task.current_stage,
                        "status": task.status,
                        "submitted_date": task.created_at.isoformat() if task.created_at else None,
                        "submission_date": task.created_at.isoformat() if task.created_at else None
                    })

    return affected_items


def compute_access_status(member: models.ProjectTeamMember, project: models.Project) -> str:
    """
    Computes effective project access status based on project state and date window.
    """
    today = date.today()
    if (project.status or "").upper() in ["CLOSED", "COMPLETED"]:
        return "REVOKED / INACTIVE"
    if member.status != "ACTIVE" or not member.is_active:
        return "INACTIVE"
    if member.effective_from and today < member.effective_from:
        return "NOT YET ACTIVE"
    if member.effective_to and today > member.effective_to:
        return "EXPIRED"
    return "ACTIVE"


def verify_project_access_authorization(
    user: models.User,
    project_id: int,
    db: Session,
    required_role: Optional[str] = None
) -> models.Project:
    """
    Server-side project access validation for project-team-controlled roles.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Global admin / management pass with tenant validation
    user_role = (user.role or "").lower()
    if user_role in ["admin", "management"]:
        return project

    # Check project closure state
    if (project.status or "").upper() in ["CLOSED", "COMPLETED"]:
        raise HTTPException(
            status_code=403,
            detail="Access revoked: Project has been closed or completed."
        )

    # Check active team membership within effective date window
    today = date.today()
    member = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.project_id == project_id,
        models.ProjectTeamMember.user_id == user.id,
        models.ProjectTeamMember.is_active == True,
        models.ProjectTeamMember.status == "ACTIVE"
    ).first()

    if not member:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: User '{user.full_name}' is not an active team member of project '{project.name}'."
        )

    if member.effective_from and today < member.effective_from:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: Assignment has not started yet (Effective From: {member.effective_from})."
        )

    if member.effective_to and today > member.effective_to:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: Assignment expired on {member.effective_to}."
        )

    if required_role:
        norm_req = normalize_project_role(required_role)
        norm_actual = normalize_project_role(member.project_role)
        if norm_actual != norm_req:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: Requires project role '{norm_req}', but current assignment is '{norm_actual}'."
            )

    return project


# ----------------------------------------------------
# ENDPOINTS
# ----------------------------------------------------

@router.get("/eligible-users", response_model=List[dict])
def get_eligible_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get list of existing authenticated application users eligible for project team membership.
    Excludes external customer accounts.
    """
    users = db.query(models.User).filter(
        models.User.is_active == True,
        models.User.role != "customer"
    ).all()
    
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "username": u.username,
            "email": u.email,
            "role": u.role
        }
        for u in users
    ]


@router.get("/search-users")
def search_users(
    query: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Search existing global user identity by name/email across tenants.
    If email/user is not found, returns unregistered indicator for invite workflow.
    """
    q_str = query.strip()
    users = db.query(models.User).filter(
        models.User.is_active == True,
        models.User.role != "customer",
        or_(
            func.lower(models.User.email) == q_str.lower(),
            func.lower(models.User.email).like(f"%{q_str.lower()}%"),
            func.lower(models.User.full_name).like(f"%{q_str.lower()}%"),
            func.lower(models.User.username).like(f"%{q_str.lower()}%")
        )
    ).all()

    if users:
        return {
            "found": True,
            "users": [
                {
                    "id": u.id,
                    "full_name": u.full_name,
                    "username": u.username,
                    "email": u.email,
                    "role": u.role,
                    "is_existing_identity": True
                }
                for u in users
            ]
        }
    else:
        return {
            "found": False,
            "users": [],
            "message": "User not registered — invite"
        }


@router.post("/invite", status_code=status.HTTP_201_CREATED)
def invite_user_to_project(
    payload: schemas.ProjectTeamInvitationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Cross-tenant and unregistered email invitation workflow.
    - If email exists in global User table, link existing user without duplication.
    - If email is not registered, create ProjectTeamInvitation record without creating fake user.
    """
    # Authorization
    if current_user.role == "customer":
        raise HTTPException(status_code=403, detail="Customer accounts cannot invite team members.")

    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Target project does not exist")

    email_clean = payload.email.strip().lower()
    if not email_clean:
        raise HTTPException(status_code=400, detail="Email is required for invitation.")

    # Validation: Role is required
    if not payload.project_role or not payload.project_role.strip():
        raise HTTPException(status_code=400, detail="Role is required.")

    # Validation: Effective From
    effective_from = payload.effective_from or date.today()
    if payload.effective_to and payload.effective_to < effective_from:
        raise HTTPException(status_code=400, detail="Effective To cannot be before Effective From.")

    # Check if global User already exists
    existing_user = db.query(models.User).filter(func.lower(models.User.email) == email_clean).first()
    if existing_user:
        # Check duplicate assignment
        dup = db.query(models.ProjectTeamMember).filter(
            models.ProjectTeamMember.project_id == payload.project_id,
            models.ProjectTeamMember.user_id == existing_user.id,
            models.ProjectTeamMember.status == "ACTIVE",
            models.ProjectTeamMember.is_active == True
        ).first()
        if dup:
            raise HTTPException(status_code=400, detail="User already has a project-team role on this project.")

        # Link existing global identity
        member = models.ProjectTeamMember(
            project_id=payload.project_id,
            user_id=existing_user.id,
            project_role=normalize_project_role(payload.project_role),
            effective_from=effective_from,
            effective_to=payload.effective_to,
            joining_date=effective_from,
            status="ACTIVE",
            created_by_id=current_user.id
        )
        db.add(member)
        db.commit()
        db.refresh(member)

        # Audit
        record_audit_log(
            db=db,
            user_id=current_user.id,
            action="LINK_GLOBAL_IDENTITY",
            entity_type="ProjectTeamMember",
            entity_id=member.id,
            payload=f"Linked existing global identity '{existing_user.email}' to Project '{project.name}' as '{member.project_role}'."
        )

        return {
            "message": "Existing global identity linked to project team successfully.",
            "team_member_id": member.id,
            "user_id": existing_user.id,
            "is_existing_identity": True
        }

    # Email not registered -> Create invitation without creating fake user
    invitation = models.ProjectTeamInvitation(
        project_id=payload.project_id,
        email=email_clean,
        project_role=normalize_project_role(payload.project_role),
        effective_from=effective_from,
        effective_to=payload.effective_to,
        status="PENDING",
        token=f"inv-{datetime.utcnow().timestamp()}",
        invited_by_id=current_user.id
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action="INVITATION_INITIATED",
        entity_type="ProjectTeamInvitation",
        entity_id=invitation.id,
        payload=f"Initiated project invitation for '{email_clean}' as '{invitation.project_role}' on Project '{project.name}'."
    )

    return {
        "message": "Project invitation initiated successfully.",
        "invitation_id": invitation.id,
        "email": invitation.email,
        "project_role": invitation.project_role,
        "is_existing_identity": False
    }


@router.get("/project/{project_id}")
def get_project_team(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Fetch all team members for a given project along with summary metrics and access statuses.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Security: Customer accounts cannot view internal project team
    if current_user.role == "customer":
        raise HTTPException(status_code=403, detail="Customer users are not authorized to view internal project teams.")

    members = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.project_id == project_id,
        models.ProjectTeamMember.is_active == True
    ).order_by(models.ProjectTeamMember.id.asc()).all()

    today = date.today()
    response_members = []
    total_members = len(members)
    active_members = 0
    government_roles = 0
    expiring_assignments = 0
    has_contractor_pm = False
    has_ee = False

    is_proj_closed = (project.status or "").upper() in ["CLOSED", "COMPLETED"]

    for m in members:
        user = db.query(models.User).filter(models.User.id == m.user_id).first()
        access_st = compute_access_status(m, project)

        if access_st == "ACTIVE":
            active_members += 1

        norm_role = normalize_project_role(m.project_role)
        if norm_role in GOVERNMENT_ROLES:
            government_roles += 1

        if m.effective_to and m.effective_to >= today and m.effective_to <= (today + timedelta(days=30)):
            expiring_assignments += 1

        # Check Contractor PM and EE gate validity based strictly on PROJECT-TEAM ASSIGNMENT:
        # project_team_member.project_id = selected project
        # AND project_role = "Contractor PM" / "EE"
        # AND assignment is valid for current date (effective_from <= today <= effective_to or effective_to is None)
        # AND assignment status is active (m.status == "ACTIVE" and m.is_active == True)
        # AND project is not closed
        is_date_valid = (
            (m.effective_from is None or m.effective_from <= today) and
            (m.effective_to is None or m.effective_to >= today)
        )
        is_assignment_active = (m.status == "ACTIVE" and m.is_active == True)

        if not is_proj_closed and is_assignment_active and is_date_valid:
            if norm_role == "Contractor PM":
                has_contractor_pm = True
            elif norm_role == "EE":
                has_ee = True

        task_count = db.query(models.TaskAssignment).filter(
            models.TaskAssignment.project_id == project_id,
            models.TaskAssignment.assigned_user_id == m.user_id,
            models.TaskAssignment.is_active == True
        ).count()

        member_dict = {
            "id": m.id,
            "project_id": m.project_id,
            "user_id": m.user_id,
            "project_role": norm_role,
            "department": m.department,
            "responsibility": m.responsibility,
            "joining_date": m.joining_date,
            "effective_from": m.effective_from or m.joining_date or today,
            "effective_to": m.effective_to,
            "status": m.status,
            "access_status": access_st,
            "remarks": m.remarks,
            "is_active": m.is_active,
            "created_by_id": m.created_by_id,
            "created_at": m.created_at,
            "updated_at": m.updated_at,
            "user_name": user.full_name if user else f"User #{m.user_id}",
            "user_email": user.email if user else "",
            "user_app_role": user.role if user else "employee",
            "project_name": project.name,
            "project_code": project.code,
            "task_assignment_count": task_count,
            "assigned_tasks": [],
            "audits": []
        }
        response_members.append(member_dict)

    summary = {
        "total_members": total_members,
        "active_members": active_members,
        "effective_active_members": active_members,
        "government_roles": government_roles,
        "expiring_assignments": expiring_assignments,
        "has_contractor_pm": has_contractor_pm,
        "has_ee": has_ee,
        "is_draft_gate_ready": has_contractor_pm and has_ee and not is_proj_closed
    }

    return {
        "summary": summary,
        "members": response_members
    }


@router.get("/members/{member_id}/pending-approvals")
def get_member_pending_approvals(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Check and list pending approval tasks for a project team member.
    """
    member = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.id == member_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Project team member not found")

    items = get_user_pending_approvals_for_project(member.user_id, member.project_id, db)
    return {
        "has_pending": len(items) > 0,
        "count": len(items),
        "affected_items": items
    }


@router.post("/reassign-approvals")
def reassign_project_approvals(
    payload: schemas.ReassignApprovalRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Explicitly reassign pending approvals from one team member to another on the same project.
    """
    if current_user.role == "customer":
        raise HTTPException(status_code=403, detail="Customer accounts cannot reassign approvals.")

    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from_user = db.query(models.User).filter(models.User.id == payload.from_user_id).first()
    to_user = db.query(models.User).filter(models.User.id == payload.to_user_id).first()
    if not from_user or not to_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Target user must be active on this project
    to_member = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.project_id == payload.project_id,
        models.ProjectTeamMember.user_id == to_user.id,
        models.ProjectTeamMember.status == "ACTIVE",
        models.ProjectTeamMember.is_active == True
    ).first()
    if not to_member:
        raise HTTPException(
            status_code=400,
            detail=f"Target user '{to_user.full_name}' is not an active team member of project '{project.name}'."
        )

    # 1. Reassign TechnicalSanctions
    reassigned_count = 0
    ts_list = db.query(models.TechnicalSanction).filter(
        models.TechnicalSanction.project_id == payload.project_id,
        models.TechnicalSanction.sanctioning_authority_user_id == from_user.id,
        models.TechnicalSanction.status == "PENDING_APPROVAL"
    ).all()
    for ts in ts_list:
        ts.sanctioning_authority_user_id = to_user.id
        ts.updated_at = datetime.utcnow()
        reassigned_count += 1

    # 2. Reassign TaskAssignments
    task_assigns = db.query(models.TaskAssignment).filter(
        models.TaskAssignment.project_id == payload.project_id,
        models.TaskAssignment.assigned_user_id == from_user.id,
        models.TaskAssignment.is_active == True
    ).all()
    for ta in task_assigns:
        ta.assigned_user_id = to_user.id
        ta.updated_at = datetime.utcnow()
        # Add audit
        ta_audit = models.TaskAssignmentAudit(
            assignment_id=ta.id,
            action="REASSIGNED",
            previous_user_id=from_user.id,
            new_user_id=to_user.id,
            changed_by_user_id=current_user.id,
            remarks=payload.remarks or f"Reassigned from {from_user.full_name} to {to_user.full_name}"
        )
        db.add(ta_audit)
        reassigned_count += 1

    db.commit()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action="REASSIGN_APPROVALS",
        entity_type="Project",
        entity_id=project.id,
        payload=f"Reassigned {reassigned_count} pending approval(s)/task(s) from '{from_user.full_name}' to '{to_user.full_name}' on Project '{project.name}'."
    )

    return {
        "message": f"Successfully reassigned {reassigned_count} item(s) from {from_user.full_name} to {to_user.full_name}.",
        "reassigned_count": reassigned_count
    }


@router.get("/{member_id}")
def get_team_member_detail(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get single project team member details including task assignments and audit logs.
    """
    member = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.id == member_id,
        models.ProjectTeamMember.is_active == True
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Project team member not found")

    project = db.query(models.Project).filter(models.Project.id == member.project_id).first()
    user = db.query(models.User).filter(models.User.id == member.user_id).first()

    today = date.today()
    access_st = compute_access_status(member, project)

    task_assignments = db.query(models.TaskAssignment).filter(
        models.TaskAssignment.project_id == member.project_id,
        models.TaskAssignment.assigned_user_id == member.user_id,
        models.TaskAssignment.is_active == True
    ).order_by(models.TaskAssignment.created_at.desc()).all()

    formatted_tasks = []
    for t in task_assignments:
        phase = db.query(models.WbsTask).filter(models.WbsTask.id == t.wbs_phase_id).first()
        task = db.query(models.WbsTask).filter(models.WbsTask.id == t.task_id).first()
        subtask = db.query(models.WbsTask).filter(models.WbsTask.id == t.subtask_id).first() if t.subtask_id else None

        formatted_tasks.append({
            "id": t.id,
            "assignment_ref": t.assignment_ref,
            "project_id": t.project_id,
            "wbs_phase_id": t.wbs_phase_id,
            "task_id": t.task_id,
            "subtask_id": t.subtask_id,
            "assigned_user_id": t.assigned_user_id,
            "role": t.role,
            "priority": t.priority,
            "start_date": t.start_date,
            "due_date": t.due_date,
            "status": t.status,
            "remarks": t.remarks,
            "is_active": t.is_active,
            "created_by_id": t.created_by_id,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
            "project_name": project.name if project else "",
            "project_code": project.code if project else "",
            "phase_name": phase.title if phase else "",
            "task_name": task.title if task else "",
            "subtask_name": subtask.title if subtask else None,
            "assigned_user_name": user.full_name if user else ""
        })

    audits = db.query(models.ProjectTeamAudit).filter(
        models.ProjectTeamAudit.team_member_id == member.id
    ).order_by(models.ProjectTeamAudit.created_at.desc()).all()

    formatted_audits = []
    for a in audits:
        ch_user = db.query(models.User).filter(models.User.id == a.changed_by_user_id).first() if a.changed_by_user_id else None
        formatted_audits.append({
            "id": a.id,
            "team_member_id": a.team_member_id,
            "action": a.action,
            "changed_by_user_id": a.changed_by_user_id,
            "changed_by_user_name": ch_user.full_name if ch_user else "System",
            "remarks": a.remarks,
            "created_at": a.created_at
        })

    return {
        "id": member.id,
        "project_id": member.project_id,
        "user_id": member.user_id,
        "project_role": normalize_project_role(member.project_role),
        "department": member.department,
        "responsibility": member.responsibility,
        "joining_date": member.joining_date,
        "effective_from": member.effective_from or member.joining_date or today,
        "effective_to": member.effective_to,
        "status": member.status,
        "access_status": access_st,
        "remarks": member.remarks,
        "is_active": member.is_active,
        "created_by_id": member.created_by_id,
        "created_at": member.created_at,
        "updated_at": member.updated_at,
        "user_name": user.full_name if user else f"User #{member.user_id}",
        "user_email": user.email if user else "",
        "user_app_role": user.role if user else "employee",
        "project_name": project.name if project else "",
        "project_code": project.code if project else "",
        "task_assignment_count": len(formatted_tasks),
        "assigned_tasks": formatted_tasks,
        "audits": formatted_audits
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project_team_member(
    payload: schemas.ProjectTeamMemberCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Add a team member to a project with exact WPT-04 validation:
    - Role is required.
    - User is required.
    - Effective From is required.
    - Effective To cannot be before Effective From.
    - User already has a project-team role on this project.
    """
    # 1. RBAC authorization
    if current_user.role == "customer":
        raise HTTPException(status_code=403, detail="Customer accounts are not authorized to manage project teams.")

    # 2. Validation: User is required
    if not payload.user_id:
        raise HTTPException(status_code=400, detail="User is required.")

    # 3. Validation: Role is required
    if not payload.project_role or not payload.project_role.strip():
        raise HTTPException(status_code=400, detail="Role is required.")

    norm_role = normalize_project_role(payload.project_role)

    # 4. Check Project exists
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Target project does not exist")

    # 5. Check User exists and is internal
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Selected user does not exist")
    if user.role == "customer":
        raise HTTPException(
            status_code=400,
            detail="Customer accounts cannot be added as internal project team members."
        )

    # 6. Validation: Effective From is required
    effective_from = payload.effective_from or payload.joining_date
    if not effective_from:
        raise HTTPException(status_code=400, detail="Effective From is required.")

    # 7. Validation: Effective To cannot be before Effective From
    if payload.effective_to and payload.effective_to < effective_from:
        raise HTTPException(status_code=400, detail="Effective To cannot be before Effective From.")

    # 8. Unique Business Constraint: One active project-team role on the same project
    existing = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.project_id == payload.project_id,
        models.ProjectTeamMember.user_id == payload.user_id,
        models.ProjectTeamMember.status == "ACTIVE",
        models.ProjectTeamMember.is_active == True
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="User already has a project-team role on this project."
        )

    # 9. Create Project Team Member
    member = models.ProjectTeamMember(
        project_id=payload.project_id,
        user_id=payload.user_id,
        project_role=norm_role,
        department=payload.department.strip() if payload.department else None,
        responsibility=payload.responsibility.strip() if payload.responsibility else None,
        joining_date=effective_from,
        effective_from=effective_from,
        effective_to=payload.effective_to,
        status=payload.status or "ACTIVE",
        remarks=payload.remarks,
        is_active=True,
        created_by_id=current_user.id
    )

    db.add(member)
    db.commit()
    db.refresh(member)

    # 10. Audit Log
    audit = models.ProjectTeamAudit(
        team_member_id=member.id,
        action="ADDED",
        changed_by_user_id=current_user.id,
        remarks=f"Added {user.full_name} ({user.email}) to project team as {member.project_role}. Effective From: {effective_from}, Effective To: {member.effective_to or 'Indefinite'}."
    )
    db.add(audit)
    db.commit()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action="CREATE_PROJECT_TEAM_MEMBER",
        entity_type="ProjectTeamMember",
        entity_id=member.id,
        payload=f"Added {user.full_name} to Project '{project.name}' as '{member.project_role}'. Effective: {effective_from} to {member.effective_to or 'Indefinite'}."
    )

    return get_team_member_detail(member.id, db, current_user)


@router.put("/{member_id}")
def update_project_team_member(
    member_id: int,
    payload: schemas.ProjectTeamMemberUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Update project role, effective dates, department, responsibility, status, or remarks.
    """
    if current_user.role == "customer":
        raise HTTPException(status_code=403, detail="Customer accounts cannot update project teams.")

    member = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.id == member_id,
        models.ProjectTeamMember.is_active == True
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Project team member not found")

    # Date validation
    eff_from = payload.effective_from or member.effective_from or member.joining_date or date.today()
    eff_to = payload.effective_to if payload.effective_to is not None else member.effective_to

    if eff_to and eff_to < eff_from:
        raise HTTPException(status_code=400, detail="Effective To cannot be before Effective From.")

    role_changed = False
    dates_changed = False
    old_role = member.project_role

    if payload.project_role is not None:
        if not payload.project_role.strip():
            raise HTTPException(status_code=400, detail="Role is required.")
        new_role = normalize_project_role(payload.project_role)
        if new_role != member.project_role:
            member.project_role = new_role
            role_changed = True

    if payload.effective_from is not None:
        member.effective_from = payload.effective_from
        member.joining_date = payload.effective_from
        dates_changed = True

    if payload.effective_to is not None:
        member.effective_to = payload.effective_to
        dates_changed = True

    if payload.department is not None:
        member.department = payload.department.strip() if payload.department else None
    if payload.responsibility is not None:
        member.responsibility = payload.responsibility.strip() if payload.responsibility else None
    if payload.joining_date is not None and payload.effective_from is None:
        member.joining_date = payload.joining_date
        member.effective_from = payload.joining_date
    if payload.status is not None:
        member.status = payload.status
    if payload.remarks is not None:
        member.remarks = payload.remarks

    member.updated_at = datetime.utcnow()
    db.commit()

    # Audit logging
    actions = []
    if role_changed: actions.append(f"role changed from {old_role} to {member.project_role}")
    if dates_changed: actions.append(f"effective dates updated ({member.effective_from} to {member.effective_to or 'Indefinite'})")
    remarks_str = f"Updated team member #{member.id}: {', '.join(actions) if actions else 'general details'}"

    audit = models.ProjectTeamAudit(
        team_member_id=member.id,
        action="UPDATED",
        changed_by_user_id=current_user.id,
        remarks=remarks_str
    )
    db.add(audit)
    db.commit()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action="UPDATE_PROJECT_TEAM_MEMBER",
        entity_type="ProjectTeamMember",
        entity_id=member.id,
        payload=remarks_str
    )

    return get_team_member_detail(member.id, db, current_user)


@router.post("/{member_id}/toggle-status")
def toggle_member_status(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Toggle team member status between ACTIVE and INACTIVE.
    If deactivating, blocks if member has pending approvals for this project.
    """
    if current_user.role == "customer":
        raise HTTPException(status_code=403, detail="Customer accounts cannot modify team member status.")

    member = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.id == member_id,
        models.ProjectTeamMember.is_active == True
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Project team member not found")

    new_status = "INACTIVE" if member.status == "ACTIVE" else "ACTIVE"
    
    # If deactivating, check pending approvals
    if new_status == "INACTIVE":
        pending_approvals = get_user_pending_approvals_for_project(member.user_id, member.project_id, db)
        if pending_approvals:
            items_desc = ", ".join([f"#{it['request_id']} {it['title']} ({it['current_stage']})" for it in pending_approvals])
            raise HTTPException(
                status_code=400,
                detail=f"Reassign pending approvals first: {items_desc}"
            )

    # If reactivating, check duplicate active membership
    if new_status == "ACTIVE":
        duplicate = db.query(models.ProjectTeamMember).filter(
            models.ProjectTeamMember.project_id == member.project_id,
            models.ProjectTeamMember.user_id == member.user_id,
            models.ProjectTeamMember.status == "ACTIVE",
            models.ProjectTeamMember.is_active == True,
            models.ProjectTeamMember.id != member.id
        ).first()

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="User already has a project-team role on this project."
            )

    member.status = new_status
    member.updated_at = datetime.utcnow()
    db.commit()

    action_str = "DEACTIVATED" if new_status == "INACTIVE" else "ACTIVATED"
    audit = models.ProjectTeamAudit(
        team_member_id=member.id,
        action=action_str,
        changed_by_user_id=current_user.id,
        remarks=f"Changed member status to {new_status}"
    )
    db.add(audit)
    db.commit()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action=f"{action_str}_PROJECT_TEAM_MEMBER",
        entity_type="ProjectTeamMember",
        entity_id=member.id,
        payload=f"Changed member #{member.id} status to {new_status}"
    )

    return get_team_member_detail(member.id, db, current_user)


@router.delete("/{member_id}")
def remove_team_member(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Remove / deactivate a team member from the project.
    If user has pending approvals on this project, blocks with exact message:
    "Reassign pending approvals first"
    """
    if current_user.role == "customer":
        raise HTTPException(status_code=403, detail="Customer accounts cannot remove project team members.")

    member = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.id == member_id,
        models.ProjectTeamMember.is_active == True
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Project team member not found")

    # Check pending approvals
    pending_approvals = get_user_pending_approvals_for_project(member.user_id, member.project_id, db)
    if pending_approvals:
        items_desc = ", ".join([f"#{it['request_id']} {it['title']} ({it['current_stage']})" for it in pending_approvals])
        raise HTTPException(
            status_code=400,
            detail=f"Reassign pending approvals first: {items_desc}"
        )

    member.is_active = False
    member.status = "INACTIVE"
    member.updated_at = datetime.utcnow()
    db.commit()

    audit = models.ProjectTeamAudit(
        team_member_id=member.id,
        action="REMOVED",
        changed_by_user_id=current_user.id,
        remarks="Removed member from project team"
    )
    db.add(audit)
    db.commit()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action="REMOVE_PROJECT_TEAM_MEMBER",
        entity_type="ProjectTeamMember",
        entity_id=member.id,
        payload=f"Removed team member #{member.id} from Project #{member.project_id}"
    )

    return {"detail": "Team member removed successfully", "id": member_id}
