from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4
from unittest.mock import patch
import jwt
import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.schema import CreateIndex
from sqlalchemy.dialects import mssql
from app.core.config import settings
from app.models.category import Category
from app.models.budget import Budget
from app.models.refresh_token import RefreshToken
from app.models.transaction import Transaction
from app.schemas.auth import RegisterRequest
from app.schemas.transaction import TransactionCreate, TransactionUpdate
from app.schemas.budget import BudgetCreate, BudgetUpdate
from app.services.email_service import EmailService
from app.api.routes.auth import _create_refresh_token
from tests.test_transactions import account, headers


@pytest.mark.parametrize("amount", [0,-1,"0.001","NaN","Infinity"])
def test_transaction_rejects_invalid_amount(amount):
    with pytest.raises(ValidationError): TransactionCreate(account_id=uuid4(),amount=amount,type="EXPENSE",transaction_date=date.today())
    with pytest.raises(ValidationError): TransactionUpdate(amount=amount)


@pytest.mark.parametrize("password", ["", "x", "abcde", "x"*129])
def test_weak_registration_rejected(password):
    with pytest.raises(ValidationError): RegisterRequest(email="audit@example.com",password=password)


@pytest.mark.parametrize("currency",["USD","XYZ",""])
def test_budget_currency(currency):
    with pytest.raises(ValidationError): BudgetCreate(name="Budget",amount_limit=10,start_date=date.today(),end_date=date.today(),currency=currency)
    with pytest.raises(ValidationError): BudgetUpdate(currency=currency)


def test_register_limited_before_email_or_hash_work(client,offline,db):
    for i in range(5):
        response=client.post("/api/v1/auth/register",json={"email":f"person{i}@example.com","password":"secret123","full_name":"Audit"})
        assert response.status_code==201,response.text
    response=client.post("/api/v1/auth/register",json={"email":"limited@example.com","password":"secret123"})
    assert response.status_code==429,response.text
    assert offline.call_count==0
    drain_jobs(db)
    assert offline.call_count==5


@pytest.mark.parametrize("claim",[None,"refresh","reset"])
def test_wrong_token_type_cannot_authenticate(client,test_user,claim):
    payload={"sub":str(test_user.id),"exp":datetime.now(timezone.utc)+timedelta(minutes=2),"ver":0}
    if claim is not None:payload["type"]=claim
    token=jwt.encode(payload,settings.jwt_secret_key,algorithm=settings.jwt_algorithm)
    assert client.get("/api/v1/auth/me",headers=headers(token)).status_code==401


@pytest.mark.parametrize("bulk",[False,True])
def test_ban_revokes_sessions_after_unban(client,db,test_user,test_admin,user_token,admin_token,bulk):
    raw,_=_create_refresh_token(db,test_user.id,uuid4());db.commit()
    if bulk:
        response=client.post("/api/v1/admin/users/bulk-ban",headers=headers(admin_token),json={"user_ids":[str(test_user.id)],"reason":"Audit"})
    else:
        response=client.patch(f"/api/v1/admin/users/{test_user.id}/ban",headers=headers(admin_token))
    assert response.status_code==200,response.text
    assert db.scalars(select(RefreshToken)).first().revoked_at is not None
    assert client.patch(f"/api/v1/admin/users/{test_user.id}/unban",headers=headers(admin_token)).status_code==200
    assert client.get("/api/v1/auth/me",headers=headers(user_token)).status_code==401
    assert client.post("/api/v1/auth/refresh",json={"refresh_token":raw}).status_code==401


def test_email_markup_escaped(offline):
    markup='<a href="https://example.invalid">audit</a>'
    EmailService.send_welcome_email("audit@example.com",markup)
    html=offline.call_args.args[2]
    assert markup not in html and "&lt;a href=" in html
    EmailService.send_budget_alert_email("audit@example.com",markup,markup,100,90,90)
    assert markup not in offline.call_args.args[2]


def test_category_crud_owner_and_history(client,db,user_token,admin_token,test_admin):
    global_cat=Category(name="Global",type="EXPENSE",owner_user_id=None);db.add(global_cat);db.commit()
    for token in (user_token,admin_token):
        assert client.patch(f"/api/v1/categories/{global_cat.id}",headers=headers(token),json={"name":"No"}).status_code==404
    response=client.post("/api/v1/categories",headers=headers(user_token),json={"name":"Food","type":"EXPENSE"})
    assert response.status_code==201,response.text
    cat=response.json()["id"]
    assert client.patch(f"/api/v1/categories/{cat}",headers=headers(admin_token),json={"name":"No"}).status_code==404
    assert client.patch(f"/api/v1/categories/{cat}",headers=headers(user_token),json={"name":"Meals"}).status_code==200
    a=account(client,user_token,"A",100)
    response=client.post("/api/v1/transactions",headers=headers(user_token),json={"account_id":a,"category_id":cat,"amount":10,"type":"EXPENSE","transaction_date":str(date.today())})
    assert response.status_code==201,response.text
    assert client.patch(f"/api/v1/categories/{cat}",headers=headers(user_token),json={"type":"INCOME"}).status_code==409
    assert client.delete(f"/api/v1/categories/{cat}",headers=headers(user_token)).status_code==204
    assert db.get(Category,UUID(cat)) is not None
    assert cat not in [x["id"] for x in client.get("/api/v1/categories",headers=headers(user_token)).json()]
    assert db.scalars(select(Transaction).where(Transaction.category_id==UUID(cat))).first() is not None


