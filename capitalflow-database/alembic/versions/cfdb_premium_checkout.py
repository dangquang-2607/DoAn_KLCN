"""Keep the provider's transfer details for resumable, first-party Premium checkout."""
from alembic import op
import sqlalchemy as sa

revision = "cfdb_premium_checkout"
down_revision = "cfdb_premium_billing"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("premium_payment_orders", sa.Column("checkout_data", sa.UnicodeText(), nullable=True))


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT COUNT(*) FROM premium_payment_orders WHERE checkout_data IS NOT NULL")):
        raise RuntimeError("Checkout data exists; restore a verified backup instead of discarding payment information")
    op.drop_column("premium_payment_orders", "checkout_data")
