from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import (
    ProjectEstimate, ProjectEstimateLine, BoqItem, ScheduleOfRates, 
    Project, AuditLog, TechnicalSanction
)
from app.schemas import (
    ProjectEstimateResponse, EstimateSaveRequest, 
    EstimateLineResponse, CategoryEstimateSummary
)

router = APIRouter(prefix="/api/estimation", tags=["Project Cost Estimation"])

def generate_estimate_number(project_id: int, db: Session, revision: int = 0) -> str:
    year = datetime.utcnow().year
    count = db.query(ProjectEstimate).count() + 1
    base_num = f"EST-{year}-{count:03d}"
    if revision > 0:
        return f"{base_num}-R{revision}"
    return base_num

def is_unit_compatible(unit1: str, unit2: str) -> bool:
    if not unit1 or not unit2:
        return False
    u1 = unit1.strip().lower()
    u2 = unit2.strip().lower()
    
    # Normalize common representations
    aliases = {
        'cum': 'm³', 'cu.m': 'm³', 'm3': 'm³', 'cubic meter': 'm³', 'cubic metre': 'm³',
        'sqm': 'm²', 'sq.m': 'm2', 'm2': 'm²', 'square meter': 'm²', 'square metre': 'm²',
        'rm': 'm', 'meter': 'm', 'metre': 'm',
        'mt': 'tonnes', 'tonne': 'tonnes', 'tons': 'tonnes', 'ton': 'tonnes',
        'nos': 'nos', 'number': 'nos', 'numbers': 'nos', 'each': 'nos',
        'ls': 'lumpsum', 'lump sum': 'lumpsum', 'bags': 'bags', 'bag': 'bags'
    }
    
    norm1 = aliases.get(u1, u1)
    norm2 = aliases.get(u2, u2)
    return norm1 == norm2

def validate_quantity(qty: float) -> None:
    if qty is None or qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0.")
    # Check max 3 decimals
    qty_val = float(qty)
    if round(qty_val, 3) != qty_val:
        raise HTTPException(status_code=400, detail=f"Quantity {qty_val} exceeds maximum of 3 decimal places.")

def find_smart_sor_match(boq_name: str, boq_unit: str, db: Session, edition_id: Optional[int] = None, region_id: Optional[int] = None) -> Optional[ScheduleOfRates]:
    if not boq_name or not boq_unit:
        return None
    
    query = db.query(ScheduleOfRates).filter(ScheduleOfRates.status == "Active")
    if edition_id:
        query = query.filter(ScheduleOfRates.sor_edition_id == edition_id)
    if region_id:
        query = query.filter(ScheduleOfRates.sor_region_id == region_id)

    active_sors = query.all()
    b_name = boq_name.strip().lower()
    
    for sor in active_sors:
        s_desc = sor.description.strip().lower()
        
        # Must be unit compatible first!
        if not is_unit_compatible(boq_unit, sor.unit):
            continue
            
        # Exact match
        if b_name == s_desc or s_desc in b_name or b_name in s_desc:
            return sor
            
        # Key construction term matching
        terms = ["excavation", "pcc", "rcc", "reinforcement", "masonry", "plaster", "fabrication", "flooring"]
        for term in terms:
            if term in b_name and term in s_desc:
                return sor
                
    return None

