"""Complete the schema required by the email OTP bank-linking release."""
from alembic import op
import sqlalchemy as sa

revision = "cfdb_bank_otp"
down_revision = "cfdb_invoice_dedup"
branch_labels = None
depends_on = None


def upgrade():
    # Existing codes were issued for password resets before purpose existed.
    op.add_column("password_reset_otps", sa.Column(
        "purpose", sa.String(50), nullable=False, server_default="RESET_PASSWORD",
    ))
    # The imported ORM now omits created_at and expects a database default.
    op.alter_column("password_reset_otps", "created_at",
                    existing_type=sa.DateTime(), existing_nullable=False,
                    server_default=sa.func.sysutcdatetime())


def downgrade():
    if op.get_bind().scalar(sa.text(
        "SELECT COUNT(*) FROM password_reset_otps WHERE purpose <> 'RESET_PASSWORD'"
    )):
        raise RuntimeError("Bank OTP records exist; retain schema to preserve their purpose.")
    op.alter_column("password_reset_otps", "created_at",
                    existing_type=sa.DateTime(), existing_nullable=False,
                    server_default=None)
    op.drop_column("password_reset_otps", "purpose", mssql_drop_default=True)
