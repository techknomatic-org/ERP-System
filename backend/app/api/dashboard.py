from fastapi import APIRouter, Depends, Query, Header, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timedelta
from app.database import get_db
from app.models import (
    Project, Property, Building, Unit, Customer, CrmLead, 
    PropertyBooking, PaymentInstallment, PropertyPayment, ApprovalTask, User,
    WbsTask, ProjectEstimate, ContractorBill, ProjectMilestone
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_executive_dashboard_summary(
    project_id: Optional[int] = None,
    property_id: Optional[int] = None,
    date_range: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Business Story 9 — Executive Dashboard Centralized Summary API
    Calculates live business KPIs, inventory breakdown, CRM funnel, booking statistics,
    payment/revenue metrics, management alerts, and recent transaction feeds dynamically from MySQL.
    """
    # Defensive type check for query params when invoked directly or via router
    s_filter = str(status_filter) if status_filter and isinstance(status_filter, str) else None
    
    # 1. Projects Query & Metrics
    proj_query = db.query(Project)
    if project_id and isinstance(project_id, int):
        proj_query = proj_query.filter(Project.id == project_id)
    if s_filter and s_filter.lower() != 'all':
        proj_query = proj_query.filter(Project.status == s_filter.lower())
        
    projects = proj_query.all()
    total_projects = len(projects)
    active_projects = sum(1 for p in projects if (p.status or '').lower() in ['active', 'in_progress'])
    completed_projects = sum(1 for p in projects if (p.status or '').lower() == 'completed')
    
    avg_progress = 0.0
    if total_projects > 0:
        avg_progress = round(sum(float(p.progress_pct or 0) for p in projects) / total_projects, 1)

    # 2. Properties & Buildings Query
    prop_query = db.query(Property)
    if property_id and isinstance(property_id, int):
        prop_query = prop_query.filter(Property.id == property_id)
    if project_id and isinstance(project_id, int):
        prop_query = prop_query.filter(Property.project_id == project_id)
    properties = prop_query.all()
    total_properties = len(properties)
    
    prop_ids = [p.id for p in properties]
    bld_query = db.query(Building)
    if prop_ids:
        bld_query = bld_query.filter(Building.property_id.in_(prop_ids))
    buildings = bld_query.all()
    total_buildings = len(buildings)
    bld_ids = [b.id for b in buildings]

    # 3. Units Query & Inventory Breakdown
    unit_query = db.query(Unit)
    if bld_ids:
        unit_query = unit_query.filter(Unit.building_id.in_(bld_ids))
    units = unit_query.all()
    total_units = len(units)

    available_units = sum(1 for u in units if (u.status or '').upper() == 'AVAILABLE')
    held_units = sum(1 for u in units if (u.status or '').upper() == 'HELD')
    booked_units = sum(1 for u in units if (u.status or '').upper() in ['BOOKED', 'ALLOCATED'])
    sold_units = sum(1 for u in units if (u.status or '').upper() == 'SOLD')

    # 4. Customers & CRM Leads Funnel Metrics
    total_customers = db.query(Customer).count()
    leads = db.query(CrmLead).all()
    total_leads = len(leads)
    
    new_leads = sum(1 for l in leads if (l.stage or '') == 'New')
    contacted_leads = sum(1 for l in leads if (l.stage or '') in ['Contacted', 'Follow-up'])
    site_visit_leads = sum(1 for l in leads if (l.stage or '') == 'Site Visit')
    qualified_leads = sum(1 for l in leads if (l.stage or '') == 'Qualified')
    negotiation_leads = sum(1 for l in leads if (l.stage or '') in ['Negotiation', 'Booking Stage'])

    # 5. Bookings Metrics
    booking_query = db.query(PropertyBooking)
    if bld_ids and units:
        unit_ids = [u.id for u in units]
        if unit_ids:
            booking_query = booking_query.filter(PropertyBooking.unit_id.in_(unit_ids))
            
    bookings = booking_query.all()
    total_bookings = len(bookings)
    pending_bookings = sum(1 for b in bookings if (b.status or '').upper() in ['PENDING', 'DRAFT'])
    confirmed_bookings = sum(1 for b in bookings if (b.status or '').upper() == 'CONFIRMED')
    cancelled_bookings = sum(1 for b in bookings if (b.status or '').upper() == 'CANCELLED')
    total_booking_value = sum(float(b.total_price or 0) for b in bookings if (b.status or '').upper() != 'CANCELLED')

    # 6. Payment & Revenue Metrics (from PaymentInstallments)
    installments = db.query(PaymentInstallment).all()
    amount_received = sum(float(i.paid_amount or 0) for i in installments)
    outstanding_balance = max(0.0, total_booking_value - amount_received)
    
    # Calculate overdue amount (installments past due date with remaining balance)
    now = datetime.now()
    overdue_count = 0
    overdue_amount = 0.0
    for inst in installments:
        bal = float(inst.balance_amount or (float(inst.amount or 0) - float(inst.paid_amount or 0)))
        if bal > 0 and inst.due_date and inst.due_date < now:
            overdue_count += 1
            overdue_amount += bal

    payment_completion_pct = round((amount_received / total_booking_value * 100), 1) if total_booking_value > 0 else 0.0

    # 7. Approvals Overview
    approvals = db.query(ApprovalTask).all()
    pending_approvals = sum(1 for a in approvals if (a.status or '').lower() == 'pending')
    approved_count = sum(1 for a in approvals if (a.status or '').lower() == 'approved')
    sent_back_count = sum(1 for a in approvals if (a.status or '').lower() in ['sent_back', 'sent back'])
    rejected_count = sum(1 for a in approvals if (a.status or '').lower() == 'rejected')

    # 8. Management Action Required / Alerts
    alerts = []
    if overdue_count > 0:
        alerts.append({
            "id": "alert-overdue",
            "severity": "danger",
            "icon": "DollarSign",
            "title": f"{overdue_count} Overdue Installment Payment(s)",
            "description": f"Total overdue balance: ${overdue_amount:,.2f}",
            "route": "/bookings"
        })
    if pending_approvals > 0:
        alerts.append({
            "id": "alert-approvals",
            "severity": "warning",
            "icon": "CheckSquare",
            "title": f"{pending_approvals} Pending Approval Task(s)",
            "description": "Multi-stage workflow approvals awaiting executive sign-off",
            "route": "/approvals"
        })
    followup_count = new_leads + contacted_leads
    if followup_count > 0:
        alerts.append({
            "id": "alert-leads",
            "severity": "info",
            "icon": "Users",
            "title": f"{followup_count} CRM Lead(s) Require Follow-Up",
            "description": f"{new_leads} new leads, {contacted_leads} in initial contact",
            "route": "/crm-leads"
        })
    if held_units > 0:
        alerts.append({
            "id": "alert-units",
            "severity": "secondary",
            "icon": "Key",
            "title": f"{held_units} Unit(s) Currently on Hold",
            "description": "Units reserved temporarily pending deposit clearance",
            "route": "/units"
        })

    # 9. Recent Sales & Booking Transactions Feed
    recent_txns = []
    recent_bks = db.query(PropertyBooking).order_by(PropertyBooking.created_at.desc()).limit(5).all()
    for b in recent_bks:
        cust_name = b.customer.name if b.customer else "N/A"
        recent_txns.append({
            "id": b.id,
            "order_number": b.booking_number,
            "customer_name": cust_name,
            "order_date": b.created_at.strftime("%Y-%m-%d %H:%M") if b.created_at else "-",
            "total_amount": float(b.total_price or 0),
            "status": (b.status or "CONFIRMED").upper()
        })

    # Build Project Overview List
    project_overview = [
        {
            "id": p.id,
            "code": p.code,
            "name": p.name,
            "location": p.location,
            "progress_pct": float(p.progress_pct or 0),
            "budget": float(p.budget or 0),
            "spent": float(p.actual_cost or 0),
            "status": (p.status or "active").upper()
        } for p in projects
    ]

    return {
        "kpi": {
            "total_projects": total_projects,
            "active_projects": active_projects,
            "completed_projects": completed_projects,
            "avg_project_progress": avg_progress,
            "total_properties": total_properties,
            "total_buildings": total_buildings,
            "total_units": total_units,
            "available_units": available_units,
            "held_units": held_units,
            "booked_units": booked_units,
            "sold_units": sold_units,
            "total_customers": total_customers,
            "total_leads": total_leads,
            "active_leads": new_leads + contacted_leads + site_visit_leads + qualified_leads + negotiation_leads,
            "pending_approvals": pending_approvals
        },
        "project_overview": project_overview,
        "inventory": {
            "total_properties": total_properties,
            "total_buildings": total_buildings,
            "total_units": total_units,
            "available": available_units,
            "held": held_units,
            "booked": booked_units,
            "sold": sold_units
        },
        "crm": {
            "total_leads": total_leads,
            "new_leads": new_leads,
            "contacted_leads": contacted_leads,
            "site_visit_leads": site_visit_leads,
            "qualified_leads": qualified_leads,
            "negotiation_leads": negotiation_leads,
            "converted_customers": total_customers
        },
        "bookings": {
            "total_bookings": total_bookings,
            "pending_bookings": pending_bookings,
            "confirmed_bookings": confirmed_bookings,
            "cancelled_bookings": cancelled_bookings,
            "total_booking_value": total_booking_value
        },
        "payments": {
            "total_booking_value": total_booking_value,
            "amount_received": amount_received,
            "outstanding_balance": outstanding_balance,
            "overdue_amount": overdue_amount,
            "payment_completion_pct": payment_completion_pct
        },
        "approvals": {
            "pending_approvals": pending_approvals,
            "approved_count": approved_count,
            "sent_back_count": sent_back_count,
            "rejected_count": rejected_count
        },
        "alerts": alerts,
        "recent_transactions": recent_txns
    }

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Legacy stats endpoint for backward compatibility."""
    summary = get_executive_dashboard_summary(db=db)
    kpi = summary["kpi"]
    return {
        "total_projects": kpi["total_projects"],
        "active_projects": kpi["active_projects"],
        "total_properties": kpi["total_properties"],
        "total_units": kpi["total_units"],
        "available_units": kpi["available_units"],
        "booked_units": kpi["booked_units"],
        "total_customers": kpi["total_customers"],
        "active_leads": kpi["active_leads"],
        "pending_approvals": kpi["pending_approvals"],
        "project_progress": kpi["avg_project_progress"]
    }

@router.get("/recent-orders")
def get_recent_orders(db: Session = Depends(get_db)):
    """Legacy recent orders endpoint for backward compatibility."""
    summary = get_executive_dashboard_summary(db=db)
    return summary["recent_transactions"]


# ==================================================
# PRV-01 UNIFIED PROJECT DASHBOARD ENDPOINTS & HELPERS
# ==================================================

def resolve_user_role(role_param=None, x_user_role=None) -> str:
    def extract_str(val):
        if hasattr(val, 'default'):
            val = val.default
        return val if isinstance(val, str) else None
    r_val = extract_str(role_param)
    x_val = extract_str(x_user_role)
    return (r_val or x_val or 'admin').strip().lower()


def get_action_queue_for_project(project_id: int, user_role: str, db: Session) -> dict:
    """
    Action Queue Widget using the canonical Workflow Engine from app.api.approvals.
    Filters pending approval tasks by project context and user role.
    """
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found or access denied")

    from app.api.approvals import build_task_dict
    
    # Query all pending approval tasks
    pending_tasks = db.query(ApprovalTask).filter(ApprovalTask.status == 'pending').order_by(ApprovalTask.created_at.desc()).all()
    formatted = [build_task_dict(t, db) for t in pending_tasks]
    
    # Filter by project_id
    proj_tasks = [
        t for t in formatted 
        if t.get("projectId") == project_id or t.get("project_id") == project_id
    ]
    
    u_role = (user_role or "admin").lower()
    if u_role in ["admin", "administrator", "system_admin"]:
        role_tasks = proj_tasks
    elif u_role in ["management", "executive"]:
        role_tasks = [t for t in proj_tasks if t.get("current_stage") == "Management" and t.get("requestCategory") == "FINANCIAL"]
    elif u_role in ["finance", "accountant"]:
        role_tasks = [t for t in proj_tasks if t.get("is_financial") and t.get("current_stage") == "Finance"]
    elif u_role in ["project_manager", "pm"]:
        role_tasks = [t for t in proj_tasks if t.get("current_stage") == "Project Manager"]
    elif u_role in ["site_engineer", "je", "site"]:
        role_tasks = [t for t in proj_tasks if t.get("current_stage") == "Site Engineer"]
    elif u_role in ["executive_engineer", "ee"]:
        role_tasks = [t for t in proj_tasks if (t.get("current_stage") or "").lower() in ["executive engineer", "ee", "technical sanction"]]
    else:
        role_tasks = proj_tasks
        
    action_items = []
    for item in role_tasks:
        sub_date = item.get("submissionDate")
        if not sub_date and item.get("created_at"):
            sub_date = item["created_at"].strftime("%Y-%m-%d %H:%M")
        elif isinstance(sub_date, str) and "T" in sub_date:
            sub_date = sub_date.replace("T", " ")[:16]
        
        action_items.append({
            "id": item["id"],
            "title": item["title"],
            "category": item.get("requestType") or item.get("category") or "Approval",
            "current_stage": item.get("current_stage", "Project Manager"),
            "submitted_date": str(sub_date or "-"),
            "status": item.get("status", "pending"),
            "project_name": item.get("projectName") or proj.name,
            "route": f"/approvals?task_id={item['id']}"
        })
        
    return {
        "count": len(action_items),
        "items": action_items
    }


def get_schedule_snapshot_for_project(project_id: int, date_range: str, db: Session) -> dict:
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found or access denied")

    now = datetime.utcnow()
    start_bound = None
    end_bound = None

    d_val = date_range.default if hasattr(date_range, 'default') else date_range
    if not isinstance(d_val, str):
        d_val = 'full_contract'
    d_range = d_val.lower().replace('-', '_').replace(' ', '_')

    if d_range == 'this_week':
        start_bound = now - timedelta(days=now.weekday())
        start_bound = start_bound.replace(hour=0, minute=0, second=0, microsecond=0)
        end_bound = start_bound + timedelta(days=7)
    elif d_range == 'this_month':
        start_bound = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if now.month == 12:
            end_bound = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            end_bound = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)

    wbs_tasks_query = db.query(WbsTask).filter(WbsTask.project_id == project_id)
    if start_bound and end_bound:
        wbs_tasks_query = wbs_tasks_query.filter(
            WbsTask.start_date <= end_bound,
            WbsTask.end_date >= start_bound
        )

    wbs_tasks = wbs_tasks_query.all()
    total_wbs_nodes = len(wbs_tasks)
    completed_wbs_nodes = sum(1 for t in wbs_tasks if (t.status or '').lower() in ['completed', 'finished', 'closed'] or float(t.progress_pct or 0) >= 100)
    active_wbs_nodes = sum(1 for t in wbs_tasks if (t.status or '').lower() in ['in_progress', 'active', 'started'] and float(t.progress_pct or 0) < 100)
    delayed_wbs_nodes = sum(
        1 for t in wbs_tasks 
        if (t.status or '').lower() not in ['completed', 'finished', 'closed'] 
        and float(t.progress_pct or 0) < 100 
        and t.end_date and t.end_date < now
    )

    milestones_query = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == project_id)
    if start_bound and end_bound:
        milestones_query = milestones_query.filter(
            ProjectMilestone.target_date >= start_bound.date(),
            ProjectMilestone.target_date <= end_bound.date()
        )
    milestones = milestones_query.all()
    
    today = now.date()
    total_milestones = len(milestones)
    completed_milestones = sum(1 for m in milestones if (m.status or '').upper() == 'COMPLETED')
    
    def is_m_delayed(m):
        if (m.status or '').upper() in ['DELAYED', 'BREACHED']:
            return True
        if not m.target_date or (m.status or '').upper() == 'COMPLETED':
            return False
        m_d = m.target_date.date() if hasattr(m.target_date, 'date') else m.target_date
        return m_d < today

    delayed_milestones = sum(1 for m in milestones if is_m_delayed(m))
    upcoming_milestones = max(0, total_milestones - completed_milestones - delayed_milestones)

    milestone_items = []
    for m in milestones[:10]:
        milestone_items.append({
            "id": m.id,
            "name": m.milestone_name,
            "target_date": m.target_date.strftime("%Y-%m-%d") if m.target_date else "-",
            "status": (m.status or "PENDING").upper(),
            "is_delayed": is_m_delayed(m)
        })

    wbs_progress_pct = float(proj.progress_pct or 0.0)
    if total_wbs_nodes > 0:
        wbs_progress_pct = round(sum(float(t.progress_pct or 0) for t in wbs_tasks) / total_wbs_nodes, 1)

    return {
        "wbs_progress_pct": wbs_progress_pct,
        "total_wbs_nodes": total_wbs_nodes,
        "active_wbs_nodes": active_wbs_nodes,
        "completed_wbs_nodes": completed_wbs_nodes,
        "delayed_wbs_nodes": delayed_wbs_nodes,
        "total_milestones": total_milestones,
        "completed_milestones": completed_milestones,
        "upcoming_milestones": upcoming_milestones,
        "delayed_milestones": delayed_milestones,
        "milestone_items": milestone_items
    }


