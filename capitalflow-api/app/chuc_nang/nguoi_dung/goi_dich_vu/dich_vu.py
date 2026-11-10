from datetime import timedelta
import secrets
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import select
from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.session_management import locked_user
from app.dung_chung.tac_vu_nen.hang_doi import enqueue

from . import payos
from .han_muc import lock_owner, utcnow
from .luu_tru import PaymentOrder, Subscription
from .checkout import capture, checkout_out

PRICE_VND = 30_000
DURATION_DAYS = 30


def iso(value):
    return value.isoformat(timespec="seconds") + "Z" if value else None


def order_out(order):
    instant = utcnow()
    return {"id": str(order.id), "order_code": str(order.order_code), "amount": order.amount, "currency": "VND",
            "days": order.days, "status": order.status, "checkout_url": order.checkout_url if order.status == "PENDING" else None,
            "created_at": iso(order.created_at), "expires_at": iso(order.expires_at),
            "paid_at": iso(order.paid_at), "premium_from": iso(order.premium_from), "premium_until": iso(order.premium_until),
            "server_time": iso(instant),
            "checkout": checkout_out(order.checkout_data, order.amount) if order.status == "PENDING" and order.expires_at > instant else None}


def owned_order(db, order_id, user_id):
    order = db.get(PaymentOrder, order_id)
    if not order or order.user_id != user_id:
        raise HTTPException(404, "Không tìm thấy đơn nâng cấp.")
    return order


def create_order(db, user, request_id):
    if not payos.configured():
        raise HTTPException(503, "Thanh toán Premium chưa được cấu hình. Vui lòng thử lại sau.")
    instant = utcnow()
    locked_user(db, user.id, user.token_version)
    order = db.get(PaymentOrder, request_id)
    if order and order.user_id != user.id:
        raise HTTPException(409, "Mã yêu cầu đã được sử dụng.")
    if not order:
        order = db.scalar(select(PaymentOrder).where(PaymentOrder.user_id == user.id,
            PaymentOrder.status.in_(["CREATING", "PENDING"]), PaymentOrder.expires_at > instant)
            .order_by(PaymentOrder.created_at.desc()))
    if order:
        if order.expires_at <= instant and order.status == "CREATING":
            order.status = "EXPIRED"
            db.commit()
            return order_out(order)
        if order.status != "CREATING" or (instant - order.updated_at).total_seconds() < 60:
            db.rollback()
            return order_out(order)
        order.updated_at = instant
    else:
        order = PaymentOrder(id=request_id, user_id=user.id,
            order_code=secrets.randbelow(8_000_000_000_000_000) + 1,
            amount=PRICE_VND, days=DURATION_DAYS, status="CREATING", created_at=instant,
            updated_at=instant, expires_at=instant + timedelta(minutes=15))
        db.add(order)
        enqueue(db, "BILLING", {"order_id": str(order.id), "user_id": str(user.id)},
                dedupe_key=f"billing-reconcile:{order.id}", owner_user_id=user.id)
    order_id = order.id
    provider_order = SimpleNamespace(**{name: getattr(order, name) for name in ("id", "order_code", "amount", "expires_at")})
    db.commit()
    # Không giữ khóa người dùng/kết nối SQL khi gọi dịch vụ bên ngoài.
    data = payos.create(provider_order)
    return apply_provider_state(db, order_id, data)


def apply_provider_state(db, order_id, data):
    snapshot = db.get(PaymentOrder, order_id)
    if snapshot is None:
        raise HTTPException(404, "Không tìm thấy đơn nâng cấp.")
    owner_id = snapshot.user_id
    db.rollback()
    lock_owner(db, owner_id)
    order = db.get(PaymentOrder, order_id, populate_existing=True)
    if order is None:
        raise HTTPException(404, "Không tìm thấy đơn nâng cấp.")
    if str(data.get("orderCode")) != str(order.order_code):
        raise HTTPException(502, "Kết quả thanh toán không khớp đơn hàng.")
    link_id, checkout = payos.checkout_url(data)
    if order.payment_link_id and order.payment_link_id != link_id:
        raise HTTPException(502, "Kênh thanh toán không khớp đơn hàng.")
    if order.status == "PAID":
        db.rollback()
        return order_out(order)
    order.payment_link_id, order.checkout_url = link_id, checkout
    state = data.get("status")
    if state == "PAID":
        # Luôn xác nhận từ API payOS, không cấp quyền theo returnUrl hoặc ảnh chuyển khoản.
        if data.get("amount") != order.amount or data.get("amountPaid") != order.amount:
            order.status = "REVIEW"
        else:
            instant = utcnow()
            subscription = db.get(Subscription, owner_id, populate_existing=True)
            start = max(instant, subscription.premium_until) if subscription else instant
            end = start + timedelta(days=order.days)
            if subscription:
                subscription.premium_until = end
            else:
                db.add(Subscription(user_id=owner_id, premium_until=end))
            order.status, order.paid_at = "PAID", instant
            order.premium_from, order.premium_until = start, end
    elif state in {"CANCELLED", "EXPIRED"}:
        order.status = state
    elif state == "PENDING" or state == "PROCESSING":
        order.status = "PENDING"
    elif state is None and data.get("checkoutUrl"):
        order.status = "PENDING"
    else:
        raise HTTPException(502, "Trạng thái thanh toán chưa được xác nhận.")
    if order.status == "PENDING":
        if data.get("amount") != order.amount:
            order.status = "REVIEW"
        else:
            details = capture(data, order.amount)
            if details is not None:
                order.checkout_data = details
    order.updated_at = utcnow()
    db.commit()
    return order_out(order)


def refresh_order(db, order):
    if order.status == "PAID":
        return order_out(order)
    order_id, code = order.id, order.order_code
    db.rollback()
    data = payos.call("GET", f"/{code}")
    return apply_provider_state(db, order_id, data)


def reconcile_in_background(payload, sessions):
    """Đối soát được lưu bền vững, kể cả khi webhook hoặc trình duyệt bị gián đoạn."""
    from uuid import UUID
    with sessions() as db:
        order = db.get(PaymentOrder, UUID(payload["order_id"]))
        if not order or order.status in {"PAID", "REVIEW", "CANCELLED", "EXPIRED"}:
            return
        if utcnow() > order.expires_at + timedelta(days=1):
            order.status = "EXPIRED"
            db.commit()
            return
        try:
            result = refresh_order(db, order)
        except HTTPException:
            db.rollback()
            return utcnow() + timedelta(seconds=60)
        if result["status"] in {"PENDING", "CREATING"}:
            return utcnow() + timedelta(seconds=30)
