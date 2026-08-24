from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from app.database import get_db
from app.models import Property, Building, Unit, AuditLog, Project
from app.schemas import (
    PropertyCreate, PropertyResponse, 
    BuildingCreate, BuildingResponse, 
    UnitCreate, UnitResponse
)

router = APIRouter(prefix="/api/properties", tags=["Real Estate Property Master"])

# Properties API
@router.get("/", response_model=List[PropertyResponse])
def list_properties(project_id: Optional[int] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Property)
    if project_id:
        query = query.filter(Property.project_id == project_id)
    if status:
        query = query.filter(Property.status == status)
    return query.order_by(Property.created_at.desc()).all()

@router.get("/{property_id}", response_model=PropertyResponse)
def get_property_by_id(property_id: int, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop

@router.post("/", response_model=PropertyResponse)
def create_property(prop_in: PropertyCreate, db: Session = Depends(get_db)):
    if prop_in.project_id:
        project = db.query(Project).filter(Project.id == prop_in.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail=f"Construction Project #{prop_in.project_id} not found")

    code = prop_in.code or f"PROP-{uuid.uuid4().hex[:6].upper()}"
    existing = db.query(Property).filter(Property.code == code).first()
    if existing:
        code = f"PROP-{uuid.uuid4().hex[:6].upper()}"

    prop_dict = prop_in.model_dump()
    prop_dict["code"] = code

    prop = Property(**prop_dict)
    db.add(prop)
    db.commit()
    db.refresh(prop)

    # Log Audit
    audit = AuditLog(user_id=1, action="CREATE", entity_type="Property", entity_id=prop.id, payload=f"Created Property: {prop.name} ({prop.property_type}) linked to Project #{prop.project_id}")
    db.add(audit)
    db.commit()

    return prop

@router.put("/{property_id}", response_model=PropertyResponse)
def update_property(property_id: int, prop_in: PropertyCreate, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    if prop_in.project_id:
        project = db.query(Project).filter(Project.id == prop_in.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail=f"Construction Project #{prop_in.project_id} not found")

    for field, val in prop_in.model_dump(exclude_unset=True).items():
        setattr(prop, field, val)

    db.commit()
    db.refresh(prop)

    audit = AuditLog(user_id=1, action="UPDATE", entity_type="Property", entity_id=prop.id, payload=f"Updated Property #{prop.id}: {prop.name}")
    db.add(audit)
    db.commit()

    return prop

# Buildings API (Compatible with /api/properties/buildings)
@router.post("/buildings", response_model=BuildingResponse)
def create_building_under_property(bld_in: BuildingCreate, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == bld_in.property_id).first()
    if not prop:
        raise HTTPException(status_code=400, detail=f"Cannot create Building without valid parent Property #{bld_in.property_id}")

    code = bld_in.code or f"BLD-{uuid.uuid4().hex[:6].upper()}"

    bld_dict = bld_in.model_dump()
    bld_dict["code"] = code

    bld = Building(**bld_dict)
    db.add(bld)
    
    # Increment total buildings count on Property
    prop.total_buildings += 1
    db.commit()
    db.refresh(bld)

    audit = AuditLog(user_id=1, action="CREATE", entity_type="Building", entity_id=bld.id, payload=f"Created Building '{bld.name}' under Property '{prop.name}'")
    db.add(audit)
    db.commit()

    return bld

# Units API
@router.get("/units", response_model=List[UnitResponse])
def list_units(status: str = None, db: Session = Depends(get_db)):
    query = db.query(Unit)
    if status:
        query = query.filter(Unit.status == status)
    return query.all()

@router.post("/units", response_model=UnitResponse)
def create_unit(unit_in: UnitCreate, db: Session = Depends(get_db)):
    total_calc = float(unit_in.area_sqft) * float(unit_in.rate_per_sqft)
    unit = Unit(
        building_id=unit_in.building_id,
        unit_number=unit_in.unit_number,
        unit_type=unit_in.unit_type,
        floor_number=unit_in.floor_number,
        area_sqft=unit_in.area_sqft,
        rate_per_sqft=unit_in.rate_per_sqft,
        total_price=total_calc,
        status=unit_in.status or "available"
    )
    db.add(unit)
    db.commit()
    db.refresh(unit)

    # Update total units in Building and Property
    building = db.query(Building).filter(Building.id == unit.building_id).first()
    if building:
        building.total_units += 1
        if building.property:
            building.property.total_units += 1
        db.commit()

    return unit
