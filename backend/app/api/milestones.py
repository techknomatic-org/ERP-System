from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal

from app.database import get_db
from app.models import ProjectMilestone, Project, WbsTask, User, WorkPlan, WorkPlanBoqMapping, BoqItem
from app.schemas import (
    MilestoneCreate, MilestoneUpdate, MilestoneResponse, WbsNodeBoqSummaryResponse
)
from app.api.auth import get_current_user
from app.api.audit import record_audit_log

router = APIRouter(prefix="/api/milestones", tags=["Milestone Definition (WPT-03)"])

AUTHORIZED_ROLES = ["admin", "management", "project_manager", "site_engineer", "finance"]


def get_wbs_node_total_mapped_boq(wbs_node_id: int, db: Session) -> float:
    """
    Computes total mapped BOQ quantity for a WBS node based on WPT-02 mappings.
    Checks WorkPlan activities linked to this WBS node as well as direct BOQ items.
    """
    # 1. Sum mappings from WorkPlans linked to this WBS node
    work_plans = db.query(WorkPlan).filter(
        or_(
            WorkPlan.task_id == wbs_node_id,
            WorkPlan.subtask_id == wbs_node_id,
            WorkPlan.wbs_phase_id == wbs_node_id
        ),
        WorkPlan.is_archived == False
    ).all()

    total_mapped = 0.0
    if work_plans:
        wp_ids = [w.id for w in work_plans]
        mappings = db.query(WorkPlanBoqMapping).filter(
            WorkPlanBoqMapping.work_plan_id.in_(wp_ids),
            WorkPlanBoqMapping.is_orphaned == False
        ).all()
        total_mapped += sum(float(m.mapped_quantity or 0.0) for m in mappings)

    # 2. Check direct BOQ items associated with this WBS node
    direct_boqs = db.query(BoqItem).filter(
        or_(
            BoqItem.task_id == wbs_node_id,
            BoqItem.subtask_id == wbs_node_id,
            BoqItem.phase_id == wbs_node_id
        )
    ).all()
    if direct_boqs:
        # If no work plans mapped yet, direct approved BOQ quantity acts as base
        if total_mapped == 0.0:
            total_mapped = sum(float(b.approved_qty or 0.0) for b in direct_boqs)

    # 3. Fallback to WbsTask planned_qty if available
    if total_mapped == 0.0:
        task = db.query(WbsTask).filter(WbsTask.id == wbs_node_id).first()
        if task and task.planned_qty:
            total_mapped = float(task.planned_qty)

    return round(total_mapped, 2)


