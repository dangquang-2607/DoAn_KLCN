"""
Smoke test: Register -> Login -> /me -> Admin promote -> Admin ban check
Run: .venv\Scripts\python smoke_test.py
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import sys
import urllib.request
import urllib.error
import json

BASE = "http://localhost:8000"


def req(method, path, data=None, token=None):
    body = json.dumps(data).encode() if data else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def check(label, status, expected, data):
    ok = status == expected
    mark = "OK" if ok else "FAIL"
    print(f"  [{mark}] {label}: HTTP {status}  {str(data)[:80]}")
    if not ok:
        sys.exit(1)
    return data


print("\n=== CapitalFlow API Smoke Test ===\n")

# 1. Health
s, d = req("GET", "/health")
check("/health", s, 200, d)

# 2. Register user
s, d = req("POST", "/api/auth/register", {
    "email": "testuser@capitalflow.vn",
    "password": "Test123!",
    "full_name": "Test User"
})
check("Register user", s, 201, d)

# 3. Login
s, d = req("POST", "/api/auth/login", {
    "email": "testuser@capitalflow.vn",
    "password": "Test123!"
})
d = check("Login", s, 200, d)
token = d["access_token"]

# 4. /auth/me
s, d = req("GET", "/api/auth/me", token=token)
d = check("/auth/me", s, 200, d)
print(f"         role={d['role']}, email={d['email']}")

# 5. Create account
s, d = req("POST", "/api/accounts", {
    "name": "Ví chính",
    "account_type": "cash",
    "balance": "1000000",
    "currency": "VND"
}, token=token)
d = check("Create account", s, 201, d)
account_id = d["id"]

# 6. Create category
s, d = req("POST", "/api/categories", {
    "name": "Ăn uống",
    "type": "expense",
    "icon": "🍜"
}, token=token)
d = check("Create category", s, 201, d)
cat_id = d["id"]

# 7. Create transaction
s, d = req("POST", "/api/transactions", {
    "account_id": account_id,
    "category_id": cat_id,
    "description": "Phở bò Hà Nội",
    "amount": "75000",
    "type": "expense",
    "transaction_date": "2026-08-24"
}, token=token)
check("Create transaction", s, 201, d)

# 8. Dashboard
s, d = req("GET", "/api/dashboard", token=token)
d = check("Dashboard", s, 200, d)
print(f"         net_worth={d['net_worth']}, expense={d['expense_this_month']}")

# 9. Admin endpoint rejected for normal user
s, d = req("GET", "/api/admin/dashboard/stats", token=token)
check("Admin blocked for user", s, 403, d)

print("\n=== ALL TESTS PASSED ===\n")
