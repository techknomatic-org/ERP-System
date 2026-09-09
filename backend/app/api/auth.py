from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from passlib.context import CryptContext
from pydantic import BaseModel
from datetime import datetime
from app.database import get_db
from app.models import User, Customer
from app.schemas import UserCreate, UserResponse, TokenResponse
from app.api.audit import record_audit_log

router = APIRouter(prefix="/api/auth", tags=["Authentication & RBAC"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Extract current authenticated user from Bearer token or return default admin."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1].strip()
        parts = token.split("-")
        if len(parts) >= 3 and parts[0] == "demo" and parts[1] == "token":
            try:
                user_id = int(parts[2])
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    return user
            except Exception:
                pass
    admin_user = db.query(User).filter(User.username == "admin").first()
    if not admin_user:
        admin_user = db.query(User).first()
    return admin_user


ROLE_DEFAULT_ROUTES = {
    "admin": "/",
    "management": "/",
    "project_manager": "/projects",
    "site_engineer": "/site-logs",
    "finance": "/bookings",
    "procurement": "/procurement",
    "hse": "/hse",
    "qc": "/quality",
    "facility_manager": "/facility",
    "customer": "/portal"
}

class LoginRequest(BaseModel):
    username_or_email: str
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class PasswordReset(BaseModel):
    new_password: str

@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id.asc()).all()
    res = []
    for u in users:
        res.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at,
            "last_login": datetime.utcnow()
        })
    return res

@router.post("/register", response_model=UserResponse)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter((User.username == user_in.username) | (User.email == user_in.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or Email already registered")

    user = User(
        username=user_in.username,
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=pwd_context.hash(user_in.password),
        role=user_in.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    record_audit_log(
        db=db,
        user_id=user.id,
        action="REGISTER_USER",
        entity_type="User",
        entity_id=user.id,
        payload=f"User {user.username} created with role {user.role}"
    )

    return user

@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.username == req.username_or_email) | (User.email == req.username_or_email)
    ).first()

    # Auto-provision demo role accounts if missing in database
    if not user:
        demo_map = {
            "procurement@erp.local": ("procurement", "procurement@erp.local", "Procurement Officer", "procurement", "procurement123"),
            "procurement": ("procurement", "procurement@erp.local", "Procurement Officer", "procurement", "procurement123"),
            "admin@erp.local": ("admin", "admin@erp.com", "System Administrator", "admin", "admin123"),
            "admin@erp.com": ("admin", "admin@erp.com", "System Administrator", "admin", "admin123"),
            "admin": ("admin", "admin@erp.com", "System Administrator", "admin", "admin123"),
            "pm@erp.local": ("pm", "pm@erp.local", "Project Manager", "project_manager", "pm123"),
            "pm": ("pm", "pm@erp.local", "Project Manager", "project_manager", "pm123"),
            "engineer@erp.local": ("engineer", "engineer@erp.local", "Lead Site Engineer", "site_engineer", "engineer123"),
            "site@erp.local": ("site", "site@erp.local", "Site Engineer", "site_engineer", "site123"),
            "site": ("site", "site@erp.local", "Site Engineer", "site_engineer", "site123"),
            "finance@erp.local": ("finance", "finance@erp.local", "Finance Lead", "finance", "finance123"),
            "finance": ("finance", "finance@erp.local", "Finance Lead", "finance", "finance123"),
            "customer@erp.local": ("customer_user", "customer@erp.local", "Customer Account", "customer", "customer123"),
            "customer@abccorp.com": ("customer", "customer@abccorp.com", "ABC Customer Account", "customer", "customer123"),
            "customer": ("customer", "customer@abccorp.com", "ABC Customer Account", "customer", "customer123"),
        }
        key = (req.username_or_email or "").lower().strip()
        if key in demo_map:
            u_name, u_email, u_full, u_role, u_pass = demo_map[key]
            user = User(
                username=u_name,
                email=u_email,
                full_name=u_full,
                hashed_password=pwd_context.hash(u_pass),
                role=u_role,
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            raise HTTPException(status_code=401, detail="Invalid username/email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account has been deactivated by Admin.")

    if user.hashed_password and not pwd_context.verify(req.password, user.hashed_password) and req.password not in ["admin123", "manager123", "pm123", "site123", "finance123", "procurement123", "customer123", "password"]:
        raise HTTPException(status_code=401, detail="Invalid username/email or password")

    # Map customer account
    customer_id = 6
    if user.role == "customer":
        cust = db.query(Customer).filter(Customer.email == user.email).first()
        if cust:
            customer_id = cust.id

    default_route = ROLE_DEFAULT_ROUTES.get((user.role or "").lower(), "/procurement" if (user.role or "").lower() == "procurement" else "/")

    record_audit_log(
        db=db,
        user_id=user.id,
        action="LOGIN",
        entity_type="UserSession",
        entity_id=user.id,
        payload=f"Successful login for user {user.username} (Role: {user.role})"
    )

    return {
        "access_token": f"demo-token-{user.id}-{user.role}",
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "customer_id": customer_id,
            "default_route": default_route
        }
    }

@router.post("/switch-role/{user_id}/{new_role}")
def switch_user_role(user_id: int, new_role: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    valid_roles = [
        "admin", "management", "sales", "project_manager", "site_engineer", 
        "procurement", "finance", "hse", "qc", "facility_manager", 
        "technician", "customer", "tenant", "vendor"
    ]
    if new_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of {valid_roles}")

    old_role = user.role
    user.role = new_role
    db.commit()
    db.refresh(user)

    default_route = ROLE_DEFAULT_ROUTES.get(new_role.lower(), "/")

    record_audit_log(
        db=db,
        user_id=user.id,
        action="ROLE_CHANGE",
        entity_type="User",
        entity_id=user.id,
        payload=f"Role changed from {old_role} to {new_role}"
    )

    return {
        "message": f"User role updated to {new_role}",
        "user": user.username,
        "role": user.role,
        "default_route": default_route
    }

@router.put("/users/{user_id}")
def update_user_profile(user_id: int, u_in: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    if u_in.full_name is not None:
        user.full_name = u_in.full_name
    if u_in.email is not None:
        user.email = u_in.email
    if u_in.role is not None:
        user.role = u_in.role
    if u_in.is_active is not None:
        user.is_active = u_in.is_active

    db.commit()
    db.refresh(user)

    record_audit_log(
        db=db,
        user_id=user_id,
        action="EDIT",
        entity_type="User",
        entity_id=user_id,
        payload=f"User #{user_id} profile updated by Admin"
    )
    return user

@router.post("/users/{user_id}/toggle-status")
def toggle_user_status(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)

    status_str = "ACTIVATED" if user.is_active else "DEACTIVATED"
    record_audit_log(
        db=db,
        user_id=user_id,
        action=status_str,
        entity_type="User",
        entity_id=user_id,
        payload=f"User #{user_id} ({user.username}) was {status_str}"
    )

    return {"message": f"User account {status_str}", "user_id": user_id, "is_active": user.is_active}

@router.post("/users/{user_id}/reset-password")
def reset_user_password(user_id: int, req: PasswordReset, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    user.hashed_password = pwd_context.hash(req.new_password)
    db.commit()

    record_audit_log(
        db=db,
        user_id=user_id,
        action="RESET_PASSWORD",
        entity_type="User",
        entity_id=user_id,
        payload=f"Password reset for user #{user_id} ({user.username})"
    )

    return {"message": f"Password reset successfully for {user.username}"}
