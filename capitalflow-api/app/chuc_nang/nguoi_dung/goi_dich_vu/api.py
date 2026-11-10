import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.dung_chung.http.gioi_han_tan_suat import limiter
from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from . import payos
from .dich_vu import DURATION_DAYS, PRICE_VND, create_order, iso, order_out, owned_order, refresh_order
from .han_muc import LIMITS, counts, month_vn, plan_for
from .luu_tru import PaymentOrder

def private_billing(response: Response):
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Pragma"] = "no-cache"


router = APIRouter(prefix="/billing", tags=["Gói sử dụng"], dependencies=[Depends(private_billing)])


class CheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID


@router.get("/subscription")
def subscription(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan, until = plan_for(db, user.id)
    period = month_vn()
    return {"plan": plan, "premium_until": iso(until), "limits": LIMITS[plan], "plans": LIMITS,
            "usage": counts(db, user.id, usage_month=period), "usage_month": period.isoformat(),
            "price": PRICE_VND, "days": DURATION_DAYS, "currency": "VND", "payment_available": payos.configured()}


@router.post("/checkout", status_code=201)
@limiter.limit("5/minute;20/hour")
def checkout(request: Request, payload: CheckoutRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return create_order(db, user, payload.request_id)


@router.get("/orders")
def orders(page: int = Query(1, ge=1, le=10_000), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(PaymentOrder).where(PaymentOrder.user_id == user.id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(query.order_by(PaymentOrder.created_at.desc(), PaymentOrder.id.desc()).offset((page - 1) * 10).limit(10))
    return {"items": [order_out(item) for item in items], "total": total}


@router.get("/orders/{order_id}")
def order(order_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return order_out(owned_order(db, order_id, user.id))


@router.post("/orders/{order_id}/refresh")
@limiter.limit("20/minute")
def refresh(request: Request, order_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return refresh_order(db, owned_order(db, order_id, user.id))


@router.post("/payos/webhook")
@limiter.limit("120/minute")
def webhook(request: Request, payload: dict, db: Session = Depends(get_db)):
    if len(json.dumps(payload)) > 32_768:
        raise HTTPException(413, "Thông báo thanh toán quá lớn.")
    data = payload.get("data")
    if not isinstance(data, dict) or not payos.verify(data, payload.get("signature")):
        raise HTTPException(400, "Chữ ký thanh toán không hợp lệ.")
    if payload.get("code") != "00" or payload.get("success") is not True or data.get("code") != "00":
        return {"received": True}
    order_code = data.get("orderCode")
    if not isinstance(order_code, (int, str)) or isinstance(order_code, bool):
        raise HTTPException(400, "Mã đơn không hợp lệ.")
    try:
        code = int(order_code)
    except (ValueError, TypeError):
        raise HTTPException(400, "Mã đơn không hợp lệ.") from None
    if not 0 < code <= 9_007_199_254_740_991:
        raise HTTPException(400, "Mã đơn không hợp lệ.")
    item = db.scalar(select(PaymentOrder).where(PaymentOrder.order_code == code))
    # payOS gửi đơn mẫu khi xác thực URL; đơn không thuộc hệ thống không được cấp quyền.
    if item is None:
        return {"received": True}
    if item.payment_link_id and data.get("paymentLinkId") != item.payment_link_id:
        raise HTTPException(400, "Mã thanh toán không khớp.")
    if item.status != "PAID":
        refresh_order(db, item)
    return {"received": True}
