"""Cover the financial reporting inclusion predicate with the existing index."""

from alembic import op

revision = "cfdb_reporting_cover"
down_revision = "cfdb_retire_user_deletion"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE NONCLUSTERED INDEX IX_transactions_reporting
        ON dbo.transactions (user_id, kind, transaction_date)
        INCLUDE (type, amount, category_id, include_in_reports)
        WITH (DROP_EXISTING = ON)
    """)


def downgrade():
    op.execute("""
        CREATE NONCLUSTERED INDEX IX_transactions_reporting
        ON dbo.transactions (user_id, kind, transaction_date)
        INCLUDE (type, amount, category_id)
        WITH (DROP_EXISTING = ON)
    """)
