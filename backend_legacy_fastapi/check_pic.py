import asyncio
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.models import ProjectApproval, Project

async def check():
    async with AsyncSessionLocal() as session:
        stmt = select(ProjectApproval).where(ProjectApproval.assigned_role == "pic")
        res = await session.execute(stmt)
        approvals = res.scalars().all()
        for a in approvals:
            print(f"Approval ID: {a.id}, Stage: {a.approval_stage}, Status: {a.status}, Role: {a.assigned_role}")
            
asyncio.run(check())
