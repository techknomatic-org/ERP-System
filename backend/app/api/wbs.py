from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import WbsTask, Project, BoqItem, AuditLog
from app.schemas import WbsTaskCreate, WbsTaskResponse, WbsTaskUpdate

import datetime

router = APIRouter(prefix="/api/wbs", tags=["WBS Hierarchy & Gantt Timeline"])

def to_date(val):
    if val is None:
        return None
    if isinstance(val, datetime.date) and not isinstance(val, datetime.datetime):
        return val
    if isinstance(val, datetime.datetime):
        return val.date()
    if isinstance(val, str):
        try:
            return datetime.datetime.fromisoformat(val.replace('Z', '+00:00')).date()
        except Exception:
            try:
                return datetime.datetime.strptime(val[:10], '%Y-%m-%d').date()
            except Exception:
                return None
    return None

def calculate_node_status_and_progress(start_date, end_date, executed_qty: float, planned_qty: float, fallback_prog: float = 0.0):
    """
    Evaluates WBS node status and progress based on dates:
    1. If Current Date < Start Date:
       - Status = NOT STARTED ("not_started")
       - Progress = 0%
       - Flag date inconsistency if executed_qty > 0 or fallback_prog > 0
    2. If Current Date >= Start Date AND Current Date <= End Date:
       - If executed_qty == 0 and prog == 0: Status = NOT STARTED ("not_started")
       - If executed_qty > 0 AND executed_qty < planned_qty: Status = IN PROGRESS ("in_progress")
       - If executed_qty >= planned_qty: Status = COMPLETED ("completed")
    3. If Current Date > End Date:
       - If executed_qty >= planned_qty: Status = COMPLETED ("completed")
       - If executed_qty < planned_qty: Status = DELAYED ("delayed")
    """
    today = datetime.date.today()

    s_date = to_date(start_date)
    e_date = to_date(end_date)

    has_inconsistency = False
    warning = None

    if planned_qty > 0:
        calculated_prog = round((executed_qty / planned_qty) * 100.0, 2)
    else:
        calculated_prog = round(float(fallback_prog or 0.0), 2)

    # Date Rule 1: Current Date < Start Date
    if s_date and today < s_date:
        eff_prog = 0.0
        status = "not_started"
        if executed_qty > 0 or calculated_prog > 0:
            has_inconsistency = True
            fmt_date = s_date.strftime('%B %d, %Y')
            warning = f"Executed quantity ({executed_qty:,.2f}) recorded prior to planned start date ({fmt_date}). Status remains NOT STARTED (0% progress) until start date."
        return eff_prog, status, has_inconsistency, warning

    # Date Rule 3: Current Date > End Date
    if e_date and today > e_date:
        eff_prog = min(100.0, max(0.0, calculated_prog))
        if (planned_qty > 0 and executed_qty >= planned_qty) or eff_prog >= 100.0:
            status = "completed"
        else:
            status = "delayed"
        return eff_prog, status, has_inconsistency, warning

    # Date Rule 2: Start Date <= Current Date <= End Date (Active Period)
    eff_prog = min(100.0, max(0.0, calculated_prog))
    if (planned_qty > 0 and executed_qty >= planned_qty) or eff_prog >= 100.0:
        status = "completed"
    elif executed_qty > 0 or eff_prog > 0:
        status = "in_progress"
    else:
        status = "not_started"

    return eff_prog, status, has_inconsistency, warning


