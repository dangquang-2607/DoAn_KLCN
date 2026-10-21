"""Invoice identity, lifecycle and decision history (additive release)."""
from alembic import op
import sqlalchemy as sa

revision = "cfdb_invoice_dedup"
down_revision = "cfdb_recurring_budgets"
branch_labels = None
depends_on = None


def upgrade():
    for name, kind in (("file_sha256", sa.String(64)), ("strong_identity_key", sa.String(64)),
                       ("merchant_normalized", sa.Unicode(255)), ("invoice_time", sa.String(8)),
                       ("deleted_at", sa.DateTime()), ("duplicate_of_invoice_id", sa.Uuid())):
        op.add_column("invoices", sa.Column(name, kind, nullable=True))
    for name, default in (("identity_rule_version", "1"), ("revision", "1"), ("confirmation_generation", "0")):
        op.add_column("invoices", sa.Column(name, sa.Integer(), nullable=False, server_default=default))
    op.create_foreign_key("FK_invoices_duplicate_of", "invoices", "invoices", ["duplicate_of_invoice_id"], ["id"])
    op.create_index("IX_invoices_user_hash", "invoices", ["user_id", "file_sha256"])
    op.create_index("IX_invoices_user_identity", "invoices", ["user_id", "strong_identity_key"])
    op.create_index("IX_invoices_candidates", "invoices", ["user_id", "invoice_date", "total_amount", "currency"])
    # Legacy keys start NULL. Backfill preflights every confirmed collision
    # and aborts before changing any row; it never merges financial data.
    for name, column in (("UX_invoices_confirmed_hash", "file_sha256"),
                         ("UX_invoices_confirmed_identity", "strong_identity_key")):
        condition = sa.text(f"status = 'CONFIRMED' AND {column} IS NOT NULL")
        op.create_index(name, "invoices", ["user_id", column], unique=True,
                        mssql_where=condition, sqlite_where=condition)
    op.create_table("invoice_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("invoice_id", sa.Uuid(), sa.ForeignKey("invoices.id"), nullable=False),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("details_json", sa.UnicodeText(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.sysutcdatetime(), nullable=False))
    op.create_index("IX_invoice_events_user_invoice", "invoice_events", ["user_id", "invoice_id", "created_at"])


def downgrade():
    connection = op.get_bind()
    if connection.scalar(sa.text("SELECT COUNT(*) FROM invoice_events")) or connection.scalar(sa.text(
        "SELECT COUNT(*) FROM invoices WHERE file_sha256 IS NOT NULL OR strong_identity_key IS NOT NULL "
        "OR deleted_at IS NOT NULL OR duplicate_of_invoice_id IS NOT NULL OR revision <> 1 OR confirmation_generation <> 0"
    )):
        raise RuntimeError("Invoice deduplication contains data; retain schema instead of losing history.")
    op.drop_index("IX_invoice_events_user_invoice", table_name="invoice_events")
    op.drop_table("invoice_events")
    for name in ("UX_invoices_confirmed_identity", "UX_invoices_confirmed_hash", "IX_invoices_candidates",
                 "IX_invoices_user_identity", "IX_invoices_user_hash"):
        op.drop_index(name, table_name="invoices")
    op.drop_constraint("FK_invoices_duplicate_of", "invoices", type_="foreignkey")
    for name in ("identity_rule_version", "revision", "confirmation_generation"):
        op.drop_column("invoices", name, mssql_drop_default=True)
    for name in ("duplicate_of_invoice_id", "deleted_at", "invoice_time", "merchant_normalized",
                 "strong_identity_key", "file_sha256"):
        op.drop_column("invoices", name)
