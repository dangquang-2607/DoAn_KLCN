from datetime import date
from decimal import Decimal
from uuid import UUID
from sqlalchemy import select
from app.models.account import Account
from app.models.transaction import Transaction


def headers(token): return {"Authorization": f"Bearer {token}"}


def account(client, token, name, balance):
    response = client.post("/api/v1/accounts", headers=headers(token), json={"name": name, "account_type": "BANK", "balance": balance})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_normal_transaction_lifecycle(client, user_token):
    acc = account(client, user_token, "A", 0)
    response = client.post("/api/v1/transactions", headers=headers(user_token), json={"account_id": acc, "type": "INCOME", "amount": 500000, "transaction_date": str(date.today())})
    assert response.status_code == 201, response.text
    tx = response.json()["id"]
    assert client.patch(f"/api/v1/transactions/{tx}", headers=headers(user_token), json={"amount": 200000}).status_code == 200
    assert Decimal(client.get("/api/v1/accounts", headers=headers(user_token)).json()[0]["balance"]) == 200000
    assert client.delete(f"/api/v1/transactions/{tx}", headers=headers(user_token)).status_code == 204
    assert Decimal(client.get("/api/v1/accounts", headers=headers(user_token)).json()[0]["balance"]) == 0


def test_transfer_cannot_mint_money_or_distort_reports(client, user_token, db):
    a, b = account(client, user_token, "A", 1000000), account(client, user_token, "B", 0)
    budget = client.post("/api/v1/budgets", headers=headers(user_token), json={"name":"Total", "amount_limit":100, "start_date":str(date.today()), "end_date":str(date.today())})
    assert budget.status_code == 201, budget.text
    response = client.post("/api/v1/transactions/transfer", headers=headers(user_token), json={"from_account_id":a,"to_account_id":b,"amount":1000000})
    assert response.status_code == 201, response.text
    pair = response.json()
    for key in ("transfer_out_id", "transfer_in_id"):
        tx = pair[key]
        assert client.delete(f"/api/v1/transactions/{tx}",headers=headers(user_token)).status_code == 409
        assert client.patch(f"/api/v1/transactions/{tx}",headers=headers(user_token),json={"amount":1}).status_code == 409
    wallets=client.get("/api/v1/accounts",headers=headers(user_token)).json()
    assert sum(Decimal(w["balance"]) for w in wallets)==1000000
    legs=db.scalars(select(Transaction).where(Transaction.kind=="TRANSFER")).all()
    assert len(legs)==2 and legs[0].transfer_id==legs[1].transfer_id
    assert client.get("/api/v1/analytics",headers=headers(user_token)).json()["summary"]=={"income":0,"expense":0,"net":0}
    progress=client.get("/api/v1/budgets",headers=headers(user_token)).json()[0]
    assert Decimal(progress["spent_amount"])==0
    dashboard=client.get("/api/v1/dashboard",headers=headers(user_token)).json()
    assert dashboard["net_worth"]==1000000 and dashboard["expense_this_month"]==0


def test_adjustment_is_immutable_and_reconciles(client,user_token,db):
    a=account(client,user_token,"A",100)
    response=client.patch(f"/api/v1/accounts/{a}",headers=headers(user_token),json={"balance":250})
    assert response.status_code==200,response.text
    entries=db.scalars(select(Transaction).where(Transaction.account_id==UUID(a))).all()
    assert sum(t.amount for t in entries)==250
    assert all(t.kind=="ADJUSTMENT" for t in entries)
    assert any("100" in t.note and "250" in t.note for t in entries)
    assert client.delete(f"/api/v1/transactions/{entries[-1].id}",headers=headers(user_token)).status_code==409


def test_failed_transfer_preserves_balances(client,user_token):
    a,b=account(client,user_token,"A",100),account(client,user_token,"B",0)
    response=client.post("/api/v1/transactions/transfer",headers=headers(user_token),json={"from_account_id":a,"to_account_id":b,"amount":101})
    assert response.status_code==400
    assert sum(Decimal(w["balance"]) for w in client.get("/api/v1/accounts",headers=headers(user_token)).json())==100



def test_expense_can_move_wallets_and_change_type(client,user_token):
    a,b=account(client,user_token,"A",100),account(client,user_token,"B",100)
    tx=client.post("/api/v1/transactions",headers=headers(user_token),json={"account_id":a,"amount":40,"type":"EXPENSE","transaction_date":str(date.today())}).json()["id"]
    response=client.patch(f"/api/v1/transactions/{tx}",headers=headers(user_token),json={"account_id":b,"amount":20,"type":"INCOME"})
    assert response.status_code==200,response.text
    balances={w["id"]:Decimal(w["balance"]) for w in client.get("/api/v1/accounts",headers=headers(user_token)).json()}
    assert balances[a]==100 and balances[b]==120


def test_create_and_update_reject_invalid_amount_through_api(client,user_token):
    a=account(client,user_token,"A",0)
    payload={"account_id":a,"amount":1,"type":"INCOME","transaction_date":str(date.today())}
    response=client.post("/api/v1/transactions",headers=headers(user_token),json=payload)
    tx=response.json()["id"]
    for amount in [0,-1]:
        assert client.post("/api/v1/transactions",headers=headers(user_token),json={**payload,"amount":amount}).status_code==422
        assert client.patch(f"/api/v1/transactions/{tx}",headers=headers(user_token),json={"amount":amount}).status_code==422
    assert Decimal(client.get("/api/v1/accounts",headers=headers(user_token)).json()[0]["balance"])==1