def recalculate_project_wbs(db: Session, project_id: int):
    all_tasks = db.query(WbsTask).filter(WbsTask.project_id == project_id).all()
    if not all_tasks:
        return

    all_boqs = db.query(BoqItem).filter(BoqItem.project_id == project_id).all()

    # Step 0: Calculate status and progress for Leaf Nodes
    for task in all_tasks:
        child_subtasks = [s for s in all_tasks if s.parent_task_id == task.id]
        if not child_subtasks:
            # Check BOQs linked to this leaf node
            linked_boqs = [b for b in all_boqs if (b.subtask_id == task.id or (not b.subtask_id and b.task_id == task.id) or (not b.subtask_id and not b.task_id and b.phase_id == task.id))]
            
            if linked_boqs:
                from app.models import SiteDailyLog
                tot_exec = 0.0
                tot_planned = 0.0
                for b in linked_boqs:
                    valid_logs = db.query(SiteDailyLog).filter(
                        SiteDailyLog.boq_item_id == b.id,
                        SiteDailyLog.approval_status != "rejected"
                    ).all()
                    tot_exec += sum(float(l.executed_qty or 0.0) for l in valid_logs)
                    tot_planned += float(b.approved_qty or 0.0)

                task.actual_qty = tot_exec
                if tot_planned > 0:
                    task.planned_qty = tot_planned
                
                prog, status, has_inc, warn = calculate_node_status_and_progress(
                    task.start_date, task.end_date, tot_exec, tot_planned, fallback_prog=float(task.progress_pct or 0.0)
                )
            else:
                tot_exec = float(task.actual_qty or 0.0)
                tot_planned = float(task.planned_qty or 0.0)
                prog, status, has_inc, warn = calculate_node_status_and_progress(
                    task.start_date, task.end_date, tot_exec, tot_planned, fallback_prog=float(task.progress_pct or 0.0)
                )

            task.progress_pct = prog
            task.status = status
            task.has_date_inconsistency = has_inc
            task.inconsistency_warning = warn

    # Step 1: Calculate Tasks/Activities progress from direct Subtasks (bottom-up)
    tasks_level = [t for t in all_tasks if (t.task_level or "").lower() in ["task", "activity"]]
    for task in tasks_level:
        direct_subtasks = [s for s in all_tasks if s.parent_task_id == task.id]
        if direct_subtasks:
            avg_subtask_prog = sum(float(s.progress_pct or 0.0) for s in direct_subtasks) / len(direct_subtasks)
            subtask_starts = [s.start_date for s in direct_subtasks if s.start_date]
            subtask_ends = [s.end_date for s in direct_subtasks if s.end_date]
            
            eff_start = min(subtask_starts) if subtask_starts else task.start_date
            eff_end = max(subtask_ends) if subtask_ends else task.end_date
            tot_exec = sum(float(s.actual_qty or 0.0) for s in direct_subtasks)
            tot_planned = sum(float(s.planned_qty or 0.0) for s in direct_subtasks)

            prog, status, has_inc, warn = calculate_node_status_and_progress(
                eff_start, eff_end, tot_exec, tot_planned, fallback_prog=avg_subtask_prog
            )
            task.progress_pct = prog
            task.status = status
            task.has_date_inconsistency = has_inc or any(getattr(s, 'has_date_inconsistency', False) for s in direct_subtasks)
            task.inconsistency_warning = warn

    # Step 2: Calculate Phases progress from direct child nodes (bottom-up)
    phases = [p for p in all_tasks if (p.task_level or "").lower() == "phase" or not p.parent_task_id]
    for phase in phases:
        direct_tasks = [t for t in all_tasks if t.parent_task_id == phase.id]
        if direct_tasks:
            avg_task_prog = sum(float(t.progress_pct or 0.0) for t in direct_tasks) / len(direct_tasks)
            task_starts = [t.start_date for t in direct_tasks if t.start_date]
            task_ends = [t.end_date for t in direct_tasks if t.end_date]

            eff_start = min(task_starts) if task_starts else phase.start_date
            eff_end = max(task_ends) if task_ends else phase.end_date
            tot_exec = sum(float(t.actual_qty or 0.0) for t in direct_tasks)
            tot_planned = sum(float(t.planned_qty or 0.0) for t in direct_tasks)

            prog, status, has_inc, warn = calculate_node_status_and_progress(
                eff_start, eff_end, tot_exec, tot_planned, fallback_prog=avg_task_prog
            )
            phase.progress_pct = prog
            phase.status = status
            phase.has_date_inconsistency = has_inc or any(getattr(t, 'has_date_inconsistency', False) for t in direct_tasks)
            phase.inconsistency_warning = warn

    # Step 3: Calculate overall Project progress
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        if phases:
            project.progress_pct = round(sum(float(p.progress_pct or 0.0) for p in phases) / len(phases), 2)
        else:
            project.progress_pct = round(sum(float(t.progress_pct or 0.0) for t in all_tasks) / len(all_tasks), 2)

    db.commit()

