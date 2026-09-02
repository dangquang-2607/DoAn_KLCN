from fastapi.testclient import TestClient

def test_create_account(client: TestClient, user_token):
    # 1. Tạo tài khoản
    res_account = client.post("/api/accounts", json={
        "name": "Test Bank",
        "account_type": "bank",
        "balance": 1000000,
        "currency": "VND"
    }, headers={"Authorization": f"Bearer {user_token}"})
    
    assert res_account.status_code == 201
    account_id = res_account.json()["id"]

    # 2. Kiểm tra danh sách tài khoản
    res_list = client.get("/api/accounts", headers={"Authorization": f"Bearer {user_token}"})
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1
    assert res_list.json()[0]["id"] == account_id

    # 3. Tạo danh mục (chạy dưới quyền Admin vì system category)
    # Nhưng category có thể cần tạo trước bằng admin token.
    # Trong test này ta chỉ test mock category hoặc tạo 1 user category.
    # User API chưa có POST /categories (chỉ admin), nên ta phải login admin để tạo.

def test_create_transaction_updates_balance(client: TestClient, user_token, admin_token):
    # 1. Tạo Category bằng Admin
    res_cat = client.post("/api/admin/categories", json={
        "name": "Lương",
        "type": "income",
        "icon": "💰"
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res_cat.status_code == 201
    cat_id = res_cat.json()["id"]

    # 2. Tạo Account bằng User (Số dư ban đầu 0)
    res_acc = client.post("/api/accounts", json={
        "name": "Ví Tiền Mặt",
        "account_type": "cash",
        "balance": 0,
        "currency": "VND"
    }, headers={"Authorization": f"Bearer {user_token}"})
    assert res_acc.status_code == 201
    acc_id = res_acc.json()["id"]

    # 3. Tạo Giao dịch Thu Nhập 500k
    res_txn = client.post("/api/transactions", json={
        "account_id": acc_id,
        "category_id": cat_id,
        "amount": 500000,
        "type": "income",
        "description": "Nhận lương",
        "transaction_date": "2026-08-24"
    }, headers={"Authorization": f"Bearer {user_token}"})
    assert res_txn.status_code == 201
    assert float(res_txn.json()["amount"]) == 500000

    # 4. Kiểm tra số dư Account đã tăng lên 500k chưa
    res_acc_check = client.get("/api/accounts", headers={"Authorization": f"Bearer {user_token}"})
    updated_acc = next(a for a in res_acc_check.json() if a["id"] == acc_id)
    assert float(updated_acc["balance"]) == 500000

    # 5. Xóa Giao dịch, kiểm tra số dư giảm lại 0
    txn_id = res_txn.json()["id"]
    res_del = client.delete(f"/api/transactions/{txn_id}", headers={"Authorization": f"Bearer {user_token}"})
    assert res_del.status_code == 204

    res_acc_check2 = client.get("/api/accounts", headers={"Authorization": f"Bearer {user_token}"})
    updated_acc2 = next(a for a in res_acc_check2.json() if a["id"] == acc_id)
    assert float(updated_acc2["balance"]) == 0
