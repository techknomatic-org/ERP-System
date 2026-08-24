from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import ApprovalTask, ApprovalLog, AuditLog, Notification, SiteDailyLog, ContractorBill, PurchaseRequisition, User, Project
from app.schemas import ApprovalTaskCreate, ApprovalAction, ApprovalTaskResponse
from app.api.audit import record_audit_log

router = APIRouter(prefix="/api/approvals", tags=["Approval Engine"])

# Official Business Process Request Types Registry (Requirements 1, 7 & 8)
REQUEST_TYPES_REGISTRY = {
    "SITE_LOG": {
        "request_type": "Site Daily Log",
        "request_code": "SITE_DAILY_LOG",
        "category": "NON_FINANCIAL",
        "source_module": "SITE_DAILY_LOGS",
        "source_module_label": "Site Daily Logs",
        "display_sublabel": "(Site Daily Log)",
        "financial_requirement": False,
        "workflow": ["Site Engineer", "Project Manager"]
    },
    "SITE_ISSUE": {
        "request_type": "Site Issue / Delay Report",
        "request_code": "SITE_ISSUE",
        "category": "NON_FINANCIAL",
        "source_module": "SITE_DAILY_LOGS",
        "source_module_label": "Site Daily Logs",
        "display_sublabel": "(Site Issue)",
        "financial_requirement": False,
        "workflow": ["Site Engineer", "Project Manager"]
    },
    "MATERIAL_STOCK_REQUEST": {
        "request_type": "Material Stock Request",
        "request_code": "MATERIAL_STOCK_REQUEST",
        "category": "NON_FINANCIAL",
        "source_module": "MATERIAL_REQUESTS",
        "source_module_label": "Material Requests",
        "display_sublabel": "(Material Stock Request)",
        "financial_requirement": False,
        "workflow": ["Site Engineer", "Project Manager"]
    },
    "MATERIAL_PURCHASE_REQUEST": {
        "request_type": "Material Purchase Request",
        "request_code": "MATERIAL_PURCHASE_REQUEST",
        "category": "NON_FINANCIAL",
        "source_module": "PROCUREMENT",
        "source_module_label": "Procurement",
        "display_sublabel": "(Material Purchase Request)",
        "financial_requirement": False,
        "workflow": ["Site Engineer", "Project Manager"]
    },
    "CONTRACTOR_BILL": {
        "request_type": "Contractor Bill Payment",
        "request_code": "CONTRACTOR_BILL_PAYMENT",
        "category": "FINANCIAL",
        "source_module": "FINANCIAL_REQUESTS",
        "source_module_label": "Financial Requests",
        "display_sublabel": "(Contractor Payment)",
        "financial_requirement": True,
        "workflow": ["Site Engineer", "Project Manager", "Finance", "Management"]
    },
    "VENDOR_PAYMENT": {
        "request_type": "Vendor Payment",
        "request_code": "VENDOR_PAYMENT",
        "category": "FINANCIAL",
        "source_module": "FINANCIAL_REQUESTS",
        "source_module_label": "Financial Requests",
        "display_sublabel": "(Vendor Payment)",
        "financial_requirement": True,
        "workflow": ["Site Engineer", "Project Manager", "Finance", "Management"]
    },
    "PURCHASE_PAYMENT": {
        "request_type": "Purchase Payment",
        "request_code": "PURCHASE_PAYMENT",
        "category": "FINANCIAL",
        "source_module": "FINANCIAL_REQUESTS",
        "source_module_label": "Financial Requests",
        "display_sublabel": "(Purchase Payment)",
        "financial_requirement": True,
        "workflow": ["Site Engineer", "Project Manager", "Finance", "Management"]
    },
    "OTHER_FINANCIAL_REQUEST": {
        "request_type": "Other Financial Request",
        "request_code": "OTHER_FINANCIAL_REQUEST",
        "category": "FINANCIAL",
        "source_module": "FINANCIAL_REQUESTS",
        "source_module_label": "Financial Requests",
        "display_sublabel": "(Other Financial Request)",
        "financial_requirement": True,
        "workflow": ["Site Engineer", "Project Manager", "Finance", "Management"]
    }
}

