IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.background_jobs')
      AND name = N'IX_background_jobs_kind_poll'
)
BEGIN
    CREATE INDEX IX_background_jobs_kind_poll
        ON dbo.background_jobs(kind, status, available_at, lease_until);
END;
