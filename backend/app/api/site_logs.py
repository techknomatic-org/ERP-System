import os
import uuid
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Header, File, UploadFile, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import (
    SiteDailyLog, DailyTaskMonitoring, WorkPlan, WorkPlanBoqMapping, ApprovalTask, AuditLog, 
    Notification, Project, BoqItem, MeasurementBook, WbsTask, SiteLogPhoto, User
)
from app.schemas import SiteDailyLogCreate, SiteDailyLogResponse, SiteLogPhotoResponse
from app.api.wbs import recalculate_project_wbs
from app.api.work_plans import is_unit_compatible

router = APIRouter(prefix="/api/site-logs", tags=["Site Progress & Daily Logs"])

UPLOAD_PHOTOS_DIR = "uploads/site_photos"
os.makedirs(UPLOAD_PHOTOS_DIR, exist_ok=True)

def build_site_log_response(log: SiteDailyLog, db: Session) -> dict:
    # Fetch attached photos
    db_photos = db.query(SiteLogPhoto).filter(SiteLogPhoto.site_log_id == log.id).all()
    photos_list = []
    for p in db_photos:
        uploader = db.query(User).filter(User.id == p.uploaded_by_id).first()
        prj = db.query(Project).filter(Project.id == p.project_id).first()
        phase_task = db.query(WbsTask).filter(WbsTask.id == p.phase_id).first() if p.phase_id else None
        t_task = db.query(WbsTask).filter(WbsTask.id == p.task_id).first() if p.task_id else None
        photos_list.append({
            "id": p.id,
            "site_log_id": p.site_log_id,
            "project_id": p.project_id,
            "phase_id": p.phase_id,
            "task_id": p.task_id,
            "subtask_id": p.subtask_id,
            "boq_item_id": p.boq_item_id,
            "file_name": p.file_name,
            "file_path": p.file_path,
            "file_size": p.file_size or 0,
            "file_type": p.file_type,
            "caption": p.caption,
            "uploaded_by_id": p.uploaded_by_id,
            "created_at": p.created_at,
            "uploader_name": uploader.full_name if uploader else "Site Engineer",
            "project_name": prj.name if prj else None,
            "phase_name": phase_task.title if phase_task else None,
            "task_name": t_task.title if t_task else None
        })

    # Fetch Monitored Daily Tasks
    db_daily_tasks = db.query(DailyTaskMonitoring).filter(DailyTaskMonitoring.daily_site_log_id == log.id).all()
    daily_tasks_list = []
    for dt in db_daily_tasks:
        wp = db.query(WorkPlan).filter(WorkPlan.id == dt.work_plan_id).first()
        boq_m = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.id == dt.boq_mapping_id).first() if dt.boq_mapping_id else None
        boq = db.query(BoqItem).filter(BoqItem.id == (dt.boq_item_id or (boq_m.boq_item_id if boq_m else None))).first()

        phase = db.query(WbsTask).filter(WbsTask.id == wp.wbs_phase_id).first() if wp else None
        task = db.query(WbsTask).filter(WbsTask.id == wp.task_id).first() if wp else None
        subtask = db.query(WbsTask).filter(WbsTask.id == wp.subtask_id).first() if (wp and wp.subtask_id) else None

        log_d = dt.log_date or log.log_date
        is_future = False
        is_delayed = False
        warn_msg = None

        if wp and log_d:
            if log_d.date() < wp.planned_start_date.date():
                is_future = True
                warn_msg = f"This activity has not started according to the Work Plan (Planned start: {wp.planned_start_date.strftime('%Y-%m-%d')})."
            elif log_d.date() > wp.planned_end_date.date():
                is_delayed = True
                warn_msg = f"Activity is past its planned end date ({wp.planned_end_date.strftime('%Y-%m-%d')})."

        daily_tasks_list.append({
            "id": dt.id,
            "daily_site_log_id": dt.daily_site_log_id,
            "project_id": dt.project_id,
            "work_plan_id": dt.work_plan_id,
            "boq_mapping_id": dt.boq_mapping_id,
            "boq_item_id": dt.boq_item_id,
            "log_date": dt.log_date,
            "task_status": dt.task_status,
            "executed_quantity": float(dt.executed_quantity or 0.0),
            "unit": dt.unit,
            "execution_notes": dt.execution_notes,
            "delay_reason": dt.delay_reason,
            "created_by_id": dt.created_by_id,
            "created_at": dt.created_at,
            "updated_at": dt.updated_at,
            "work_plan_number": wp.work_plan_number if wp else None,
            "activity_name": wp.activity_name if wp else None,
            "work_plan_name": wp.activity_name if wp else None,
            "wbs_phase_id": wp.wbs_phase_id if wp else None,
            "task_id": wp.task_id if wp else None,
            "subtask_id": wp.subtask_id if wp else None,
            "phase_name": phase.title if phase else None,
            "task_name": task.title if task else None,
            "subtask_name": subtask.title if subtask else None,
            "planned_quantity": float(wp.planned_quantity) if wp else 0.0,
            "planned_start_date": wp.planned_start_date if wp else None,
            "planned_end_date": wp.planned_end_date if wp else None,
            "priority": wp.priority if wp else None,
            "boq_code": f"BOQ-{boq.id}" if boq else None,
            "boq_description": boq.item_name if boq else None,
            "is_future_activity": is_future,
            "is_delayed_activity": is_delayed,
            "warning_message": warn_msg
        })

    # Fetch WBS Names from explicit phase/task/subtask or wbs_task_id
    phase_name = None
    task_name = None
    subtask_name = None

    if log.phase_id:
        ph = db.query(WbsTask).filter(WbsTask.id == log.phase_id).first()
        if ph: phase_name = ph.title
    if log.task_id:
        tk = db.query(WbsTask).filter(WbsTask.id == log.task_id).first()
        if tk: task_name = tk.title
    if log.subtask_id:
        st = db.query(WbsTask).filter(WbsTask.id == log.subtask_id).first()
        if st: subtask_name = st.title

    if not phase_name and not task_name and not subtask_name and log.wbs_task_id:
        wbs_node = db.query(WbsTask).filter(WbsTask.id == log.wbs_task_id).first()
        if wbs_node:
            if wbs_node.task_level == 'Phase':
                phase_name = wbs_node.title
            elif wbs_node.task_level == 'Task':
                task_name = wbs_node.title
                parent = db.query(WbsTask).filter(WbsTask.id == wbs_node.parent_task_id).first()
                if parent: phase_name = parent.title
            elif wbs_node.task_level == 'Subtask':
                subtask_name = wbs_node.title
                parent_task = db.query(WbsTask).filter(WbsTask.id == wbs_node.parent_task_id).first()
                if parent_task:
                    task_name = parent_task.title
                    parent_phase = db.query(WbsTask).filter(WbsTask.id == parent_task.parent_task_id).first()
                    if parent_phase: phase_name = parent_phase.title

    wbs_code = None
    wbs_node_ref = None
    target_wbs_id = log.subtask_id or log.task_id or log.phase_id or log.wbs_task_id
    if target_wbs_id:
        wbs_node_ref = db.query(WbsTask).filter(WbsTask.id == target_wbs_id).first()
        if wbs_node_ref:
            wbs_code = wbs_node_ref.wbs_code

    is_out_of_schedule = False
    schedule_warning = None
    if wbs_node_ref and wbs_node_ref.start_date and wbs_node_ref.end_date:
        log_d = log.log_date or log.created_at
        if log_d:
            if log_d.date() < wbs_node_ref.start_date.date() or log_d.date() > wbs_node_ref.end_date.date():
                is_out_of_schedule = True
                schedule_warning = f"Warning: Log date ({log_d.strftime('%d-%b-%Y')}) is outside scheduled timeframe ({wbs_node_ref.start_date.strftime('%d-%b-%Y')} to {wbs_node_ref.end_date.strftime('%d-%b-%Y')})."

    resp = {
        "id": log.id,
        "project_id": log.project_id,
        "phase_id": log.phase_id,
        "task_id": log.task_id,
        "subtask_id": log.subtask_id,
        "wbs_code": wbs_code,
        "is_out_of_schedule": is_out_of_schedule,
        "schedule_warning": schedule_warning,
        "engineer_id": log.engineer_id,
        "log_date": log.log_date,
        "physical_progress": log.physical_progress,
        "labour_count": log.labour_count,
        "materials_consumed": log.materials_consumed,
        "equipment_used": log.equipment_used,
        "issues_identified": log.issues_identified,
        "remarks": log.remarks,
        "approval_status": log.approval_status,
        "wbs_task_id": log.wbs_task_id,
        "boq_item_id": log.boq_item_id,
        "executed_qty": float(log.executed_qty or 0.0),
        "created_at": log.created_at,

        "boq_item_name": None,
        "unit": None,
        "approved_qty": 0.0,
        "prev_executed_qty": 0.0,
        "new_cumulative_qty": 0.0,
        "total_executed_qty": 0.0,
        "remaining_qty": 0.0,
        "execution_pct": 0.0,
        "photos": photos_list,
        "daily_tasks": daily_tasks_list,
        "execution_history": [],
        "phase_name": phase_name,
        "task_name": task_name,
        "subtask_name": subtask_name
    }

    execution_history = []
    if log.boq_item_id:
        boq = db.query(BoqItem).filter(BoqItem.id == log.boq_item_id).first()
        if boq:
            resp["boq_item_name"] = boq.item_name
            resp["unit"] = boq.unit
            resp["approved_qty"] = float(boq.approved_qty)

            # Query all valid daily site logs for this BOQ item in ascending chronological order (excluding rejected)
            boq_logs = db.query(SiteDailyLog).filter(
                SiteDailyLog.boq_item_id == boq.id,
                SiteDailyLog.approval_status != "rejected"
            ).order_by(SiteDailyLog.id.asc()).all()

            running_cumulative = 0.0
            log_found_cumulative = 0.0
            log_found_prev = 0.0

            for l_item in boq_logs:
                l_eng = db.query(User).filter(User.id == l_item.engineer_id).first()
                item_qty = float(l_item.executed_qty or 0.0)
                running_cumulative += item_qty

                if l_item.id == log.id:
                    log_found_cumulative = running_cumulative
                    log_found_prev = running_cumulative - item_qty

                execution_history.append({
                    "id": l_item.id,
                    "log_date": l_item.log_date,
                    "today_executed_qty": item_qty,
                    "cumulative_qty": round(running_cumulative, 2),
                    "approval_status": l_item.approval_status,
                    "engineer_name": l_eng.full_name if l_eng else f"Engineer #{l_item.engineer_id}"
                })

            total_executed = running_cumulative
            approved_qty = float(boq.approved_qty)

            resp["total_executed_qty"] = round(total_executed, 2)
            resp["prev_executed_qty"] = round(log_found_prev, 2)
            resp["new_cumulative_qty"] = round(log_found_cumulative if log_found_cumulative > 0 else running_cumulative, 2)
            resp["remaining_qty"] = round(max(0.0, approved_qty - total_executed), 2)
            resp["execution_pct"] = round((total_executed / approved_qty * 100.0) if approved_qty > 0 else 0.0, 2)
            resp["execution_history"] = execution_history

    return resp

