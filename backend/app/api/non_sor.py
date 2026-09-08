from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
import uuid

from app.database import get_db
from app.models import (
    NonSorRateAnalysis, Project, BoqItem, ScheduleOfRates, Document, User, AuditLog
)
from app.schemas import (
    NonSorAnalysisCreate, NonSorAnalysisUpdate, NonSorAnalysisApproval,
    NonSorAnalysisResponse, ReconcileReportItem
)
from app.api.auth import get_current_user
from app.api.estimation import is_unit_compatible, find_smart_sor_match

router = APIRouter(prefix="/api/non-sor-rate-analysis", tags=["Non-SOR Rate Analysis (PSC-06)"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

AUTHORIZED_EE_ROLES = ["admin", "executive_engineer", "ee", "project_manager", "management"]

def build_analysis_response(item: NonSorRateAnalysis, db: Session) -> NonSorAnalysisResponse:
    created_by_user = db.query(User).filter(User.id == item.created_by_id).first()
    reviewed_by_user = db.query(User).filter(User.id == item.reviewed_by_id).first() if item.reviewed_by_id else None
    
    doc = None
    if item.supporting_document_id:
        doc = db.query(Document).filter(Document.id == item.supporting_document_id).first()

    doc_path = doc.file_path if doc else item.supporting_document_path
    doc_name = doc.file_name if doc else item.supporting_document_name

    return NonSorAnalysisResponse(
        id=item.id,
        project_id=item.project_id,
        boq_item_id=item.boq_item_id,
        item_description=item.item_description,
        unit=item.unit,
        market_rate_source=item.market_rate_source,
        market_rate=float(item.market_rate),
        supporting_document_id=item.supporting_document_id,
        supporting_document_path=doc_path,
        supporting_document_name=doc_name,
        analysis_remarks=item.analysis_remarks,
        status=item.status,
        rate_type=item.rate_type or "Market Rate",
        is_reconciled=bool(item.is_reconciled),
        reconciled_sor_id=item.reconciled_sor_id,
        created_by_id=item.created_by_id,
        created_by_name=created_by_user.full_name if created_by_user else "User",
        reviewed_by_id=item.reviewed_by_id,
        reviewed_by_name=reviewed_by_user.full_name if reviewed_by_user else None,
        reviewed_at=item.reviewed_at,
        rejection_reason=item.rejection_reason,
        created_at=item.created_at,
        updated_at=item.updated_at
    )

@router.post("", response_model=NonSorAnalysisResponse)
def create_non_sor_analysis(
    req: NonSorAnalysisCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validations
    if not req.item_description or not req.item_description.strip():
        raise HTTPException(status_code=400, detail="Item Description is required.")

    valid_sources = ["Vendor Quotation", "Published Index", "Manual Entry"]
    source_clean = (req.market_rate_source or "").strip()
    if not source_clean or source_clean not in valid_sources:
        raise HTTPException(
            status_code=400,
            detail=f"Market Rate Source is required and must be one of: {valid_sources}"
        )

    if req.market_rate is None or float(req.market_rate) <= 0:
        raise HTTPException(status_code=400, detail="Market Rate must be a valid positive numeric value.")

    # Conditional Supporting Document Validation for Vendor Quotation
    if source_clean == "Vendor Quotation":
        if not req.supporting_document_id:
            raise HTTPException(
                status_code=400,
                detail="A supporting document (file upload) is required when Market Rate Source is 'Vendor Quotation'."
            )

    # SOR-First Enforcement Check (PSC-04 compliance)
    boq_item = db.query(BoqItem).filter(BoqItem.id == req.boq_item_id).first() if req.boq_item_id else None
    check_unit = boq_item.unit if boq_item else (req.unit or "m³")
    
    smart_sor = find_smart_sor_match(
        boq_name=req.item_description,
        boq_unit=check_unit,
        db=db,
        edition_id=project.sor_edition_id,
        region_id=project.sor_region_id
    )

    if smart_sor:
        raise HTTPException(
            status_code=400,
            detail=f"An applicable SOR item '{smart_sor.sor_code}' ({smart_sor.description}) already exists in the selected SOR edition/region. Non-SOR Rate Analysis is not permitted for items with existing SOR rates."
        )

    analysis = NonSorRateAnalysis(
        project_id=req.project_id,
        boq_item_id=req.boq_item_id,
        item_description=req.item_description.strip(),
        unit=req.unit or (boq_item.unit if boq_item else "Nos"),
        market_rate_source=req.market_rate_source,
        market_rate=float(req.market_rate),
        supporting_document_id=req.supporting_document_id,
        analysis_remarks=req.analysis_remarks,
        status="PENDING_EE_REVIEW",
        rate_type="Market Rate",
        is_reconciled=False,
        created_by_id=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    # Log Audit
    audit = AuditLog(
        user_id=current_user.id,
        action="CREATE_NON_SOR_ANALYSIS",
        entity_type="NonSorRateAnalysis",
        entity_id=analysis.id,
        payload=f"Created Non-SOR Rate Analysis '{analysis.item_description}' (Market Rate: Rs.{analysis.market_rate}) for Project #{analysis.project_id}"
    )
    db.add(audit)
    db.commit()

    return build_analysis_response(analysis, db)

@router.post("/upload-document")
async def upload_supporting_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Uploads a supporting document for Non-SOR rate analysis and returns the created document object."""
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    doc = Document(
        entity_type="NonSorRateAnalysis",
        entity_id=0,
        file_name=file.filename,
        file_path=file_path,
        file_size=len(contents),
        file_type=file.content_type,
        uploaded_by_id=current_user.id
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {
        "id": doc.id,
        "file_name": doc.file_name,
        "file_path": doc.file_path,
        "file_size": doc.file_size
    }

# --- SPECIFIC SUBPATH GET ENDPOINTS MUST BE DEFINED BEFORE PARAMETERIZED /{analysis_id} ---

@router.get("/project/{project_id}", response_model=List[NonSorAnalysisResponse])
def get_analyses_for_project(project_id: int, status_filter: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(NonSorRateAnalysis).filter(NonSorRateAnalysis.project_id == project_id)
    if status_filter and status_filter.upper() != 'ALL':
        query = query.filter(NonSorRateAnalysis.status == status_filter.upper())
    items = query.order_by(NonSorRateAnalysis.id.desc()).all()
    return [build_analysis_response(item, db) for item in items]

@router.get("/approved/{project_id}", response_model=List[NonSorAnalysisResponse])
def get_approved_rates_for_project(project_id: int, db: Session = Depends(get_db)):
    items = db.query(NonSorRateAnalysis).filter(
        NonSorRateAnalysis.project_id == project_id,
        NonSorRateAnalysis.status == "APPROVED"
    ).order_by(NonSorRateAnalysis.id.desc()).all()
    return [build_analysis_response(item, db) for item in items]

@router.get("/reconcile-report/{project_id}", response_model=List[ReconcileReportItem])
def get_reconcile_rates_report(project_id: int, db: Session = Depends(get_db)):
    """
    Identifies existing approved Non-SOR items that match newly added SOR items in newer SOR editions.
    Crucially flags them in the report WITHOUT automatically altering historical Non-SOR records or rates!
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    non_sor_items = db.query(NonSorRateAnalysis).filter(
        NonSorRateAnalysis.project_id == project_id
    ).order_by(NonSorRateAnalysis.id.asc()).all()

    report = []
    all_active_sors = db.query(ScheduleOfRates).filter(ScheduleOfRates.status == "Active").all()

    for item in non_sor_items:
        newer_match = None
        desc_lower = item.item_description.strip().lower()

        for sor in all_active_sors:
            s_desc = sor.description.strip().lower()
            if is_unit_compatible(item.unit or "m³", sor.unit):
                if desc_lower == s_desc or desc_lower in s_desc or s_desc in desc_lower:
                    newer_match = sor
                    break

        is_flagged = newer_match is not None
        
        # Flag record for reconciliation view without modifying historical rate
        if is_flagged and not item.is_reconciled:
            item.is_reconciled = True
            item.reconciled_sor_id = newer_match.id
            db.commit()

        edition_name = "Newer SOR Edition"
        if newer_match and newer_match.sor_edition:
            edition_name = newer_match.sor_edition.name

        report.append(
            ReconcileReportItem(
                id=item.id,
                project_id=item.project_id,
                item_description=item.item_description,
                unit=item.unit,
                market_rate=float(item.market_rate),
                market_rate_source=item.market_rate_source,
                status=item.status,
                rate_type=item.rate_type or "Market Rate",
                is_reconciled=is_flagged,
                newer_sor_id=newer_match.id if newer_match else None,
                newer_sor_code=newer_match.sor_code if newer_match else None,
                newer_sor_description=newer_match.description if newer_match else None,
                newer_sor_rate=float(newer_match.rate) if newer_match else None,
                newer_sor_edition=edition_name if newer_match else None
            )
        )

    return report

@router.get("/{analysis_id}", response_model=NonSorAnalysisResponse)
def get_analysis_by_id(analysis_id: int, db: Session = Depends(get_db)):
    item = db.query(NonSorRateAnalysis).filter(NonSorRateAnalysis.id == analysis_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Non-SOR Rate Analysis record not found")
    return build_analysis_response(item, db)

@router.put("/{analysis_id}", response_model=NonSorAnalysisResponse)
def update_non_sor_analysis(
    analysis_id: int,
    req: NonSorAnalysisUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(NonSorRateAnalysis).filter(NonSorRateAnalysis.id == analysis_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Non-SOR Rate Analysis record not found")

    if item.status == "APPROVED":
        raise HTTPException(status_code=400, detail="Approved Non-SOR rate analysis cannot be edited.")

    if req.item_description is not None:
        item.item_description = req.item_description.strip()
    if req.unit is not None:
        item.unit = req.unit
    if req.market_rate_source is not None:
        source_clean = req.market_rate_source.strip()
        valid_sources = ["Vendor Quotation", "Published Index", "Manual Entry"]
        if source_clean not in valid_sources:
            raise HTTPException(status_code=400, detail=f"Market Rate Source must be one of: {valid_sources}")
        item.market_rate_source = source_clean
    if req.market_rate is not None:
        if req.market_rate <= 0:
            raise HTTPException(status_code=400, detail="Market Rate must be > 0.")
        item.market_rate = float(req.market_rate)
    if req.supporting_document_id is not None:
        item.supporting_document_id = req.supporting_document_id
    if req.analysis_remarks is not None:
        item.analysis_remarks = req.analysis_remarks

    # Re-validate supporting document for Vendor Quotation
    if item.market_rate_source == "Vendor Quotation" and not item.supporting_document_id:
        raise HTTPException(
            status_code=400,
            detail="A supporting document (file upload) is required when Market Rate Source is 'Vendor Quotation'."
        )

    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return build_analysis_response(item, db)

@router.post("/{analysis_id}/approve", response_model=NonSorAnalysisResponse)
def approve_non_sor_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Strict Backend Role Authorization Enforcement
    user_role = (current_user.role or "").lower().strip()
    if user_role not in AUTHORIZED_EE_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Only authorized Executive Engineer (EE) or Management roles can approve Non-SOR Rate Analysis."
        )

    item = db.query(NonSorRateAnalysis).filter(NonSorRateAnalysis.id == analysis_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Non-SOR Rate Analysis record not found")

    item.status = "APPROVED"
    item.reviewed_by_id = current_user.id
    item.reviewed_at = datetime.utcnow()
    item.updated_at = datetime.utcnow()
    db.commit()

    # Log Audit
    audit = AuditLog(
        user_id=current_user.id,
        action="APPROVE_NON_SOR_ANALYSIS",
        entity_type="NonSorRateAnalysis",
        entity_id=item.id,
        payload=f"EE Approved Non-SOR Market Rate Rs.{item.market_rate} for '{item.item_description}'"
    )
    db.add(audit)
    db.commit()

    return build_analysis_response(item, db)

@router.post("/{analysis_id}/reject", response_model=NonSorAnalysisResponse)
def reject_non_sor_analysis(
    analysis_id: int,
    approval_req: Optional[NonSorAnalysisApproval] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_role = (current_user.role or "").lower().strip()
    if user_role not in AUTHORIZED_EE_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Only authorized Executive Engineer (EE) or Management roles can reject Non-SOR Rate Analysis."
        )

    item = db.query(NonSorRateAnalysis).filter(NonSorRateAnalysis.id == analysis_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Non-SOR Rate Analysis record not found")

    reason = (approval_req.rejection_reason if approval_req else None) or "Rejected by Executive Engineer review."
    item.status = "REJECTED"
    item.rejection_reason = reason
    item.reviewed_by_id = current_user.id
    item.reviewed_at = datetime.utcnow()
    item.updated_at = datetime.utcnow()
    db.commit()

    audit = AuditLog(
        user_id=current_user.id,
        action="REJECT_NON_SOR_ANALYSIS",
        entity_type="NonSorRateAnalysis",
        entity_id=item.id,
        payload=f"EE Rejected Non-SOR Rate Analysis '{item.item_description}'. Reason: {item.rejection_reason}"
    )
    db.add(audit)
    db.commit()

    return build_analysis_response(item, db)
