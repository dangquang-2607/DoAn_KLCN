import urllib.request, urllib.error, json

BASE = "http://localhost:8000"

def post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        BASE + path, data=body,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        r = urllib.request.urlopen(req)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

# 1. Register
status, data = post("/api/auth/register", {
    "email": "admin@capitalflow.vn",
    "password": "Admin123!",
    "full_name": "Admin"
})
print(f"Register: {status}  {data}")

# 2. Login
status, data = post("/api/auth/login", {
    "email": "admin@capitalflow.vn",
    "password": "Admin123!"
})
token = data.get("access_token", "")
print(f"Login: {status}  token={token[:40]}...")

# 3. /auth/me
req = urllib.request.Request(
    BASE + "/api/auth/me",
    headers={"Authorization": f"Bearer {token}"}
)
r = urllib.request.urlopen(req)
me = json.loads(r.read())
print(f"Me: {me}")
