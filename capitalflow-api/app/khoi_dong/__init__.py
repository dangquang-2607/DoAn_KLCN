"""Lắp ráp và khởi động ứng dụng CapitalFlow API.

Vai trò: tập trung composition root, vòng đời, router và xử lý lỗi của FastAPI.
Đầu vào: cấu hình, middleware và router từ các module nghiệp vụ.
Đầu ra: ứng dụng FastAPI hoàn chỉnh cho Uvicorn và bộ kiểm thử.
Ràng buộc: không chứa nghiệp vụ tài chính hoặc truy cập dữ liệu người dùng.
"""

from app.khoi_dong.tao_ung_dung import create_app

__all__ = ["create_app"]
