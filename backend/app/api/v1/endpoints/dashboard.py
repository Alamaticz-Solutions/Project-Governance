"""Dashboard summary endpoints — real aggregates over live project/approval data."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.database import get_db
from app.models.models import Project, ProjectApproval, User, ProjectStatus, UserRole
from app.api.v1.endpoints.auth import get_current_user
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter()

# Mirrors frontend/src/app/core/utils/project-display.util.ts — keep in sync.
STAGE_ORDER = {
    "EPMO Review": 1,
    "BTA Review": 2,
    "Finance Review": 3,
    "Prepare for EAC": 4,
    "EAC Committee Review": 5,
    "EAC Review": 5,
    "EAC Meeting": 5,
    "Prepare for PIC": 6,
    "PIC Meeting": 7,
    "TRC Vetting & Gate Review": 8,
}
TOTAL_STAGES = 8

# "Live" portfolio = still actually being tracked (excludes draft/cancelled/archived).
LIVE_STATUSES = [ProjectStatus.ACTIVE, ProjectStatus.IN_DELIVERY, ProjectStatus.COMPLETED]


def stage_progress(current_stage: Optional[str], status) -> int:
    status_val = status.value if hasattr(status, "value") else str(status)
    if status_val in ("completed", "in_delivery"):
        return 100
    order = STAGE_ORDER.get(current_stage or "EPMO Review", 1)
    return round((order / TOTAL_STAGES) * 100)


class DashboardStats(BaseModel):
    total_portfolio_budget: float
    active_proposals: int
    projects_in_delivery: int
    pending_approvals: int
    critical_risks: int


class PortfolioRow(BaseModel):
    id: str
    name: str
    dept: str
    priority: str
    stage: str
    status: str
    progress: int


class DashboardResponse(BaseModel):
    stats: DashboardStats
    portfolio: List[PortfolioRow]


@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Real dashboard aggregates — no fabricated/static values."""

    budget_q = await db.execute(
        select(func.coalesce(func.sum(Project.budget_estimated), 0.0))
        .where(Project.status.in_(LIVE_STATUSES))
    )
    total_budget = budget_q.scalar() or 0.0

    active_q = await db.execute(
        select(func.count()).select_from(Project).where(Project.status == ProjectStatus.ACTIVE)
    )
    active_proposals = active_q.scalar() or 0

    delivery_q = await db.execute(
        select(func.count()).select_from(Project).where(Project.status == ProjectStatus.IN_DELIVERY)
    )
    projects_in_delivery = delivery_q.scalar() or 0

    pending_stmt = select(func.count()).select_from(ProjectApproval).where(ProjectApproval.status == "Pending")
    if current_user.role not in (UserRole.ADMIN, UserRole.EPMO):
        pending_stmt = pending_stmt.where(ProjectApproval.assigned_role == current_user.role)
    pending_q = await db.execute(pending_stmt)
    pending_approvals = pending_q.scalar() or 0

    critical_q = await db.execute(
        select(func.count()).select_from(Project).where(
            Project.risk_level.in_(["high", "very_high"]),
            Project.status.in_([ProjectStatus.ACTIVE, ProjectStatus.IN_DELIVERY])
        )
    )
    critical_risks = critical_q.scalar() or 0

    portfolio_q = await db.execute(
        select(Project)
        .where(Project.status.in_([ProjectStatus.ACTIVE, ProjectStatus.IN_DELIVERY]))
        .order_by(Project.updated_at.desc())
        .limit(10)
    )
    portfolio = [
        PortfolioRow(
            id=str(p.id),
            name=p.project_name,
            dept=p.department or p.business_unit or "N/A",
            priority=p.priority.value if hasattr(p.priority, "value") else str(p.priority),
            stage=p.current_stage or "Intake",
            status=p.status.value if hasattr(p.status, "value") else str(p.status),
            progress=stage_progress(p.current_stage, p.status),
        )
        for p in portfolio_q.scalars().all()
    ]

    return DashboardResponse(
        stats=DashboardStats(
            total_portfolio_budget=total_budget,
            active_proposals=active_proposals,
            projects_in_delivery=projects_in_delivery,
            pending_approvals=pending_approvals,
            critical_risks=critical_risks,
        ),
        portfolio=portfolio,
    )
