from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import uuid
from datetime import datetime
from app.database import get_db
from app.models import (
    PurchaseRequisition, PurchaseOrder, Project, Vendor, ApprovalTask, 
    AuditLog, Notification, MaterialPurchaseRequest, MaterialDelivery, 
    User, Product, WbsTask
)
from app.schemas import (
    PurchaseRequisitionCreate, PurchaseRequisitionResponse,
    PurchaseOrderCreate, PurchaseOrderResponse,
    MaterialPurchaseRequestCreate, MaterialPurchaseRequestResponse, MaterialPurchaseRequestPmAction,
    MaterialDeliveryCreate, MaterialDeliveryResponse, VendorResponse
)

router = APIRouter(prefix="/api/procurement", tags=["Procurement Portal & Workflows"])

# Helper functions to enrich responses with linked WBS and entity titles
def enrich_mpr_dict(mpr: MaterialPurchaseRequest, db: Session) -> dict:
    m_dict = {
        "id": mpr.id,
        "request_number": mpr.request_number,
        "project_id": mpr.project_id,
        "wbs_phase_id": mpr.wbs_phase_id,
        "wbs_task_id": mpr.wbs_task_id,
        "wbs_subtask_id": mpr.wbs_subtask_id,
        "requested_by": mpr.requested_by,
        "material_name": mpr.material_name,
        "material_category": mpr.material_category or "General Construction",
        "quantity": float(mpr.quantity or 0.0),
        "unit": mpr.unit,
        "required_date": mpr.required_date,
        "estimated_unit_rate": float(mpr.estimated_unit_rate) if mpr.estimated_unit_rate is not None else None,
        "estimated_cost": float(mpr.estimated_cost or 0.0),
        "reason": mpr.reason,
        "stock_availability": mpr.stock_availability or "Not Available - Purchase Required",
        "preferred_vendor_id": mpr.preferred_vendor_id,
        "remarks": mpr.remarks,
        "status": mpr.status,
        "current_approval_stage": mpr.current_approval_stage or "Project Manager",
        "created_at": mpr.created_at,
        "project_name": mpr.project.name if mpr.project else None,
        "wbs_phase_title": mpr.wbs_phase.title if mpr.wbs_phase else None,
        "wbs_task_title": mpr.wbs_task.title if mpr.wbs_task else None,
        "wbs_subtask_title": mpr.wbs_subtask.title if mpr.wbs_subtask else None
    }
    return m_dict

def enrich_pr_dict(pr: PurchaseRequisition, db: Session) -> dict:
    p_dict = {
        "id": pr.id,
        "req_number": pr.req_number,
        "project_id": pr.project_id,
        "wbs_phase_id": pr.wbs_phase_id,
        "wbs_task_id": pr.wbs_task_id,
        "wbs_subtask_id": pr.wbs_subtask_id,
        "requester_id": pr.requester_id,
        "title": pr.title,
        "item_name": pr.item_name or pr.title,
        "quantity": float(pr.quantity or 0.0),
        "unit": pr.unit,
        "estimated_cost": float(pr.estimated_cost or 0.0),
        "required_date": pr.required_date,
        "reason": pr.reason,
        "source_material_request_id": pr.source_material_request_id,
        "mpr_number": pr.mpr.request_number if pr.mpr else None,
        "status": pr.status,
        "created_at": pr.created_at,
        "project_name": pr.project.name if pr.project else None,
        "wbs_phase_title": pr.wbs_phase.title if pr.wbs_phase else None,
        "wbs_task_title": pr.wbs_task.title if pr.wbs_task else None,
        "wbs_subtask_title": pr.wbs_subtask.title if pr.wbs_subtask else None
    }
    return p_dict

