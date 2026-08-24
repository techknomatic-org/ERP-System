from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from datetime import datetime
from app.database import get_db
from app.models import Tenant, HelpdeskTicket, FacilityWorkOrder, UtilityBill, VisitorPass, AuditLog, Notification
from app.schemas import (
    TenantCreate, TenantResponse,
    HelpdeskTicketCreate, HelpdeskTicketResponse,
    FacilityWorkOrderCreate, FacilityWorkOrderResponse,
    UtilityBillCreate, UtilityBillResponse,
    VisitorPassCreate, VisitorPassResponse
)

router = APIRouter(prefix="/api/facility", tags=["Facility Management & Maintenance"])

# 1. Tenants API
@router.get("/tenants", response_model=List[TenantResponse])
def list_tenants(db: Session = Depends(get_db)):
    return db.query(Tenant).order_by(Tenant.created_at.desc()).all()

@router.post("/tenants", response_model=TenantResponse)
def create_tenant(t_in: TenantCreate, db: Session = Depends(get_db)):
    code = f"TNT-{uuid.uuid4().hex[:8].upper()}"
    tenant = Tenant(
        tenant_code=code,
        name=t_in.name,
        company_name=t_in.company_name,
        email=t_in.email,
        phone=t_in.phone,
        unit_id=t_in.unit_id,
        rent_amount=t_in.rent_amount,
        lease_start=t_in.lease_start,
        lease_end=t_in.lease_end,
        security_deposit=t_in.security_deposit,
        status="active"
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    audit = AuditLog(user_id=1, action="CREATE", entity_type="Tenant", entity_id=tenant.id, payload=f"Registered Tenant: {tenant.name} for Unit #{tenant.unit_id}")
    db.add(audit)
    db.commit()

    return tenant

# 2. Helpdesk Service Tickets API
@router.get("/tickets", response_model=List[HelpdeskTicketResponse])
def list_helpdesk_tickets(db: Session = Depends(get_db)):
    return db.query(HelpdeskTicket).order_by(HelpdeskTicket.created_at.desc()).all()

@router.post("/tickets", response_model=HelpdeskTicketResponse)
def create_helpdesk_ticket(t_in: HelpdeskTicketCreate, db: Session = Depends(get_db)):
    code = f"TCK-{uuid.uuid4().hex[:8].upper()}"
    ticket = HelpdeskTicket(
        ticket_code=code,
        tenant_id=t_in.tenant_id,
        unit_id=t_in.unit_id,
        category=t_in.category,
        priority=t_in.priority or "medium",
        subject=t_in.subject,
        description=t_in.description,
        status="open"
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    notif = Notification(
        user_id=1,
        title=f"New Helpdesk Service Ticket #{code}",
        message=f"Tenant Ticket: {ticket.subject} (Category: {ticket.category}, Priority: {ticket.priority.upper()})",
        notification_type="info",
        entity_type="HelpdeskTicket",
        entity_id=ticket.id
    )
    db.add(notif)
    db.commit()

    return ticket

@router.put("/tickets/{ticket_id}/status")
def update_ticket_status(ticket_id: int, new_status: str, db: Session = Depends(get_db)):
    ticket = db.query(HelpdeskTicket).filter(HelpdeskTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old = ticket.status
    ticket.status = new_status
    db.commit()

    audit = AuditLog(user_id=1, action="UPDATE", entity_type="HelpdeskTicket", entity_id=ticket.id, payload=f"Ticket #{ticket.ticket_code} status changed from '{old}' to '{new_status}'")
    db.add(audit)
    db.commit()

    return {"message": "Ticket status updated", "ticket_id": ticket.id, "status": new_status}

# 3. Facility Maintenance Work Orders API
@router.get("/work-orders", response_model=List[FacilityWorkOrderResponse])
def list_work_orders(db: Session = Depends(get_db)):
    return db.query(FacilityWorkOrder).order_by(FacilityWorkOrder.created_at.desc()).all()

@router.post("/work-orders", response_model=FacilityWorkOrderResponse)
def create_work_order(wo_in: FacilityWorkOrderCreate, db: Session = Depends(get_db)):
    code = f"WO-{uuid.uuid4().hex[:8].upper()}"
    wo = FacilityWorkOrder(
        work_order_code=code,
        property_id=wo_in.property_id,
        unit_id=wo_in.unit_id,
        technician_id=wo_in.technician_id,
        maintenance_type=wo_in.maintenance_type or "Preventive",
        description=wo_in.description,
        scheduled_date=wo_in.scheduled_date,
        estimated_cost=wo_in.estimated_cost,
        status="open"
    )
    db.add(wo)
    db.commit()
    db.refresh(wo)

    audit = AuditLog(user_id=1, action="CREATE", entity_type="FacilityWorkOrder", entity_id=wo.id, payload=f"Generated {wo.maintenance_type} Work Order #{code}")
    db.add(audit)
    db.commit()

    return wo

# 4. Utility Meter Billing API
@router.get("/utility-bills", response_model=List[UtilityBillResponse])
def list_utility_bills(db: Session = Depends(get_db)):
    return db.query(UtilityBill).order_by(UtilityBill.created_at.desc()).all()

@router.post("/utility-bills", response_model=UtilityBillResponse)
def create_utility_bill(b_in: UtilityBillCreate, db: Session = Depends(get_db)):
    code = f"UTIL-{uuid.uuid4().hex[:8].upper()}"
    consumed = float(b_in.curr_reading) - float(b_in.prev_reading)
    if consumed < 0:
        raise HTTPException(status_code=400, detail="Current meter reading cannot be lower than previous reading")

    total = consumed * float(b_in.rate_per_unit)
    bill = UtilityBill(
        bill_code=code,
        unit_id=b_in.unit_id,
        utility_type=b_in.utility_type,
        meter_number=b_in.meter_number,
        prev_reading=b_in.prev_reading,
        curr_reading=b_in.curr_reading,
        units_consumed=consumed,
        rate_per_unit=b_in.rate_per_unit,
        total_amount=total,
        due_date=b_in.due_date,
        status="pending"
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)

    audit = AuditLog(user_id=1, action="CREATE", entity_type="UtilityBill", entity_id=bill.id, payload=f"Generated Utility Bill #{code} ({b_in.utility_type}) - Total: ${total}")
    db.add(audit)
    db.commit()

    return bill

# 5. Visitor Gate Passes API
@router.get("/visitor-passes", response_model=List[VisitorPassResponse])
def list_visitor_passes(db: Session = Depends(get_db)):
    return db.query(VisitorPass).order_by(VisitorPass.created_at.desc()).all()

@router.post("/visitor-passes", response_model=VisitorPassResponse)
def create_visitor_pass(v_in: VisitorPassCreate, db: Session = Depends(get_db)):
    code = f"GP-{uuid.uuid4().hex[:6].upper()}"
    vpass = VisitorPass(
        pass_code=code,
        property_id=v_in.property_id,
        unit_id=v_in.unit_id,
        visitor_name=v_in.visitor_name,
        visitor_phone=v_in.visitor_phone,
        purpose=v_in.purpose,
        check_in_time=datetime.utcnow(),
        status="checked_in"
    )
    db.add(vpass)
    db.commit()
    db.refresh(vpass)

    audit = AuditLog(user_id=1, action="CREATE", entity_type="VisitorPass", entity_id=vpass.id, payload=f"Issued Gate Pass #{code} for Visitor {vpass.visitor_name}")
    db.add(audit)
    db.commit()

    return vpass

@router.put("/visitor-passes/{pass_id}/checkout")
def checkout_visitor_pass(pass_id: int, db: Session = Depends(get_db)):
    vpass = db.query(VisitorPass).filter(VisitorPass.id == pass_id).first()
    if not vpass:
        raise HTTPException(status_code=404, detail="Visitor pass not found")

    vpass.check_out_time = datetime.utcnow()
    vpass.status = "checked_out"
    db.commit()

    return {"message": "Visitor checked out successfully", "pass_id": vpass.id, "check_out_time": vpass.check_out_time}
