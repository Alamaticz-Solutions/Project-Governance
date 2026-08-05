import httpx
import asyncio

async def test_api():
    # Login as EAC first
    async with httpx.AsyncClient() as client:
        # Get token
        resp = await client.post("http://localhost:8000/api/v1/auth/login", data={"username": "eac@abchealth.com", "password": "Demo1234!"})
        token = resp.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        resp = await client.get("http://localhost:8000/api/v1/projects/approvals/pending", headers=headers)
        print("Status", resp.status_code)
        print("Data", resp.text)

asyncio.run(test_api())