def build_estimate_response(estimate: ProjectEstimate, db: Session) -> ProjectEstimateResponse:
    project = db.query(Project).filter(Project.id == estimate.project_id).first()
    project_name = project.name if project else "Unknown Project"

    line_responses = []
    category_totals = {}
    valid_mapped_count = 0
    has_unit_mismatch = False

    lines = db.query(ProjectEstimateLine).filter(
        ProjectEstimateLine.estimate_id == estimate.id
    ).all()

    for line in lines:
        boq = db.query(BoqItem).filter(BoqItem.id == line.boq_item_id).first()
        if not boq:
            continue

        sor = None
        if line.sor_item_id:
            sor = db.query(ScheduleOfRates).filter(ScheduleOfRates.id == line.sor_item_id).first()

        boq_unit = boq.unit
        sor_unit = sor.unit if sor else None
        unit_compatible = is_unit_compatible(boq_unit, sor_unit) if sor else True
        edition_compatible = True

        if sor and project and project.sor_edition_id and sor.sor_edition_id:
            if sor.sor_edition_id != project.sor_edition_id:
                edition_compatible = False

        if sor and project and project.sor_region_id and sor.sor_region_id:
            if sor.sor_region_id != project.sor_region_id:
                edition_compatible = False

        compatible = unit_compatible and edition_compatible

        if sor and not unit_compatible:
            has_unit_mismatch = True

        qty = float(line.quantity or boq.approved_qty or 0.0)
        boq_rate = float(boq.rate or 0.0)
        boq_amount = float(boq.total_amount or round(qty * boq_rate, 2))
        sor_rate_val = float(sor.adjusted_rate) if sor else None

        rate_src = line.rate_source or "SOR"
        is_override = bool(line.is_manual_override)
        manual_rate_val = float(line.manual_rate) if line.manual_rate is not None else None

        if rate_src == "NON_SOR" or is_override:
            effective_rate = manual_rate_val if manual_rate_val is not None else (float(line.sor_rate_snapshot) if line.sor_rate_snapshot is not None else boq_rate)
            compatible_for_line = True
            is_valid_mapping = True if (effective_rate is not None and effective_rate >= 0 and qty > 0) else False
        else:
            effective_rate = float(line.sor_rate_snapshot) if (line.sor_rate_snapshot is not None and compatible) else (sor_rate_val if (sor and compatible) else boq_rate)
            compatible_for_line = compatible
            is_valid_mapping = True if (sor and compatible and effective_rate is not None and effective_rate >= 0 and qty > 0) else False

        if is_valid_mapping:
            valid_mapped_count += 1

        est_amount = round(qty * effective_rate, 2) if (effective_rate is not None and effective_rate >= 0 and is_valid_mapping) else (round(qty * effective_rate, 2) if (effective_rate is not None and effective_rate >= 0) else boq_amount)

        category = sor.category if (sor and compatible) else (boq.phase.title if boq.phase else "General")

        if est_amount is not None and est_amount >= 0 and is_valid_mapping:
            if category not in category_totals:
                category_totals[category] = {"amount": 0.0, "count": 0}
            category_totals[category]["amount"] += est_amount
            category_totals[category]["count"] += 1

        line_responses.append(
            EstimateLineResponse(
                id=line.id,
                estimate_id=estimate.id,
                boq_item_id=boq.id,
                sor_item_id=sor.id if sor else None,
                rate_source=rate_src,
                quantity=qty,
                manual_rate=manual_rate_val,
                is_manual_override=is_override,
                justification_note=line.justification_note,
                sor_rate_snapshot=line.sor_rate_snapshot,
                effective_rate=effective_rate,
                estimated_amount=est_amount,
                boq_item_name=boq.item_name,
                boq_unit=boq.unit,
                boq_category=boq.phase.title if boq.phase else "General",
                boq_rate=boq_rate,
                boq_amount=boq_amount,
                sor_code=sor.sor_code if sor else None,
                sor_description=sor.description if sor else None,
                sor_unit=sor.unit if sor else None,
                sor_rate=float(sor.rate) if (sor and compatible) else None,
                is_unit_compatible=compatible_for_line
            )
        )

    total_boq_items = len(lines)
    unmapped_count = total_boq_items - valid_mapped_count
    
    # Detailed Estimate Calculation
    base_amount = sum(l.estimated_amount for l in line_responses if l.estimated_amount is not None and l.is_unit_compatible)
    contingency_pct = float(estimate.contingency_percent if estimate.contingency_percent is not None else 5.0)
    contingency_amt = round(base_amount * (contingency_pct / 100.0), 2)
    
    dept_charges_pct = float(estimate.departmental_charges_percent if estimate.departmental_charges_percent is not None else 2.0)
    dept_charges_amt = round(base_amount * (dept_charges_pct / 100.0), 2)
    
    calculated_total = round(base_amount + contingency_amt + dept_charges_amt, 2)

    # Contingency bounds check (3.0% - 5.0%)
    if contingency_pct < 3.0 or contingency_pct > 5.0:
        is_ee_review = True
        ee_reason = f"Contingency ({contingency_pct:.2f}%) is outside the configured tenant range (3.0% - 5.0%) and requires EE review."
    else:
        is_ee_review = False
        ee_reason = None

    # Status Calculation: Must have ALL items VALIDLY mapped with compatible units to be READY_FOR_REVIEW
    if estimate.is_ts_locked or estimate.ts_status == "APPROVED":
        new_status = "APPROVED"
    elif total_boq_items == 0 or valid_mapped_count == 0:
        new_status = "DRAFT"
    elif valid_mapped_count < total_boq_items or has_unit_mismatch:
        new_status = "PARTIALLY_MAPPED"
    else:
        new_status = estimate.status if estimate.status in ["SUBMITTED", "APPROVED"] else "READY_FOR_REVIEW"

    # Persist authoritative backend calculations
    estimate.status = new_status
    estimate.base_amount = base_amount
    estimate.contingency_percent = contingency_pct
    estimate.contingency_amount = contingency_amt
    estimate.departmental_charges_percent = dept_charges_pct
    estimate.departmental_charges_amount = dept_charges_amt
    estimate.total_amount = calculated_total
    estimate.is_ee_review_required = is_ee_review
    estimate.ee_review_reason = ee_reason
    estimate.updated_at = datetime.utcnow()
    db.commit()

    cat_summaries = [
        CategoryEstimateSummary(category=cat, total_amount=round(data["amount"], 2), item_count=data["count"])
        for cat, data in category_totals.items()
    ]

    return ProjectEstimateResponse(
        id=estimate.id,
        estimate_number=estimate.estimate_number,
        project_id=estimate.project_id,
        project_name=project_name,
        status=estimate.status,
        base_amount=base_amount,
        contingency_percent=contingency_pct,
        contingency_amount=contingency_amt,
        departmental_charges_percent=dept_charges_pct,
        departmental_charges_amount=dept_charges_amt,
        total_amount=calculated_total,
        is_ee_review_required=is_ee_review,
        ee_review_reason=ee_reason,
        ts_status=estimate.ts_status or "PENDING",
        is_ts_locked=bool(estimate.is_ts_locked),
        revision_number=estimate.revision_number or 0,
        original_estimate_id=estimate.original_estimate_id,
        is_revised=bool(estimate.is_revised),
        total_boq_items=total_boq_items,
        mapped_count=valid_mapped_count,
        unmapped_count=unmapped_count,
        created_at=estimate.created_at,
        updated_at=estimate.updated_at,
        lines=line_responses,
        category_summaries=cat_summaries
    )

