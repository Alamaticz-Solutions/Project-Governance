import asyncio
from sqlalchemy import text
from app.db.database import engine, Base
from app.db.seed import seed_data
from app.models import models

async def init():
    print("Dropping existing tables to reset schema...")
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE;"))
        await conn.execute(text("CREATE SCHEMA public;"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO postgres;"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
        
    print("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created successfully.")
    
    print("Seeding initial data (demo users, workflows)...")
    try:
        await seed_data()
        print("Initial data seeded successfully.")
    except Exception as e:
        print("Error while seeding data:", e)
    print("Database initialization complete.")

if __name__ == "__main__":
    asyncio.run(init())
