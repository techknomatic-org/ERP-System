from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date

from app.database import get_db
from app.models import TaskAssignment, TaskAssignmentAudit, Project, WbsTask, User, WorkPlan, ProjectTeamMember
from app.schemas import (
    TaskAssignmentCreate, TaskAssignmentUpdate, TaskAssignmentReassign,
    TaskAssignmentResponse, TaskAssignmentAuditResponse, WorkPlanReferenceResponse
)

router = APIRouter(prefix="/api/task-assignments", tags=["Task Assignments"])

INELIGIBLE_ROLES = {"customer"}
ROLE_DISPLAY_MAP = {
    "admin": "System Admin",
    "management": "Executive Management",
    "project_manager": "Project Manager",
    "site_engineer": "Site Engineer",
    "finance": "Finance Lead",
    "procurement": "Procurement Officer",
    "hse": "HSE Safety Manager",
    "qc": "Quality Control Officer",
    "facility_manager": "Facility Manager",
    "customer": "Customer Account"
}



def format_user_role(raw_role: Optional[str]) -> str:
    """Format user role string for professional display."""
    if not raw_role:
        return "Team Member"
    r = raw_role.strip().lower()
    if r in ROLE_DISPLAY_MAP:
        return ROLE_DISPLAY_MAP[r]
    # Return Title Case if custom string passed
    return raw_role.title() if '_' in raw_role else raw_role


def generate_assignment_ref(db: Session) -> str:
    """Generate unique assignment reference: TSK-YYYY-XXX"""
    year = datetime.now().year
    count = db.query(TaskAssignment).count()
    seq = count + 1
    while True:
        ref = f"TSK-{year}-{seq:03d}"
        exists = db.query(TaskAssignment).filter(TaskAssignment.assignment_ref == ref).first()
        if not exists:
            return ref
        seq += 1



def evaluate_assignment_status(start_date: date, due_date: date, current_status: str) -> str:
    """
    Evaluate assignment status based on date bounds.
    Future planned start date MUST NOT be IN PROGRESS; defaults to ASSIGNED.
    Past due date defaults to OVERDUE if not COMPLETED.
    """
    today = date.today()
    if current_status == "COMPLETED":
        return "COMPLETED"
    
    if start_date > today:
        return "ASSIGNED"
    elif due_date < today:
        return "OVERDUE"
    else:
        return current_status if current_status in ["ASSIGNED", "IN PROGRESS"] else "IN PROGRESS"


def build_assignment_response(assignment: TaskAssignment, db: Session) -> TaskAssignmentResponse:
    """Construct full TaskAssignmentResponse with resolved relations, Work Plan ref, and audit log."""
    proj_name = assignment.project.name if assignment.project else None
    proj_code = assignment.project.code if assignment.project else None
    phase_name = assignment.wbs_phase.title if assignment.wbs_phase else None
    task_name = assignment.task.title if assignment.task else None
    subtask_name = assignment.subtask.title if assignment.subtask else None
    assigned_user_name = assignment.assigned_user.full_name if assignment.assigned_user else None
    assigned_user_email = assignment.assigned_user.email if assignment.assigned_user else None
    created_by_name = assignment.created_by.full_name if assignment.created_by else None

    # Work Plan reference search
    wp_ref = None
    target_task_id = assignment.subtask_id or assignment.task_id
    wp = db.query(WorkPlan).filter(
        WorkPlan.project_id == assignment.project_id,
        WorkPlan.task_id == target_task_id,
        WorkPlan.is_archived == False
    ).first()

    if wp:
        wp_ref = WorkPlanReferenceResponse(
            id=wp.id,
            work_plan_number=wp.work_plan_number,
            activity_name=wp.activity_name,
            planned_quantity=float(wp.planned_quantity),
            unit=wp.unit,
            planned_start_date=wp.planned_start_date,
            planned_end_date=wp.planned_end_date,
            progress_percentage=0.0,
            status=wp.status
        )

    # Audits
    audits_res = []
    audits = db.query(TaskAssignmentAudit).filter(
        TaskAssignmentAudit.assignment_id == assignment.id
    ).order_by(TaskAssignmentAudit.id.desc()).all()

    for a in audits:
        prev_user = db.query(User).filter(User.id == a.previous_user_id).first() if a.previous_user_id else None
        new_user = db.query(User).filter(User.id == a.new_user_id).first() if a.new_user_id else None
        chg_user = db.query(User).filter(User.id == a.changed_by_user_id).first() if a.changed_by_user_id else None

        audits_res.append(TaskAssignmentAuditResponse(
            id=a.id,
            assignment_id=a.assignment_id,
            action=a.action,
            previous_user_id=a.previous_user_id,
            previous_user_name=prev_user.full_name if prev_user else None,
            new_user_id=a.new_user_id,
            new_user_name=new_user.full_name if new_user else None,
            changed_by_user_id=a.changed_by_user_id,
            changed_by_user_name=chg_user.full_name if chg_user else None,
            remarks=a.remarks,
            created_at=a.created_at
        ))

    dynamic_status = evaluate_assignment_status(assignment.start_date, assignment.due_date, assignment.status)
    display_role = format_user_role(assignment.role or (assignment.assigned_user.role if assignment.assigned_user else None))

    res = TaskAssignmentResponse(
        id=assignment.id,
        assignment_ref=assignment.assignment_ref,
        project_id=assignment.project_id,
        wbs_phase_id=assignment.wbs_phase_id,
        task_id=assignment.task_id,
        subtask_id=assignment.subtask_id,
        assigned_user_id=assignment.assigned_user_id,
        role=display_role,
        priority=assignment.priority,
        start_date=assignment.start_date,
        due_date=assignment.due_date,
        status=dynamic_status,
        remarks=assignment.remarks,
        is_active=assignment.is_active,
        created_by_id=assignment.created_by_id,
        created_at=assignment.created_at,
        updated_at=assignment.updated_at,
        project_name=proj_name,
        project_code=proj_code,
        phase_name=phase_name,
        task_name=task_name,
        subtask_name=subtask_name,
        assigned_user_name=assigned_user_name,
        assigned_user_email=assigned_user_email,
        created_by_name=created_by_name,
        work_plan_ref=wp_ref,
        audits=audits_res
    )
    return res


