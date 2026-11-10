"""Baseline đầy đủ phản chiếu từ SQL Server đang vận hành.

Revision ID: cfdb_20260924_baseline
Revises: da10f25d5743
Ngày tạo UTC: 2026-09-24T02:20:16.931142+00:00

Revision này chỉ chứa schema của 17 bảng nghiệp vụ, không chứa dữ liệu người dùng.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mssql


revision: str = "cfdb_20260924_baseline"
down_revision: Union[str, Sequence[str], None] = "da10f25d5743"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Dựng schema CapitalFlow đầy đủ trên database trống."""

    # ### Các lệnh schema được Alembic sinh từ database thật và đã kiểm chứng. ###
    op.create_table('background_jobs',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('kind', sa.VARCHAR(length=30, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('payload', sa.NVARCHAR(collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('dedupe_key', sa.VARCHAR(length=200, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('status', sa.VARCHAR(length=20, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('attempts', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('available_at', sa.DATETIME(), autoincrement=False, nullable=False),
    sa.Column('lease_until', sa.DATETIME(), autoincrement=False, nullable=True),
    sa.Column('lease_token', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('error_code', sa.VARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('created_at', sa.DATETIME(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('owner_user_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('id', name='PK__backgrou__3213E83FF73BBED4')
    )
    op.create_index('IX_background_jobs_kind_poll', 'background_jobs', ['kind', 'status', 'available_at', 'lease_until'], unique=False, mssql_clustered=False, mssql_include=[])
    op.create_index('IX_background_jobs_owner', 'background_jobs', ['owner_user_id', 'status'], unique=False, mssql_clustered=False, mssql_include=[])
    op.create_index('IX_background_jobs_poll', 'background_jobs', ['status', 'available_at', 'lease_until'], unique=False, mssql_clustered=False, mssql_include=[])
    op.create_index('UQ__backgrou__BBDAFDB8E81CFAA4', 'background_jobs', ['dedupe_key'], unique=True, mssql_clustered=False, mssql_include=[])
    op.create_table('user_deletion_requests',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('target_user_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('requested_by', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('mode', sa.VARCHAR(length=10, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('status', sa.VARCHAR(length=30, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('purge_checkpoint', sa.VARCHAR(length=30, collation='SQL_Latin1_General_CP1_CI_AS'), server_default=sa.text("('REQUESTED')"), autoincrement=False, nullable=False),
    sa.Column('reason', sa.NVARCHAR(length=500, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('target_email_hash', sa.VARCHAR(length=64, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('target_email_sealed', sa.NVARCHAR(collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('file_total', sa.INTEGER(), server_default=sa.text('((0))'), autoincrement=False, nullable=False),
    sa.Column('files_deleted', sa.INTEGER(), server_default=sa.text('((0))'), autoincrement=False, nullable=False),
    sa.Column('error_code', sa.VARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('created_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('updated_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('completed_at', mssql.DATETIME2(), autoincrement=False, nullable=True),
    sa.CheckConstraint("([mode]='hard' OR [mode]='soft')", name='CK_user_deletion_requests_mode'),
    sa.CheckConstraint("([status]='FAILED' OR [status]='COMPLETE' OR [status]='FILES_PENDING' OR [status]='RUNNING' OR [status]='PENDING' OR [status]='RESTORED' OR [status]='SOFT_DELETED')", name='CK_user_deletion_requests_status'),
    sa.PrimaryKeyConstraint('id', name='PK_user_deletion_requests')
    )
    op.create_index('IX_user_deletion_requests_status', 'user_deletion_requests', ['status', 'created_at'], unique=False, mssql_clustered=False, mssql_include=[])
    op.create_index('IX_user_deletion_requests_target', 'user_deletion_requests', ['target_user_id', 'created_at'], unique=False, mssql_clustered=False, mssql_include=[])
    op.create_table('users',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), server_default=sa.text('(newsequentialid())'), autoincrement=False, nullable=False),
    sa.Column('email', sa.NVARCHAR(length=255, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('full_name', sa.NVARCHAR(length=150, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('password_hash', sa.NVARCHAR(length=500, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('role', sa.VARCHAR(length=20, collation='SQL_Latin1_General_CP1_CI_AS'), server_default=sa.text("('USER')"), autoincrement=False, nullable=False),
    sa.Column('is_active', mssql.BIT(), server_default=sa.text('((1))'), autoincrement=False, nullable=False),
    sa.Column('last_login_at', mssql.DATETIME2(), autoincrement=False, nullable=True),
    sa.Column('created_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('updated_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('last_active_at', mssql.DATETIME2(), autoincrement=False, nullable=True),
    sa.Column('must_change_password', mssql.BIT(), server_default=sa.text('((0))'), autoincrement=False, nullable=False),
    sa.Column('token_version', sa.INTEGER(), server_default=sa.text('((0))'), autoincrement=False, nullable=False),
    sa.Column('is_deleted', mssql.BIT(), server_default=sa.text('((0))'), autoincrement=False, nullable=False),
    sa.Column('deletion_status', sa.VARCHAR(length=20, collation='SQL_Latin1_General_CP1_CI_AS'), server_default=sa.text("('ACTIVE')"), autoincrement=False, nullable=False),
    sa.Column('deleted_at', mssql.DATETIME2(), autoincrement=False, nullable=True),
    sa.Column('deleted_by', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('email_before_delete_sealed', sa.NVARCHAR(collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('pre_delete_is_active', mssql.BIT(), autoincrement=False, nullable=True),
    sa.Column('is_system_account', mssql.BIT(), server_default=sa.text('((0))'), autoincrement=False, nullable=False),
    sa.CheckConstraint("([deletion_status]='PURGE_PENDING' OR [deletion_status]='SOFT_DELETED' OR [deletion_status]='ACTIVE')", name='CK_users_deletion_status'),
    sa.CheckConstraint("([role]='ADMIN' OR [role]='USER')", name='CK_users_role'),
    sa.PrimaryKeyConstraint('id', name='PK_users')
    )
    op.create_index('IX_users_deletion_status', 'users', ['is_deleted', 'deletion_status', 'created_at'], unique=False, mssql_clustered=False, mssql_include=[])
    op.create_index('IX_users_role_active', 'users', ['role', 'is_active'], unique=False, mssql_clustered=False, mssql_include=['email', 'full_name', 'last_login_at', 'created_at'])
    op.create_index('UX_users_email', 'users', ['email'], unique=True, mssql_clustered=False, mssql_include=[])
    op.create_table('accounts',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), server_default=sa.text('(newsequentialid())'), autoincrement=False, nullable=False),
    sa.Column('user_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('name', sa.NVARCHAR(length=150, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('account_type', sa.VARCHAR(length=30, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('institution_name', sa.NVARCHAR(length=150, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('balance', sa.DECIMAL(precision=19, scale=2), server_default=sa.text('((0))'), autoincrement=False, nullable=False),
    sa.Column('currency', sa.CHAR(length=3, collation='SQL_Latin1_General_CP1_CI_AS'), server_default=sa.text("('VND')"), autoincrement=False, nullable=False),
    sa.Column('color', sa.VARCHAR(length=20, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('is_active', mssql.BIT(), server_default=sa.text('((1))'), autoincrement=False, nullable=False),
    sa.Column('created_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('updated_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.CheckConstraint("([account_type]='OTHER' OR [account_type]='INVESTMENT' OR [account_type]='SAVINGS' OR [account_type]='CREDIT_CARD' OR [account_type]='E_WALLET' OR [account_type]='CRYPTO' OR [account_type]='CASH' OR [account_type]='BANK')", name='CK_accounts_type'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='FK_accounts_user'),
    sa.PrimaryKeyConstraint('id', name='PK_accounts')
    )
    op.create_index('IX_accounts_user', 'accounts', ['user_id', 'is_active'], unique=False, mssql_clustered=False, mssql_include=['name', 'account_type', 'institution_name', 'balance', 'currency', 'color'])
    op.create_index('IX_accounts_user_type', 'accounts', ['user_id', 'account_type', 'is_active'], unique=False, mssql_clustered=False, mssql_include=[])
    op.create_table('audit_logs',
    sa.Column('id', sa.BIGINT(), sa.Identity(always=False, start=1, increment=1), autoincrement=True, nullable=False),
    sa.Column('user_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('action', sa.NVARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('entity_type', sa.NVARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('entity_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('request_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('route', sa.NVARCHAR(length=500, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('http_method', sa.VARCHAR(length=10, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('status_code', sa.SMALLINT(), autoincrement=False, nullable=True),
    sa.Column('ip_address', sa.VARCHAR(length=45, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('user_agent', sa.NVARCHAR(length=1000, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('old_values_json', sa.NVARCHAR(collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('new_values_json', sa.NVARCHAR(collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('metadata_json', sa.NVARCHAR(collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('created_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.CheckConstraint('([metadata_json] IS NULL OR isjson([metadata_json])=(1))', name='CK_audit_logs_metadata_json'),
    sa.CheckConstraint('([new_values_json] IS NULL OR isjson([new_values_json])=(1))', name='CK_audit_logs_new_json'),
    sa.CheckConstraint('([old_values_json] IS NULL OR isjson([old_values_json])=(1))', name='CK_audit_logs_old_json'),
    sa.CheckConstraint('([status_code] IS NULL OR [status_code]>=(100) AND [status_code]<=(599))', name='CK_audit_logs_status_code'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='FK_audit_logs_user', ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name='PK_audit_logs')
    )
    op.create_index('IX_audit_logs_created_at', 'audit_logs', ['created_at'], unique=False, mssql_clustered=False, mssql_include=['user_id', 'action', 'entity_type', 'entity_id', 'status_code'])
    op.create_index('IX_audit_logs_entity', 'audit_logs', ['entity_type', 'entity_id', 'created_at'], unique=False, mssql_clustered=False, mssql_include=['user_id', 'action', 'request_id'])
    op.create_index('IX_audit_logs_request', 'audit_logs', ['request_id'], unique=False, mssql_clustered=False, mssql_where='([request_id] IS NOT NULL)', mssql_include=[])
    op.create_index('IX_audit_logs_user', 'audit_logs', ['user_id', 'created_at'], unique=False, mssql_clustered=False, mssql_where='([user_id] IS NOT NULL)', mssql_include=['action', 'entity_type', 'entity_id', 'request_id', 'status_code'])
    op.create_table('categories',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), server_default=sa.text('(newsequentialid())'), autoincrement=False, nullable=False),
    sa.Column('owner_user_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('name', sa.NVARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('type', sa.VARCHAR(length=20, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('icon', sa.NVARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('color', sa.VARCHAR(length=20, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('sort_order', sa.INTEGER(), server_default=sa.text('((0))'), autoincrement=False, nullable=False),
    sa.Column('is_active', mssql.BIT(), server_default=sa.text('((1))'), autoincrement=False, nullable=False),
    sa.Column('created_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('updated_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('keywords', sa.NVARCHAR(length=1000, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.CheckConstraint("([type]='EXPENSE' OR [type]='INCOME')", name='CK_categories_type'),
    sa.ForeignKeyConstraint(['owner_user_id'], ['users.id'], name='FK_categories_owner_user'),
    sa.PrimaryKeyConstraint('id', name='PK_categories')
    )
    op.create_index('IX_categories_owner_user', 'categories', ['owner_user_id', 'is_active', 'type', 'sort_order'], unique=False, mssql_clustered=False, mssql_include=['name', 'icon', 'color'])
    op.create_index('UX_categories_global_name_type', 'categories', ['name', 'type'], unique=True, mssql_clustered=False, mssql_where='([owner_user_id] IS NULL)', mssql_include=[])
    op.create_index('UX_categories_user_name_type', 'categories', ['owner_user_id', 'name', 'type'], unique=True, mssql_clustered=False, mssql_where='([owner_user_id] IS NOT NULL)', mssql_include=[])
    op.create_table('email_logs',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('recipient', sa.VARCHAR(length=255, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('subject', sa.NVARCHAR(length=255, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('email_type', sa.VARCHAR(length=50, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('status', sa.VARCHAR(length=20, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('error_message', sa.NVARCHAR(collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('created_at', sa.DATETIME(), autoincrement=False, nullable=False),
    sa.Column('user_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='FK_email_logs_users', ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name='PK__email_lo__3213E83F1BD2CE30')
    )
    op.create_index('ix_email_logs_email_type', 'email_logs', ['email_type'], unique=False, mssql_clustered=False, mssql_include=[])
    op.create_index('ix_email_logs_recipient', 'email_logs', ['recipient'], unique=False, mssql_clustered=False, mssql_include=[])
    op.create_index('ix_email_logs_status', 'email_logs', ['status'], unique=False, mssql_clustered=False, mssql_include=[])
    op.create_table('idempotency_records',
    sa.Column('user_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('request_key', sa.VARCHAR(length=128, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('payload_hash', sa.VARCHAR(length=64, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('response_json', sa.NVARCHAR(collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('created_at', sa.DATETIME(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='FK__idempoten__user___7BE56230'),
    sa.PrimaryKeyConstraint('user_id', 'request_key', name='PK__idempote__A3FC08DD98F60E48')
    )
    op.create_table('password_reset_otps',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('email', sa.VARCHAR(length=255, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('otp_code', sa.VARCHAR(length=64, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('expires_at', sa.DATETIME(), autoincrement=False, nullable=False),
    sa.Column('is_used', mssql.BIT(), autoincrement=False, nullable=False),
    sa.Column('created_at', sa.DATETIME(), autoincrement=False, nullable=False),
    sa.Column('user_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('failed_attempts', sa.INTEGER(), server_default=sa.text('((0))'), autoincrement=False, nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='FK_password_reset_otps_users', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='PK__password__3213E83FE61C158B')
    )
    op.create_index('ix_password_reset_otps_email', 'password_reset_otps', ['email'], unique=False, mssql_clustered=False, mssql_include=[])
    op.create_table('refresh_tokens',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), server_default=sa.text('(newsequentialid())'), autoincrement=False, nullable=False),
    sa.Column('user_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('token_hash', sa.VARCHAR(length=255, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('family_id', mssql.UNIQUEIDENTIFIER(), server_default=sa.text('(newid())'), autoincrement=False, nullable=False),
    sa.Column('parent_token_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('expires_at', mssql.DATETIME2(), autoincrement=False, nullable=False),
    sa.Column('revoked_at', mssql.DATETIME2(), autoincrement=False, nullable=True),
    sa.Column('revocation_reason', sa.NVARCHAR(length=255, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('device_name', sa.NVARCHAR(length=150, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('ip_address', sa.VARCHAR(length=45, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('user_agent', sa.NVARCHAR(length=1000, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('last_used_at', mssql.DATETIME2(), autoincrement=False, nullable=True),
    sa.Column('created_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.CheckConstraint('([expires_at]>[created_at])', name='CK_refresh_tokens_expiry'),
    sa.ForeignKeyConstraint(['parent_token_id'], ['refresh_tokens.id'], name='FK_refresh_tokens_parent'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='FK_refresh_tokens_user', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='PK_refresh_tokens')
    )
    op.create_index('IX_refresh_tokens_active', 'refresh_tokens', ['user_id', 'expires_at'], unique=False, mssql_clustered=False, mssql_where='([revoked_at] IS NULL)', mssql_include=[])
    op.create_index('IX_refresh_tokens_family', 'refresh_tokens', ['family_id', 'created_at'], unique=False, mssql_clustered=False, mssql_include=['user_id', 'expires_at', 'revoked_at'])
    op.create_index('IX_refresh_tokens_user_expiry', 'refresh_tokens', ['user_id', 'expires_at'], unique=False, mssql_clustered=False, mssql_include=['revoked_at', 'family_id', 'device_name', 'last_used_at'])
    op.create_index('UQ_refresh_tokens_hash', 'refresh_tokens', ['token_hash'], unique=True, mssql_clustered=False, mssql_include=[])
    op.create_table('system_settings',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), server_default=sa.text('(newid())'), autoincrement=False, nullable=False),
    sa.Column('key', sa.NVARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('value', sa.NVARCHAR(collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('description', sa.NVARCHAR(length=500, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('updated_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('updated_by', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name='FK__system_se__updat__318258D2'),
    sa.PrimaryKeyConstraint('id', name='PK__system_s__3213E83F1DC6919C')
    )
    op.create_index('IX_system_settings_key', 'system_settings', ['key'], unique=True, mssql_clustered=False, mssql_include=[])
    op.create_index('UQ__system_s__DFD83CAF4F2F15F7', 'system_settings', ['key'], unique=True, mssql_clustered=False, mssql_include=[])
    op.create_table('user_deletion_files',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('request_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('storage_key', sa.NVARCHAR(length=1000, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('status', sa.VARCHAR(length=20, collation='SQL_Latin1_General_CP1_CI_AS'), server_default=sa.text("('PENDING')"), autoincrement=False, nullable=False),
    sa.Column('attempts', sa.INTEGER(), server_default=sa.text('((0))'), autoincrement=False, nullable=False),
    sa.Column('error_code', sa.VARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('created_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('deleted_at', mssql.DATETIME2(), autoincrement=False, nullable=True),
    sa.CheckConstraint("([status]='FAILED' OR [status]='SKIPPED_REFERENCE' OR [status]='DONE' OR [status]='PENDING')", name='CK_user_deletion_files_status'),
    sa.ForeignKeyConstraint(['request_id'], ['user_deletion_requests.id'], name='FK_user_deletion_files_request', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='PK_user_deletion_files')
    )
    op.create_index('IX_user_deletion_files_status', 'user_deletion_files', ['request_id', 'status'], unique=False, mssql_clustered=False, mssql_include=[])
    op.create_index('UX_user_deletion_files_request_key', 'user_deletion_files', ['request_id', 'storage_key'], unique=True, mssql_clustered=False, mssql_include=[])
    op.create_table('budgets',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), server_default=sa.text('(newsequentialid())'), autoincrement=False, nullable=False),
    sa.Column('user_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('category_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('name', sa.NVARCHAR(length=150, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('amount_limit', sa.DECIMAL(precision=19, scale=2), autoincrement=False, nullable=False),
    sa.Column('currency', sa.CHAR(length=3, collation='SQL_Latin1_General_CP1_CI_AS'), server_default=sa.text("('VND')"), autoincrement=False, nullable=False),
    sa.Column('period_type', sa.VARCHAR(length=20, collation='SQL_Latin1_General_CP1_CI_AS'), server_default=sa.text("('MONTHLY')"), autoincrement=False, nullable=False),
    sa.Column('start_date', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('end_date', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('warning_percent', sa.DECIMAL(precision=5, scale=2), server_default=sa.text('((80.00))'), autoincrement=False, nullable=False),
    sa.Column('is_active', mssql.BIT(), server_default=sa.text('((1))'), autoincrement=False, nullable=False),
    sa.Column('created_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('updated_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.CheckConstraint("([currency]='VND')", name='CK_budgets_currency_vnd'),
    sa.CheckConstraint("([period_type]='CUSTOM' OR [period_type]='YEARLY' OR [period_type]='MONTHLY' OR [period_type]='WEEKLY')", name='CK_budgets_period_type'),
    sa.CheckConstraint('([amount_limit]>(0))', name='CK_budgets_amount_limit'),
    sa.CheckConstraint('([end_date]>=[start_date])', name='CK_budgets_dates'),
    sa.CheckConstraint('([warning_percent]>(0) AND [warning_percent]<=(100))', name='CK_budgets_warning_percent'),
    sa.ForeignKeyConstraint(['category_id'], ['categories.id'], name='FK_budgets_category'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='FK_budgets_user'),
    sa.PrimaryKeyConstraint('id', name='PK_budgets')
    )
    op.create_index('IX_budgets_user', 'budgets', ['user_id', 'is_active', 'start_date', 'end_date'], unique=False, mssql_clustered=False, mssql_include=['category_id', 'name', 'amount_limit', 'currency', 'period_type', 'warning_percent'])
    op.create_index('IX_budgets_user_category_period', 'budgets', ['user_id', 'category_id', 'start_date', 'end_date'], unique=False, mssql_clustered=False, mssql_include=['amount_limit', 'warning_percent', 'is_active'])
    op.create_index('UX_budgets_user_category_period', 'budgets', ['user_id', 'category_id', 'start_date', 'end_date'], unique=True, mssql_clustered=False, mssql_where='([category_id] IS NOT NULL)', mssql_include=[])
    op.create_index('UX_budgets_user_overall_period', 'budgets', ['user_id', 'start_date', 'end_date'], unique=True, mssql_clustered=False, mssql_where='([category_id] IS NULL)', mssql_include=[])
    op.create_table('invoices',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), server_default=sa.text('(newsequentialid())'), autoincrement=False, nullable=False),
    sa.Column('user_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('account_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('category_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('source', sa.VARCHAR(length=20, collation='SQL_Latin1_General_CP1_CI_AS'), server_default=sa.text("('UPLOAD')"), autoincrement=False, nullable=False),
    sa.Column('status', sa.VARCHAR(length=30, collation='SQL_Latin1_General_CP1_CI_AS'), server_default=sa.text("('UPLOADED')"), autoincrement=False, nullable=False),
    sa.Column('merchant_name', sa.NVARCHAR(length=255, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('merchant_address', sa.NVARCHAR(length=500, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('merchant_tax_code', sa.NVARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('invoice_number', sa.NVARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('invoice_date', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('subtotal_amount', sa.DECIMAL(precision=19, scale=2), autoincrement=False, nullable=True),
    sa.Column('tax_amount', sa.DECIMAL(precision=19, scale=2), autoincrement=False, nullable=True),
    sa.Column('total_amount', sa.DECIMAL(precision=19, scale=2), autoincrement=False, nullable=True),
    sa.Column('currency', sa.CHAR(length=3, collation='SQL_Latin1_General_CP1_CI_AS'), server_default=sa.text("('VND')"), autoincrement=False, nullable=False),
    sa.Column('original_filename', sa.NVARCHAR(length=255, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('storage_key', sa.NVARCHAR(length=1000, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('mime_type', sa.NVARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('file_size_bytes', sa.BIGINT(), autoincrement=False, nullable=True),
    sa.Column('ocr_confidence', sa.DECIMAL(precision=5, scale=4), autoincrement=False, nullable=True),
    sa.Column('extracted_json', sa.NVARCHAR(collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('note', sa.NVARCHAR(length=1000, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('created_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('updated_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('confirmed_at', mssql.DATETIME2(), autoincrement=False, nullable=True),
    sa.Column('invoice_symbol', sa.NVARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('vat_rate', sa.NVARCHAR(length=50, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('payment_method', sa.NVARCHAR(length=50, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.CheckConstraint("([source]='IMPORT' OR [source]='MANUAL' OR [source]='CAMERA' OR [source]='UPLOAD')", name='CK_invoices_source'),
    sa.CheckConstraint("([status]='ARCHIVED' OR [status]='FAILED' OR [status]='CONFIRMED' OR [status]='REVIEW_REQUIRED' OR [status]='PROCESSING' OR [status]='UPLOADED')", name='CK_invoices_status'),
    sa.CheckConstraint('([extracted_json] IS NULL OR isjson([extracted_json])=(1))', name='CK_invoices_extracted_json'),
    sa.CheckConstraint('([file_size_bytes] IS NULL OR [file_size_bytes]>=(0))', name='CK_invoices_file_size'),
    sa.CheckConstraint('([ocr_confidence] IS NULL OR [ocr_confidence]>=(0) AND [ocr_confidence]<=(1))', name='CK_invoices_confidence'),
    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], name='FK_invoices_account'),
    sa.ForeignKeyConstraint(['category_id'], ['categories.id'], name='FK_invoices_category'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='FK_invoices_user'),
    sa.PrimaryKeyConstraint('id', name='PK_invoices')
    )
    op.create_index('IX_invoices_account', 'invoices', ['account_id', 'invoice_date'], unique=False, mssql_clustered=False, mssql_where='([account_id] IS NOT NULL)', mssql_include=[])
    op.create_index('IX_invoices_category', 'invoices', ['category_id', 'invoice_date'], unique=False, mssql_clustered=False, mssql_where='([category_id] IS NOT NULL)', mssql_include=[])
    op.create_index('IX_invoices_user', 'invoices', ['user_id', 'created_at'], unique=False, mssql_clustered=False, mssql_include=['status', 'merchant_name', 'invoice_date', 'total_amount', 'currency'])
    op.create_index('IX_invoices_user_status_date', 'invoices', ['user_id', 'status', 'invoice_date', 'created_at'], unique=False, mssql_clustered=False, mssql_include=['merchant_name', 'invoice_number', 'total_amount', 'currency', 'ocr_confidence'])
    op.create_table('invoice_items',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), server_default=sa.text('(newsequentialid())'), autoincrement=False, nullable=False),
    sa.Column('invoice_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('line_no', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('name', sa.NVARCHAR(length=500, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('sku', sa.NVARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('unit', sa.NVARCHAR(length=50, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('quantity', sa.DECIMAL(precision=18, scale=4), autoincrement=False, nullable=True),
    sa.Column('unit_price', sa.DECIMAL(precision=19, scale=2), autoincrement=False, nullable=True),
    sa.Column('discount_amount', sa.DECIMAL(precision=19, scale=2), autoincrement=False, nullable=True),
    sa.Column('tax_amount', sa.DECIMAL(precision=19, scale=2), autoincrement=False, nullable=True),
    sa.Column('line_total', sa.DECIMAL(precision=19, scale=2), autoincrement=False, nullable=True),
    sa.Column('confidence', sa.DECIMAL(precision=5, scale=4), autoincrement=False, nullable=True),
    sa.Column('raw_text', sa.NVARCHAR(length=1000, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('created_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('updated_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.CheckConstraint('([confidence] IS NULL OR [confidence]>=(0) AND [confidence]<=(1))', name='CK_invoice_items_confidence'),
    sa.CheckConstraint('([line_no]>(0))', name='CK_invoice_items_line_no'),
    sa.CheckConstraint('([quantity] IS NULL OR [quantity]>=(0))', name='CK_invoice_items_quantity'),
    sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], name='FK_invoice_items_invoice', ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name='PK_invoice_items')
    )
    op.create_index('IX_invoice_items_invoice', 'invoice_items', ['invoice_id', 'line_no'], unique=False, mssql_clustered=False, mssql_include=['name', 'quantity', 'unit_price', 'tax_amount', 'line_total', 'confidence'])
    op.create_index('UQ_invoice_items_invoice_line', 'invoice_items', ['invoice_id', 'line_no'], unique=True, mssql_clustered=False, mssql_include=[])
    op.create_table('ocr_jobs',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), server_default=sa.text('(newsequentialid())'), autoincrement=False, nullable=False),
    sa.Column('user_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('invoice_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('status', sa.VARCHAR(length=30, collation='SQL_Latin1_General_CP1_CI_AS'), server_default=sa.text("('QUEUED')"), autoincrement=False, nullable=False),
    sa.Column('provider', sa.NVARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('model_name', sa.NVARCHAR(length=150, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('attempt_count', sa.INTEGER(), server_default=sa.text('((0))'), autoincrement=False, nullable=False),
    sa.Column('progress_percent', mssql.TINYINT(), server_default=sa.text('((0))'), autoincrement=False, nullable=False),
    sa.Column('error_code', sa.NVARCHAR(length=100, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('error_message', sa.NVARCHAR(length=2000, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('response_json', sa.NVARCHAR(collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('started_at', mssql.DATETIME2(), autoincrement=False, nullable=True),
    sa.Column('completed_at', mssql.DATETIME2(), autoincrement=False, nullable=True),
    sa.Column('processing_ms', sa.INTEGER(), autoincrement=False, nullable=True),
    sa.Column('created_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('updated_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.CheckConstraint("([status]='CANCELLED' OR [status]='FAILED' OR [status]='COMPLETED' OR [status]='PROCESSING' OR [status]='QUEUED')", name='CK_ocr_jobs_status'),
    sa.CheckConstraint('([attempt_count]>=(0))', name='CK_ocr_jobs_attempt_count'),
    sa.CheckConstraint('([processing_ms] IS NULL OR [processing_ms]>=(0))', name='CK_ocr_jobs_processing_ms'),
    sa.CheckConstraint('([progress_percent]>=(0) AND [progress_percent]<=(100))', name='CK_ocr_jobs_progress'),
    sa.CheckConstraint('([response_json] IS NULL OR isjson([response_json])=(1))', name='CK_ocr_jobs_response_json'),
    sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], name='FK_ocr_jobs_invoice'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='FK_ocr_jobs_user'),
    sa.PrimaryKeyConstraint('id', name='PK_ocr_jobs')
    )
    op.create_index('IX_ocr_jobs_invoice', 'ocr_jobs', ['invoice_id', 'created_at'], unique=False, mssql_clustered=False, mssql_where='([invoice_id] IS NOT NULL)', mssql_include=[])
    op.create_index('IX_ocr_jobs_status_created', 'ocr_jobs', ['status', 'created_at'], unique=False, mssql_clustered=False, mssql_include=['user_id', 'invoice_id', 'provider', 'attempt_count', 'progress_percent'])
    op.create_index('IX_ocr_jobs_user_created', 'ocr_jobs', ['user_id', 'created_at'], unique=False, mssql_clustered=False, mssql_include=['status', 'invoice_id', 'provider', 'model_name', 'progress_percent', 'error_code'])
    op.create_table('transactions',
    sa.Column('id', mssql.UNIQUEIDENTIFIER(), server_default=sa.text('(newsequentialid())'), autoincrement=False, nullable=False),
    sa.Column('user_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('account_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=False),
    sa.Column('category_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('invoice_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('description', sa.NVARCHAR(length=255, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('amount', sa.DECIMAL(precision=19, scale=2), autoincrement=False, nullable=False),
    sa.Column('type', sa.VARCHAR(length=20, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=False),
    sa.Column('source', sa.VARCHAR(length=20, collation='SQL_Latin1_General_CP1_CI_AS'), server_default=sa.text("('MANUAL')"), autoincrement=False, nullable=False),
    sa.Column('transaction_date', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('note', sa.NVARCHAR(length=1000, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('created_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('updated_at', mssql.DATETIME2(), server_default=sa.text('(sysutcdatetime())'), autoincrement=False, nullable=False),
    sa.Column('kind', sa.VARCHAR(length=20, collation='SQL_Latin1_General_CP1_CI_AS'), server_default=sa.text("('NORMAL')"), autoincrement=False, nullable=False),
    sa.Column('transfer_id', mssql.UNIQUEIDENTIFIER(), autoincrement=False, nullable=True),
    sa.Column('category_confidence', sa.DECIMAL(precision=5, scale=4), autoincrement=False, nullable=True),
    sa.Column('category_source', sa.VARCHAR(length=30, collation='SQL_Latin1_General_CP1_CI_AS'), autoincrement=False, nullable=True),
    sa.Column('category_was_auto', mssql.BIT(), server_default=sa.text('((0))'), autoincrement=False, nullable=False),
    sa.CheckConstraint("([kind]='ADJUSTMENT' OR [kind]='TRANSFER' OR [kind]='NORMAL')", name='CK_transactions_kind'),
    sa.CheckConstraint("([kind]='TRANSFER' AND [transfer_id] IS NOT NULL OR [kind]<>'TRANSFER' AND [transfer_id] IS NULL)", name='CK_transactions_transfer_link'),
    sa.CheckConstraint("([source]='SYSTEM' OR [source]='IMPORT' OR [source]='OCR' OR [source]='MANUAL')", name='CK_transactions_source'),
    sa.CheckConstraint("([type]='EXPENSE' OR [type]='INCOME')", name='CK_transactions_type'),
    sa.CheckConstraint("([type]='INCOME' AND [amount]>(0) OR [type]='EXPENSE' AND [amount]<(0))", name='CK_transactions_amount_sign'),
    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], name='FK_transactions_account'),
    sa.ForeignKeyConstraint(['category_id'], ['categories.id'], name='FK_transactions_category'),
    sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], name='FK_transactions_invoice'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='FK_transactions_user'),
    sa.PrimaryKeyConstraint('id', name='PK_transactions')
    )
    op.create_index('IX_transactions_date', 'transactions', ['transaction_date'], unique=False, mssql_clustered=False, mssql_include=['user_id', 'category_id', 'amount', 'type'])
    op.create_index('IX_transactions_reporting', 'transactions', ['user_id', 'kind', 'transaction_date'], unique=False, mssql_clustered=False, mssql_include=['type', 'amount', 'category_id'])
    op.create_index('IX_transactions_user_account_date', 'transactions', ['user_id', 'account_id', 'transaction_date'], unique=False, mssql_clustered=False, mssql_include=['category_id', 'amount', 'type', 'description'])
    op.create_index('IX_transactions_user_category_date', 'transactions', ['user_id', 'category_id', 'transaction_date'], unique=False, mssql_clustered=False, mssql_where='([category_id] IS NOT NULL)', mssql_include=['account_id', 'amount', 'type', 'description'])
    op.create_index('IX_transactions_user_date', 'transactions', ['user_id', 'transaction_date', 'created_at'], unique=False, mssql_clustered=False, mssql_include=['account_id', 'category_id', 'invoice_id', 'description', 'amount', 'type', 'source'])
    op.create_index('IX_transactions_user_type_date', 'transactions', ['user_id', 'type', 'transaction_date'], unique=False, mssql_clustered=False, mssql_include=['amount', 'category_id', 'account_id'])
    op.create_index('UX_transactions_invoice', 'transactions', ['invoice_id'], unique=True, mssql_clustered=False, mssql_where='([invoice_id] IS NOT NULL)', mssql_include=[])
    op.create_index('UX_transactions_transfer_leg', 'transactions', ['transfer_id', 'type'], unique=True, mssql_clustered=False, mssql_where='([transfer_id] IS NOT NULL)', mssql_include=[])
    # ### Kết thúc phần lệnh dựng schema. ###


def downgrade() -> None:
    """Chỉ hạ baseline trên database kiểm chứng đã được phép xóa."""

    # ### Các lệnh hạ baseline chỉ dành cho database kiểm chứng được phép xóa. ###
    op.drop_index('UX_transactions_transfer_leg', table_name='transactions', mssql_clustered=False, mssql_where='([transfer_id] IS NOT NULL)', mssql_include=[])
    op.drop_index('UX_transactions_invoice', table_name='transactions', mssql_clustered=False, mssql_where='([invoice_id] IS NOT NULL)', mssql_include=[])
    op.drop_index('IX_transactions_user_type_date', table_name='transactions', mssql_clustered=False, mssql_include=['amount', 'category_id', 'account_id'])
    op.drop_index('IX_transactions_user_date', table_name='transactions', mssql_clustered=False, mssql_include=['account_id', 'category_id', 'invoice_id', 'description', 'amount', 'type', 'source'])
    op.drop_index('IX_transactions_user_category_date', table_name='transactions', mssql_clustered=False, mssql_where='([category_id] IS NOT NULL)', mssql_include=['account_id', 'amount', 'type', 'description'])
    op.drop_index('IX_transactions_user_account_date', table_name='transactions', mssql_clustered=False, mssql_include=['category_id', 'amount', 'type', 'description'])
    op.drop_index('IX_transactions_reporting', table_name='transactions', mssql_clustered=False, mssql_include=['type', 'amount', 'category_id'])
    op.drop_index('IX_transactions_date', table_name='transactions', mssql_clustered=False, mssql_include=['user_id', 'category_id', 'amount', 'type'])
    op.drop_table('transactions')
    op.drop_index('IX_ocr_jobs_user_created', table_name='ocr_jobs', mssql_clustered=False, mssql_include=['status', 'invoice_id', 'provider', 'model_name', 'progress_percent', 'error_code'])
    op.drop_index('IX_ocr_jobs_status_created', table_name='ocr_jobs', mssql_clustered=False, mssql_include=['user_id', 'invoice_id', 'provider', 'attempt_count', 'progress_percent'])
    op.drop_index('IX_ocr_jobs_invoice', table_name='ocr_jobs', mssql_clustered=False, mssql_where='([invoice_id] IS NOT NULL)', mssql_include=[])
    op.drop_table('ocr_jobs')
    op.drop_index('UQ_invoice_items_invoice_line', table_name='invoice_items', mssql_clustered=False, mssql_include=[])
    op.drop_index('IX_invoice_items_invoice', table_name='invoice_items', mssql_clustered=False, mssql_include=['name', 'quantity', 'unit_price', 'tax_amount', 'line_total', 'confidence'])
    op.drop_table('invoice_items')
    op.drop_index('IX_invoices_user_status_date', table_name='invoices', mssql_clustered=False, mssql_include=['merchant_name', 'invoice_number', 'total_amount', 'currency', 'ocr_confidence'])
    op.drop_index('IX_invoices_user', table_name='invoices', mssql_clustered=False, mssql_include=['status', 'merchant_name', 'invoice_date', 'total_amount', 'currency'])
    op.drop_index('IX_invoices_category', table_name='invoices', mssql_clustered=False, mssql_where='([category_id] IS NOT NULL)', mssql_include=[])
    op.drop_index('IX_invoices_account', table_name='invoices', mssql_clustered=False, mssql_where='([account_id] IS NOT NULL)', mssql_include=[])
    op.drop_table('invoices')
    op.drop_index('UX_budgets_user_overall_period', table_name='budgets', mssql_clustered=False, mssql_where='([category_id] IS NULL)', mssql_include=[])
    op.drop_index('UX_budgets_user_category_period', table_name='budgets', mssql_clustered=False, mssql_where='([category_id] IS NOT NULL)', mssql_include=[])
    op.drop_index('IX_budgets_user_category_period', table_name='budgets', mssql_clustered=False, mssql_include=['amount_limit', 'warning_percent', 'is_active'])
    op.drop_index('IX_budgets_user', table_name='budgets', mssql_clustered=False, mssql_include=['category_id', 'name', 'amount_limit', 'currency', 'period_type', 'warning_percent'])
    op.drop_table('budgets')
    op.drop_index('UX_user_deletion_files_request_key', table_name='user_deletion_files', mssql_clustered=False, mssql_include=[])
    op.drop_index('IX_user_deletion_files_status', table_name='user_deletion_files', mssql_clustered=False, mssql_include=[])
    op.drop_table('user_deletion_files')
    op.drop_index('UQ__system_s__DFD83CAF4F2F15F7', table_name='system_settings', mssql_clustered=False, mssql_include=[])
    op.drop_index('IX_system_settings_key', table_name='system_settings', mssql_clustered=False, mssql_include=[])
    op.drop_table('system_settings')
    op.drop_index('UQ_refresh_tokens_hash', table_name='refresh_tokens', mssql_clustered=False, mssql_include=[])
    op.drop_index('IX_refresh_tokens_user_expiry', table_name='refresh_tokens', mssql_clustered=False, mssql_include=['revoked_at', 'family_id', 'device_name', 'last_used_at'])
    op.drop_index('IX_refresh_tokens_family', table_name='refresh_tokens', mssql_clustered=False, mssql_include=['user_id', 'expires_at', 'revoked_at'])
    op.drop_index('IX_refresh_tokens_active', table_name='refresh_tokens', mssql_clustered=False, mssql_where='([revoked_at] IS NULL)', mssql_include=[])
    op.drop_table('refresh_tokens')
    op.drop_index('ix_password_reset_otps_email', table_name='password_reset_otps', mssql_clustered=False, mssql_include=[])
    op.drop_table('password_reset_otps')
    op.drop_table('idempotency_records')
    op.drop_index('ix_email_logs_status', table_name='email_logs', mssql_clustered=False, mssql_include=[])
    op.drop_index('ix_email_logs_recipient', table_name='email_logs', mssql_clustered=False, mssql_include=[])
    op.drop_index('ix_email_logs_email_type', table_name='email_logs', mssql_clustered=False, mssql_include=[])
    op.drop_table('email_logs')
    op.drop_index('UX_categories_user_name_type', table_name='categories', mssql_clustered=False, mssql_where='([owner_user_id] IS NOT NULL)', mssql_include=[])
    op.drop_index('UX_categories_global_name_type', table_name='categories', mssql_clustered=False, mssql_where='([owner_user_id] IS NULL)', mssql_include=[])
    op.drop_index('IX_categories_owner_user', table_name='categories', mssql_clustered=False, mssql_include=['name', 'icon', 'color'])
    op.drop_table('categories')
    op.drop_index('IX_audit_logs_user', table_name='audit_logs', mssql_clustered=False, mssql_where='([user_id] IS NOT NULL)', mssql_include=['action', 'entity_type', 'entity_id', 'request_id', 'status_code'])
    op.drop_index('IX_audit_logs_request', table_name='audit_logs', mssql_clustered=False, mssql_where='([request_id] IS NOT NULL)', mssql_include=[])
    op.drop_index('IX_audit_logs_entity', table_name='audit_logs', mssql_clustered=False, mssql_include=['user_id', 'action', 'request_id'])
    op.drop_index('IX_audit_logs_created_at', table_name='audit_logs', mssql_clustered=False, mssql_include=['user_id', 'action', 'entity_type', 'entity_id', 'status_code'])
    op.drop_table('audit_logs')
    op.drop_index('IX_accounts_user_type', table_name='accounts', mssql_clustered=False, mssql_include=[])
    op.drop_index('IX_accounts_user', table_name='accounts', mssql_clustered=False, mssql_include=['name', 'account_type', 'institution_name', 'balance', 'currency', 'color'])
    op.drop_table('accounts')
    op.drop_index('UX_users_email', table_name='users', mssql_clustered=False, mssql_include=[])
    op.drop_index('IX_users_role_active', table_name='users', mssql_clustered=False, mssql_include=['email', 'full_name', 'last_login_at', 'created_at'])
    op.drop_index('IX_users_deletion_status', table_name='users', mssql_clustered=False, mssql_include=[])
    op.drop_table('users')
    op.drop_index('IX_user_deletion_requests_target', table_name='user_deletion_requests', mssql_clustered=False, mssql_include=[])
    op.drop_index('IX_user_deletion_requests_status', table_name='user_deletion_requests', mssql_clustered=False, mssql_include=[])
    op.drop_table('user_deletion_requests')
    op.drop_index('UQ__backgrou__BBDAFDB8E81CFAA4', table_name='background_jobs', mssql_clustered=False, mssql_include=[])
    op.drop_index('IX_background_jobs_poll', table_name='background_jobs', mssql_clustered=False, mssql_include=[])
    op.drop_index('IX_background_jobs_owner', table_name='background_jobs', mssql_clustered=False, mssql_include=[])
    op.drop_index('IX_background_jobs_kind_poll', table_name='background_jobs', mssql_clustered=False, mssql_include=[])
    op.drop_table('background_jobs')
    # ### Kết thúc phần lệnh hạ schema. ###
