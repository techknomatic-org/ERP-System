from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional
from datetime import datetime, date

from app.database import get_db
from app.models import WorkPlan, Project, WbsTask, User, BoqItem, WorkPlanBoqMapping, ScheduleOfRates, TaskAssignment
from app.schemas import (
    WorkPlanCreate, WorkPlanUpdate, WorkPlanResponse,
    WorkPlanBoqMappingCreate, WorkPlanBoqMappingUpdate, WorkPlanBoqMappingResponse,
    EligibleBoqItemForMappingResponse
)

router = APIRouter(prefix="/api/work-plans", tags=["Work Plan Management"])

def normalize_unit(unit_str: Optional[str]) -> str:
    if not unit_str:
        return ""
    u = unit_str.strip().lower()
    if u in ["m³", "m3", "cu.m", "cum", "cubic meter", "cubic meters", "cu m"]:
        return "M3"
    if u in ["sqm", "m²", "m2", "sq.m", "sq m", "square meter", "square meters"]:
        return "SQM"
    if u in ["mt", "tonne", "tonnes", "metric tonne", "metric tonnes", "ton"]:
        return "MT"
    if u in ["nos", "no", "numbers", "number", "num", "each"]:
        return "NOS"
    if u in ["rft", "rm", "running feet", "running meter", "rmt"]:
        return "RFT"
    if u in ["kg", "kgs", "kilogram", "kilograms"]:
        return "KG"
    if u in ["ls", "lump sum", "lumpsum"]:
        return "LS"
    return u.upper()

def is_unit_compatible(unit1: str, unit2: str) -> bool:
    return normalize_unit(unit1) == normalize_unit(unit2)

def evaluate_work_plan_status(planned_start: datetime, planned_end: datetime, actual_qty: float = 0.0, planned_qty: float = 0.0) -> tuple[str, float]:
    today = datetime.utcnow().date()
    s_date = planned_start.date() if isinstance(planned_start, datetime) else planned_start
    e_date = planned_end.date() if isinstance(planned_end, datetime) else planned_end

    # Rule 1: Future start date strictly forces NOT STARTED
    if s_date and today < s_date:
        return "NOT STARTED", 0.0

    # Rule 3: Past end date
    if e_date and today > e_date:
        if planned_qty > 0 and actual_qty >= planned_qty:
            return "COMPLETED", 100.0
        prog = round((actual_qty / planned_qty * 100.0) if planned_qty > 0 else 0.0, 2)
        return "DELAYED", min(100.0, max(0.0, prog))

    # Rule 2: Active period
    if planned_qty > 0 and actual_qty >= planned_qty:
        return "COMPLETED", 100.0
    elif actual_qty > 0:
        prog = round((actual_qty / planned_qty * 100.0) if planned_qty > 0 else 0.0, 2)
        return "IN PROGRESS", min(100.0, max(0.0, prog))
    else:
        return "NOT STARTED", 0.0