@router.get("", response_model=List[TaskAssignmentResponse])
def list_task_assignments(
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    assigned_user_id: Optional[int] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """List all task assignments with filtering and search capabilities."""
    query = db.query(TaskAssignment).filter(TaskAssignment.is_active == True)

    if project_id:
        query = query.filter(TaskAssignment.project_id == project_id)
    if status and status != "ALL":
        query = query.filter(TaskAssignment.status == status)
    if assigned_user_id:
        query = query.filter(TaskAssignment.assigned_user_id == assigned_user_id)
    if priority and priority != "ALL":
        query = query.filter(TaskAssignment.priority == priority)

    assignments = query.order_by(TaskAssignment.created_at.desc()).all()

    if search:
        s = search.lower().strip()
        filtered = []
        for a in assignments:
            p_name = (a.project.name if a.project else '').lower()
            t_name = (a.task.title if a.task else '').lower()
            sub_name = (a.subtask.title if a.subtask else '').lower()
            ref_str = (a.assignment_ref or '').lower()
            u_name = (a.assigned_user.full_name if a.assigned_user else '').lower()
            r_name = format_user_role(a.role or (a.assigned_user.role if a.assigned_user else '')).lower()

            if s in p_name or s in t_name or s in sub_name or s in ref_str or s in u_name or s in r_name:
                filtered.append(a)
        assignments = filtered

    return [build_assignment_response(a, db) for a in assignments]


@router.get("/{assignment_id}", response_model=TaskAssignmentResponse)
def get_task_assignment_by_id(assignment_id: int, db: Session = Depends(get_db)):
    """Fetch single task assignment by ID with audit trail and Work Plan reference."""
    assignment = db.query(TaskAssignment).filter(TaskAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail=f"Task Assignment #{assignment_id} not found.")
    return build_assignment_response(assignment, db)


@router.post("", response_model=TaskAssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_task_assignment(payload: TaskAssignmentCreate, db: Session = Depends(get_db)):
    """Create a new task assignment with strict validation and audit logging."""
    # 1. Project Validation
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=400, detail=f"Project #{payload.project_id} does not exist.")

    # 2. WBS Phase Validation
    wbs_phase = db.query(WbsTask).filter(WbsTask.id == payload.wbs_phase_id).first()
    if not wbs_phase or wbs_phase.project_id != payload.project_id:
        raise HTTPException(
            status_code=400,
            detail=f"WBS Phase #{payload.wbs_phase_id} does not exist or does not belong to project '{project.name}'."
        )

    # 3. Task Validation
    task = db.query(WbsTask).filter(WbsTask.id == payload.task_id).first()
    if not task or task.project_id != payload.project_id or task.parent_task_id != payload.wbs_phase_id:
        raise HTTPException(
            status_code=400,
            detail=f"Task #{payload.task_id} does not belong to WBS Phase #{payload.wbs_phase_id} under project '{project.name}'."
        )

    # 4. Subtask Validation (if provided)
    if payload.subtask_id:
        subtask = db.query(WbsTask).filter(WbsTask.id == payload.subtask_id).first()
        if not subtask or subtask.project_id != payload.project_id or subtask.parent_task_id != payload.task_id:
            raise HTTPException(
                status_code=400,
                detail=f"Subtask #{payload.subtask_id} does not belong to Task #{payload.task_id}."
            )

    # 5. Assigned User Validation & Eligibility Check
    assigned_user = db.query(User).filter(User.id == payload.assigned_user_id).first()
    if not assigned_user:
        raise HTTPException(status_code=400, detail=f"Assigned User #{payload.assigned_user_id} does not exist.")

    if assigned_user.role.lower() in INELIGIBLE_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"User '{assigned_user.full_name}' ({format_user_role(assigned_user.role)}) is an external customer account and cannot be assigned internal project tasks."
        )

    # 5b. Active Project Team Membership Requirement
    team_member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_id == payload.project_id,
        ProjectTeamMember.user_id == payload.assigned_user_id,
        ProjectTeamMember.status == "ACTIVE",
        ProjectTeamMember.is_active == True
    ).first()

    if not team_member:
        raise HTTPException(
            status_code=400,
            detail=f"User '{assigned_user.full_name}' is not an ACTIVE member of the project team for project '{project.name}'. Please add them to the Project Team first."
        )


    # 6. Date Range Validation
    if payload.due_date < payload.start_date:
        raise HTTPException(
            status_code=400,
            detail=f"Assignment Due Date ({payload.due_date}) cannot be earlier than Start Date ({payload.start_date})."
        )

    # 7. Duplicate Active Assignment Check
    existing_dup = db.query(TaskAssignment).filter(
        TaskAssignment.project_id == payload.project_id,
        TaskAssignment.wbs_phase_id == payload.wbs_phase_id,
        TaskAssignment.task_id == payload.task_id,
        TaskAssignment.subtask_id == payload.subtask_id,
        TaskAssignment.assigned_user_id == payload.assigned_user_id,
        TaskAssignment.is_active == True
    ).first()

    if existing_dup:
        raise HTTPException(
            status_code=400,
            detail=f"User '{assigned_user.full_name}' is already actively assigned to this task/subtask (Ref: {existing_dup.assignment_ref})."
        )

    user_role = format_user_role(payload.role or assigned_user.role)

    ref = generate_assignment_ref(db)
    initial_status = evaluate_assignment_status(payload.start_date, payload.due_date, "ASSIGNED")

    new_assignment = TaskAssignment(
        assignment_ref=ref,
        project_id=payload.project_id,
        wbs_phase_id=payload.wbs_phase_id,
        task_id=payload.task_id,
        subtask_id=payload.subtask_id,
        assigned_user_id=payload.assigned_user_id,
        role=user_role,
        priority=payload.priority or "MEDIUM",
        start_date=payload.start_date,
        due_date=payload.due_date,
        status=initial_status,
        remarks=payload.remarks,
        is_active=True
    )
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)

    # Audit Log
    audit = TaskAssignmentAudit(
        assignment_id=new_assignment.id,
        action="CREATED",
        new_user_id=payload.assigned_user_id,
        remarks=f"Task assigned to {assigned_user.full_name} ({user_role})."
    )
    db.add(audit)
    db.commit()

    return build_assignment_response(new_assignment, db)


