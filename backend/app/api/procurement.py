from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import uuid
from datetime import datetime
from app.database import get_db
from app.models import PurchaseRequisition, PurchaseOrder, Project, Vendor, ApprovalTask, AuditLog, Notification, MaterialPurchaseRequest, MaterialDelivery, User
from app.schemas import (
    PurchaseRequisitionCreate, PurchaseRequisitionResponse,
    PurchaseOrderCreate, PurchaseOrderResponse,
    MaterialPurchaseRequestCreate, MaterialPurchaseRequestResponse, MaterialPurchaseRequestPmAction,
    MaterialDeliveryCreate, MaterialDeliveryResponse
)

router = APIRouter(prefix="/api/procurement", tags=["Procurement Portal & Workflows"])

# Procurement Dashboard KPIs
@router.get("/kpis")
def get_procurement_kpis(db: Session = Depends(get_db)):
    pending_mprs = db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.status == "APPROVED_BY_PM").count()
    prs_created = db.query(PurchaseRequisition).count()
    pending_prs = db.query(PurchaseRequisition).filter(PurchaseRequisition.status == "approved").count()
    pos_issued = db.query(PurchaseOrder).count()
    pending_deliveries = db.query(MaterialDelivery).filter(MaterialDelivery.status.in_(["PENDING", "PARTIALLY_RECEIVED"])).count()
    completed_deliveries = db.query(MaterialDelivery).filter(MaterialDelivery.status == "FULLY_RECEIVED").count()
    
    total_val_res = db.query(func.sum(PurchaseOrder.total_amount)).scalar()
    total_procurement_value = float(total_val_res or 0.0)

    return {
        "pending_purchase_requests": pending_mprs,
        "prs_created": prs_created,
        "pending_pos": pending_prs,
        "pos_issued": pos_issued,
        "pending_deliveries": pending_deliveries,
        "completed_deliveries": completed_deliveries,
        "total_procurement_value": total_procurement_value
    }

# Material Purchase Requests (MPR) Endpoints
@router.get("/material-requests", response_model=List[MaterialPurchaseRequestResponse])
def list_material_purchase_requests(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(MaterialPurchaseRequest).order_by(MaterialPurchaseRequest.created_at.desc())
    if status:
        query = query.filter(MaterialPurchaseRequest.status == status)
    return query.all()

@router.get("/approved-mprs", response_model=List[MaterialPurchaseRequestResponse])
def list_approved_mprs(db: Session = Depends(get_db)):
    return db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.status == "APPROVED_BY_PM").order_by(MaterialPurchaseRequest.created_at.desc()).all()

