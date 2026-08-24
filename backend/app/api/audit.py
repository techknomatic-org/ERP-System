from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models import AuditLog, User
from app.schemas import AuditLogResponse

router = APIRouter(prefix="/api/audit", tags=["Audit Trail"])

def record_audit_log(
    db: Session,
    user_id: Optional[int],
    action: str,
    entity_type: str,
    entity_id: int,
    payload: Optional[str] = None,
    ip_address: Optional[str] = "127.0.0.1"
):
    """
    Centralized helper function for recording immutable compliance audit entries in MySQL.
    """
    try:
        log_entry = AuditLog(
            user_id=user_id,
            action=action.upper(),
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
            ip_address=ip_address,
            created_at=datetime.utcnow()
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry
    except Exception as e:
        db.rollback()
        print(f"Error recording audit log: {e}")
        return None

@router.get("/logs")
def get_audit_logs(
    user_id: Optional[int] = Query(None),
    role: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    date_range: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns enriched, immutable audit log records with multi-criteria filtering for compliance auditing.
    """
    query = db.query(AuditLog)

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)

    if action and action.lower() != 'all':
        query = query.filter(AuditLog.action == action.upper())

    if module and module.lower() != 'all':
        query = query.filter(AuditLog.entity_type.ilike(f"%{module}%"))

    if role and role.lower() != 'all':
        users_with_role = db.query(User.id).filter(User.role == role.lower()).all()
        u_ids = [u[0] for u in users_with_role]
        if u_ids:
            query = query.filter(AuditLog.user_id.in_(u_ids))
        else:
            return []

    if date_range and date_range != 'all':
        now = datetime.utcnow()
        if date_range == 'today':
            query = query.filter(AuditLog.created_at >= now.replace(hour=0, minute=0, second=0))
        elif date_range == 'week':
            query = query.filter(AuditLog.created_at >= now - timedelta(days=7))
        elif date_range == 'month':
            query = query.filter(AuditLog.created_at >= now - timedelta(days=30))

    logs = query.order_by(AuditLog.created_at.desc()).limit(150).all()

    enriched = []
    for log in logs:
        u = log.user
        username = u.username if u else "System"
        user_role = u.role if u else "system"
        full_name = u.full_name if u else "System Automated"

        enriched.append({
            "id": log.id,
            "user_id": log.user_id,
            "username": username,
            "user_role": user_role.replace('_', ' ').title(),
            "full_name": full_name,
            "action": log.action,
            "module": log.entity_type,
            "entity_id": log.entity_id,
            "payload": log.payload or "-",
            "ip_address": log.ip_address or "127.0.0.1",
            "created_at": log.created_at,
            "status": "SUCCESS"
        })

    return enriched
