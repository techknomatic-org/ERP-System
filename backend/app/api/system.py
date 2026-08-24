from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.config import settings

router = APIRouter(prefix="/api/system", tags=["System"])

@router.get("/health")
def system_health(db: Session = Depends(get_db)):
    db_connected = False
    db_error = None
    try:
        db.execute(text("SELECT 1"))
        db_connected = True
    except Exception as e:
        db_error = str(e)

    return {
        "status": "online" if db_connected else "degraded",
        "app_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": {
            "type": "MySQL",
            "host": settings.DB_HOST,
            "port": settings.DB_PORT,
            "name": settings.DB_NAME,
            "connected": db_connected,
            "error": db_error
        }
    }
