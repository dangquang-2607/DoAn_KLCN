"""Điểm tập hợp router của module hóa đơn.

Vai trò: cung cấp một import ổn định cho bootstrap trong thời gian bóc tách endpoint.
Đầu vào: router hóa đơn hiện hành.
Đầu ra: APIRouter có prefix /invoices.
Ràng buộc: không thay đổi URL hoặc metadata OpenAPI.
"""

from app.chuc_nang.nguoi_dung.hoa_don_ai.api.routes import router

__all__ = ["router"]
