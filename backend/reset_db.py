import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.sql import text
from app.db.database import engine, Base
from app.models.models import *

async def reset():
    print("Dropping all tables via schema cascade...")
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE;"))
        await conn.execute(text("CREATE SCHEMA public;"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO postgres;"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
        
        print("Recreating tables...")
        await conn.run_sync(Base.metadata.create_all)
        
    print("Database reset complete. Please restart the uvicorn server so it runs the seeder automatically.")

if __name__ == "__main__":
    asyncio.run(reset())
