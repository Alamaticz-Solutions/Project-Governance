import asyncio
from sqlalchemy import delete
from app.db.database import AsyncSessionLocal
from app.models.models import Project, ProjectApproval, AuditHistory, Notification

async def clear_data():
    async with AsyncSessionLocal() as session:
        # Delete dependent tables first
        await session.execute(delete(ProjectApproval))
        await session.execute(delete(AuditHistory))
        await session.execute(delete(Notification))
        # Delete main projects table
        await session.execute(delete(Project))
        
        await session.commit()
        print("Successfully cleared all project test data!")

asyncio.run(clear_data())
