from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import CrmLead, CrmFollowup, CrmSiteVisit, CrmLeadActivity, Customer, AuditLog, User, Property, Project
from app.schemas import (
    CrmLeadCreate, CrmLeadResponse,
    CrmFollowupCreate, CrmSiteVisitCreate, LeadQualificationCreate
)

router = APIRouter(prefix="/api/crm/leads", tags=["CRM & Leads"])

VALID_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "SITE_VISIT", "NEGOTIATION", "BOOKING"]

def enrich_lead(lead: CrmLead) -> dict:
    salesperson_name = lead.salesperson.full_name if lead.salesperson else None
    property_name = lead.property.name if lead.property else None
    project_name = lead.project.name if lead.project else None

    customer_code = lead.customer.customer_code if lead.customer else None
    customer_name_linked = lead.customer.name if lead.customer else None

    return {
        "id": lead.id,
        "customer_name": lead.customer_name,
        "email": lead.email,
        "phone": lead.phone,
        "company": lead.company,
        "property_category": lead.property_category or "Commercial",
        "interested_unit_id": lead.interested_unit_id,
        "project_id": lead.project_id,
        "property_id": lead.property_id,
        "preferred_unit_type": lead.preferred_unit_type,
        "budget": float(lead.budget or 0),
        "source": lead.source or "Website",
        "salesperson_id": lead.salesperson_id,
        "salesperson_name": salesperson_name,
        "property_name": property_name,
        "project_name": project_name,
        "stage": (lead.stage or "NEW").upper(),
        "lead_type": lead.lead_type or "Individual",
        "priority": lead.priority or "Medium",
        "requirement": lead.requirement,
        "notes": lead.notes,
        "qualification_notes": lead.qualification_notes,
        "expected_closing_date": lead.expected_closing_date,
        "requirement_confirmed": lead.requirement_confirmed or False,
        "budget_available": lead.budget_available or False,
        "decision_maker_identified": lead.decision_maker_identified or False,
        "created_at": lead.created_at,
        "customer_id": lead.customer_id,
        "customer_code": customer_code,
        "customer_linked_name": customer_name_linked,
        "converted_at": lead.converted_at,
        "followups": [
            {
                "id": f.id,
                "lead_id": f.lead_id,
                "followup_date": f.followup_date,
                "followup_type": f.followup_type,
                "notes": f.notes,
                "next_action": f.next_action,
                "status": f.status,
                "created_at": f.created_at
            } for f in (lead.followups or [])
        ],
        "site_visits": [
            {
                "id": sv.id,
                "lead_id": sv.lead_id,
                "property_id": sv.property_id,
                "property_name": sv.property.name if sv.property else None,
                "visit_date": sv.visit_date,
                "assigned_executive_id": sv.assigned_executive_id,
                "assigned_executive_name": sv.assigned_executive.full_name if sv.assigned_executive else None,
                "status": sv.status,
                "notes": sv.notes,
                "customer_feedback": sv.customer_feedback,
                "interest_level": sv.interest_level,
                "next_action": sv.next_action,
                "created_at": sv.created_at
            } for sv in (lead.site_visits or [])
        ],
        "activities": [
            {
                "id": act.id,
                "lead_id": act.lead_id,
                "activity_type": act.activity_type,
                "description": act.description,
                "created_at": act.created_at
            } for act in sorted(lead.activities or [], key=lambda a: a.created_at, reverse=True)
        ]
    }

@router.get("/kpis")
def get_crm_kpis(db: Session = Depends(get_db)):
    """Calculates live CRM pipeline KPIs directly from MySQL."""
    all_leads = db.query(CrmLead).all()
    kpis = {
        "total": len(all_leads),
        "new": 0,
        "contacted": 0,
        "qualified": 0,
        "site_visit": 0,
        "negotiation": 0,
        "booking": 0
    }

    for l in all_leads:
        st = (l.stage or "NEW").upper()
        if st == "NEW" or st == "NEW LEADS":
            kpis["new"] += 1
        elif st == "CONTACTED":
            kpis["contacted"] += 1
        elif st == "QUALIFIED":
            kpis["qualified"] += 1
        elif st == "SITE_VISIT" or st == "SITE VISIT":
            kpis["site_visit"] += 1
        elif st == "NEGOTIATION":
            kpis["negotiation"] += 1
        elif st == "BOOKING":
            kpis["booking"] += 1
        else:
            kpis["new"] += 1

    return kpis

