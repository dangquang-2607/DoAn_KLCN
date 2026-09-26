"""Kiểm tra hoặc áp dụng một SQL migration idempotent dưới khóa CSDL.

Vai trò: chạy file migration theo version bằng một runner SQL Server tổng quát.
Đầu vào: tên version hợp lệ, file ``migrations/<version>.sql`` và tùy chọn ``--apply``.
Đầu ra/side effect: xác minh rồi rollback, hoặc commit schema và version record.
Ràng buộc an toàn: application lock, transaction duy nhất và từ chối path traversal.
"""

import argparse
import re
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.database import engine

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"


def migrate(version: str, apply: bool = False) -> str:
    # Chỉ nhận version gồm chữ, số và dấu gạch dưới để không thể thoát khỏi
    # thư mục migrations bằng path traversal hoặc chọn một file tùy ý.
    if not re.fullmatch(r"[A-Za-z0-9_]+", version):
        raise ValueError("Invalid migration version")
    sql_file = MIGRATIONS / f"{version}.sql"
    if not sql_file.is_file():
        raise FileNotFoundError(sql_file)
    if engine.dialect.name != "mssql":
        raise RuntimeError("This migration requires SQL Server")

    # Application lock và toàn bộ batch SQL cùng thuộc một transaction. Nhờ đó,
    # hai instance triển khai đồng thời không thể áp dụng chồng cùng migration.
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.exec_driver_sql("SET XACT_ABORT ON; SET LOCK_TIMEOUT 15000;")
            connection.exec_driver_sql(
                """
                DECLARE @lock_result INT;
                EXEC @lock_result = sys.sp_getapplock
                    @Resource='capitalflow_schema_migration', @LockMode='Exclusive',
                    @LockOwner='Transaction', @LockTimeout=15000;
                IF @lock_result < 0 THROW 51019, 'Cannot acquire migration lock.', 1;
                IF OBJECT_ID('dbo.schema_migrations','U') IS NULL
                    CREATE TABLE dbo.schema_migrations(
                        version VARCHAR(100) PRIMARY KEY,
                        applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
                    );
                """
            )
            applied = connection.scalar(
                text("SELECT COUNT(*) FROM dbo.schema_migrations WHERE version=:version"),
                {"version": version},
            )
            if applied:
                transaction.rollback()
                return "already_applied"
            # GO là batch separator của công cụ SQL Server, không phải câu lệnh T-SQL;
            # phải tách file trước khi gửi từng batch qua SQLAlchemy.
            for batch in re.split(r"^GO\s*$", sql_file.read_text(encoding="utf-8"), flags=re.M):
                if batch.strip():
                    connection.exec_driver_sql(batch)
            connection.execute(
                text("INSERT dbo.schema_migrations(version) VALUES (:version)"),
                {"version": version},
            )
            # Chế độ mặc định luôn rollback để xác minh cú pháp/ràng buộc. Chỉ
            # ``--apply`` mới commit cả schema và bản ghi version như một đơn vị.
            if apply:
                transaction.commit()
                return "applied"
            transaction.rollback()
            return "validated_and_rolled_back"
        except Exception:
            transaction.rollback()
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("version")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    print(migrate(args.version, apply=args.apply))