@router.get("/project/{project_id}", response_model=ProjectEstimateResponse)
def get_or_create_estimate_for_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    boq_items = db.query(BoqItem).filter(BoqItem.project_id == project_id).order_by(BoqItem.id.asc()).all()

    # Get latest active (unlocked or latest revision) estimate for project
    estimate = db.query(ProjectEstimate).filter(
        ProjectEstimate.project_id == project_id
    ).order_by(ProjectEstimate.revision_number.desc(), ProjectEstimate.id.desc()).first()

    if not estimate:
        est_number = generate_estimate_number(project_id, db)
        estimate = ProjectEstimate(
            estimate_number=est_number,
            project_id=project_id,
            status="DRAFT",
            base_amount=0.00,
            contingency_percent=5.00,
            contingency_amount=0.00,
            departmental_charges_percent=2.00,
            departmental_charges_amount=0.00,
            total_amount=0.00,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(estimate)
        db.commit()
        db.refresh(estimate)

    # Sync BOQ items with estimate lines if estimate is not locked
    if not estimate.is_ts_locked:
        existing_lines = {l.boq_item_id: l for l in db.query(ProjectEstimateLine).filter(ProjectEstimateLine.estimate_id == estimate.id).all()}
        
        for boq in boq_items:
            if boq.id not in existing_lines:
                # Try smart matching
                smart_sor = find_smart_sor_match(boq.item_name, boq.unit, db)
                sor_id = smart_sor.id if smart_sor else None
                sor_rate = float(smart_sor.rate) if smart_sor else None
                est_amount = round(float(boq.approved_qty) * sor_rate, 2) if sor_rate is not None else None

                if smart_sor:
                    boq.sor_id = smart_sor.id

                line = ProjectEstimateLine(
                    estimate_id=estimate.id,
                    boq_item_id=boq.id,
                    sor_item_id=sor_id,
                    rate_source="SOR" if sor_id else "NON_SOR",
                    quantity=float(boq.approved_qty),
                    sor_rate_snapshot=sor_rate,
                    estimated_amount=est_amount,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(line)

        db.commit()
    return build_estimate_response(estimate, db)

@router.post("/save", response_model=ProjectEstimateResponse)
def save_estimate(req: EstimateSaveRequest, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    estimate = db.query(ProjectEstimate).filter(
        ProjectEstimate.project_id == req.project_id
    ).order_by(ProjectEstimate.revision_number.desc(), ProjectEstimate.id.desc()).first()

    if not estimate:
        est_number = generate_estimate_number(req.project_id, db)
        estimate = ProjectEstimate(
            estimate_number=est_number,
            project_id=req.project_id,
            status="DRAFT",
            base_amount=0.00,
            contingency_percent=5.00,
            contingency_amount=0.00,
            departmental_charges_percent=2.00,
            departmental_charges_amount=0.00,
            total_amount=0.00,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(estimate)
        db.commit()
        db.refresh(estimate)

    # Locking Check
    if estimate.is_ts_locked or estimate.ts_status == "APPROVED":
        raise HTTPException(status_code=400, detail="Technical Sanction Approved — Detailed Estimate is locked.")

    # Update contingency and departmental charge percentages if supplied
    if req.contingency_percent is not None:
        estimate.contingency_percent = float(req.contingency_percent)
    if req.departmental_charges_percent is not None:
        estimate.departmental_charges_percent = float(req.departmental_charges_percent)

    for line_in in req.lines:
        boq = db.query(BoqItem).filter(BoqItem.id == line_in.boq_item_id).first()
        if not boq:
            continue

        # Validate quantity (>0, max 3 decimal places)
        validate_quantity(line_in.quantity)
        qty = float(line_in.quantity)

        rate_src = line_in.rate_source or "SOR"
        is_override = bool(line_in.is_manual_override)
        manual_rate_val = float(line_in.manual_rate) if line_in.manual_rate is not None else None
        just_note = line_in.justification_note.strip() if line_in.justification_note else None

        sor_item = None
        if line_in.sor_item_id:
            sor_item = db.query(ScheduleOfRates).filter(ScheduleOfRates.id == line_in.sor_item_id).first()

        compatible = is_unit_compatible(boq.unit, sor_item.unit) if sor_item else True
        sor_rate_val = float(sor_item.adjusted_rate) if (sor_item and compatible) else None

        # Check manual override condition for SOR item
        if rate_src == "SOR" and sor_rate_val is not None and manual_rate_val is not None:
            if round(manual_rate_val, 2) != round(sor_rate_val, 2):
                is_override = True
                rate_src = "MANUAL_OVERRIDE"

        if is_override or rate_src == "MANUAL_OVERRIDE":
            is_override = True
            if not just_note:
                raise HTTPException(
                    status_code=400,
                    detail=f"Manual rate override for BOQ item '{boq.item_name}' requires a justification note."
                )
            effective_rate = manual_rate_val if manual_rate_val is not None else sor_rate_val
        elif rate_src == "NON_SOR":
            if manual_rate_val is None or manual_rate_val < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Non-SOR item '{boq.item_name}' requires a valid non-negative rate."
                )
            effective_rate = manual_rate_val
        else:
            effective_rate = sor_rate_val

        est_amount = round(qty * effective_rate, 2) if (effective_rate is not None and effective_rate >= 0) else None

        # Update BOQ item sor_id reference if valid SOR
        if compatible and sor_item and rate_src == "SOR":
            boq.sor_id = line_in.sor_item_id
        elif rate_src == "NON_SOR":
            boq.sor_id = None

        line = db.query(ProjectEstimateLine).filter(
            ProjectEstimateLine.estimate_id == estimate.id,
            ProjectEstimateLine.boq_item_id == line_in.boq_item_id
        ).first()

        if line:
            line.sor_item_id = line_in.sor_item_id if rate_src == "SOR" else None
            line.rate_source = rate_src
            line.quantity = qty
            line.manual_rate = manual_rate_val
            line.is_manual_override = is_override
            line.justification_note = just_note
            line.sor_rate_snapshot = sor_rate_val if rate_src == "SOR" else manual_rate_val
            line.estimated_amount = est_amount
            line.updated_at = datetime.utcnow()
        else:
            line = ProjectEstimateLine(
                estimate_id=estimate.id,
                boq_item_id=line_in.boq_item_id,
                sor_item_id=line_in.sor_item_id if rate_src == "SOR" else None,
                rate_source=rate_src,
                quantity=qty,
                manual_rate=manual_rate_val,
                is_manual_override=is_override,
                justification_note=just_note,
                sor_rate_snapshot=sor_rate_val if rate_src == "SOR" else manual_rate_val,
                estimated_amount=est_amount,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(line)

    db.commit()

    # Re-calculate estimate response to finalize totals
    resp = build_estimate_response(estimate, db)

    # Check if there is a pending Technical Sanction that needs invalidation due to changes (Requirement 11)
    pending_ts = db.query(TechnicalSanction).filter(
        TechnicalSanction.detailed_estimate_id == estimate.id,
        TechnicalSanction.status == "PENDING_APPROVAL"
    ).first()

    if pending_ts:
        old_total = round(float(pending_ts.estimate_total_at_submission or 0.0), 2)
        new_total = round(float(estimate.total_amount or 0.0), 2)
        if old_total != new_total:
            pending_ts.status = "INVALIDATED"
            pending_ts.updated_at = datetime.utcnow()
            estimate.ts_status = "INVALIDATED"
            
            audit_inv = AuditLog(
                user_id=1,
                action="INVALIDATE_TECHNICAL_SANCTION",
                entity_type="TechnicalSanction",
                entity_id=pending_ts.id,
                payload=f"Technical Sanction #{pending_ts.id} INVALIDATED because estimate total changed from ₹{old_total} to ₹{new_total} during editing."
            )
            db.add(audit_inv)
            db.commit()
            resp = build_estimate_response(estimate, db)

    # Audit log
    audit = AuditLog(
        user_id=1,
        action="SAVE_ESTIMATE",
        entity_type="ProjectEstimate",
        entity_id=estimate.id,
        payload=f"Saved estimate {estimate.estimate_number} for Project #{project.id}"
    )
    db.add(audit)
    db.commit()

    return resp

@router.post("/submit-review/{estimate_id}", response_model=ProjectEstimateResponse)
def submit_estimate_for_review(estimate_id: int, db: Session = Depends(get_db)):
    estimate = db.query(ProjectEstimate).filter(ProjectEstimate.id == estimate_id).first()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    if estimate.is_ts_locked or estimate.ts_status == "APPROVED":
        raise HTTPException(status_code=400, detail="Technical Sanction Approved — Detailed Estimate is locked.")

    lines = db.query(ProjectEstimateLine).filter(ProjectEstimateLine.estimate_id == estimate.id).all()
    if not lines or len(lines) == 0:
        raise HTTPException(status_code=400, detail="Add at least one item")

    invalid_reasons = []

    for l in lines:
        boq = db.query(BoqItem).filter(BoqItem.id == l.boq_item_id).first()
        if not boq:
            continue
        
        # Quantity validation
        if not l.quantity or float(l.quantity) <= 0:
            invalid_reasons.append(f"BOQ Item '{boq.item_name}' has an invalid quantity ({l.quantity}).")
            continue

        rate_src = l.rate_source or "SOR"

        if rate_src == "SOR":
            sor = db.query(ScheduleOfRates).filter(ScheduleOfRates.id == l.sor_item_id).first() if l.sor_item_id else None
            if not l.sor_item_id or not sor:
                invalid_reasons.append(f"BOQ Item '{boq.item_name}' is not mapped to any SOR item.")
            elif not is_unit_compatible(boq.unit, sor.unit):
                invalid_reasons.append(f"Unit mismatch: BOQ '{boq.item_name}' ({boq.unit}) vs SOR '{sor.sor_code}' ({sor.unit}).")
            elif l.is_manual_override and (not l.justification_note or not l.justification_note.strip()):
                invalid_reasons.append(f"BOQ Item '{boq.item_name}' has a manual rate override without justification note.")
            elif (l.manual_rate or sor.rate or 0) <= 0:
                invalid_reasons.append(f"SOR Item '{sor.sor_code}' has an invalid rate.")
        elif rate_src == "NON_SOR" or l.is_manual_override:
            if (l.manual_rate is None or l.manual_rate <= 0):
                invalid_reasons.append(f"Item '{boq.item_name}' has an invalid rate.")
            elif l.is_manual_override and (not l.justification_note or not l.justification_note.strip()):
                invalid_reasons.append(f"Item '{boq.item_name}' manual rate override requires a justification note.")

    if invalid_reasons:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit for review. {len(invalid_reasons)} error(s) found. Example: {invalid_reasons[0]}"
        )

    estimate.status = "READY_FOR_REVIEW"
    estimate.updated_at = datetime.utcnow()
    db.commit()

    audit = AuditLog(
        user_id=1,
        action="SUBMIT_ESTIMATE_REVIEW",
        entity_type="ProjectEstimate",
        entity_id=estimate.id,
        payload=f"Submitted estimate {estimate.estimate_number} for review."
    )
    db.add(audit)
    db.commit()

    return build_estimate_response(estimate, db)

@router.post("/approve-ts/{estimate_id}", response_model=ProjectEstimateResponse)
def approve_technical_sanction(estimate_id: int, db: Session = Depends(get_db)):
    estimate = db.query(ProjectEstimate).filter(ProjectEstimate.id == estimate_id).first()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    lines = db.query(ProjectEstimateLine).filter(ProjectEstimateLine.estimate_id == estimate.id).all()
    if not lines or len(lines) == 0:
        raise HTTPException(status_code=400, detail="Add at least one item")

    estimate.ts_status = "APPROVED"
    estimate.status = "APPROVED"
    estimate.is_ts_locked = True
    estimate.updated_at = datetime.utcnow()
    db.commit()

    audit = AuditLog(
        user_id=1,
        action="APPROVE_TECHNICAL_SANCTION",
        entity_type="ProjectEstimate",
        entity_id=estimate.id,
        payload=f"Technical Sanction Approved for estimate {estimate.estimate_number}"
    )
    db.add(audit)
    db.commit()

    return build_estimate_response(estimate, db)

@router.post("/create-revised-de/{estimate_id}", response_model=ProjectEstimateResponse)
def create_revised_estimate(estimate_id: int, db: Session = Depends(get_db)):
    orig_estimate = db.query(ProjectEstimate).filter(ProjectEstimate.id == estimate_id).first()
    if not orig_estimate:
        raise HTTPException(status_code=404, detail="Original estimate not found")

    if not (orig_estimate.is_ts_locked or orig_estimate.ts_status == "APPROVED"):
        raise HTTPException(status_code=400, detail="Only Approved estimates with Technical Sanction can be revised.")

    new_rev_num = (orig_estimate.revision_number or 0) + 1
    orig_root_id = orig_estimate.original_estimate_id or orig_estimate.id

    # Create new estimate revision
    rev_estimate_number = f"{orig_estimate.estimate_number.split('-R')[0]}-R{new_rev_num}"
    
    rev_estimate = ProjectEstimate(
        estimate_number=rev_estimate_number,
        project_id=orig_estimate.project_id,
        status="DRAFT",
        base_amount=orig_estimate.base_amount,
        contingency_percent=orig_estimate.contingency_percent,
        contingency_amount=orig_estimate.contingency_amount,
        departmental_charges_percent=orig_estimate.departmental_charges_percent,
        departmental_charges_amount=orig_estimate.departmental_charges_amount,
        total_amount=orig_estimate.total_amount,
        is_ee_review_required=orig_estimate.is_ee_review_required,
        ee_review_reason=orig_estimate.ee_review_reason,
        ts_status="PENDING",
        is_ts_locked=False,
        revision_number=new_rev_num,
        original_estimate_id=orig_root_id,
        is_revised=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(rev_estimate)
    db.commit()
    db.refresh(rev_estimate)

    # Clone estimate lines
    orig_lines = db.query(ProjectEstimateLine).filter(ProjectEstimateLine.estimate_id == orig_estimate.id).all()
    for ol in orig_lines:
        nl = ProjectEstimateLine(
            estimate_id=rev_estimate.id,
            boq_item_id=ol.boq_item_id,
            sor_item_id=ol.sor_item_id,
            rate_source=ol.rate_source,
            quantity=ol.quantity,
            manual_rate=ol.manual_rate,
            is_manual_override=ol.is_manual_override,
            justification_note=ol.justification_note,
            sor_rate_snapshot=ol.sor_rate_snapshot,
            estimated_amount=ol.estimated_amount,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(nl)

    db.commit()

    audit = AuditLog(
        user_id=1,
        action="CREATE_REVISED_DE",
        entity_type="ProjectEstimate",
        entity_id=rev_estimate.id,
        payload=f"Created Revised DE {rev_estimate.estimate_number} from approved estimate {orig_estimate.estimate_number}"
    )
    db.add(audit)
    db.commit()

    return build_estimate_response(rev_estimate, db)

@router.get("/list", response_model=List[ProjectEstimateResponse])
def list_all_estimates(db: Session = Depends(get_db)):
    estimates = db.query(ProjectEstimate).order_by(ProjectEstimate.id.desc()).all()
    return [build_estimate_response(est, db) for est in estimates]
