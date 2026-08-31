"""Tasks endpoints."""
from fastapi import APIRouter, Depends
from app.api.v1.endpoints.auth import get_current_user
from app.models.models import User

router = APIRouter()

@router.get("/")
async def list_tasks(current_user: User = Depends(get_current_user)):
    return {"message": "Tasks endpoint — Phase 5"}
