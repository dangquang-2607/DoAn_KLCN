import httpx

resp = httpx.post("http://localhost:8000/api/auth/login", json={"email": "admin@capitalflow.vn", "password": "CapitalFlow@2026"})
token = resp.json()["access_token"]
resp = httpx.get("http://localhost:8000/api/categories", headers={"Authorization": f"Bearer {token}"})
print(resp.status_code)
print(resp.text)
