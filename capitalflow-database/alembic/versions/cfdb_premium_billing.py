"""Premium payments and persistent AI usage, without changing existing user data."""
from alembic import op
import sqlalchemy as sa

revision = "cfdb_premium_billing"
down_revision = "cfdb_support_requests"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("user_subscriptions",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("premium_until", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.sysutcdatetime(), nullable=False))
    op.create_table("premium_payment_orders",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("order_code", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("days", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("payment_link_id", sa.String(100)),
        sa.Column("checkout_url", sa.Unicode(500)),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.sysutcdatetime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.sysutcdatetime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("paid_at", sa.DateTime()), sa.Column("premium_from", sa.DateTime()), sa.Column("premium_until", sa.DateTime()),
        sa.CheckConstraint("amount > 0 AND days > 0", name="CK_premium_order_price"))
    op.create_index("IX_premium_orders_user_created", "premium_payment_orders", ["user_id", "created_at"])
    op.create_table("ai_monthly_usage",
        sa.Column("job_id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("consumed", sa.Boolean(), nullable=False, server_default=sa.text("0")))
    op.create_index("IX_ai_usage_user_month", "ai_monthly_usage", ["user_id", "month"])


def downgrade():
    for name in ("user_subscriptions", "premium_payment_orders", "ai_monthly_usage"):
        if op.get_bind().scalar(sa.text(f"SELECT COUNT(*) FROM {name}")):
            raise RuntimeError("Premium data exists; restore a verified backup rather than dropping customer records")
    op.drop_table("ai_monthly_usage")
    op.drop_table("premium_payment_orders")
    op.drop_table("user_subscriptions")
