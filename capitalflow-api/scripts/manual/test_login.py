import httpx

resp = httpx.post("http://localhost:8000/api/v1/auth/login", json={
    "email": "admin@capitalflow.vn",
    "password": "CapitalFlow@2026"
})
print(resp.status_code)
print(resp.text)