def enrich_po_dict(po: PurchaseOrder, db: Session) -> dict:
    existing_delivs = db.query(MaterialDelivery).filter(MaterialDelivery.po_id == po.id).all()
    received_qty = sum(float(d.received_quantity or 0.0) for d in existing_delivs)
    po_qty = float(po.quantity or 0.0)
    remaining_qty = max(0.0, po_qty - received_qty)

    vnd_resp = None
    if po.vendor:
        vnd_resp = {
            "id": po.vendor.id,
            "code": po.vendor.code,
            "name": po.vendor.name,
            "contact_person": po.vendor.contact_person,
            "email": po.vendor.email,
            "phone": po.vendor.phone,
            "gst_number": po.vendor.gst_number,
            "pan_number": po.vendor.pan_number,
            "rating": float(po.vendor.rating or 5.0),
            "status": po.vendor.status,
            "created_at": po.vendor.created_at
        }

    po_dict = {
        "id": po.id,
        "po_number": po.po_number,
        "pr_id": po.pr_id,
        "mpr_id": po.mpr_id,
        "project_id": po.project_id,
        "wbs_phase_id": po.wbs_phase_id,
        "wbs_task_id": po.wbs_task_id,
        "wbs_subtask_id": po.wbs_subtask_id,
        "vendor_id": po.vendor_id,
        "item_name": po.item_name,
        "quantity": po_qty,
        "unit": po.unit,
        "unit_price": float(po.unit_price or 0.0),
        "delivery_date": po.delivery_date,
        "po_date": po.po_date,
        "expected_delivery_date": po.expected_delivery_date,
        "total_amount": float(po.total_amount or 0.0),
        "payment_terms": po.payment_terms,
        "delivery_terms": po.delivery_terms,
        "remarks": po.remarks,
        "status": po.status,
        "created_at": po.created_at,
        "vendor": vnd_resp,
        "project_name": po.project.name if po.project else None,
        "wbs_phase_title": po.wbs_phase.title if po.wbs_phase else None,
        "wbs_task_title": po.wbs_task.title if po.wbs_task else None,
        "wbs_subtask_title": po.wbs_subtask.title if po.wbs_subtask else None,
        "pr_number": po.pr.req_number if po.pr else None,
        "mpr_number": po.mpr.request_number if po.mpr else (po.pr.mpr.request_number if (po.pr and po.pr.mpr) else None),
        "received_quantity": received_qty,
        "remaining_quantity": remaining_qty
    }
    return po_dict


# 1. Procurement Dashboard KPIs (REAL Database Queries)
@router.get("/kpis")
def get_procurement_kpis(db: Session = Depends(get_db)):
    total_mprs = db.query(MaterialPurchaseRequest).count()
    mprs_converted_to_pr = db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.status == "PR_CREATED").count()
    pending_mprs = db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.status.in_(["SUBMITTED", "PENDING", "PENDING_PM_APPROVAL"])).count()
    completed_mprs = db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.status == "COMPLETED").count()

    total_prs = db.query(PurchaseRequisition).count()
    approved_prs = db.query(PurchaseRequisition).filter(PurchaseRequisition.status == "approved").count()

    pos_issued = db.query(PurchaseOrder).filter(PurchaseOrder.status.in_(["ISSUED", "PARTIALLY DELIVERED", "PARTIALLY_RECEIVED", "FULLY DELIVERED", "COMPLETED"])).count()

    low_stock_count = db.query(Product).filter(Product.stock <= Product.min_stock_alert).count()

    active_vendors = db.query(Vendor).filter(Vendor.status == "active").count()

    proc_entity_types = ["MATERIAL_PURCHASE_REQUEST", "PURCHASE_REQUISITION", "PURCHASE_ORDER", "MATERIAL_DELIVERY"]
    pending_approval_tasks = db.query(ApprovalTask).filter(
        ApprovalTask.status == "pending",
        (ApprovalTask.source_module == "PROCUREMENT") | (ApprovalTask.entity_type.in_(proc_entity_types))
    ).all()

    pending_approvals_count = len(pending_approval_tasks)
    approval_breakdown = {
        "MPR": sum(1 for t in pending_approval_tasks if t.entity_type == "MATERIAL_PURCHASE_REQUEST"),
        "PR": sum(1 for t in pending_approval_tasks if t.entity_type == "PURCHASE_REQUISITION"),
        "PO": sum(1 for t in pending_approval_tasks if t.entity_type == "PURCHASE_ORDER"),
        "GRN": sum(1 for t in pending_approval_tasks if t.entity_type == "MATERIAL_DELIVERY")
    }

    pending_deliveries = db.query(MaterialDelivery).filter(MaterialDelivery.status.in_(["PENDING", "PARTIALLY_RECEIVED", "PARTIALLY DELIVERED"])).count()
    completed_deliveries = db.query(MaterialDelivery).filter(MaterialDelivery.status.in_(["FULLY_RECEIVED", "FULLY DELIVERED", "COMPLETED"])).count()

    total_val_res = db.query(func.sum(PurchaseOrder.total_amount)).scalar()
    total_procurement_value = float(total_val_res or 0.0)

    return {
        "total_mprs": total_mprs,
        "mprs_converted_to_pr": mprs_converted_to_pr,
        "pending_purchase_requests": pending_mprs,
        "completed_mprs": completed_mprs,
        "total_prs": total_prs,
        "prs_created": total_prs,
        "approved_prs": approved_prs,
        "pending_pos": approved_prs,
        "pos_issued": pos_issued,
        "low_stock_count": low_stock_count,
        "active_vendors": active_vendors,
        "pending_approvals": pending_approvals_count,
        "approval_breakdown": approval_breakdown,
        "pending_deliveries": pending_deliveries,
        "completed_deliveries": completed_deliveries,
        "total_procurement_value": total_procurement_value
    }

