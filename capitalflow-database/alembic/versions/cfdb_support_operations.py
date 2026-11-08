"""Record temporary account holds and case-scoped payment review."""
from alembic import op
import sqlalchemy as sa

revision = "cfdb_support_operations"
down_revision = "cfdb_account_support"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("support_lock_case_id", sa.Uuid()))
    for name in ("locked_user_id", "locked_by", "unlocked_by", "payment_user_id",
                 "payment_operation_id", "payment_reviewed_by"):
        op.add_column("account_support_cases", sa.Column(name, sa.Uuid()))
    for name in ("locked_at", "unlocked_at", "payment_reviewed_at"):
        op.add_column("account_support_cases", sa.Column(name, sa.DateTime()))
    for name in ("lock_reason", "unlock_reason", "payment_conclusion"):
        op.add_column("account_support_cases", sa.Column(name, sa.Unicode(500)))
    op.add_column("account_support_cases", sa.Column("payment_review_result", sa.String(20)))
    op.drop_index("UX_account_support_open", table_name="account_support_cases")
    non_payment = sa.text("status <> 'RESOLVED' AND issue <> 'PAYMENT'")
    payment = sa.text("status <> 'RESOLVED' AND payment_operation_id IS NOT NULL")
    op.create_index("UX_account_support_open", "account_support_cases", ["account_email", "issue"],
                    unique=True, mssql_where=non_payment, sqlite_where=non_payment)
    op.create_index("UX_account_support_payment_open", "account_support_cases", ["payment_user_id", "payment_operation_id"],
                    unique=True, mssql_where=payment, sqlite_where=payment)


def downgrade():
    raise RuntimeError("Release support holds and archive payment reviews before removing their schema.")