@router.put("/{assignment_id}", response_model=TaskAssignmentResponse)
def update_task_assignment(
    assignment_id: int,
    payload: TaskAssignmentUpdate,
    db: Session = Depends(get_db)
):
    """Update task assignment parameters."""
    assignment = db.query(TaskAssignment).filter(TaskAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail=f"Task Assignment #{assignment_id} not found.")

    if payload.start_date or payload.due_date:
        s_date = payload.start_date or assignment.start_date
        d_date = payload.due_date or assignment.due_date
        if d_date < s_date:
            raise HTTPException(
                status_code=400,
                detail=f"Assignment Due Date ({d_date}) cannot be earlier than Start Date ({s_date})."
            )

    if payload.assigned_user_id and payload.assigned_user_id != assignment.assigned_user_id:
        user = db.query(User).filter(User.id == payload.assigned_user_id).first()
        if not user:
            raise HTTPException(status_code=400, detail=f"Assigned User #{payload.assigned_user_id} does not exist.")
        if user.role.lower() in INELIGIBLE_ROLES:
            raise HTTPException(
                status_code=400,
                detail=f"User '{user.full_name}' ({format_user_role(user.role)}) is an external customer account and cannot be assigned internal project tasks."
            )
        team_member = db.query(ProjectTeamMember).filter(
            ProjectTeamMember.project_id == assignment.project_id,
            ProjectTeamMember.user_id == payload.assigned_user_id,
            ProjectTeamMember.status == "ACTIVE",
            ProjectTeamMember.is_active == True
        ).first()
        if not team_member:
            raise HTTPException(
                status_code=400,
                detail=f"User '{user.full_name}' is not an ACTIVE member of the project team for this project. Please add them to the Project Team first."
            )
        assignment.assigned_user_id = payload.assigned_user_id
        if not payload.role:
            assignment.role = format_user_role(user.role)

    if payload.role is not None:
        assignment.role = format_user_role(payload.role)
    if payload.priority is not None:
        assignment.priority = payload.priority
    if payload.start_date is not None:
        assignment.start_date = payload.start_date
    if payload.due_date is not None:
        assignment.due_date = payload.due_date
    if payload.remarks is not None:
        assignment.remarks = payload.remarks
    if payload.status is not None:
        assignment.status = evaluate_assignment_status(assignment.start_date, assignment.due_date, payload.status)

    db.commit()
    db.refresh(assignment)

    audit = TaskAssignmentAudit(
        assignment_id=assignment.id,
        action="UPDATED",
        remarks="Assignment parameters updated."
    )
    db.add(audit)
    db.commit()

    return build_assignment_response(assignment, db)


