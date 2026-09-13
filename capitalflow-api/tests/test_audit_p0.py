from datetime import date
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4
import asyncio
import httpx
from sqlalchemy import select, func
from app.models.invoice import Invoice
from app.models.transaction import Transaction
from app.models.account import Account
from app.api.routes.invoices import confirm_invoice
from app.schemas.invoice import InvoiceConfirm
from app.core.security import create_access_token
from app.api.routes.auth import _create_refresh_token
from app.services import gemini_service
from tests.test_transactions import headers


def test_regular_user_cannot_use_first_time_endpoint(client,user_token):
    assert client.post("/api/v1/auth/first-time-password",headers=headers(user_token),json={"new_password":"replaced123"}).status_code==403


def test_setup_session_is_restricted_and_consumed(client,db,test_user):
    test_user.must_change_password=True;db.commit()
    token=create_access_token(str(test_user.id),test_user.role,test_user.token_version)
    assert client.get("/api/v1/accounts",headers=headers(token)).status_code==403
    assert client.get("/api/v1/auth/me",headers=headers(token)).status_code==200
    assert client.post("/api/v1/auth/first-time-password",headers=headers(token),json={"new_password":"changed123"}).status_code==200
    assert client.get("/api/v1/auth/me",headers=headers(token)).status_code==401


def test_password_change_revokes_existing_tokens(client,db,test_user,user_token):
    raw,_=_create_refresh_token(db,test_user.id,uuid4());db.commit()
    assert client.post("/api/v1/auth/change-password",headers=headers(user_token),json={"current_password":"password123","new_password":"changed123"}).status_code==200
    assert client.get("/api/v1/auth/me",headers=headers(user_token)).status_code==401
    assert client.post("/api/v1/auth/refresh",json={"refresh_token":raw}).status_code==401


def invoice_fixture(db,user):
    a=Account(user_id=user.id,name="A",account_type="BANK",balance=Decimal("1000"),currency="VND")
    db.add(a);db.flush()
    invoice=Invoice(user_id=user.id,status="REVIEW_REQUIRED",invoice_date=date.today(),total_amount=Decimal("100"),currency="VND")
    db.add(invoice);db.commit()
    return a.id,invoice.id


def test_invoice_failure_rolls_back_all_money(db,test_user):
    aid,iid=invoice_fixture(db,test_user)
    with patch.object(db,"commit",side_effect=RuntimeError("injected persistence failure")):
        try:confirm_invoice(iid,InvoiceConfirm(account_id=aid),db,test_user)
        except RuntimeError:db.rollback()
        else:raise AssertionError("Expected failure")
    assert db.get(Account,aid).balance==1000
    assert db.get(Invoice,iid).status=="REVIEW_REQUIRED"
    assert db.scalar(select(func.count()).select_from(Transaction).where(Transaction.invoice_id==iid))==0


def test_invoice_confirm_retry_returns_same_transaction(db,test_user):
    aid,iid=invoice_fixture(db,test_user)
    first=confirm_invoice(iid,InvoiceConfirm(account_id=aid),db,test_user)
    second=confirm_invoice(iid,InvoiceConfirm(account_id=aid),db,test_user)
    assert first==second
    assert db.get(Account,aid).balance==900
    assert db.scalar(select(func.count()).select_from(Transaction).where(Transaction.invoice_id==iid))==1


def test_provider_key_not_exposed(monkeypatch,caplog):
    key="AUDIT_DUMMY_SECRET"
    monkeypatch.setattr(gemini_service.settings,"google_ai_api_key",key)
    async def fail(self,url,**kwargs):
        assert "params" not in kwargs
        assert kwargs["headers"]["x-goog-api-key"]==key
        return httpx.Response(403,request=httpx.Request("POST",url))
    monkeypatch.setattr(httpx.AsyncClient,"post",fail)
    try:asyncio.run(gemini_service.run_gemini_ocr(b"test","image/png"))
    except RuntimeError as exc:assert key not in str(exc)
    else:raise AssertionError("Expected provider failure")
    assert key not in caplog.text
