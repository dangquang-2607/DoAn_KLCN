"""Cung cấp lớp nền khai báo và thành phần định danh dùng chung cho ORM.

Vai trò: làm gốc metadata cho toàn bộ model SQLAlchemy.
Đầu vào: khai báo model của từng phân hệ.
Đầu ra: Base và thành phần dùng chung khi ánh xạ bảng.
Ràng buộc: thay đổi metadata gốc có thể ảnh hưởng mọi migration và model.
"""

import uuid
from datetime import datetime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import DateTime, func, Uuid

class Base(DeclarativeBase):
    pass
