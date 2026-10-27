"""Retire phone identities/OTP without changing users, wallets or email OTP."""
from alembic import op
import sqlalchemy as sa

revision = 'cfdb_email_only'
down_revision = 'cfdb_phone_verify'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("DELETE FROM password_reset_otps WHERE purpose LIKE 'PHONE[_]DEMO:%' OR purpose LIKE 'PHONE[_]SMS:%'")
    op.drop_index('UX_users_phone_number', table_name='users')
    op.drop_constraint('CK_users_phone_number', 'users', type_='check')
    for column in ('phone_verification_method', 'phone_verified_at', 'phone_number'):
        op.drop_column('users', column)


def downgrade():
    # Schema-only rollback cannot restore erased phone identities: use the backup.
    op.add_column('users', sa.Column('phone_number', sa.String(10), nullable=True))
    op.add_column('users', sa.Column('phone_verified_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('phone_verification_method', sa.String(10), nullable=True))
    op.create_check_constraint('CK_users_phone_number', 'users',
        "phone_number IS NULL OR (DATALENGTH(phone_number) = 10 AND phone_number COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9]%' AND LEFT(phone_number, 2) IN ('03','05','07','08','09'))")
    op.create_index('UX_users_phone_number', 'users', ['phone_number'], unique=True,
                    mssql_where=sa.text('phone_number IS NOT NULL'))
