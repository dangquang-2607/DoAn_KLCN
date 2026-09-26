"""Migration SQL Server theo transaction để dọn schema/dữ liệu legacy an toàn.

Vai trò: áp dụng các bước cleanup liên quan nhiều bảng bằng wrapper chuyên biệt.
Đầu vào: SQL migration theo VERSION và tùy chọn ``--apply``.
Đầu ra/side effect: thay đổi schema/dữ liệu và ghi version khi commit.
Ràng buộc an toàn: application lock, khóa năm bảng và rollback mặc định.
"""
import argparse
import re
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.database import engine

VERSION = "20260918_database_cleanup"
SQL_FILE = Path(__file__).resolve().parents[1] / "migrations" / f"{VERSION}.sql"


def migrate(apply: bool = False) -> str:
    if engine.dialect.name != "mssql":
        raise RuntimeError("This migration requires SQL Server")
    # Migration dọn schema chạm nhiều bảng liên quan. Application lock cùng khóa
    # bảng độc quyền giữ snapshot nhất quán và ngăn DML chen giữa các bước dọn.
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.exec_driver_sql("SET XACT_ABORT ON; SET LOCK_TIMEOUT 15000;")
            connection.exec_driver_sql("""
                DECLARE @lock_result INT;
                EXEC @lock_result = sys.sp_getapplock
                    @Resource='capitalflow_schema_migration', @LockMode='Exclusive',
                    @LockOwner='Transaction', @LockTimeout=15000;
                IF @lock_result < 0 THROW 51018, 'Cannot acquire migration lock.', 1;
                IF OBJECT_ID('dbo.schema_migrations','U') IS NULL
                    CREATE TABLE dbo.schema_migrations(version VARCHAR(100) PRIMARY KEY, applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
            """)
            if connection.scalar(
                text("SELECT COUNT(*) FROM dbo.schema_migrations WHERE version=:version"),
                {"version": VERSION},
            ):
                transaction.rollback()
                return "already_applied"

            for table in ("categories", "transactions", "budgets", "invoices", "audit_logs"):
                connection.exec_driver_sql(
                    f"SELECT COUNT_BIG(*) FROM dbo.{table} WITH (TABLOCKX,HOLDLOCK)"
                ).scalar()

            # GO chỉ phân tách batch; transaction bao ngoài quyết định commit khi
            # có --apply hoặc rollback toàn bộ trong chế độ xác minh mặc định.
            for batch in re.split(r"^GO\s*$", SQL_FILE.read_text(encoding="utf-8"), flags=re.M):
                if batch.strip():
                    connection.exec_driver_sql(batch)
            connection.execute(
                text("INSERT dbo.schema_migrations(version) VALUES (:version)"),
                {"version": VERSION},
            )
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
    parser.add_argument("--apply", action="store_true")
    print(migrate(apply=parser.parse_args().apply))
