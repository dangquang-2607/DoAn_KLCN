"""Điểm vào ổn định của CapitalFlow API.

Vai trò: export đối tượng app cho Uvicorn, Docker và bộ kiểm thử.
Đầu vào: application factory trong app.khoi_dong.
Đầu ra: biến app tại đường dẫn tương thích app.main:app.
Ràng buộc: không đặt nghiệp vụ, middleware hoặc router trực tiếp tại đây.
"""

from app.khoi_dong import create_app


app = create_app()
