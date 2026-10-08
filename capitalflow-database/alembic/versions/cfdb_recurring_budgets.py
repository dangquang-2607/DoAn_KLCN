"""Add recurring budget settings while preserving every fixed-date budget."""

from alembic import op
import sqlalchemy as sa

revision = "cfdb_recurring_budgets"
down_revision = "cfdb_notifications"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("budgets", sa.Column("is_recurring", sa.Boolean(), nullable=False, server_default="0"))
    op.add_column("budgets", sa.Column("recurrence_end_date", sa.Date(), nullable=True))
    op.create_table(
        "budget_changes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("budget_id", sa.Uuid(), sa.ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("name", sa.Unicode(150), nullable=False),
        sa.Column("amount_limit", sa.Numeric(19, 2), nullable=False),
        sa.Column("warning_percent", sa.Numeric(5, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
    )
    op.create_index("UX_budget_changes_date", "budget_changes", ["budget_id", "effective_date"], unique=True)


def downgrade():
    bind = op.get_bind()
    if bind.scalar(sa.text("SELECT COUNT(*) FROM budgets WHERE is_recurring = 1")) or bind.scalar(
        sa.text("SELECT COUNT(*) FROM budget_changes")
    ):
        raise RuntimeError("Ngân sách định kỳ đã có dữ liệu; không thể hạ schema mà không mất lịch sử.")
    op.drop_index("UX_budget_changes_date", table_name="budget_changes")
    op.drop_table("budget_changes")
    op.drop_column("budgets", "recurrence_end_date")
    op.drop_column("budgets", "is_recurring", mssql_drop_default=True)
