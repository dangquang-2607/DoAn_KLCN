"""Điểm tập hợp router của module đăng nhập.

Vai trò: che giấu vị trí route cũ trong thời gian chia nhỏ auth.
Đầu vào: router xác thực đã được kiểm thử.
Đầu ra: router giữ nguyên prefix và OpenAPI contract.
Ràng buộc: chỉ làm nhiệm vụ composition, không chứa nghiệp vụ xác thực.
"""

from app.modules.dangnhap.api.routes import router

__all__ = ["router"]
