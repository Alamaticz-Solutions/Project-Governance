import asyncio
import httpx

async def run():
    async with httpx.AsyncClient() as client:
        # BTA token fake or login
        res = await client.post('http://localhost:8000/api/v1/auth/login', data={'username': 'bta@abchealth.com', 'password': 'Demo1234!'})
        token = res.json().get('access_token')
        
        # Get projects
        res2 = await client.get('http://localhost:8000/api/v1/projects/', headers={'Authorization': f'Bearer {token}'})
        print(res2.status_code)
        print(res2.text)

if __name__ == '__main__':
    asyncio.run(run())
