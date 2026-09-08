from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app import models, schemas
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/project-teams", tags=["Project Teams"])


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


@router.get("/project/{project_id}")
def get_project_team(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Fetch all team members for a given project along with summary stats.
    """
    # Verify project existence
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    members = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.project_id == project_id,
        models.ProjectTeamMember.is_active == True
    ).order_by(models.ProjectTeamMember.id.asc()).all()

    response_members = []
    total_members = len(members)
    active_members = 0
    project_managers = 0
    execution_members = 0

    for m in members:
        user = db.query(models.User).filter(models.User.id == m.user_id).first()
        
        # Count active task assignments for this member on this project
        task_count = db.query(models.TaskAssignment).filter(
            models.TaskAssignment.project_id == project_id,
            models.TaskAssignment.assigned_user_id == m.user_id,
            models.TaskAssignment.is_active == True
        ).count()

        if m.status == "ACTIVE":
            active_members += 1
            
            # Count roles for summary
            role_upper = (m.project_role or "").upper()
            if "MANAGER" in role_upper or "SPONSOR" in role_upper:
                project_managers += 1
            if any(k in role_upper for k in ["ENGINEER", "SUPERVISOR", "EXECUTION", "QA", "QC", "HSE", "PROCUREMENT"]):
                execution_members += 1

        member_dict = {
            "id": m.id,
            "project_id": m.project_id,
            "user_id": m.user_id,
            "project_role": m.project_role,
            "department": m.department,
            "responsibility": m.responsibility,
            "joining_date": m.joining_date,
            "status": m.status,
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
        "project_managers": project_managers,
        "execution_members": execution_members
    }

    return {
        "summary": summary,
        "members": response_members
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

    # Fetch assigned tasks for this member on this project
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

    # Fetch audit logs
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
        "project_role": member.project_role,
        "department": member.department,
        "responsibility": member.responsibility,
        "joining_date": member.joining_date,
        "status": member.status,
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
    Add a team member to a project.
    Validates:
    - Project exists
    - User exists and is internal (not customer)
    - Prevents duplicate ACTIVE membership for same project + user
    - Enforces valid project role
    """
    # 1. Check Project
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Target project does not exist")

    # 2. Check User eligibility
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Selected user does not exist")
    if user.role == "customer":
        raise HTTPException(
            status_code=400,
            detail="Customer accounts cannot be added as internal project team members."
        )

    # 3. Check Duplicate Active Membership
    existing = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.project_id == payload.project_id,
        models.ProjectTeamMember.user_id == payload.user_id,
        models.ProjectTeamMember.status == "ACTIVE",
        models.ProjectTeamMember.is_active == True
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"User '{user.full_name}' is already an ACTIVE team member of project '{project.name}'."
        )

    if not payload.project_role or not payload.project_role.strip():
        raise HTTPException(status_code=400, detail="Project role is required")

    # Create team member
    member = models.ProjectTeamMember(
        project_id=payload.project_id,
        user_id=payload.user_id,
        project_role=payload.project_role.strip().upper(),
        department=payload.department.strip() if payload.department else None,
        responsibility=payload.responsibility.strip() if payload.responsibility else None,
        joining_date=payload.joining_date,
        status=payload.status or "ACTIVE",
        remarks=payload.remarks,
        created_by_id=current_user.id
    )

    db.add(member)
    db.commit()
    db.refresh(member)

    # Create Audit Log
    audit = models.ProjectTeamAudit(
        team_member_id=member.id,
        action="ADDED",
        changed_by_user_id=current_user.id,
        remarks=f"Added {user.full_name} to project team as {member.project_role}"
    )
    db.add(audit)
    db.commit()

    return get_team_member_detail(member.id, db, current_user)


@router.put("/{member_id}")
def update_project_team_member(
    member_id: int,
    payload: schemas.ProjectTeamMemberUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Update project role, department, responsibility, joining date, status, or remarks.
    """
    member = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.id == member_id,
        models.ProjectTeamMember.is_active == True
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Project team member not found")

    if payload.project_role is not None:
        member.project_role = payload.project_role.strip().upper()
    if payload.department is not None:
        member.department = payload.department.strip() if payload.department else None
    if payload.responsibility is not None:
        member.responsibility = payload.responsibility.strip() if payload.responsibility else None
    if payload.joining_date is not None:
        member.joining_date = payload.joining_date
    if payload.status is not None:
        member.status = payload.status
    if payload.remarks is not None:
        member.remarks = payload.remarks

    member.updated_at = datetime.utcnow()
    db.commit()

    # Audit log
    audit = models.ProjectTeamAudit(
        team_member_id=member.id,
        action="UPDATED",
        changed_by_user_id=current_user.id,
        remarks=f"Updated details for team member #{member.id}"
    )
    db.add(audit)
    db.commit()

    return get_team_member_detail(member.id, db, current_user)


@router.post("/{member_id}/toggle-status")
def toggle_member_status(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Toggle team member status between ACTIVE and INACTIVE.
    """
    member = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.id == member_id,
        models.ProjectTeamMember.is_active == True
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Project team member not found")

    new_status = "INACTIVE" if member.status == "ACTIVE" else "ACTIVE"
    
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
                detail="User is already active under another project team membership record for this project."
            )

    member.status = new_status
    member.updated_at = datetime.utcnow()
    db.commit()

    # Audit log
    action_str = "DEACTIVATED" if new_status == "INACTIVE" else "ACTIVATED"
    audit = models.ProjectTeamAudit(
        team_member_id=member.id,
        action=action_str,
        changed_by_user_id=current_user.id,
        remarks=f"Changed member status to {new_status}"
    )
    db.add(audit)
    db.commit()

    return get_team_member_detail(member.id, db, current_user)


@router.delete("/{member_id}")
def remove_team_member(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Soft-remove a team member from the project.
    """
    member = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.id == member_id,
        models.ProjectTeamMember.is_active == True
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Project team member not found")

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

    return {"detail": "Team member removed successfully", "id": member_id}
