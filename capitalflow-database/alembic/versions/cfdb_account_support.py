"""Add account support cases, a restricted admin profile and OTP delivery metadata."""
from alembic import op
import sqlalchemy as sa

revision = "cfdb_account_support"
down_revision = "cfdb_transfer_note"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("support_only", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("password_reset_otps", sa.Column("delivery_status", sa.String(16)))
    op.add_column("password_reset_otps", sa.Column("issue_source", sa.String(16)))
    op.create_index("IX_reset_otp_account_time", "password_reset_otps", ["user_id", "purpose", "created_at"])
    op.create_table(
        "account_support_cases",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("account_email", sa.Unicode(255), nullable=False),
        sa.Column("contact_email", sa.Unicode(255)),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("issue", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_by", sa.Uuid()),
        sa.Column("assisted_by", sa.Uuid()),
        sa.Column("assisted_at", sa.DateTime()),
        sa.Column("otp_id", sa.Uuid()),
        sa.Column("updated_by", sa.Uuid()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.sysutcdatetime()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.sysutcdatetime()),
    )
    op.create_index("IX_account_support_queue", "account_support_cases", ["status", "created_at"])
    op.create_index("IX_account_support_email", "account_support_cases", ["account_email", "created_at"])
    op.create_index("UX_account_support_open", "account_support_cases", ["account_email", "issue"],
                    unique=True, mssql_where=sa.text("status <> 'RESOLVED'"),
                    sqlite_where=sa.text("status <> 'RESOLVED'"))


def downgrade():
    raise RuntimeError("Export support cases and revoke restricted admin accounts before removing their schema.")
