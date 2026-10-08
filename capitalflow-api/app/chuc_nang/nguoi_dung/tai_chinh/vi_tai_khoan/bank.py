"""Ngân hàng mô phỏng: consent → login → OTP → chọn tài khoản → sync.
Không gửi request ra ngân hàng thật. Mọi trạng thái được lưu trong transaction
có khóa user; Idempotency-Key và bank_reference bảo vệ thao tác lặp.
"""
import json
import secrets
import uuid
from datetime import datetime, timedelta, date, timezone
from decimal import Decimal
from typing import Literal, TypedDict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luy_dang import idempotent_money
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.so_cai import record_balance_adjustment
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.dich_vu import emit_notification, maybe_emit_unusual_transaction
from app.dung_chung.tac_vu_nen.hang_doi import enqueue

router = APIRouter(prefix="/accounts", tags=["Demo Banking"])
BANKS = {"VCB": "Vietcombank", "ACB": "ACB", "MB": "MB Bank", "TCB": "Techcombank", "MOMO": "MoMo"}
SCOPES = ["Thông tin tài khoản", "Số dư", "Lịch sử giao dịch"]
class DemoAccountDefinition(TypedDict):
    opening: Decimal
    events: list[tuple[str, str, str, str]]


DEMO_ACCOUNTS: dict[str, DemoAccountDefinition] = {
    "5678": {"opening": Decimal("10000000"), "events": [
        ("salary-1", "5000000", "Lương demo", "BOOKED"),
        ("shopping-1", "-250000", "Mua sắm demo", "BOOKED"),
        ("pending-1", "-100000", "Thanh toán đang chờ", "PENDING"),
    ]},
    "9012": {"opening": Decimal("3000000"), "events": [
        ("interest-1", "50000", "Lãi tài khoản phụ demo", "BOOKED"),
        ("purchase-1", "-125000", "Mua hàng demo", "BOOKED"),
        ("pending-1", "-20000", "Thanh toán đang chờ", "PENDING"),
    ]},
}

class Command(BaseModel):
    action: Literal["consent", "login", "resend", "otp", "select", "sync", "disconnect",
                    "new_transaction", "settle_pending", "outage", "restore", "expire", "expire_otp"]
    consent: bool = False
    username: str = Field(default="", max_length=100)
    password: str = Field(default="", max_length=100)
    otp: str = Field(default="", max_length=10)
    account: Literal["5678", "9012"] = "5678"

def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def read_state(account):
    return json.loads(account.bank_state) if account.bank_state else {}