def process_and_save_daily_tasks(site_log: SiteDailyLog, daily_tasks_input, engineer_id: int, db: Session):
    if not daily_tasks_input:
        return

    for dt in daily_tasks_input:
        if isinstance(dt, dict):
            dt_project_id = dt.get('project_id') or site_log.project_id
            wp_id = dt.get('work_plan_id')
            bm_id = dt.get('boq_mapping_id')
            boq_item_id_in = dt.get('boq_item_id')
            exec_qty_in = dt.get('executed_quantity', 0.0)
            unit_in = dt.get('unit')
            log_date_in = dt.get('log_date')
            task_status_in = dt.get('task_status')
            execution_notes_in = dt.get('execution_notes')
            delay_reason_in = dt.get('delay_reason')
        else:
            dt_project_id = getattr(dt, 'project_id', None) or site_log.project_id
            wp_id = getattr(dt, 'work_plan_id', None)
            bm_id = getattr(dt, 'boq_mapping_id', None)
            boq_item_id_in = getattr(dt, 'boq_item_id', None)
            exec_qty_in = getattr(dt, 'executed_quantity', 0.0)
            unit_in = getattr(dt, 'unit', None)
            log_date_in = getattr(dt, 'log_date', None)
            task_status_in = getattr(dt, 'task_status', None)
            execution_notes_in = getattr(dt, 'execution_notes', None)
            delay_reason_in = getattr(dt, 'delay_reason', None)

        if dt_project_id != site_log.project_id:
            raise HTTPException(
                status_code=400,
                detail=f"Project mismatch: Daily Task Monitoring entry project ID ({dt_project_id}) does not match Daily Log project ID ({site_log.project_id})."
            )

        if not wp_id:
            continue

        wp = db.query(WorkPlan).filter(WorkPlan.id == wp_id).first()
        if not wp:
            raise HTTPException(status_code=404, detail=f"Work Plan Activity #{wp_id} not found.")
        if wp.project_id != site_log.project_id:
            raise HTTPException(
                status_code=400,
                detail=f"Work Plan Activity '{wp.activity_name}' does not belong to project ID {site_log.project_id}."
            )

        bm = None
        if bm_id:
            bm = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.id == bm_id).first()
            if not bm:
                raise HTTPException(status_code=404, detail=f"Work Plan BOQ Mapping #{bm_id} not found.")
            if bm.work_plan_id != wp.id or bm.project_id != site_log.project_id:
                raise HTTPException(
                    status_code=400,
                    detail="Selected BOQ mapping does not belong to selected Work Plan activity or project."
                )

        target_boq_id = boq_item_id_in or (bm.boq_item_id if bm else None)
        boq = db.query(BoqItem).filter(BoqItem.id == target_boq_id).first() if target_boq_id else None

        if boq and boq.project_id != site_log.project_id:
            raise HTTPException(status_code=400, detail="Selected BOQ item does not belong to selected project.")

        exec_qty = float(exec_qty_in or 0.0)
        if exec_qty < 0:
            raise HTTPException(status_code=400, detail="Today's Executed Quantity cannot be negative.")

        expected_unit = boq.unit if boq else (bm.unit if bm else wp.unit)
        if unit_in and not is_unit_compatible(unit_in, expected_unit):
            raise HTTPException(
                status_code=400,
                detail=f"Unit mismatch: Execution unit '{unit_in}' does not match Work Plan / BOQ unit '{expected_unit}'."
            )

        log_d = log_date_in or site_log.log_date or datetime.utcnow()
        if isinstance(log_d, str):
            log_d = datetime.fromisoformat(log_d)

        task_st = (task_status_in or "NOT STARTED").upper()

        if log_d.date() < wp.planned_start_date.date():
            task_st = "NOT STARTED"
            if exec_qty > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Future activity cannot have execution quantity recorded for activity '{wp.activity_name}' because log date ({log_d.strftime('%Y-%m-%d')}) is prior to planned start date ({wp.planned_start_date.strftime('%Y-%m-%d')}). Activity status remains NOT STARTED."
                )
        elif log_d.date() > wp.planned_end_date.date():
            if task_st not in ["COMPLETED", "ON HOLD"]:
                task_st = "DELAYED"
        else:
            if task_st == "NOT STARTED" and exec_qty > 0:
                task_st = "IN PROGRESS"

        task_entry = DailyTaskMonitoring(
            daily_site_log_id=site_log.id,
            project_id=site_log.project_id,
            work_plan_id=wp.id,
            boq_mapping_id=bm_id,
            boq_item_id=target_boq_id,
            log_date=log_d,
            task_status=task_st,
            executed_quantity=exec_qty,
            unit=expected_unit,
            execution_notes=execution_notes_in,
            delay_reason=delay_reason_in,
            created_by_id=engineer_id
        )
        db.add(task_entry)

