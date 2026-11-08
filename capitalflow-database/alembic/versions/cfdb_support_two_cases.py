"""Retire the two assisted account workflows from the local demo schema."""

from alembic import op
import sqlalchemy as sa

revision = "cfdb_support_two_cases"
down_revision = "cfdb_account_support_only"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("""
        IF EXISTS (
            SELECT 1 FROM dbo.account_support_cases WITH (TABLOCKX, HOLDLOCK)
            WHERE locked_at IS NOT NULL AND unlocked_at IS NULL
        ) OR EXISTS (
            SELECT 1 FROM dbo.users WITH (TABLOCKX, HOLDLOCK)
            WHERE support_lock_case_id IS NOT NULL
        )
        BEGIN
            THROW 51002, 'Resolve active account holds before upgrading account support.', 1;
        END
    """))
    op.execute(sa.text("""
        UPDATE dbo.password_reset_otps
        SET is_used = 1
        WHERE issue_source = 'SUPPORT' AND purpose = 'RESET_PASSWORD'
          AND is_used = 0 AND expires_at > SYSUTCDATETIME()
    """))
    op.execute(sa.text("DELETE FROM dbo.account_support_cases WHERE issue IN ('OTP', 'SECURITY')"))
    for name in ("assisted_by", "assisted_at", "otp_id", "locked_user_id", "locked_by", "locked_at",
                 "lock_reason", "unlocked_by", "unlocked_at", "unlock_reason"):
        op.drop_column("account_support_cases", name)
    op.drop_column("users", "support_lock_case_id")
    op.drop_column("password_reset_otps", "delivery_status")
    op.drop_column("password_reset_otps", "issue_source")


def downgrade():
    raise RuntimeError("Restore a verified pre-upgrade backup to recover removed support data.")