@router.post("/{assignment_id}/reassign", response_model=TaskAssignmentResponse)
def reassign_task(
    assignment_id: int,
    payload: TaskAssignmentReassign,
    db: Session = Depends(get_db)
):
    """Reassign task from existing user to a new internal team member with complete audit trail."""
    assignment = db.query(TaskAssignment).filter(TaskAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail=f"Task Assignment #{assignment_id} not found.")

    if payload.new_user_id == assignment.assigned_user_id:
        raise HTTPException(status_code=400, detail="New assigned user cannot be the same as current assigned user.")

    new_user = db.query(User).filter(User.id == payload.new_user_id).first()
    if not new_user:
        raise HTTPException(status_code=400, detail=f"New assigned user #{payload.new_user_id} does not exist.")

    if new_user.role.lower() in INELIGIBLE_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"User '{new_user.full_name}' ({format_user_role(new_user.role)}) is an external customer account and cannot be assigned internal project tasks."
        )

    # Active Project Team Membership check for new user
    team_member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_id == assignment.project_id,
        ProjectTeamMember.user_id == payload.new_user_id,
        ProjectTeamMember.status == "ACTIVE",
        ProjectTeamMember.is_active == True
    ).first()

    if not team_member:
        raise HTTPException(
            status_code=400,
            detail=f"User '{new_user.full_name}' is not an ACTIVE member of the project team for this project. Please add them to the Project Team first."
        )


    prev_user_id = assignment.assigned_user_id
    prev_user = db.query(User).filter(User.id == prev_user_id).first()
    prev_user_name = prev_user.full_name if prev_user else f"User #{prev_user_id}"

    new_role = format_user_role(payload.role or new_user.role)

    assignment.assigned_user_id = payload.new_user_id
    assignment.role = new_role
    db.commit()
    db.refresh(assignment)

    audit_remarks = payload.remarks or f"Reassigned from '{prev_user_name}' to '{new_user.full_name}'."
    audit = TaskAssignmentAudit(
        assignment_id=assignment.id,
        action="REASSIGNED",
        previous_user_id=prev_user_id,
        new_user_id=payload.new_user_id,
        remarks=audit_remarks
    )
    db.add(audit)
    db.commit()

    return build_assignment_response(assignment, db)


@router.delete("/{assignment_id}", status_code=status.HTTP_200_OK)
def delete_task_assignment(assignment_id: int, db: Session = Depends(get_db)):
    """Soft delete task assignment (mark is_active = False) and log deletion audit."""
    assignment = db.query(TaskAssignment).filter(TaskAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail=f"Task Assignment #{assignment_id} not found.")

    assignment.is_active = False
    db.commit()

    audit = TaskAssignmentAudit(
        assignment_id=assignment.id,
        action="DELETED",
        remarks=f"Assignment {assignment.assignment_ref} archived/deleted."
    )
    db.add(audit)
    db.commit()

    return {"message": f"Task assignment {assignment.assignment_ref} deleted successfully."}
