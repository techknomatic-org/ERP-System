from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import WbsTask, Project, BoqItem, AuditLog
from app.schemas import WbsTaskCreate, WbsTaskResponse, WbsTaskUpdate

import datetime

router = APIRouter(prefix="/api/wbs", tags=["WBS Hierarchy & Gantt Timeline"])

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

    s_date = start_date.date() if isinstance(start_date, datetime.datetime) else start_date
    e_date = end_date.date() if isinstance(end_date, datetime.datetime) else end_date

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

    # Step 1: Calculate Tasks progress from direct Subtasks (bottom-up)
    tasks_level = [t for t in all_tasks if (t.task_level or "").lower() == "task"]
    for task in tasks_level:
        direct_subtasks = [s for s in all_tasks if (s.task_level or "").lower() == "subtask" and s.parent_task_id == task.id]
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

    # Step 2: Calculate Phases progress from direct Tasks (bottom-up)
    phases = [p for p in all_tasks if (p.task_level or "").lower() == "phase" or (not p.parent_task_id and (p.task_level or "").lower() != "subtask")]
    for phase in phases:
        direct_tasks = [t for t in all_tasks if (t.task_level or "").lower() == "task" and t.parent_task_id == phase.id]
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

    return tasks

@router.post("/tasks", response_model=WbsTaskResponse)
def create_wbs_task(task_in: WbsTaskCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == task_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    level = (task_in.task_level or "Task").strip()

    # Validation Rules
    if level.lower() == "task":
        if not task_in.parent_task_id:
            raise HTTPException(status_code=400, detail="Parent Phase is required for a Task.")
        parent = db.query(WbsTask).filter(WbsTask.id == task_in.parent_task_id, WbsTask.project_id == task_in.project_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Selected Parent Phase not found or does not belong to this project.")
    elif level.lower() == "subtask":
        if not task_in.parent_task_id:
            raise HTTPException(status_code=400, detail="Parent Task is required for a Subtask.")
        parent = db.query(WbsTask).filter(WbsTask.id == task_in.parent_task_id, WbsTask.project_id == task_in.project_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Selected Parent Task not found or does not belong to this project.")
    elif level.lower() == "phase":
        task_in.parent_task_id = None

    task = WbsTask(**task_in.model_dump())
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

    if task_in.start_date and task_in.end_date and task_in.start_date > task_in.end_date:
        raise HTTPException(status_code=400, detail="Start Date cannot be after End Date.")

    if task_in.wbs_code is not None and task_in.wbs_code.strip():
        task.wbs_code = task_in.wbs_code.strip()
    if task_in.title is not None and task_in.title.strip():
        task.title = task_in.title.strip()
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

@router.delete("/tasks/{task_id}")
def delete_wbs_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(WbsTask).filter(WbsTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="WBS Task not found")
    
    project_id = task.project_id

    # Delete child subtasks / tasks recursively to prevent orphaned records
    child_tasks = db.query(WbsTask).filter(WbsTask.parent_task_id == task_id).all()
    for child in child_tasks:
        grand_children = db.query(WbsTask).filter(WbsTask.parent_task_id == child.id).all()
        for gc in grand_children:
            db.delete(gc)
        db.delete(child)
    
    db.delete(task)
    db.commit()

    # Recalculate remaining tree progress
    recalculate_project_wbs(db, project_id)

    return {"message": f"WBS Task #{task_id} and its child items deleted successfully"}

@router.delete("/project/{project_id}")
def delete_project_wbs_tasks(project_id: int, db: Session = Depends(get_db)):
    tasks = db.query(WbsTask).filter(WbsTask.project_id == project_id).all()
    for t in tasks:
        db.delete(t)
    db.commit()
    return {"message": f"All WBS items deleted for project #{project_id}"}