@router.get("/", response_model=List[dict])
def list_leads(
    search: Optional[str] = None,
    stage: Optional[str] = None,
    source: Optional[str] = None,
    priority: Optional[str] = None,
    salesperson_id: Optional[int] = None,
    property_id: Optional[int] = None,
    project_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(CrmLead)

    if stage and stage.upper() != "ALL":
        query = query.filter(CrmLead.stage == stage.upper())

    if source and source != "ALL":
        query = query.filter(CrmLead.source == source)

    if priority and priority != "ALL":
        query = query.filter(CrmLead.priority == priority)

    if salesperson_id:
        query = query.filter(CrmLead.salesperson_id == salesperson_id)

    if property_id:
        query = query.filter(CrmLead.property_id == property_id)

    if project_id:
        query = query.filter(CrmLead.project_id == project_id)

    leads = query.order_by(CrmLead.created_at.desc()).all()
    
    if search:
        s = search.lower()
        leads = [
            l for l in leads if (
                (l.customer_name and s in l.customer_name.lower()) or
                (l.company and s in l.company.lower()) or
                (l.phone and s in l.phone.lower()) or
                (l.email and s in l.email.lower())
            )
        ]

    return [enrich_lead(l) for l in leads]

@router.get("/{lead_id}", response_model=dict)
def get_lead_by_id(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(CrmLead).filter(CrmLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return enrich_lead(lead)

@router.post("/", response_model=dict)
def create_lead(lead_in: CrmLeadCreate, db: Session = Depends(get_db)):
    st = (lead_in.stage or "NEW").upper()
    lead_dict = lead_in.model_dump()
    lead_dict["stage"] = st

    lead = CrmLead(**lead_dict)
    db.add(lead)
    db.commit()
    db.refresh(lead)

    # Initial Activity Timeline record
    act = CrmLeadActivity(lead_id=lead.id, activity_type="CREATE", description=f"Lead record created for {lead.customer_name} via {lead.source or 'Direct'}")
    db.add(act)

    audit = AuditLog(user_id=1, action="CREATE", entity_type="Lead", entity_id=lead.id, payload=f"Created CRM Lead: {lead.customer_name} ({st})")
    db.add(audit)
    db.commit()

    return enrich_lead(lead)

@router.put("/{lead_id}", response_model=dict)
def update_lead(lead_id: int, lead_in: CrmLeadCreate, db: Session = Depends(get_db)):
    lead = db.query(CrmLead).filter(CrmLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    old_stage = (lead.stage or "NEW").upper()
    new_stage = (lead_in.stage or old_stage).upper()

    for field, val in lead_in.model_dump(exclude_unset=True).items():
        setattr(lead, field, val)

    lead.stage = new_stage

    if old_stage != new_stage:
        act = CrmLeadActivity(lead_id=lead.id, activity_type="STAGE_CHANGE", description=f"Pipeline stage updated from '{old_stage}' to '{new_stage}'")
        db.add(act)

    db.commit()
    db.refresh(lead)

    audit = AuditLog(user_id=1, action="UPDATE", entity_type="Lead", entity_id=lead.id, payload=f"Updated CRM Lead #{lead.id}: {lead.customer_name}")
    db.add(audit)
    db.commit()

    return enrich_lead(lead)

@router.put("/{lead_id}/stage")
def update_lead_stage(lead_id: int, new_stage: str, db: Session = Depends(get_db)):
    lead = db.query(CrmLead).filter(CrmLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    target_stage = new_stage.upper().replace(" ", "_")
    old_stage = (lead.stage or "NEW").upper()

    lead.stage = target_stage

    act = CrmLeadActivity(lead_id=lead.id, activity_type="STAGE_CHANGE", description=f"Lead stage updated from '{old_stage}' to '{target_stage}'")
    db.add(act)

    db.commit()

    audit = AuditLog(user_id=1, action="UPDATE", entity_type="Lead", entity_id=lead.id, payload=f"Lead #{lead.id} stage moved to '{target_stage}'")
    db.add(audit)
    db.commit()

    return {"message": "Lead stage updated successfully", "lead_id": lead.id, "new_stage": target_stage}

@router.post("/{lead_id}/qualify")
def qualify_lead(lead_id: int, qual_in: LeadQualificationCreate, db: Session = Depends(get_db)):
    lead = db.query(CrmLead).filter(CrmLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.stage = "QUALIFIED"
    lead.requirement_confirmed = qual_in.requirement_confirmed
    lead.budget_available = qual_in.budget_available
    lead.decision_maker_identified = qual_in.decision_maker_identified
    lead.qualification_notes = qual_in.qualification_notes or qual_in.expected_purchase_timeline

    act = CrmLeadActivity(lead_id=lead.id, activity_type="QUALIFIED", description=f"Lead qualified: Requirement confirmed={qual_in.requirement_confirmed}, Budget available={qual_in.budget_available}. Notes: {qual_in.qualification_notes or 'N/A'}")
    db.add(act)

    db.commit()

    audit = AuditLog(user_id=1, action="QUALIFY", entity_type="Lead", entity_id=lead.id, payload=f"Qualified Lead #{lead.id} ({lead.customer_name})")
    db.add(audit)
    db.commit()

    return {"message": "Lead qualified successfully", "lead_id": lead.id, "stage": "QUALIFIED"}

# --- FOLLOW-UPS ENDPOINTS ---
@router.get("/{lead_id}/followups")
def list_lead_followups(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(CrmLead).filter(CrmLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return [
        {
            "id": f.id,
            "lead_id": f.lead_id,
            "followup_date": f.followup_date,
            "followup_type": f.followup_type,
            "notes": f.notes,
            "next_action": f.next_action,
            "status": f.status,
            "created_at": f.created_at
        } for f in (lead.followups or [])
    ]

@router.post("/{lead_id}/followups")
def create_lead_followup(lead_id: int, fol_in: CrmFollowupCreate, db: Session = Depends(get_db)):
    lead = db.query(CrmLead).filter(CrmLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    fol = CrmFollowup(
        lead_id=lead.id,
        followup_date=fol_in.followup_date,
        followup_type=fol_in.followup_type or "Call",
        notes=fol_in.notes,
        next_action=fol_in.next_action,
        status=fol_in.status or "Scheduled"
    )
    db.add(fol)

    # Activity Log
    act = CrmLeadActivity(lead_id=lead.id, activity_type="FOLLOWUP_ADDED", description=f"Scheduled {fol.followup_type} follow-up for {fol.followup_date.strftime('%Y-%m-%d %H:%M')}: {fol.notes or 'N/A'}")
    db.add(act)

    db.commit()
    db.refresh(fol)

    return {"message": "Follow-up added successfully", "followup_id": fol.id}

@router.put("/followups/{followup_id}")
def update_followup(followup_id: int, fol_in: CrmFollowupCreate, db: Session = Depends(get_db)):
    fol = db.query(CrmFollowup).filter(CrmFollowup.id == followup_id).first()
    if not fol:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    fol.followup_date = fol_in.followup_date
    fol.followup_type = fol_in.followup_type or fol.followup_type
    fol.notes = fol_in.notes
    fol.next_action = fol_in.next_action
    fol.status = fol_in.status or fol.status

    db.commit()
    return {"message": "Follow-up updated successfully", "followup_id": fol.id}

# --- SITE VISITS ENDPOINTS ---
@router.get("/{lead_id}/site-visits")
def list_lead_site_visits(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(CrmLead).filter(CrmLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return [
        {
            "id": sv.id,
            "lead_id": sv.lead_id,
            "property_id": sv.property_id,
            "property_name": sv.property.name if sv.property else None,
            "visit_date": sv.visit_date,
            "assigned_executive_id": sv.assigned_executive_id,
            "assigned_executive_name": sv.assigned_executive.full_name if sv.assigned_executive else None,
            "status": sv.status,
            "notes": sv.notes,
            "customer_feedback": sv.customer_feedback,
            "interest_level": sv.interest_level,
            "next_action": sv.next_action,
            "created_at": sv.created_at
        } for sv in (lead.site_visits or [])
    ]

@router.post("/{lead_id}/site-visits")
def create_site_visit(lead_id: int, sv_in: CrmSiteVisitCreate, db: Session = Depends(get_db)):
    lead = db.query(CrmLead).filter(CrmLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    sv = CrmSiteVisit(
        lead_id=lead.id,
        property_id=sv_in.property_id,
        visit_date=sv_in.visit_date,
        assigned_executive_id=sv_in.assigned_executive_id,
        status=sv_in.status or "Scheduled",
        notes=sv_in.notes,
        customer_feedback=sv_in.customer_feedback,
        interest_level=sv_in.interest_level or "Medium",
        next_action=sv_in.next_action
    )
    db.add(sv)

    # Activity Timeline
    act = CrmLeadActivity(lead_id=lead.id, activity_type="SITE_VISIT_SCHEDULED", description=f"Site Visit scheduled for {sv.visit_date.strftime('%Y-%m-%d %H:%M')}")
    db.add(act)

    # Automatically advance stage to SITE_VISIT if current stage is NEW/CONTACTED/QUALIFIED
    if (lead.stage or "").upper() in ["NEW", "CONTACTED", "QUALIFIED"]:
        lead.stage = "SITE_VISIT"

    db.commit()
    db.refresh(sv)

    return {"message": "Site visit scheduled successfully", "site_visit_id": sv.id}

@router.put("/site-visits/{site_visit_id}")
def update_site_visit(site_visit_id: int, sv_in: CrmSiteVisitCreate, db: Session = Depends(get_db)):
    sv = db.query(CrmSiteVisit).filter(CrmSiteVisit.id == site_visit_id).first()
    if not sv:
        raise HTTPException(status_code=404, detail="Site visit not found")

    old_status = sv.status
    sv.visit_date = sv_in.visit_date
    sv.status = sv_in.status or sv.status
    sv.notes = sv_in.notes
    sv.customer_feedback = sv_in.customer_feedback
    sv.interest_level = sv_in.interest_level or sv.interest_level
    sv.next_action = sv_in.next_action

    if old_status != "Completed" and sv.status == "Completed":
        act = CrmLeadActivity(lead_id=sv.lead_id, activity_type="SITE_VISIT_COMPLETED", description=f"Site Visit completed. Feedback: {sv.customer_feedback or 'N/A'}. Interest: {sv.interest_level}")
        db.add(act)

    db.commit()
    return {"message": "Site visit updated successfully", "site_visit_id": sv.id}

@router.post("/{lead_id}/convert")
def convert_lead_to_customer(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(CrmLead).filter(CrmLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    st = (lead.stage or "").upper()

    # Duplicate Prevention: If lead already converted/linked
    if lead.customer_id:
        existing_cust = db.query(Customer).filter(Customer.id == lead.customer_id).first()
        if existing_cust:
            return {
                "message": f"This lead has already been converted to customer {existing_cust.customer_code}.",
                "already_converted": True,
                "lead_id": lead.id,
                "customer_id": existing_cust.id,
                "customer_code": existing_cust.customer_code,
                "customer_name": existing_cust.name
            }

    # Check eligibility: QUALIFIED, NEGOTIATION, BOOKING, CONVERTED
    eligible_stages = ["QUALIFIED", "NEGOTIATION", "BOOKING", "CONVERTED"]
    if st not in eligible_stages:
        raise HTTPException(
            status_code=400,
            detail=f"Lead must be Qualified before conversion. Current stage: '{st}'. Please qualify the lead first."
        )

    # Check if customer with source_lead_id exists
    existing_by_lead = db.query(Customer).filter(Customer.source_lead_id == lead.id).first()
    if existing_by_lead:
        lead.customer_id = existing_by_lead.id
        lead.stage = "CONVERTED"
        if not lead.converted_at:
            lead.converted_at = datetime.utcnow()
        db.commit()
        return {
            "message": f"This lead has already been converted to customer {existing_by_lead.customer_code}.",
            "already_converted": True,
            "lead_id": lead.id,
            "customer_id": existing_by_lead.id,
            "customer_code": existing_by_lead.customer_code,
            "customer_name": existing_by_lead.name
        }

    # Generate unique Customer Code (CUST-0001)
    total_cust_count = db.query(Customer).count()
    cust_code = f"CUST-{(total_cust_count + 1):04d}"
    while db.query(Customer).filter(Customer.customer_code == cust_code).first() is not None:
        total_cust_count += 1
        cust_code = f"CUST-{(total_cust_count + 1):04d}"

    cust = Customer(
        customer_code=cust_code,
        name=lead.company or lead.customer_name,
        contact_person=lead.customer_name,
        email=lead.email,
        phone=lead.phone,
        company=lead.company,
        customer_type=lead.lead_type or ("Corporate" if lead.company else "Individual"),
        status="active",
        source_lead_id=lead.id,
        address=lead.requirement or "Site Contact Address",
        notes=lead.qualification_notes or lead.notes
    )
    db.add(cust)
    db.flush()

    # Link Customer to Lead & Update conversion status
    lead.customer_id = cust.id
    lead.stage = "CONVERTED"
    lead.converted_at = datetime.utcnow()

    # Activity Timeline Record
    act = CrmLeadActivity(
        lead_id=lead.id,
        activity_type="CONVERTED",
        description=f"Lead converted to Customer Account {cust.customer_code} ({cust.name})"
    )
    db.add(act)

    audit = AuditLog(
        user_id=1,
        action="CONVERT",
        entity_type="Lead",
        entity_id=lead.id,
        payload=f"Converted Lead #{lead.id} ({lead.customer_name}) to Customer #{cust.id} ({cust.customer_code})"
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Lead converted to customer {cust.customer_code} successfully",
        "already_converted": False,
        "lead_id": lead.id,
        "customer_id": cust.id,
        "customer_code": cust.customer_code,
        "customer_name": cust.name
    }