@router.get("/project/{project_id}", response_model=List[WbsTaskResponse])
def get_project_wbs_tasks(project_id: int, db: Session = Depends(get_db)):
    recalculate_project_wbs(db, project_id)
    tasks = db.query(WbsTask).filter(WbsTask.project_id == project_id).order_by(WbsTask.id.asc()).all()
    
    # Load all BOQ items for this project
    boqs = db.query(BoqItem).filter(BoqItem.project_id == project_id).all()
    
    # Pre-build lookup dictionary for BOQ items by WBS IDs
    boq_by_subtask = {}
    boq_by_task = {}
    boq_by_phase = {}

    for b in boqs:
        from app.models import SiteDailyLog
        valid_logs = db.query(SiteDailyLog).filter(
            SiteDailyLog.boq_item_id == b.id,
            SiteDailyLog.approval_status != "rejected"
        ).all()
        exec_q = sum(float(l.executed_qty or 0.0) for l in valid_logs)
        appr_q = float(b.approved_qty or 0.0)
        rem_q = max(0.0, appr_q - exec_q)
        prog_p = round((exec_q / appr_q * 100.0), 2) if appr_q > 0 else 0.0

        w_code = b.subtask.wbs_code if (b.subtask and b.subtask.wbs_code) else (b.task.wbs_code if (b.task and b.task.wbs_code) else (b.phase.wbs_code if (b.phase and b.phase.wbs_code) else None))
        total = float(b.total_amount or (appr_q * float(b.rate or 0.0)))
        b_dict = {
            "id": b.id,
            "item_name": b.item_name,
            "unit": b.unit,
            "approved_qty": appr_q,
            "executed_qty": exec_q,
            "remaining_qty": rem_q,
            "progress_pct": prog_p,
            "wbs_code": w_code,
            "rate": float(b.rate or 0.0),
            "total_amount": total,
            "contractor_name": b.contractor_name or (b.vendor.name if b.vendor else "Unassigned")
        }
        if b.subtask_id:
            boq_by_subtask.setdefault(b.subtask_id, []).append(b_dict)
        elif b.task_id:
            boq_by_task.setdefault(b.task_id, []).append(b_dict)
        elif b.phase_id:
            boq_by_phase.setdefault(b.phase_id, []).append(b_dict)

    task_map = {t.id: t for t in tasks}

    # Calculate Required Till Now bottom-up
    # 1. Subtasks
    subtask_req = {}
    subtask_boqs = {}
    for t in tasks:
        if (t.task_level or "").lower() == "subtask":
            linked = boq_by_subtask.get(t.id, [])
            subtask_req[t.id] = sum(b["total_amount"] for b in linked)
            subtask_boqs[t.id] = linked

    # 2. Tasks
    task_req = {}
    task_boqs = {}
    for t in tasks:
        if (t.task_level or "").lower() == "task":
            child_subtasks = [s for s in tasks if (s.task_level or "").lower() == "subtask" and s.parent_task_id == t.id]
            direct_boqs = boq_by_task.get(t.id, [])
            
            if child_subtasks:
                req_sum = sum(subtask_req.get(s.id, 0.0) for s in child_subtasks) + sum(b["total_amount"] for b in direct_boqs)
                all_boqs = direct_boqs + [b for s in child_subtasks for b in subtask_boqs.get(s.id, [])]
            else:
                req_sum = sum(b["total_amount"] for b in direct_boqs)
                all_boqs = direct_boqs

            task_req[t.id] = req_sum
            task_boqs[t.id] = all_boqs

    # 3. Phases
    phase_req = {}
    phase_boqs = {}
    for t in tasks:
        if (t.task_level or "").lower() == "phase" or (not t.parent_task_id and (t.task_level or "").lower() != "subtask"):
            child_tasks = [tk for tk in tasks if (tk.task_level or "").lower() == "task" and tk.parent_task_id == t.id]
            direct_boqs = boq_by_phase.get(t.id, [])
            
            if child_tasks:
                req_sum = sum(task_req.get(tk.id, 0.0) for tk in child_tasks) + sum(b["total_amount"] for b in direct_boqs)
                all_boqs = direct_boqs + [b for tk in child_tasks for b in task_boqs.get(tk.id, [])]
            else:
                req_sum = sum(b["total_amount"] for b in direct_boqs)
                all_boqs = direct_boqs

            phase_req[t.id] = req_sum
            phase_boqs[t.id] = all_boqs

    # Attach computed metrics to task objects
    for t in tasks:
        lvl = (t.task_level or "").lower()
        if lvl == "subtask":
            req = subtask_req.get(t.id, 0.0)
            boq_list = subtask_boqs.get(t.id, [])
        elif lvl == "task":
            req = task_req.get(t.id, 0.0)
            boq_list = task_boqs.get(t.id, [])
        else:
            req = phase_req.get(t.id, 0.0)
            boq_list = phase_boqs.get(t.id, [])

        planned = float(t.planned_budget or 0.0)
        remaining = planned - req
        utilization = (req / planned * 100.0) if planned > 0 else 0.0

        t.required_till_now = round(req, 2)
        t.remaining_budget = round(remaining, 2)
        t.budget_utilization_pct = round(utilization, 2)
        t.linked_boqs = boq_list
        t.has_date_inconsistency = getattr(t, 'has_date_inconsistency', False)
        t.inconsistency_warning = getattr(t, 'inconsistency_warning', None)
        t.is_published = getattr(t, 'is_published', False)
        
        if getattr(t, 'boq_item_id', None) and not boq_list:
            b_item = db.query(BoqItem).filter(BoqItem.id == t.boq_item_id).first()
            if b_item:
                t.boq_item_name = b_item.item_name
                t.linked_boqs = [{
                    "id": b_item.id,
                    "item_name": b_item.item_name,
                    "unit": b_item.unit,
                    "approved_qty": float(b_item.approved_qty or 0),
                    "executed_qty": 0.0,
                    "remaining_qty": float(b_item.approved_qty or 0),
                    "progress_pct": 0.0,
                    "rate": float(b_item.rate or 0),
                    "total_amount": float(b_item.total_amount or 0),
                    "contractor_name": b_item.contractor_name or "Unassigned"
                }]
        elif boq_list:
            t.boq_item_name = boq_list[0].get("item_name")

    return tasks

