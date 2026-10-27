"""Wallet bill payments and opt-in reporting, preserving all prior financial rows."""
from alembic import op
import sqlalchemy as sa

revision='cfdb_wallet_spending'
down_revision='cfdb_independent_wallets'
branch_labels=None
depends_on=None


def constraints(payment):
    op.drop_constraint('CK_wallet_entry_sign','wallet_entries',type_='check')
    op.drop_constraint('CK_wallet_entry_counterparty','wallet_entries',type_='check')
    outgoing="'WITHDRAW','TRANSFER_OUT','PAYMENT'" if payment else "'WITHDRAW','TRANSFER_OUT'"
    op.create_check_constraint('CK_wallet_entry_sign','wallet_entries',f"(kind IN ('TOPUP','TRANSFER_IN') AND amount > 0) OR (kind IN ({outgoing}) AND amount < 0)")
    condition="(kind IN ('TOPUP','WITHDRAW') AND bank_id IS NOT NULL AND counterparty_wallet_id IS NULL) OR (kind IN ('TRANSFER_IN','TRANSFER_OUT') AND bank_id IS NULL AND counterparty_wallet_id IS NOT NULL)"
    if payment: condition+=" OR (kind = 'PAYMENT' AND bank_id IS NULL AND counterparty_wallet_id IS NULL)"
    op.create_check_constraint('CK_wallet_entry_counterparty','wallet_entries',condition)
    op.drop_constraint('CK_transactions_source','transactions',type_='check')
    sources="'MANUAL','OCR','IMPORT','SYSTEM','WALLET'" if payment else "'MANUAL','OCR','IMPORT','SYSTEM'"
    op.create_check_constraint('CK_transactions_source','transactions',f'source IN ({sources})')


def upgrade():
    op.add_column('wallet_entries',sa.Column('merchant_name',sa.Unicode(150),nullable=True))
    op.add_column('wallet_entries',sa.Column('bill_reference',sa.Unicode(100),nullable=True))
    op.add_column('transactions',sa.Column('include_in_reports',sa.Boolean(),nullable=False,server_default='1'))
    op.add_column('transactions',sa.Column('wallet_entry_id',sa.Uuid(),nullable=True))
    op.create_foreign_key('FK_transactions_wallet_entry','transactions','wallet_entries',['wallet_entry_id'],['id'])
    op.create_index('UX_transactions_wallet_entry','transactions',['wallet_entry_id'],unique=True,mssql_where=sa.text('wallet_entry_id IS NOT NULL'))
    constraints(True)


def downgrade():
    conn=op.get_bind()
    if conn.scalar(sa.text("SELECT COUNT(*) FROM wallet_entries WHERE kind='PAYMENT'")) or conn.scalar(sa.text('SELECT COUNT(*) FROM transactions WHERE include_in_reports=0 OR wallet_entry_id IS NOT NULL')):
        raise RuntimeError('Cannot downgrade: payment or reporting preferences exist')
    constraints(False)
    op.drop_index('UX_transactions_wallet_entry',table_name='transactions')
    op.drop_constraint('FK_transactions_wallet_entry','transactions',type_='foreignkey')
    op.drop_column('transactions','wallet_entry_id')
    # SQL Server requires removing the generated default before dropping its column.
    op.drop_column('transactions','include_in_reports',mssql_drop_default=True)
    op.drop_column('wallet_entries','bill_reference')
    op.drop_column('wallet_entries','merchant_name')
