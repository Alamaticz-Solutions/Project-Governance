"""
ABC Health Project Governance Portal - FastAPI Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.database import engine, Base
from app.api.v1.router import api_router
from app.middleware.request_logging import RequestLoggingMiddleware

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("🚀 Starting ABC Health Governance Portal API...")
    # Startup: Create tables if not exist (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables verified")
    
    # Auto-seed initial demo users and data
    try:
        from app.db.seed import seed_data
        await seed_data()
        logger.info("✅ Seed data populated")
    except Exception as e:
        logger.warning(f"Seed error: {e}")
    yield
    # Shutdown
    logger.info("🛑 Shutting down Governance Portal API...")
    await engine.dispose()


def create_application() -> FastAPI:
    """Application factory pattern."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Enterprise Project Governance Workflow Engine for ABC Health",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # ── Middleware ─────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLoggingMiddleware)

    # ── API Router ─────────────────────────────────────────────────────────────
    app.include_router(api_router, prefix="/api/v1")

    # ── Health Check ───────────────────────────────────────────────────────────
    @app.get("/health", tags=["health"])
    async def health_check():
        return {
            "status": "healthy",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
        }

    return app


app = create_application()
