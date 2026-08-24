from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import Customer, CrmLead, AuditLog
from app.schemas import CustomerCreate, CustomerResponse

router = APIRouter(prefix="/api/customers", tags=["Customer Management"])

def enrich_customer(cust: Customer) -> dict:
    source_lead = cust.source_lead
    return {
        "id": cust.id,
        "customer_code": cust.customer_code or f"CUST-{cust.id:04d}",
        "name": cust.name,
        "contact_person": cust.contact_person or cust.name,
        "email": cust.email,
        "phone": cust.phone,
        "company": cust.company,
        "customer_type": cust.customer_type or "Individual",
        "status": cust.status or "active",
        "source_lead_id": cust.source_lead_id,
        "source_lead_name": source_lead.customer_name if source_lead else None,
        "source_lead_stage": source_lead.stage if source_lead else None,
        "address": cust.address,
        "city": cust.city,
        "state": cust.state,
        "postal_code": cust.postal_code,
        "notes": cust.notes,
        "created_at": cust.created_at
    }

@router.get("/", response_model=List[dict])
def list_customers(
    search: Optional[str] = None,
    customer_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Customer)

    if customer_type and customer_type.upper() != "ALL":
        query = query.filter(Customer.customer_type == customer_type)

    if status and status.upper() != "ALL":
        query = query.filter(Customer.status == status)

    customers = query.order_by(Customer.created_at.desc()).all()

    if search:
        s = search.lower()
        customers = [
            c for c in customers if (
                (c.customer_code and s in c.customer_code.lower()) or
                (c.name and s in c.name.lower()) or
                (c.company and s in c.company.lower()) or
                (c.phone and s in c.phone.lower()) or
                (c.email and s in c.email.lower())
            )
        ]

    return [enrich_customer(c) for c in customers]

@router.get("/{customer_id}", response_model=dict)
def get_customer_by_id(customer_id: int, db: Session = Depends(get_db)):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer record not found")
    return enrich_customer(cust)

@router.post("/", response_model=dict)
def create_customer(cust_in: CustomerCreate, db: Session = Depends(get_db)):
    # Generate customer_code if not provided
    cust_code = cust_in.customer_code
    if not cust_code:
        count = db.query(Customer).count()
        cust_code = f"CUST-{(count + 1):04d}"
        while db.query(Customer).filter(Customer.customer_code == cust_code).first() is not None:
            count += 1
            cust_code = f"CUST-{(count + 1):04d}"

    cust = Customer(
        customer_code=cust_code,
        name=cust_in.name,
        contact_person=cust_in.contact_person or cust_in.name,
        email=cust_in.email,
        phone=cust_in.phone,
        company=cust_in.company,
        customer_type=cust_in.customer_type or "Individual",
        status=cust_in.status or "active",
        source_lead_id=cust_in.source_lead_id,
        address=cust_in.address,
        city=cust_in.city,
        state=cust_in.state,
        postal_code=cust_in.postal_code,
        notes=cust_in.notes
    )
    db.add(cust)
    db.commit()
    db.refresh(cust)

    audit = AuditLog(user_id=1, action="CREATE", entity_type="Customer", entity_id=cust.id, payload=f"Created Customer: {cust.customer_code} ({cust.name})")
    db.add(audit)
    db.commit()

    return enrich_customer(cust)

@router.put("/{customer_id}", response_model=dict)
def update_customer(customer_id: int, cust_in: CustomerCreate, db: Session = Depends(get_db)):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer record not found")

    for field, val in cust_in.model_dump(exclude_unset=True).items():
        if field != "customer_code": # Do not overwrite customer_code
            setattr(cust, field, val)

    db.commit()
    db.refresh(cust)

    audit = AuditLog(user_id=1, action="UPDATE", entity_type="Customer", entity_id=cust.id, payload=f"Updated Customer #{cust.id}: {cust.name}")
    db.add(audit)
    db.commit()

    return enrich_customer(cust)
