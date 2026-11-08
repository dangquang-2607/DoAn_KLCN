"""Retain the transfer message on both wallet ledger entries."""
from alembic import op
import sqlalchemy as sa

revision = 'cfdb_transfer_note'
down_revision = 'cfdb_invoice_evidence'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('wallet_entries', sa.Column('note', sa.Unicode(200), nullable=True))


def downgrade():
    if op.get_bind().scalar(sa.text('SELECT COUNT(*) FROM wallet_entries WHERE note IS NOT NULL')):
        raise RuntimeError('Cannot discard recorded transfer messages')
    op.drop_column('wallet_entries', 'note')