# Active Vendors Endpoint (Requirement 6)
@router.get("/active-vendors", response_model=List[VendorResponse])
def list_active_vendors(db: Session = Depends(get_db)):
    return db.query(Vendor).filter(Vendor.status == "active").order_by(Vendor.code.asc()).all()


# 2. Material Purchase Requests (MPR) Endpoints (Requirement 1 & 2)
@router.get("/material-requests", response_model=List[MaterialPurchaseRequestResponse])
def list_material_purchase_requests(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(MaterialPurchaseRequest).order_by(MaterialPurchaseRequest.created_at.desc())
    if status:
        query = query.filter(MaterialPurchaseRequest.status == status)
    mprs = query.all()
    return [enrich_mpr_dict(m, db) for m in mprs]

@router.get("/approved-mprs", response_model=List[MaterialPurchaseRequestResponse])
def list_approved_mprs(db: Session = Depends(get_db)):
    mprs = db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.status.in_(["APPROVED_BY_PM", "SUBMITTED", "APPROVED"])).order_by(MaterialPurchaseRequest.created_at.desc()).all()
    return [enrich_mpr_dict(m, db) for m in mprs]

@router.post("/material-requests", response_model=MaterialPurchaseRequestResponse)
def create_material_purchase_request(
    mpr_in: MaterialPurchaseRequestCreate, 
    user_id: int = 1,
    role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == mpr_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Selected Project not found")

    if mpr_in.wbs_phase_id:
        phase = db.query(WbsTask).filter(WbsTask.id == mpr_in.wbs_phase_id, WbsTask.project_id == mpr_in.project_id).first()
        if not phase:
            raise HTTPException(status_code=400, detail="Invalid WBS Phase selected for this Project")

    if mpr_in.wbs_task_id:
        task = db.query(WbsTask).filter(WbsTask.id == mpr_in.wbs_task_id, WbsTask.project_id == mpr_in.project_id).first()
        if not task:
            raise HTTPException(status_code=400, detail="Invalid WBS Task selected for this Project")

    if mpr_in.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    # Auto Cost Calculation (Requirement 2)
    if mpr_in.estimated_unit_rate is not None and mpr_in.estimated_unit_rate > 0:
        est_cost = round(float(mpr_in.quantity) * float(mpr_in.estimated_unit_rate), 2)
    else:
        est_cost = round(float(mpr_in.estimated_cost or 0.0), 2)

    # Reference Number Generator (e.g. MPR-0001)
    count = db.query(MaterialPurchaseRequest).count()
    mpr_code = f"MPR-{(count + 1):04d}"

    mpr = MaterialPurchaseRequest(
        request_number=mpr_code,
        project_id=mpr_in.project_id,
        wbs_phase_id=mpr_in.wbs_phase_id,
        wbs_task_id=mpr_in.wbs_task_id,
        wbs_subtask_id=mpr_in.wbs_subtask_id,
        requested_by=user_id,
        material_name=mpr_in.material_name,
        material_category=mpr_in.material_category or "General Construction",
        quantity=mpr_in.quantity,
        unit=mpr_in.unit,
        required_date=mpr_in.required_date,
        estimated_unit_rate=mpr_in.estimated_unit_rate,
        estimated_cost=est_cost,
        reason=mpr_in.reason,
        stock_availability=mpr_in.stock_availability or "Not Available - Purchase Required",
        preferred_vendor_id=mpr_in.preferred_vendor_id,
        remarks=mpr_in.remarks,
        status="SUBMITTED",
        current_approval_stage="Project Manager"
    )
    db.add(mpr)
    db.commit()
    db.refresh(mpr)

    # Create Approval Task
    task_title = f"MPR {mpr_code}: {mpr.material_name} ({mpr.quantity} {mpr.unit}) - ₹{mpr.estimated_cost}"
    approval_task = ApprovalTask(
        title=task_title,
        entity_type="MATERIAL_PURCHASE_REQUEST",
        entity_id=mpr.id,
        requester_id=user_id,
        current_stage="Project Manager",
        status="pending",
        request_type="MATERIAL_PURCHASE_REQUEST",
        request_category="NON_FINANCIAL",
        source_module="PROCUREMENT"
    )
    db.add(approval_task)

    audit = AuditLog(
        user_id=user_id, 
        action="SUBMIT_MPR", 
        entity_type="MaterialPurchaseRequest", 
        entity_id=mpr.id, 
        payload=f"Submitted MPR {mpr_code} for Project #{mpr.project_id} WBS Task #{mpr.wbs_task_id}"
    )
    db.add(audit)

    db.commit()
    db.refresh(mpr)
    return enrich_mpr_dict(mpr, db)

@router.post("/material-requests/{mpr_id}/pm-action")
def process_mpr_pm_action(
    mpr_id: int, 
    action_in: MaterialPurchaseRequestPmAction,
    approver_id: int = 1,
    role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    mpr = db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.id == mpr_id).first()
    if not mpr:
        raise HTTPException(status_code=404, detail="Material Purchase Request not found.")

    task = db.query(ApprovalTask).filter(
        ApprovalTask.entity_type == "MATERIAL_PURCHASE_REQUEST",
        ApprovalTask.entity_id == mpr.id
    ).first()

    act = action_in.action.upper()
    if act == "APPROVE":
        mpr.status = "APPROVED_BY_PM"
        mpr.current_approval_stage = "PROCUREMENT"
        if task:
            task.status = "approved"
            task.current_stage = "Procurement"
        audit_act = "APPROVE_MPR"
        msg = "Material Purchase Request approved by Project Manager and sent to Procurement."
    elif act == "REJECT":
        mpr.status = "REJECTED"
        if task:
            task.status = "rejected"
        audit_act = "REJECT_MPR"
        msg = "Material Purchase Request rejected by Project Manager."
    elif act == "SEND_BACK":
        mpr.status = "RETURNED"
        mpr.current_approval_stage = "Site Engineer"
        if task:
            task.status = "sent_back"
            task.current_stage = "Site Engineer"
        audit_act = "RETURN_MPR"
        msg = "Material Purchase Request returned to Site Engineer for revision."
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Must be APPROVE, REJECT, or SEND_BACK.")

    audit = AuditLog(user_id=approver_id, action=audit_act, entity_type="MaterialPurchaseRequest", entity_id=mpr.id, payload=f"PM action '{act}' on MPR {mpr.request_number}. Comments: {action_in.comments or 'None'}")
    db.add(audit)

    db.commit()
    db.refresh(mpr)
    return {"message": msg, "status": mpr.status, "current_stage": mpr.current_approval_stage}


# 3. Create MPR from Low Stock Inventory Item
@router.post("/create-low-stock-mpr/{product_id}")
def create_low_stock_mpr(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Inventory Item not found.")

    project = db.query(Project).first()
    proj_id = project.id if project else 1

    wbs_task = db.query(WbsTask).filter(WbsTask.project_id == proj_id).first()
    phase_id = wbs_task.id if wbs_task else None

    reorder_qty = max(50, (product.min_stock_alert * 2) - product.stock)
    unit_rate = float(product.price or product.cost or 100.0)
    est_cost = round(unit_rate * reorder_qty, 2)

    count = db.query(MaterialPurchaseRequest).count()
    mpr_code = f"MPR-{(count + 1):04d}"
    mpr = MaterialPurchaseRequest(
        request_number=mpr_code,
        project_id=proj_id,
        wbs_phase_id=phase_id,
        requested_by=1,
        material_name=product.name,
        material_category=product.category or "General Construction",
        quantity=reorder_qty,
        unit="unit",
        required_date=datetime.utcnow(),
        estimated_unit_rate=unit_rate,
        estimated_cost=est_cost,
        reason=f"AUTOMATIC REORDER TRIGGER: Current Stock ({product.stock}) <= Reorder Threshold ({product.min_stock_alert})",
        stock_availability="LOW_STOCK_REORDER",
        status="APPROVED_BY_PM",
        current_approval_stage="PROCUREMENT"
    )
    db.add(mpr)
    db.commit()
    db.refresh(mpr)

    audit = AuditLog(user_id=1, action="LOW_STOCK_REORDER_MPR", entity_type="MaterialPurchaseRequest", entity_id=mpr.id, payload=f"Triggered Low Stock MPR {mpr_code} for Product {product.name}")
    db.add(audit)
    db.commit()

    return {"message": f"Successfully created Low Stock MPR {mpr_code} for {product.name}", "mpr": enrich_mpr_dict(mpr, db)}


# 4. Purchase Requisition (PR) Endpoints (Requirement 3)
@router.get("/pr", response_model=List[PurchaseRequisitionResponse])
def list_purchase_requisitions(db: Session = Depends(get_db)):
    prs = db.query(PurchaseRequisition).order_by(PurchaseRequisition.created_at.desc()).all()
    return [enrich_pr_dict(p, db) for p in prs]

@router.get("/approved-prs", response_model=List[PurchaseRequisitionResponse])
def list_approved_purchase_requisitions(db: Session = Depends(get_db)):
    # Return PRs eligible for PO creation (Requirement 5)
    prs = db.query(PurchaseRequisition).filter(
        PurchaseRequisition.status.in_(["approved", "APPROVED"])
    ).order_by(PurchaseRequisition.created_at.desc()).all()
    return [enrich_pr_dict(p, db) for p in prs]

@router.post("/pr", response_model=PurchaseRequisitionResponse)
def create_purchase_requisition(pr_in: PurchaseRequisitionCreate, requester_id: int = 1, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == pr_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    mpr = None
    if pr_in.source_material_request_id:
        mpr = db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.id == pr_in.source_material_request_id).first()
        if not mpr:
            raise HTTPException(status_code=404, detail="Source Material Purchase Request not found.")
        if mpr.status in ["REJECTED", "CANCELLED"]:
            raise HTTPException(status_code=400, detail="Cannot create PR from a cancelled or rejected MPR.")

    # Carry forward WBS and Material details from MPR if linked
    wbs_phase_id = pr_in.wbs_phase_id or (mpr.wbs_phase_id if mpr else None)
    wbs_task_id = pr_in.wbs_task_id or (mpr.wbs_task_id if mpr else None)
    wbs_subtask_id = pr_in.wbs_subtask_id or (mpr.wbs_subtask_id if mpr else None)
    item_name = pr_in.item_name or (mpr.material_name if mpr else pr_in.title)
    qty = pr_in.quantity or (mpr.quantity if mpr else 1.0)
    unit = pr_in.unit or (mpr.unit if mpr else "unit")
    est_cost = pr_in.estimated_cost or (mpr.estimated_cost if mpr else 0.0)
    req_date = pr_in.required_date or (mpr.required_date if mpr else datetime.utcnow())

    count = db.query(PurchaseRequisition).count()
    req_code = f"PR-{(count + 1):04d}"

    pr = PurchaseRequisition(
        req_number=req_code,
        project_id=pr_in.project_id,
        wbs_phase_id=wbs_phase_id,
        wbs_task_id=wbs_task_id,
        wbs_subtask_id=wbs_subtask_id,
        requester_id=requester_id,
        title=pr_in.title,
        item_name=item_name,
        quantity=qty,
        unit=unit,
        estimated_cost=est_cost,
        required_date=req_date,
        reason=pr_in.reason or (mpr.reason if mpr else None),
        source_material_request_id=pr_in.source_material_request_id,
        status="approved"
    )
    db.add(pr)

    if mpr:
        mpr.status = "PR_CREATED"

    db.flush()

    audit = AuditLog(
        user_id=requester_id, 
        action="CREATE_PR", 
        entity_type="PurchaseRequisition", 
        entity_id=pr.id, 
        payload=f"Created PR {req_code} for Project #{pr.project_id} (Carried forward from MPR #{mpr.request_number if mpr else 'None'})"
    )
    db.add(audit)

    db.commit()
    db.refresh(pr)
    return enrich_pr_dict(pr, db)

@router.post("/pr/{pr_id}/approve")
def approve_purchase_requisition(pr_id: int, db: Session = Depends(get_db)):
    pr = db.query(PurchaseRequisition).filter(PurchaseRequisition.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase Requisition not found.")
    pr.status = "approved"
    db.commit()
    return {"message": f"PR {pr.req_number} marked as approved.", "pr": enrich_pr_dict(pr, db)}


# 5. Purchase Order (PO) Endpoints (Requirement 4, 5, 6, 7, 8, 9)
@router.get("/po", response_model=List[PurchaseOrderResponse])
def list_purchase_orders(db: Session = Depends(get_db)):
    pos = db.query(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).all()
    return [enrich_po_dict(p, db) for p in pos]

@router.post("/po", response_model=PurchaseOrderResponse)
def create_purchase_order(po_in: PurchaseOrderCreate, db: Session = Depends(get_db)):
    # 1. Require Approved PR (Requirement 4, 5, 12)
    if not po_in.pr_id:
        raise HTTPException(status_code=400, detail="A Purchase Order must be generated from an Approved PR.")
    
    pr = db.query(PurchaseRequisition).filter(PurchaseRequisition.id == po_in.pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Selected Purchase Requisition not found.")
    
    if pr.status.lower() not in ["approved"]:
        raise HTTPException(status_code=400, detail=f"Selected PR #{pr.req_number} is not approved (Current status: {pr.status}). Only Approved PRs can generate a PO.")

    # 2. Validate Active Vendor (Requirement 6, 12)
    vendor = db.query(Vendor).filter(Vendor.id == po_in.vendor_id, Vendor.status == "active").first()
    if not vendor:
        raise HTTPException(status_code=400, detail="Assigned Vendor not found or inactive. Please select an active vendor.")

    # 3. Data Validation for Qty & Price (Requirement 7, 12)
    po_qty = float(po_in.quantity if po_in.quantity is not None else (pr.quantity or 0.0))
    if po_qty <= 0:
        raise HTTPException(status_code=400, detail="PO Quantity must be greater than zero.")

    unit_price = float(po_in.unit_price if po_in.unit_price is not None else 0.0)
    if unit_price < 0:
        raise HTTPException(status_code=400, detail="Unit Price cannot be negative.")

    # 4. Auto Calculation (Requirement 7)
    total_amount = round(po_qty * unit_price, 2)

    # 5. Populate derived relationships from Approved PR (Requirement 5 & 8)
    project_id = pr.project_id
    wbs_phase_id = pr.wbs_phase_id
    wbs_task_id = pr.wbs_task_id
    wbs_subtask_id = pr.wbs_subtask_id
    mpr_id = pr.source_material_request_id
    item_name = po_in.item_name or pr.item_name or pr.title
    unit = po_in.unit or pr.unit or "unit"

    count = db.query(PurchaseOrder).count()
    po_code = f"PO-{(count + 1):04d}"

    po = PurchaseOrder(
        po_number=po_code,
        pr_id=pr.id,
        mpr_id=mpr_id,
        project_id=project_id,
        wbs_phase_id=wbs_phase_id,
        wbs_task_id=wbs_task_id,
        wbs_subtask_id=wbs_subtask_id,
        vendor_id=vendor.id,
        item_name=item_name,
        quantity=po_qty,
        unit=unit,
        unit_price=unit_price,
        total_amount=total_amount,
        po_date=po_in.po_date or datetime.utcnow(),
        expected_delivery_date=po_in.expected_delivery_date or po_in.delivery_date,
        delivery_date=po_in.expected_delivery_date or po_in.delivery_date,
        payment_terms=po_in.payment_terms,
        delivery_terms=po_in.delivery_terms,
        remarks=po_in.remarks,
        created_by_id=1,
        status="ISSUED"
    )
    db.add(po)

    # Update PR status
    pr.status = "po_created"

    # Update MPR status if linked
    if mpr_id:
        mpr = db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.id == mpr_id).first()
        if mpr:
            mpr.status = "PO_ISSUED"

    db.flush()

    audit = AuditLog(
        user_id=1, 
        action="CREATE_PO", 
        entity_type="PurchaseOrder", 
        entity_id=po.id, 
        payload=f"Generated PO {po_code} from PR #{pr.req_number} for Vendor {vendor.name}. Qty: {po_qty} {unit} @ ₹{unit_price} = ₹{total_amount}"
    )
    db.add(audit)

    db.commit()
    db.refresh(po)
    return enrich_po_dict(po, db)


# 6. Material Deliveries Endpoints (GRN & Auto Inventory Update - Requirement 10 & 12)
@router.get("/deliveries", response_model=List[MaterialDeliveryResponse])
def list_material_deliveries(db: Session = Depends(get_db)):
    delivs = db.query(MaterialDelivery).order_by(MaterialDelivery.created_at.desc()).all()
    res = []
    for d in delivs:
        d_dict = {
            "id": d.id,
            "delivery_code": d.delivery_code,
            "po_id": d.po_id,
            "vendor_id": d.vendor_id,
            "project_id": d.project_id,
            "material_name": d.material_name,
            "ordered_quantity": float(d.ordered_quantity or 0.0),
            "received_quantity": float(d.received_quantity or 0.0),
            "delivery_date": d.delivery_date,
            "delivery_location": d.delivery_location,
            "status": d.status,
            "inspection_remarks": d.inspection_remarks,
            "created_at": d.created_at,
            "po_number": d.po.po_number if d.po else None,
            "vendor_name": d.vendor.name if d.vendor else None,
            "project_name": d.project.name if d.project else None
        }
        res.append(d_dict)
    return res

@router.post("/deliveries", response_model=MaterialDeliveryResponse)
def record_material_delivery(del_in: MaterialDeliveryCreate, db: Session = Depends(get_db)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == del_in.po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")

    recd_qty = float(del_in.received_quantity or 0.0)
    if recd_qty <= 0:
        raise HTTPException(status_code=400, detail="Received Quantity must be greater than zero.")

    # Cumulative Received & Remaining Qty calculation (Requirement 10, 12)
    existing_deliveries = db.query(MaterialDelivery).filter(MaterialDelivery.po_id == po.id).all()
    prior_received = sum(float(d.received_quantity or 0) for d in existing_deliveries)
    po_qty = float(po.quantity or 0.0)
    remaining_qty = max(0.0, po_qty - prior_received)

    if recd_qty > remaining_qty + 0.0001:
        raise HTTPException(
            status_code=400, 
            detail=f"Received quantity ({recd_qty}) exceeds remaining PO quantity ({remaining_qty}). Total PO Qty: {po_qty}, Prior Recd: {prior_received}."
        )

    new_cumulative = prior_received + recd_qty

    # PO Status Progression (Requirement 9 & 10)
    if new_cumulative >= po_qty:
        del_status = "FULLY_DELIVERED"
        po.status = "COMPLETED"
        if po.mpr_id:
            mpr = db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.id == po.mpr_id).first()
            if mpr:
                mpr.status = "COMPLETED"
    else:
        del_status = "PARTIALLY_DELIVERED"
        po.status = "PARTIALLY DELIVERED"

    count = db.query(MaterialDelivery).count()
    del_code = f"GRN-{(count + 1):04d}"

    delivery = MaterialDelivery(
        delivery_code=del_code,
        po_id=po.id,
        vendor_id=po.vendor_id,
        project_id=po.project_id,
        material_name=po.item_name or "Material Order",
        ordered_quantity=po.quantity or 0.0,
        received_quantity=recd_qty,
        delivery_date=del_in.delivery_date or datetime.utcnow(),
        delivery_location=del_in.delivery_location or "Project Site Yard",
        status=del_status,
        inspection_remarks=del_in.inspection_remarks
    )
    db.add(delivery)

    # AUTOMATIC INVENTORY STOCK UPDATE (Requirement 10 & 11)
    matching_product = db.query(Product).filter(Product.name.ilike(f"%{po.item_name}%")).first()
    if not matching_product and po.item_name:
        sku_code = f"MAT-{uuid.uuid4().hex[:6].upper()}"
        matching_product = Product(
            sku=sku_code,
            name=po.item_name,
            category="Construction Materials",
            price=float(po.unit_price or 100.0),
            cost=float(po.unit_price or 100.0),
            stock=int(recd_qty),
            min_stock_alert=10
        )
        db.add(matching_product)
    elif matching_product:
        matching_product.stock += int(recd_qty)

    db.flush()

    audit = AuditLog(
        user_id=1, 
        action="RECORD_DELIVERY", 
        entity_type="MaterialDelivery", 
        entity_id=delivery.id, 
        payload=f"Recorded GRN {del_code} for PO #{po.po_number}: Recd {recd_qty} units (Remaining: {max(0.0, po_qty - new_cumulative)}). Inventory stock auto-updated."
    )
    db.add(audit)

    db.commit()
    db.refresh(delivery)

    res_dict = {
        "id": delivery.id,
        "delivery_code": delivery.delivery_code,
        "po_id": delivery.po_id,
        "vendor_id": delivery.vendor_id,
        "project_id": delivery.project_id,
        "material_name": delivery.material_name,
        "ordered_quantity": float(delivery.ordered_quantity or 0.0),
        "received_quantity": float(delivery.received_quantity or 0.0),
        "delivery_date": delivery.delivery_date,
        "delivery_location": delivery.delivery_location,
        "status": delivery.status,
        "inspection_remarks": delivery.inspection_remarks,
        "created_at": delivery.created_at,
        "po_number": po.po_number,
        "vendor_name": po.vendor.name if po.vendor else None,
        "project_name": po.project.name if po.project else None
    }
    return res_dict


# 7. Complete Procurement History & Traceability Chain (Requirement 11 & 14)
@router.get("/history")
def get_procurement_history(db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter(
        AuditLog.entity_type.in_(["PurchaseOrder", "PurchaseRequisition", "MaterialPurchaseRequest", "MaterialDelivery"])
    ).order_by(AuditLog.created_at.desc()).all()

    res = []
    for l in logs:
        usr = db.query(User).filter(User.id == l.user_id).first() if l.user_id else None
        res.append({
            "id": l.id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "payload": l.payload,
            "user_name": usr.full_name if usr else "System",
            "user_role": usr.role if usr else "system",
            "created_at": l.created_at
        })
    return res

@router.get("/traceability")
def get_procurement_traceability_chain(db: Session = Depends(get_db)):
    mprs = db.query(MaterialPurchaseRequest).order_by(MaterialPurchaseRequest.created_at.desc()).all()
    chain = []
    for m in mprs:
        prs = db.query(PurchaseRequisition).filter(PurchaseRequisition.source_material_request_id == m.id).all()
        if not prs:
            chain.append({
                "mpr_number": m.request_number,
                "project_name": m.project.name if m.project else "N/A",
                "wbs_path": f"{m.wbs_phase.title if m.wbs_phase else 'N/A'} ➔ {m.wbs_task.title if m.wbs_task else 'N/A'}",
                "material_name": m.material_name,
                "mpr_status": m.status,
                "pr_number": "None",
                "pr_status": "N/A",
                "po_number": "None",
                "vendor_name": "N/A",
                "po_status": "N/A",
                "deliveries_count": 0,
                "total_received": 0.0
            })
        else:
            for pr in prs:
                pos = db.query(PurchaseOrder).filter(PurchaseOrder.pr_id == pr.id).all()
                if not pos:
                    chain.append({
                        "mpr_number": m.request_number,
                        "project_name": m.project.name if m.project else "N/A",
                        "wbs_path": f"{m.wbs_phase.title if m.wbs_phase else 'N/A'} ➔ {m.wbs_task.title if m.wbs_task else 'N/A'}",
                        "material_name": m.material_name,
                        "mpr_status": m.status,
                        "pr_number": pr.req_number,
                        "pr_status": pr.status,
                        "po_number": "None",
                        "vendor_name": "N/A",
                        "po_status": "N/A",
                        "deliveries_count": 0,
                        "total_received": 0.0
                    })
                else:
                    for po in pos:
                        delivs = db.query(MaterialDelivery).filter(MaterialDelivery.po_id == po.id).all()
                        chain.append({
                            "mpr_number": m.request_number,
                            "project_name": m.project.name if m.project else "N/A",
                            "wbs_path": f"{m.wbs_phase.title if m.wbs_phase else 'N/A'} ➔ {m.wbs_task.title if m.wbs_task else 'N/A'}",
                            "material_name": m.material_name,
                            "mpr_status": m.status,
                            "pr_number": pr.req_number,
                            "pr_status": pr.status,
                            "po_number": po.po_number,
                            "vendor_name": po.vendor.name if po.vendor else "N/A",
                            "po_status": po.status,
                            "deliveries_count": len(delivs),
                            "total_received": sum(float(d.received_quantity or 0.0) for d in delivs)
                        })
    return chain