ENTITY_TO_TYPE_MAP = {
    "site_log": "SITE_LOG",
    "sitelog": "SITE_LOG",
    "sitedailylog": "SITE_LOG",
    "daily_site_log": "SITE_LOG",
    "site_daily_log": "SITE_LOG",
    
    "site_issue": "SITE_ISSUE",
    "siteissue": "SITE_ISSUE",
    
    "material_request": "MATERIAL_STOCK_REQUEST",
    "materialrequest": "MATERIAL_STOCK_REQUEST",
    "material_stock_request": "MATERIAL_STOCK_REQUEST",
    "materialstockrequest": "MATERIAL_STOCK_REQUEST",
    "material_stock": "MATERIAL_STOCK_REQUEST",
    
    "material_purchase_request": "MATERIAL_PURCHASE_REQUEST",
    "materialpurchaserequest": "MATERIAL_PURCHASE_REQUEST",
    "material_purchase": "MATERIAL_PURCHASE_REQUEST",
    "materialpurchase": "MATERIAL_PURCHASE_REQUEST",
    "purchase_request": "MATERIAL_PURCHASE_REQUEST",
    "purchaserequest": "MATERIAL_PURCHASE_REQUEST",
    "pr": "MATERIAL_PURCHASE_REQUEST",
    "purchaserequisition": "MATERIAL_PURCHASE_REQUEST",
    
    "contractor_bill": "CONTRACTOR_BILL",
    "contractorbill": "CONTRACTOR_BILL",
    "contractor_payment": "CONTRACTOR_BILL",
    "contractorpayment": "CONTRACTOR_BILL",
    "contractor_bill_payment": "CONTRACTOR_BILL",
    
    "vendor_payment": "VENDOR_PAYMENT",
    "vendorpayment": "VENDOR_PAYMENT",
    
    "purchase_payment": "PURCHASE_PAYMENT",
    "purchasepayment": "PURCHASE_PAYMENT",
    
    "other_financial_request": "OTHER_FINANCIAL_REQUEST",
    "otherfinancialrequest": "OTHER_FINANCIAL_REQUEST"
}

def get_request_type_config(entity_type: str) -> dict:
    clean_type = (entity_type or "").lower().replace(" ", "").replace("_", "")
    type_code = ENTITY_TO_TYPE_MAP.get(clean_type, "SITE_LOG" if "log" in clean_type or "site" in clean_type else "CONTRACTOR_BILL")
    return REQUEST_TYPES_REGISTRY.get(type_code, REQUEST_TYPES_REGISTRY["SITE_LOG"])

def is_financial_task(entity_type: str) -> bool:
    config = get_request_type_config(entity_type)
    return config["financial_requirement"]

def get_stages_for_task(entity_type: str) -> list[str]:
    config = get_request_type_config(entity_type)
    return list(config["workflow"])

@router.get("/request-types")
def list_request_types():
    return list(REQUEST_TYPES_REGISTRY.values())

# Strict role requirement per approval stage (Section 1, 7, 13)
STAGE_TO_ROLE_MAP = {
    "Site Engineer": "site_engineer",
    "Project Manager": "project_manager",
    "Finance": "finance",
    "Management": "management"
}

STAGE_PERMISSIONS = {
    "Site Engineer": ["site_engineer"],
    "Project Manager": ["project_manager"],
    "Finance": ["finance"],
    "Management": ["management"]
}

