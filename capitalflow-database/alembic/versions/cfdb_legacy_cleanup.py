"""Retire the empty, superseded per-wallet bank-link table.

No financial rows, historical migrations, reporting views or SSMS objects change.
Refuse to discard any old link. Downgrade recreates the empty original schema.
"""
from alembic import op
import sqlalchemy as sa

revision = 'cfdb_legacy_cleanup'
down_revision = 'cfdb_wallet_short_code'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    count = conn.scalar(sa.text(
        'SELECT COUNT_BIG(*) FROM dbo.wallet_bank_links WITH (TABLOCKX, HOLDLOCK)'
    ))
    if count:
        raise RuntimeError('Legacy bank links are not empty; retain and review them')
    dependencies = conn.scalar(sa.text("""
        SELECT
          (SELECT COUNT(*) FROM sys.foreign_keys
           WHERE referenced_object_id=OBJECT_ID('dbo.wallet_bank_links'))
          + (SELECT COUNT(*) FROM sys.sql_expression_dependencies
             WHERE referenced_id=OBJECT_ID('dbo.wallet_bank_links')
               AND referencing_id<>OBJECT_ID('dbo.wallet_bank_links'))
    """))
    if dependencies:
        raise RuntimeError('Legacy bank links have dependent SQL objects; stop')
    op.drop_table('wallet_bank_links')


def downgrade():
    op.create_table('wallet_bank_links',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('wallet_id', sa.Uuid(), sa.ForeignKey('wallets.id'), nullable=False),
        sa.Column('bank_id', sa.Uuid(), sa.ForeignKey('wallet_demo_banks.id'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('wallet_id', 'bank_id', name='UQ_wallet_bank_link'))
