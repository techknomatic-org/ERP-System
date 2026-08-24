from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from app.database import get_db
from app.models import HseIncident, HseCapa, SafetyAudit, AuditLog, Notification
from app.schemas import (
    HseIncidentCreate, HseIncidentResponse,
    HseCapaCreate, HseCapaResponse,
    SafetyAuditCreate, SafetyAuditResponse
)

router = APIRouter(prefix="/api/hse", tags=["HSE Safety & CAPA Workflow"])

# Incidents API
@router.get("/incidents", response_model=List[HseIncidentResponse])
def list_incidents(db: Session = Depends(get_db)):
    return db.query(HseIncident).order_by(HseIncident.created_at.desc()).all()

@router.post("/incidents", response_model=HseIncidentResponse)
def create_incident(inc_in: HseIncidentCreate, reporter_id: int = 1, db: Session = Depends(get_db)):
    code = f"INC-{uuid.uuid4().hex[:8].upper()}"
    incident = HseIncident(
        incident_code=code,
        project_id=inc_in.project_id,
        reporter_id=reporter_id,
        incident_type=inc_in.incident_type or "Incident",
        severity=inc_in.severity or "medium",
        title=inc_in.title,
        location=inc_in.location,
        description=inc_in.description,
        immediate_action=inc_in.immediate_action,
        root_cause=inc_in.root_cause,
        status="open"
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    # Notify HSE Safety Manager
    notif = Notification(
        user_id=1,
        title=f"HSE Safety Report #{code}",
        message=f"{incident.incident_type} reported at {incident.location}: {incident.title} (Severity: {incident.severity.upper()})",
        notification_type="alert",
        entity_type="HseIncident",
        entity_id=incident.id
    )
    db.add(notif)

    audit = AuditLog(user_id=reporter_id, action="CREATE", entity_type="HseIncident", entity_id=incident.id, payload=f"Logged {incident.incident_type}: {incident.title}")
    db.add(audit)

    db.commit()
    db.refresh(incident)
    return incident

# CAPA Workflow API
@router.get("/capas", response_model=List[HseCapaResponse])
def list_capas(db: Session = Depends(get_db)):
    return db.query(HseCapa).order_by(HseCapa.created_at.desc()).all()

@router.post("/capas", response_model=HseCapaResponse)
def create_capa(capa_in: HseCapaCreate, db: Session = Depends(get_db)):
    code = f"CAPA-{uuid.uuid4().hex[:8].upper()}"
    capa = HseCapa(
        capa_code=code,
        project_id=capa_in.project_id,
        incident_id=capa_in.incident_id,
        problem_description=capa_in.problem_description,
        root_cause=capa_in.root_cause,
        corrective_action=capa_in.corrective_action,
        preventive_action=capa_in.preventive_action,
        target_date=capa_in.target_date,
        status="open"
    )
    db.add(capa)
    db.commit()
    db.refresh(capa)

    audit = AuditLog(user_id=1, action="CREATE", entity_type="HseCapa", entity_id=capa.id, payload=f"Generated CAPA #{code}: {capa.corrective_action[:50]}")
    db.add(audit)
    db.commit()

    return capa

# Safety Audits API
@router.get("/audits", response_model=List[SafetyAuditResponse])
def list_safety_audits(db: Session = Depends(get_db)):
    return db.query(SafetyAudit).order_by(SafetyAudit.created_at.desc()).all()

@router.post("/audits", response_model=SafetyAuditResponse)
def create_safety_audit(audit_in: SafetyAuditCreate, auditor_id: int = 1, db: Session = Depends(get_db)):
    code = f"AUD-{uuid.uuid4().hex[:8].upper()}"
    status = "passed" if audit_in.compliance_score_pct >= 85.0 else "failed"

    audit = SafetyAudit(
        audit_code=code,
        project_id=audit_in.project_id,
        auditor_id=auditor_id,
        checklist_type=audit_in.checklist_type,
        compliance_score_pct=audit_in.compliance_score_pct,
        issues_found=audit_in.issues_found,
        status=status
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)

    audit_log = AuditLog(user_id=auditor_id, action="CREATE", entity_type="SafetyAudit", entity_id=audit.id, payload=f"Safety Audit {code} ({audit.checklist_type}) - Score: {audit.compliance_score_pct}%")
    db.add(audit_log)
    db.commit()

    return audit
