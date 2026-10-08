"""Back up and upgrade the configured personal_finance SQL Server database."""

import sys
from datetime import datetime, timezone
from pathlib import Path, PureWindowsPath

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / "capitalflow-api"))
from app.dung_chung.config import settings  # noqa: E402


def main():
    url = make_url(settings.database_url)
    if url.database != "personal_finance":
        raise RuntimeError("Chỉ nâng database personal_finance được cấu hình.")
    engine = create_engine(url, hide_parameters=True)
    with engine.connect() as connection:
        version = connection.scalar(text("SELECT version_num FROM alembic_version"))
        if version != "cfdb_notifications":
            raise RuntimeError(f"Cần cfdb_notifications; hiện tại là {version}.")
        before = {table: connection.scalar(text(f"SELECT COUNT(*) FROM {table}"))
                  for table in ("users", "categories", "budgets", "transactions", "notifications")}
        backup_dir = connection.scalar(text("SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000))"))
        if not backup_dir:
            raise RuntimeError("Không xác định được thư mục backup SQL Server.")
    backup_path = str(PureWindowsPath(backup_dir) / (
        "CapitalFlow_pre_recurring_budgets_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S") + ".bak"
    ))
    backup_engine = create_engine(url, isolation_level="AUTOCOMMIT", hide_parameters=True)
    raw = backup_engine.raw_connection()
    try:
        cursor = raw.cursor()
        try:
            cursor.execute("BACKUP DATABASE [personal_finance] TO DISK = ? WITH COPY_ONLY, INIT, CHECKSUM", backup_path)
            while cursor.nextset():
                pass
            cursor.execute("RESTORE VERIFYONLY FROM DISK = ? WITH CHECKSUM", backup_path)
            while cursor.nextset():
                pass
        finally:
            cursor.close()
    finally:
        raw.close()
        backup_engine.dispose()
    command.upgrade(Config(str(ROOT / "alembic.ini")), "cfdb_recurring_budgets")
    with engine.connect() as connection:
        after = {table: connection.scalar(text(f"SELECT COUNT(*) FROM {table}"))
                 for table in before}
        legacy = connection.scalar(text("SELECT COUNT(*) FROM budgets WHERE is_recurring = 0"))
        version = connection.scalar(text("SELECT version_num FROM alembic_version"))
    engine.dispose()
    if after != before or legacy != before["budgets"] or version != "cfdb_recurring_budgets":
        raise RuntimeError("Đối chiếu sau migration không khớp; kiểm tra backup và schema.")
    print("MIGRATION_PASS; budgets_preserved=" + str(legacy))
    print("BACKUP_VERIFIED=" + backup_path)


if __name__ == "__main__":
    main()
