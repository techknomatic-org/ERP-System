from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
from app.database import get_db
from app.models import Document, AuditLog
from app.schemas import DocumentResponse

router = APIRouter(prefix="/api/documents", tags=["Documents & Attachments"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/{entity_type}/{entity_id}", response_model=List[DocumentResponse])
def get_documents_for_entity(entity_type: str, entity_id: int, db: Session = Depends(get_db)):
    return db.query(Document).filter(
        Document.entity_type == entity_type,
        Document.entity_id == entity_id
    ).all()

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    entity_type: str = Form(...),
    entity_id: int = Form(...),
    uploaded_by_id: int = Form(1),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    doc = Document(
        entity_type=entity_type,
        entity_id=entity_id,
        file_name=file.filename,
        file_path=file_path,
        file_size=len(contents),
        file_type=file.content_type,
        uploaded_by_id=uploaded_by_id
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Log audit
    audit = AuditLog(user_id=uploaded_by_id, action="CREATE", entity_type="Document", entity_id=doc.id, payload=f"Uploaded attachment {file.filename} for {entity_type} #{entity_id}")
    db.add(audit)
    db.commit()

    return doc
