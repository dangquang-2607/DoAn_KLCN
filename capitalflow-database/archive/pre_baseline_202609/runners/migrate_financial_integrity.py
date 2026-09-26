"""Migration SQL Server bảo vệ tính toàn vẹn tài chính trong một transaction.

Vai trò: áp dụng constraint/index/baseline cần cho sổ cái và báo cáo tài chính.
Đầu vào: SQL migration financial integrity và tùy chọn ``--apply``.
Đầu ra/side effect: thay đổi schema/baseline và ghi version khi commit.
Ràng buộc an toàn: khóa thao tác money/user, XACT_ABORT và rollback mặc định.
"""
import argparse
from pathlib import Path
import re
from sqlalchemy import text
from app.core.database import engine

VERSION = "20260910_financial_integrity"
SQL_FILE = Path(__file__).resolve().parents[1] / "migrations" / f"{VERSION}.sql"


def migrate(apply=False):
    if engine.dialect.name != "mssql":
        raise RuntimeError("This migration requires SQL Server")
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.exec_driver_sql("SET XACT_ABORT ON; SET LOCK_TIMEOUT 15000;")
            connection.exec_driver_sql("""
                DECLARE @lock_result INT;
                EXEC @lock_result = sys.sp_getapplock @Resource='capitalflow_schema_migration',
                    @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
                IF @lock_result < 0 THROW 51003, 'Cannot acquire migration lock.', 1;
                IF OBJECT_ID('dbo.schema_migrations','U') IS NULL
                    CREATE TABLE dbo.schema_migrations(version VARCHAR(100) PRIMARY KEY, applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());
            """)
            if connection.scalar(text("SELECT COUNT(*) FROM dbo.schema_migrations WHERE version=:version"), {"version": VERSION}):
                transaction.rollback()
                return "already_applied"
            # Chặn thao tác ghi money/user đồng thời trong suốt thay đổi schema và baseline.
            for table in ("users", "accounts", "transactions", "categories", "budgets"):
                connection.exec_driver_sql(f"SELECT COUNT_BIG(*) FROM dbo.{table} WITH (TABLOCKX,HOLDLOCK)").scalar()
            for batch in re.split(r"^GO\s*$", SQL_FILE.read_text(encoding="utf-8"), flags=re.M):
                if batch.strip():
                    connection.exec_driver_sql(batch)
            connection.execute(text("INSERT INTO dbo.schema_migrations(version) VALUES (:version)"), {"version": VERSION})
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
    parser.add_argument("--apply", action="store_true", help="Commit after all preflight, schema and data steps succeed")
    args = parser.parse_args()
    print(migrate(apply=args.apply))
