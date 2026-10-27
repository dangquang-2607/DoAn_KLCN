"""Expand masked account storage for last-three-digit display.

Revision ID: cfdb_bank_link_v2
Revises: cfdb_bank_otp
"""
from alembic import op
import sqlalchemy as sa

revision = "cfdb_bank_link_v2"
down_revision = "cfdb_bank_otp"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("accounts", "account_number_masked", existing_type=sa.String(8),
                    type_=sa.String(20), existing_nullable=True)


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT COUNT(*) FROM accounts WHERE LEN(account_number_masked) > 8")):
        raise RuntimeError("Cannot shrink masked account numbers without losing data.")
    op.alter_column("accounts", "account_number_masked", existing_type=sa.String(20),
                    type_=sa.String(8), existing_nullable=True)
