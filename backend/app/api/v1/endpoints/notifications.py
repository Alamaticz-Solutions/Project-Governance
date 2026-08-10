"""Notifications endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from app.db.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models.models import User, Notification, UserRole
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

router = APIRouter()


class NotificationResponse(BaseModel):
    id: uuid.UUID
    notification_type: str
    title: str
    message: str
    action_url: Optional[str] = None
    is_read: bool
    created_at: datetime
    model_config = {"from_attributes": True}


@router.get("/", response_model=List[NotificationResponse])
async def get_my_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Admin has oversight visibility across every team's notifications, not just their own.
    stmt = select(Notification).order_by(Notification.created_at.desc()).limit(50)
    if current_user.role != UserRole.ADMIN:
        stmt = stmt.where(Notification.recipient_id == current_user.id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(func.count()).select_from(Notification).where(Notification.is_read == False)
    if current_user.role != UserRole.ADMIN:
        stmt = stmt.where(Notification.recipient_id == current_user.id)
    result = await db.execute(stmt)
    return {"count": result.scalar() or 0}


@router.post("/mark-all-read")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime, timezone
    stmt = update(Notification).where(Notification.is_read == False)
    if current_user.role != UserRole.ADMIN:
        stmt = stmt.where(Notification.recipient_id == current_user.id)
    await db.execute(stmt.values(is_read=True, read_at=datetime.now(timezone.utc)))
    return {"message": "All notifications marked as read"}


@router.patch("/{notification_id}/read")
async def mark_one_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime, timezone
    stmt = select(Notification).where(Notification.id == notification_id)
    if current_user.role != UserRole.ADMIN:
        stmt = stmt.where(Notification.recipient_id == current_user.id)
    result = await db.execute(stmt)
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc)
    return {"message": "Notification marked as read"}
