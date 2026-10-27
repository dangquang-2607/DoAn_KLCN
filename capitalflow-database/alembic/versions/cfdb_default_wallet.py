"""One permanent default wallet per user; preserve existing wallets and money."""
from alembic import op
import sqlalchemy as sa

revision = 'cfdb_default_wallet'
down_revision = 'cfdb_email_only'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('wallets', sa.Column('is_default', sa.Boolean(), nullable=False, server_default='0'))
    op.create_check_constraint('CK_default_wallet_active', 'wallets', 'is_default = 0 OR is_active = 1')
    op.create_index('UX_wallets_default_owner', 'wallets', ['user_id'], unique=True,
                    mssql_where=sa.text('is_default = 1'))
    op.execute("""INSERT INTO wallets (id, user_id, name, balance, is_active, is_default, created_at)
        SELECT NEWID(), id, N'Ví mặc định', 0, 1, 1, SYSUTCDATETIME()
        FROM users WHERE is_deleted = 0""")


def downgrade():
    if op.get_bind().scalar(sa.text('SELECT COUNT(*) FROM wallets WHERE is_default = 1')):
        raise RuntimeError('Default wallets exist; use a reviewed backup recovery instead of losing their identity')
    op.drop_index('UX_wallets_default_owner', table_name='wallets')
    op.drop_constraint('CK_default_wallet_active', 'wallets', type_='check')
    op.drop_column('wallets', 'is_default')
