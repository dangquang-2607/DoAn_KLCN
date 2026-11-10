"""Store session-bound Android FCM registrations."""
from alembic import op
import sqlalchemy as sa

revision = "cfdb_push_registrations"
down_revision = "cfdb_premium_checkout"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "push_registrations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("token_version", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(8), nullable=False),
        sa.Column("target_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("destination", sa.UnicodeText(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )
    op.create_index("IX_push_registrations_user_expiry", "push_registrations", ["user_id", "expires_at"])


def downgrade():
    op.drop_index("IX_push_registrations_user_expiry", table_name="push_registrations")
    op.drop_table("push_registrations")