def build_work_plan_response(wp: WorkPlan, db: Session) -> WorkPlanResponse:
    proj = db.query(Project).filter(Project.id == wp.project_id).first()
    phase = db.query(WbsTask).filter(WbsTask.id == wp.wbs_phase_id).first()
    task = db.query(WbsTask).filter(WbsTask.id == wp.task_id).first()
    subtask = db.query(WbsTask).filter(WbsTask.id == wp.subtask_id).first() if wp.subtask_id else None
    
    dep_activity = None
    if wp.dependency_id:
        dep_wp = db.query(WorkPlan).filter(WorkPlan.id == wp.dependency_id).first()
        if dep_wp:
            dep_activity = f"{dep_wp.work_plan_number} — {dep_wp.activity_name}"

    resp_user = None
    if wp.responsible_user_id:
        u = db.query(User).filter(User.id == wp.responsible_user_id).first()
        if u:
            resp_user = u.full_name or u.username
    else:
        # Cross-reference TaskAssignment if assigned
        target_task_id = wp.subtask_id or wp.task_id
        ta = db.query(TaskAssignment).filter(
            TaskAssignment.project_id == wp.project_id,
            (TaskAssignment.subtask_id == target_task_id) | (TaskAssignment.task_id == target_task_id),
            TaskAssignment.is_active == True
        ).first()
        if ta and ta.assigned_user:
            resp_user = f"{ta.assigned_user.full_name} ({ta.role or ta.assigned_user.role})"

    # Re-evaluate status based on current date
    evaluated_status, progress_pct = evaluate_work_plan_status(
        wp.planned_start_date,
        wp.planned_end_date,
        actual_qty=0.0,
        planned_qty=float(wp.planned_quantity or 0.0)
    )

    # Compute BOQ Mappings summary for this work plan
    mappings = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.work_plan_id == wp.id).all()
    mapped_count = len(mappings)
    total_mapped_qty = sum(float(m.mapped_quantity or 0.0) for m in mappings)

    planned_qty = float(wp.planned_quantity or 0.0)
    if mapped_count == 0:
        boq_mapping_status = "Not Mapped"
    elif planned_qty > 0 and total_mapped_qty >= planned_qty:
        boq_mapping_status = "Fully Mapped"
    else:
        boq_mapping_status = f"{mapped_count} BOQ Item{'s' if mapped_count > 1 else ''}"

    return WorkPlanResponse(
        id=wp.id,
        work_plan_number=wp.work_plan_number,
        project_id=wp.project_id,
        wbs_phase_id=wp.wbs_phase_id,
        task_id=wp.task_id,
        subtask_id=wp.subtask_id,
        activity_name=wp.activity_name,
        description=wp.description,
        planned_quantity=float(wp.planned_quantity or 0.0),
        unit=wp.unit,
        planned_start_date=wp.planned_start_date,
        planned_end_date=wp.planned_end_date,
        priority=wp.priority,
        dependency_id=wp.dependency_id,
        responsible_team_id=wp.responsible_team_id,
        responsible_user_id=wp.responsible_user_id,
        remarks=wp.remarks,
        status=evaluated_status,
        is_archived=wp.is_archived,
        created_by_id=wp.created_by_id,
        created_at=wp.created_at,
        updated_at=wp.updated_at,
        project_name=proj.name if proj else None,
        project_code=proj.code if proj else None,
        phase_name=phase.title if phase else None,
        task_name=task.title if task else None,
        subtask_name=subtask.title if subtask else None,
        dependency_activity_name=dep_activity,
        responsible_user_name=resp_user,
        progress_percentage=progress_pct,
        mapped_boq_count=mapped_count,
        total_boq_mapped_qty=round(total_mapped_qty, 2),
        boq_mapping_status=boq_mapping_status
    )


def generate_work_plan_number(db: Session) -> str:
    year = datetime.utcnow().year
    prefix = f"WP-{year}-"
    last_wp = db.query(WorkPlan).filter(WorkPlan.work_plan_number.like(f"{prefix}%")).order_by(WorkPlan.id.desc()).first()
    if not last_wp:
        return f"{prefix}001"
    try:
        last_num = int(last_wp.work_plan_number.split("-")[-1])
        return f"{prefix}{last_num + 1:03d}"
    except ValueError:
        return f"{prefix}{db.query(WorkPlan).count() + 1:03d}"