def build_task_dict(task: ApprovalTask, db: Session) -> dict:
    req_type = task.request_type
    req_cat = task.request_category
    src_mod = task.source_module

    if not req_type or not req_cat or not src_mod:
        config = get_request_type_config(task.entity_type)
        req_type = req_type or config["request_code"]
        req_cat = req_cat or config["category"]
        src_mod = src_mod or config["source_module"]

    config = get_request_type_config(req_type)
    fin = (req_cat == "FINANCIAL") or config["financial_requirement"]
    stages = list(config["workflow"])
    req_type_name = config["request_type"]
    req_code = config["request_code"]
    source_module_label = config["source_module_label"]
    display_sublabel = config["display_sublabel"]

    # Get logs for this task
    logs = db.query(ApprovalLog).filter(ApprovalLog.approval_task_id == task.id).order_by(ApprovalLog.created_at.asc()).all()

    # Extract project_id and project_name if available
    project_id = None
    project_name = None
    if task.entity_type in ["SiteLog", "SiteDailyLog", "SITE_LOG", "SITE_DAILY_LOG"]:
        log_rec = db.query(SiteDailyLog).filter(SiteDailyLog.id == task.entity_id).first()
        if log_rec:
            project_id = log_rec.project_id
            prj = db.query(Project).filter(Project.id == log_rec.project_id).first()
            if prj: project_name = prj.name
    elif task.entity_type in ["ContractorBill", "CONTRACTOR_BILL", "CONTRACTOR_BILL_PAYMENT"]:
        bill_rec = db.query(ContractorBill).filter(ContractorBill.id == task.entity_id).first()
        if bill_rec:
            project_id = bill_rec.project_id
            prj = db.query(Project).filter(Project.id == bill_rec.project_id).first()
            if prj: project_name = prj.name
    elif task.entity_type in ["PR", "PurchaseRequisition", "PURCHASE_REQUEST", "MATERIAL_PURCHASE_REQUEST"]:
        pr_rec = db.query(PurchaseRequisition).filter(PurchaseRequisition.id == task.entity_id).first()
        if pr_rec:
            project_id = pr_rec.project_id
            prj = db.query(Project).filter(Project.id == pr_rec.project_id).first()
            if prj: project_name = prj.name

    if not project_name and project_id:
        prj = db.query(Project).filter(Project.id == project_id).first()
        if prj: project_name = prj.name

    curr_idx = stages.index(task.current_stage) if task.current_stage in stages else 0

    approval_stages = []
    for idx, stg in enumerate(stages):
        stg_log = next((l for l in logs if l.stage == stg), None)
        
        if task.status == "approved":
            stg_status = "APPROVED"
        elif task.status == "rejected":
            if idx < curr_idx:
                stg_status = "APPROVED"
            elif idx == curr_idx:
                stg_status = "REJECTED"
            else:
                stg_status = "WAITING"
        else: # pending / sent_back
            if idx < curr_idx:
                stg_status = "APPROVED"
            elif idx == curr_idx:
                stg_status = "PENDING"
            else:
                stg_status = "WAITING"

        app_by = None
        app_at = None
        rej_by = None
        rej_at = None
        comments = None

        if stg_log:
            comments = stg_log.comments
            approver_user = db.query(User).filter(User.id == stg_log.approver_id).first()
            user_info = {
                "id": stg_log.approver_id,
                "name": approver_user.full_name if approver_user else f"User #{stg_log.approver_id}",
                "role": approver_user.role if approver_user else "unknown"
            }
            if stg_log.action == "approve":
                app_by = user_info
                app_at = stg_log.created_at.isoformat()
            elif stg_log.action == "reject":
                rej_by = user_info
                rej_at = stg_log.created_at.isoformat()

        approval_stages.append({
            "role": stg,
            "status": stg_status,
            "approvedBy": app_by,
            "approvedAt": app_at,
            "rejectedBy": rej_by,
            "rejectedAt": rej_at,
            "comments": comments
        })

    logs_list = [{
        "id": l.id,
        "approval_task_id": l.approval_task_id,
        "approver_id": l.approver_id,
        "stage": l.stage,
        "action": l.action,
        "comments": l.comments,
        "created_at": l.created_at
    } for l in logs]

    cat_str = "Financial" if fin else "Non-Financial"
    overall_status_upper = (task.status or "pending").upper()

    return {
        "id": task.id,
        "title": task.title,
        "entity_type": task.entity_type,
        "entity_id": task.entity_id,
        "requester_id": task.requester_id,
        "current_stage": task.current_stage,
        "status": task.status,
        "created_at": task.created_at,
        "logs": logs_list,
        "is_financial": fin,
        "category": cat_str,
        "request_category": cat_str.upper().replace("-", "_"),
        "request_type": req_type,
        "source_module": src_mod,
        "source_module_label": source_module_label,
        "display_sublabel": display_sublabel,
        "project_id": project_id,
        "project_name": project_name or f"Project #{project_id or 1}",
        "request_type_name": req_type_name,
        "request_code": req_code,
        "approval_stages": approval_stages,

        # Standard Workflow Record Schema (Source Module Auto-Classification)
        "requestId": task.id,
        "requestType": req_type_name,
        "requestCode": req_code,
        "requestCategory": cat_str.upper().replace("-", "_"),
        "category": cat_str,
        "sourceModule": src_mod,
        "sourceModuleLabel": source_module_label,
        "displaySublabel": display_sublabel,
        "projectId": project_id,
        "projectName": project_name or f"Project #{project_id or 1}",
        "submittedBy": task.requester_id,
        "createdBy": task.requester_id,
        "currentApprovalStage": task.current_stage,
        "currentApprover": task.current_stage,
        "currentApprovalRole": task.current_stage,
        "overallStatus": overall_status_upper,
        "submissionDate": task.created_at.isoformat() if task.created_at else None,
        "approvalStages": approval_stages,

        # Legacy backward-compatibility aliases
        "sourceType": task.entity_type,
        "sourceId": task.entity_id,
        "createdDate": task.created_at.isoformat() if task.created_at else None
    }

