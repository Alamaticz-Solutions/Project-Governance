"""One-off migration: add 'in_delivery' to the projectstatus Postgres enum type."""
import asyncio
import sys
sys.path.insert(0, '.')
from app.db.database import engine


async def main():
    async with engine.begin() as conn:
        result = await conn.exec_driver_sql(
            "SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid "
            "WHERE t.typname = 'projectstatus' AND e.enumlabel = 'in_delivery'"
        )
        if result.first():
            print("'in_delivery' already exists on projectstatus — skipping.")
            return
        await conn.exec_driver_sql("ALTER TYPE projectstatus ADD VALUE 'in_delivery'")
        print("Added 'in_delivery' to projectstatus enum.")

asyncio.run(main())
