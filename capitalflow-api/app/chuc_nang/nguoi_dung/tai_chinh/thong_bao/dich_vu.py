"""Tạo thông báo trong cùng transaction với sự kiện và chống trùng khi worker chạy lại."""

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.luu_tru.thong_bao import Notification


def emit_notification(
    db: Session,
    *,
    user_id: uuid.UUID,
    kind: str,
    title: str,
    message: str,
    severity: str = "INFO",
    source_type: str | None = None,
    source_id: uuid.UUID | None = None,
    action_url: str | None = None,
    metadata: dict | None = None,
    dedupe_key: str | None = None,
) -> Notification:
    """Ghi thông báo; cùng dedupe_key của một user chỉ tạo một bản ghi."""
    if dedupe_key:
        existing = db.scalar(select(Notification).where(
            Notification.user_id == user_id, Notification.dedupe_key == dedupe_key,
        ))
        if existing:
            return existing
    notification = Notification(
        user_id=user_id, kind=kind, severity=severity, title=title,
        message=message, source_type=source_type, source_id=source_id,
        action_url=action_url,
        metadata_json=json.dumps(metadata, ensure_ascii=False) if metadata else None,
        dedupe_key=dedupe_key,
    )
    db.add(notification)
    return notification


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def maybe_emit_unusual_transaction(db: Session, transaction) -> None:
    """Cảnh báo khoản chi >= 5 triệu hoặc >= 3 lần mức chi gần đây (tối thiểu 1 triệu)."""
    from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction

    if transaction.kind != "NORMAL" or transaction.type != "EXPENSE":
        return
    amount = abs(Decimal(str(transaction.amount)))
    prior = db.scalars(select(Transaction.amount).where(
        Transaction.user_id == transaction.user_id,
        Transaction.type == "EXPENSE", Transaction.kind == "NORMAL",
        Transaction.id != transaction.id,
    ).order_by(Transaction.created_at.desc()).limit(20)).all()
    average = sum((abs(Decimal(str(value))) for value in prior), Decimal("0")) / len(prior) if prior else Decimal("0")
    if amount < Decimal("5000000") and not (len(prior) >= 5 and amount >= Decimal("1000000") and amount >= average * 3):
        return
    emit_notification(
        db, user_id=transaction.user_id, kind="TRANSACTION", severity="WARNING",
        title="Khoản chi bất thường",
        message=f"Khoản chi {amount} VND: {transaction.description or 'Giao dịch không có mô tả'}.",
        source_type="TRANSACTION", source_id=transaction.id,
        action_url=f"/transactions?account_id={transaction.account_id}",
        metadata={"amount": str(amount), "rule": "large_or_3x_recent_average"},
        dedupe_key=f"transaction:unusual:{transaction.id}",
    )