def validate_no_circular_parent(db: Session, node_id: Optional[int], proposed_parent_id: Optional[int]):
    """
    Rule 1 — Tree Structure / Circular Reference Protection:
    Traverse proposed parent chain to ensure node never becomes its own ancestor.
    """
    if not proposed_parent_id:
        return
    if node_id and proposed_parent_id == node_id:
        raise HTTPException(status_code=400, detail="Circular parent assignment is not allowed.")
    
    current_id = proposed_parent_id
    visited = set()
    if node_id:
        visited.add(node_id)
    
    while current_id:
        if current_id in visited:
            raise HTTPException(status_code=400, detail="Circular parent assignment is not allowed.")
        visited.add(current_id)
        parent_node = db.query(WbsTask).filter(WbsTask.id == current_id).first()
        if not parent_node:
            break
        current_id = parent_node.parent_task_id

def validate_node_date_range(db: Session, node_id: Optional[int], parent_id: Optional[int], start_date, end_date):
    """
    Rule 2 — Child Date Range Validation:
    Enforce node.start_date <= node.end_date and parent.start_date <= child.start_date <= child.end_date <= parent.end_date.
    Also revalidate existing children if parent's date range is modified.
    """
    s_date = to_date(start_date)
    e_date = to_date(end_date)

    if s_date and e_date and s_date > e_date:
        raise HTTPException(status_code=400, detail="Child start date cannot be after end date.")

    if parent_id and s_date and e_date:
        parent = db.query(WbsTask).filter(WbsTask.id == parent_id).first()
        if parent:
            p_start = to_date(parent.start_date)
            p_end = to_date(parent.end_date)
            if p_start and p_end:
                if s_date < p_start or e_date > p_end:
                    raise HTTPException(
                        status_code=400,
                        detail="Child date range must fall within the parent's planned date range."
                    )

    if node_id and s_date and e_date:
        children = db.query(WbsTask).filter(WbsTask.parent_task_id == node_id).all()
        for child in children:
            c_start = to_date(child.start_date)
            c_end = to_date(child.end_date)
            if c_start and c_end:
                if c_start < s_date or c_end > e_date:
                    raise HTTPException(
                        status_code=400,
                        detail="Child date range must fall within the parent's planned date range."
                    )


