"""Tạo và quản lý phiên SQLAlchemy dùng chung.

Vai trò: cung cấp session factory cho API, worker, middleware và script vận hành.
Đầu vào: engine đã cấu hình trong tầng database dùng chung.
Đầu ra: `SessionLocal` với transaction tường minh.
Ràng buộc: nơi sử dụng phải đóng phiên và tự quyết định commit/rollback theo nghiệp vụ.
"""

from sqlalchemy.orm import sessionmaker

from app.shared.database.engine import engine


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
