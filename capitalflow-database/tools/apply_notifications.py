"""Nâng database cấu hình hiện tại sau preflight và backup COPY_ONLY đã xác minh.

Chỉ chấp nhận version cfdb_wallet_demo. Không chạy lặp và không xóa backup.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import PureWindowsPath
from pathlib import Path
from uuid import UUID

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / "capitalflow-api"))
from app.dung_chung.config import settings  # noqa: E402


def main():
    url = make_url(settings.database_url)
    database = url.database
    if database != "personal_finance":
        raise RuntimeError("Chỉ cho phép nâng database personal_finance đã chỉ định trong cấu hình.")
    engine = create_engine(url, hide_parameters=True)
    with engine.connect() as connection:
        version = connection.scalar(text("SELECT version_num FROM alembic_version"))
        if version != "cfdb_wallet_demo":
            raise RuntimeError(f"Schema hiện tại là {version}; cần cfdb_wallet_demo trước khi nâng.")
        before_accounts = connection.scalar(text("SELECT COUNT(*) FROM accounts"))
        before_transactions = connection.scalar(text("SELECT COUNT(*) FROM transactions"))
        legacy = []
        seen_ids = set()
        for state, in connection.execute(text("SELECT savings_state FROM accounts WHERE savings_state IS NOT NULL")):
            try:
                messages = json.loads(state or "{}").get("messages", [])
            except (TypeError, ValueError) as exc:
                raise RuntimeError("savings_state không đọc được; dừng trước migration.") from exc
            for message in messages:
                if not isinstance(message, dict) or not message.get("text"):
                    raise RuntimeError("Có thông báo cũ thiếu nội dung; dừng trước migration.")
                try:
                    notice_id = UUID(str(message.get("id")))
                except (TypeError, ValueError):
                    notice_id = None
                if notice_id in seen_ids and notice_id is not None:
                    raise RuntimeError("Trùng ID thông báo cũ; dừng trước migration.")
                seen_ids.add(notice_id)
                legacy.append(message)
        backup_dir = connection.scalar(text("SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(4000))"))
        if not backup_dir:
            raise RuntimeError("Không xác định được thư mục backup mặc định của SQL Server.")

    backup_name = "CapitalFlow_pre_notifications_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S") + ".bak"
    backup_path = str(PureWindowsPath(backup_dir) / backup_name)
    # ODBC trả về nhiều result set cho BACKUP/RESTORE; phải đọc hết trước khi
    # gửi lệnh tiếp theo, nếu không backup có thể chưa kết thúc trên SQL Server.
    backup_engine = create_engine(url, isolation_level="AUTOCOMMIT", hide_parameters=True)
    raw = backup_engine.raw_connection()
    try:
        if not raw.driver_connection.autocommit:
            raise RuntimeError("Kết nối backup chưa ở chế độ AUTOCOMMIT.")
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

    command.upgrade(Config(str(ROOT / "alembic.ini")), "cfdb_notifications")
    with engine.connect() as connection:
        version = connection.scalar(text("SELECT version_num FROM alembic_version"))
        after_accounts = connection.scalar(text("SELECT COUNT(*) FROM accounts"))
        after_transactions = connection.scalar(text("SELECT COUNT(*) FROM transactions"))
        count = connection.scalar(text("SELECT COUNT(*) FROM notifications"))
        read_count = connection.scalar(text("SELECT COUNT(*) FROM notifications WHERE read_at IS NOT NULL"))
    engine.dispose()
    if version != "cfdb_notifications" or (after_accounts, after_transactions) != (before_accounts, before_transactions):
        raise RuntimeError("Sau nâng cấp, version hoặc số bản ghi tài chính không khớp preflight.")
    if count < len(legacy) or read_count < sum(bool(item.get("read_at")) for item in legacy):
        raise RuntimeError("Số thông báo hoặc trạng thái đã đọc sau backfill không khớp.")
    print(f"MIGRATION_PASS; accounts={after_accounts}; transactions={after_transactions}; migrated_notices={len(legacy)}")
    print("BACKUP_VERIFIED=" + backup_path)


if __name__ == "__main__":
    main()
