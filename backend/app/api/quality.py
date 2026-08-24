from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from app.database import get_db
from app.models import QualityInspection, QualityNcr, AuditLog, Notification
from app.schemas import (
    QualityInspectionCreate, QualityInspectionResponse,
    QualityNcrCreate, QualityNcrResponse
)

router = APIRouter(prefix="/api/quality", tags=["Quality Control & NCR Engine"])

# Inspections API
@router.get("/inspections", response_model=List[QualityInspectionResponse])
def list_inspections(db: Session = Depends(get_db)):
    return db.query(QualityInspection).order_by(QualityInspection.created_at.desc()).all()

@router.post("/inspections", response_model=QualityInspectionResponse)
def create_inspection(insp_in: QualityInspectionCreate, inspector_id: int = 1, db: Session = Depends(get_db)):
    code = f"QC-{uuid.uuid4().hex[:8].upper()}"
    inspection = QualityInspection(
        inspection_code=code,
        project_id=insp_in.project_id,
        task_id=insp_in.task_id,
        inspector_id=inspector_id,
        inspection_type=insp_in.inspection_type,
        result=insp_in.result or "passed",
        remarks=insp_in.remarks
    )
    db.add(inspection)
    db.flush()

    # If Inspection Fails -> Automatically trigger Quality NCR
    if insp_in.result == "failed":
        ncr_code = f"NCR-{uuid.uuid4().hex[:8].upper()}"
        ncr = QualityNcr(
            ncr_code=ncr_code,
            project_id=insp_in.project_id,
            inspection_id=inspection.id,
            inspector_id=inspector_id,
            description=f"Inspection Failure: {insp_in.inspection_type}. Remarks: {insp_in.remarks or 'Non-conforming work'}",
            severity="major",
            required_action="Stop work on affected section, issue rework notice, and submit CAPA for re-inspection.",
            status="open"
        )
        db.add(ncr)

        notif = Notification(
            user_id=1,
            title=f"QUALITY NCR TRIGGERED #{ncr_code}",
            message=f"QC Inspection '{insp_in.inspection_type}' FAILED. Non-Conformance Report issued.",
            notification_type="alert",
            entity_type="QualityNcr",
            entity_id=ncr.id
        )
        db.add(notif)

    audit = AuditLog(user_id=inspector_id, action="CREATE", entity_type="QualityInspection", entity_id=inspection.id, payload=f"QC Inspection {code} Result: {insp_in.result.upper()}")
    db.add(audit)

    db.commit()
    db.refresh(inspection)
    return inspection

# NCR API
@router.get("/ncrs", response_model=List[QualityNcrResponse])
def list_ncrs(db: Session = Depends(get_db)):
    return db.query(QualityNcr).order_by(QualityNcr.created_at.desc()).all()

@router.put("/ncrs/{ncr_id}/status")
def update_ncr_status(ncr_id: int, new_status: str, db: Session = Depends(get_db)):
    ncr = db.query(QualityNcr).filter(QualityNcr.id == ncr_id).first()
    if not ncr:
        raise HTTPException(status_code=404, detail="NCR not found")

    old = ncr.status
    ncr.status = new_status
    db.commit()

    audit = AuditLog(user_id=1, action="UPDATE", entity_type="QualityNcr", entity_id=ncr.id, payload=f"NCR status updated from '{old}' to '{new_status}'")
    db.add(audit)
    db.commit()

    return {"message": "NCR status updated", "ncr_id": ncr.id, "status": new_status}
