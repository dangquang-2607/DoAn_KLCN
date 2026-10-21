"""Optional request keys for old Web compatibility; native clients should always send one."""
import json
import uuid
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.session_management import locked_user
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.ban_ghi_luy_dang import IdempotencyRecord
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from .chuan_hoa_hoa_don import digest
from .vong_doi import conflict


def begin_operation(db, user, action, body):
    locked_user(db, user.id, user.token_version)
    request = db.info.get("request")
    key = request.headers.get("Idempotency-Key") if request else None
    if key is None:
        return None, None
    if not 8 <= len(key) <= 128 or not all(c.isascii() and (c.isalnum() or c in "-_") for c in key):
        raise HTTPException(422, "Idempotency-Key không hợp lệ")
    payload_hash = digest([action, jsonable_encoder(body)])
    existing = db.get(IdempotencyRecord, (user.id, key))
    if existing:
        if existing.payload_hash != payload_hash:
            conflict("IDEMPOTENCY_KEY_REUSED", "Khóa yêu cầu đã được dùng cho nội dung khác.")
        result = json.loads(existing.response_json)
        if action == "invoice-confirm":
            transaction_id = uuid.UUID(result["transaction_id"])
            if not db.scalar(select(Transaction.id).where(Transaction.id == transaction_id, Transaction.user_id == user.id)):
                conflict("CONFIRMATION_NO_LONGER_ACTIVE", "Khoản chi đã bị xóa. Hãy tải lại hóa đơn để ghi nhận lại.")
        return None, result
    return IdempotencyRecord(user_id=user.id, request_key=key, payload_hash=payload_hash), None


def finish_operation(db, pending, result):
    if pending is not None:
        pending.response_json = json.dumps(jsonable_encoder(result), ensure_ascii=False)
        db.add(pending)
    db.commit()
    return result
