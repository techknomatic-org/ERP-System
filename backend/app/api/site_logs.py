from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import SiteDailyLog, ApprovalTask, AuditLog, Notification, Project, BoqItem, MeasurementBook, WbsTask
from app.schemas import SiteDailyLogCreate, SiteDailyLogResponse
from app.api.wbs import recalculate_project_wbs

router = APIRouter(prefix="/api/site-logs", tags=["Site Progress & Daily Logs"])

def build_site_log_response(log: SiteDailyLog, db: Session) -> dict:
    resp = {
        "id": log.id,
        "project_id": log.project_id,
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
        "total_executed_qty": 0.0,
        "remaining_qty": 0.0,
        "execution_pct": 0.0
    }

    if log.boq_item_id:
        boq = db.query(BoqItem).filter(BoqItem.id == log.boq_item_id).first()
        if boq:
            resp["boq_item_name"] = boq.item_name
            resp["unit"] = boq.unit
            resp["approved_qty"] = float(boq.approved_qty)

            # Sum all MeasurementBook records up to and including this log
            all_mb = db.query(MeasurementBook).filter(MeasurementBook.boq_item_id == boq.id).all()
            total_executed = sum(float(m.measured_qty) for m in all_mb)
            
            resp["total_executed_qty"] = round(total_executed, 2)
            resp["prev_executed_qty"] = round(max(0.0, total_executed - float(log.executed_qty or 0.0)), 2)
            resp["remaining_qty"] = round(float(boq.approved_qty) - total_executed, 2)
            resp["execution_pct"] = round((total_executed / float(boq.approved_qty) * 100.0) if float(boq.approved_qty) > 0 else 0.0, 2)

    return resp

@router.get("/project/{project_id}", response_model=List[SiteDailyLogResponse])
def get_site_logs_for_project(project_id: int, db: Session = Depends(get_db)):
    logs = db.query(SiteDailyLog).filter(SiteDailyLog.project_id == project_id).order_by(SiteDailyLog.log_date.desc()).all()
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

    # Section 3, 17: Site Engineer is responsible for entering Executed Quantity
    if active_role in ["project_manager", "finance", "management", "customer"]:
        raise HTTPException(
            status_code=403,
            detail=f"403 Forbidden: Active role '{active_role.upper()}' is not authorized to create site execution logs. Only Site Engineer can log daily work execution."
        )

    # Section 9: Validation against negative execution quantity
    exec_today = float(log_in.executed_qty or 0.0)
    if exec_today < 0:
        raise HTTPException(status_code=400, detail="Executed Quantity Today cannot be negative.")

    target_boq = None
    if log_in.boq_item_id:
        target_boq = db.query(BoqItem).filter(BoqItem.id == log_in.boq_item_id).first()
        if not target_boq:
            raise HTTPException(status_code=404, detail="Selected BOQ item not found")

    site_log = SiteDailyLog(
        project_id=log_in.project_id,
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

    # Automatically create MeasurementBook record for execution history (Section 6 & 11)
    if target_boq and exec_today > 0:
        mb = MeasurementBook(
            project_id=site_log.project_id,
            boq_item_id=target_boq.id,
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

        # Update linked WBS Task progress % where applicable (Section 14)
        wbs_target_id = log_in.subtask_id or log_in.task_id or log_in.phase_id or target_boq.subtask_id or target_boq.task_id or target_boq.phase_id
        if wbs_target_id:
            wbs_task = db.query(WbsTask).filter(WbsTask.id == wbs_target_id).first()
            if wbs_task:
                # Total executed for this BOQ item
                all_mb = db.query(MeasurementBook).filter(MeasurementBook.boq_item_id == target_boq.id).all()
                tot_exec = sum(float(m.measured_qty) for m in all_mb) + exec_today
                wbs_task.actual_qty = float(wbs_task.actual_qty or 0.0) + exec_today
                
                # Execution % calculation
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
    db.add(notif)

    db.commit()
    db.refresh(site_log)
    return build_site_log_response(site_log, db)
