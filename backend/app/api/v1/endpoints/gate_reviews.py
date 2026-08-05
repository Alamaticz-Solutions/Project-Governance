"""Gate reviews endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models.models import User, GateReview, ApprovalDecision, AuditHistory
from pydantic import BaseModel
from typing import Optional, List
import uuid

router = APIRouter()


class GateReviewResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    gate_code: str
    gate_name: str
    committee: Optional[str] = None
    status: str
    priority: Optional[str] = None
    submitted_at: Optional[str] = None
    model_config = {"from_attributes": True}


class GateDecisionRequest(BaseModel):
    decision: ApprovalDecision
    notes: Optional[str] = None
    checklist_items: Optional[dict] = None


@router.get("/", response_model=List[GateReviewResponse])
async def list_gate_reviews(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(GateReview).order_by(GateReview.submitted_at.desc()))
    gates = result.scalars().all()
    return [GateReviewResponse.model_validate(g) for g in gates]


@router.get("/{gate_id}", response_model=GateReviewResponse)
async def get_gate_review(
    gate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(GateReview).where(GateReview.id == gate_id))
    gate = result.scalar_one_or_none()
    if not gate:
        raise HTTPException(status_code=404, detail="Gate review not found")
    return GateReviewResponse.model_validate(gate)


@router.post("/{gate_id}/decision")
async def submit_gate_decision(
    gate_id: uuid.UUID,
    payload: GateDecisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime, timezone
    result = await db.execute(select(GateReview).where(GateReview.id == gate_id))
    gate = result.scalar_one_or_none()
    if not gate:
        raise HTTPException(status_code=404, detail="Gate review not found")

    gate.decision = payload.decision
    gate.decision_by_id = current_user.id
    gate.decision_at = datetime.now(timezone.utc)
    gate.decision_notes = payload.notes
    gate.status = payload.decision.value

    audit = AuditHistory(
        project_id=gate.project_id,
        entity_type="gate_review",
        entity_id=str(gate.id),
        action=f"gate_{payload.decision.value}",
        new_values={"decision": payload.decision.value, "notes": payload.notes},
        performed_by_id=current_user.id,
    )
    db.add(audit)
    return {"message": f"Gate {gate.gate_code} — {payload.decision.value}"}
