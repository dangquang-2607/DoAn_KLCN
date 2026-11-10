"""Remove unused payment case columns from the account support table."""

from alembic import op
import sqlalchemy as sa

revision = "cfdb_account_support_only"
down_revision = "cfdb_support_operations"
branch_labels = None
depends_on = None


def upgrade():
    # Hold the table until the transaction completes so the check also covers
    # databases where an older version of the API is still running.
    op.execute(sa.text("""
        IF EXISTS (
            SELECT 1 FROM dbo.account_support_cases WITH (TABLOCKX, HOLDLOCK)
            WHERE issue = 'PAYMENT'
               OR payment_user_id IS NOT NULL OR payment_operation_id IS NOT NULL
               OR payment_conclusion IS NOT NULL OR payment_review_result IS NOT NULL
               OR payment_reviewed_by IS NOT NULL OR payment_reviewed_at IS NOT NULL
        )
        BEGIN
            THROW 51001, 'Existing records must be retained before upgrading account support.', 1;
        END
    """))
    for name in ("UX_account_support_payment_open", "UX_account_support_open"):
        op.drop_index(name, table_name="account_support_cases")
    for name in ("payment_user_id", "payment_operation_id", "payment_conclusion", "payment_review_result",
                 "payment_reviewed_by", "payment_reviewed_at"):
        op.drop_column("account_support_cases", name)
    active = sa.text("status <> 'RESOLVED'")
    op.create_index("UX_account_support_open", "account_support_cases", ["account_email", "issue"],
                    unique=True, mssql_where=active, sqlite_where=active)


def downgrade():
    raise RuntimeError("Restore a pre-upgrade backup before reverting account support.")
