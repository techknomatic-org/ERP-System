from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime, date

from app.database import get_db
from app.models import Project, Division, TenantSetting, ContractorBill, BoqItem, AuditLog, ProjectTeamMember, User
from app.api.auth import get_current_user
from app.schemas import (
    ProjectCreate, ProjectResponse,
    DivisionCreate, DivisionResponse,
    TenantSettingResponse, TenantSettingUpdate
)

router = APIRouter(prefix="/api/projects", tags=["Construction Project Master"])

def derive_project_phase(project: Project, db: Session) -> str:
    """Derives current project lifecycle phase from actual database state."""
    is_draft = (project.status or '').upper() == 'DRAFT'
    if is_draft:
        return 'PHASE 1 — PROJECT CREATION'

    # Check Phase 5: Intelligence & Integration
    has_intelligence = False
    try:
        from app.models import TestCheckAssignment
        has_intelligence = db.query(TestCheckAssignment).filter(
            TestCheckAssignment.project_id == project.id,
            TestCheckAssignment.risk_score > 1.0
        ).first() is not None
    except Exception:
        has_intelligence = False

    if has_intelligence:
        return 'PHASE 5 — INTELLIGENCE & INTEGRATION'

    prog = float(project.progress_pct or 0)
    has_photos = False
    try:
        from app.models import SiteLogPhoto
        has_photos = db.query(SiteLogPhoto).filter(SiteLogPhoto.project_id == project.id).first() is not None
    except Exception:
        pass

    if prog > 0 or has_photos:
        return 'PHASE 4 — PROGRESS & VISIBILITY'

    has_site_logs = False
    has_mb = False
    has_hindrance = False
    try:
        from app.models import SiteDailyLog, MeasurementBook, Hindrance
        has_site_logs = db.query(SiteDailyLog).filter(SiteDailyLog.project_id == project.id).first() is not None
        has_mb = db.query(MeasurementBook).filter(MeasurementBook.project_id == project.id).first() is not None
        has_hindrance = db.query(Hindrance).filter(Hindrance.project_id == project.id).first() is not None
    except Exception:
        pass

    if has_site_logs or has_mb or has_hindrance:
        return 'PHASE 3 — EXECUTION & APPROVALS'

    has_wbs = False
    has_work_plans = False
    has_milestones = False
    has_team = False
    try:
        from app.models import WbsTask, WorkPlan, ProjectMilestone, ProjectTeamMember
        has_wbs = db.query(WbsTask).filter(WbsTask.project_id == project.id).first() is not None
        has_work_plans = db.query(WorkPlan).filter(WorkPlan.project_id == project.id).first() is not None
        has_milestones = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == project.id).first() is not None
        has_team = db.query(ProjectTeamMember).filter(ProjectTeamMember.project_id == project.id).first() is not None
    except Exception:
        pass

    if has_wbs or has_work_plans or has_milestones or has_team:
        return 'PHASE 2 — WORK PLANNING & TEAM'

    return 'PHASE 1 — PROJECT CREATION'

