from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from app.database import get_db
from app.models import SalesOrder, OrderItem, Product, Customer
from app.schemas import SalesOrderCreate, SalesOrderResponse

router = APIRouter(prefix="/api/sales", tags=["Sales"])

@router.get("/orders", response_model=List[SalesOrderResponse])
def list_sales_orders(db: Session = Depends(get_db)):
    return db.query(SalesOrder).order_by(SalesOrder.order_date.desc()).all()

@router.post("/orders", response_model=SalesOrderResponse)
def create_sales_order(order_in: SalesOrderCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == order_in.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    order_num = f"SO-{uuid.uuid4().hex[:8].upper()}"
    total_calc = 0.0

    order_items = []
    for item in order_in.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product ID {item.product_id} not found")
        if product.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for product {product.name}")

        item_total = float(item.unit_price) * item.quantity
        total_calc += item_total
        
        # Deduct stock
        product.stock -= item.quantity
        
        order_items.append(
            OrderItem(
                product_id=product.id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                total_price=item_total
            )
        )

    order = SalesOrder(
        order_number=order_num,
        customer_id=order_in.customer_id,
        total_amount=total_calc,
        status=order_in.status or "completed",
        items=order_items
    )

    db.add(order)
    db.commit()
    db.refresh(order)
    return order
