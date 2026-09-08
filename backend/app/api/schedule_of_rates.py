from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from datetime import datetime
import csv
import io
import json

from app.database import get_db
from app.models import ScheduleOfRates, SorEdition, SorRegion, Project, AuditLog
from app.schemas import (
    ScheduleOfRatesCreate, 
    ScheduleOfRatesUpdate, 
    ScheduleOfRatesResponse,
    SorEditionCreate,
    SorEditionResponse,
    SorRegionCreate,
    SorRegionResponse,
    SorImportPreviewResponse,
    SorImportRowError,
    SorImportCommitRequest
)

router = APIRouter(prefix="/api/schedule-of-rates", tags=["Schedule of Rates (SOR)"])

APPROVED_UNITS_MAP = {
    'cum': 'm³', 'cu.m': 'm³', 'm3': 'm³', 'cubic meter': 'm³', 'cubic metre': 'm³',
    'sqm': 'm²', 'sq.m': 'm²', 'm2': 'm²', 'square meter': 'm²', 'square metre': 'm²',
    'rmt': 'rmt', 'rm': 'rmt', 'm': 'rmt', 'meter': 'rmt', 'metre': 'rmt',
    'each': 'each', 'nos': 'nos', 'number': 'nos', 'numbers': 'nos',
    'kg': 'kg', 'kilogram': 'kg', 'quintal': 'quintal', 'qtl': 'quintal',
    'tonnes': 'tonnes', 'tonne': 'tonnes', 'mt': 'tonnes', 'tons': 'tonnes', 'ton': 'tonnes',
    'lumpsum': 'lumpsum', 'ls': 'lumpsum', 'lump sum': 'lumpsum',
    'hours': 'hours', 'hrs': 'hours', 'bags': 'bags', 'bag': 'bags'
}

def normalize_unit(unit_str: str) -> Optional[str]:
    if not unit_str or not unit_str.strip():
        return None
    raw = unit_str.strip().lower()
    return APPROVED_UNITS_MAP.get(raw, unit_str.strip())

def is_valid_unit(unit_str: str) -> bool:
    if not unit_str or not unit_str.strip():
        return False
    raw = unit_str.strip().lower()
    if raw in APPROVED_UNITS_MAP:
        return True
    valid_exact = {'m³', 'm²', 'rmt', 'each', 'nos', 'kg', 'quintal', 'tonnes', 'lumpsum', 'hours', 'bags', 'other'}
    return raw in valid_exact or unit_str.strip() in valid_exact

# --- EDITION ENDPOINTS ---

@router.get("/editions", response_model=List[SorEditionResponse])
def list_sor_editions(db: Session = Depends(get_db)):
    return db.query(SorEdition).order_by(SorEdition.name.asc()).all()

