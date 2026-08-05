"""Seed initial demo data into PostgreSQL database."""
import asyncio
import logging
from sqlalchemy import select
from app.db.database import AsyncSessionLocal, engine, Base
from app.models.models import User, UserRole, Project, ProjectStatus, ProjectPriority, ProjectRisk, GateReview, GateCode, RiskItem
from app.core.security import get_password_hash

logger = logging.getLogger(__name__)

DEMO_USERS = [
    {
        "email": "admin@abchealth.com",
        "username": "admin",
        "full_name": "Sarah Connor (Admin)",
        "role": UserRole.ADMIN,
        "department": "Executive Governance",
        "job_title": "Chief Governance Officer"
    },
    {
        "email": "pm@abchealth.com",
        "username": "pm_user",
        "full_name": "Marcus Vance",
        "role": UserRole.PROJECT_MANAGER,
        "department": "Clinical Operations",
        "job_title": "Senior Project Manager"
    },
    {
        "email": "bta@abchealth.com",
        "username": "bta_user",
        "full_name": "Brian Taylor (BTA)",
        "role": UserRole.BTA,
        "department": "Business Technology",
        "job_title": "BTA Reviewer"
    },
    {
        "email": "epmo@abchealth.com",
        "username": "epmo_user",
        "full_name": "Elena Rostova",
        "role": UserRole.EPMO,
        "department": "EPMO Office",
        "job_title": "EPMO Director"
    },
    {
        "email": "eac@abchealth.com",
        "username": "eac_user",
        "full_name": "Dr. Aris Thorne",
        "role": UserRole.EAC,
        "department": "IT Architecture",
        "job_title": "Enterprise Architect Lead"
    },
    {
        "email": "pic@abchealth.com",
        "username": "pic_user",
        "full_name": "Patricia Isley (PIC)",
        "role": UserRole.PIC,
        "department": "Project Improvement",
        "job_title": "PIC Director"
    },
    {
        "email": "finance@abchealth.com",
        "username": "finance_user",
        "full_name": "Rachel Morgan (Finance)",
        "role": UserRole.FINANCE,
        "department": "Finance & Accounting",
        "job_title": "Finance Controller"
    }
]

DEMO_PROJECTS = [
    {
        "project_number": "PRJ-2026-001",
        "project_name": "AI-Driven Clinical Documentation & Scribe Assistant",
        "business_unit": "Clinical Systems",
        "department": "Clinical Operations",
        "sponsor_name": "Dr. Robert Chen",
        "sponsor_email": "r.chen@abchealth.com",
        "description": "Integration of ambient GenAI voice scribes into EPIC EHR to reduce physician burnout and documentation overhead.",
        "priority": ProjectPriority.CRITICAL,
        "risk_level": ProjectRisk.HIGH,
        "status": ProjectStatus.ACTIVE,
        "budget_estimated": 450000.0,
        "has_phi_data": True,
        "is_clinical": True,
        "vendor_required": True,
        "it_involvement": True
    },
    {
        "project_number": "PRJ-2026-002",
        "project_name": "Next-Gen Telehealth Patient Engagement Portal",
        "business_unit": "Digital Health",
        "department": "Patient Experience",
        "sponsor_name": "Amanda Vance",
        "sponsor_email": "a.vance@abchealth.com",
        "description": "Unified virtual care platform providing video consultations, remote monitoring, and automated scheduling.",
        "priority": ProjectPriority.HIGH,
        "risk_level": ProjectRisk.MEDIUM,
        "status": ProjectStatus.ACTIVE,
        "budget_estimated": 320000.0,
        "has_phi_data": True,
        "is_clinical": True,
        "vendor_required": False,
        "it_involvement": True
    },
    {
        "project_number": "PRJ-2026-003",
        "project_name": "Zero-Trust Multi-Cloud Security & Identity Mesh",
        "business_unit": "Information Security",
        "department": "IT Security",
        "sponsor_name": "David Sterling",
        "sponsor_email": "d.sterling@abchealth.com",
        "description": "Enterprise-wide zero-trust network access (ZTNA) and PAM modernization across all hospital networks.",
        "priority": ProjectPriority.CRITICAL,
        "risk_level": ProjectRisk.VERY_HIGH,
        "status": ProjectStatus.ACTIVE,
        "budget_estimated": 780000.0,
        "has_phi_data": False,
        "is_clinical": False,
        "vendor_required": True,
        "it_involvement": True
    }
]

async def seed_data():
    """Seed initial users and demo projects into DB."""
    async with AsyncSessionLocal() as session:
        # 1. Seed Users
        hashed_pw = get_password_hash("Demo1234!")
        user_map = {}
        for user_data in DEMO_USERS:
            res = await session.execute(select(User).where(User.email == user_data["email"]))
            existing = res.scalar_one_or_none()
            if not existing:
                user = User(
                    email=user_data["email"],
                    username=user_data["username"],
                    full_name=user_data["full_name"],
                    hashed_password=hashed_pw,
                    role=user_data["role"],
                    department=user_data["department"],
                    job_title=user_data["job_title"],
                    is_active=True,
                    is_verified=True
                )
                session.add(user)
                await session.flush()
                user_map[user_data["email"]] = user
            else:
                user_map[user_data["email"]] = existing

        # 2. Seed Projects (Disabled for clean testing)
        # pm_user = user_map.get("pm@abchealth.com") or user_map.get("admin@abchealth.com")
        # if pm_user:
        #     pass 

        await session.commit()
        logger.info("✅ Database seed completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_data())
