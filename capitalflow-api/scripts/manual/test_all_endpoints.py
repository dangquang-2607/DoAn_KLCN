import httpx

base_url = "http://localhost:8000/api/v1"
client = httpx.Client(base_url=base_url, follow_redirects=True)

def test_endpoints():
    print("--- 1. Testing Login ---")
    resp = client.post("/auth/login", json={"email": "admin@capitalflow.vn", "password": "CapitalFlow@2026"})
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code} - {resp.text}")
        return
    token = resp.json()["access_token"]
    print("Login successful.")
    
    headers = {"Authorization": f"Bearer {token}"}
    client.headers.update(headers)
    
    print("\n--- 2. Testing /auth/me ---")
    resp = client.get("/auth/me")
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print(resp.text)
        
    print("\n--- 3. Testing Accounts ---")
    resp = client.post("/accounts", json={"name": "Test Bank", "account_type": "BANK", "balance": 1000000, "currency": "VND", "color": "#000000"})
    print(f"Create Account Status: {resp.status_code}")
    if resp.status_code != 201:
         print(resp.text)
    else:
         acc_id = resp.json()["id"]
         resp = client.get("/accounts")
         print(f"List Accounts Status: {resp.status_code} - Count: {len(resp.json())}")
    
    print("\n--- 4. Testing Categories ---")
    resp = client.get("/categories")
    print(f"List Categories Status: {resp.status_code} - Count: {len(resp.json())}")
    
    print("\n--- 5. Testing Transactions ---")
    if 'acc_id' in locals():
        cat_id = resp.json()[0]["id"] if len(resp.json()) > 0 else None
        if cat_id:
            resp = client.post("/transactions", json={
                "account_id": acc_id,
                "category_id": cat_id,
                "amount": 50000,
                "type": "EXPENSE",
                "transaction_date": "2026-08-25",
                "description": "Test transaction",
                "note": "Note"
            })
            print(f"Create Transaction Status: {resp.status_code}")
            if resp.status_code != 201:
                 print(resp.text)
            
            resp = client.get("/transactions")
            print(f"List Transactions Status: {resp.status_code} - Count: {resp.json().get('total', 0)}")
            
    print("\n--- 6. Testing Budgets ---")
    resp = client.get("/budgets")
    print(f"List Budgets Status: {resp.status_code}")
    if resp.status_code != 200: print(resp.text)
    
    print("\n--- 7. Testing Dashboard ---")
    resp = client.get("/dashboard")
    print(f"Dashboard Overview Status: {resp.status_code}")
    if resp.status_code != 200: print(resp.text)

    print("\n--- 8. Testing Analytics ---")
    resp = client.get("/analytics")
    print(f"Analytics Spending Status: {resp.status_code}")
    if resp.status_code != 200: print(resp.text)

if __name__ == "__main__":
    test_endpoints()
