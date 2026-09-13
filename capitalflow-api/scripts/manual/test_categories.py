import httpx

resp = httpx.post("http://localhost:8000/api/v1/auth/login", json={"email": "admin@capitalflow.vn", "password": "CapitalFlow@2026"})
token = resp.json()["access_token"]
resp = httpx.get("http://localhost:8000/api/v1/categories", headers={"Authorization": f"Bearer {token}"})
print(resp.status_code)
print(resp.text)
