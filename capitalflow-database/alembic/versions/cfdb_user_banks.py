"""User-level links and private demo account numbers; retain old links for audit."""
from alembic import op
import sqlalchemy as sa
import secrets
import uuid

revision = 'cfdb_user_banks'
down_revision = 'cfdb_user_phone'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('wallet_demo_banks', sa.Column('account_number', sa.String(20), nullable=True))
    conn = op.get_bind()
    lengths = {'VCB': 13, 'ACB': 9, 'MB': 13, 'TCB': 14}
    assigned = set()
    for bank in conn.execute(sa.text('SELECT id,provider FROM wallet_demo_banks')).mappings().all():
        length = lengths[bank['provider']]
        while True:
            number = str(secrets.randbelow(9 * 10 ** (length - 1)) + 10 ** (length - 1))
            if (bank['provider'], number) not in assigned:
                break
        assigned.add((bank['provider'], number))
        conn.execute(sa.text('UPDATE wallet_demo_banks SET account_number=:number, account_number_masked=:masked WHERE id=:id'),
                     {'number': number, 'masked': '*' * (length - 3) + number[-3:], 'id': bank['id']})
    op.alter_column('wallet_demo_banks', 'account_number', existing_type=sa.String(20), nullable=False)
    op.create_unique_constraint('UQ_demo_bank_number', 'wallet_demo_banks', ['provider', 'account_number'])
    op.create_table('user_bank_links',
        sa.Column('id', sa.Uuid(), primary_key=True),
        sa.Column('user_id', sa.Uuid(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('bank_id', sa.Uuid(), sa.ForeignKey('wallet_demo_banks.id'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('user_id', 'bank_id', name='UQ_user_bank_link'))
    assert not conn.scalar(sa.text('SELECT COUNT(*) FROM wallet_bank_links l JOIN wallets w ON w.id=l.wallet_id JOIN wallet_demo_banks b ON b.id=l.bank_id WHERE w.user_id<>b.user_id'))
    links = conn.execute(sa.text('SELECT b.user_id,l.bank_id,MAX(CAST(l.is_active AS int)) active,MAX(CASE WHEN l.is_active=1 THEN l.expires_at ELSE NULL END) active_expiry,MAX(l.expires_at) expiry FROM wallet_bank_links l JOIN wallet_demo_banks b ON b.id=l.bank_id GROUP BY b.user_id,l.bank_id')).mappings().all()
    for row in links:
        conn.execute(sa.text('INSERT INTO user_bank_links (id,user_id,bank_id,is_active,expires_at) VALUES (:id,:user,:bank,:active,:expiry)'),
                     {'id': str(uuid.uuid4()), 'user': row['user_id'], 'bank': row['bank_id'], 'active': row['active'], 'expiry': row['active_expiry'] or row['expiry']})
    # Old challenges were wallet-scoped and must not authorize a user-wide link.
    conn.execute(sa.text("UPDATE password_reset_otps SET is_used=1 WHERE purpose LIKE 'LINK_BANK:%' AND is_used=0"))


def downgrade():
    if op.get_bind().scalar(sa.text('SELECT COUNT(*) FROM user_bank_links')):
        raise RuntimeError('User bank links exist; restore a backup rather than discard authorization scope')
    op.drop_table('user_bank_links')
    op.drop_constraint('UQ_demo_bank_number', 'wallet_demo_banks', type_='unique')
    op.drop_column('wallet_demo_banks', 'account_number')
