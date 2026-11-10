"""Thông báo tập trung; chuyển lịch sử thông báo ví sang bảng riêng.

Revision phải chạy sau cfdb_wallet_demo. Không xóa JSON cũ trong migration để
có thể kiểm tra đối chiếu dữ liệu ngay sau nâng cấp.
"""

import json
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

revision = "cfdb_notifications"
down_revision = "cfdb_wallet_demo"
branch_labels = None
depends_on = None


def _utc_naive(value):
    if not value:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc).replace(tzinfo=None)
    return parsed.astimezone(timezone.utc).replace(tzinfo=None) if parsed.tzinfo else parsed


def upgrade():
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("title", sa.Unicode(160), nullable=False),
        sa.Column("message", sa.Unicode(1000), nullable=False),
        sa.Column("source_type", sa.String(30), nullable=True),
        sa.Column("source_id", sa.Uuid(), nullable=True),
        sa.Column("action_url", sa.Unicode(300), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("dedupe_key", sa.String(180), nullable=True),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.sysutcdatetime()),
    )
    op.create_index("IX_notifications_user_created", "notifications", ["user_id", "created_at", "id"])
    op.create_index("IX_notifications_user_unread", "notifications", ["user_id", "read_at"])
    op.create_index("UX_notifications_user_dedupe", "notifications", ["user_id", "dedupe_key"],
                    unique=True, mssql_where=sa.text("dedupe_key IS NOT NULL"),
                    sqlite_where=sa.text("dedupe_key IS NOT NULL"))

    bind = op.get_bind()
    accounts = sa.table("accounts", sa.column("id", sa.Uuid()), sa.column("user_id", sa.Uuid()),
                        sa.column("name", sa.Unicode(150)), sa.column("savings_state", sa.Text()))
    notifications = sa.table("notifications", sa.column("id", sa.Uuid()), sa.column("user_id", sa.Uuid()),
                             sa.column("kind", sa.String(30)), sa.column("severity", sa.String(16)),
                             sa.column("title", sa.Unicode(160)), sa.column("message", sa.Unicode(1000)),
                             sa.column("source_type", sa.String(30)), sa.column("source_id", sa.Uuid()),
                             sa.column("action_url", sa.Unicode(300)), sa.column("read_at", sa.DateTime()),
                             sa.column("created_at", sa.DateTime()))
    for account in bind.execute(sa.select(accounts).where(accounts.c.savings_state.is_not(None))):
        try:
            messages = json.loads(account.savings_state or "{}").get("messages", [])
        except (ValueError, TypeError):
            messages = []
        for index, message in enumerate(messages):
            if not isinstance(message, dict) or not message.get("text"):
                continue
            try:
                notice_id = uuid.UUID(str(message.get("id")))
            except (ValueError, TypeError):
                notice_id = uuid.uuid5(uuid.NAMESPACE_URL, f"{account.id}:{index}")
            goal = "đã đạt mục tiêu" in message["text"]
            bind.execute(notifications.insert().values(
                id=notice_id, user_id=account.user_id,
                kind="SAVINGS" if goal else "ACCOUNT", severity="INFO",
                title="Đạt mục tiêu tiết kiệm" if goal else "Biến động số dư",
                message=message["text"], source_type="ACCOUNT", source_id=account.id,
                action_url="/accounts",
                read_at=_utc_naive(message["read_at"]) if message.get("read_at") else None,
                created_at=_utc_naive(message.get("at")),
            ))


def downgrade():
    bind = op.get_bind()
    if bind.scalar(sa.text("SELECT COUNT(*) FROM notifications")):
        raise RuntimeError("Bảng notifications có dữ liệu; không thể hạ schema mà không mất thông báo.")
    op.drop_index("UX_notifications_user_dedupe", table_name="notifications")
    op.drop_index("IX_notifications_user_unread", table_name="notifications")
    op.drop_index("IX_notifications_user_created", table_name="notifications")
    op.drop_table("notifications")