@router.get("/work-plan-context/{work_plan_id}")
def get_work_plan_monitoring_context(work_plan_id: int, db: Session = Depends(get_db)):
    """Fetch complete Work Plan planning context and mapped BOQ items for Daily Task Monitoring."""
    wp = db.query(WorkPlan).filter(WorkPlan.id == work_plan_id).first()
    if not wp:
        raise HTTPException(status_code=404, detail="Work Plan Activity not found.")

    prj = db.query(Project).filter(Project.id == wp.project_id).first()
    phase = db.query(WbsTask).filter(WbsTask.id == wp.wbs_phase_id).first()
    task = db.query(WbsTask).filter(WbsTask.id == wp.task_id).first()
    subtask = db.query(WbsTask).filter(WbsTask.id == wp.subtask_id).first() if wp.subtask_id else None
    resp_user = db.query(User).filter(User.id == wp.responsible_user_id).first() if wp.responsible_user_id else None

    mappings = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.work_plan_id == wp.id).all()
    mapped_boqs = []
    for m in mappings:
        boq = db.query(BoqItem).filter(BoqItem.id == m.boq_item_id).first()
        if boq:
            mapped_boqs.append({
                "boq_mapping_id": m.id,
                "boq_item_id": boq.id,
                "boq_code": boq.wbs_code or f"BOQ-{boq.id}",
                "boq_description": boq.item_name,
                "boq_unit": boq.unit,
                "mapped_quantity": float(m.mapped_quantity),
                "mapping_status": "Fully Allocated" if float(m.mapped_quantity) >= float(boq.approved_qty or 0) else "Partially Mapped"
            })

    wbs_parts = [p.title for p in [phase, task, subtask] if p]
    wbs_path_str = " → ".join(wbs_parts) if wbs_parts else "Unassigned WBS"

    today = datetime.utcnow().date()
    s_date = wp.planned_start_date.date() if isinstance(wp.planned_start_date, datetime) else wp.planned_start_date
    e_date = wp.planned_end_date.date() if isinstance(wp.planned_end_date, datetime) else wp.planned_end_date

    is_future = bool(s_date and today < s_date)
    is_delayed = bool(e_date and today > e_date and wp.status != "COMPLETED")

    return {
        "work_plan_id": wp.id,
        "work_plan_number": wp.work_plan_number,
        "activity_name": wp.activity_name,
        "project_id": wp.project_id,
        "project_name": prj.name if prj else None,
        "wbs_phase_id": wp.wbs_phase_id,
        "phase_name": phase.title if phase else None,
        "task_id": wp.task_id,
        "task_name": task.title if task else None,
        "subtask_id": wp.subtask_id,
        "subtask_name": subtask.title if subtask else None,
        "wbs_name": subtask.title if subtask else (task.title if task else (phase.title if phase else wp.activity_name)),
        "wbs_path": wbs_path_str,
        "planned_quantity": float(wp.planned_quantity),
        "unit": wp.unit,
        "planned_start_date": wp.planned_start_date.strftime("%Y-%m-%d") if isinstance(wp.planned_start_date, (datetime, date)) else str(wp.planned_start_date),
        "planned_end_date": wp.planned_end_date.strftime("%Y-%m-%d") if isinstance(wp.planned_end_date, (datetime, date)) else str(wp.planned_end_date),
        "priority": wp.priority,
        "status": wp.status,
        "is_future_activity": is_future,
        "is_delayed_activity": is_delayed,
        "responsible_user_name": resp_user.full_name if resp_user else None,
        "mapped_boq_items": mapped_boqs
    }

