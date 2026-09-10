from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from typing import List, Optional
from datetime import datetime, date, timedelta

from app.database import get_db
from app import models, schemas
from app.api.auth import get_current_user
from app.api.audit import record_audit_log

router = APIRouter(prefix="/api/hindrances", tags=["Hindrance Logging & EE Decision (EXA-06)"])

ALLOWED_HINDRANCE_TYPES = [
    "Land non-availability",
    "Design pending",
    "Utility shifting",
    "Weather",
    "Force majeure",
    "Other"
]

def normalize_role(role_raw: Optional[str]) -> str:
    if not role_raw:
        return ""
    r = role_raw.strip().lower()
    mapping = {
        "ee": "EE",
        "executive engineer": "EE",
        "ae": "AE",
        "assistant engineer": "AE",
        "je": "JE",
        "junior engineer": "JE",
        "contractor pm": "Contractor PM",
        "contractor_pm": "Contractor PM",
        "tenant admin": "Tenant Admin",
        "tenant_admin": "Tenant Admin",
        "admin": "Tenant Admin",
        "se": "SE",
        "superintending engineer": "SE"
    }
    return mapping.get(r, role_raw.strip())


def is_user_authorized_ee(db: Session, user: models.User, project_id: int) -> bool:
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project or (project.status and project.status.upper() == "CLOSED"):
        return False

    today = date.today()

    team_members = db.query(models.ProjectTeamMember).filter(
        models.ProjectTeamMember.project_id == project_id,
        models.ProjectTeamMember.user_id == user.id,
        models.ProjectTeamMember.is_active == True,
        models.ProjectTeamMember.status == "ACTIVE"
    ).all()

    for tm in team_members:
        norm_role = normalize_role(tm.project_role)
        if norm_role == "EE":
            if tm.effective_from and tm.effective_from > today:
                continue
            if tm.effective_to and tm.effective_to < today:
                continue
            return True

    if normalize_role(user.role) in ["EE", "Tenant Admin"] or user.role == "admin":
        return True

    return False


def get_tenant_upload_limit_mb(db: Session, tenant_name: Optional[str] = "Default Tenant") -> int:
    setting = db.query(models.TenantSetting).filter(
        models.TenantSetting.tenant_name == (tenant_name or "Default Tenant")
    ).first()
    if setting and setting.max_file_upload_mb:
        return setting.max_file_upload_mb
    return 10


def log_hindrance_audit(
    db: Session,
    hindrance_id: int,
    action: str,
    actor: Optional[models.User] = None,
    actor_role: Optional[str] = None,
    old_status: Optional[str] = None,
    new_status: Optional[str] = None,
    remarks: Optional[str] = None
):
    actor_id = actor.id if actor else None
    role_name = actor_role or (normalize_role(actor.role) if actor and actor.role else "SYSTEM")
    audit_entry = models.HindranceAudit(
        hindrance_id=hindrance_id,
        action=action,
        actor_id=actor_id,
        actor_role=role_name,
        old_status=old_status,
        new_status=new_status,
        remarks=remarks,
        created_at=datetime.utcnow()
    )
    db.add(audit_entry)

    record_audit_log(
        db=db,
        user_id=actor_id or 1,
        action=f"HINDRANCE_{action.upper()}",
        entity_type="Hindrance",
        entity_id=hindrance_id,
        payload=f"Action: {action}, Old: {old_status}, New: {new_status}, Remarks: {remarks}"
    )


# --- API ROUTES (ORDER MATTERS: Fixed routes BEFORE parameterized routes) ---

@router.get("", response_model=List[schemas.HindranceResponse])
@router.get("/", response_model=List[schemas.HindranceResponse])
def get_hindrances(
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Hindrance)
    if project_id:
        query = query.filter(models.Hindrance.project_id == project_id)
    if status:
        query = query.filter(models.Hindrance.current_status == status)

    hindrances = query.order_by(models.Hindrance.created_at.desc()).all()

    results = []
    for h in hindrances:
        resp = schemas.HindranceResponse.from_orm(h)
        if h.project:
            resp.project_name = h.project.name
        if h.wbs_node:
            resp.wbs_node_name = h.wbs_node.title or h.wbs_node.wbs_code
        if h.raised_by:
            resp.raised_by_name = h.raised_by.full_name
        if h.ee:
            resp.ee_name = h.ee.full_name
        if h.escalated_to:
            resp.escalated_to_name = h.escalated_to.full_name

        resp.audits = []
        for a in h.audits:
            a_resp = schemas.HindranceAuditResponse.from_orm(a)
            if a.actor:
                a_resp.actor_name = a.actor.full_name
            resp.audits.append(a_resp)

        results.append(resp)

    return results


