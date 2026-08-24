from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from app.database import get_db
from app.models import Unit, Building, Property, Project, AuditLog
from app.schemas import UnitCreate, UnitResponse

router = APIRouter(prefix="/api/units", tags=["Real Estate Unit Inventory Master"])

VALID_STATUSES = {"AVAILABLE", "HELD", "BOOKED", "ALLOCATED", "SOLD", "BLOCKED"}

# Lifecycle Transition Matrix
ALLOWED_TRANSITIONS = {
    "AVAILABLE": {"HELD", "BOOKED", "BLOCKED", "AVAILABLE"},
    "HELD": {"BOOKED", "AVAILABLE", "HELD"},
    "BOOKED": {"ALLOCATED", "AVAILABLE", "BOOKED"},
    "ALLOCATED": {"SOLD", "BOOKED", "ALLOCATED"},
    "SOLD": {"SOLD"},  # Terminal status
    "BLOCKED": {"AVAILABLE", "BLOCKED"}
}

def enrich_unit_response(unit: Unit) -> dict:
    unit_dict = {
        "id": unit.id,
        "building_id": unit.building_id,
        "unit_number": unit.unit_number,
        "unit_code": unit.unit_code or f"UNIT-{unit.id}",
        "unit_type": unit.unit_type,
        "floor_number": unit.floor_number,
        "area_sqft": float(unit.area_sqft or 0),
        "carpet_area": float(unit.carpet_area) if unit.carpet_area is not None else None,
        "builtup_area": float(unit.builtup_area) if unit.builtup_area is not None else None,
        "facing": unit.facing,
        "configuration": unit.configuration,
        "rate_per_sqft": float(unit.rate_per_sqft or 0),
        "total_price": float(unit.total_price or 0),
        "status": (unit.status or "AVAILABLE").upper(),
        "description": unit.description,
        "created_at": unit.created_at,
        "building_name": unit.building.name if unit.building else None,
        "property_name": unit.building.property.name if (unit.building and unit.building.property) else None,
        "property_id": unit.building.property_id if unit.building else None,
        "project_name": unit.building.property.project.name if (unit.building and unit.building.property and unit.building.property.project) else None,
        "project_id": unit.building.property.project_id if (unit.building and unit.building.property) else None,
    }
    return unit_dict

@router.get("/kpis")
def get_inventory_kpis(db: Session = Depends(get_db)):
    """Returns live inventory KPI counts calculated directly from MySQL."""
    all_units = db.query(Unit).all()
    kpis = {
        "total": len(all_units),
        "available": 0,
        "held": 0,
        "booked": 0,
        "allocated": 0,
        "sold": 0,
        "blocked": 0
    }
    for u in all_units:
        st = (u.status or "AVAILABLE").upper()
        if st in kpis:
            kpis[st] += 1
        elif st == "AVAILABLE":
            kpis["available"] += 1
    return kpis

@router.get("/", response_model=List[dict])
def list_units(
    building_id: Optional[int] = None,
    property_id: Optional[int] = None,
    project_id: Optional[int] = None,
    status: Optional[str] = None,
    unit_type: Optional[str] = None,
    floor_number: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Unit).join(Building, Unit.building_id == Building.id)

    if building_id:
        query = query.filter(Unit.building_id == building_id)

    if property_id:
        query = query.filter(Building.property_id == property_id)

    if project_id:
        query = query.join(Property, Building.property_id == Property.id).filter(Property.project_id == project_id)

    if status and status.upper() != "ALL":
        query = query.filter(Unit.status == status.upper())

    if unit_type and unit_type != "ALL":
        query = query.filter(Unit.unit_type == unit_type)

    if floor_number is not None:
        query = query.filter(Unit.floor_number == floor_number)

    units = query.order_by(Unit.created_at.desc()).all()
    return [enrich_unit_response(u) for u in units]

@router.get("/{unit_id}", response_model=dict)
def get_unit_by_id(unit_id: int, db: Session = Depends(get_db)):
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found in inventory")
    return enrich_unit_response(unit)

@router.post("/", response_model=dict)
def create_unit(unit_in: UnitCreate, db: Session = Depends(get_db)):
    building = db.query(Building).filter(Building.id == unit_in.building_id).first()
    if not building:
        raise HTTPException(status_code=400, detail=f"Cannot create Unit without a valid parent Building #{unit_in.building_id}")

    st = (unit_in.status or "AVAILABLE").upper()
    if st not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid unit status '{st}'. Must be one of {VALID_STATUSES}")

    unit_code = unit_in.unit_code or f"U-{building.code}-{unit_in.unit_number.replace(' ', '')}"
    
    # Calculate price if zero
    rate = float(unit_in.rate_per_sqft or 0)
    area = float(unit_in.area_sqft or 0)
    total_price = float(unit_in.total_price or 0)
    if total_price == 0 and rate > 0 and area > 0:
        total_price = area * rate

    unit_dict = unit_in.model_dump()
    unit_dict["unit_code"] = unit_code
    unit_dict["status"] = st
    unit_dict["total_price"] = total_price

    unit = Unit(**unit_dict)
    db.add(unit)

    # Update total units in building and property
    building.total_units += 1
    if building.property:
        building.property.total_units += 1

    db.commit()
    db.refresh(unit)

    audit = AuditLog(user_id=1, action="CREATE", entity_type="Unit", entity_id=unit.id, payload=f"Created Unit '{unit.unit_number}' ({st}) in Building '{building.name}'")
    db.add(audit)
    db.commit()

    return enrich_unit_response(unit)

@router.put("/{unit_id}", response_model=dict)
def update_unit(unit_id: int, unit_in: UnitCreate, db: Session = Depends(get_db)):
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    new_status = (unit_in.status or unit.status or "AVAILABLE").upper()
    current_status = (unit.status or "AVAILABLE").upper()

    if new_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid unit status '{new_status}'")

    # Enforce lifecycle transition rules
    allowed = ALLOWED_TRANSITIONS.get(current_status, {current_status})
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid Status Transition: Cannot change unit status from '{current_status}' to '{new_status}'. Allowed transitions: {list(allowed)}"
        )

    for field, val in unit_in.model_dump(exclude_unset=True).items():
        setattr(unit, field, val)

    unit.status = new_status

    # Recalculate price if needed
    if float(unit.total_price or 0) == 0 and float(unit.area_sqft or 0) > 0 and float(unit.rate_per_sqft or 0) > 0:
        unit.total_price = float(unit.area_sqft) * float(unit.rate_per_sqft)

    db.commit()
    db.refresh(unit)

    audit = AuditLog(user_id=1, action="UPDATE", entity_type="Unit", entity_id=unit.id, payload=f"Updated Unit #{unit.id} status to '{new_status}'")
    db.add(audit)
    db.commit()

    return enrich_unit_response(unit)
