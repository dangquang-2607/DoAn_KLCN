"""Add authenticated support requests and queued email responses."""

from alembic import op
import sqlalchemy as sa

revision = "cfdb_support_requests"
down_revision = "cfdb_reporting_cover"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "support_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("account_email", sa.Unicode(255), nullable=False),
        sa.Column("full_name", sa.Unicode(150), nullable=False),
        sa.Column("title", sa.Unicode(100), nullable=False),
        sa.Column("message", sa.Unicode(1500), nullable=False),
        sa.Column("reply", sa.Unicode(1500)),
        sa.Column("replied_by", sa.Uuid(), sa.ForeignKey("users.id")),
        sa.Column("reply_job_id", sa.Uuid(), sa.ForeignKey("background_jobs.id")),
        sa.Column("reply_queued_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.sysutcdatetime(), nullable=False),
    )
    op.create_index("IX_support_requests_queue", "support_requests", ["created_at", "id"])


def downgrade():
    op.drop_index("IX_support_requests_queue", table_name="support_requests")
    op.drop_table("support_requests")
