"""Keep deduplication evidence for posted receipts after source deletion."""
from alembic import op
import sqlalchemy as sa

revision = 'cfdb_invoice_evidence'
down_revision = 'cfdb_legacy_cleanup'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('invoice_posting_evidence',
        sa.Column('transaction_id', sa.Uuid(), sa.ForeignKey('transactions.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('invoice_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('file_sha256', sa.String(64)),
        sa.Column('strong_identity_key', sa.String(64)),
        sa.Column('invoice_date', sa.Date()),
        sa.Column('invoice_number', sa.Unicode(100)),
        sa.Column('snapshot_json', sa.UnicodeText(), nullable=False),
        sa.Column('basket_hash', sa.String(64)),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('purged_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('invoice_id', name='UQ_invoice_evidence_invoice'))
    for name, columns in [('file', ['user_id', 'file_sha256']), ('identity', ['user_id', 'strong_identity_key']),
                          ('date', ['user_id', 'invoice_date']), ('number', ['user_id', 'invoice_number'])]:
        op.create_index('IX_invoice_evidence_' + name, 'invoice_posting_evidence', columns)


def downgrade():
    if op.get_bind().scalar(sa.text('SELECT COUNT(*) FROM invoice_posting_evidence')):
        raise RuntimeError('Cannot discard deduplication evidence while posted transactions remain')
    op.drop_table('invoice_posting_evidence')
