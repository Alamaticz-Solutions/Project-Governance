import asyncio
import asyncpg

async def check_or_create_db():
    # Connect to the default 'postgres' database first
    conn = await asyncpg.connect(user='postgres', password='postgres', database='postgres', host='localhost')
    
    # Check if 'pds_governance' exists
    exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname='pds_governance'")
    
    if not exists:
        print("Database 'pds_governance' does not exist. Creating...")
        await conn.execute("CREATE DATABASE pds_governance")
        print("Database created!")
    else:
        print("Database 'pds_governance' already exists.")
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(check_or_create_db())
