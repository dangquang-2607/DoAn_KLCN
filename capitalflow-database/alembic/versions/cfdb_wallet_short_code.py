"""Stable short receiving codes without changing wallet IDs or balances."""
import secrets
from alembic import op
import sqlalchemy as sa

revision = 'cfdb_wallet_short_code'
down_revision = 'cfdb_default_wallet'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('wallets', sa.Column('short_code', sa.String(11), nullable=True))
    conn = op.get_bind()
    used = set()
    for wallet_id in conn.execute(sa.text('SELECT id FROM wallets')).scalars().all():
        while True:
            code = 'CF-' + ''.join(secrets.choice('23456789ABCDEFGHJKLMNPQRSTUVWXYZ') for _ in range(8))
            if code not in used:
                used.add(code)
                break
        conn.execute(sa.text('UPDATE wallets SET short_code=:code WHERE id=:id'), {'code':code, 'id':wallet_id})
    op.alter_column('wallets', 'short_code', existing_type=sa.String(11), nullable=False)
    op.create_unique_constraint('UQ_wallets_short_code', 'wallets', ['short_code'])


def downgrade():
    raise RuntimeError('Short receiving codes may have been shared; use reviewed backup recovery to avoid losing identities')
