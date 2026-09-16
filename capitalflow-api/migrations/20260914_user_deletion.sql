-- Durable hybrid user deletion. Run through scripts/migrate_user_deletion.py.
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF COL_LENGTH('dbo.users', 'is_deleted') IS NULL
    ALTER TABLE dbo.users ADD is_deleted BIT NOT NULL CONSTRAINT DF_users_is_deleted DEFAULT (0);
IF COL_LENGTH('dbo.users', 'deletion_status') IS NULL
    ALTER TABLE dbo.users ADD deletion_status VARCHAR(20) NOT NULL CONSTRAINT DF_users_deletion_status DEFAULT ('ACTIVE');
IF COL_LENGTH('dbo.users', 'deleted_at') IS NULL
    ALTER TABLE dbo.users ADD deleted_at DATETIME2 NULL;
IF COL_LENGTH('dbo.users', 'deleted_by') IS NULL
    ALTER TABLE dbo.users ADD deleted_by UNIQUEIDENTIFIER NULL;
IF COL_LENGTH('dbo.users', 'email_before_delete_sealed') IS NULL
    ALTER TABLE dbo.users ADD email_before_delete_sealed NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.users', 'pre_delete_is_active') IS NULL
    ALTER TABLE dbo.users ADD pre_delete_is_active BIT NULL;
IF COL_LENGTH('dbo.users', 'is_system_account') IS NULL
    ALTER TABLE dbo.users ADD is_system_account BIT NOT NULL CONSTRAINT DF_users_is_system_account DEFAULT (0);
GO

UPDATE dbo.users
SET is_system_account = 1
WHERE email IN (N'admin@capitalflow.vn', N'admin@cashflow.vn')
  AND is_system_account = 0;

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.users') AND name = 'CK_users_deletion_status'
)
    ALTER TABLE dbo.users WITH CHECK ADD CONSTRAINT CK_users_deletion_status
    CHECK (deletion_status IN ('ACTIVE', 'SOFT_DELETED', 'PURGE_PENDING'));

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.users') AND name = 'IX_users_deletion_status'
)
    CREATE INDEX IX_users_deletion_status
    ON dbo.users(is_deleted, deletion_status, created_at DESC);
GO

IF OBJECT_ID('dbo.user_deletion_requests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_deletion_requests(
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_user_deletion_requests PRIMARY KEY,
        target_user_id UNIQUEIDENTIFIER NOT NULL,
        requested_by UNIQUEIDENTIFIER NOT NULL,
        mode VARCHAR(10) NOT NULL,
        status VARCHAR(30) NOT NULL,
        purge_checkpoint VARCHAR(30) NOT NULL CONSTRAINT DF_user_deletion_requests_checkpoint DEFAULT ('REQUESTED'),
        reason NVARCHAR(500) NOT NULL,
        target_email_hash VARCHAR(64) NOT NULL,
        target_email_sealed NVARCHAR(MAX) NULL,
        file_total INT NOT NULL CONSTRAINT DF_user_deletion_requests_file_total DEFAULT (0),
        files_deleted INT NOT NULL CONSTRAINT DF_user_deletion_requests_files_deleted DEFAULT (0),
        error_code VARCHAR(100) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_user_deletion_requests_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_user_deletion_requests_updated_at DEFAULT SYSUTCDATETIME(),
        completed_at DATETIME2 NULL,
        CONSTRAINT CK_user_deletion_requests_mode CHECK (mode IN ('soft', 'hard')),
        CONSTRAINT CK_user_deletion_requests_status CHECK (status IN ('SOFT_DELETED', 'RESTORED', 'PENDING', 'RUNNING', 'FILES_PENDING', 'COMPLETE', 'FAILED'))
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.user_deletion_requests') AND name = 'IX_user_deletion_requests_target'
)
    CREATE INDEX IX_user_deletion_requests_target
    ON dbo.user_deletion_requests(target_user_id, created_at);
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.user_deletion_requests') AND name = 'IX_user_deletion_requests_status'
)
    CREATE INDEX IX_user_deletion_requests_status
    ON dbo.user_deletion_requests(status, created_at);
GO

IF OBJECT_ID('dbo.user_deletion_files', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_deletion_files(
        id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_user_deletion_files PRIMARY KEY,
        request_id UNIQUEIDENTIFIER NOT NULL,
        storage_key NVARCHAR(1000) NOT NULL,
        status VARCHAR(20) NOT NULL CONSTRAINT DF_user_deletion_files_status DEFAULT ('PENDING'),
        attempts INT NOT NULL CONSTRAINT DF_user_deletion_files_attempts DEFAULT (0),
        error_code VARCHAR(100) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_user_deletion_files_created_at DEFAULT SYSUTCDATETIME(),
        deleted_at DATETIME2 NULL,
        CONSTRAINT FK_user_deletion_files_request FOREIGN KEY(request_id)
            REFERENCES dbo.user_deletion_requests(id) ON DELETE CASCADE,
        CONSTRAINT CK_user_deletion_files_status CHECK (status IN ('PENDING', 'DONE', 'SKIPPED_REFERENCE', 'FAILED'))
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.user_deletion_files') AND name = 'UX_user_deletion_files_request_key'
)
    CREATE UNIQUE INDEX UX_user_deletion_files_request_key
    ON dbo.user_deletion_files(request_id, storage_key);
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.user_deletion_files') AND name = 'IX_user_deletion_files_status'
)
    CREATE INDEX IX_user_deletion_files_status
    ON dbo.user_deletion_files(request_id, status);
GO

IF COL_LENGTH('dbo.background_jobs', 'owner_user_id') IS NULL
    ALTER TABLE dbo.background_jobs ADD owner_user_id UNIQUEIDENTIFIER NULL;
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.background_jobs') AND name = 'IX_background_jobs_owner'
)
    CREATE INDEX IX_background_jobs_owner
    ON dbo.background_jobs(owner_user_id, status);
GO
