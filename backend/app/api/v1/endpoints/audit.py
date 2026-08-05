"""Audit trail endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import uuid
from app.db.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models.models import User, AuditHistory, UserRole
from pydantic import BaseModel
from typing import List

router = APIRouter()


class AuditResponse(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: str
    action: str
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    performed_at: str
    model_config = {"from_attributes": True}


@router.get("/", response_model=List[AuditResponse])
async def get_audit_trail(
    project_id: Optional[uuid.UUID] = Query(None),
    entity_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.EPMO]:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Access denied")

    query = select(AuditHistory).order_by(AuditHistory.performed_at.desc()).limit(200)
    if project_id:
        query = query.where(AuditHistory.project_id == project_id)
    if entity_type:
        query = query.where(AuditHistory.entity_type == entity_type)

    result = await db.execute(query)
    return result.scalars().all()