def test_unique_scopes_and_duplicate_budget(client,user_token,admin_token):
    for token in (user_token,admin_token):
        assert client.post("/api/v1/categories",headers=headers(token),json={"name":"Shared name","type":"EXPENSE"}).status_code==201
    assert client.post("/api/v1/categories",headers=headers(user_token),json={"name":"Shared name","type":"EXPENSE"}).status_code==409
    payload={"name":"Overall","amount_limit":100,"start_date":str(date.today()),"end_date":str(date.today())}
    assert client.post("/api/v1/budgets",headers=headers(user_token),json=payload).status_code==201
    assert client.post("/api/v1/budgets",headers=headers(user_token),json=payload).status_code==409


def test_mssql_filtered_indexes():
    for model,names in ((Category,["UX_categories_global_name_type","UX_categories_user_name_type"]),(Budget,["UX_budgets_user_category_period","UX_budgets_user_overall_period"])):
        indexes={idx.name:idx for idx in model.__table__.indexes}
        for name in names:
            sql=str(CreateIndex(indexes[name]).compile(dialect=mssql.dialect()))
            assert "UNIQUE" in sql and "WHERE" in sql


def test_user_cannot_forge_system_source(client,user_token):
    a=account(client,user_token,"A",0)
    response=client.post("/api/v1/transactions",headers=headers(user_token),json={"account_id":a,"amount":100,"type":"INCOME","source":"SYSTEM","transaction_date":str(date.today())})
    assert response.status_code==422


@pytest.mark.parametrize("field,value",[("type","EXPENSE"),("account_id",None),("amount",None),("transaction_date",None)])
def test_update_required_fields_and_type_rules(field,value):
    if value is None:
        with pytest.raises(ValidationError): TransactionUpdate(**{field:value})
    else:
        assert TransactionUpdate(**{field:value}).type==value


def test_refresh_rotation_issues_current_version(client,db,test_user,user_token):
    raw,_=_create_refresh_token(db,test_user.id,uuid4());db.commit()
    response=client.post("/api/v1/auth/refresh",json={"refresh_token":raw})
    assert response.status_code==200,response.text
    data=response.json()
    assert data["refresh_token"] != raw
    assert client.get("/api/v1/auth/me",headers=headers(data["access_token"])).status_code==200
    assert client.post("/api/v1/auth/refresh",json={"refresh_token":raw}).status_code==401
    assert client.post("/api/v1/auth/refresh",json={"refresh_token":data["refresh_token"]}).status_code==401


def test_transfer_does_not_trigger_false_budget_email(client,user_token,offline,db):
    a,b=account(client,user_token,"A",1000),account(client,user_token,"B",0)
    payload={"name":"Total","amount_limit":100,"start_date":str(date.today()),"end_date":str(date.today())}
    assert client.post("/api/v1/budgets",headers=headers(user_token),json=payload).status_code==201
    assert client.post("/api/v1/transactions/transfer",headers=headers(user_token),json={"from_account_id":a,"to_account_id":b,"amount":500}).status_code==201
    assert client.post("/api/v1/transactions",headers=headers(user_token),json={"account_id":a,"type":"EXPENSE","amount":10,"transaction_date":str(date.today())}).status_code==201
    drain_jobs(db)
    assert offline.call_count==0
    assert client.post("/api/v1/transactions",headers=headers(user_token),json={"account_id":a,"type":"EXPENSE","amount":75,"transaction_date":str(date.today())}).status_code==201
    drain_jobs(db)
    assert offline.call_count==1


def test_budget_update_currency_date_and_owner_checks(client,user_token,admin_token):
    other=client.post("/api/v1/categories",headers=headers(admin_token),json={"name":"Private","type":"EXPENSE"}).json()["id"]
    payload={"name":"Total","amount_limit":100,"start_date":"2026-01-01","end_date":"2026-01-31"}
    assert client.post("/api/v1/budgets",headers=headers(user_token),json={**payload,"category_id":other}).status_code==422
    response=client.post("/api/v1/budgets",headers=headers(user_token),json=payload)
    assert response.status_code==201
    identifier=response.json()["id"]
    for update in ({"currency":"USD"},{"currency":None},{"end_date":"2025-01-01"}):
        assert client.patch(f"/api/v1/budgets/{identifier}",headers=headers(user_token),json=update).status_code==422


def test_category_html_is_not_executable_in_account_notices(offline):
    markup='<img src=x onerror="alert(1)">'
    EmailService.send_account_banned_email("audit@example.com",markup,markup)
    assert markup not in offline.call_args.args[2]
    EmailService.send_account_unbanned_email("audit@example.com",markup)
    assert markup not in offline.call_args.args[2]
    EmailService.send_role_updated_email("audit@example.com",markup,markup)
    assert markup not in offline.call_args.args[2]


def drain_jobs(db):
    from sqlalchemy.orm import sessionmaker
    from app.services.worker import run_once
    sessions=sessionmaker(bind=db.bind,autoflush=False)
    for _ in range(100):
        if not run_once(sessions):break
    else:raise AssertionError("Worker did not drain")
    db.expire_all()
