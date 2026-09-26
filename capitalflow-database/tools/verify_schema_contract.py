"""Phát hiện bảng SQL Server lệch khỏi hợp đồng model SQLAlchemy.

Vai trò: so sánh bảng/cột thực tế với toàn bộ ``Base.metadata``.
Đầu vào: metadata ORM đã đăng ký và SQL Server mục tiêu.
Đầu ra/side effect: kết quả PASS hoặc exit code lỗi kèm danh sách schema drift.
Ràng buộc an toàn: chỉ đọc system catalog, không chạy DDL hoặc DML.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "capitalflow-api"))

from sqlalchemy import text

import app.models  # noqa: F401 - registers every model with Base.metadata
from app.core.database import engine
from app.models.base import Base


def verify() -> None:
    # Chỉ đọc catalog hệ thống; truy vấn không thay đổi schema hoặc dữ liệu.
    query = text(
        """
        SELECT tables.name, columns.name
        FROM sys.columns AS columns
        JOIN sys.tables AS tables ON columns.object_id = tables.object_id
        """
    )
    with engine.connect() as connection:
        actual: dict[str, set[str]] = {}
        for table_name, column_name in connection.execute(query):
            actual.setdefault(table_name, set()).add(column_name)

    # So sánh hai chiều để phát hiện cả cột model còn thiếu trong CSDL và cột
    # legacy còn dư trong CSDL nhưng không được ORM quản lý.
    drift: list[str] = []
    for table_name, table in sorted(Base.metadata.tables.items()):
        expected_columns = set(table.columns.keys())
        actual_columns = actual.get(table_name)
        if actual_columns is None:
            drift.append(f"{table_name}: table is missing")
            continue
        missing = sorted(expected_columns - actual_columns)
        extra = sorted(actual_columns - expected_columns)
        if missing or extra:
            drift.append(f"{table_name}: missing={missing}, extra={extra}")

    if drift:
        raise SystemExit("SQL Server / SQLAlchemy schema drift:\n" + "\n".join(drift))
    print(f"Schema contract: PASS ({len(Base.metadata.tables)} modeled tables).")


if __name__ == "__main__":
    verify()
