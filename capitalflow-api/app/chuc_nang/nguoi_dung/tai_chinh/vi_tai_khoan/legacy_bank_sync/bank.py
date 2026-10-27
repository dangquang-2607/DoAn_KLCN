"""Legacy bank-sync compatibility. Not registered in independent-wallet mode."""
import json
from copy import deepcopy
import uuid
from datetime import datetime, timedelta, date, timezone
from decimal import Decimal
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from ..luu_tru.account import Account
from .demo_catalog import DEMO_ACCOUNTS, DemoAccount, find_demo
from .demo_source import SourceUnavailable, read_source, MAX_MONEY
from ..number_rules import mask_account_number, NUMBER_RULES
from ..link_otp import consume_otp
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luy_dang import idempotent_money
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.so_cai import record_balance_adjustment
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.dich_vu import emit_notification, maybe_emit_unusual_transaction
from app.dung_chung.tac_vu_nen.hang_doi import enqueue

router = APIRouter(prefix="/accounts", tags=["Demo Banking"])
BANKS = {key: rule["name"] for key, rule in NUMBER_RULES.items()}
SCOPES = ["Thông tin tài khoản", "Số dư", "Lịch sử giao dịch"]
PAGE_SIZE = 100


def fetch_source(state):
    if state.get("outage"):
        raise SourceUnavailable("Ngân hàng mô phỏng đang gián đoạn.")
    provider = state["bank_code"]
    demo = DEMO_ACCOUNTS.get(provider)
    if demo is None or state.get("external_account") not in demo.aliases:
        raise SourceUnavailable("Tài khoản nguồn không khớp ngân hàng mô phỏng.")
    data = read_source(provider)
    events = [e.model_dump(mode="json") for e in data.events]
    by_id = {e["id"]: e for e in events}
    # Preserve per-wallet events made by the old demo buttons, without copying
    # private wallet state into the shared public JSON file.
    retained_ids = set(state.get("retained_event_ids", []))
    if state.get("source_format") != "json":
        retained_ids.update(e["id"] for e in state.get("events", []) if e["id"].startswith("demo-"))
    retained = []
    for old in state.get("events", []):
        new = by_id.get(old["id"])
        if new is None:
            if old["id"] in retained_ids:
                retained.append(deepcopy(old))
                continue
            raise SourceUnavailable("File JSON thiếu giao dịch đã đọc trước đó. Không xóa hoặc đổi mã giao dịch cũ.")
        if old["status"] == "BOOKED" and new["status"] != "BOOKED":
            raise SourceUnavailable("Không chuyển giao dịch đã hoàn tất về đang chờ. Hãy thêm giao dịch điều chỉnh với mã mới.")
    result = deepcopy(state)
    result.update(opening_balance=str(data.opening_balance), events=events + retained,
                  source_format="json", retained_event_ids=[e["id"] for e in retained])
    if abs(source_balance(result)) > MAX_MONEY:
        raise SourceUnavailable("Số dư nguồn vượt giới hạn lưu trữ.")
    return result

class Command(BaseModel):
    action: Literal["link", "sync", "disconnect", "outage", "restore", "expire"]
    account_number: str | None = Field(default=None, pattern=r"^[0-9]{6,20}$")
    otp: str | None = Field(default=None, pattern=r"^[0-9]{6}$")
    otp_request_id: uuid.UUID | None = None

def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def today_vn():
    return datetime.now(timezone(timedelta(hours=7))).date()

def read_state(account):
    return json.loads(account.bank_state) if account.bank_state else {}

