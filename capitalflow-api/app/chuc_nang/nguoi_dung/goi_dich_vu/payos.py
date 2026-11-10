"""Kết nối HTTPS payOS, giữ khóa bí mật ở backend và không ghi dữ liệu khóa vào log."""
import hashlib
import hmac
import json
from datetime import timezone
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from app.dung_chung.config import settings


def configured():
    return bool(settings.payos_client_id and settings.payos_api_key and settings.payos_checksum_key)


def signature(data):
    def value(item):
        if item is None or item in ("null", "undefined"):
            return ""
        if isinstance(item, (list, dict, bool)):
            return json.dumps(item, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        return str(item)
    raw = "&".join(f"{key}={value(data[key])}" for key in sorted(data))
    return hmac.new(settings.payos_checksum_key.encode(), raw.encode(), hashlib.sha256).hexdigest()


def verify(data: object, supplied: object) -> bool:
    return (isinstance(data, dict) and isinstance(supplied, str) and supplied.isascii() and configured()
            and hmac.compare_digest(signature(data), supplied))


def call(method, path, body=None):
    if not configured():
        raise HTTPException(503, "Thanh toán Premium chưa được cấu hình. Vui lòng thử lại sau.")
    try:
        with httpx.Client(timeout=15, follow_redirects=False) as client:
            result = client.request(method, "https://api-merchant.payos.vn/v2/payment-requests" + path,
                headers={"x-client-id": settings.payos_client_id, "x-api-key": settings.payos_api_key}, json=body)
            result.raise_for_status()
            payload = result.json()
        if payload.get("code") != "00" or not isinstance(payload.get("data"), dict):
            raise ValueError("Provider did not confirm request")
        if payload.get("signature") and not verify(payload["data"], payload["signature"]):
            raise ValueError("Provider signature mismatch")
        return payload["data"]
    except (httpx.HTTPError, ValueError, TypeError, KeyError):
        raise HTTPException(503, "Chưa kết nối được payOS. Đơn hàng được giữ lại để đối soát; hãy thử lại sau.") from None


def create(order):
    return_url = f"{settings.frontend_url.rstrip('/')}/settings/subscription/checkout?payment_order={order.id}"
    body = {"orderCode": order.order_code, "amount": order.amount, "description": f"CF{str(order.id).replace('-', '')[:7]}",
            "returnUrl": return_url, "cancelUrl": return_url,
            "expiredAt": int(order.expires_at.replace(tzinfo=timezone.utc).timestamp())}
    signed = {key: body[key] for key in ("amount", "cancelUrl", "description", "orderCode", "returnUrl")}
    body["signature"] = signature(signed)
    try:
        return call("POST", "", body)
    except HTTPException:
        # orderCode được giữ cố định khi POST timeout hoặc khi người dùng thử lại.
        return call("GET", f"/{order.order_code}")


def checkout_url(data):
    link_id = str(data.get("paymentLinkId") or data.get("id") or "")
    if not link_id or len(link_id) > 100 or not link_id.isascii() or not link_id.isalnum():
        raise HTTPException(503, "Thông tin thanh toán chưa hợp lệ. Vui lòng thử lại sau.")
    url = data.get("checkoutUrl") or f"https://pay.payos.vn/web/{link_id}"
    parts = urlparse(url)
    if parts.scheme != "https" or parts.netloc != "pay.payos.vn" or parts.username or parts.password:
        raise HTTPException(503, "Đường dẫn thanh toán chưa hợp lệ.")
    return link_id, url
