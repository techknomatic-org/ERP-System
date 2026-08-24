from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Vendor, AuditLog
from app.schemas import VendorCreate, VendorResponse

router = APIRouter(prefix="/api/vendors", tags=["Vendor Directory & Compliance"])

@router.get("/", response_model=List[VendorResponse])
def list_vendors(db: Session = Depends(get_db)):
    return db.query(Vendor).all()

@router.post("/", response_model=VendorResponse)
def create_vendor(vendor_in: VendorCreate, db: Session = Depends(get_db)):
    existing = db.query(Vendor).filter(Vendor.code == vendor_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vendor with this Code already exists")

    vendor = Vendor(**vendor_in.model_dump())
    db.add(vendor)
    db.commit()
    db.refresh(vendor)

    # Log Audit
    audit = AuditLog(user_id=1, action="CREATE", entity_type="Vendor", entity_id=vendor.id, payload=f"Registered Vendor: {vendor.name} (GST: {vendor.gst_number})")
    db.add(audit)
    db.commit()

    return vendor
