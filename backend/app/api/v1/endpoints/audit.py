"""Audit trail endpoints."""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from typing import Optional, List
import uuid
from app.db.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models.models import User, AuditHistory, UserRole
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()


class AuditResponse(BaseModel):
    id: uuid.UUID
    entity_type: str
    entity_id: str
    action: str
    action_label: str
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    performed_at: str
    performed_by_name: str
    performed_by_role: str
    stage: str
    status: str

def format_action_label(action: str, new_values: dict = None) -> str:
    """Format raw action keys into readable UI labels."""
    if action == "project_created":
        return "Request Created"
    if action == "project_updated":
        return "Project Details Updated"
    if action == "admin_fast_track_complete":
        return "Fast Tracked to Completion"
    if action.startswith("stage_decision_"):
        parts = action.replace("stage_decision_", "").replace("_", " ").title()
        decision = (new_values or {}).get("decision", "Reviewed")
        return f"{decision} by {parts}"
    return action.replace("_", " ").title()

def extract_stage(new_values: dict, old_values: dict, action: str) -> str:
    if action == "project_created":
        return "Intake"
    if action == "admin_fast_track_complete":
        return "System Admin"
    if new_values and "stage" in new_values:
        return new_values["stage"]
    if old_values and "stage" in old_values:
        return old_values["stage"]
    if "epmo" in action:
        return "EPMO"
    if "bta" in action:
        return "BTA"
    if "finance" in action:
        return "Finance"
    if "eac" in action:
        return "EAC"
    if "pic" in action:
        return "PIC"
    return "Project Update"


@router.get("/", response_model=List[AuditResponse])
async def get_audit_trail(
    project_id: Optional[uuid.UUID] = Query(None),
    entity_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(AuditHistory).options(joinedload(AuditHistory.performed_by)).order_by(AuditHistory.performed_at.asc()).limit(500)
    if project_id:
        query = query.where(AuditHistory.project_id == project_id)
    if entity_type:
        query = query.where(AuditHistory.entity_type == entity_type)

    result = await db.execute(query)
    audits = result.scalars().all()

    response = []
    for a in audits:
        nv = a.new_values or {}
        ov = a.old_values or {}
        
        status = nv.get("status", "Submitted" if a.action == "project_created" else "Completed")
        if status == "Pending" and nv.get("decision"):
            status = "Approved" if nv.get("decision") == "Approve" else nv.get("decision")

        role_str = "SYSTEM"
        if a.performed_by:
            role_val = a.performed_by.role
            role_str = role_val.value.upper() if hasattr(role_val, 'value') else str(role_val).upper()
            role_str = role_str.replace("_", " ")

        response.append(AuditResponse(
            id=a.id,
            entity_type=a.entity_type,
            entity_id=a.entity_id,
            action=a.action,
            action_label=format_action_label(a.action, nv),
            old_values=ov,
            new_values=nv,
            performed_at=a.performed_at.isoformat() if isinstance(a.performed_at, datetime) else str(a.performed_at),
            performed_by_name=a.performed_by.full_name if a.performed_by else "System",
            performed_by_role=role_str,
            stage=extract_stage(nv, ov, a.action),
            status=status
        ))
        
    return response
