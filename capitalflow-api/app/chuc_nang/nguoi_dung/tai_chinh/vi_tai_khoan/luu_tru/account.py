"""Ánh xạ tài khoản tài chính và số dư của người dùng.

Vai trò: lưu ví/ngân hàng cùng loại tài khoản, tiền tệ và số dư hiện hành.
Đầu vào: thao tác từ account routes và transaction service.
Đầu ra: thực thể Account cho sổ cái và báo cáo.
Ràng buộc: mọi thay đổi số dư nghiệp vụ phải đi qua transaction service có khóa phù hợp.
"""

import enum
import uuid
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import Unicode, String, Boolean, Numeric, DateTime, Date, Text, ForeignKey, func, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.dung_chung.database.nen_tang import Base

class AccountType(str, enum.Enum):
    BASIC = "BASIC"
    LINKED = "LINKED"
    BANK = "BANK"
    CASH = "CASH"
    CRYPTO = "CRYPTO"
    E_WALLET = "E_WALLET"
    CREDIT_CARD = "CREDIT_CARD"
    SAVINGS = "SAVINGS"
    INVESTMENT = "INVESTMENT"
    OTHER = "OTHER"

class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(Unicode(150), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(String(30), nullable=False)
    institution_name: Mapped[str | None] = mapped_column(Unicode(150), nullable=True)
    balance: Mapped[Decimal] = mapped_column(Numeric(19, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="VND")
    account_number_masked: Mapped[str | None] = mapped_column(String(8), nullable=True)
    target_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    exclude_from_total: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    is_notification_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    savings_state: Mapped[str | None] = mapped_column(Text, nullable=True)
    bank_state: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())

    __table_args__ = (
        Index(
            "IX_accounts_user",
            "user_id",
            "is_active",
            mssql_include=["name", "account_type", "institution_name", "balance", "currency", "color"],
        ),
        Index("IX_accounts_user_type", "user_id", "account_type", "is_active"),
    )

    @property
    def bank_managed(self):
        import json
        return bool(json.loads(self.bank_state or "{}").get("external_account"))

    @property
    def bank_status(self):
        from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.bank import view, read_state
        return view(read_state(self)).get("stage", "NOT_CONNECTED")

    @property
    def bank_last_sync(self):
        import json
        return json.loads(self.bank_state or "{}").get("last_sync")


# Theo dõi mọi đường ghi số dư (giao dịch, chuyển tiền, điều chỉnh) trong cùng DB transaction.
# Mọi loại ví đều phát thông báo biến động; ví tiết kiệm có thêm thông báo đạt mục tiêu.
from sqlalchemy import event
from sqlalchemy.orm import Session
import json

@event.listens_for(Session, "before_flush")
def account_notifications(session, flush_context, instances):
    from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.dich_vu import emit_notification

    for account in list(session.new) + list(session.dirty):
        if not isinstance(account, Account):
            continue
        state = json.loads(account.savings_state or "{}")
        current = str(account.balance or 0)
        target = str(account.target_amount or 0)
        if account.is_notification_enabled:
            if "balance" in state and Decimal(state["balance"]) != Decimal(current):
                emit_notification(session, user_id=account.user_id, kind="ACCOUNT",
                                  title="Biến động số dư",
                                  message=f"Số dư {account.name}: {state['balance']} → {current} VND",
                                  source_type="ACCOUNT", source_id=account.id, action_url="/accounts")
            if account.account_type == AccountType.SAVINGS and Decimal(target) > 0 and Decimal(current) >= Decimal(target) and state.get("achieved_target") != target:
                emit_notification(session, user_id=account.user_id, kind="SAVINGS",
                                  title="Đạt mục tiêu tiết kiệm",
                                  message=f"{account.name} đã đạt mục tiêu {target} VND",
                                  source_type="ACCOUNT", source_id=account.id, action_url="/accounts")
                state["achieved_target"] = target
        state.pop("messages", None)
        state["balance"] = current
        encoded = json.dumps(state, ensure_ascii=True)
        if encoded != account.savings_state:
            account.savings_state = encoded
