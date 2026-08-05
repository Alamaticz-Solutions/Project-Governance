import asyncio
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.models import Project
from app.schemas.projects import ProjectResponse
import json

from sqlalchemy.orm import selectinload

async def test_all_projects_pydantic():
    async with AsyncSessionLocal() as session:
        query = select(Project).options(selectinload(Project.project_manager))
        result = await session.execute(query)
        projects = result.scalars().all()
        print(f"Found {len(projects)} projects.")
        
        for p in projects:
            try:
                # Try validating with Pydantic like the API does
                ProjectResponse.model_validate(p)
                print(f"Project {p.id} successfully serialized.")
            except Exception as e:
                import traceback
                traceback.print_exc()

asyncio.run(test_all_projects_pydantic())
