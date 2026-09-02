import httpx

resp = httpx.post("http://localhost:8000/api/auth/login", json={
    "email": "admin@capitalflow.vn",
    "password": "CapitalFlow@2026"
})
print(resp.status_code)
print(resp.text)
