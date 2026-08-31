import asyncio
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.models import User

async def list_users():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        for u in users:
            print(f"Email: {u.email}, Username: {u.username}, Role: {u.role.value}")

if __name__ == "__main__":
    asyncio.run(list_users())
