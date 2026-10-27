"""Explicit SMS versus demo verification; existing phones remain unverified."""
from alembic import op
import sqlalchemy as sa

revision = 'cfdb_phone_verify'
down_revision = 'cfdb_user_banks'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('phone_verified_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('phone_verification_method', sa.String(10), nullable=True))


def downgrade():
    if op.get_bind().scalar(sa.text('SELECT COUNT(*) FROM users WHERE phone_verified_at IS NOT NULL')):
        raise RuntimeError('Phone verifications exist; refusing to discard them')
    op.drop_column('users', 'phone_verification_method')
    op.drop_column('users', 'phone_verified_at')
