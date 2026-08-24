from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from app.database import get_db
from app.models import Building, Property, AuditLog
from app.schemas import BuildingCreate, BuildingResponse

router = APIRouter(prefix="/api/buildings", tags=["Real Estate Building Master"])

@router.get("/", response_model=List[BuildingResponse])
def list_buildings(property_id: Optional[int] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Building)
    if property_id:
        query = query.filter(Building.property_id == property_id)
    if status:
        query = query.filter(Building.status == status)
    return query.order_by(Building.created_at.desc()).all()

@router.get("/{building_id}", response_model=BuildingResponse)
def get_building_by_id(building_id: int, db: Session = Depends(get_db)):
    bld = db.query(Building).filter(Building.id == building_id).first()
    if not bld:
        raise HTTPException(status_code=404, detail="Building not found")
    return bld

@router.post("/", response_model=BuildingResponse)
def create_building(bld_in: BuildingCreate, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == bld_in.property_id).first()
    if not prop:
        raise HTTPException(status_code=400, detail=f"Cannot create Building without a valid parent Property #{bld_in.property_id}")

    code = bld_in.code or f"BLD-{uuid.uuid4().hex[:6].upper()}"

    bld_dict = bld_in.model_dump()
    bld_dict["code"] = code

    bld = Building(**bld_dict)
    db.add(bld)

    # Increment total buildings on Property
    prop.total_buildings += 1
    db.commit()
    db.refresh(bld)

    audit = AuditLog(user_id=1, action="CREATE", entity_type="Building", entity_id=bld.id, payload=f"Created Building '{bld.name}' under Property '{prop.name}'")
    db.add(audit)
    db.commit()

    return bld

@router.put("/{building_id}", response_model=BuildingResponse)
def update_building(building_id: int, bld_in: BuildingCreate, db: Session = Depends(get_db)):
    bld = db.query(Building).filter(Building.id == building_id).first()
    if not bld:
        raise HTTPException(status_code=404, detail="Building not found")

    prop = db.query(Property).filter(Property.id == bld_in.property_id).first()
    if not prop:
        raise HTTPException(status_code=400, detail=f"Cannot assign Building to invalid Property #{bld_in.property_id}")

    for field, val in bld_in.model_dump(exclude_unset=True).items():
        setattr(bld, field, val)

    db.commit()
    db.refresh(bld)

    audit = AuditLog(user_id=1, action="UPDATE", entity_type="Building", entity_id=bld.id, payload=f"Updated Building #{bld.id}: {bld.name}")
    db.add(audit)
    db.commit()

    return bld