@router.get("/project/{project_id}", response_model=List[SiteDailyLogResponse])
def get_site_logs_for_project(project_id: int, db: Session = Depends(get_db)):
    logs = db.query(SiteDailyLog).filter(SiteDailyLog.project_id == project_id).order_by(SiteDailyLog.log_date.desc(), SiteDailyLog.id.desc()).all()
    return [build_site_log_response(l, db) for l in logs]

@router.get("/{log_id}", response_model=SiteDailyLogResponse)
def get_site_log_by_id(log_id: int, db: Session = Depends(get_db)):
    log = db.query(SiteDailyLog).filter(SiteDailyLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Site Daily Log not found")
    return build_site_log_response(log, db)

@router.post("/", response_model=SiteDailyLogResponse)
def create_site_daily_log(
    log_in: SiteDailyLogCreate, 
    engineer_id: int = 1, 
    role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    active_role = (role or "site_engineer").lower()

    if active_role in ["project_manager", "finance", "management", "customer"]:
        raise HTTPException(
            status_code=403,
            detail=f"403 Forbidden: Active role '{active_role.upper()}' is not authorized to create site execution logs. Only Site Engineer can log daily work execution."
        )

    exec_today = float(log_in.executed_qty or 0.0)
    if exec_today < 0:
        raise HTTPException(status_code=400, detail="Executed Quantity Today cannot be negative.")

    target_boq = None
    if log_in.boq_item_id:
        target_boq = db.query(BoqItem).filter(BoqItem.id == log_in.boq_item_id).first()
        if not target_boq:
            raise HTTPException(status_code=404, detail="Selected BOQ item not found")

        # Over-execution Validation (Requirement 8)
        valid_logs = db.query(SiteDailyLog).filter(
            SiteDailyLog.boq_item_id == target_boq.id,
            SiteDailyLog.approval_status != "rejected"
        ).all()
        prev_cumulative = sum(float(l.executed_qty or 0.0) for l in valid_logs)
        new_cumulative = prev_cumulative + exec_today
        approved_qty = float(target_boq.approved_qty or 0.0)
        if approved_qty > 0 and new_cumulative > approved_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Executed quantity exceeds the remaining planned quantity. (Planned: {approved_qty} {target_boq.unit}, Already Executed: {prev_cumulative} {target_boq.unit}, Attempted: {exec_today} {target_boq.unit})"
            )

    site_log = SiteDailyLog(
        project_id=log_in.project_id,
        phase_id=log_in.phase_id,
        task_id=log_in.task_id,
        subtask_id=log_in.subtask_id,
        engineer_id=engineer_id,
        physical_progress=log_in.physical_progress,
        labour_count=log_in.labour_count,
        materials_consumed=log_in.materials_consumed,
        equipment_used=log_in.equipment_used,
        issues_identified=log_in.issues_identified,
        remarks=log_in.remarks,
        wbs_task_id=log_in.subtask_id or log_in.task_id or log_in.phase_id,
        boq_item_id=log_in.boq_item_id,
        executed_qty=exec_today,
        approval_status="pending"
    )
    db.add(site_log)
    db.commit()
    db.refresh(site_log)

    if target_boq and exec_today > 0:
        mb = MeasurementBook(
            project_id=site_log.project_id,
            boq_item_id=target_boq.id,
            site_log_id=site_log.id,
            phase_id=log_in.phase_id or target_boq.phase_id,
            task_id=log_in.task_id or target_boq.task_id,
            subtask_id=log_in.subtask_id or target_boq.subtask_id,
            engineer_id=engineer_id,
            location_zone=f"Site Daily Log #{site_log.id}",
            measured_qty=exec_today,
            unit=target_boq.unit,
            remarks=log_in.physical_progress or log_in.remarks or "Site Daily Log execution entry",
            status="APPROVED"
        )
        db.add(mb)

        wbs_target_id = log_in.subtask_id or log_in.task_id or log_in.phase_id or target_boq.subtask_id or target_boq.task_id or target_boq.phase_id
        if wbs_target_id:
            wbs_task = db.query(WbsTask).filter(WbsTask.id == wbs_target_id).first()
            if wbs_task:
                valid_logs = db.query(SiteDailyLog).filter(
                    SiteDailyLog.boq_item_id == target_boq.id,
                    SiteDailyLog.approval_status != "rejected"
                ).all()
                tot_exec = sum(float(l.executed_qty or 0.0) for l in valid_logs)
                wbs_task.actual_qty = tot_exec
                
                if float(target_boq.approved_qty) > 0:
                    exec_pct = min(100.0, round((tot_exec / float(target_boq.approved_qty)) * 100.0, 2))
                    wbs_task.progress_pct = exec_pct
                    if exec_pct >= 100.0:
                        wbs_task.status = "completed"
                    elif exec_pct > 0.0:
                        wbs_task.status = "in_progress"

                recalculate_project_wbs(db, site_log.project_id)

    # Fetch project details for approval task title
    project = db.query(Project).filter(Project.id == site_log.project_id).first()
    proj_label = project.name if project else f"Project #{site_log.project_id}"

    # Create Approval Task: Initial Stage = Site Engineer
    existing_task = db.query(ApprovalTask).filter(
        ApprovalTask.entity_type.in_(["SiteLog", "SiteDailyLog"]),
        ApprovalTask.entity_id == site_log.id
    ).first()

    if not existing_task:
        task = ApprovalTask(
            title=f"Site Daily Log Approval - {proj_label} ({site_log.log_date.strftime('%Y-%m-%d')})",
            entity_type="SITE_DAILY_LOG",
            entity_id=site_log.id,
            requester_id=engineer_id,
            current_stage="Site Engineer",
            status="pending",
            request_type="SITE_DAILY_LOG",
            request_category="NON_FINANCIAL",
            source_module="SITE_DAILY_LOGS"
        )
        db.add(task)

    # Audit Log
    audit = AuditLog(
        user_id=engineer_id, 
        action="SUBMIT", 
        entity_type="SiteDailyLog", 
        entity_id=site_log.id, 
        payload=f"Created Daily Site Progress Log #{site_log.id}: {site_log.physical_progress[:50]}... Executed Qty: {exec_today}"
    )
    db.add(audit)

    # Notification
    notif = Notification(
        user_id=engineer_id,
        title="Daily Site Progress Log Submitted",
        message=f"Daily Site Progress Log #{site_log.id} created for Project #{site_log.project_id}. Stage: Site Engineer Approval.",
        notification_type="approval",
        entity_type="SiteLog",
        entity_id=site_log.id
    )
    if hasattr(log_in, 'daily_tasks') and log_in.daily_tasks:
        process_and_save_daily_tasks(site_log, log_in.daily_tasks, engineer_id, db)

    db.commit()
    db.refresh(site_log)
    return build_site_log_response(site_log, db)

@router.post("/{site_log_id}/photos", response_model=List[SiteLogPhotoResponse])
async def upload_site_log_photos(
    site_log_id: int,
    files: List[UploadFile] = File(...),
    captions: List[str] = Form(default=[]),
    phase_id: Optional[int] = Form(None),
    task_id: Optional[int] = Form(None),
    subtask_id: Optional[int] = Form(None),
    boq_item_id: Optional[int] = Form(None),
    uploaded_by_id: int = Form(1),
    db: Session = Depends(get_db)
):
    site_log = db.query(SiteDailyLog).filter(SiteDailyLog.id == site_log_id).first()
    if not site_log:
        raise HTTPException(status_code=404, detail="Site Daily Log not found")

    existing_photos_count = db.query(SiteLogPhoto).filter(SiteLogPhoto.site_log_id == site_log_id).count()
    if existing_photos_count + len(files) > 10:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum 10 photos allowed per Daily Site Log. Log currently has {existing_photos_count} photo(s)."
        )

    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    allowed_exts = [".jpg", ".jpeg", ".png", ".webp"]

    created_photos = []
    for idx, file in enumerate(files):
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_exts and (file.content_type or "").lower() not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file format '{file.filename}'. Allowed formats: JPG, JPEG, PNG, WEBP."
            )

        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail=f"File '{file.filename}' exceeds maximum allowed size of 10MB."
            )

        unique_filename = f"log_{site_log_id}_{uuid.uuid4().hex[:10]}{ext}"
        saved_path = os.path.join(UPLOAD_PHOTOS_DIR, unique_filename)
        with open(saved_path, "wb") as f:
            f.write(contents)

        photo_caption = captions[idx] if (captions and idx < len(captions)) else None

        photo = SiteLogPhoto(
            site_log_id=site_log.id,
            project_id=site_log.project_id,
            phase_id=phase_id or site_log.wbs_task_id,
            task_id=task_id,
            subtask_id=subtask_id,
            boq_item_id=boq_item_id or site_log.boq_item_id,
            file_name=file.filename,
            file_path=f"uploads/site_photos/{unique_filename}",
            file_size=len(contents),
            file_type=file.content_type or f"image/{ext.replace('.', '')}",
            caption=photo_caption,
            uploaded_by_id=uploaded_by_id
        )
        db.add(photo)
        db.commit()
        db.refresh(photo)
        created_photos.append(photo)

        # Log audit
        audit = AuditLog(
            user_id=uploaded_by_id,
            action="CREATE",
            entity_type="SiteLogPhoto",
            entity_id=photo.id,
            payload=f"Uploaded photo '{file.filename}' for Daily Site Log #{site_log_id}"
        )
        db.add(audit)

    db.commit()

    results = []
    for p in created_photos:
        uploader = db.query(User).filter(User.id == p.uploaded_by_id).first()
        prj = db.query(Project).filter(Project.id == p.project_id).first()
        phase_task = db.query(WbsTask).filter(WbsTask.id == p.phase_id).first() if p.phase_id else None
        t_task = db.query(WbsTask).filter(WbsTask.id == p.task_id).first() if p.task_id else None

        results.append({
            "id": p.id,
            "site_log_id": p.site_log_id,
            "project_id": p.project_id,
            "phase_id": p.phase_id,
            "task_id": p.task_id,
            "subtask_id": p.subtask_id,
            "boq_item_id": p.boq_item_id,
            "file_name": p.file_name,
            "file_path": p.file_path,
            "file_size": p.file_size or 0,
            "file_type": p.file_type,
            "caption": p.caption,
            "uploaded_by_id": p.uploaded_by_id,
            "created_at": p.created_at,
            "uploader_name": uploader.full_name if uploader else "Site Engineer",
            "project_name": prj.name if prj else None,
            "phase_name": phase_task.title if phase_task else None,
            "task_name": t_task.title if t_task else None
        })

    return results