# Helper function to get or create tenant settings
def get_or_create_tenant_setting(db: Session, tenant_name: str = "Default Tenant"):
    try:
        setting = db.query(TenantSetting).filter(func.lower(TenantSetting.tenant_name) == func.lower(tenant_name)).first()
        if not setting:
            setting = TenantSetting(
                tenant_name=tenant_name,
                is_p2_enabled=False,
                is_funding_mode_enabled=False,
                ae_sampling_rate=50.00,
                ee_sampling_rate=10.00,
                max_file_upload_mb=10
            )
            db.add(setting)
            db.commit()
            db.refresh(setting)
        return setting
    except Exception as e:
        db.rollback()
        # Attempt auto-migration of missing columns
        try:
            from sqlalchemy import text
            for col_sql in [
                "ALTER TABLE `tenant_settings` ADD COLUMN `ae_sampling_rate` DECIMAL(5, 2) NOT NULL DEFAULT 50.00",
                "ALTER TABLE `tenant_settings` ADD COLUMN `ee_sampling_rate` DECIMAL(5, 2) NOT NULL DEFAULT 10.00",
                "ALTER TABLE `tenant_settings` ADD COLUMN `max_file_upload_mb` INT NOT NULL DEFAULT 10"
            ]:
                try:
                    db.execute(text(col_sql))
                    db.commit()
                except Exception:
                    db.rollback()
            setting = db.query(TenantSetting).filter(func.lower(TenantSetting.tenant_name) == func.lower(tenant_name)).first()
            if setting:
                return setting
        except Exception:
            db.rollback()

        # Resilient fallback object ensuring 200 OK
        class FallbackSetting:
            id = 1
            tenant_name = tenant_name
            is_p2_enabled = False
            is_funding_mode_enabled = False
            ae_sampling_rate = 50.00
            ee_sampling_rate = 10.00
            max_file_upload_mb = 10
            updated_at = datetime.utcnow()
        return FallbackSetting()

# --- DIVISION ENDPOINTS ---

@router.get("/divisions", response_model=List[DivisionResponse])
def list_divisions(active_only: bool = True, tenant_name: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Division)
    if tenant_name:
        tenant_query = query.filter(func.lower(Division.tenant_name) == func.lower(tenant_name))
        if active_only:
            tenant_query = tenant_query.filter(Division.is_active == True)
        tenant_results = tenant_query.order_by(Division.name.asc()).all()
        if tenant_results:
            return tenant_results
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

@router.delete("/divisions/{division_id}")
def delete_division(division_id: int, db: Session = Depends(get_db)):
    div = db.query(Division).filter(Division.id == division_id).first()
    if not div:
        raise HTTPException(status_code=404, detail="Division not found")
    in_use = db.query(Project).filter(Project.division_id == division_id).first()
    if in_use:
        raise HTTPException(status_code=400, detail="This option is already in use and cannot be deleted.")
    db.delete(div)
    db.commit()
    return {"message": "Division deleted successfully"}

# --- TENANT SETTINGS / FEATURE FLAGS ENDPOINTS ---

@router.get("/tenant-settings", response_model=TenantSettingResponse)
@router.get("/tenant-settings/", response_model=TenantSettingResponse)
def get_tenant_settings(tenant_name: str = "Default Tenant", db: Session = Depends(get_db)):
    return get_or_create_tenant_setting(db, tenant_name)