@router.get("", response_model=List[WorkPlanResponse])
def list_work_plans(
    project_id: Optional[int] = None,
    wbs_phase_id: Optional[int] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    include_archived: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(WorkPlan)
    if not include_archived:
        query = query.filter(WorkPlan.is_archived == False)

    if project_id:
        query = query.filter(WorkPlan.project_id == project_id)
    if wbs_phase_id:
        query = query.filter(WorkPlan.wbs_phase_id == wbs_phase_id)
    if priority and priority != "ALL":
        query = query.filter(WorkPlan.priority == priority)

    work_plans = query.order_by(WorkPlan.planned_start_date.asc(), WorkPlan.id.asc()).all()

    results = []
    for wp in work_plans:
        res = build_work_plan_response(wp, db)
        
        if status and status != "ALL" and res.status != status:
            continue
            
        if search:
            q = search.lower().strip()
            matches = (
                q in (res.work_plan_number or "").lower() or
                q in (res.activity_name or "").lower() or
                q in (res.task_name or "").lower() or
                q in (res.phase_name or "").lower() or
                q in (res.project_name or "").lower()
            )
            if not matches:
                continue
                
        results.append(res)

    return results


@router.get("/{wp_id}", response_model=WorkPlanResponse)
def get_work_plan(wp_id: int, db: Session = Depends(get_db)):
    wp = db.query(WorkPlan).filter(WorkPlan.id == wp_id).first()
    if not wp:
        raise HTTPException(status_code=404, detail=f"Work plan activity #{wp_id} not found.")
    return build_work_plan_response(wp, db)


@router.post("", response_model=WorkPlanResponse, status_code=201)
def create_work_plan(payload: WorkPlanCreate, db: Session = Depends(get_db)):
    proj = db.query(Project).filter(Project.id == payload.project_id).first()
    if not proj:
        raise HTTPException(status_code=400, detail=f"Project ID {payload.project_id} not found.")

    phase = db.query(WbsTask).filter(WbsTask.id == payload.wbs_phase_id, WbsTask.project_id == payload.project_id).first()
    if not phase:
        raise HTTPException(status_code=400, detail=f"WBS Phase ID {payload.wbs_phase_id} does not exist for project.")

    task = db.query(WbsTask).filter(WbsTask.id == payload.task_id, WbsTask.project_id == payload.project_id).first()
    if not task:
        raise HTTPException(status_code=400, detail=f"WBS Task ID {payload.task_id} does not exist for project.")

    if payload.subtask_id:
        subtask = db.query(WbsTask).filter(WbsTask.id == payload.subtask_id, WbsTask.project_id == payload.project_id).first()
        if not subtask:
            raise HTTPException(status_code=400, detail=f"WBS Subtask ID {payload.subtask_id} does not exist for project.")

    if payload.planned_end_date < payload.planned_start_date:
        raise HTTPException(status_code=400, detail="Planned End Date cannot be earlier than Planned Start Date.")

    if payload.planned_quantity < 0:
        raise HTTPException(status_code=400, detail="Planned quantity cannot be negative.")

    if payload.dependency_id:
        dep_wp = db.query(WorkPlan).filter(WorkPlan.id == payload.dependency_id, WorkPlan.project_id == payload.project_id).first()
        if not dep_wp:
            raise HTTPException(status_code=400, detail=f"Dependency Work Plan ID {payload.dependency_id} not found.")

    wp_num = generate_work_plan_number(db)
    init_status, _ = evaluate_work_plan_status(payload.planned_start_date, payload.planned_end_date, 0.0, payload.planned_quantity)

    new_wp = WorkPlan(
        work_plan_number=wp_num,
        project_id=payload.project_id,
        wbs_phase_id=payload.wbs_phase_id,
        task_id=payload.task_id,
        subtask_id=payload.subtask_id,
        activity_name=payload.activity_name.strip(),
        description=payload.description,
        planned_quantity=payload.planned_quantity,
        unit=payload.unit.strip() if payload.unit else "m³",
        planned_start_date=payload.planned_start_date,
        planned_end_date=payload.planned_end_date,
        priority=payload.priority or "MEDIUM",
        dependency_id=payload.dependency_id,
        responsible_team_id=payload.responsible_team_id,
        responsible_user_id=payload.responsible_user_id,
        remarks=payload.remarks,
        status=init_status,
        is_archived=False
    )

    db.add(new_wp)
    db.commit()
    db.refresh(new_wp)

    return build_work_plan_response(new_wp, db)


@router.put("/{wp_id}", response_model=WorkPlanResponse)
def update_work_plan(wp_id: int, payload: WorkPlanUpdate, db: Session = Depends(get_db)):
    wp = db.query(WorkPlan).filter(WorkPlan.id == wp_id).first()
    if not wp:
        raise HTTPException(status_code=404, detail=f"Work plan activity #{wp_id} not found.")

    if payload.activity_name is not None:
        wp.activity_name = payload.activity_name.strip()
    if payload.description is not None:
        wp.description = payload.description
    if payload.planned_quantity is not None:
        if payload.planned_quantity < 0:
            raise HTTPException(status_code=400, detail="Planned quantity cannot be negative.")
        wp.planned_quantity = payload.planned_quantity
    if payload.unit is not None:
        wp.unit = payload.unit.strip()

    start_dt = payload.planned_start_date if payload.planned_start_date is not None else wp.planned_start_date
    end_dt = payload.planned_end_date if payload.planned_end_date is not None else wp.planned_end_date

    if end_dt < start_dt:
        raise HTTPException(status_code=400, detail="Planned End Date cannot be earlier than Planned Start Date.")

    wp.planned_start_date = start_dt
    wp.planned_end_date = end_dt

    if payload.priority is not None:
        wp.priority = payload.priority
    if payload.dependency_id is not None:
        if payload.dependency_id == wp.id:
            raise HTTPException(status_code=400, detail="An activity cannot depend on itself.")
        dep_wp = db.query(WorkPlan).filter(WorkPlan.id == payload.dependency_id, WorkPlan.project_id == wp.project_id).first()
        if not dep_wp:
            raise HTTPException(status_code=400, detail=f"Dependency Work Plan ID {payload.dependency_id} not found.")
        wp.dependency_id = payload.dependency_id

    if payload.responsible_team_id is not None:
        wp.responsible_team_id = payload.responsible_team_id
    if payload.responsible_user_id is not None:
        wp.responsible_user_id = payload.responsible_user_id
    if payload.remarks is not None:
        wp.remarks = payload.remarks

    new_status, _ = evaluate_work_plan_status(wp.planned_start_date, wp.planned_end_date, 0.0, float(wp.planned_quantity or 0.0))
    wp.status = new_status
    wp.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(wp)

    return build_work_plan_response(wp, db)


@router.delete("/{wp_id}")
def archive_work_plan(wp_id: int, db: Session = Depends(get_db)):
    wp = db.query(WorkPlan).filter(WorkPlan.id == wp_id).first()
    if not wp:
        raise HTTPException(status_code=404, detail=f"Work plan activity #{wp_id} not found.")

    wp.is_archived = True
    wp.updated_at = datetime.utcnow()
    db.commit()

    return {"detail": f"Work Plan activity {wp.work_plan_number} archived successfully."}


# ==============================================================================
# FEATURE 2: MAP BOQ ITEMS WITH WORK PLAN ENDPOINTS & VALIDATIONS
# ==============================================================================

def get_boq_total_allocated_qty(boq_item_id: int, db: Session, exclude_mapping_id: Optional[int] = None) -> float:
    query = db.query(func.sum(WorkPlanBoqMapping.mapped_quantity)).filter(WorkPlanBoqMapping.boq_item_id == boq_item_id)
    if exclude_mapping_id:
        query = query.filter(WorkPlanBoqMapping.id != exclude_mapping_id)
    val = query.scalar()
    return float(val or 0.0)


@router.get("/{wp_id}/boq-mappings", response_model=List[WorkPlanBoqMappingResponse])
def get_work_plan_boq_mappings(wp_id: int, db: Session = Depends(get_db)):
    wp = db.query(WorkPlan).filter(WorkPlan.id == wp_id).first()
    if not wp:
        raise HTTPException(status_code=404, detail=f"Work plan activity #{wp_id} not found.")

    mappings = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.work_plan_id == wp.id).all()
    results = []

    for m in mappings:
        boq = db.query(BoqItem).filter(BoqItem.id == m.boq_item_id).first()
        boq_code = f"BOQ-{boq.id:03d}" if boq else f"BOQ-{m.boq_item_id}"
        boq_desc = boq.item_name if boq else "N/A"
        boq_unit = boq.unit if boq else m.unit
        boq_total_qty = float(boq.approved_qty) if boq else 0.0
        rate = float(boq.rate) if boq else 0.0
        est_amount = rate * float(m.mapped_quantity)

        total_allocated = get_boq_total_allocated_qty(m.boq_item_id, db)
        remaining = max(0.0, boq_total_qty - total_allocated)

        if total_allocated >= boq_total_qty and boq_total_qty > 0:
            mapping_st = "FULLY ALLOCATED"
        elif total_allocated > 0:
            mapping_st = "PARTIALLY MAPPED"
        else:
            mapping_st = "MAPPED"

        results.append(WorkPlanBoqMappingResponse(
            id=m.id,
            work_plan_id=m.work_plan_id,
            boq_item_id=m.boq_item_id,
            project_id=m.project_id,
            mapped_quantity=float(m.mapped_quantity),
            unit=m.unit,
            created_at=m.created_at,
            updated_at=m.updated_at,
            boq_code=boq_code,
            boq_description=boq_desc,
            boq_unit=boq_unit,
            boq_total_quantity=boq_total_qty,
            total_allocated_quantity=round(total_allocated, 2),
            remaining_quantity=round(remaining, 2),
            rate=rate,
            estimated_amount=round(est_amount, 2),
            mapping_status=mapping_st
        ))

    return results


