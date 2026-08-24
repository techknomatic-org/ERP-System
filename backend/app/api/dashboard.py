from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timedelta
from app.database import get_db
from app.models import (
    Project, Property, Building, Unit, Customer, CrmLead, 
    PropertyBooking, PaymentInstallment, PropertyPayment, ApprovalTask, User
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