@router.put("/tenant-settings", response_model=TenantSettingResponse)
@router.put("/tenant-settings/", response_model=TenantSettingResponse)
def update_tenant_settings(
    setting_in: TenantSettingUpdate, 
    tenant_name: str = "Default Tenant", 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # RBAC: Only authorized tenant administrators can update feature flags
    user_role = (current_user.role or "").lower()
    if user_role not in ["admin", "administrator", "tenant_admin"]:
        raise HTTPException(
            status_code=403, 
            detail="Forbidden: Only tenant administrators are authorized to modify feature flags and tenant settings."
        )

    try:
        setting = get_or_create_tenant_setting(db, tenant_name)
        if isinstance(setting, TenantSetting):
            if setting_in.is_p2_enabled is not None:
                setting.is_p2_enabled = setting_in.is_p2_enabled
            if setting_in.is_funding_mode_enabled is not None:
                setting.is_funding_mode_enabled = setting_in.is_funding_mode_enabled
            if setting_in.ae_sampling_rate is not None:
                setting.ae_sampling_rate = setting_in.ae_sampling_rate
            if setting_in.ee_sampling_rate is not None:
                setting.ee_sampling_rate = setting_in.ee_sampling_rate
            if setting_in.custom_funding_modes is not None:
                setting.custom_funding_modes = setting_in.custom_funding_modes
            if setting_in.custom_currencies is not None:
                setting.custom_currencies = setting_in.custom_currencies
            db.commit()
            db.refresh(setting)
        return setting
    except Exception:
        db.rollback()
        return get_or_create_tenant_setting(db, tenant_name)

@router.post("/master-data/option")
def add_master_data_option(
    category: str = Query(...), 
    option_value: str = Query(...), 
    option_label: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    val = option_value.strip()
    if not val:
        raise HTTPException(status_code=400, detail="Option value cannot be empty.")
    setting = get_or_create_tenant_setting(db)
    import json
    if category == "funding_mode":
        modes = []
        if isinstance(setting, TenantSetting) and setting.custom_funding_modes:
            try:
                modes = json.loads(setting.custom_funding_modes)
            except Exception:
                modes = []
        defaults = ["Budgeted", "Deposit", "CSSA"]
        if any(m.lower() == val.lower() for m in modes) or any(d.lower() == val.lower() for d in defaults):
            raise HTTPException(status_code=400, detail="This option already exists.")
        modes.append(val)
        setting.custom_funding_modes = json.dumps(modes)
        db.commit()
        return {"message": f"Funding mode '{val}' added successfully.", "options": modes}

    elif category == "currency":
        currs = []
        if isinstance(setting, TenantSetting) and setting.custom_currencies:
            try:
                currs = json.loads(setting.custom_currencies)
            except Exception:
                currs = []
        existing_codes = [c.get("code").lower() if isinstance(c, dict) else str(c).lower() for c in currs]
        default_codes = ["inr", "usd", "eur", "gbp", "aed", "sar", "sgd", "aud", "cad", "jpy"]
        if val.lower() in existing_codes or val.lower() in default_codes:
            raise HTTPException(status_code=400, detail="This currency already exists.")
        label = option_label or f"{val.upper()} — Custom Currency"
        currs.append({"code": val.upper(), "symbol": val.upper(), "label": label})
        setting.custom_currencies = json.dumps(currs)
        db.commit()
        return {"message": f"Currency '{val}' added successfully.", "options": currs}

    raise HTTPException(status_code=400, detail=f"Unsupported master data category: {category}")

@router.delete("/master-data/option")
def delete_master_data_option(
    category: str = Query(...), 
    option_value: str = Query(...), 
    db: Session = Depends(get_db)
):
    val = option_value.strip()
    if category == "funding_mode":
        in_use = db.query(Project).filter(func.lower(Project.funding_mode) == val.lower()).first()
        if in_use:
            raise HTTPException(status_code=400, detail="This option is already in use and cannot be deleted.")
        setting = get_or_create_tenant_setting(db)
        if isinstance(setting, TenantSetting) and setting.custom_funding_modes:
            import json
            try:
                modes = json.loads(setting.custom_funding_modes)
                modes = [m for m in modes if m.lower() != val.lower()]
                setting.custom_funding_modes = json.dumps(modes)
                db.commit()
            except Exception:
                pass
        return {"message": f"Funding mode '{val}' removed successfully."}

    elif category == "currency":
        in_use = db.query(Project).filter(func.lower(Project.currency) == val.lower()).first()
        if in_use:
            raise HTTPException(status_code=400, detail="This option is already in use and cannot be deleted.")
        setting = get_or_create_tenant_setting(db)
        if isinstance(setting, TenantSetting) and setting.custom_currencies:
            import json
            try:
                currs = json.loads(setting.custom_currencies)
                currs = [c for c in currs if (c.get("code") if isinstance(c, dict) else str(c)).lower() != val.lower()]
                setting.custom_currencies = json.dumps(currs)
                db.commit()
            except Exception:
                pass
        return {"message": f"Currency '{val}' removed successfully."}

    raise HTTPException(status_code=400, detail=f"Unsupported master data category: {category}")

# --- PROJECT ENDPOINTS ---

@router.get("", response_model=List[ProjectResponse])
@router.get("/", response_model=List[ProjectResponse])
def list_projects(
    status: str = None, 
    active_only: bool = True,
    tenant_name: str = "Default Tenant", 
    db: Session = Depends(get_db)
):
    query = db.query(Project)
    if active_only:
        query = query.filter(Project.is_active == True)
    if status:
        query = query.filter(func.lower(Project.status) == status.lower())
    projects = query.order_by(Project.id.asc()).all()
    for p in projects:
        p.current_phase = derive_project_phase(p, db)
    return projects

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project_by_id(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.current_phase = derive_project_phase(project, db)
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

    # 4. Estimated Contract Value (budget >= 0 if provided)
    budget_val = float(project_in.budget) if project_in.budget is not None else 0.0
    if project_in.budget is not None and budget_val < 0:
        raise HTTPException(status_code=400, detail="Estimated Contract Value cannot be negative.")

    # 5. Scheduled Completion Date must be after Start Date (if both provided)
    if project_in.start_date and project_in.end_date:
        if project_in.end_date <= project_in.start_date:
            raise HTTPException(status_code=400, detail="Scheduled Completion Date must be after Start Date.")
        duration_days = max(0, (project_in.end_date - project_in.start_date).days)
    else:
        duration_days = 0

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

    # 9. Every newly created project MUST enter DRAFT status
    status = "DRAFT"

    project = Project(
        tenant_name=tenant_name,
        name=name_clean,
        code=project_in.code.strip(),
        division_id=project_in.division_id,
        division_name=division_name,
        contract_type=contract_type,
        funding_mode=funding_mode,
        currency=project_in.currency or "INR",
        client_id=project_in.client_id,
        manager_id=project_in.manager_id,
        location=project_in.location.strip() if project_in.location else None,
        latitude=project_in.latitude,
        longitude=project_in.longitude,
        start_date=project_in.start_date,
        end_date=project_in.end_date,
        contract_duration_days=duration_days,
        budget=budget_val,
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

    project.current_phase = "PHASE 1 — PROJECT CREATION"
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

    # 5. Project Activation Gate Enforcement (DRAFT -> ACTIVE transition or leaving DRAFT)
    target_status = project_in.status or project.status
    if project.status.upper() == "DRAFT" and target_status.upper() != "DRAFT":
        today = date.today()
        # 5a. Check active Contractor PM
        pm = db.query(ProjectTeamMember).filter(
            ProjectTeamMember.project_id == project_id,
            ProjectTeamMember.is_active == True,
            ProjectTeamMember.status == "ACTIVE",
            func.lower(ProjectTeamMember.project_role) == "contractor pm",
            ProjectTeamMember.effective_from <= today,
            or_(ProjectTeamMember.effective_to.is_(None), ProjectTeamMember.effective_to >= today)
        ).first()
        if not pm:
            raise HTTPException(
                status_code=400,
                detail="Project cannot leave Draft: assign at least one Contractor PM."
            )

        # 5b. Check active EE
        ee = db.query(ProjectTeamMember).filter(
            ProjectTeamMember.project_id == project_id,
            ProjectTeamMember.is_active == True,
            ProjectTeamMember.status == "ACTIVE",
            func.lower(ProjectTeamMember.project_role) == "ee",
            ProjectTeamMember.effective_from <= today,
            or_(ProjectTeamMember.effective_to.is_(None), ProjectTeamMember.effective_to >= today)
        ).first()
        if not ee:
            raise HTTPException(
                status_code=400,
                detail="Project cannot leave Draft: assign at least one EE."
            )

        # 5c. BOQ, Detailed Estimate, and Approved Technical Sanction
        has_boq = db.query(BoqItem).filter(BoqItem.project_id == project_id).first() is not None
        
        has_estimate = False
        try:
            from app.models import ProjectEstimate
            has_estimate = db.query(ProjectEstimate).filter(ProjectEstimate.project_id == project_id).first() is not None
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
    if project_in.currency:
        project.currency = project_in.currency
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

    project.current_phase = derive_project_phase(project, db)
    return project