@router.get("/pending-ee", response_model=List[schemas.HindranceResponse])
def get_pending_ee_hindrances(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Hindrance).filter(
        models.Hindrance.current_status.in_(["RAISED", "SLA_BREACHED", "INFO_REQUESTED"]),
        models.Hindrance.ee_decision.is_(None)
    )
    if project_id:
        query = query.filter(models.Hindrance.project_id == project_id)

    hindrances = query.order_by(models.Hindrance.created_at.desc()).all()
    results = []
    for h in hindrances:
        resp = schemas.HindranceResponse.from_orm(h)
        if h.project:
            resp.project_name = h.project.name
        if h.wbs_node:
            resp.wbs_node_name = h.wbs_node.title or h.wbs_node.wbs_code
        if h.raised_by:
            resp.raised_by_name = h.raised_by.full_name
        results.append(resp)
    return results


@router.get("/project/{project_id}/eot-breakdown", response_model=schemas.EotBreakdownResponse)
def get_eot_breakdown(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    accepted_hindrances = db.query(models.Hindrance).filter(
        models.Hindrance.project_id == project_id,
        or_(
            models.Hindrance.ee_decision == "ACCEPTED",
            models.Hindrance.current_status == "ACCEPTED"
        )
    ).all()

    items = []
    intervals = []
    indiv_total = 0

    for h in accepted_hindrances:
        start_d = h.delay_start_date or h.date_occurred
        end_d = h.delay_end_date or start_d
        days = (end_d - start_d).days + 1
        if days < 1:
            days = 1

        indiv_total += days
        wbs_name = h.wbs_node.title or h.wbs_node.wbs_code if h.wbs_node else f"WBS #{h.wbs_node_id}"

        items.append(schemas.EotHindranceItem(
            hindrance_id=h.id,
            hindrance_type=h.hindrance_type,
            wbs_node_id=h.wbs_node_id,
            wbs_node_name=wbs_name,
            delay_start_date=start_d,
            delay_end_date=end_d,
            individual_days=days,
            status=h.current_status
        ))
        intervals.append((start_d, end_d))

    merged_intervals = []
    if intervals:
        intervals.sort(key=lambda x: x[0])
        curr_start, curr_end = intervals[0]

        for next_start, next_end in intervals[1:]:
            if next_start <= curr_end + timedelta(days=1):
                curr_end = max(curr_end, next_end)
            else:
                merged_intervals.append((curr_start, curr_end))
                curr_start, curr_end = next_start, next_end

        merged_intervals.append((curr_start, curr_end))

    net_eot_days = 0
    union_schema_list = []
    for m_start, m_end in merged_intervals:
        m_days = (m_end - m_start).days + 1
        net_eot_days += m_days
        union_schema_list.append(schemas.EotUnionInterval(
            start_date=m_start,
            end_date=m_end,
            interval_days=m_days
        ))

    overlap_saved = indiv_total - net_eot_days

    return schemas.EotBreakdownResponse(
        project_id=project_id,
        project_name=project.name,
        total_accepted_hindrances=len(accepted_hindrances),
        individual_total_days=indiv_total,
        merged_intervals=union_schema_list,
        net_eot_delay_days=net_eot_days,
        overlap_days_saved=overlap_saved,
        hindrances=items
    )


@router.post("/process-sla")
def process_sla_job(db: Session = Depends(get_db)):
    now_utc = datetime.utcnow()
    active_hindrances = db.query(models.Hindrance).filter(
        models.Hindrance.current_status.in_(["RAISED", "INFO_REQUESTED"])
    ).all()

    processed_count = 0
    reminders_day2 = 0
    reminders_day3 = 0
    escalations = 0

    for h in active_hindrances:
        raised = h.raised_at
        day2_time = raised + timedelta(days=2)
        day3_time = raised + timedelta(days=3)
        day5_time = raised + timedelta(days=5)

        if now_utc >= day2_time and not h.day2_reminder_sent:
            h.day2_reminder_sent = True
            log_hindrance_audit(
                db=db,
                hindrance_id=h.id,
                action="DAY2_REMINDER_SENT",
                actor=h.raised_by,
                old_status=h.current_status,
                new_status=h.current_status,
                remarks="Day 2 SLA reminder sent to Executive Engineer"
            )
            reminders_day2 += 1

        if now_utc >= day3_time and not h.day3_reminder_sent:
            h.day3_reminder_sent = True
            log_hindrance_audit(
                db=db,
                hindrance_id=h.id,
                action="DAY3_REMINDER_SENT",
                actor=h.raised_by,
                old_status=h.current_status,
                new_status=h.current_status,
                remarks="Day 3 SLA final reminder sent to Executive Engineer"
            )
            reminders_day3 += 1

        if now_utc >= day5_time and not h.sla_breached:
            h.current_status = "SLA_BREACHED"
            h.sla_breached = True
            h.escalated_at = now_utc

            escalation_target = db.query(models.ProjectTeamMember).filter(
                models.ProjectTeamMember.project_id == h.project_id,
                models.ProjectTeamMember.project_role.in_(["Tenant Admin", "SE", "Superintending Engineer", "Contractor PM"]),
                models.ProjectTeamMember.is_active == True
            ).first()

            if escalation_target:
                h.escalated_to_id = escalation_target.user_id
            else:
                h.escalated_to_id = h.project.manager_id if h.project else None

            log_hindrance_audit(
                db=db,
                hindrance_id=h.id,
                action="DAY5_AUTO_ESCALATION",
                actor=h.raised_by,
                old_status="RAISED",
                new_status="SLA_BREACHED",
                remarks=f"SLA Breached after Day 5. Auto-escalated to target officer ID: {h.escalated_to_id}"
            )
            escalations += 1

        processed_count += 1

    db.commit()

    return {
        "status": "success",
        "processed_hindrances": processed_count,
        "day2_reminders_sent": reminders_day2,
        "day3_reminders_sent": reminders_day3,
        "day5_escalations": escalations
    }


@router.post("", response_model=schemas.HindranceResponse, status_code=201)
@router.post("/", response_model=schemas.HindranceResponse, status_code=201)
def create_hindrance(
    payload: schemas.HindranceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.status and project.status.upper() == "CLOSED":
        raise HTTPException(status_code=400, detail="Cannot create hindrance for a closed project.")

    if payload.hindrance_type not in ALLOWED_HINDRANCE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid Hindrance Type")

    today = date.today()
    if payload.date_occurred > today:
        raise HTTPException(status_code=400, detail="Date Occurred cannot be in the future.")

    desc_clean = payload.description.strip() if payload.description else ""
    if len(desc_clean) < 20:
        raise HTTPException(status_code=400, detail="Description must be at least 20 characters.")

    if not payload.evidence_document_id and not payload.evidence_file_name:
        raise HTTPException(status_code=400, detail="Evidence is required.")

    tenant_limit_mb = get_tenant_upload_limit_mb(db, getattr(project, "tenant_name", "Default Tenant"))
    if payload.evidence_file_size and payload.evidence_file_size > (tenant_limit_mb * 1024 * 1024):
        raise HTTPException(status_code=400, detail=f"File exceeds the tenant upload limit of {tenant_limit_mb} MB.")

    wbs_node = db.query(models.WbsTask).filter(models.WbsTask.id == payload.wbs_node_id).first()
    if not wbs_node:
        raise HTTPException(status_code=404, detail="WBS Node not found")

    if wbs_node.project_id != payload.project_id:
        raise HTTPException(status_code=400, detail="WBS Node does not belong to the selected project.")

    start_dt = payload.delay_start_date or payload.date_occurred
    end_dt = payload.delay_end_date or start_dt

    if end_dt < start_dt:
        raise HTTPException(status_code=400, detail="Delay end date cannot be earlier than delay start date.")

    now_utc = datetime.utcnow()
    sla_due = now_utc + timedelta(days=4)

    hindrance = models.Hindrance(
        project_id=payload.project_id,
        wbs_node_id=payload.wbs_node_id,
        hindrance_type=payload.hindrance_type,
        date_occurred=payload.date_occurred,
        delay_start_date=start_dt,
        delay_end_date=end_dt,
        description=desc_clean,
        evidence_document_id=payload.evidence_document_id,
        evidence_file_name=payload.evidence_file_name,
        evidence_file_type=payload.evidence_file_type,
        evidence_file_size=payload.evidence_file_size,
        raised_by_id=current_user.id,
        raised_at=now_utc,
        current_status="RAISED",
        sla_due_at=sla_due,
        day2_reminder_sent=False,
        day3_reminder_sent=False,
        sla_breached=False,
        reopened_count=0,
        created_at=now_utc,
        updated_at=now_utc
    )

    db.add(hindrance)
    db.commit()
    db.refresh(hindrance)

    log_hindrance_audit(
        db=db,
        hindrance_id=hindrance.id,
        action="CREATED",
        actor=current_user,
        old_status=None,
        new_status="RAISED",
        remarks=f"Hindrance raised for WBS {wbs_node.title or wbs_node.wbs_code}"
    )
    db.commit()

    resp = schemas.HindranceResponse.from_orm(hindrance)
    resp.project_name = project.name
    resp.wbs_node_name = wbs_node.title or wbs_node.wbs_code
    resp.raised_by_name = current_user.full_name
    return resp


@router.post("/sync")
def sync_offline_hindrance_entries(
    sync_req: schemas.HindranceSyncRequest,
    x_app_version: Optional[str] = Header(None, alias="X-App-Version"),
    x_app_schema_version: Optional[str] = Header(None, alias="X-App-Schema-Version"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Synchronizes queued offline Hindrance entries with client UUID idempotency."""
    # Client Version / Schema Compatibility Check
    if x_app_schema_version is not None:
        try:
            if int(x_app_schema_version) < 2:
                raise HTTPException(status_code=426, detail="Please update the app")
        except (ValueError, TypeError):
            raise HTTPException(status_code=426, detail="Please update the app")
    if x_app_version is not None:
        try:
            if int(x_app_version.strip().split(".")[0]) < 2:
                raise HTTPException(status_code=426, detail="Please update the app")
        except Exception:
            raise HTTPException(status_code=426, detail="Please update the app")

    synced_items = []
    conflicts = []

    for item in sync_req.items:
        # Idempotency check: does this client_uuid already exist?
        existing = db.query(models.Hindrance).filter(models.Hindrance.client_uuid == item.client_uuid).first()
        if existing:
            resp = schemas.HindranceResponse.from_orm(existing)
            proj = db.query(models.Project).filter(models.Project.id == existing.project_id).first()
            wbs = db.query(models.WbsTask).filter(models.WbsTask.id == existing.wbs_node_id).first()
            resp.project_name = proj.name if proj else None
            resp.wbs_node_name = (wbs.title or wbs.wbs_code) if wbs else None
            resp.raised_by_name = current_user.full_name
            synced_items.append(resp)
            continue

        # Project check & closure conflict
        project = db.query(models.Project).filter(models.Project.id == item.project_id).first()
        if not project:
            conflicts.append({
                "client_uuid": item.client_uuid,
                "reason": "Referenced project does not exist"
            })
            continue

        if (project.status or "").upper() == "CLOSED":
            conflicts.append({
                "client_uuid": item.client_uuid,
                "reason": "Project was closed before sync"
            })
            continue

        # WBS Node check & deleted conflict
        wbs_node = db.query(models.WbsTask).filter(models.WbsTask.id == item.wbs_node_id).first()
        if not wbs_node or wbs_node.project_id != project.id:
            conflicts.append({
                "client_uuid": item.client_uuid,
                "reason": "Referenced WBS node no longer exists"
            })
            continue

        # Validation
        if item.hindrance_type not in ALLOWED_HINDRANCE_TYPES:
            conflicts.append({
                "client_uuid": item.client_uuid,
                "reason": f"Invalid Hindrance Type: {item.hindrance_type}"
            })
            continue

        desc_clean = item.description.strip() if item.description else ""
        if len(desc_clean) < 20:
            conflicts.append({
                "client_uuid": item.client_uuid,
                "reason": "Description must be at least 20 characters"
            })
            continue

        start_dt = item.delay_start_date or item.date_occurred
        end_dt = item.delay_end_date or start_dt

        now_utc = datetime.utcnow()
        created_dt = item.created_at or now_utc
        sla_due = created_dt + timedelta(days=4)

        evidence_name = item.evidence_file_name or "offline_evidence.jpg"
        evidence_type = item.evidence_file_type or "image/jpeg"
        evidence_size = item.evidence_file_size or 1024

        if item.evidence_base64:
            try:
                import base64, os
                photo_data = item.evidence_base64
                if "," in photo_data:
                    photo_data = photo_data.split(",")[1]
                decoded_bytes = base64.b64decode(photo_data)
                evidence_size = len(decoded_bytes)
                file_rel_path = f"uploads/site_photos/hindrance_{item.client_uuid[:8]}.jpg"
                full_save_path = os.path.join(os.getcwd(), file_rel_path)
                os.makedirs(os.path.dirname(full_save_path), exist_ok=True)
                with open(full_save_path, "wb") as f:
                    f.write(decoded_bytes)
                evidence_name = f"hindrance_{item.client_uuid[:8]}.jpg"
            except Exception as e:
                print(f"[Evidence Sync Note] Could not save offline photo: {e}")

        hindrance = models.Hindrance(
            project_id=project.id,
            wbs_node_id=wbs_node.id,
            hindrance_type=item.hindrance_type,
            date_occurred=item.date_occurred,
            delay_start_date=start_dt,
            delay_end_date=end_dt,
            description=desc_clean,
            evidence_document_id=None,
            evidence_file_name=evidence_name,
            evidence_file_type=evidence_type,
            evidence_file_size=evidence_size,
            raised_by_id=current_user.id,
            raised_at=created_dt,
            current_status="RAISED",
            sla_due_at=sla_due,
            day2_reminder_sent=False,
            day3_reminder_sent=False,
            sla_breached=False,
            reopened_count=0,
            client_uuid=item.client_uuid,
            is_offline_sync=True,
            synced_at=now_utc,
            created_at=created_dt,
            updated_at=now_utc
        )

        db.add(hindrance)
        db.commit()
        db.refresh(hindrance)

        log_hindrance_audit(
            db=db,
            hindrance_id=hindrance.id,
            action="OFFLINE_SYNC",
            actor=current_user,
            old_status=None,
            new_status="RAISED",
            remarks=f"Offline hindrance synced (client_uuid: {item.client_uuid})"
        )
        db.commit()

        resp = schemas.HindranceResponse.from_orm(hindrance)
        resp.project_name = project.name
        resp.wbs_node_name = wbs_node.title or wbs_node.wbs_code
        resp.raised_by_name = current_user.full_name
        synced_items.append(resp)

    return {
        "synced": synced_items,
        "conflicts": conflicts
    }



@router.get("/{hindrance_id}", response_model=schemas.HindranceResponse)
def get_hindrance_by_id(
    hindrance_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    h = db.query(models.Hindrance).filter(models.Hindrance.id == hindrance_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hindrance not found")

    resp = schemas.HindranceResponse.from_orm(h)
    if h.project:
        resp.project_name = h.project.name
    if h.wbs_node:
        resp.wbs_node_name = h.wbs_node.title or h.wbs_node.wbs_code
    if h.raised_by:
        resp.raised_by_name = h.raised_by.full_name
    if h.ee:
        resp.ee_name = h.ee.full_name
    if h.escalated_to:
        resp.escalated_to_name = h.escalated_to.full_name

    resp.audits = []
    for a in h.audits:
        a_resp = schemas.HindranceAuditResponse.from_orm(a)
        if a.actor:
            a_resp.actor_name = a.actor.full_name
        resp.audits.append(a_resp)

    return resp


@router.post("/{hindrance_id}/ee-decision", response_model=schemas.HindranceResponse)
def submit_ee_decision(
    hindrance_id: int,
    payload: schemas.HindranceDecisionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    hindrance = db.query(models.Hindrance).filter(models.Hindrance.id == hindrance_id).first()
    if not hindrance:
        raise HTTPException(status_code=404, detail="Hindrance not found")

    if not is_user_authorized_ee(db, current_user, hindrance.project_id):
        raise HTTPException(
            status_code=403,
            detail="Only an authorized Executive Engineer (EE) assigned to this project can make this decision."
        )

    norm_decision = payload.ee_decision.strip()
    if norm_decision not in ["Accepted", "Rejected", "Info Requested"]:
        raise HTTPException(status_code=400, detail="Invalid decision. Must be Accepted, Rejected, or Info Requested.")

    remarks_clean = payload.ee_remarks.strip() if payload.ee_remarks else ""
    if norm_decision in ["Rejected", "Info Requested"] and not remarks_clean:
        raise HTTPException(
            status_code=400,
            detail="EE Remarks are required for Rejected or Info Requested decisions."
        )

    old_status = hindrance.current_status
    now_utc = datetime.utcnow()

    if norm_decision == "Accepted":
        hindrance.ee_decision = "ACCEPTED"
        hindrance.current_status = "ACCEPTED"
        hindrance.ee_id = current_user.id
        hindrance.ee_remarks = remarks_clean
        hindrance.decided_at = now_utc

        log_hindrance_audit(
            db=db,
            hindrance_id=hindrance.id,
            action="EE_ACCEPTED",
            actor=current_user,
            old_status=old_status,
            new_status="ACCEPTED",
            remarks=remarks_clean or "Hindrance accepted by EE"
        )

    elif norm_decision == "Rejected":
        hindrance.ee_decision = "REJECTED"
        hindrance.current_status = "REJECTED"
        hindrance.ee_id = current_user.id
        hindrance.ee_remarks = remarks_clean
        hindrance.decided_at = now_utc

        log_hindrance_audit(
            db=db,
            hindrance_id=hindrance.id,
            action="EE_REJECTED",
            actor=current_user,
            old_status=old_status,
            new_status="REJECTED",
            remarks=remarks_clean
        )

    elif norm_decision == "Info Requested":
        hindrance.ee_decision = "INFO_REQUESTED"
        hindrance.current_status = "RAISED"
        hindrance.ee_id = current_user.id
        hindrance.ee_remarks = remarks_clean
        hindrance.decided_at = now_utc
        hindrance.reopened_count += 1

        log_hindrance_audit(
            db=db,
            hindrance_id=hindrance.id,
            action="EE_INFO_REQUESTED",
            actor=current_user,
            old_status=old_status,
            new_status="INFO_REQUESTED",
            remarks=remarks_clean
        )
        log_hindrance_audit(
            db=db,
            hindrance_id=hindrance.id,
            action="REOPENED_TO_RAISER",
            actor=current_user,
            old_status="INFO_REQUESTED",
            new_status="RAISED",
            remarks="Hindrance reopened to raiser with retained original Date Occurred and Raised timestamp"
        )

        if hindrance.raised_by_id:
            notif = models.Notification(
                user_id=hindrance.raised_by_id,
                title="Hindrance Info Requested",
                message=f"EE requested further information on Hindrance #{hindrance.id}: {remarks_clean}",
                notification_type="warning",
                entity_type="Hindrance",
                entity_id=hindrance.id
            )
            db.add(notif)

    hindrance.updated_at = now_utc
    db.commit()
    db.refresh(hindrance)

    resp = schemas.HindranceResponse.from_orm(hindrance)
    if hindrance.project:
        resp.project_name = hindrance.project.name
    if hindrance.wbs_node:
        resp.wbs_node_name = hindrance.wbs_node.title or hindrance.wbs_node.wbs_code
    if hindrance.raised_by:
        resp.raised_by_name = hindrance.raised_by.full_name
    if hindrance.ee:
        resp.ee_name = hindrance.ee.full_name

    resp.audits = []
    for a in hindrance.audits:
        a_resp = schemas.HindranceAuditResponse.from_orm(a)
        if a.actor:
            a_resp.actor_name = a.actor.full_name
        resp.audits.append(a_resp)

    return resp


@router.post("/{hindrance_id}/resubmit", response_model=schemas.HindranceResponse)
def resubmit_hindrance_info(
    hindrance_id: int,
    payload: schemas.HindranceReopenRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    hindrance = db.query(models.Hindrance).filter(models.Hindrance.id == hindrance_id).first()
    if not hindrance:
        raise HTTPException(status_code=404, detail="Hindrance not found")

    if hindrance.raised_by_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the original raiser can update or resubmit information.")

    if payload.description and len(payload.description.strip()) >= 20:
        hindrance.description = payload.description.strip()

    if payload.evidence_document_id:
        hindrance.evidence_document_id = payload.evidence_document_id
    if payload.evidence_file_name:
        hindrance.evidence_file_name = payload.evidence_file_name
    if payload.evidence_file_type:
        hindrance.evidence_file_type = payload.evidence_file_type
    if payload.evidence_file_size:
        hindrance.evidence_file_size = payload.evidence_file_size

    hindrance.current_status = "RAISED"
    hindrance.updated_at = datetime.utcnow()

    log_hindrance_audit(
        db=db,
        hindrance_id=hindrance.id,
        action="RESUBMITTED_BY_RAISER",
        actor=current_user,
        old_status="INFO_REQUESTED",
        new_status="RAISED",
        remarks="Raiser provided updated description/evidence"
    )

    db.commit()
    db.refresh(hindrance)
    return get_hindrance_by_id(hindrance_id, db, current_user)
