"""Optional canonical phone for existing users, unique for all registered phones."""
from alembic import op
import sqlalchemy as sa

revision = 'cfdb_user_phone'
down_revision = 'cfdb_wallet_spending'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('phone_number', sa.String(10), nullable=True))
    op.create_check_constraint('CK_users_phone_number', 'users',
        "phone_number IS NULL OR (DATALENGTH(phone_number) = 10 AND phone_number COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9]%' AND LEFT(phone_number, 2) IN ('03','05','07','08','09'))")
    op.create_index('UX_users_phone_number', 'users', ['phone_number'], unique=True,
                    mssql_where=sa.text('phone_number IS NOT NULL'))


def downgrade():
    if op.get_bind().scalar(sa.text('SELECT COUNT(*) FROM users WHERE phone_number IS NOT NULL')):
        raise RuntimeError('Cannot downgrade while users have phone numbers; preserve registered identities.')
    op.drop_index('UX_users_phone_number', table_name='users')
    op.drop_constraint('CK_users_phone_number', 'users', type_='check')
    op.drop_column('users', 'phone_number')
