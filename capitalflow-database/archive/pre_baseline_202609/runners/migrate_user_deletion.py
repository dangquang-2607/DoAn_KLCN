"""Migration SQL Server theo transaction cho quy trình quản trị viên xóa user.

Vai trò: bổ sung trạng thái bền vững và checkpoint cho soft delete/purge/file cleanup.
Đầu vào: SQL migration theo VERSION và tùy chọn ``--apply``.
Đầu ra/side effect: thay đổi users/background_jobs và ghi version khi commit.
Ràng buộc an toàn: application lock, khóa hai bảng và rollback mặc định.
"""
import argparse
import re
from pathlib import Path

from sqlalchemy import text

from app.core.database import engine


VERSION = "20260914_user_deletion"
SQL_FILE = Path(__file__).resolve().parents[1] / "migrations" / f"{VERSION}.sql"


def migrate(apply: bool = False):
    if engine.dialect.name != "mssql":
        raise RuntimeError("This migration requires SQL Server")
    # Khóa users và background_jobs vì migration bổ sung vòng đời xóa bất đồng bộ;
    # application lock bảo đảm chỉ một tiến trình thay đổi schema tại một thời điểm.
    with engine.connect() as connection:
        transaction = connection.begin()
        try:
            connection.exec_driver_sql("SET XACT_ABORT ON; SET LOCK_TIMEOUT 15000;")
            connection.exec_driver_sql(
                """
                DECLARE @lock_result INT;
                EXEC @lock_result = sys.sp_getapplock
                    @Resource='capitalflow_schema_migration',
                    @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
                IF @lock_result < 0 THROW 51014, 'Cannot acquire migration lock.', 1;
                IF OBJECT_ID('dbo.schema_migrations','U') IS NULL
                    CREATE TABLE dbo.schema_migrations(
                        version VARCHAR(100) PRIMARY KEY,
                        applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
                    );
                """
            )
            if connection.scalar(
                text("SELECT COUNT(*) FROM dbo.schema_migrations WHERE version=:version"),
                {"version": VERSION},
            ):
                transaction.rollback()
                return "already_applied"
            for table in ("users", "background_jobs"):
                connection.exec_driver_sql(
                    f"SELECT COUNT_BIG(*) FROM dbo.{table} WITH (TABLOCKX,HOLDLOCK)"
                ).scalar()
            # Tách GO thành các batch SQL Server nhưng giữ nguyên một transaction.
            # Chế độ mặc định rollback; --apply mới commit schema và version record.
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
    args = parser.parse_args()
    print(migrate(apply=args.apply))
