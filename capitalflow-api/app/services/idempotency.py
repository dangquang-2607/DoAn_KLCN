"""One transaction for the business result and its replay record."""
import hashlib
from decimal import Decimal
import json
from functools import wraps
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from app.models.idempotency import IdempotencyRecord
from app.services.sessions import locked_user


def idempotent_money(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        db, user = kwargs["db"], kwargs["user"]
        request = db.info.get("request")
        if request is None:
            raise RuntimeError("Idempotent API requires request context")
        key = request.headers.get("Idempotency-Key", "")
        if not 8 <= len(key) <= 128 or not all(c.isalnum() or c in "-_" for c in key):
            raise HTTPException(status_code=428, detail="Cần Idempotency-Key hợp lệ cho thao tác tài chính")
        body = {k: jsonable_encoder(v) for k,v in kwargs.items() if k not in {"db","user","background_tasks"}}
        digest = hashlib.sha256(json.dumps([request.method, request.url.path, body], sort_keys=True, ensure_ascii=True).encode()).hexdigest()
        try:
            # Serialize replays and all protected money writes for a user.
            locked_user(db, user.id, user.token_version)
            old = db.get(IdempotencyRecord, (user.id, key))
            if old:
                if old.payload_hash != digest:
                    raise HTTPException(status_code=409, detail="Idempotency-Key đã dùng cho nội dung khác")
                result = json.loads(old.response_json)
                db.rollback()
                return result
            result = fn(*args, **kwargs)
            db.flush()
            encoded = jsonable_encoder(result, custom_encoder={Decimal: str})
            db.add(IdempotencyRecord(user_id=user.id, request_key=key, payload_hash=digest,
                                     response_json=json.dumps(encoded, ensure_ascii=False)))
            db.commit()
            return encoded
        except Exception:
            db.rollback()
            raise
    return wrapped
