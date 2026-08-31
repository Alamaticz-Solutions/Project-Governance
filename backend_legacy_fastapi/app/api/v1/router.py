"""Root API v1 router — aggregates all endpoint routers."""
from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, projects, workflow, tasks, gate_reviews, dashboard, notifications, audit

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(workflow.router, prefix="/workflow", tags=["Workflow Engine"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(gate_reviews.router, prefix="/gate-reviews", tags=["Gate Reviews"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit Trail"])
