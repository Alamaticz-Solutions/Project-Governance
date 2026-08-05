import asyncio
import httpx

async def run():
    async with httpx.AsyncClient() as client:
        res = await client.post('http://localhost:8000/api/v1/auth/login', data={'username': 'admin@abchealth.com', 'password': 'Demo1234!'})
        token = res.json().get('access_token')
        res2 = await client.get('http://localhost:8000/api/v1/projects/', headers={'Authorization': f'Bearer {token}'})
        data = res2.json()
        for p in data['items']:
            print(f"{p['id']} - {p['project_number']} - {p['project_name']}")

if __name__ == '__main__':
    asyncio.run(run())