@router.get("/tasks")
def list_approval_tasks(
    role: Optional[str] = Header(None, alias="X-User-Role"),
    user_role: Optional[str] = Query(None),
    status_filter: Optional[str] = Query("pending"),
    db: Session = Depends(get_db)
):
    active_role = (user_role or role or "admin").lower()
    query = db.query(ApprovalTask).order_by(ApprovalTask.created_at.desc())
    all_tasks = query.all()

    formatted_tasks = [build_task_dict(t, db) for t in all_tasks]

    # Status filter logic
    if status_filter == "completed" or status_filter == "approved":
        return [t for t in formatted_tasks if t["status"] == "approved"]
    elif status_filter == "rejected":
        return [t for t in formatted_tasks if t["status"] == "rejected"]
    elif status_filter == "all":
        return formatted_tasks

    # Default: Pending filter based on active role (Requirements 8, 9, 10)
    if active_role in ["admin"]:
        return [t for t in formatted_tasks if t["status"] == "pending"]
    elif active_role == "management":
        return [t for t in formatted_tasks if t["current_stage"] == "Management" and t["requestCategory"] == "FINANCIAL" and t["status"] == "pending"]
    elif active_role == "finance":
        return [t for t in formatted_tasks if t["is_financial"] and t["current_stage"] == "Finance" and t["status"] == "pending"]
    elif active_role == "project_manager":
        return [t for t in formatted_tasks if t["current_stage"] == "Project Manager" and t["status"] == "pending"]
    elif active_role == "site_engineer":
        return [t for t in formatted_tasks if t["current_stage"] == "Site Engineer" and t["status"] == "pending"]

    return [t for t in formatted_tasks if t["status"] == "pending"]