@router.get("/{wp_id}/eligible-boq-items", response_model=List[EligibleBoqItemForMappingResponse])
def get_eligible_boq_items_for_mapping(wp_id: int, db: Session = Depends(get_db)):
    wp = db.query(WorkPlan).filter(WorkPlan.id == wp_id).first()
    if not wp:
        raise HTTPException(status_code=404, detail=f"Work plan activity #{wp_id} not found.")

    # Strictly filter to BOQ items belonging to the same project
    boq_items = db.query(BoqItem).filter(BoqItem.project_id == wp.project_id).all()
    results = []

    for boq in boq_items:
        total_allocated = get_boq_total_allocated_qty(boq.id, db)
        boq_qty = float(boq.approved_qty or 0.0)
        remaining = max(0.0, boq_qty - total_allocated)
        boq_code = f"BOQ-{boq.id:03d}"

        compatible = is_unit_compatible(wp.unit, boq.unit)
        warning = None if compatible else f"Unit mismatch: Work Plan unit ('{wp.unit}') is incompatible with BOQ unit ('{boq.unit}')."

        results.append(EligibleBoqItemForMappingResponse(
            boq_item_id=boq.id,
            boq_code=boq_code,
            item_name=boq.item_name,
            unit=boq.unit,
            approved_qty=boq_qty,
            total_allocated_qty=round(total_allocated, 2),
            remaining_unmapped_qty=round(remaining, 2),
            rate=float(boq.rate or 0.0),
            total_amount=float(boq.total_amount or 0.0),
            is_unit_compatible=compatible,
            compatibility_warning=warning
        ))

    return results