@router.get("/photos/gallery", response_model=List[SiteLogPhotoResponse])
def get_photo_gallery(
    project_id: Optional[int] = None,
    phase_id: Optional[int] = None,
    task_id: Optional[int] = None,
    uploaded_by_id: Optional[int] = None,
    date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SiteLogPhoto)
    if project_id:
        query = query.filter(SiteLogPhoto.project_id == project_id)
    if phase_id:
        query = query.filter(SiteLogPhoto.phase_id == phase_id)
    if task_id:
        query = query.filter(SiteLogPhoto.task_id == task_id)
    if uploaded_by_id:
        query = query.filter(SiteLogPhoto.uploaded_by_id == uploaded_by_id)

    photos = query.order_by(SiteLogPhoto.created_at.desc()).all()

    results = []
    for p in photos:
        if date:
            if p.created_at.strftime('%Y-%m-%d') != date:
                continue

        uploader = db.query(User).filter(User.id == p.uploaded_by_id).first()
        prj = db.query(Project).filter(Project.id == p.project_id).first()
        phase_task = db.query(WbsTask).filter(WbsTask.id == p.phase_id).first() if p.phase_id else None
        t_task = db.query(WbsTask).filter(WbsTask.id == p.task_id).first() if p.task_id else None

        results.append({
            "id": p.id,
            "site_log_id": p.site_log_id,
            "project_id": p.project_id,
            "phase_id": p.phase_id,
            "task_id": p.task_id,
            "subtask_id": p.subtask_id,
            "boq_item_id": p.boq_item_id,
            "file_name": p.file_name,
            "file_path": p.file_path,
            "file_size": p.file_size or 0,
            "file_type": p.file_type,
            "caption": p.caption,
            "uploaded_by_id": p.uploaded_by_id,
            "created_at": p.created_at,
            "uploader_name": uploader.full_name if uploader else "Site Engineer",
            "project_name": prj.name if prj else None,
            "phase_name": phase_task.title if phase_task else None,
            "task_name": t_task.title if t_task else None
        })

    return results

