"""
Audit Middleware — tự động ghi log mọi thao tác thay đổi dữ liệu (POST/PATCH/PUT/DELETE).
Sử dụng Independent Session (Option A): mở session riêng để ghi log, không ảnh hưởng request chính.
"""
import json
import uuid
from datetime import datetime, timezone

from fastapi import Request
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from starlette.concurrency import run_in_threadpool

from app.core.database import SessionLocal
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
    Dùng Independent Session — đảm bảo ghi log không bao giờ bị bỏ sót dù
    DB session của request chính gặp lỗi. Lỗi ghi log KHÔNG ảnh hưởng API response.
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

        # Không log lỗi server (5xx)
        if response.status_code >= 500:
            return response

        # Lấy thông tin user từ state (được set bởi get_current_user dependency)
        user_id: uuid.UUID | None = getattr(request.state, "user_id", None)

        # Mở Independent Session riêng để ghi audit log
        # (tách biệt hoàn toàn khỏi session của request chính)
        await run_in_threadpool(_write_audit_log,
            user_id=user_id,
            method=request.method,
            path=path,
            status_code=response.status_code,
            query_params=dict(request.query_params),
            ip_address=_get_client_ip(request),
            user_agent=request.headers.get("user-agent", "")[:1000],
            request_id=_safe_uuid(request.headers.get("x-request-id")),
        )

        return response


def _write_audit_log(
    user_id: uuid.UUID | None,
    method: str,
    path: str,
    status_code: int,
    query_params: dict,
    ip_address: str,
    user_agent: str,
    request_id: uuid.UUID | None,
) -> None:
    """Ghi audit log dùng Independent Session. Lỗi ghi log chỉ in warning, không raise."""
    db: Session = SessionLocal()
    try:
        action = _infer_action(method, path)
        entity_type, entity_id = _extract_entity(path)

        audit = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            route=path,
            http_method=method,
            status_code=status_code,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            metadata_json=json.dumps({"query_keys": sorted(query_params)}),
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        db.rollback()
        # Lỗi ghi log KHÔNG được ảnh hưởng API — chỉ print warning
        print(f"[AuditMiddleware WARNING] Audit write failed: {type(e).__name__}")
    finally:
        db.close()


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
