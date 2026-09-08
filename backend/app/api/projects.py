from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import Project, Division, TenantSetting, ContractorBill, BoqItem, AuditLog
from app.schemas import (
    ProjectCreate, ProjectResponse,
    DivisionCreate, DivisionResponse,
    TenantSettingResponse, TenantSettingUpdate
)

router = APIRouter(prefix="/api/projects", tags=["Construction Project Master"])

# Helper function to get or create tenant settings
def get_or_create_tenant_setting(db: Session, tenant_name: str = "Default Tenant") -> TenantSetting:
    setting = db.query(TenantSetting).filter(func.lower(TenantSetting.tenant_name) == func.lower(tenant_name)).first()
    if not setting:
        setting = TenantSetting(
            tenant_name=tenant_name,
            is_p2_enabled=False,
            is_funding_mode_enabled=False
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting

# --- DIVISION ENDPOINTS ---

@router.get("/divisions", response_model=List[DivisionResponse])
def list_divisions(active_only: bool = True, tenant_name: str = "Default Tenant", db: Session = Depends(get_db)):
    query = db.query(Division).filter(func.lower(Division.tenant_name) == func.lower(tenant_name))
    if active_only:
        query = query.filter(Division.is_active == True)
    return query.order_by(Division.name.asc()).all()

@router.post("/divisions", response_model=DivisionResponse)
def create_division(div_in: DivisionCreate, db: Session = Depends(get_db)):
    existing = db.query(Division).filter(
        func.lower(Division.tenant_name) == func.lower(div_in.tenant_name or "Default Tenant"),
        func.lower(Division.name) == func.lower(div_in.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Division with this name already exists in your organization.")
    
    div = Division(
        name=div_in.name,
        code=div_in.code,
        tenant_name=div_in.tenant_name or "Default Tenant",
        is_active=div_in.is_active if div_in.is_active is not None else True
    )
    db.add(div)
    db.commit()
    db.refresh(div)
    return div

@router.put("/divisions/{division_id}/deactivate", response_model=DivisionResponse)
def toggle_division_active(division_id: int, is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    div = db.query(Division).filter(Division.id == division_id).first()
    if not div:
        raise HTTPException(status_code=404, detail="Division not found")
    if is_active is not None:
        div.is_active = is_active
    else:
        div.is_active = not div.is_active
    db.commit()
    db.refresh(div)
    return div

# --- TENANT SETTINGS / FEATURE FLAGS ENDPOINTS ---

@router.get("/tenant-settings", response_model=TenantSettingResponse)
def get_tenant_settings(tenant_name: str = "Default Tenant", db: Session = Depends(get_db)):
    return get_or_create_tenant_setting(db, tenant_name)

@router.put("/tenant-settings", response_model=TenantSettingResponse)
def update_tenant_settings(setting_in: TenantSettingUpdate, tenant_name: str = "Default Tenant", db: Session = Depends(get_db)):
    setting = get_or_create_tenant_setting(db, tenant_name)
    if setting_in.is_p2_enabled is not None:
        setting.is_p2_enabled = setting_in.is_p2_enabled
    if setting_in.is_funding_mode_enabled is not None:
        setting.is_funding_mode_enabled = setting_in.is_funding_mode_enabled
    db.commit()
    db.refresh(setting)
    return setting

# --- PROJECT ENDPOINTS ---

@router.get("", response_model=List[ProjectResponse])
@router.get("/", response_model=List[ProjectResponse])
def list_projects(status: str = None, tenant_name: str = "Default Tenant", db: Session = Depends(get_db)):
    query = db.query(Project)
    if status:
        query = query.filter(func.lower(Project.status) == status.lower())
    return query.order_by(Project.created_at.desc()).all()

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project_by_id(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("", response_model=ProjectResponse)
@router.post("/", response_model=ProjectResponse)
def create_project(project_in: ProjectCreate, db: Session = Depends(get_db)):
    tenant_name = project_in.tenant_name or "Default Tenant"

    # 1. Project / Contract Name length validation (Max 120 chars)
    name_clean = project_in.name.strip()
    if len(name_clean) > 120:
        raise HTTPException(status_code=400, detail="Project Name cannot exceed 120 characters.")
    if not name_clean:
        raise HTTPException(status_code=400, detail="Project Name is required.")

    # 2. Case-insensitive duplicate project name validation within tenant
    existing_name = db.query(Project).filter(
        func.lower(Project.tenant_name) == func.lower(tenant_name),
        func.lower(Project.name) == func.lower(name_clean)
    ).first()
    if existing_name:
        raise HTTPException(status_code=400, detail="A project with this name already exists in your organization.")

    # 3. Project Code uniqueness
    existing_code = db.query(Project).filter(Project.code == project_in.code.strip()).first()
    if existing_code:
        raise HTTPException(status_code=400, detail="Project with this Code already exists.")

    # 4. Estimated Contract Value (budget) > 0
    if project_in.budget <= 0:
        raise HTTPException(status_code=400, detail="Estimated Contract Value must be greater than 0.")

    # 5. Scheduled Completion Date must be after Start Date
    if project_in.end_date <= project_in.start_date:
        raise HTTPException(status_code=400, detail="Scheduled Completion Date must be after Start Date.")

    # 6. Contract Type P2 Feature Flag check
    tenant_setting = get_or_create_tenant_setting(db, tenant_name)
    contract_type = project_in.contract_type or "Item Rate"
    if contract_type in ["Percentage Rate", "EPC"] and not tenant_setting.is_p2_enabled:
        raise HTTPException(status_code=400, detail="Percentage Rate and EPC require the tenant P2 feature to be enabled.")

    # 7. Division verification & historical snapshot
    division_name = project_in.division_name
    if project_in.division_id:
        div = db.query(Division).filter(Division.id == project_in.division_id).first()
        if not div:
            raise HTTPException(status_code=400, detail="Selected division does not exist.")
        if not div.is_active:
            raise HTTPException(status_code=400, detail="Selected division is deactivated and cannot be assigned to new projects.")
        division_name = div.name

    # 8. Funding Mode handling
    funding_mode = project_in.funding_mode or "Budgeted"
    if not tenant_setting.is_funding_mode_enabled:
        funding_mode = "Budgeted"

    # 9. Contract Duration calculation
    duration_days = max(0, (project_in.end_date - project_in.start_date).days)

    # 10. Every newly created project MUST enter DRAFT status
    status = "DRAFT"

    project = Project(
        tenant_name=tenant_name,
        name=name_clean,
        code=project_in.code.strip(),
        division_id=project_in.division_id,
        division_name=division_name,
        contract_type=contract_type,
        funding_mode=funding_mode,
        client_id=project_in.client_id,
        manager_id=project_in.manager_id,
        location=project_in.location.strip(),
        latitude=project_in.latitude,
        longitude=project_in.longitude,
        start_date=project_in.start_date,
        end_date=project_in.end_date,
        contract_duration_days=duration_days,
        budget=project_in.budget,
        status=status
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Audit Log
    audit = AuditLog(
        user_id=1,
        action="CREATE",
        entity_type="Project",
        entity_id=project.id,
        payload=f"Created Construction Project: {project.name} (Status: DRAFT, Budget: ${project.budget})"
    )
    db.add(audit)
    db.commit()

    return project

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, project_in: ProjectCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tenant_name = project_in.tenant_name or project.tenant_name

    # 1. Check Project Name uniqueness if changing name
    name_clean = project_in.name.strip()
    if name_clean.lower() != project.name.lower():
        if len(name_clean) > 120:
            raise HTTPException(status_code=400, detail="Project Name cannot exceed 120 characters.")
        existing_name = db.query(Project).filter(
            Project.id != project_id,
            func.lower(Project.tenant_name) == func.lower(tenant_name),
            func.lower(Project.name) == func.lower(name_clean)
        ).first()
        if existing_name:
            raise HTTPException(status_code=400, detail="A project with this name already exists in your organization.")

    # 2. Check Contract Type Lock after First Bill
    requested_contract_type = project_in.contract_type or "Item Rate"
    if requested_contract_type != project.contract_type:
        has_bills = db.query(ContractorBill).filter(ContractorBill.project_id == project_id).first() is not None
        if has_bills:
            raise HTTPException(status_code=400, detail="Contract Type cannot be modified after the first bill has been submitted.")

    # 3. Check Estimated Contract Value > 0
    if project_in.budget <= 0:
        raise HTTPException(status_code=400, detail="Estimated Contract Value must be greater than 0.")

    # 4. Scheduled Completion Date must be after Start Date
    if project_in.end_date <= project_in.start_date:
        raise HTTPException(status_code=400, detail="Scheduled Completion Date must be after Start Date.")

    # 5. Project Activation Gate Enforcement (DRAFT -> ACTIVE transition)
    target_status = project_in.status or project.status
    if target_status.upper() == "ACTIVE" and project.status.upper() == "DRAFT":
        has_boq = db.query(BoqItem).filter(BoqItem.project_id == project_id).first() is not None
        
        has_estimate = False
        try:
            from app.models import DetailedEstimate
            has_estimate = db.query(DetailedEstimate).filter(DetailedEstimate.project_id == project_id).first() is not None
        except Exception:
            has_estimate = False

        has_ts_approved = False
        try:
            from app.models import TechnicalSanction
            ts = db.query(TechnicalSanction).filter(TechnicalSanction.project_id == project_id, TechnicalSanction.status == "APPROVED").first()
            has_ts_approved = ts is not None
        except Exception:
            has_ts_approved = False

        if not (has_boq and has_estimate and has_ts_approved):
            missing = []
            if not has_boq: missing.append("Attached BOQ")
            if not has_estimate: missing.append("Detailed Estimate")
            if not has_ts_approved: missing.append("Approved Technical Sanction (PSC-07)")
            raise HTTPException(
                status_code=400,
                detail=f"Cannot activate project. Project activation requires: {', '.join(missing)}."
            )

    # Division update & historical snapshot retention
    if project_in.division_id:
        div = db.query(Division).filter(Division.id == project_in.division_id).first()
        if div:
            project.division_id = div.id
            project.division_name = div.name

    duration_days = max(0, (project_in.end_date - project_in.start_date).days)

    project.name = name_clean
    project.code = project_in.code.strip()
    project.contract_type = requested_contract_type
    project.funding_mode = project_in.funding_mode or project.funding_mode
    project.client_id = project_in.client_id
    project.manager_id = project_in.manager_id
    project.location = project_in.location.strip()
    if project_in.latitude is not None: project.latitude = project_in.latitude
    if project_in.longitude is not None: project.longitude = project_in.longitude
    project.start_date = project_in.start_date
    project.end_date = project_in.end_date
    project.contract_duration_days = duration_days
    project.budget = project_in.budget
    project.status = target_status

    db.commit()
    db.refresh(project)

    audit = AuditLog(
        user_id=1,
        action="UPDATE",
        entity_type="Project",
        entity_id=project.id,
        payload=f"Updated Project #{project.id}: {project.name} (Status: {project.status})"
    )
    db.add(audit)
    db.commit()

    return project
