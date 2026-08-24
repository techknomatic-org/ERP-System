from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Notification
from app.schemas import NotificationCreate, NotificationResponse

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("/user/{user_id}", response_model=List[NotificationResponse])
def get_user_notifications(user_id: int, db: Session = Depends(get_db)):
    return db.query(Notification).filter(Notification.user_id == user_id).order_by(Notification.created_at.desc()).all()

@router.post("/", response_model=NotificationResponse)
def create_notification(notif_in: NotificationCreate, db: Session = Depends(get_db)):
    notif = Notification(**notif_in.model_dump())
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif

@router.put("/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}
