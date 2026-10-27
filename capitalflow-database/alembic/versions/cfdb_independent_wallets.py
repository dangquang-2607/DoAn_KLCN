"""Independent demo money ledger; allow account-free bookkeeping without rewriting history.

No existing balance, transaction or invoice is converted, deleted or reclassified.
Deploy schema before the web/API release. Older API remains compatible with this
additive schema until cutover. Downgrade refuses to discard new business data.
"""
from alembic import op
import sqlalchemy as sa

revision = 'cfdb_independent_wallets'
down_revision = 'cfdb_bank_link_v2'
branch_labels = None
depends_on = None


def account_nullability(nullable):
    # SQL Server also treats INCLUDE columns as dependencies when restoring NOT NULL.
    indexes = [index for index in sa.inspect(op.get_bind()).get_indexes('transactions')
               if 'account_id' in index['column_names'] + index.get('include_columns', [])]
    for index in indexes:
        op.drop_index(index['name'], table_name='transactions')
    op.alter_column('transactions', 'account_id', existing_type=sa.Uuid(), nullable=nullable)
    for index in indexes:
        options = dict(index.get('dialect_options', {}))
        if options.get('mssql_where'):
            options['mssql_where'] = sa.text(options['mssql_where'])
        op.create_index(index['name'], 'transactions', index['column_names'], unique=index['unique'], **options)


def upgrade():
    op.create_table('wallets',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('user_id', sa.Uuid(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('name', sa.Unicode(150), nullable=False),
        sa.Column('balance', sa.Numeric(19, 2), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('SYSUTCDATETIME()')),
        sa.CheckConstraint('balance >= 0', name='CK_wallets_balance'))
    op.create_index('IX_wallets_owner', 'wallets', ['user_id', 'is_active'])
    op.create_table('wallet_demo_banks',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('user_id', sa.Uuid(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('provider', sa.String(20), nullable=False),
        sa.Column('account_number_masked', sa.String(20), nullable=False),
        sa.Column('opening_balance', sa.Numeric(19, 2), nullable=False),
        sa.Column('balance', sa.Numeric(19, 2), nullable=False),
        sa.UniqueConstraint('user_id', 'provider', name='UQ_wallet_bank_owner_provider'),
        sa.CheckConstraint('balance >= 0', name='CK_wallet_bank_balance'))
    op.create_table('wallet_bank_links',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('wallet_id', sa.Uuid(), sa.ForeignKey('wallets.id'), nullable=False),
        sa.Column('bank_id', sa.Uuid(), sa.ForeignKey('wallet_demo_banks.id'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('wallet_id', 'bank_id', name='UQ_wallet_bank_link'))
    op.create_table('wallet_entries',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('operation_id', sa.Uuid(), nullable=False),
        sa.Column('wallet_id', sa.Uuid(), sa.ForeignKey('wallets.id'), nullable=False),
        sa.Column('bank_id', sa.Uuid(), sa.ForeignKey('wallet_demo_banks.id'), nullable=True),
        sa.Column('counterparty_wallet_id', sa.Uuid(), sa.ForeignKey('wallets.id'), nullable=True),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('amount', sa.Numeric(19, 2), nullable=False),
        sa.Column('balance_after', sa.Numeric(19, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('SYSUTCDATETIME()')),
        sa.UniqueConstraint('operation_id', 'wallet_id', name='UQ_wallet_operation_leg'),
        sa.CheckConstraint("(kind IN ('TOPUP','TRANSFER_IN') AND amount > 0) OR (kind IN ('WITHDRAW','TRANSFER_OUT') AND amount < 0)", name='CK_wallet_entry_sign'),
        sa.CheckConstraint("(kind IN ('TOPUP','WITHDRAW') AND bank_id IS NOT NULL AND counterparty_wallet_id IS NULL) OR (kind IN ('TRANSFER_IN','TRANSFER_OUT') AND bank_id IS NULL AND counterparty_wallet_id IS NOT NULL)", name='CK_wallet_entry_counterparty'))
    op.create_index('IX_wallet_entries_history', 'wallet_entries', ['wallet_id', 'created_at', 'id'])
    account_nullability(True)


def downgrade():
    bind = op.get_bind()
    if any(bind.scalar(sa.text('SELECT COUNT(*) FROM ' + table)) for table in
           ('wallet_entries', 'wallet_bank_links', 'wallet_demo_banks', 'wallets')):
        raise RuntimeError('Cannot downgrade: independent wallet data exists')
    if bind.scalar(sa.text('SELECT COUNT(*) FROM transactions WHERE account_id IS NULL')):
        raise RuntimeError('Cannot downgrade: account-free bookkeeping exists')
    account_nullability(False)
    for table in ('wallet_entries', 'wallet_bank_links', 'wallet_demo_banks', 'wallets'):
        op.drop_table(table)
