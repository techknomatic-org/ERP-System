import os
from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models import User, Project, WbsTask, Notification, ApprovalTask, MeasurementBook, Hindrance
from app.schemas import EmbSyncRequest, HindranceSyncRequest
from app.api.auth import get_current_user
from app.api.boq_mb import sync_offline_emb_entries
from app.api.hindrances import sync_offline_hindrance_entries

router = APIRouter(prefix="/api/mobile", tags=["Mobile App Support (INT-05)"])

MIN_APP_VERSION = "2.0.0"
MIN_SCHEMA_VERSION = 2

def verify_client_version(
    x_app_version: Optional[str] = Header(None, alias="X-App-Version"),
    x_app_schema_version: Optional[str] = Header(None, alias="X-App-Schema-Version")
):
    """Enforces server-side mobile application schema & version compatibility."""
    if x_app_schema_version is not None:
        try:
            s_ver = int(x_app_schema_version)
            if s_ver < MIN_SCHEMA_VERSION:
                raise HTTPException(
                    status_code=status.HTTP_426_UPGRADE_REQUIRED,
                    detail="Please update the app"
                )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_426_UPGRADE_REQUIRED,
                detail="Please update the app"
            )

    if x_app_version is not None:
        try:
            v_clean = x_app_version.strip()
            parts = v_clean.split(".")
            major = int(parts[0])
            if major < 2:
                raise HTTPException(
                    status_code=status.HTTP_426_UPGRADE_REQUIRED,
                    detail="Please update the app"
                )
        except (ValueError, IndexError):
            raise HTTPException(
                status_code=status.HTTP_426_UPGRADE_REQUIRED,
                detail="Please update the app"
            )


@router.get("/version-check")
def check_mobile_version(
    client_version: Optional[str] = Query(None),
    schema_version: Optional[int] = Query(None)
):
    """Determines whether the client version/schema is compatible with the API."""
    is_compatible = True
    if schema_version is not None and schema_version < MIN_SCHEMA_VERSION:
        is_compatible = False
    if client_version is not None:
        try:
            parts = client_version.strip().split(".")
            if int(parts[0]) < 2:
                is_compatible = False
        except Exception:
            is_compatible = False

    return {
        "current_server_version": "2.0.0",
        "min_required_version": MIN_APP_VERSION,
        "min_required_schema": MIN_SCHEMA_VERSION,
        "is_compatible": is_compatible,
        "update_required": not is_compatible,
        "message": "App is up to date" if is_compatible else "Please update the app"
    }


class MobileUnifiedSyncRequest(BaseModel):
    emb_items: Optional[List[dict]] = []
    hindrance_items: Optional[List[dict]] = []


@router.post("/sync")
def mobile_unified_sync(
    payload: MobileUnifiedSyncRequest,
    x_app_version: Optional[str] = Header(None, alias="X-App-Version"),
    x_app_schema_version: Optional[str] = Header(None, alias="X-App-Schema-Version"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Unified idempotent offline synchronization endpoint for mobile clients.
    Dispatches e-MB items and Hindrance items while enforcing client version compatibility.
    """
    verify_client_version(x_app_version, x_app_schema_version)

    results = {
        "emb_synced": [],
        "emb_conflicts": [],
        "hindrance_synced": [],
        "hindrance_conflicts": []
    }

    # 1. Process e-MB items
    if payload.emb_items:
        emb_req = EmbSyncRequest(items=payload.emb_items)
        emb_res = sync_offline_emb_entries(emb_req, current_user=current_user, db=db)
        results["emb_synced"] = emb_res.get("synced", [])
        results["emb_conflicts"] = emb_res.get("conflicts", [])

    # 2. Process Hindrance items
    if payload.hindrance_items:
        h_req = HindranceSyncRequest(items=payload.hindrance_items)
        h_res = sync_offline_hindrance_entries(h_req, current_user=current_user, db=db)
        results["hindrance_synced"] = h_res.get("synced", [])
        results["hindrance_conflicts"] = h_res.get("conflicts", [])

    return results


@router.get("/bootstrap")
def get_mobile_bootstrap_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns primed cache data for mobile offline storage:
    - User details & role
    - Projects list
    - WBS tasks
    - Pending action queue & approvals
    - Recent notifications
    """
    # Projects
    projects = db.query(Project).filter(Project.status != "CLOSED").order_by(Project.id.desc()).all()
    project_list = [{
        "id": p.id,
        "name": p.name,
        "code": p.code,
        "status": p.status,
        "location": p.location,
        "progress_pct": float(p.progress_pct or 0.0),
        "budget": float(p.budget or 0.0)
    } for p in projects]

    # WBS tasks for accessible projects
    proj_ids = [p.id for p in projects]
    wbs_tasks = db.query(WbsTask).filter(WbsTask.project_id.in_(proj_ids)).all() if proj_ids else []
    wbs_list = [{
        "id": t.id,
        "project_id": t.project_id,
        "parent_task_id": t.parent_task_id,
        "task_level": t.task_level,
        "wbs_code": t.wbs_code,
        "title": t.title,
        "status": t.status,
        "progress_pct": float(t.progress_pct or 0.0),
        "planned_qty": float(t.planned_qty or 0.0),
        "actual_qty": float(t.actual_qty or 0.0),
        "unit": getattr(t, "unit", "m³") or "m³"
    } for t in wbs_tasks]

    # Notifications
    notifs = db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).limit(20).all()
    notif_list = [{
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "notification_type": n.notification_type,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None
    } for n in notifs]

    return {
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role
        },
        "projects": project_list,
        "wbs_tasks": wbs_list,
        "notifications": notif_list,
        "min_app_version": MIN_APP_VERSION,
        "server_time": datetime.utcnow().isoformat()
    }