@router.get("/tasks/{task_id}/details")
def get_approval_task_details(task_id: int, db: Session = Depends(get_db)):
    task = db.query(ApprovalTask).filter(ApprovalTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Approval task not found")

    details = build_task_dict(task, db)
    details["site_log"] = None
    details["project"] = None

    if task.entity_type in ["SiteLog", "SiteDailyLog", "SITE_DAILY_LOG"]:
        log = db.query(SiteDailyLog).filter(SiteDailyLog.id == task.entity_id).first()
        if log:
            project = db.query(Project).filter(Project.id == log.project_id).first()
            details["site_log"] = {
                "id": log.id,
                "project_id": log.project_id,
                "engineer_id": log.engineer_id,
                "log_date": log.log_date,
                "physical_progress": log.physical_progress,
                "labour_count": log.labour_count,
                "materials_consumed": log.materials_consumed,
                "equipment_used": log.equipment_used,
                "issues_identified": log.issues_identified,
                "remarks": log.remarks,
                "approval_status": log.approval_status
            }
            if project:
                details["project"] = {"id": project.id, "name": project.name, "code": project.code}

    return details

@router.post("/tasks")
def create_approval_task(
    task_in: ApprovalTaskCreate, 
    requester_id: int = 1,
    role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    user_role = (role or "site_engineer").lower()
    if user_role == "customer":
        raise HTTPException(status_code=403, detail="Customer users are not authorized to create internal approval tasks.")

    existing = db.query(ApprovalTask).filter(
        ApprovalTask.entity_type == task_in.entity_type,
        ApprovalTask.entity_id == task_in.entity_id
    ).first()

    if existing:
        return build_task_dict(existing, db)

    req_code_in = task_in.request_type or task_in.entity_type
    config = get_request_type_config(req_code_in)
    req_type = task_in.request_type or config["request_code"]
    req_cat = task_in.request_category or config["category"]
    src_mod = task_in.source_module or config["source_module"]

    stages = list(config["workflow"])
    initial_stage = task_in.current_stage if (task_in.current_stage and task_in.current_stage in stages) else stages[0]

    task = ApprovalTask(
        title=task_in.title,
        entity_type=task_in.entity_type,
        entity_id=task_in.entity_id,
        requester_id=requester_id,
        current_stage=initial_stage,
        status="pending",
        request_type=req_type,
        request_category=req_cat,
        source_module=src_mod
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    record_audit_log(
        db=db,
        user_id=requester_id,
        action="SUBMIT",
        entity_type=task.entity_type,
        entity_id=task.entity_id,
        payload=f"Approval task created: {task.title} (Type: {task.request_type}, Category: {task.request_category}, Source Module: {task.source_module}, Initial Stage: {task.current_stage})"
    )

    return build_task_dict(task, db)

@router.post("/tasks/{task_id}/action")
def process_approval_action(
    task_id: int, 
    action_in: ApprovalAction, 
    approver_id: int = 1,
    role: Optional[str] = Header(None, alias="X-User-Role"),
    user_role_param: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    task = db.query(ApprovalTask).filter(ApprovalTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Approval task not found")

    user = db.query(User).filter(User.id == approver_id).first()
    user_role = (user_role_param or role or (user.role if user else "site_engineer")).lower()

    if user_role == "customer":
        raise HTTPException(status_code=403, detail="Customer users are not authorized to process internal approval tasks.")

    # Strict role stage permission verification (Section 1, 7, 13, 17)
    req_role = STAGE_TO_ROLE_MAP.get(task.current_stage)
    if req_role and user_role != req_role and user_role != "admin":
        raise HTTPException(
            status_code=403, 
            detail=f"403 Unauthorized Approval Action: Current stage is '{task.current_stage}' (requires active role '{req_role.upper()}'), but your active role is '{user_role.upper()}'."
        )

    # Precondition validation for stage ordering & non-financial checks (Test 9 & Test 10)
    fin_req = is_financial_task(task.entity_type)
    if user_role in ["finance", "management"] and not fin_req:
        raise HTTPException(
            status_code=403,
            detail=f"403 Forbidden: Role '{user_role.upper()}' is not authorized to process non-financial requests."
        )

    if user_role == "finance" and task.current_stage != "Finance":
        raise HTTPException(
            status_code=403,
            detail=f"403 Forbidden: Request is currently at stage '{task.current_stage}'. PM approval must be completed before Finance approval."
        )

    if user_role == "management" and task.current_stage != "Management":
        raise HTTPException(
            status_code=403,
            detail=f"403 Forbidden: Request is currently at stage '{task.current_stage}'. Finance approval must be completed before Management approval."
        )

    prev_status = task.status
    prev_stage = task.current_stage

    # Log approval action log
    log = ApprovalLog(
        approval_task_id=task.id,
        approver_id=approver_id,
        stage=task.current_stage,
        action=action_in.action,
        comments=action_in.comments
    )
    db.add(log)

    stages = get_stages_for_task(task.entity_type)

    if action_in.action == "approve":
        curr_idx = stages.index(task.current_stage) if task.current_stage in stages else 0
        if curr_idx < len(stages) - 1:
            # Advance to next stage (Requirements 6 & 7)
            task.current_stage = stages[curr_idx + 1]
            task.status = "pending"
        else:
            # Final stage approved
            task.status = "approved"

            if task.entity_type in ["SiteLog", "SiteDailyLog"]:
                site_log = db.query(SiteDailyLog).filter(SiteDailyLog.id == task.entity_id).first()
                if site_log:
                    site_log.approval_status = "approved"
            elif task.entity_type == "ContractorBill":
                bill = db.query(ContractorBill).filter(ContractorBill.id == task.entity_id).first()
                if bill:
                    bill.status = "approved"
            elif task.entity_type in ["PR", "PurchaseRequisition", "MATERIAL_PURCHASE_REQUEST"] or task.request_type == "MATERIAL_PURCHASE_REQUEST":
                pr = db.query(PurchaseRequisition).filter(PurchaseRequisition.id == task.entity_id).first()
                if pr:
                    pr.status = "approved"
                mpr = db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.id == task.entity_id).first()
                if mpr:
                    mpr.status = "APPROVED_BY_PM"
                    mpr.current_approval_stage = "PROCUREMENT"

    elif action_in.action == "reject":
        # Stop approval chain on rejection (Requirement 13)
        task.status = "rejected"
        if task.entity_type in ["SiteLog", "SiteDailyLog", "SITE_DAILY_LOG"]:
            site_log = db.query(SiteDailyLog).filter(SiteDailyLog.id == task.entity_id).first()
            if site_log:
                site_log.approval_status = "rejected"
        elif task.entity_type in ["ContractorBill", "CONTRACTOR_BILL", "CONTRACTOR_BILL_PAYMENT"]:
            bill = db.query(ContractorBill).filter(ContractorBill.id == task.entity_id).first()
            if bill:
                bill.status = "rejected"
        elif task.entity_type in ["PR", "PurchaseRequisition", "MATERIAL_PURCHASE_REQUEST"] or task.request_type == "MATERIAL_PURCHASE_REQUEST":
            pr = db.query(PurchaseRequisition).filter(PurchaseRequisition.id == task.entity_id).first()
            if pr:
                pr.status = "rejected"
            mpr = db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.id == task.entity_id).first()
            if mpr:
                mpr.status = "REJECTED"

    elif action_in.action == "send_back":
        task.status = "sent_back"
        curr_idx = stages.index(task.current_stage) if task.current_stage in stages else 0
        if curr_idx > 0:
            task.current_stage = stages[curr_idx - 1]
        mpr = db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.id == task.entity_id).first()
        if mpr:
            mpr.status = "RETURNED"
            mpr.current_approval_stage = "Site Engineer"

    db.commit()
    db.refresh(task)

    # Notification
    notif = Notification(
        user_id=task.requester_id,
        title=f"Approval Update: {task.title}",
        message=f"Task status changed to '{task.status}' at stage '{task.current_stage}'. Remarks: {action_in.comments or 'None'}",
        notification_type="approval",
        entity_type=task.entity_type,
        entity_id=task.entity_id
    )
    db.add(notif)

    # Audit log (Requirement 14)
    record_audit_log(
        db=db,
        user_id=approver_id,
        action=action_in.action.upper(),
        entity_type=task.entity_type,
        entity_id=task.entity_id,
        payload=f"Action: {action_in.action.upper()} by {user_role.upper()} at stage '{prev_stage}'. Prev Status: '{prev_status}' -> New Status: '{task.status}', Current Stage: '{task.current_stage}'. Comments: {action_in.comments or 'None'}"
    )

    return {
        "message": "Approval processed successfully",
        "task_status": task.status,
        "current_stage": task.current_stage,
        "task": build_task_dict(task, db)
    }

