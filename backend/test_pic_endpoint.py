import urllib.request
import urllib.parse
import json

data = urllib.parse.urlencode({"username": "pic@abchealth.com", "password": "Demo1234!"}).encode()
req = urllib.request.Request("http://localhost:8000/api/v1/auth/login", data=data)
try:
    with urllib.request.urlopen(req) as response:
        login_res = json.loads(response.read().decode())
        token = login_res["access_token"]
        print("Login successful")
except Exception as e:
    print("Login failed:", e)
    exit(1)

req2 = urllib.request.Request("http://localhost:8000/api/v1/projects/approvals/pending")
req2.add_header("Authorization", f"Bearer {token}")
try:
    with urllib.request.urlopen(req2) as response:
        print("Pending Approvals:")
        print(response.read().decode())
except Exception as e:
    print("Error fetching approvals:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