def owned(db, user, account_id):
    account = db.scalar(select(Account).where(Account.id == account_id, Account.user_id == user.id,
                        Account.is_active == True).with_hint(Account, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"))
    if not account:
        raise HTTPException(404, "Không tìm thấy ví")
    return account

def view(state):
    public = {k: v for k, v in state.items() if k not in {"otp_code"}}
    if state.get("stage") == "CONNECTED" and now().isoformat() >= state.get("consent_expires", ""):
        public["stage"] = "EXPIRED"
    public["demo"] = True
    public["scopes"] = SCOPES
    if state.get("external_account"):
        booked = Decimal(state.get("opening_balance", "10000000")) + sum(
            (Decimal(e["amount"]) for e in state.get("events", []) if e["status"] == "BOOKED"), Decimal("0"))
        pending = sum((Decimal(e["amount"]) for e in state.get("events", []) if e["status"] == "PENDING"), Decimal("0"))
        public["provider_balance"] = str(booked)
        public["available_balance"] = str(booked + pending)
    # Chỉ dữ liệu giả lập, mã demo hiển thị có chủ đích để trình diễn.
    public["demo_otp"] = state.get("otp_code") if state.get("stage") == "OTP" else None
    return public

@router.get("/demo-banks")
def banks(user: User = Depends(get_current_user)):
    return BANKS

@router.get("/{account_id}/bank")
def status(account_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return view(read_state(owned(db, user, account_id)))

@router.post("/{account_id}/bank")
@idempotent_money
def command(account_id: uuid.UUID, payload: Command, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    acc = owned(db, user, account_id)
    if acc.account_type not in ("LINKED", "BANK", "E_WALLET"):
        raise HTTPException(422, "Chỉ ví liên kết mới được kết nối")
    state = read_state(acc)
    previous_state = dict(state)
    action = payload.action
    def save(error: str | None = None):
        if error: state["error"] = error
        else: state.pop("error", None)
        state["updated_at"] = now().isoformat()
        acc.bank_state = json.dumps(state, ensure_ascii=True)
        current_stage = view(state)["stage"]
        previous_stage = view(previous_state).get("stage")
        event_code = None
        title = None
        message = None
        severity = "INFO"
        if error and error != previous_state.get("error"):
            event_code, title, message, severity = f"error:{action}", "Kết nối ngân hàng cần chú ý", error, "WARNING"
        elif current_stage == "CONNECTED" and previous_stage != "CONNECTED":
            event_code, title, message = "connected", "Đã liên kết ngân hàng", f"{acc.name} đã kết nối ngân hàng mô phỏng."
        elif current_stage == "DISCONNECTED" and previous_stage != "DISCONNECTED":
            event_code, title, message, severity = "disconnected", "Đã ngắt liên kết ngân hàng", f"{acc.name} đã ngắt kết nối ngân hàng mô phỏng.", "WARNING"
        elif current_stage == "EXPIRED" and previous_stage != "EXPIRED":
            event_code, title, message, severity = "expired", "Quyền truy cập ngân hàng hết hạn", f"{acc.name} cần cấp quyền lại để đồng bộ.", "WARNING"
        elif state.get("outage") and not previous_state.get("outage"):
            event_code, title, message, severity = "outage", "Ngân hàng tạm gián đoạn", f"{acc.name} chưa thể đồng bộ lúc này.", "WARNING"
        elif previous_state.get("outage") and not state.get("outage"):
            event_code, title, message = "restored", "Kết nối ngân hàng đã khôi phục", f"{acc.name} có thể đồng bộ trở lại."
        if event_code is not None and title is not None and message is not None:
            emit_notification(db, user_id=user.id, kind="BANK", severity=severity,
                              title=title, message=message, source_type="ACCOUNT", source_id=acc.id,
                              action_url="/accounts",
                              dedupe_key=f"bank:{acc.id}:{state.get('consent_at', '')}:{event_code}")
        db.flush()
        return view(state)

    if action == "consent":
        if not payload.consent:
            raise HTTPException(422, "Cần đồng ý quyền truy cập")
        if acc.institution_name not in BANKS and not state.get("bank_code"):
            raise HTTPException(422, "Chọn ngân hàng mô phỏng được hỗ trợ")
        if state.get("lock_until", "") > now().isoformat():
            return save("Tạm khóa 60 giây do nhập sai nhiều lần")
        state.pop("otp_code", None)
        state.update(stage="LOGIN", consent_at=now().isoformat(),
                     bank_code=state.get("bank_code") or acc.institution_name,
                     session_expires=(now()+timedelta(minutes=10)).isoformat(), attempts=0, sends=0, resend_at="")
        return save()
    if action == "disconnect":
        state.update(stage="DISCONNECTED", linked=False)
        state.pop("otp_code", None)
        return save()
    if action in ("login", "resend", "otp", "select"):
        if state.get("session_expires", "") <= now().isoformat():
            return save("Phiên xác thực hết hạn. Vui lòng cấp quyền lại.")
        if state.get("lock_until", "") > now().isoformat():
            return save("Tạm khóa 60 giây do nhập sai nhiều lần")
    if action == "login":
        if state.get("stage") != "LOGIN":
            raise HTTPException(409, "Bước xác thực không hợp lệ")
        if payload.username != "demo" or payload.password != "Demo@123":
            state["attempts"] = state.get("attempts", 0)+1
            if state["attempts"] >= 5:
                state["lock_until"] = (now()+timedelta(seconds=60)).isoformat()
            return save("Sai thông tin demo (demo / Demo@123)")
        state.update(stage="OTP", attempts=0)
        action = "resend"
    if action == "resend":
        if state.get("stage") != "OTP":
            raise HTTPException(409, "Chưa đăng nhập")
        if state.get("resend_at", "") > now().isoformat():
            return save("Chờ 30 giây trước khi gửi lại")
        if state.get("sends", 0) >= 3:
            return save("Đã hết lượt gửi OTP. Bắt đầu phiên mới.")
        state.update(otp_code=f"{secrets.randbelow(1000000):06d}",
                     otp_expires=(now()+timedelta(minutes=2)).isoformat(),
                     resend_at=(now()+timedelta(seconds=30)).isoformat(), sends=state.get("sends",0)+1)
        return save()
    if action == "otp":
        if state.get("stage") != "OTP":
            raise HTTPException(409, "Bước OTP không hợp lệ")
        if state.get("otp_expires", "") <= now().isoformat():
            return save("OTP hết hạn. Vui lòng gửi lại.")
        if payload.otp != state.get("otp_code"):
            state["attempts"] = state.get("attempts", 0)+1
            if state["attempts"] >= 5:
                state["lock_until"] = (now()+timedelta(seconds=60)).isoformat()
                state["stage"] = "LOGIN"
                state.pop("otp_code", None)
            return save("Mã OTP không đúng")
        state.update(stage="SELECT", attempts=0)
        state.pop("otp_code", None)
        return save()
    if action == "select":
        if state.get("stage") != "SELECT":
            raise HTTPException(409, "Cần xác thực OTP trước")
        if state.get("external_account") and state["external_account"] != payload.account:
            raise HTTPException(409, "Kết nối lại phải chọn cùng tài khoản; hãy tạo ví mới để đổi tài khoản")
        # Không cho cùng user liên kết hai ví với cùng tài khoản demo.
        for other in db.scalars(select(Account).where(Account.user_id == user.id, Account.id != acc.id)):
            other_state = read_state(other)
            if other_state.get("bank_code") == state["bank_code"] and other_state.get("external_account") == payload.account:
                raise HTTPException(409, "Tài khoản demo này đã thuộc một ví khác")
        if not state.get("external_account"):
            definition = DEMO_ACCOUNTS[payload.account]
            opening = definition["opening"]
            record_balance_adjustment(db, acc, user.id, opening)
            state.update(opening_balance=str(opening), events=[
                {"id": ref, "amount": amount, "description": description,
                 "status": status, "date": str(date.today())}
                for ref, amount, description, status in definition["events"]
            ], imported=[], source_balance=str(opening), counter=0)
        state.update(stage="CONNECTED", linked=True, external_account=payload.account, outage=False,
                     consent_expires=(now()+timedelta(days=90)).isoformat())
        acc.account_number_masked = "****"+payload.account
        action = "sync"
    if action in ("outage", "restore", "expire", "new_transaction", "settle_pending"):
        if not state.get("linked"):
            raise HTTPException(409, "Cần kết nối trước khi điều khiển demo")
        if action == "outage": state["outage"] = True
        if action == "restore": state["outage"] = False
        if action == "expire": state["consent_expires"] = now().isoformat()
        if action == "new_transaction":
            state["counter"] += 1
            state["events"].append({"id": f"demo-{state['counter']}", "amount": "-50000",
                                    "description": "Giao dịch demo mới", "status": "BOOKED", "date": str(date.today())})
        if action == "settle_pending":
            for event in state["events"]:
                if event["status"] == "PENDING": event["status"] = "BOOKED"
        return save()
    if action == "expire_otp":
        if state.get("stage") != "OTP": raise HTTPException(409, "Chưa có OTP")
        state["otp_expires"] = now().isoformat()
        return save()
    if action == "sync":
        if not state.get("linked"):
            raise HTTPException(409, "Chưa liên kết ngân hàng")
        if state.get("stage") != "CONNECTED":
            raise HTTPException(409, "Hoàn tất xác thực lại trước khi đồng bộ")
        if state.get("consent_expires", "") <= now().isoformat():
            return save("Quyền truy cập hết hạn. Vui lòng kết nối lại.")
        if state.get("outage"):
            return save("Ngân hàng demo tạm gián đoạn. Có thể thử lại, dữ liệu đã lưu được giữ nguyên.")
        added = 0
        imported = []
        for event in state.get("events", []):
            ref = state["bank_code"] + ":" + state["external_account"] + ":" + event["id"]
            if event["status"] != "BOOKED" or ref in state["imported"]: continue
            existing = db.scalar(select(Transaction.id).where(Transaction.account_id == acc.id, Transaction.bank_reference == ref))
            if not existing:
                amount = Decimal(event["amount"])
                imported_txn = Transaction(user_id=user.id, account_id=acc.id, bank_reference=ref,
                                           source="IMPORT", kind="NORMAL", amount=amount,
                                           type="INCOME" if amount > 0 else "EXPENSE",
                                           description=event["description"], transaction_date=date.fromisoformat(event["date"]))
                db.add(imported_txn)
                imported.append(imported_txn)
                acc.balance += amount
                state["source_balance"] = str(Decimal(state["source_balance"])+amount)
                added += 1
            state["imported"].append(ref)
        if acc.balance != Decimal(view(state)["provider_balance"]):
            raise HTTPException(409, "Đối soát số dư không khớp; giao dịch đồng bộ được hoàn tác")
        if imported:
            db.flush()
            for imported_txn in imported:
                maybe_emit_unusual_transaction(db, imported_txn)
                if imported_txn.type == "EXPENSE":
                    enqueue(db, "BUDGET", {"user_id": str(user.id), "transaction_id": str(imported_txn.id)},
                            "budget-check:" + str(imported_txn.id))
        state.update(stage="CONNECTED", last_sync=now().isoformat(), last_imported=added)
        return save()
    raise HTTPException(422, "Hành động không hợp lệ")
