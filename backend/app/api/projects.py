from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Project, AuditLog
from app.schemas import ProjectCreate, ProjectResponse

router = APIRouter(prefix="/api/projects", tags=["Construction Project Master"])

@router.get("/", response_model=List[ProjectResponse])
def list_projects(status: str = None, db: Session = Depends(get_db)):
    query = db.query(Project)
    if status:
        query = query.filter(Project.status == status)
    return query.order_by(Project.created_at.desc()).all()

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project_by_id(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/", response_model=ProjectResponse)
def create_project(project_in: ProjectCreate, db: Session = Depends(get_db)):
    existing = db.query(Project).filter(Project.code == project_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project with this Code already exists")

    project = Project(**project_in.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)

    # Log Audit
    audit = AuditLog(user_id=1, action="CREATE", entity_type="Project", entity_id=project.id, payload=f"Created Construction Project: {project.name} (Budget: ${project.budget})")
    db.add(audit)
    db.commit()

    return project

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, project_in: ProjectCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.name = project_in.name
    project.code = project_in.code
    project.location = project_in.location
    project.start_date = project_in.start_date
    project.end_date = project_in.end_date
    project.budget = project_in.budget
    if project_in.status:
        project.status = project_in.status

    db.commit()
    db.refresh(project)

    audit = AuditLog(user_id=1, action="UPDATE", entity_type="Project", entity_id=project.id, payload=f"Updated Project #{project.id}: {project.name} (Status: {project.status})")
    db.add(audit)
    db.commit()

    return project
