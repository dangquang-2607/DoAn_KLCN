"""Remove retired user-account lifecycle storage after checking legacy state."""
from alembic import op
import sqlalchemy as sa

revision = "cfdb_retire_user_deletion"
down_revision = "cfdb_support_two_cases"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("""
        IF EXISTS (
            SELECT 1 FROM dbo.users WITH (TABLOCKX, HOLDLOCK)
            WHERE is_deleted=1 OR deletion_status<>'ACTIVE'
              OR deleted_at IS NOT NULL OR deleted_by IS NOT NULL
              OR email_before_delete_sealed IS NOT NULL OR pre_delete_is_active IS NOT NULL
        ) OR EXISTS (
            SELECT 1 FROM dbo.user_deletion_requests WITH (TABLOCKX, HOLDLOCK)
            WHERE status NOT IN ('COMPLETE','RESTORED')
        ) OR EXISTS (
            SELECT 1 FROM dbo.background_jobs WITH (TABLOCKX, HOLDLOCK)
            WHERE kind IN ('USER_PURGE','USER_FILE_PURGE') AND status IN ('PENDING','RUNNING')
        )
        BEGIN
            THROW 51003, 'Resolve active user deletion state before retiring this workflow.', 1;
        END
    """))
    op.execute(sa.text("DELETE FROM dbo.background_jobs WHERE kind IN ('USER_PURGE','USER_FILE_PURGE')"))
    op.execute(sa.text("DELETE FROM dbo.email_logs WHERE email_type IN ('ACCOUNT_DELETED','ACCOUNT_RESTORED')"))
    op.execute(sa.text("""
        IF OBJECT_ID('dbo.schema_migrations','U') IS NOT NULL
          EXEC(N'DELETE FROM dbo.schema_migrations WHERE version=''20260914_user_deletion''');
    """))
    op.execute(sa.text("""
        DELETE FROM dbo.audit_logs WHERE entity_type='user_deletion' OR action IN (
            'DELETE_USER','SOFT_DELETE_USER','HARD_DELETE_USER_REQUESTED','HARD_DELETE_USER_COMPLETE',
            'RESTORE_USER','RETRY_USER_PURGE','RETRY_USER_FILE_PURGE',
            'USER_RESTORE','USER_SOFT_DELETE','USER_HARD_DELETE'
        )
    """))
    op.drop_table('user_deletion_files')
    op.drop_table('user_deletion_requests')
    op.drop_index('IX_users_deletion_status', table_name='users')
    op.drop_constraint('CK_users_deletion_status', 'users', type_='check')
    # SQL Server binds defaults to columns; remove only defaults on the six retired fields.
    op.execute(sa.text("""
        DECLARE @drop_defaults nvarchar(max) = N'';
        SELECT @drop_defaults += N'ALTER TABLE dbo.users DROP CONSTRAINT ' + QUOTENAME(d.name) + N';'
        FROM sys.default_constraints d JOIN sys.columns c
          ON c.object_id=d.parent_object_id AND c.column_id=d.parent_column_id
        WHERE d.parent_object_id=OBJECT_ID('dbo.users')
          AND c.name IN ('is_deleted','deletion_status','deleted_at','deleted_by','email_before_delete_sealed','pre_delete_is_active');
        IF @drop_defaults<>N'' EXEC sp_executesql @drop_defaults;
    """))
    for column in ('is_deleted','deletion_status','deleted_at','deleted_by','email_before_delete_sealed','pre_delete_is_active'):
        op.drop_column('users', column)


def downgrade():
    raise RuntimeError('Restore a verified pre-upgrade backup to recover retired account lifecycle data.')