def get_cost_snapshot_for_project(project_id: int, db: Session) -> dict:
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found or access denied")

    estimate = db.query(ProjectEstimate).filter(ProjectEstimate.project_id == project_id).order_by(ProjectEstimate.id.desc()).first()
    estimate_total = float(estimate.total_amount or estimate.base_amount or 0.0) if estimate else float(proj.budget or 0.0)

    bills = db.query(ContractorBill).filter(ContractorBill.project_id == project_id).all()
    total_billed = sum(
        float(b.total_billed_amount or 0.0) 
        for b in bills 
        if (b.status or '').lower() not in ['cancelled', 'rejected']
    )

    remaining_amount = max(0.0, estimate_total - total_billed)
    billed_percentage = round((total_billed / estimate_total * 100), 2) if estimate_total > 0 else 0.0

    return {
        "estimate_total": estimate_total,
        "billed_total": total_billed,
        "remaining_amount": remaining_amount,
        "billed_percentage": billed_percentage
    }


def get_approvals_pending_for_project(project_id: int, user_role: str, db: Session) -> dict:
    action_data = get_action_queue_for_project(project_id, user_role, db)
    return {
        "pending_count": action_data["count"],
        "items": action_data["items"][:5]
    }


@router.get("/user-projects")
def get_user_projects(
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    """
    Returns all projects accessible to the user, identifying the default (most-recently active) project.
    """
    projects = db.query(Project).order_by(Project.id.desc()).all()
    if not projects:
        return {"projects": [], "default_project_id": None}

    active_projects = [p for p in projects if (p.status or '').upper() in ['ACTIVE', 'IN_PROGRESS']]
    default_proj = active_projects[0] if active_projects else projects[0]

    project_list = []
    for p in projects:
        project_list.append({
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "status": (p.status or "DRAFT").upper(),
            "progress_pct": float(p.progress_pct or 0.0),
            "is_default": p.id == default_proj.id
        })

    return {
        "projects": project_list,
        "default_project_id": default_proj.id
    }


@router.get("/project/{project_id}/action-queue")
def api_get_action_queue(
    project_id: int,
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    role_param: Optional[str] = Query(None, alias="role"),
    db: Session = Depends(get_db)
):
    user_role = resolve_user_role(role_param, x_user_role)
    return get_action_queue_for_project(project_id, user_role, db)


@router.get("/project/{project_id}/schedule-snapshot")
def api_get_schedule_snapshot(
    project_id: int,
    date_range: Optional[str] = Query("full_contract"),
    db: Session = Depends(get_db)
):
    return get_schedule_snapshot_for_project(project_id, date_range, db)


@router.get("/project/{project_id}/cost-snapshot")
def api_get_cost_snapshot(
    project_id: int,
    db: Session = Depends(get_db)
):
    return get_cost_snapshot_for_project(project_id, db)


@router.get("/project/{project_id}/approvals-pending")
def api_get_approvals_pending(
    project_id: int,
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    role_param: Optional[str] = Query(None, alias="role"),
    db: Session = Depends(get_db)
):
    user_role = resolve_user_role(role_param, x_user_role)
    return get_approvals_pending_for_project(project_id, user_role, db)


@router.get("/project/{project_id}/unified")
def get_unified_project_dashboard(
    project_id: int,
    date_range: Optional[str] = Query("full_contract"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    role_param: Optional[str] = Query(None, alias="role"),
    db: Session = Depends(get_db)
):
    """
    PRV-01: Unified Project Dashboard Endpoint.
    Consolidates Action Queue, Schedule Snapshot, Cost Snapshot, and Approvals Pending.
    Enforces server-side authorization, role checks, and tenant isolation.
    """
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found or access denied")

    user_role = resolve_user_role(role_param, x_user_role)
    is_se = user_role in ['site_engineer', 'je', 'site']
    is_admin = user_role in ['admin', 'administrator', 'system_admin']

    d_val = date_range.default if hasattr(date_range, 'default') else date_range
    if not isinstance(d_val, str):
        d_val = 'full_contract'
    d_range = d_val.lower().replace('-', '_').replace(' ', '_')

    # Fetch all widget sections cleanly
    action_queue = get_action_queue_for_project(project_id, user_role, db)
    schedule_snapshot = get_schedule_snapshot_for_project(project_id, d_range, db)
    cost_snapshot = get_cost_snapshot_for_project(project_id, db)
    approvals_pending = {
        "pending_count": action_queue["count"],
        "items": action_queue["items"][:5]
    }

    role_permissions = {
        "can_view_cost": not is_se or is_admin,
        "can_view_schedule": True,
        "can_view_action_queue": True,
        "can_view_approvals": True
    }

    return {
        "project": {
            "id": proj.id,
            "name": proj.name,
            "code": proj.code,
            "status": (proj.status or "DRAFT").upper(),
            "budget": float(proj.budget or 0.0),
            "progress_pct": float(proj.progress_pct or 0.0)
        },
        "date_range": d_range,
        "action_queue": action_queue,
        "schedule_snapshot": schedule_snapshot,
        "cost_snapshot": cost_snapshot,
        "approvals_pending": approvals_pending,
        "role_permissions": role_permissions
    }