@router.post("/editions", response_model=SorEditionResponse)
def create_sor_edition(edition_in: SorEditionCreate, db: Session = Depends(get_db)):
    name_clean = edition_in.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Edition name is required.")
    existing = db.query(SorEdition).filter(SorEdition.name.ilike(name_clean)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Edition '{name_clean}' already exists.")

    edition = SorEdition(
        name=name_clean,
        description=edition_in.description,
        effective_date=edition_in.effective_date or datetime.utcnow(),
        status=edition_in.status or "Active"
    )
    db.add(edition)
    db.commit()
    db.refresh(edition)
    return edition

@router.put("/editions/{edition_id}/cost-index")
def update_edition_cost_index(
    edition_id: int, 
    cost_index: float = Query(..., gt=0), 
    region_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    edition = db.query(SorEdition).filter(SorEdition.id == edition_id).first()
    if not edition:
        raise HTTPException(status_code=404, detail="SOR Edition not found.")

    query = db.query(ScheduleOfRates).filter(ScheduleOfRates.sor_edition_id == edition_id)
    if region_id:
        query = query.filter(ScheduleOfRates.sor_region_id == region_id)

    items = query.all()
    count = 0
    for item in items:
        item.cost_index = cost_index
        b_rate = float(item.base_rate or item.rate or 0.0)
        item.rate = round(b_rate * cost_index, 2)
        item.updated_at = datetime.utcnow()
        count += 1

    db.commit()
    return {"message": f"Updated Cost Index to {cost_index} for {count} SOR items in edition '{edition.name}'."}

# --- REGION ENDPOINTS ---

@router.get("/regions", response_model=List[SorRegionResponse])
def list_sor_regions(db: Session = Depends(get_db)):
    return db.query(SorRegion).order_by(SorRegion.name.asc()).all()

@router.post("/regions", response_model=SorRegionResponse)
def create_sor_region(region_in: SorRegionCreate, db: Session = Depends(get_db)):
    name_clean = region_in.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Region name is required.")
    existing = db.query(SorRegion).filter(SorRegion.name.ilike(name_clean)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Region '{name_clean}' already exists.")

    region = SorRegion(
        code=region_in.code.strip().upper() if region_in.code else name_clean[:3].upper(),
        name=name_clean,
        status=region_in.status or "Active"
    )
    db.add(region)
    db.commit()
    db.refresh(region)
    return region

# --- SOR MASTER CRUD ENDPOINTS ---

@router.get("/", response_model=List[ScheduleOfRatesResponse])
def list_sor_items(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    unit: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    edition_id: Optional[int] = Query(None),
    region_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(ScheduleOfRates)

    # If project_id provided, enforce project's edition and region locking
    if project_id:
        proj = db.query(Project).filter(Project.id == project_id).first()
        if proj:
            if proj.sor_edition_id:
                edition_id = proj.sor_edition_id
            if proj.sor_region_id:
                region_id = proj.sor_region_id

    if edition_id:
        query = query.filter(ScheduleOfRates.sor_edition_id == edition_id)

    if region_id:
        query = query.filter(ScheduleOfRates.sor_region_id == region_id)

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                ScheduleOfRates.sor_code.ilike(search_pattern),
                ScheduleOfRates.description.ilike(search_pattern),
                ScheduleOfRates.category.ilike(search_pattern),
                ScheduleOfRates.sor_edition_name.ilike(search_pattern),
                ScheduleOfRates.sor_region_name.ilike(search_pattern)
            )
        )

    if category and category.lower() != 'all':
        query = query.filter(ScheduleOfRates.category == category)

    if unit and unit.lower() != 'all':
        query = query.filter(ScheduleOfRates.unit == unit)

    if status and status.lower() != 'all':
        query = query.filter(ScheduleOfRates.status == status)

    return query.order_by(ScheduleOfRates.sor_code.asc()).all()

@router.get("/lookup")
def lookup_sor_rate(
    edition_id: Optional[int] = Query(None),
    region_id: Optional[int] = Query(None),
    sor_code: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    as_of_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Effective-Date Rate Lookup with Edition + Region Contract Locking."""
    target_edition_id = edition_id
    target_region_id = region_id

    if project_id:
        proj = db.query(Project).filter(Project.id == project_id).first()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found.")
        target_edition_id = proj.sor_edition_id
        target_region_id = proj.sor_region_id

    if not target_edition_id:
        def_ed = db.query(SorEdition).filter(SorEdition.status == "Active").first()
        target_edition_id = def_ed.id if def_ed else 1

    if not target_region_id:
        def_reg = db.query(SorRegion).filter(SorRegion.status == "Active").first()
        target_region_id = def_reg.id if def_reg else 1

    query = db.query(ScheduleOfRates).filter(
        ScheduleOfRates.sor_edition_id == target_edition_id
    )

    if sor_code:
        query = query.filter(ScheduleOfRates.sor_code.ilike(sor_code.strip()))

    if target_region_id:
        query = query.filter(ScheduleOfRates.sor_region_id == target_region_id)

    sor_item = query.first()

    if not sor_item:
        raise HTTPException(
            status_code=400, 
            detail="This item is not available in the selected SOR Edition. Use Non-SOR Rate Analysis."
        )

    b_rate = float(sor_item.base_rate or sor_item.rate or 0.0)
    c_index = float(sor_item.cost_index if sor_item.cost_index is not None else 1.0)
    adj_rate = round(b_rate * c_index, 2)

    return {
        "id": sor_item.id,
        "item_code": sor_item.sor_code,
        "description": sor_item.description,
        "category": sor_item.category,
        "unit": sor_item.unit,
        "base_rate": b_rate,
        "cost_index": c_index,
        "adjusted_rate": adj_rate,
        "effective_date": sor_item.effective_from,
        "sor_edition_id": sor_item.sor_edition_id,
        "sor_edition": sor_item.sor_edition_name,
        "sor_region_id": sor_item.sor_region_id,
        "region": sor_item.sor_region_name,
        "status": sor_item.status
    }

@router.get("/{sor_id}", response_model=ScheduleOfRatesResponse)
def get_sor_item(sor_id: int, db: Session = Depends(get_db)):
    sor_item = db.query(ScheduleOfRates).filter(ScheduleOfRates.id == sor_id).first()
    if not sor_item:
        raise HTTPException(status_code=404, detail="SOR item not found")
    return sor_item

@router.post("/", response_model=ScheduleOfRatesResponse)
def create_sor_item(item_in: ScheduleOfRatesCreate, db: Session = Depends(get_db)):
    # 1. Resolve Edition
    edition = None
    if item_in.sor_edition_id:
        edition = db.query(SorEdition).filter(SorEdition.id == item_in.sor_edition_id).first()
    elif item_in.sor_edition_name:
        edition = db.query(SorEdition).filter(SorEdition.name.ilike(item_in.sor_edition_name.strip())).first()

    if not edition:
        edition = db.query(SorEdition).filter(SorEdition.status == "Active").first()
        if not edition:
            edition = SorEdition(name="DSR 2023", description="Default Edition", status="Active")
            db.add(edition)
            db.commit()
            db.refresh(edition)

    # 2. Resolve Region
    region = None
    if item_in.sor_region_id:
        region = db.query(SorRegion).filter(SorRegion.id == item_in.sor_region_id).first()
    elif item_in.sor_region_name:
        region = db.query(SorRegion).filter(SorRegion.name.ilike(item_in.sor_region_name.strip())).first()

    if not region:
        region = db.query(SorRegion).filter(SorRegion.status == "Active").first()
        if not region:
            region = SorRegion(code="MH", name="Maharashtra", status="Active")
            db.add(region)
            db.commit()
            db.refresh(region)

    # 3. Validations
    sor_code_clean = item_in.sor_code.strip() if item_in.sor_code else ""
    if not sor_code_clean:
        raise HTTPException(status_code=400, detail="SOR Code is required.")
    
    if not item_in.description or not item_in.description.strip():
        raise HTTPException(status_code=400, detail="Description is required.")

    if not item_in.category or not item_in.category.strip():
        raise HTTPException(status_code=400, detail="Category is required.")

    if not item_in.unit or not item_in.unit.strip():
        raise HTTPException(status_code=400, detail="Unit is required.")

    norm_unit = normalize_unit(item_in.unit)
    if not is_valid_unit(item_in.unit):
        raise HTTPException(status_code=400, detail=f"Invalid unit '{item_in.unit}'. Please choose from approved unit master.")

    b_rate = item_in.base_rate if item_in.base_rate is not None else item_in.rate
    if b_rate is None or b_rate <= 0:
        raise HTTPException(status_code=400, detail="Base Rate must be greater than 0.")

    c_index = item_in.cost_index if (item_in.cost_index is not None and item_in.cost_index > 0) else 1.0000

    if not item_in.effective_from:
        raise HTTPException(status_code=400, detail="Effective From date is required.")

    # 4. Edition-scoped Uniqueness check for Item Code
    existing = db.query(ScheduleOfRates).filter(
        ScheduleOfRates.sor_edition_id == edition.id,
        ScheduleOfRates.sor_code.ilike(sor_code_clean)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"SOR Code '{sor_code_clean}' already exists in Edition '{edition.name}'.")

    calculated_rate = round(b_rate * c_index, 2)

    sor_item = ScheduleOfRates(
        sor_edition_id=edition.id,
        sor_region_id=region.id,
        sor_edition_name=edition.name,
        sor_region_name=region.name,
        sor_code=sor_code_clean,
        description=item_in.description.strip(),
        category=item_in.category.strip(),
        unit=norm_unit,
        base_rate=b_rate,
        cost_index=c_index,
        rate=calculated_rate,
        effective_from=item_in.effective_from,
        status=item_in.status if item_in.status in ["Active", "Inactive"] else "Active",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(sor_item)
    db.commit()
    db.refresh(sor_item)

    # Audit Log
    audit = AuditLog(
        user_id=1,
        action="CREATE",
        entity_type="ScheduleOfRates",
        entity_id=sor_item.id,
        payload=f"Created SOR Item: {sor_item.sor_code} in {edition.name} - Base: {b_rate}, Index: {c_index}, Rate: {calculated_rate}"
    )
    db.add(audit)
    db.commit()

    return sor_item

@router.put("/{sor_id}", response_model=ScheduleOfRatesResponse)
def update_sor_item(sor_id: int, item_in: ScheduleOfRatesUpdate, db: Session = Depends(get_db)):
    sor_item = db.query(ScheduleOfRates).filter(ScheduleOfRates.id == sor_id).first()
    if not sor_item:
        raise HTTPException(status_code=404, detail="SOR item not found")

    target_edition_id = item_in.sor_edition_id or sor_item.sor_edition_id

    if item_in.sor_edition_id:
        ed = db.query(SorEdition).filter(SorEdition.id == item_in.sor_edition_id).first()
        if ed:
            sor_item.sor_edition_id = ed.id
            sor_item.sor_edition_name = ed.name

    if item_in.sor_region_id:
        reg = db.query(SorRegion).filter(SorRegion.id == item_in.sor_region_id).first()
        if reg:
            sor_item.sor_region_id = reg.id
            sor_item.sor_region_name = reg.name

    if item_in.sor_code is not None:
        clean_code = item_in.sor_code.strip()
        if not clean_code:
            raise HTTPException(status_code=400, detail="SOR Code cannot be empty.")
        existing = db.query(ScheduleOfRates).filter(
            ScheduleOfRates.sor_edition_id == target_edition_id,
            ScheduleOfRates.sor_code.ilike(clean_code),
            ScheduleOfRates.id != sor_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"SOR Code '{clean_code}' already exists in selected Edition.")
        sor_item.sor_code = clean_code

    if item_in.description is not None:
        if not item_in.description.strip():
            raise HTTPException(status_code=400, detail="Description cannot be empty.")
        sor_item.description = item_in.description.strip()

    if item_in.category is not None:
        if not item_in.category.strip():
            raise HTTPException(status_code=400, detail="Category cannot be empty.")
        sor_item.category = item_in.category.strip()

    if item_in.unit is not None:
        if not item_in.unit.strip():
            raise HTTPException(status_code=400, detail="Unit cannot be empty.")
        if not is_valid_unit(item_in.unit):
            raise HTTPException(status_code=400, detail=f"Invalid unit '{item_in.unit}'.")
        sor_item.unit = normalize_unit(item_in.unit)

    b_rate = item_in.base_rate if item_in.base_rate is not None else item_in.rate
    if b_rate is not None:
        if b_rate <= 0:
            raise HTTPException(status_code=400, detail="Base Rate must be greater than 0.")
        sor_item.base_rate = b_rate

    if item_in.cost_index is not None:
        if item_in.cost_index <= 0:
            raise HTTPException(status_code=400, detail="Cost Index must be greater than 0.")
        sor_item.cost_index = item_in.cost_index

    curr_b_rate = float(sor_item.base_rate or 0.0)
    curr_c_index = float(sor_item.cost_index if sor_item.cost_index is not None else 1.0)
    sor_item.rate = round(curr_b_rate * curr_c_index, 2)

    if item_in.effective_from is not None:
        sor_item.effective_from = item_in.effective_from

    if item_in.status is not None:
        if item_in.status in ["Active", "Inactive"]:
            sor_item.status = item_in.status

    sor_item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(sor_item)

    # Audit Log
    audit = AuditLog(
        user_id=1,
        action="UPDATE",
        entity_type="ScheduleOfRates",
        entity_id=sor_item.id,
        payload=f"Updated SOR Item: {sor_item.sor_code} (Base: {sor_item.base_rate}, Index: {sor_item.cost_index}, Rate: {sor_item.rate})"
    )
    db.add(audit)
    db.commit()

    return sor_item

@router.patch("/{sor_id}/status", response_model=ScheduleOfRatesResponse)
def toggle_sor_status(sor_id: int, new_status: Optional[str] = Query(None), db: Session = Depends(get_db)):
    sor_item = db.query(ScheduleOfRates).filter(ScheduleOfRates.id == sor_id).first()
    if not sor_item:
        raise HTTPException(status_code=404, detail="SOR item not found")

    if new_status and new_status in ["Active", "Inactive"]:
        sor_item.status = new_status
    else:
        sor_item.status = "Inactive" if sor_item.status == "Active" else "Active"

    sor_item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(sor_item)

    audit = AuditLog(
        user_id=1,
        action="TOGGLE_STATUS",
        entity_type="ScheduleOfRates",
        entity_id=sor_item.id,
        payload=f"Changed SOR Item {sor_item.sor_code} status to {sor_item.status}"
    )
    db.add(audit)
    db.commit()

    return sor_item

# --- BULK IMPORT ENDPOINTS ---

def parse_import_content(content_bytes: bytes, filename: str = "") -> List[dict]:
    rows = []
    try:
        text = content_bytes.decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(text))
        for r in reader:
            rows.append(r)
        return rows
    except Exception:
        pass

    try:
        import openpyxl
        wb = openpyxl.load_workbook(filename=io.BytesIO(content_bytes), data_only=True)
        sheet = wb.active
        headers = [str(cell.value or '').strip() for cell in sheet[1]]
        for row in sheet.iter_rows(min_row=2, values_only=True):
            if any(row):
                row_dict = {headers[i]: (row[i] if i < len(row) else '') for i in range(len(headers))}
                rows.append(row_dict)
        return rows
    except Exception:
        pass

    return rows

@router.post("/import-preview", response_model=SorImportPreviewResponse)
async def preview_sor_import(
    file: Optional[UploadFile] = File(None),
    raw_json: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    rows_data = []
    if file:
        content = await file.read()
        rows_data = parse_import_content(content, file.filename or "")
    elif raw_json:
        try:
            rows_data = json.loads(raw_json)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON data for import.")
    else:
        raise HTTPException(status_code=400, detail="No import file or data provided.")

    if not rows_data:
        raise HTTPException(status_code=400, detail="Import file is empty or could not be parsed.")

    errors: List[SorImportRowError] = []
    valid_items: List[dict] = []
    seen_in_file = set()

    all_editions = {e.name.lower(): e for e in db.query(SorEdition).all()}
    all_regions = {r.name.lower(): r for r in db.query(SorRegion).all()}

    for index, row in enumerate(rows_data, start=1):
        norm_row = {str(k).strip().lower().replace(' ', '_').replace('-', '_'): str(v).strip() if v is not None else '' for k, v in row.items()}
        
        edition_str = norm_row.get('sor_edition') or norm_row.get('edition') or norm_row.get('sor_edition_name') or 'DSR 2023'
        region_str = norm_row.get('region') or norm_row.get('sor_region') or norm_row.get('sor_region_name') or 'Maharashtra'
        item_code_str = norm_row.get('item_code') or norm_row.get('sor_code') or norm_row.get('code') or ''
        desc_str = norm_row.get('item_description') or norm_row.get('description') or norm_row.get('sor_description') or ''
        cat_str = norm_row.get('category') or norm_row.get('cat') or 'General'
        unit_str = norm_row.get('unit') or norm_row.get('uom') or ''
        base_rate_str = norm_row.get('base_rate') or norm_row.get('rate') or ''
        cost_index_str = norm_row.get('cost_index') or norm_row.get('index') or '1.0'
        effective_str = norm_row.get('effective_date') or norm_row.get('effective_from') or datetime.utcnow().strftime('%Y-%m-%d')
        status_str = norm_row.get('status') or 'Active'

        row_has_error = False

        if not item_code_str:
            errors.append(SorImportRowError(row_number=index, field="Item Code", error="Item Code is required."))
            row_has_error = True

        if not desc_str:
            errors.append(SorImportRowError(row_number=index, field="Description", error="Description is required."))
            row_has_error = True

        if not unit_str:
            errors.append(SorImportRowError(row_number=index, field="Unit", error="Unit is required."))
            row_has_error = True
        elif not is_valid_unit(unit_str):
            errors.append(SorImportRowError(row_number=index, field="Unit", error=f"Invalid unit '{unit_str}'. Must be approved unit.", existing_value=unit_str))
            row_has_error = True

        base_rate_val = 0.0
        try:
            base_rate_val = float(base_rate_str)
            if base_rate_val <= 0:
                errors.append(SorImportRowError(row_number=index, field="Base Rate", error="Base Rate must be greater than 0.", existing_value=base_rate_str))
                row_has_error = True
        except (ValueError, TypeError):
            errors.append(SorImportRowError(row_number=index, field="Base Rate", error="Base Rate must be a valid positive number.", existing_value=base_rate_str))
            row_has_error = True

        cost_index_val = 1.0
        try:
            cost_index_val = float(cost_index_str) if cost_index_str else 1.0
            if cost_index_val <= 0:
                errors.append(SorImportRowError(row_number=index, field="Cost Index", error="Cost Index must be greater than 0.", existing_value=cost_index_str))
                row_has_error = True
        except (ValueError, TypeError):
            cost_index_val = 1.0

        ed_obj = all_editions.get(edition_str.lower())
        if not ed_obj:
            errors.append(SorImportRowError(row_number=index, field="SOR Edition", error=f"SOR Edition '{edition_str}' not found in master database.", existing_value=edition_str))
            row_has_error = True

        reg_obj = all_regions.get(region_str.lower())
        if not reg_obj:
            errors.append(SorImportRowError(row_number=index, field="Region", error=f"Region '{region_str}' not found in master database.", existing_value=region_str))
            row_has_error = True

        file_key = (edition_str.lower(), item_code_str.lower())
        if item_code_str:
            if file_key in seen_in_file:
                errors.append(SorImportRowError(
                    row_number=index, 
                    field="Item Code", 
                    error=f"Duplicate Item Code '{item_code_str}' in edition '{edition_str}' within import file.",
                    existing_value=item_code_str
                ))
                row_has_error = True
            else:
                seen_in_file.add(file_key)

        if ed_obj and item_code_str and not row_has_error:
            db_existing = db.query(ScheduleOfRates).filter(
                ScheduleOfRates.sor_edition_id == ed_obj.id,
                ScheduleOfRates.sor_code.ilike(item_code_str)
            ).first()
            if db_existing:
                errors.append(SorImportRowError(
                    row_number=index,
                    field="Item Code",
                    error=f"Conflict: Item Code '{item_code_str}' already exists in database for Edition '{ed_obj.name}'.",
                    existing_value=item_code_str
                ))
                row_has_error = True

        if not row_has_error and ed_obj and reg_obj:
            norm_u = normalize_unit(unit_str)
            valid_items.append({
                "row_number": index,
                "sor_edition_id": ed_obj.id,
                "sor_edition_name": ed_obj.name,
                "sor_region_id": reg_obj.id,
                "sor_region_name": reg_obj.name,
                "sor_code": item_code_str,
                "description": desc_str,
                "category": cat_str,
                "unit": norm_u,
                "base_rate": base_rate_val,
                "cost_index": cost_index_val,
                "adjusted_rate": round(base_rate_val * cost_index_val, 2),
                "effective_from": effective_str,
                "status": status_str if status_str in ["Active", "Inactive"] else "Active"
            })

    total_rows = len(rows_data)
    invalid_rows_count = len(set(e.row_number for e in errors))
    valid_rows_count = len(valid_items)

    return SorImportPreviewResponse(
        total_rows=total_rows,
        valid_rows_count=valid_rows_count,
        invalid_rows_count=invalid_rows_count,
        warnings_count=0,
        errors=errors,
        valid_items=valid_items
    )

@router.post("/import-commit")
def commit_sor_import(payload: SorImportCommitRequest, db: Session = Depends(get_db)):
    if not payload.items or len(payload.items) == 0:
        raise HTTPException(status_code=400, detail="No items to import.")

    added_count = 0
    try:
        for item in payload.items:
            existing = db.query(ScheduleOfRates).filter(
                ScheduleOfRates.sor_edition_id == item["sor_edition_id"],
                ScheduleOfRates.sor_code.ilike(item["sor_code"].strip())
            ).first()
            if existing:
                db.rollback()
                raise HTTPException(
                    status_code=400, 
                    detail=f"Import failed: Item Code '{item['sor_code']}' already exists in Edition ID {item['sor_edition_id']}."
                )

            eff_date = item["effective_from"]
            if isinstance(eff_date, str):
                try:
                    eff_date = datetime.fromisoformat(eff_date.replace('Z', ''))
                except Exception:
                    eff_date = datetime.utcnow()

            b_rate = float(item["base_rate"])
            c_index = float(item.get("cost_index") or 1.0)
            adj_rate = round(b_rate * c_index, 2)

            sor_obj = ScheduleOfRates(
                sor_edition_id=item["sor_edition_id"],
                sor_region_id=item["sor_region_id"],
                sor_edition_name=item["sor_edition_name"],
                sor_region_name=item["sor_region_name"],
                sor_code=item["sor_code"].strip(),
                description=item["description"].strip(),
                category=item["category"].strip(),
                unit=item["unit"].strip(),
                base_rate=b_rate,
                cost_index=c_index,
                rate=adj_rate,
                effective_from=eff_date,
                status=item.get("status", "Active"),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(sor_obj)
            added_count += 1

        db.commit()

        audit = AuditLog(
            user_id=1,
            action="BULK_IMPORT",
            entity_type="ScheduleOfRates",
            entity_id=0,
            payload=f"Successfully imported {added_count} SOR records in bulk."
        )
        db.add(audit)
        db.commit()

        return {"message": f"Successfully imported {added_count} SOR records.", "imported_count": added_count}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Transactional import failed: {str(e)}")
