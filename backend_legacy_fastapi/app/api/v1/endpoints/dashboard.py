"""Dashboard summary endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from app.db.database import get_db
from app.models.models import Project, WorkflowStage, WorkflowTask, Notification, GateReview, User, ProjectStatus, ProjectPriority, TaskStatus
from app.api.v1.endpoints.auth import get_current_user
from app.schemas.auth import UserResponse
from typing import List
from pydantic import BaseModel
import uuid

router = APIRouter()


class DashboardKPI(BaseModel):
    active_projects: int
    pending_approvals: int
    completed_this_month: int
    risk_items: int
    my_pending_tasks: int
    overdue_tasks: int


class ProjectStatusBreakdown(BaseModel):
    status: str
    count: int


class PriorityBreakdown(BaseModel):
    priority: str
    count: int


class DashboardResponse(BaseModel):
    kpis: DashboardKPI
    status_breakdown: List[ProjectStatusBreakdown]
    priority_breakdown: List[PriorityBreakdown]
    recent_gate_reviews: List[dict]


@router.get("/", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return dashboard KPIs and breakdown charts."""
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Active projects
    active_q = await db.execute(
        select(func.count()).select_from(Project).where(Project.status == ProjectStatus.ACTIVE)
    )
    active_count = active_q.scalar() or 0

    # Completed this month
    completed_q = await db.execute(
        select(func.count()).select_from(Project).where(
            Project.status == ProjectStatus.COMPLETED,
            Project.updated_at >= month_start
        )
    )
    completed_count = completed_q.scalar() or 0

    # Pending gate reviews (approvals)
    pending_gates_q = await db.execute(
        select(func.count()).select_from(GateReview).where(GateReview.status == "pending")
    )
    pending_approvals = pending_gates_q.scalar() or 0

    # Risk items (high/critical projects)
    risk_q = await db.execute(
        select(func.count()).select_from(Project).where(
            Project.risk_level.in_(["high", "very_high"]),
            Project.status == ProjectStatus.ACTIVE
        )
    )
    risk_items = risk_q.scalar() or 0

    # Status breakdown
    status_q = await db.execute(
        select(Project.status, func.count()).group_by(Project.status)
    )
    status_breakdown = [
        ProjectStatusBreakdown(status=row[0], count=row[1])
        for row in status_q.all()
    ]

    # Priority breakdown
    priority_q = await db.execute(
        select(Project.priority, func.count()).group_by(Project.priority)
    )
    priority_breakdown = [
        PriorityBreakdown(priority=row[0], count=row[1])
        for row in priority_q.all()
    ]

    # Recent gate reviews
    gates_q = await db.execute(
        select(GateReview).order_by(GateReview.submitted_at.desc()).limit(5)
    )
    recent_gates = []
    for g in gates_q.scalars().all():
        recent_gates.append({
            "id": str(g.id),
            "gate_code": g.gate_code,
            "gate_name": g.gate_name,
            "committee": g.committee,
            "status": g.status,
            "project_id": str(g.project_id),
        })

    # Pending approvals for current user's role
    from app.models.models import ProjectApproval, UserRole
    pending_tasks_stmt = select(func.count()).select_from(ProjectApproval).where(
        ProjectApproval.status == "Pending"
    )
    if current_user.role not in [UserRole.ADMIN, UserRole.EPMO]:
        pending_tasks_stmt = pending_tasks_stmt.where(
            ProjectApproval.assigned_role == current_user.role
        )
    my_pending_tasks_q = await db.execute(pending_tasks_stmt)
    my_pending_tasks = my_pending_tasks_q.scalar() or 0

    return DashboardResponse(
        kpis=DashboardKPI(
            active_projects=active_count,
            pending_approvals=pending_approvals,
            completed_this_month=completed_count,
            risk_items=risk_items,
            my_pending_tasks=my_pending_tasks,
            overdue_tasks=0,
        ),
        status_breakdown=status_breakdown,
        priority_breakdown=priority_breakdown,
        recent_gate_reviews=recent_gates,
    )

