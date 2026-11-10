"""Ba loại ví và kết nối ngân hàng mô phỏng. Thêm cột/index, mở rộng constraint, giữ loại ví legacy.
Revision này phải được kiểm chứng trên database tạm trước khi áp dụng live.
"""
from alembic import op
import sqlalchemy as sa

revision = "cfdb_wallet_demo"
down_revision = "cfdb_20260924_baseline"
branch_labels = None
depends_on = None

def upgrade():
    # Mở rộng tập giá trị cho phép; không đổi/xóa loại ví hoặc dữ liệu legacy.
    if op.get_bind().dialect.name == "mssql":
        op.drop_constraint("CK_accounts_type", "accounts", type_="check")
        op.create_check_constraint("CK_accounts_type", "accounts",
            "account_type IN ('BASIC','LINKED','BANK','CASH','CRYPTO','E_WALLET','CREDIT_CARD','SAVINGS','INVESTMENT','OTHER')")
    for column in [
        sa.Column("account_number_masked", sa.String(8), nullable=True),
        sa.Column("target_amount", sa.Numeric(19, 2), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("exclude_from_total", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("is_notification_enabled", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("bank_state", sa.Text(), nullable=True),
        sa.Column("savings_state", sa.Text(), nullable=True),
    ]:
        op.add_column("accounts", column)
    op.add_column("transactions", sa.Column("bank_reference", sa.String(100), nullable=True))
    op.create_index("UX_transactions_bank_reference", "transactions",
                    ["account_id", "bank_reference"], unique=True,
                    mssql_where=sa.text("bank_reference IS NOT NULL"),
                    sqlite_where=sa.text("bank_reference IS NOT NULL"))

def downgrade():
    """Chỉ hoàn tác khi các cột mới còn mặc định và chưa chứa dữ liệu nghiệp vụ."""
    bind = op.get_bind()
    used_accounts = bind.scalar(sa.text("""
        SELECT COUNT(*) FROM accounts WHERE account_type IN ('BASIC', 'LINKED')
          OR account_number_masked IS NOT NULL OR target_amount IS NOT NULL
          OR target_date IS NOT NULL OR exclude_from_total = 1
          OR is_notification_enabled = 0 OR bank_state IS NOT NULL
          OR savings_state IS NOT NULL
    """))
    used_transactions = bind.scalar(sa.text(
        "SELECT COUNT(*) FROM transactions WHERE bank_reference IS NOT NULL"
    ))
    if used_accounts or used_transactions:
        raise RuntimeError(
            "Đã có dữ liệu ví hoặc giao dịch ngân hàng; không thể hạ schema mà không mất dữ liệu."
        )
    op.drop_index("UX_transactions_bank_reference", table_name="transactions")
    op.drop_column("transactions", "bank_reference")
    for name in (
        "savings_state", "bank_state", "is_notification_enabled", "exclude_from_total",
        "target_date", "target_amount", "account_number_masked",
    ):
        op.drop_column("accounts", name,
                       mssql_drop_default=name in ("is_notification_enabled", "exclude_from_total"))
    if bind.dialect.name == "mssql":
        op.drop_constraint("CK_accounts_type", "accounts", type_="check")
        op.create_check_constraint("CK_accounts_type", "accounts",
            "account_type IN ('BANK','CASH','CRYPTO','E_WALLET','CREDIT_CARD','SAVINGS','INVESTMENT','OTHER')")