@router.post("/material-requests", response_model=MaterialPurchaseRequestResponse)
def create_material_purchase_request(
    mpr_in: MaterialPurchaseRequestCreate, 
    user_id: int = 1,
    role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == mpr_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    mpr_code = f"MPR-{uuid.uuid4().hex[:8].upper()}"
    mpr = MaterialPurchaseRequest(
        request_number=mpr_code,
        project_id=mpr_in.project_id,
        requested_by=user_id,
        material_name=mpr_in.material_name,
        material_category=mpr_in.material_category or "General Construction",
        quantity=mpr_in.quantity,
        unit=mpr_in.unit,
        required_date=mpr_in.required_date,
        reason=mpr_in.reason,
        estimated_cost=mpr_in.estimated_cost,
        stock_availability=mpr_in.stock_availability or "Not Available - Purchase Required",
        preferred_vendor_id=mpr_in.preferred_vendor_id,
        remarks=mpr_in.remarks,
        status="PENDING_PM_APPROVAL",
        current_approval_stage="Project Manager"
    )
    db.add(mpr)
    db.commit()
    db.refresh(mpr)

    # Submit Approval Task for PM
    task = ApprovalTask(
        title=f"Material Purchase Request #{mpr.material_name} ({mpr.quantity} {mpr.unit}) - ${mpr.estimated_cost}",
        entity_type="MATERIAL_PURCHASE_REQUEST",
        entity_id=mpr.id,
        requester_id=user_id,
        current_stage="Project Manager",
        status="pending",
        request_type="MATERIAL_PURCHASE_REQUEST",
        request_category="NON_FINANCIAL",
        source_module="PROCUREMENT"
    )
    db.add(task)

    audit = AuditLog(user_id=user_id, action="SUBMIT_MPR", entity_type="MaterialPurchaseRequest", entity_id=mpr.id, payload=f"Submitted MPR {mpr_code} for Project #{mpr.project_id}")
    db.add(audit)

    db.commit()
    db.refresh(mpr)
    return mpr

@router.post("/material-requests/{mpr_id}/pm-action")
def process_mpr_pm_action(
    mpr_id: int, 
    action_in: MaterialPurchaseRequestPmAction,
    approver_id: int = 1,
    role: Optional[str] = Header(None, alias="X-User-Role"),
    db: Session = Depends(get_db)
):
    user_role = (role or "project_manager").lower()
    if user_role not in ["project_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Only Project Manager or System Admin is authorized to process PM approval on Material Purchase Requests.")

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

# PR Endpoints
@router.get("/pr", response_model=List[PurchaseRequisitionResponse])
def list_purchase_requisitions(db: Session = Depends(get_db)):
    return db.query(PurchaseRequisition).order_by(PurchaseRequisition.created_at.desc()).all()

@router.get("/approved-prs", response_model=List[PurchaseRequisitionResponse])
def list_approved_purchase_requisitions(db: Session = Depends(get_db)):
    return db.query(PurchaseRequisition).filter(PurchaseRequisition.status == "approved").order_by(PurchaseRequisition.created_at.desc()).all()

@router.post("/pr", response_model=PurchaseRequisitionResponse)
def create_purchase_requisition(pr_in: PurchaseRequisitionCreate, requester_id: int = 1, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == pr_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    req_code = f"PR-{uuid.uuid4().hex[:8].upper()}"
    pr = PurchaseRequisition(
        req_number=req_code,
        project_id=pr_in.project_id,
        requester_id=requester_id,
        title=pr_in.title,
        item_name=pr_in.item_name or pr_in.title,
        quantity=pr_in.quantity,
        unit=pr_in.unit,
        estimated_cost=pr_in.estimated_cost,
        required_date=pr_in.required_date,
        reason=pr_in.reason,
        source_material_request_id=pr_in.source_material_request_id,
        status="approved" # Created by Procurement user from approved request
    )
    db.add(pr)

    if pr_in.source_material_request_id:
        mpr = db.query(MaterialPurchaseRequest).filter(MaterialPurchaseRequest.id == pr_in.source_material_request_id).first()
        if mpr:
            mpr.status = "PR_CREATED"

    db.flush()

    audit = AuditLog(user_id=requester_id, action="CREATE_PR", entity_type="PurchaseRequisition", entity_id=pr.id, payload=f"Created PR {req_code} for Project #{pr.project_id}")
    db.add(audit)

    db.commit()
    db.refresh(pr)
    return pr

# PO Endpoints
@router.get("/po", response_model=List[PurchaseOrderResponse])
def list_purchase_orders(db: Session = Depends(get_db)):
    return db.query(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).all()

@router.post("/po", response_model=PurchaseOrderResponse)
def create_purchase_order(po_in: PurchaseOrderCreate, db: Session = Depends(get_db)):
    # Validate Vendor exists
    vendor = db.query(Vendor).filter(Vendor.id == po_in.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=400, detail="Assigned Vendor not found. Please select a valid vendor.")

    # Validate PR approval if pr_id is provided
    if po_in.pr_id:
        pr = db.query(PurchaseRequisition).filter(PurchaseRequisition.id == po_in.pr_id).first()
        if not pr:
            raise HTTPException(status_code=404, detail="Selected Purchase Requisition not found.")
        if pr.status not in ["approved", "po_created"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot generate Purchase Order: Selected PR #{pr.req_number} has status '{pr.status}'. Only APPROVED PRs can be converted into a Purchase Order."
            )
        pr.status = "po_created"

    po_code = f"PO-{uuid.uuid4().hex[:8].upper()}"
    po = PurchaseOrder(
        po_number=po_code,
        pr_id=po_in.pr_id,
        project_id=po_in.project_id,
        vendor_id=po_in.vendor_id,
        item_name=po_in.item_name,
        quantity=po_in.quantity,
        unit_price=po_in.unit_price,
        delivery_date=po_in.delivery_date,
        total_amount=po_in.total_amount,
        status=po_in.status or "ISSUED"
    )
    db.add(po)
    db.flush()

    audit = AuditLog(user_id=1, action="CREATE_PO", entity_type="PurchaseOrder", entity_id=po.id, payload=f"Generated PO {po_code} for Vendor #{vendor.name} Amount: ${po.total_amount}")
    db.add(audit)

    db.commit()
    db.refresh(po)
    return po

# Material Deliveries Endpoints
@router.get("/deliveries", response_model=List[MaterialDeliveryResponse])
def list_material_deliveries(db: Session = Depends(get_db)):
    return db.query(MaterialDelivery).order_by(MaterialDelivery.created_at.desc()).all()

@router.post("/deliveries", response_model=MaterialDeliveryResponse)
def record_material_delivery(del_in: MaterialDeliveryCreate, db: Session = Depends(get_db)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == del_in.po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found.")

    del_code = f"DEL-{uuid.uuid4().hex[:8].upper()}"
    delivery = MaterialDelivery(
        delivery_code=del_code,
        po_id=po.id,
        vendor_id=po.vendor_id,
        project_id=po.project_id,
        material_name=po.item_name or "Material Order",
        ordered_quantity=po.quantity or 0.0,
        received_quantity=del_in.received_quantity,
        delivery_date=del_in.delivery_date or datetime.utcnow(),
        delivery_location=del_in.delivery_location or "Project Site Yard",
        status=del_in.status or "FULLY_RECEIVED",
        inspection_remarks=del_in.inspection_remarks
    )
    db.add(delivery)

    # Update PO status if fully received or partially received
    if del_in.status == "FULLY_RECEIVED" or del_in.received_quantity >= (po.quantity or 0.0):
        po.status = "RECEIVED"
    elif del_in.status == "PARTIALLY_RECEIVED":
        po.status = "PARTIALLY_RECEIVED"

    db.flush()

    audit = AuditLog(user_id=1, action="RECORD_DELIVERY", entity_type="MaterialDelivery", entity_id=delivery.id, payload=f"Recorded Delivery {del_code} for PO #{po.po_number}: Recd {del_in.received_quantity} units.")
    db.add(audit)

    db.commit()
    db.refresh(delivery)
    return delivery

# Procurement Audit History
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
