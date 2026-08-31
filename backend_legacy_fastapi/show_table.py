import asyncio
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.models import Project

async def show_projects():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Project))
        projects = result.scalars().all()
        
        print("\n" + "="*80)
        print(f"{'PROJECT NO':<15} | {'PROJECT NAME':<40} | {'STATUS':<10} | {'PRIORITY':<10}")
        print("="*80)
        
        if not projects:
            print("No projects found in the database.")
            
        for p in projects:
            name = p.project_name[:37] + "..." if len(p.project_name) > 40 else p.project_name
            print(f"{p.project_number:<15} | {name:<40} | {p.status.value:<10} | {p.priority.value:<10}")
        print("="*80 + "\n")

if __name__ == "__main__":
    asyncio.run(show_projects())