def evaluate_milestone(milestone: ProjectMilestone, db: Session, auto_persist: bool = True) -> MilestoneResponse:
    """
    Evaluates milestone status with server-side rules:
    - Date-based only: MET if current_date >= target_date, else NOT MET
    - Quantity-based only: MET if linked WBS node's actual_qty >= target_quantity (or progress_pct >= target_quantity), else NOT MET
    - Both Date & Quantity: MET ONLY if BOTH conditions are satisfied (Strict AND logic).
    """
    wbs_node = db.query(WbsTask).filter(WbsTask.id == milestone.wbs_node_id).first()
    proj = db.query(Project).filter(Project.id == milestone.project_id).first()

    today = datetime.utcnow().date()

    # 1. Date Condition
    is_date_met = False
    if milestone.is_date_based:
        if milestone.target_date:
            t_date = milestone.target_date
            if isinstance(t_date, datetime):
                t_date = t_date.date()
            is_date_met = bool(today >= t_date)
    else:
        is_date_met = True

    # 2. Quantity Condition
    is_quantity_met = False
    actual_qty = float(wbs_node.actual_qty or 0.0) if wbs_node else 0.0
    progress_pct = float(wbs_node.progress_pct or 0.0) if wbs_node else 0.0

    if milestone.is_quantity_based:
        target_qty = float(milestone.target_quantity or 0.0)
        # Met if actual executed quantity reaches target, or if progress percentage reaches target %
        is_quantity_met = bool(actual_qty >= target_qty or progress_pct >= target_qty)
    else:
        is_quantity_met = True

    # 3. Overall Status Evaluation
    computed_status = "NOT MET"
    if milestone.is_date_based and milestone.is_quantity_based:
        # Strict AND logic per specification: Met ONLY when BOTH conditions are satisfied
        computed_status = "Met" if (is_date_met and is_quantity_met) else "Pending"
    elif milestone.is_date_based:
        computed_status = "Met" if is_date_met else "Pending"
    elif milestone.is_quantity_based:
        computed_status = "Met" if is_quantity_met else "Pending"
    else:
        computed_status = "Pending"

    # Automatically persist status if changed (guarantees date rollover is saved without manual edit)
    if auto_persist and milestone.status != computed_status:
        milestone.status = computed_status
        milestone.updated_at = datetime.utcnow()
        try:
            db.commit()
            db.refresh(milestone)
        except Exception:
            db.rollback()

    # 4. Quantity Planning-Ahead Warning
    total_mapped_boq = get_wbs_node_total_mapped_boq(milestone.wbs_node_id, db)
    has_quantity_warning = False
    warning_message = None

    if milestone.is_quantity_based and milestone.target_quantity:
        target_val = float(milestone.target_quantity)
        if target_val > total_mapped_boq:
            has_quantity_warning = True
            warning_message = (
                f"Target quantity ({target_val}) exceeds the WBS node's total mapped BOQ quantity "
                f"({total_mapped_boq}). This milestone is planned ahead of the currently mapped quantity."
            )

    return MilestoneResponse(
        id=milestone.id,
        project_id=milestone.project_id,
        wbs_node_id=milestone.wbs_node_id,
        milestone_name=milestone.milestone_name,
        is_date_based=milestone.is_date_based,
        is_quantity_based=milestone.is_quantity_based,
        target_date=milestone.target_date,
        target_quantity=float(milestone.target_quantity) if milestone.target_quantity is not None else None,
        status=computed_status,
        wbs_node_name=wbs_node.title if wbs_node else f"WBS Node #{milestone.wbs_node_id}",
        wbs_code=wbs_node.wbs_code if wbs_node else None,
        project_name=proj.name if proj else f"Project #{milestone.project_id}",
        is_date_met=is_date_met,
        is_quantity_met=is_quantity_met,
        current_actual_qty=round(actual_qty, 2),
        current_progress_pct=round(progress_pct, 2),
        total_mapped_boq_qty=total_mapped_boq,
        has_quantity_warning=has_quantity_warning,
        quantity_warning_message=warning_message,
        created_by_id=milestone.created_by_id,
        created_at=milestone.created_at,
        updated_at=milestone.updated_at
    )


def recalculate_milestones_for_wbs_node(db: Session, wbs_node_id: int):
    """
    Hook function to recompute milestone statuses when e-MB or progress updates for a WBS node.
    """
    if not wbs_node_id:
        return
    milestones = db.query(ProjectMilestone).filter(ProjectMilestone.wbs_node_id == wbs_node_id).all()
    for m in milestones:
        evaluate_milestone(m, db, auto_persist=True)


@router.get("", response_model=List[MilestoneResponse])
def list_milestones(
    project_id: Optional[int] = None,
    wbs_node_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List milestones for a project or WBS node with dynamic date rollover evaluation.
    """
    query = db.query(ProjectMilestone)
    if project_id:
        query = query.filter(ProjectMilestone.project_id == project_id)
    if wbs_node_id:
        query = query.filter(ProjectMilestone.wbs_node_id == wbs_node_id)

    milestones = query.order_by(ProjectMilestone.target_date.asc(), ProjectMilestone.id.asc()).all()
    return [evaluate_milestone(m, db, auto_persist=True) for m in milestones]


@router.get("/project/{project_id}", response_model=List[MilestoneResponse])
def list_project_milestones(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Convenience endpoint to list all milestones for a project.
    """
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail=f"Project #{project_id} not found.")

    milestones = db.query(ProjectMilestone).filter(
        ProjectMilestone.project_id == project_id
    ).order_by(ProjectMilestone.target_date.asc(), ProjectMilestone.id.asc()).all()
    return [evaluate_milestone(m, db, auto_persist=True) for m in milestones]


