"""
Audit Middleware — tự động ghi log mọi thao tác thay đổi dữ liệu (POST/PATCH/PUT/DELETE).
Không log GET requests để tránh DB phình to.
"""
import json
import uuid
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.models.audit_log import AuditLog


# Các path prefix bỏ qua (không cần audit)
_SKIP_PREFIXES = (
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
)

# Chỉ log các method thay đổi dữ liệu
_AUDITED_METHODS = {"POST", "PATCH", "PUT", "DELETE"}


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware tự động ghi Audit Log cho tất cả request thay đổi dữ liệu.
    Ghi log KHÔNG đồng bộ (non-blocking) — không làm chậm API response.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Chỉ xử lý các method cần audit
        if request.method not in _AUDITED_METHODS:
            return await call_next(request)

        # Bỏ qua các path không cần audit
        path = request.url.path
        if any(path.startswith(p) for p in _SKIP_PREFIXES):
            return await call_next(request)

        # Thực thi request
        response: Response = await call_next(request)

        # Chỉ ghi log khi request thành công (2xx hoặc 3xx)
        # Không log lỗi xác thực (4xx) trừ khi cần
        if response.status_code >= 500:
            return response

        # Lấy thông tin user từ state (được set bởi get_current_user dependency)
        user_id: uuid.UUID | None = getattr(request.state, "user_id", None)

        # Lấy DB session từ state
        db: Session | None = getattr(request.state, "db", None)
        if db is None:
            return response

        try:
            action = _infer_action(request.method, path)
            entity_type, entity_id = _extract_entity(path)

            audit = AuditLog(
                user_id=user_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                route=path,
                http_method=request.method,
                status_code=response.status_code,
                ip_address=_get_client_ip(request),
                user_agent=request.headers.get("user-agent", "")[:1000],
                request_id=_safe_uuid(request.headers.get("x-request-id")),
                metadata_json=json.dumps({
                    "query_params": dict(request.query_params),
                }),
            )
            db.add(audit)
            db.commit()
        except Exception:
            # Lỗi ghi log KHÔNG được làm ảnh hưởng API response
            db.rollback()

        return response


# ─── Helpers ────────────────────────────────────────────────────────────────

def _infer_action(method: str, path: str) -> str:
    """Suy ra tên hành động từ HTTP method + path."""
    method_map = {
        "POST": "CREATE",
        "PATCH": "UPDATE",
        "PUT": "UPDATE",
        "DELETE": "DELETE",
    }
    base = method_map.get(method, method)

    # Thêm tên resource nếu nhận ra
    parts = [p for p in path.split("/") if p and not _is_uuid_like(p)]
    resource = parts[-1].upper().rstrip("S") if parts else "RESOURCE"

    return f"{base}_{resource}"


def _extract_entity(path: str) -> tuple[str | None, uuid.UUID | None]:
    """Trích xuất tên entity và ID từ URL path."""
    parts = path.strip("/").split("/")
    entity_type = None
    entity_id = None

    # Skip prefix "api/v1"
    filtered = [p for p in parts if p not in ("api", "v1")]

    if filtered:
        entity_type = filtered[0].upper()

    # Tìm UUID trong path
    for p in filtered:
        if _is_uuid_like(p):
            try:
                entity_id = uuid.UUID(p)
                break
            except ValueError:
                pass

    return entity_type, entity_id


def _is_uuid_like(s: str) -> bool:
    """Kiểm tra chuỗi có phải UUID format không."""
    return len(s) == 36 and s.count("-") == 4


def _get_client_ip(request: Request) -> str:
    """Lấy IP thực của client, xử lý trường hợp đứng sau proxy/load balancer."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return ""


def _safe_uuid(val: str | None) -> uuid.UUID | None:
    if not val:
        return None
    try:
        return uuid.UUID(val)
    except ValueError:
        return None