@router.delete("/photos/{photo_id}")
def delete_site_log_photo(
    photo_id: int,
    user_id: int = 1,
    db: Session = Depends(get_db)
):
    photo = db.query(SiteLogPhoto).filter(SiteLogPhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Record audit log before deletion
    audit = AuditLog(
        user_id=user_id,
        action="DELETE",
        entity_type="SiteLogPhoto",
        entity_id=photo.id,
        payload=f"Deleted photo #{photo.id} '{photo.file_name}' from Daily Site Log #{photo.site_log_id}"
    )
    db.add(audit)
    db.delete(photo)
    db.commit()
    return {"message": f"Photo #{photo_id} deleted successfully."}

@router.put("/{site_log_id}", response_model=SiteDailyLogResponse)
def update_site_daily_log(
    site_log_id: int,
    log_in: SiteDailyLogCreate,
    user_id: int = 1,
    role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    site_log = db.query(SiteDailyLog).filter(SiteDailyLog.id == site_log_id).first()
    if not site_log:
        raise HTTPException(status_code=404, detail="Site Daily Log not found")

    new_exec = float(log_in.executed_qty or 0.0)
    if new_exec < 0:
        raise HTTPException(status_code=400, detail="Executed Quantity Today cannot be negative.")

    target_boq_id = log_in.boq_item_id or site_log.boq_item_id
    if target_boq_id:
        target_boq = db.query(BoqItem).filter(BoqItem.id == target_boq_id).first()
        if target_boq:
            # Over-execution Validation excluding current log
            other_logs = db.query(SiteDailyLog).filter(
                SiteDailyLog.boq_item_id == target_boq.id,
                SiteDailyLog.id != site_log.id,
                SiteDailyLog.approval_status != "rejected"
            ).all()
            other_cumulative = sum(float(l.executed_qty or 0.0) for l in other_logs)
            new_total = other_cumulative + new_exec
            approved_qty = float(target_boq.approved_qty or 0.0)
            if approved_qty > 0 and new_total > approved_qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Executed quantity exceeds the remaining planned quantity. (Planned: {approved_qty} {target_boq.unit}, Already Executed: {other_cumulative} {target_boq.unit}, Attempted: {new_exec} {target_boq.unit})"
                )

    old_exec = float(site_log.executed_qty or 0.0)
    site_log.physical_progress = log_in.physical_progress
    site_log.labour_count = log_in.labour_count
    site_log.materials_consumed = log_in.materials_consumed
    site_log.equipment_used = log_in.equipment_used
    site_log.issues_identified = log_in.issues_identified
    site_log.remarks = log_in.remarks
    site_log.executed_qty = new_exec

    if log_in.phase_id is not None: site_log.phase_id = log_in.phase_id
    if log_in.task_id is not None: site_log.task_id = log_in.task_id
    if log_in.subtask_id is not None: site_log.subtask_id = log_in.subtask_id
    if log_in.boq_item_id is not None: site_log.boq_item_id = log_in.boq_item_id
    site_log.wbs_task_id = log_in.subtask_id or log_in.task_id or log_in.phase_id or site_log.wbs_task_id

    # Sync corresponding MeasurementBook record
    mb = db.query(MeasurementBook).filter(
        (MeasurementBook.site_log_id == site_log.id) | (MeasurementBook.location_zone == f"Site Daily Log #{site_log.id}")
    ).first()
    if mb:
        mb.measured_qty = new_exec
        mb.remarks = log_in.physical_progress or log_in.remarks
        if target_boq_id: mb.boq_item_id = target_boq_id
    elif target_boq_id and new_exec > 0:
        mb = MeasurementBook(
            project_id=site_log.project_id,
            boq_item_id=target_boq_id,
            site_log_id=site_log.id,
            engineer_id=user_id,
            location_zone=f"Site Daily Log #{site_log.id}",
            measured_qty=new_exec,
            unit=site_log.boq_item.unit if site_log.boq_item else "unit",
            remarks=log_in.physical_progress or "Updated execution log entry",
            status="APPROVED"
        )
        db.add(mb)

    # Record Audit Log
    audit = AuditLog(
        user_id=user_id,
        action="UPDATE",
        entity_type="SiteDailyLog",
        entity_id=site_log.id,
        payload=f"Updated Log #{site_log.id} executed_qty from {old_exec} to {new_exec}"
    )
    db.add(audit)
    if hasattr(log_in, 'daily_tasks') and log_in.daily_tasks is not None:
        db.query(DailyTaskMonitoring).filter(DailyTaskMonitoring.daily_site_log_id == site_log.id).delete()
        process_and_save_daily_tasks(site_log, log_in.daily_tasks, user_id, db)

    db.commit()
    recalculate_project_wbs(db, site_log.project_id)
    return build_site_log_response(site_log, db)