@router.get("/wbs-node/{node_id}/boq-summary", response_model=WbsNodeBoqSummaryResponse)
def get_wbs_node_boq_summary(
    node_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns WBS node execution status and mapped BOQ quantity for dynamic frontend warning calculation.
    """
    node = db.query(WbsTask).filter(WbsTask.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail=f"WBS Node #{node_id} not found.")

    total_mapped = get_wbs_node_total_mapped_boq(node_id, db)
    return WbsNodeBoqSummaryResponse(
        wbs_node_id=node.id,
        wbs_node_name=node.title,
        wbs_code=node.wbs_code,
        total_mapped_boq_qty=total_mapped,
        planned_qty=float(node.planned_qty or 0.0),
        actual_qty=float(node.actual_qty or 0.0),
        progress_pct=float(node.progress_pct or 0.0),
        unit="m³"
    )


@router.get("/{id}", response_model=MilestoneResponse)
def get_milestone_details(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed information and current status for a single milestone.
    """
    milestone = db.query(ProjectMilestone).filter(ProjectMilestone.id == id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail=f"Milestone #{id} not found.")
    return evaluate_milestone(milestone, db, auto_persist=True)


@router.post("", response_model=MilestoneResponse, status_code=201)
def create_milestone(
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new milestone with strict validation, server-side status computation, and audit logging.
    """
    # 1. RBAC authorization
    user_role = (current_user.role or "").lower()
    if user_role not in AUTHORIZED_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You do not have permission to create project milestones."
        )

    # 2. Project verification
    proj = db.query(Project).filter(Project.id == payload.project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail=f"Project #{payload.project_id} not found.")

    # 3. Mandatory Milestone Type Validation
    if not payload.is_date_based and not payload.is_quantity_based:
        raise HTTPException(
            status_code=400,
            detail="Select at least one milestone type."
        )

    # 4. Conditional Field Validations
    if payload.is_date_based and not payload.target_date:
        raise HTTPException(
            status_code=400,
            detail="Target Date is required for Date-based milestones."
        )

    if payload.is_quantity_based:
        if payload.target_quantity is None:
            raise HTTPException(
                status_code=400,
                detail="Target Quantity / % is required for Quantity-based milestones."
            )
        try:
            qty_val = float(payload.target_quantity)
            if qty_val <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Target Quantity / % must be a valid positive number."
            )

    # 5. WBS Node Isolation Check
    wbs_node = db.query(WbsTask).filter(WbsTask.id == payload.wbs_node_id).first()
    if not wbs_node:
        raise HTTPException(status_code=404, detail=f"WBS Node #{payload.wbs_node_id} not found.")

    if wbs_node.project_id != payload.project_id:
        raise HTTPException(
            status_code=400,
            detail=f"WBS Node #{payload.wbs_node_id} belongs to Project #{wbs_node.project_id}, not Project #{payload.project_id}. Cross-project references are not allowed."
        )

    # 6. Instantiate Milestone
    milestone = ProjectMilestone(
        project_id=payload.project_id,
        wbs_node_id=payload.wbs_node_id,
        milestone_name=payload.milestone_name.strip(),
        is_date_based=payload.is_date_based,
        is_quantity_based=payload.is_quantity_based,
        target_date=payload.target_date if payload.is_date_based else None,
        target_quantity=payload.target_quantity if payload.is_quantity_based else None,
        status="Pending",
        created_by_id=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(milestone)
    db.commit()
    db.refresh(milestone)

    # 7. Evaluate initial status and persist
    resp = evaluate_milestone(milestone, db, auto_persist=True)

    # 8. Record Immutable Audit Log
    record_audit_log(
        db=db,
        user_id=current_user.id,
        action="CREATE_MILESTONE",
        entity_type="ProjectMilestone",
        entity_id=milestone.id,
        payload=(
            f"Created milestone '{milestone.milestone_name}' (ID={milestone.id}) for Project '{proj.name}' "
            f"linked to WBS Node '{wbs_node.title}'. Type: Date={milestone.is_date_based}, "
            f"Qty={milestone.is_quantity_based}. Initial Status: {milestone.status}."
        )
    )

    return resp


@router.put("/{id}", response_model=MilestoneResponse)
def update_milestone(
    id: int,
    payload: MilestoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates an existing milestone with validation and audit logging.
    """
    # 1. RBAC authorization
    user_role = (current_user.role or "").lower()
    if user_role not in AUTHORIZED_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You do not have permission to edit project milestones."
        )

    milestone = db.query(ProjectMilestone).filter(ProjectMilestone.id == id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail=f"Milestone #{id} not found.")

    # Determine resulting configuration
    effective_name = payload.milestone_name if payload.milestone_name is not None else milestone.milestone_name
    effective_node_id = payload.wbs_node_id if payload.wbs_node_id is not None else milestone.wbs_node_id
    effective_date_based = payload.is_date_based if payload.is_date_based is not None else milestone.is_date_based
    effective_qty_based = payload.is_quantity_based if payload.is_quantity_based is not None else milestone.is_quantity_based
    effective_target_date = payload.target_date if payload.target_date is not None else milestone.target_date
    effective_target_qty = payload.target_quantity if payload.target_quantity is not None else milestone.target_quantity

    # Validation
    if not effective_date_based and not effective_qty_based:
        raise HTTPException(
            status_code=400,
            detail="Select at least one milestone type."
        )

    if effective_date_based and not effective_target_date:
        raise HTTPException(
            status_code=400,
            detail="Target Date is required for Date-based milestones."
        )

    if effective_qty_based:
        if effective_target_qty is None:
            raise HTTPException(
                status_code=400,
                detail="Target Quantity / % is required for Quantity-based milestones."
            )
        try:
            qty_val = float(effective_target_qty)
            if qty_val <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Target Quantity / % must be a valid positive number."
            )

    # WBS Node Check
    if effective_node_id != milestone.wbs_node_id:
        wbs_node = db.query(WbsTask).filter(WbsTask.id == effective_node_id).first()
        if not wbs_node:
            raise HTTPException(status_code=404, detail=f"WBS Node #{effective_node_id} not found.")
        if wbs_node.project_id != milestone.project_id:
            raise HTTPException(
                status_code=400,
                detail=f"WBS Node #{effective_node_id} belongs to Project #{wbs_node.project_id}, not Project #{milestone.project_id}."
            )
        milestone.wbs_node_id = effective_node_id

    # Apply updates
    milestone.milestone_name = effective_name.strip()
    milestone.is_date_based = effective_date_based
    milestone.is_quantity_based = effective_qty_based
    milestone.target_date = effective_target_date if effective_date_based else None
    milestone.target_quantity = effective_target_qty if effective_qty_based else None
    milestone.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(milestone)

    resp = evaluate_milestone(milestone, db, auto_persist=True)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action="UPDATE_MILESTONE",
        entity_type="ProjectMilestone",
        entity_id=milestone.id,
        payload=f"Updated milestone '{milestone.milestone_name}' (ID={milestone.id}). Status now: {milestone.status}."
    )

    return resp


@router.delete("/{id}")
def delete_milestone(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes a milestone and records an audit log.
    """
    user_role = (current_user.role or "").lower()
    if user_role not in AUTHORIZED_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You do not have permission to delete project milestones."
        )

    milestone = db.query(ProjectMilestone).filter(ProjectMilestone.id == id).first()
    if not milestone:
        raise HTTPException(status_code=404, detail=f"Milestone #{id} not found.")

    m_name = milestone.milestone_name
    m_id = milestone.id
    p_id = milestone.project_id

    db.delete(milestone)
    db.commit()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        action="DELETE_MILESTONE",
        entity_type="ProjectMilestone",
        entity_id=m_id,
        payload=f"Deleted milestone '{m_name}' (ID={m_id}) from Project #{p_id}."
    )

    return {"message": f"Milestone '{m_name}' deleted successfully.", "milestone_id": m_id}
