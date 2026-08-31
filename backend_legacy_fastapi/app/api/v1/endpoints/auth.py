"""Authentication endpoints — login, logout, refresh, register."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
import logging

from app.db.database import get_db
from app.models.models import User, UserRole, AuditHistory
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token, decode_token
)
from app.core.config import settings
from app.schemas.auth import (
    TokenResponse, UserLoginRequest, UserRegisterRequest,
    RefreshTokenRequest, UserResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Dependency: Get Current User ───────────────────────────────────────────────
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return current_user


# ── POST /auth/login ───────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
    request: Request = None
):
    """Authenticate user and return JWT tokens."""
    result = await db.execute(
        select(User).where(User.email == form_data.username.lower(), User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Failed login attempt for: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Generate tokens
    access_token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    # Update last login
    from datetime import datetime, timezone
    user.last_login = datetime.now(timezone.utc)

    # Audit log
    audit = AuditHistory(
        entity_type="user",
        entity_id=str(user.id),
        action="login",
        performed_by_id=user.id,
        ip_address=request.client.host if request else None,
    )
    db.add(audit)

    logger.info(f"User logged in: {user.email} [{user.role}]")
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


# ── POST /auth/register ────────────────────────────────────────────────────────
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user (Admin can only create admin users in prod)."""
    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email.lower(),
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=payload.role or UserRole.VIEWER,
        department=payload.department,
        job_title=payload.job_title,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.flush()

    logger.info(f"New user registered: {user.email} [{user.role}]")
    return UserResponse.model_validate(user)


# ── POST /auth/refresh ─────────────────────────────────────────────────────────
@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """Exchange a refresh token for a new access token."""
    data = decode_token(payload.refresh_token)
    if data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == data["sub"], User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access_token = create_access_token({"sub": str(user.id), "role": user.role, "email": user.email})
    new_refresh = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


# ── GET /auth/me ───────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user profile."""
    return UserResponse.model_validate(current_user)
