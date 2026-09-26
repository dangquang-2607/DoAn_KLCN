-- Extend invoice review metadata. Run through scripts/migrate_invoice_review_fields.py.
SET XACT_ABORT ON;
SET NOCOUNT ON;

IF COL_LENGTH('dbo.invoices', 'invoice_symbol') IS NULL
    ALTER TABLE dbo.invoices ADD invoice_symbol NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.invoices', 'vat_rate') IS NULL
    ALTER TABLE dbo.invoices ADD vat_rate NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.invoices', 'payment_method') IS NULL
    ALTER TABLE dbo.invoices ADD payment_method NVARCHAR(50) NULL;
GO