@router.post("/{wp_id}/boq-mappings", response_model=WorkPlanBoqMappingResponse, status_code=201)
def create_work_plan_boq_mapping(
    wp_id: int,
    payload: WorkPlanBoqMappingCreate,
    db: Session = Depends(get_db)
):
    # 1. Verify Work Plan
    wp = db.query(WorkPlan).filter(WorkPlan.id == wp_id).first()
    if not wp:
        raise HTTPException(status_code=404, detail=f"Work plan activity #{wp_id} not found.")

    # 2. Verify BOQ Item
    boq = db.query(BoqItem).filter(BoqItem.id == payload.boq_item_id).first()
    if not boq:
        raise HTTPException(status_code=404, detail=f"BOQ Item ID {payload.boq_item_id} not found.")

    # 3. Strictly enforce Project Scoping
    if boq.project_id != wp.project_id:
        proj_wp = db.query(Project).filter(Project.id == wp.project_id).first()
        proj_boq = db.query(Project).filter(Project.id == boq.project_id).first()
        wp_pname = proj_wp.name if proj_wp else f"#{wp.project_id}"
        boq_pname = proj_boq.name if proj_boq else f"#{boq.project_id}"
        raise HTTPException(
            status_code=400,
            detail=f"Cross-project mapping rejected! Work Plan belongs to '{wp_pname}' while BOQ item belongs to '{boq_pname}'."
        )

    # 4. Validate quantity > 0
    if payload.mapped_quantity <= 0:
        raise HTTPException(status_code=400, detail="Mapped quantity must be strictly greater than 0.")

    # 5. Validate Unit Compatibility
    target_unit = payload.unit.strip() if payload.unit else boq.unit
    if not is_unit_compatible(wp.unit, target_unit):
        raise HTTPException(
            status_code=400,
            detail=f"Unit compatibility error! Work Plan unit ('{wp.unit}') is incompatible with BOQ item unit ('{target_unit}')."
        )

    # 6. Prevent Duplicate Mapping
    existing = db.query(WorkPlanBoqMapping).filter(
        WorkPlanBoqMapping.work_plan_id == wp.id,
        WorkPlanBoqMapping.boq_item_id == boq.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"BOQ item '{boq.item_name}' is already mapped to Work Plan activity {wp.work_plan_number}. Edit the existing mapping instead."
        )

    # 7. Validate Total Allocated Quantity vs BOQ Approved Quantity
    already_allocated = get_boq_total_allocated_qty(boq.id, db)
    boq_qty = float(boq.approved_qty or 0.0)
    remaining_qty = max(0.0, boq_qty - already_allocated)

    if payload.mapped_quantity > remaining_qty + 1e-6:
        raise HTTPException(
            status_code=400,
            detail=f"Mapped quantity ({payload.mapped_quantity:.2f} {target_unit}) exceeds remaining unmapped BOQ quantity ({remaining_qty:.2f} {target_unit}). Total BOQ quantity is {boq_qty:.2f} {target_unit}."
        )

    # Create persistent mapping
    new_mapping = WorkPlanBoqMapping(
        work_plan_id=wp.id,
        boq_item_id=boq.id,
        project_id=wp.project_id,
        mapped_quantity=payload.mapped_quantity,
        unit=target_unit
    )

    db.add(new_mapping)
    db.commit()
    db.refresh(new_mapping)

    total_allocated_now = already_allocated + payload.mapped_quantity
    rem_now = max(0.0, boq_qty - total_allocated_now)

    if total_allocated_now >= boq_qty:
        m_status = "FULLY ALLOCATED"
    elif total_allocated_now > 0:
        m_status = "PARTIALLY MAPPED"
    else:
        m_status = "MAPPED"

    rate = float(boq.rate or 0.0)

    return WorkPlanBoqMappingResponse(
        id=new_mapping.id,
        work_plan_id=new_mapping.work_plan_id,
        boq_item_id=new_mapping.boq_item_id,
        project_id=new_mapping.project_id,
        mapped_quantity=float(new_mapping.mapped_quantity),
        unit=new_mapping.unit,
        created_at=new_mapping.created_at,
        updated_at=new_mapping.updated_at,
        boq_code=f"BOQ-{boq.id:03d}",
        boq_description=boq.item_name,
        boq_unit=boq.unit,
        boq_total_quantity=boq_qty,
        total_allocated_quantity=round(total_allocated_now, 2),
        remaining_quantity=round(rem_now, 2),
        rate=rate,
        estimated_amount=round(rate * payload.mapped_quantity, 2),
        mapping_status=m_status
    )


