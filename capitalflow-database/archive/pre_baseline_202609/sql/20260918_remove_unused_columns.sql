/* Remove columns that have no persisted values and no remaining application use. */

DECLARE @non_null BIGINT;

IF COL_LENGTH('dbo.accounts', 'icon') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'SELECT @count = COUNT_BIG(*) FROM dbo.accounts WHERE icon IS NOT NULL', N'@count BIGINT OUTPUT', @non_null OUTPUT;
    IF @non_null <> 0 THROW 51019, N'accounts.icon still contains data.', 1;
END;

IF COL_LENGTH('dbo.invoices', 'parent_id') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'SELECT @count = COUNT_BIG(*) FROM dbo.invoices WHERE parent_id IS NOT NULL', N'@count BIGINT OUTPUT', @non_null OUTPUT;
    IF @non_null <> 0 THROW 51019, N'invoices.parent_id still contains data.', 1;
END;

IF COL_LENGTH('dbo.invoices', 'discount_amount') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'SELECT @count = COUNT_BIG(*) FROM dbo.invoices WHERE discount_amount IS NOT NULL', N'@count BIGINT OUTPUT', @non_null OUTPUT;
    IF @non_null <> 0 THROW 51019, N'invoices.discount_amount still contains data.', 1;
END;

IF COL_LENGTH('dbo.invoices', 'ocr_provider') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'SELECT @count = COUNT_BIG(*) FROM dbo.invoices WHERE ocr_provider IS NOT NULL', N'@count BIGINT OUTPUT', @non_null OUTPUT;
    IF @non_null <> 0 THROW 51019, N'invoices.ocr_provider still contains data.', 1;
END;

IF COL_LENGTH('dbo.invoices', 'ocr_model') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'SELECT @count = COUNT_BIG(*) FROM dbo.invoices WHERE ocr_model IS NOT NULL', N'@count BIGINT OUTPUT', @non_null OUTPUT;
    IF @non_null <> 0 THROW 51019, N'invoices.ocr_model still contains data.', 1;
END;

IF COL_LENGTH('dbo.invoices', 'ocr_raw_text') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'SELECT @count = COUNT_BIG(*) FROM dbo.invoices WHERE ocr_raw_text IS NOT NULL', N'@count BIGINT OUTPUT', @non_null OUTPUT;
    IF @non_null <> 0 THROW 51019, N'invoices.ocr_raw_text still contains data.', 1;
END;

IF COL_LENGTH('dbo.ocr_jobs', 'request_json') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'SELECT @count = COUNT_BIG(*) FROM dbo.ocr_jobs WHERE request_json IS NOT NULL', N'@count BIGINT OUTPUT', @non_null OUTPUT;
    IF @non_null <> 0 THROW 51019, N'ocr_jobs.request_json still contains data.', 1;
END;
GO

IF COL_LENGTH('dbo.accounts', 'icon') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.accounts') AND name='IX_accounts_user')
        DROP INDEX IX_accounts_user ON dbo.accounts;
    ALTER TABLE dbo.accounts DROP COLUMN icon;
    CREATE INDEX IX_accounts_user ON dbo.accounts(user_id, is_active)
        INCLUDE(name, account_type, institution_name, balance, currency, color);
END;
GO

IF COL_LENGTH('dbo.invoices', 'parent_id') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.invoices') AND name='IX_invoices_parent')
        DROP INDEX IX_invoices_parent ON dbo.invoices;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.invoices') AND name='IX_invoices_user')
        DROP INDEX IX_invoices_user ON dbo.invoices;
    IF OBJECT_ID('dbo.FK_invoices_parent','F') IS NOT NULL
        ALTER TABLE dbo.invoices DROP CONSTRAINT FK_invoices_parent;
    IF OBJECT_ID('dbo.CK_invoices_not_self_parent','C') IS NOT NULL
        ALTER TABLE dbo.invoices DROP CONSTRAINT CK_invoices_not_self_parent;
    ALTER TABLE dbo.invoices DROP COLUMN parent_id;
    CREATE INDEX IX_invoices_user ON dbo.invoices(user_id, created_at DESC)
        INCLUDE(status, merchant_name, invoice_date, total_amount, currency);
END;
GO

IF COL_LENGTH('dbo.ocr_jobs', 'request_json') IS NOT NULL
BEGIN
    IF OBJECT_ID('dbo.CK_ocr_jobs_request_json','C') IS NOT NULL
        ALTER TABLE dbo.ocr_jobs DROP CONSTRAINT CK_ocr_jobs_request_json;
    ALTER TABLE dbo.ocr_jobs DROP COLUMN request_json;
END;
GO

IF COL_LENGTH('dbo.invoices', 'discount_amount') IS NOT NULL ALTER TABLE dbo.invoices DROP COLUMN discount_amount;
IF COL_LENGTH('dbo.invoices', 'ocr_provider') IS NOT NULL ALTER TABLE dbo.invoices DROP COLUMN ocr_provider;
IF COL_LENGTH('dbo.invoices', 'ocr_raw_text') IS NOT NULL ALTER TABLE dbo.invoices DROP COLUMN ocr_raw_text;
GO

IF COL_LENGTH('dbo.invoices', 'ocr_model') IS NOT NULL
    ALTER TABLE dbo.invoices DROP COLUMN ocr_model;
GO