def validate_boq_reference(db: Session, project_id: int, boq_item_id: Optional[int]):
    """
    BOQ Reference Project & Tenant Isolation Validation
    """
    if not boq_item_id:
        return None
    boq = db.query(BoqItem).filter(BoqItem.id == boq_item_id).first()
    if not boq:
        raise HTTPException(status_code=404, detail="Selected BOQ item does not exist.")
    if boq.project_id != project_id:
        raise HTTPException(status_code=400, detail="Selected BOQ item does not belong to this project.")
    return boq

@router.post("/tasks", response_model=WbsTaskResponse)
def create_wbs_task(task_in: WbsTaskCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == task_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not task_in.title or not task_in.title.strip():
        raise HTTPException(status_code=400, detail="WBS Node Name cannot be blank.")

    # Determine level/type
    node_type = (task_in.node_type or task_in.task_level or "Task").strip()
    norm_type = node_type.upper()

    # Rule 1 — Circular Reference Check
    if task_in.parent_task_id:
        parent = db.query(WbsTask).filter(WbsTask.id == task_in.parent_task_id, WbsTask.project_id == task_in.project_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Selected Parent Node not found or does not belong to this project.")
        validate_no_circular_parent(db, None, task_in.parent_task_id)

    # Rule 2 — Date Range Check
    validate_node_date_range(db, None, task_in.parent_task_id, task_in.start_date, task_in.end_date)

    # BOQ Reference Isolation Check
    if task_in.boq_item_id:
        validate_boq_reference(db, task_in.project_id, task_in.boq_item_id)

    task_data = task_in.model_dump()
    task_data["task_level"] = norm_type
    if "node_type" in task_data:
        del task_data["node_type"]

    task = WbsTask(**task_data)
    db.add(task)
    db.commit()
    db.refresh(task)

    # Run bottom-up progress recalculation
    recalculate_project_wbs(db, project.id)
    db.refresh(task)
    return task

@router.put("/tasks/{task_id}", response_model=WbsTaskResponse)
def update_wbs_task(task_id: int, task_in: WbsTaskUpdate, db: Session = Depends(get_db)):
    task = db.query(WbsTask).filter(WbsTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="WBS Task not found")

    if task_in.title is not None and not task_in.title.strip():
        raise HTTPException(status_code=400, detail="WBS Node Name cannot be blank.")

    new_parent_id = task_in.parent_task_id if task_in.parent_task_id is not None else task.parent_task_id
    new_start = task_in.start_date if task_in.start_date is not None else task.start_date
    new_end = task_in.end_date if task_in.end_date is not None else task.end_date

    # Rule 1 — Circular Reference Check
    if task_in.parent_task_id is not None:
        validate_no_circular_parent(db, task.id, task_in.parent_task_id)

    # Rule 2 — Date Range Check
    validate_node_date_range(db, task.id, new_parent_id, new_start, new_end)

    # BOQ Reference Isolation Check
    if task_in.boq_item_id is not None and task_in.boq_item_id > 0:
        validate_boq_reference(db, task.project_id, task_in.boq_item_id)

    if task_in.wbs_code is not None and task_in.wbs_code.strip():
        task.wbs_code = task_in.wbs_code.strip()
    if task_in.title is not None and task_in.title.strip():
        task.title = task_in.title.strip()
    if task_in.parent_task_id is not None:
        task.parent_task_id = task_in.parent_task_id
    if task_in.node_type or task_in.task_level:
        n_type = (task_in.node_type or task_in.task_level).strip().upper()
        task.task_level = n_type
    if task_in.boq_item_id is not None:
        task.boq_item_id = task_in.boq_item_id if task_in.boq_item_id > 0 else None
    if task_in.contractor_name is not None:
        task.contractor_name = task_in.contractor_name.strip()
    if task_in.start_date is not None:
        task.start_date = task_in.start_date
    if task_in.end_date is not None:
        task.end_date = task_in.end_date
    if task_in.planned_qty is not None:
        task.planned_qty = max(0.0, float(task_in.planned_qty))
    if task_in.planned_budget is not None:
        task.planned_budget = max(0.0, float(task_in.planned_budget))

    # Progress % update rule: only direct update if item has no child items
    if task_in.progress_pct is not None:
        children = db.query(WbsTask).filter(WbsTask.parent_task_id == task_id).all()
        if not children:
            task.progress_pct = max(0.0, min(100.0, float(task_in.progress_pct)))
            if task.progress_pct >= 100.0:
                task.status = "completed"
            elif task.progress_pct > 0.0:
                task.status = "in_progress"
            else:
                task.status = "not_started"

    db.commit()

    # Run bottom-up recalculation for progress & budget rollups
    recalculate_project_wbs(db, task.project_id)
    db.refresh(task)
    return task

@router.put("/tasks/{task_id}/progress")
def update_task_progress(task_id: int, progress_pct: float, actual_qty: float = None, actual_cost: float = None, db: Session = Depends(get_db)):
    task = db.query(WbsTask).filter(WbsTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="WBS Task not found")

    # Check if task has child items
    children = db.query(WbsTask).filter(WbsTask.parent_task_id == task_id).all()
    if children:
        raise HTTPException(
            status_code=400, 
            detail="Progress for this item is automatically calculated from its child items and cannot be manually overridden."
        )

    task.progress_pct = progress_pct
    if actual_qty is not None:
        task.actual_qty = actual_qty
    if actual_cost is not None:
        task.actual_cost = actual_cost

    if progress_pct >= 100:
        task.status = "completed"
    elif progress_pct > 0:
        task.status = "in_progress"
    else:
        task.status = "not_started"

    db.commit()

    # Bottom-up progress recalculation
    recalculate_project_wbs(db, task.project_id)
    db.refresh(task)

    return {"message": "WBS Task progress updated", "task_id": task.id, "progress_pct": float(task.progress_pct), "status": task.status}

@router.post("/project/{project_id}/publish")
def publish_project_wbs(project_id: int, db: Session = Depends(get_db)):
    """
    Rule 3 — BOQ Required Before Publish:
    Load all WBS nodes for project and verify every node has a BOQ reference.
    If any node lacks BOQ reference, block publish and return HTTP 400 listing missing node(s).
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    nodes = db.query(WbsTask).filter(WbsTask.project_id == project_id).all()
    if not nodes:
        raise HTTPException(status_code=400, detail="Cannot publish Work Plan. No WBS nodes found for this project.")
    
    missing_boq_nodes = []
    for node in nodes:
        has_boq = False
        if getattr(node, 'boq_item_id', None):
            has_boq = True
        else:
            linked = db.query(BoqItem).filter(
                (BoqItem.subtask_id == node.id) | (BoqItem.task_id == node.id) | (BoqItem.phase_id == node.id)
            ).first()
            if linked:
                has_boq = True
        
        if not has_boq:
            missing_boq_nodes.append(node.title)
    
    if missing_boq_nodes:
        count = len(missing_boq_nodes)
        names_str = ", ".join(missing_boq_nodes[:5])
        if count > 5:
            names_str += f" and {count - 5} more"
        raise HTTPException(
            status_code=400,
            detail=f"Cannot publish Work Plan. BOQ Reference is missing for {count} node{'s' if count > 1 else ''} ({names_str})."
        )
    
    # Transactional Publish update
    for node in nodes:
        node.is_published = True
    
    db.commit()
    return {
        "message": f"Work Plan for project #{project_id} published successfully.",
        "published_node_count": len(nodes)
    }

@router.delete("/tasks/{task_id}")
def delete_wbs_task(task_id: int, db: Session = Depends(get_db)):
    """
    Rule 4 — Parent Delete Protection:
    If a parent node has children, block deletion with exact message "Reassign or delete child nodes first."
    """
    task = db.query(WbsTask).filter(WbsTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="WBS Task not found")
    
    child_count = db.query(WbsTask).filter(WbsTask.parent_task_id == task_id).count()
    if child_count > 0:
        raise HTTPException(status_code=400, detail="Reassign or delete child nodes first.")
    
    project_id = task.project_id
    db.delete(task)
    db.commit()

    # Recalculate remaining tree progress
    recalculate_project_wbs(db, project_id)

    return {"message": f"WBS Task #{task_id} deleted successfully"}

@router.delete("/project/{project_id}")
def delete_project_wbs_tasks(project_id: int, db: Session = Depends(get_db)):
    tasks = db.query(WbsTask).filter(WbsTask.project_id == project_id).all()
    for t in tasks:
        db.delete(t)
    db.commit()
    return {"message": f"All WBS items deleted for project #{project_id}"}
