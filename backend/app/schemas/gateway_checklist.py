"""Schemas for the dynamic gate reviewer checklist (per-team, data-driven)."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class GatewayChecklistItemResponse(BaseModel):
    result_id: uuid.UUID
    template_id: uuid.UUID
    sequence_order: int
    gate_name: str
    gate_owner: str
    checklist_item: str
    gate_description: Optional[str] = None
    status: str
    comments: Optional[str] = None
    is_completed: bool
    completed_by_name: Optional[str] = None
    completion_date: Optional[datetime] = None
    can_edit: bool


class GatewayChecklistUpdateRequest(BaseModel):
    status: str  # "Approved" | "Not Approved"
    comments: Optional[str] = None
