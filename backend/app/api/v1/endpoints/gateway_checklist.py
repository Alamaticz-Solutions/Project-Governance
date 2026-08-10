"""Dynamic gate reviewer checklist endpoints (per-team, data-driven)."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import uuid

from app.db.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models.models import (
    User, UserRole, GatewayChecklistTemplate, GatewayChecklistResult, ChecklistResultStatus,
)
from app.schemas.gateway_checklist import GatewayChecklistItemResponse, GatewayChecklistUpdateRequest

router = APIRouter()

VALID_STATUSES = {"Approved", "Not Approved"}


def _can_edit(user: User, gate_owner: str) -> bool:
    if user.role in (UserRole.ADMIN, UserRole.EPMO):
        return True
    return user.role.value.upper() == gate_owner.strip().upper()


def _to_response(result: GatewayChecklistResult, current_user: User) -> GatewayChecklistItemResponse:
    template = result.template
    return GatewayChecklistItemResponse(
        result_id=result.id,
        template_id=template.id,
        sequence_order=template.sequence_order,
        gate_name=template.gate_name,
        gate_owner=template.gate_owner,
        checklist_item=template.checklist_item,
        gate_description=template.gate_description,
        status=result.status.value,
        comments=result.comments,
        is_completed=result.status != ChecklistResultStatus.PENDING,
        completed_by_name=result.completed_by.full_name if result.completed_by else None,
        completion_date=result.completed_at,
        can_edit=_can_edit(current_user, template.gate_owner),
    )


@router.get("/{project_id}", response_model=list[GatewayChecklistItemResponse])
async def get_gateway_checklist(
    project_id: uuid.UUID,
    team: str = Query(..., description="Gate owner/team code, e.g. BTA, EPMO, FINANCE, EAC, PIC"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    templates_res = await db.execute(
        select(GatewayChecklistTemplate)
        .where(GatewayChecklistTemplate.gate_owner.ilike(team.strip()))
        .order_by(GatewayChecklistTemplate.sequence_order)
    )
    templates = templates_res.scalars().all()

    existing_res = await db.execute(
        select(GatewayChecklistResult)
        .options(selectinload(GatewayChecklistResult.template), selectinload(GatewayChecklistResult.completed_by))
        .where(GatewayChecklistResult.project_id == project_id)
    )
    existing_by_template = {r.template_id: r for r in existing_res.scalars().all()}

    for template in templates:
        if template.id not in existing_by_template:
            new_result = GatewayChecklistResult(project_id=project_id, template_id=template.id)
            db.add(new_result)
            new_result.template = template
            existing_by_template[template.id] = new_result
    await db.commit()

    ordered_results = [existing_by_template[t.id] for t in templates]
    return [_to_response(r, current_user) for r in ordered_results]


@router.patch("/results/{result_id}", response_model=GatewayChecklistItemResponse)
async def update_gateway_checklist_result(
    result_id: uuid.UUID,
    payload: GatewayChecklistUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {sorted(VALID_STATUSES)}")

    result_res = await db.execute(
        select(GatewayChecklistResult)
        .options(selectinload(GatewayChecklistResult.template), selectinload(GatewayChecklistResult.completed_by))
        .where(GatewayChecklistResult.id == result_id)
    )
    result = result_res.scalar_one_or_none()
    if not result:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    if not _can_edit(current_user, result.template.gate_owner):
        raise HTTPException(status_code=403, detail="You do not have permission to edit this team's checklist")

    result.status = ChecklistResultStatus(payload.status)
    result.comments = payload.comments
    result.completed_by_id = current_user.id
    result.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(result, attribute_names=["template", "completed_by"])
    return _to_response(result, current_user)