def owned(db, user, account_id):
    account = db.scalar(select(Account).where(Account.id == account_id, Account.user_id == user.id,
        Account.is_active == True).with_hint(Account, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"))
    if not account:
        raise HTTPException(404, "Không tìm thấy ví")
    return account

def source_balance(state):
    return Decimal(state["opening_balance"]) + sum(
        (Decimal(e["amount"]) for e in state["events"] if e["status"] == "BOOKED"), Decimal(0))

def view(state):
    if state and state.get("version") != 2:
        return {"stage": "LEGACY", "demo": True, "scopes": SCOPES, "last_sync": state.get("last_sync"), "linked": False}
    public = {key: value for key, value in state.items() if key != "imported"}
    public.update(demo=True, scopes=SCOPES)
    if state.get("stage") == "CONNECTED" and now().isoformat() >= state.get("consent_expires", ""):
        public["stage"] = "EXPIRED"
    if state.get("external_account") and state.get("last_sync") and not state.get("outage"):
        public["provider_balance"] = str(source_balance(state))
        public["available_balance"] = str(source_balance(state) + sum(
            (min(Decimal(e["amount"]), Decimal(0)) for e in state["events"] if e["status"] == "PENDING"), Decimal(0)))
    return public

def ensure_unique(db, user, demo: DemoAccount, account_id=None):
    for other in db.scalars(select(Account).where(Account.user_id == user.id)):
        if other.id != account_id and read_state(other).get("external_account") in demo.aliases:
            raise HTTPException(409, "Tài khoản mẫu đã thuộc một ví khác. Hãy mở ví đó để liên kết lại.")

def sync_account(db, user, acc, state):
    """Page through source history, upsert transactions, then use source snapshot.
    Initial history starts 90 days back; subsequent scans revisit known events.
    This local simulator scans all pages, not a real provider delta cursor.
    """
    source = fetch_source(state)
    changed = 0
    lower = date.fromisoformat(state["history_from"])
    for start in range(0, len(source["events"]), PAGE_SIZE):
        for event in source["events"][start:start + PAGE_SIZE]:
            ref = f"{state['bank_code']}:{state['external_account']}:{event['id']}"
            txn = db.scalar(select(Transaction).where(Transaction.account_id == acc.id, Transaction.bank_reference == ref))
            if txn is None and date.fromisoformat(event["date"]) < lower:
                continue
            if event["status"] != "BOOKED":
                continue
            amount = Decimal(event["amount"])
            if txn is None:
                txn = Transaction(user_id=user.id, account_id=acc.id, bank_reference=ref,
                    source="IMPORT", kind="NORMAL", amount=amount,
                    type="INCOME" if amount >= 0 else "EXPENSE",
                    description=event["description"], transaction_date=date.fromisoformat(event["date"]))
                db.add(txn)
                acc.balance += amount
                db.flush()
                maybe_emit_unusual_transaction(db, txn)
                if amount < 0:
                    enqueue(db, "BUDGET", {"user_id": str(user.id), "transaction_id": str(txn.id)}, "budget-check:" + str(txn.id))
                changed += 1
            elif (txn.amount != amount or txn.description != event["description"]
                  or txn.transaction_date != date.fromisoformat(event["date"])):
                budget_changed = txn.amount != amount or txn.transaction_date != date.fromisoformat(event["date"])
                acc.balance += amount - txn.amount
                txn.amount = amount
                txn.type = "INCOME" if amount >= 0 else "EXPENSE"
                txn.description = event["description"]
                txn.transaction_date = date.fromisoformat(event["date"])
                if budget_changed and amount < 0:
                    # Each actual correction needs a new check, including A -> B -> A.
                    # Unchanged syncs never enter this branch; request replay and
                    # the enclosing transaction prevent duplicate/partial writes.
                    enqueue(db, "BUDGET", {"user_id": str(user.id), "transaction_id": str(txn.id)},
                            "budget-check:bank-update:" + str(txn.id) + ":" + str(uuid.uuid4()))
                changed += 1
    # SYSTEM adjustment anchors incomplete history; excluded from income/expense.
    # Never change provider data to match a local balance.
    record_balance_adjustment(db, acc, user.id, source_balance(source))
    state.update(opening_balance=source["opening_balance"], events=source["events"],
                 source_format="json", retained_event_ids=source["retained_event_ids"])
    state.update(last_sync=now().isoformat(), last_imported=changed, source_balance=str(acc.balance), sync_error=None)
    acc.bank_state = json.dumps(state, ensure_ascii=True)
    db.flush()

def attempt_sync(db, user, acc, state):
    # Flush the verified link before the savepoint. A source failure rolls back
    # only imports/adjustments, preserving the link and last successful balance.
    acc.bank_state = json.dumps(state, ensure_ascii=True)
    db.flush()
    candidate = deepcopy(state)
    try:
        with db.begin_nested():
            sync_account(db, user, acc, candidate)
    except (ConnectionError, TimeoutError) as exc:
        reason = str(exc) if isinstance(exc, SourceUnavailable) else "Không lấy được dữ liệu ngân hàng."
        state["sync_error"] = (reason + " " +
            ("Đang hiển thị số dư tại lần đồng bộ thành công gần nhất." if state.get("last_sync")
             else "Chưa có dữ liệu số dư. Vui lòng thử đồng bộ lại."))
        state["last_sync_attempt"] = now().isoformat()
    else:
        state.update(candidate)
        state["last_sync_attempt"] = state["last_sync"]
    acc.bank_state = json.dumps(state, ensure_ascii=True)
    db.flush()

def connect_account(db, user, acc, demo: DemoAccount):
    ensure_unique(db, user, demo, acc.id)
    state = read_state(acc)
    if state.get("version") == 2 and state.get("external_account") not in demo.aliases:
        raise HTTPException(409, "Hãy tạo ví mới để đổi tài khoản ngân hàng.")
    if state.get("version") != 2:
        today = today_vn()
        state = {"version": 2, "bank_code": demo.provider, "external_account": demo.id,
            "opening_balance": "0", "events": [],
            "history_from": (today - timedelta(days=89)).isoformat()}

    state.update(stage="CONNECTED", linked=True, consent_expires=(now() + timedelta(days=90)).isoformat())
    acc.account_number_masked = mask_account_number(demo.number)
    attempt_sync(db, user, acc, state)
    emit_notification(db, user_id=user.id, kind="BANK", title="Đã liên kết ngân hàng mô phỏng",
        message=f"{acc.name} đã xác nhận liên kết." + (" Chưa lấy được dữ liệu mới." if state.get("sync_error") else " Đã lấy số dư và lịch sử giao dịch."),
        source_type="ACCOUNT", source_id=acc.id, action_url="/accounts")

@router.get("/demo-banks")
def banks(user: User = Depends(get_current_user)):
    return BANKS

@router.get("/{account_id}/bank")
def status(account_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    acc = owned(db, user, account_id)
    return {**view(read_state(acc)), "account_number_masked": acc.account_number_masked}

@router.post("/{account_id}/bank")
@idempotent_money
def command(account_id: uuid.UUID, payload: Command, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    acc = owned(db, user, account_id)
    if acc.account_type not in ("LINKED", "BANK", "E_WALLET"):
        raise HTTPException(422, "Chỉ ví liên kết mới được kết nối")
    state = read_state(acc)
    action = payload.action
    if action == "link":
        try:
            demo = find_demo(acc.institution_name, payload.account_number)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from None
        ensure_unique(db, user, demo, acc.id)
        if state.get("version") == 2 and state.get("external_account") not in demo.aliases:
            raise HTTPException(409, "Hãy tạo ví mới để đổi tài khoản ngân hàng.")
        consume_otp(db, user, payload.otp_request_id, payload.otp, demo.id, acc.id)
        connect_account(db, user, acc, demo)
        return {**view(read_state(acc)), "account_number_masked": acc.account_number_masked}
    if action == "disconnect":
        state.update(stage="DISCONNECTED", linked=False)
    else:
        if state.get("version") != 2:
            raise HTTPException(409, "Ví dùng mẫu cũ. Hãy liên kết lại bằng tài khoản mẫu mới và OTP email.")
        if not state.get("linked") or view(state).get("stage") != "CONNECTED":
            raise HTTPException(409, "Hãy xác nhận lại liên kết qua OTP email.")
        if action == "sync":
            attempt_sync(db, user, acc, state)
        elif action in ("outage", "restore"):
            state["outage"] = action == "outage"
        elif action == "expire":
            state["consent_expires"] = now().isoformat()
    acc.bank_state = json.dumps(state, ensure_ascii=True)
    db.flush()
    return {**view(state), "account_number_masked": acc.account_number_masked}
