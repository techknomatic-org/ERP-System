from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import WbsTask, Project, BoqItem, AuditLog
from app.schemas import WbsTaskCreate, WbsTaskResponse, WbsTaskUpdate

router = APIRouter(prefix="/api/wbs", tags=["WBS Hierarchy & Gantt Timeline"])

def recalculate_project_wbs(db: Session, project_id: int):
    all_tasks = db.query(WbsTask).filter(WbsTask.project_id == project_id).all()
    if not all_tasks:
        return

    # Step 1: Calculate Tasks progress from direct Subtasks
    tasks_level = [t for t in all_tasks if (t.task_level or "").lower() == "task"]
    for task in tasks_level:
        direct_subtasks = [s for s in all_tasks if (s.task_level or "").lower() == "subtask" and s.parent_task_id == task.id]
        if direct_subtasks:
            avg_subtask_prog = sum(float(s.progress_pct) for s in direct_subtasks) / len(direct_subtasks)
            task.progress_pct = round(avg_subtask_prog, 2)
            if task.progress_pct >= 100.0:
                task.status = "completed"
            elif task.progress_pct > 0.0:
                task.status = "in_progress"
            else:
                task.status = "not_started"

    # Step 2: Calculate Phases progress from direct Tasks
    phases = [p for p in all_tasks if (p.task_level or "").lower() == "phase" or (not p.parent_task_id and (p.task_level or "").lower() != "subtask")]
    for phase in phases:
        direct_tasks = [t for t in all_tasks if (t.task_level or "").lower() == "task" and t.parent_task_id == phase.id]
        if direct_tasks:
            avg_task_prog = sum(float(t.progress_pct) for t in direct_tasks) / len(direct_tasks)
            phase.progress_pct = round(avg_task_prog, 2)
            if phase.progress_pct >= 100.0:
                phase.status = "completed"
            elif phase.progress_pct > 0.0:
                phase.status = "in_progress"
            else:
                phase.status = "not_started"

    # Step 3: Calculate overall Project progress
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        if phases:
            project.progress_pct = round(sum(float(p.progress_pct) for p in phases) / len(phases), 2)
        else:
            project.progress_pct = round(sum(float(t.progress_pct) for t in all_tasks) / len(all_tasks), 2)

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
        total = float(b.total_amount or (float(b.approved_qty) * float(b.rate)))
        b_dict = {
            "id": b.id,
            "item_name": b.item_name,
            "unit": b.unit,
            "approved_qty": float(b.approved_qty),
            "rate": float(b.rate),
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

    if task_in.title is not None and task_in.title.strip():
        task.title = task_in.title.strip()
    if task_in.contractor_name is not None:
        task.contractor_name = task_in.contractor_name.strip() or "In-House"
    if task_in.start_date is not None:
        task.start_date = task_in.start_date
    if task_in.end_date is not None:
        task.end_date = task_in.end_date
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