@router.put("/boq-mappings/{mapping_id}", response_model=WorkPlanBoqMappingResponse)
def update_work_plan_boq_mapping(
    mapping_id: int,
    payload: WorkPlanBoqMappingUpdate,
    db: Session = Depends(get_db)
):
    mapping = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail=f"BOQ Mapping #{mapping_id} not found.")

    if payload.mapped_quantity <= 0:
        raise HTTPException(status_code=400, detail="Mapped quantity must be strictly greater than 0.")

    boq = db.query(BoqItem).filter(BoqItem.id == mapping.boq_item_id).first()
    if not boq:
        raise HTTPException(status_code=404, detail=f"BOQ Item ID {mapping.boq_item_id} not found.")

    already_allocated_others = get_boq_total_allocated_qty(boq.id, db, exclude_mapping_id=mapping.id)
    boq_qty = float(boq.approved_qty or 0.0)
    remaining_qty = max(0.0, boq_qty - already_allocated_others)

    if payload.mapped_quantity > remaining_qty + 1e-6:
        raise HTTPException(
            status_code=400,
            detail=f"Updated quantity ({payload.mapped_quantity:.2f} {mapping.unit}) exceeds available unmapped BOQ quantity ({remaining_qty:.2f} {mapping.unit})."
        )

    mapping.mapped_quantity = payload.mapped_quantity
    mapping.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(mapping)

    total_allocated_now = already_allocated_others + payload.mapped_quantity
    rem_now = max(0.0, boq_qty - total_allocated_now)
    rate = float(boq.rate or 0.0)

    if total_allocated_now >= boq_qty:
        m_status = "FULLY ALLOCATED"
    elif total_allocated_now > 0:
        m_status = "PARTIALLY MAPPED"
    else:
        m_status = "MAPPED"

    return WorkPlanBoqMappingResponse(
        id=mapping.id,
        work_plan_id=mapping.work_plan_id,
        boq_item_id=mapping.boq_item_id,
        project_id=mapping.project_id,
        mapped_quantity=float(mapping.mapped_quantity),
        unit=mapping.unit,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at,
        boq_code=f"BOQ-{boq.id:03d}",
        boq_description=boq.item_name,
        boq_unit=boq.unit,
        boq_total_quantity=boq_qty,
        total_allocated_quantity=round(total_allocated_now, 2),
        remaining_quantity=round(rem_now, 2),
        rate=rate,
        estimated_amount=round(rate * payload.mapped_quantity, 2),
        mapping_status=m_status
    )


@router.delete("/boq-mappings/{mapping_id}")
def delete_work_plan_boq_mapping(mapping_id: int, db: Session = Depends(get_db)):
    mapping = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail=f"BOQ Mapping #{mapping_id} not found.")

    wp_id = mapping.work_plan_id
    boq_id = mapping.boq_item_id

    db.delete(mapping)
    db.commit()

    return {"detail": f"BOQ Item mapping #{mapping_id} removed successfully."}
