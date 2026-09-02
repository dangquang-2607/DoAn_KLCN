-- =====================================================================
-- CAPITALFLOW DATABASE V3 - COMPLETE SCHEMA
-- SQL Server / FastAPI / SQLAlchemy 2.0 / Alembic
--
-- Source-aligned modules:
--   users, accounts, categories, transactions, budgets, invoices, audit_logs
--
-- Production-support extensions:
--   invoice_items, ocr_jobs, refresh_tokens
--
-- Reporting:
--   vw_monthly_cashflow
--   vw_monthly_category_spending
--   vw_budget_progress
--
-- IMPORTANT:
--   Clean-install schema. Back up an existing DB before using DROP logic.
--   Prefer Alembic migrations for production upgrades.
-- =====================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

-- USE [CapitalFlow];
-- GO

-- =====================================================================
-- 0. DROP VIEWS
-- =====================================================================

IF OBJECT_ID(N'dbo.vw_budget_progress', N'V') IS NOT NULL
    DROP VIEW dbo.vw_budget_progress;
GO

IF OBJECT_ID(N'dbo.vw_monthly_category_spending', N'V') IS NOT NULL
    DROP VIEW dbo.vw_monthly_category_spending;
GO

IF OBJECT_ID(N'dbo.vw_monthly_cashflow', N'V') IS NOT NULL
    DROP VIEW dbo.vw_monthly_cashflow;
GO


-- =====================================================================
-- 1. DROP TABLES: CHILD -> PARENT
-- =====================================================================

IF OBJECT_ID(N'dbo.audit_logs', N'U') IS NOT NULL
    DROP TABLE dbo.audit_logs;
GO

IF OBJECT_ID(N'dbo.refresh_tokens', N'U') IS NOT NULL
    DROP TABLE dbo.refresh_tokens;
GO

IF OBJECT_ID(N'dbo.budgets', N'U') IS NOT NULL
    DROP TABLE dbo.budgets;
GO

IF OBJECT_ID(N'dbo.transactions', N'U') IS NOT NULL
    DROP TABLE dbo.transactions;
GO

IF OBJECT_ID(N'dbo.ocr_jobs', N'U') IS NOT NULL
    DROP TABLE dbo.ocr_jobs;
GO

IF OBJECT_ID(N'dbo.invoice_items', N'U') IS NOT NULL
    DROP TABLE dbo.invoice_items;
GO

IF OBJECT_ID(N'dbo.invoices', N'U') IS NOT NULL
    DROP TABLE dbo.invoices;
GO

IF OBJECT_ID(N'dbo.accounts', N'U') IS NOT NULL
    DROP TABLE dbo.accounts;
GO

IF OBJECT_ID(N'dbo.categories', N'U') IS NOT NULL
    DROP TABLE dbo.categories;
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NOT NULL
    DROP TABLE dbo.users;
GO


-- =====================================================================
-- 2. USERS
-- Feature mapping:
--   Register/Login, JWT auth, Admin/User authorization.
-- =====================================================================

CREATE TABLE dbo.users
(
    id                  UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT DF_users_id DEFAULT NEWSEQUENTIALID(),

    email               NVARCHAR(255) NOT NULL,
    full_name           NVARCHAR(150) NOT NULL,
    password_hash       NVARCHAR(500) NOT NULL,

    role                VARCHAR(20) NOT NULL
        CONSTRAINT DF_users_role DEFAULT ('USER'),

    is_active           BIT NOT NULL
        CONSTRAINT DF_users_is_active DEFAULT (1),

    last_login_at       DATETIME2(0) NULL,

    created_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_users_created_at DEFAULT SYSUTCDATETIME(),

    updated_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_users_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_users PRIMARY KEY (id),

    CONSTRAINT CK_users_role
        CHECK (role IN ('USER', 'ADMIN'))
);
GO

-- SQL Server default collations are commonly case-insensitive, which makes
-- this unique index suitable for login email uniqueness.
CREATE UNIQUE INDEX UX_users_email
    ON dbo.users(email);
GO

CREATE INDEX IX_users_role_active
    ON dbo.users(role, is_active)
    INCLUDE (email, full_name, last_login_at, created_at);
GO


-- =====================================================================
-- 3. CATEGORIES
-- owner_user_id IS NULL => system/global category.
-- =====================================================================

CREATE TABLE dbo.categories
(
    id                  UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT DF_categories_id DEFAULT NEWSEQUENTIALID(),

    owner_user_id       UNIQUEIDENTIFIER NULL,

    name                NVARCHAR(100) NOT NULL,
    type                VARCHAR(20) NOT NULL,

    icon                NVARCHAR(100) NULL,
    color               VARCHAR(20) NULL,

    sort_order          INT NOT NULL
        CONSTRAINT DF_categories_sort_order DEFAULT (0),

    is_active           BIT NOT NULL
        CONSTRAINT DF_categories_is_active DEFAULT (1),

    created_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_categories_created_at DEFAULT SYSUTCDATETIME(),

    updated_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_categories_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_categories PRIMARY KEY (id),

    CONSTRAINT FK_categories_owner_user
        FOREIGN KEY (owner_user_id)
        REFERENCES dbo.users(id),

    CONSTRAINT CK_categories_type
        CHECK (type IN ('INCOME', 'EXPENSE'))
);
GO

CREATE INDEX IX_categories_owner_user
    ON dbo.categories(owner_user_id, is_active, type, sort_order)
    INCLUDE (name, icon, color);
GO

CREATE UNIQUE INDEX UX_categories_global_name_type
    ON dbo.categories(name, type)
    WHERE owner_user_id IS NULL;
GO

CREATE UNIQUE INDEX UX_categories_user_name_type
    ON dbo.categories(owner_user_id, name, type)
    WHERE owner_user_id IS NOT NULL;
GO


-- =====================================================================
-- 4. ACCOUNTS
-- Supports Bank / Cash / Crypto / E-wallet and future account types.
-- =====================================================================

CREATE TABLE dbo.accounts
(
    id                  UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT DF_accounts_id DEFAULT NEWSEQUENTIALID(),

    user_id             UNIQUEIDENTIFIER NOT NULL,

    name                NVARCHAR(150) NOT NULL,
    account_type        VARCHAR(30) NOT NULL,

    institution_name    NVARCHAR(150) NULL,

    balance             DECIMAL(19, 2) NOT NULL
        CONSTRAINT DF_accounts_balance DEFAULT (0),

    currency            CHAR(3) NOT NULL
        CONSTRAINT DF_accounts_currency DEFAULT ('VND'),

    icon                NVARCHAR(100) NULL,
    color               VARCHAR(20) NULL,

    is_active           BIT NOT NULL
        CONSTRAINT DF_accounts_is_active DEFAULT (1),

    created_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_accounts_created_at DEFAULT SYSUTCDATETIME(),

    updated_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_accounts_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_accounts PRIMARY KEY (id),

    CONSTRAINT FK_accounts_user
        FOREIGN KEY (user_id)
        REFERENCES dbo.users(id),

    CONSTRAINT CK_accounts_type
        CHECK
        (
            account_type IN
            (
                'BANK',
                'CASH',
                'CRYPTO',
                'E_WALLET',
                'CREDIT_CARD',
                'SAVINGS',
                'INVESTMENT',
                'OTHER'
            )
        )
);
GO

CREATE INDEX IX_accounts_user
    ON dbo.accounts(user_id, is_active)
    INCLUDE
    (
        name,
        account_type,
        institution_name,
        balance,
        currency,
        icon,
        color
    );
GO

CREATE INDEX IX_accounts_user_type
    ON dbo.accounts(user_id, account_type, is_active);
GO


-- =====================================================================
-- 5. INVOICES
-- Source document extracted by OCR/AI.
--
-- parent_id is kept because the project summary explicitly mentions
-- parent/child invoice access for split invoices.
-- =====================================================================

CREATE TABLE dbo.invoices
(
    id                  UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT DF_invoices_id DEFAULT NEWSEQUENTIALID(),

    user_id             UNIQUEIDENTIFIER NOT NULL,

    parent_id           UNIQUEIDENTIFIER NULL,

    account_id          UNIQUEIDENTIFIER NULL,
    category_id         UNIQUEIDENTIFIER NULL,

    source              VARCHAR(20) NOT NULL
        CONSTRAINT DF_invoices_source DEFAULT ('UPLOAD'),

    status              VARCHAR(30) NOT NULL
        CONSTRAINT DF_invoices_status DEFAULT ('UPLOADED'),

    merchant_name       NVARCHAR(255) NULL,
    merchant_address    NVARCHAR(500) NULL,
    merchant_tax_code   NVARCHAR(100) NULL,

    invoice_number      NVARCHAR(100) NULL,
    invoice_date        DATE NULL,

    subtotal_amount     DECIMAL(19, 2) NULL,
    tax_amount          DECIMAL(19, 2) NULL,
    discount_amount     DECIMAL(19, 2) NULL,
    total_amount        DECIMAL(19, 2) NULL,

    currency            CHAR(3) NOT NULL
        CONSTRAINT DF_invoices_currency DEFAULT ('VND'),

    original_filename   NVARCHAR(255) NULL,
    storage_key         NVARCHAR(1000) NULL,
    mime_type           NVARCHAR(100) NULL,
    file_size_bytes     BIGINT NULL,

    ocr_provider        NVARCHAR(100) NULL,
    ocr_model           NVARCHAR(150) NULL,
    ocr_confidence      DECIMAL(5, 4) NULL,

    ocr_raw_text        NVARCHAR(MAX) NULL,
    extracted_json      NVARCHAR(MAX) NULL,

    note                NVARCHAR(1000) NULL,

    created_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_invoices_created_at DEFAULT SYSUTCDATETIME(),

    updated_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_invoices_updated_at DEFAULT SYSUTCDATETIME(),

    confirmed_at        DATETIME2(0) NULL,

    CONSTRAINT PK_invoices PRIMARY KEY (id),

    CONSTRAINT FK_invoices_user
        FOREIGN KEY (user_id)
        REFERENCES dbo.users(id),

    CONSTRAINT FK_invoices_parent
        FOREIGN KEY (parent_id)
        REFERENCES dbo.invoices(id),

    CONSTRAINT FK_invoices_account
        FOREIGN KEY (account_id)
        REFERENCES dbo.accounts(id),

    CONSTRAINT FK_invoices_category
        FOREIGN KEY (category_id)
        REFERENCES dbo.categories(id),

    CONSTRAINT CK_invoices_source
        CHECK (source IN ('UPLOAD', 'CAMERA', 'MANUAL', 'IMPORT')),

    CONSTRAINT CK_invoices_status
        CHECK
        (
            status IN
            (
                'UPLOADED',
                'PROCESSING',
                'REVIEW_REQUIRED',
                'CONFIRMED',
                'FAILED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT CK_invoices_confidence
        CHECK
        (
            ocr_confidence IS NULL
            OR (ocr_confidence >= 0 AND ocr_confidence <= 1)
        ),

    CONSTRAINT CK_invoices_file_size
        CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),

    CONSTRAINT CK_invoices_extracted_json
        CHECK (extracted_json IS NULL OR ISJSON(extracted_json) = 1),

    CONSTRAINT CK_invoices_not_self_parent
        CHECK (parent_id IS NULL OR parent_id <> id)
);
GO

CREATE INDEX IX_invoices_user
    ON dbo.invoices(user_id, created_at DESC)
    INCLUDE
    (
        status,
        merchant_name,
        invoice_date,
        total_amount,
        currency,
        parent_id
    );
GO

CREATE INDEX IX_invoices_parent
    ON dbo.invoices(parent_id, created_at)
    WHERE parent_id IS NOT NULL;
GO

CREATE INDEX IX_invoices_user_status_date
    ON dbo.invoices(user_id, status, invoice_date DESC, created_at DESC)
    INCLUDE
    (
        merchant_name,
        invoice_number,
        total_amount,
        currency,
        ocr_confidence
    );
GO

CREATE INDEX IX_invoices_account
    ON dbo.invoices(account_id, invoice_date DESC)
    WHERE account_id IS NOT NULL;
GO

CREATE INDEX IX_invoices_category
    ON dbo.invoices(category_id, invoice_date DESC)
    WHERE category_id IS NOT NULL;
GO


-- =====================================================================
-- 6. INVOICE ITEMS
-- Production extension for OCR line-item extraction.
-- Not required for simple total-only OCR, but keeps normalized item data.
-- =====================================================================

CREATE TABLE dbo.invoice_items
(
    id                  UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT DF_invoice_items_id DEFAULT NEWSEQUENTIALID(),

    invoice_id          UNIQUEIDENTIFIER NOT NULL,

    line_no             INT NOT NULL,

    name                NVARCHAR(500) NOT NULL,
    sku                 NVARCHAR(100) NULL,
    unit                NVARCHAR(50) NULL,

    quantity            DECIMAL(18, 4) NULL,
    unit_price          DECIMAL(19, 2) NULL,

    discount_amount     DECIMAL(19, 2) NULL,
    tax_amount          DECIMAL(19, 2) NULL,
    line_total          DECIMAL(19, 2) NULL,

    confidence          DECIMAL(5, 4) NULL,
    raw_text            NVARCHAR(1000) NULL,

    created_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_invoice_items_created_at DEFAULT SYSUTCDATETIME(),

    updated_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_invoice_items_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_invoice_items PRIMARY KEY (id),

    CONSTRAINT FK_invoice_items_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES dbo.invoices(id)
        ON DELETE CASCADE,

    CONSTRAINT UQ_invoice_items_invoice_line
        UNIQUE (invoice_id, line_no),

    CONSTRAINT CK_invoice_items_line_no
        CHECK (line_no > 0),

    CONSTRAINT CK_invoice_items_quantity
        CHECK (quantity IS NULL OR quantity >= 0),

    CONSTRAINT CK_invoice_items_confidence
        CHECK
        (
            confidence IS NULL
            OR (confidence >= 0 AND confidence <= 1)
        )
);
GO

CREATE INDEX IX_invoice_items_invoice
    ON dbo.invoice_items(invoice_id, line_no)
    INCLUDE
    (
        name,
        quantity,
        unit_price,
        tax_amount,
        line_total,
        confidence
    );
GO


-- =====================================================================
-- 7. OCR JOBS
-- Production extension for AI API processing state / retry / observability.
-- =====================================================================

CREATE TABLE dbo.ocr_jobs
(
    id                  UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT DF_ocr_jobs_id DEFAULT NEWSEQUENTIALID(),

    user_id             UNIQUEIDENTIFIER NOT NULL,
    invoice_id          UNIQUEIDENTIFIER NULL,

    status              VARCHAR(30) NOT NULL
        CONSTRAINT DF_ocr_jobs_status DEFAULT ('QUEUED'),

    provider            NVARCHAR(100) NULL,
    model_name          NVARCHAR(150) NULL,

    attempt_count       INT NOT NULL
        CONSTRAINT DF_ocr_jobs_attempt_count DEFAULT (0),

    progress_percent    TINYINT NOT NULL
        CONSTRAINT DF_ocr_jobs_progress DEFAULT (0),

    error_code          NVARCHAR(100) NULL,
    error_message       NVARCHAR(2000) NULL,

    request_json        NVARCHAR(MAX) NULL,
    response_json       NVARCHAR(MAX) NULL,

    started_at          DATETIME2(0) NULL,
    completed_at        DATETIME2(0) NULL,
    processing_ms       INT NULL,

    created_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_ocr_jobs_created_at DEFAULT SYSUTCDATETIME(),

    updated_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_ocr_jobs_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_ocr_jobs PRIMARY KEY (id),

    CONSTRAINT FK_ocr_jobs_user
        FOREIGN KEY (user_id)
        REFERENCES dbo.users(id),

    CONSTRAINT FK_ocr_jobs_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES dbo.invoices(id),

    CONSTRAINT CK_ocr_jobs_status
        CHECK
        (
            status IN
            (
                'QUEUED',
                'PROCESSING',
                'COMPLETED',
                'FAILED',
                'CANCELLED'
            )
        ),

    CONSTRAINT CK_ocr_jobs_attempt_count
        CHECK (attempt_count >= 0),

    CONSTRAINT CK_ocr_jobs_progress
        CHECK (progress_percent BETWEEN 0 AND 100),

    CONSTRAINT CK_ocr_jobs_processing_ms
        CHECK (processing_ms IS NULL OR processing_ms >= 0),

    CONSTRAINT CK_ocr_jobs_request_json
        CHECK (request_json IS NULL OR ISJSON(request_json) = 1),

    CONSTRAINT CK_ocr_jobs_response_json
        CHECK (response_json IS NULL OR ISJSON(response_json) = 1)
);
GO

CREATE INDEX IX_ocr_jobs_user_created
    ON dbo.ocr_jobs(user_id, created_at DESC)
    INCLUDE
    (
        status,
        invoice_id,
        provider,
        model_name,
        progress_percent,
        error_code
    );
GO

CREATE INDEX IX_ocr_jobs_status_created
    ON dbo.ocr_jobs(status, created_at ASC)
    INCLUDE
    (
        user_id,
        invoice_id,
        provider,
        attempt_count,
        progress_percent
    );
GO

CREATE INDEX IX_ocr_jobs_invoice
    ON dbo.ocr_jobs(invoice_id, created_at DESC)
    WHERE invoice_id IS NOT NULL;
GO


-- =====================================================================
-- 8. TRANSACTIONS
--
-- Existing project convention:
--   INCOME  -> positive amount
--   EXPENSE -> negative amount
--
-- The invoice link enables "Review OCR -> Save as transaction".
-- =====================================================================

CREATE TABLE dbo.transactions
(
    id                  UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT DF_transactions_id DEFAULT NEWSEQUENTIALID(),

    user_id             UNIQUEIDENTIFIER NOT NULL,
    account_id          UNIQUEIDENTIFIER NOT NULL,
    category_id         UNIQUEIDENTIFIER NULL,
    invoice_id          UNIQUEIDENTIFIER NULL,

    description         NVARCHAR(255) NOT NULL,

    amount              DECIMAL(19, 2) NOT NULL,

    type                VARCHAR(20) NOT NULL,

    source              VARCHAR(20) NOT NULL
        CONSTRAINT DF_transactions_source DEFAULT ('MANUAL'),

    transaction_date    DATE NOT NULL,

    note                NVARCHAR(1000) NULL,

    created_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_transactions_created_at DEFAULT SYSUTCDATETIME(),

    updated_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_transactions_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_transactions PRIMARY KEY (id),

    CONSTRAINT FK_transactions_user
        FOREIGN KEY (user_id)
        REFERENCES dbo.users(id),

    CONSTRAINT FK_transactions_account
        FOREIGN KEY (account_id)
        REFERENCES dbo.accounts(id),

    CONSTRAINT FK_transactions_category
        FOREIGN KEY (category_id)
        REFERENCES dbo.categories(id),

    CONSTRAINT FK_transactions_invoice
        FOREIGN KEY (invoice_id)
        REFERENCES dbo.invoices(id),

    CONSTRAINT CK_transactions_type
        CHECK (type IN ('INCOME', 'EXPENSE')),

    CONSTRAINT CK_transactions_source
        CHECK (source IN ('MANUAL', 'OCR', 'IMPORT', 'SYSTEM')),

    CONSTRAINT CK_transactions_amount_sign
        CHECK
        (
            (type = 'INCOME'  AND amount >= 0)
            OR
            (type = 'EXPENSE' AND amount <= 0)
        )
);
GO

-- Prevent duplicate "Save as transaction" from the same invoice.
CREATE UNIQUE INDEX UX_transactions_invoice
    ON dbo.transactions(invoice_id)
    WHERE invoice_id IS NOT NULL;
GO

-- Primary list/filter/report index:
-- user + date supports history pagination and time-range reporting.
CREATE INDEX IX_transactions_user_date
    ON dbo.transactions(user_id, transaction_date DESC, created_at DESC)
    INCLUDE
    (
        account_id,
        category_id,
        invoice_id,
        description,
        amount,
        type,
        source
    );
GO

CREATE INDEX IX_transactions_date
    ON dbo.transactions(transaction_date DESC)
    INCLUDE (user_id, category_id, amount, type);
GO

CREATE INDEX IX_transactions_user_account_date
    ON dbo.transactions(user_id, account_id, transaction_date DESC)
    INCLUDE (category_id, amount, type, description);
GO

CREATE INDEX IX_transactions_user_category_date
    ON dbo.transactions(user_id, category_id, transaction_date DESC)
    INCLUDE (account_id, amount, type, description)
    WHERE category_id IS NOT NULL;
GO

CREATE INDEX IX_transactions_user_type_date
    ON dbo.transactions(user_id, type, transaction_date DESC)
    INCLUDE (amount, category_id, account_id);
GO


-- =====================================================================
-- 9. BUDGETS
-- Feature: spending limits per category + progress warning.
--
-- spent_amount is deliberately NOT stored.
-- It is derived from transactions to avoid duplicated / stale values.
-- =====================================================================

CREATE TABLE dbo.budgets
(
    id                  UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT DF_budgets_id DEFAULT NEWSEQUENTIALID(),

    user_id             UNIQUEIDENTIFIER NOT NULL,

    category_id         UNIQUEIDENTIFIER NULL,

    name                NVARCHAR(150) NOT NULL,

    amount_limit        DECIMAL(19, 2) NOT NULL,

    currency            CHAR(3) NOT NULL
        CONSTRAINT DF_budgets_currency DEFAULT ('VND'),

    period_type         VARCHAR(20) NOT NULL
        CONSTRAINT DF_budgets_period_type DEFAULT ('MONTHLY'),

    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,

    warning_percent     DECIMAL(5, 2) NOT NULL
        CONSTRAINT DF_budgets_warning_percent DEFAULT (80.00),

    is_active           BIT NOT NULL
        CONSTRAINT DF_budgets_is_active DEFAULT (1),

    created_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_budgets_created_at DEFAULT SYSUTCDATETIME(),

    updated_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_budgets_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_budgets PRIMARY KEY (id),

    CONSTRAINT FK_budgets_user
        FOREIGN KEY (user_id)
        REFERENCES dbo.users(id),

    CONSTRAINT FK_budgets_category
        FOREIGN KEY (category_id)
        REFERENCES dbo.categories(id),

    CONSTRAINT CK_budgets_amount_limit
        CHECK (amount_limit > 0),

    CONSTRAINT CK_budgets_period_type
        CHECK (period_type IN ('WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM')),

    CONSTRAINT CK_budgets_dates
        CHECK (end_date >= start_date),

    CONSTRAINT CK_budgets_warning_percent
        CHECK (warning_percent > 0 AND warning_percent <= 100)
);
GO

CREATE INDEX IX_budgets_user
    ON dbo.budgets(user_id, is_active, start_date DESC, end_date DESC)
    INCLUDE
    (
        category_id,
        name,
        amount_limit,
        currency,
        period_type,
        warning_percent
    );
GO

CREATE INDEX IX_budgets_user_category_period
    ON dbo.budgets(user_id, category_id, start_date, end_date)
    INCLUDE (amount_limit, warning_percent, is_active);
GO

-- Avoid exact duplicate category budgets for the same period.
CREATE UNIQUE INDEX UX_budgets_user_category_period
    ON dbo.budgets(user_id, category_id, start_date, end_date)
    WHERE category_id IS NOT NULL;
GO

-- Extension: category_id NULL can represent an overall spending budget.
CREATE UNIQUE INDEX UX_budgets_user_overall_period
    ON dbo.budgets(user_id, start_date, end_date)
    WHERE category_id IS NULL;
GO


-- =====================================================================
-- 10. REFRESH TOKENS
-- Production extension for JWT session lifecycle.
-- Store HASH only, never the raw refresh token.
-- =====================================================================

CREATE TABLE dbo.refresh_tokens
(
    id                  UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT DF_refresh_tokens_id DEFAULT NEWSEQUENTIALID(),

    user_id             UNIQUEIDENTIFIER NOT NULL,

    token_hash          VARCHAR(255) NOT NULL,

    family_id           UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT DF_refresh_tokens_family_id DEFAULT NEWID(),

    parent_token_id     UNIQUEIDENTIFIER NULL,

    expires_at          DATETIME2(0) NOT NULL,

    revoked_at          DATETIME2(0) NULL,
    revocation_reason   NVARCHAR(255) NULL,

    device_name         NVARCHAR(150) NULL,
    ip_address          VARCHAR(45) NULL,
    user_agent          NVARCHAR(1000) NULL,

    last_used_at        DATETIME2(0) NULL,

    created_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_refresh_tokens_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_refresh_tokens PRIMARY KEY (id),

    CONSTRAINT UQ_refresh_tokens_hash UNIQUE (token_hash),

    CONSTRAINT FK_refresh_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES dbo.users(id)
        ON DELETE CASCADE,

    CONSTRAINT FK_refresh_tokens_parent
        FOREIGN KEY (parent_token_id)
        REFERENCES dbo.refresh_tokens(id),

    CONSTRAINT CK_refresh_tokens_expiry
        CHECK (expires_at > created_at)
);
GO

CREATE INDEX IX_refresh_tokens_user_expiry
    ON dbo.refresh_tokens(user_id, expires_at DESC)
    INCLUDE
    (
        revoked_at,
        family_id,
        device_name,
        last_used_at
    );
GO

CREATE INDEX IX_refresh_tokens_family
    ON dbo.refresh_tokens(family_id, created_at DESC)
    INCLUDE (user_id, expires_at, revoked_at);
GO

CREATE INDEX IX_refresh_tokens_active
    ON dbo.refresh_tokens(user_id, expires_at)
    WHERE revoked_at IS NULL;
GO


-- =====================================================================
-- 11. AUDIT LOGS
-- Append-only application/security log.
-- user_id is kept to match the current project's naming/index convention.
-- =====================================================================

CREATE TABLE dbo.audit_logs
(
    id                  BIGINT IDENTITY(1,1) NOT NULL,

    user_id             UNIQUEIDENTIFIER NULL,

    action              NVARCHAR(100) NOT NULL,

    entity_type         NVARCHAR(100) NULL,
    entity_id           UNIQUEIDENTIFIER NULL,

    request_id          UNIQUEIDENTIFIER NULL,

    route               NVARCHAR(500) NULL,
    http_method         VARCHAR(10) NULL,
    status_code         SMALLINT NULL,

    ip_address          VARCHAR(45) NULL,
    user_agent          NVARCHAR(1000) NULL,

    old_values_json     NVARCHAR(MAX) NULL,
    new_values_json     NVARCHAR(MAX) NULL,
    metadata_json       NVARCHAR(MAX) NULL,

    created_at          DATETIME2(0) NOT NULL
        CONSTRAINT DF_audit_logs_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_audit_logs PRIMARY KEY CLUSTERED (id),

    CONSTRAINT FK_audit_logs_user
        FOREIGN KEY (user_id)
        REFERENCES dbo.users(id)
        ON DELETE SET NULL,

    CONSTRAINT CK_audit_logs_status_code
        CHECK
        (
            status_code IS NULL
            OR (status_code BETWEEN 100 AND 599)
        ),

    CONSTRAINT CK_audit_logs_old_json
        CHECK (old_values_json IS NULL OR ISJSON(old_values_json) = 1),

    CONSTRAINT CK_audit_logs_new_json
        CHECK (new_values_json IS NULL OR ISJSON(new_values_json) = 1),

    CONSTRAINT CK_audit_logs_metadata_json
        CHECK (metadata_json IS NULL OR ISJSON(metadata_json) = 1)
);
GO

CREATE INDEX IX_audit_logs_user
    ON dbo.audit_logs(user_id, created_at DESC)
    INCLUDE
    (
        action,
        entity_type,
        entity_id,
        request_id,
        status_code
    )
    WHERE user_id IS NOT NULL;
GO

CREATE INDEX IX_audit_logs_created_at
    ON dbo.audit_logs(created_at DESC)
    INCLUDE
    (
        user_id,
        action,
        entity_type,
        entity_id,
        status_code
    );
GO

CREATE INDEX IX_audit_logs_entity
    ON dbo.audit_logs(entity_type, entity_id, created_at DESC)
    INCLUDE (user_id, action, request_id);
GO

CREATE INDEX IX_audit_logs_request
    ON dbo.audit_logs(request_id)
    WHERE request_id IS NOT NULL;
GO


-- =====================================================================
-- 12. REPORTING VIEWS
-- =====================================================================

-- Dashboard + bar chart: monthly income vs expense + savings rate.
CREATE VIEW dbo.vw_monthly_cashflow
AS
SELECT
    t.user_id,
    DATEFROMPARTS(YEAR(t.transaction_date), MONTH(t.transaction_date), 1) AS month_start,

    SUM
    (
        CASE
            WHEN t.type = 'INCOME'
            THEN t.amount
            ELSE 0
        END
    ) AS total_income,

    SUM
    (
        CASE
            WHEN t.type = 'EXPENSE'
            THEN ABS(t.amount)
            ELSE 0
        END
    ) AS total_expense,

    SUM(t.amount) AS net_cashflow,

    CAST
    (
        CASE
            WHEN SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE 0 END) <= 0
                THEN NULL
            ELSE
                100.0 * SUM(t.amount)
                / NULLIF(SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE 0 END), 0)
        END
        AS DECIMAL(9, 2)
    ) AS savings_rate_percent,

    COUNT_BIG(*) AS transaction_count

FROM dbo.transactions AS t
GROUP BY
    t.user_id,
    DATEFROMPARTS(YEAR(t.transaction_date), MONTH(t.transaction_date), 1);
GO


-- Pie chart / top spending categories by month.
CREATE VIEW dbo.vw_monthly_category_spending
AS
SELECT
    t.user_id,
    t.category_id,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color,

    DATEFROMPARTS(YEAR(t.transaction_date), MONTH(t.transaction_date), 1) AS month_start,

    SUM(ABS(t.amount)) AS total_spent,
    COUNT_BIG(*) AS transaction_count

FROM dbo.transactions AS t

LEFT JOIN dbo.categories AS c
    ON c.id = t.category_id

WHERE t.type = 'EXPENSE'

GROUP BY
    t.user_id,
    t.category_id,
    c.name,
    c.icon,
    c.color,
    DATEFROMPARTS(YEAR(t.transaction_date), MONTH(t.transaction_date), 1);
GO


-- Budget ProgressBar:
-- SAFE / WARNING / EXCEEDED can be derived from usage_percent.
CREATE VIEW dbo.vw_budget_progress
AS
SELECT
    b.id AS budget_id,
    b.user_id,
    b.category_id,
    b.name AS budget_name,
    b.amount_limit,
    b.currency,
    b.period_type,
    b.start_date,
    b.end_date,
    b.warning_percent,
    b.is_active,

    COALESCE(x.spent_amount, 0) AS spent_amount,

    b.amount_limit - COALESCE(x.spent_amount, 0) AS remaining_amount,

    CAST
    (
        100.0 * COALESCE(x.spent_amount, 0)
        / NULLIF(b.amount_limit, 0)
        AS DECIMAL(9, 2)
    ) AS usage_percent,

    CASE
        WHEN COALESCE(x.spent_amount, 0) > b.amount_limit
            THEN 'EXCEEDED'
        WHEN
            100.0 * COALESCE(x.spent_amount, 0)
            / NULLIF(b.amount_limit, 0) >= b.warning_percent
            THEN 'WARNING'
        ELSE 'SAFE'
    END AS progress_status

FROM dbo.budgets AS b

OUTER APPLY
(
    SELECT
        SUM(ABS(t.amount)) AS spent_amount
    FROM dbo.transactions AS t
    WHERE
        t.user_id = b.user_id
        AND t.type = 'EXPENSE'
        AND t.transaction_date BETWEEN b.start_date AND b.end_date
        AND
        (
            b.category_id IS NULL
            OR t.category_id = b.category_id
        )
) AS x;
GO


-- =====================================================================
-- 13. OPTIONAL DEFAULT SYSTEM CATEGORIES
--
-- Keep IDs stable if your current seed depends on these UUIDs.
-- This section can be removed when Alembic/data seed owns categories.
-- =====================================================================

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.categories
    WHERE owner_user_id IS NULL
      AND name = N'Ăn uống'
      AND type = 'EXPENSE'
)
INSERT INTO dbo.categories
(
    id, owner_user_id, name, type, icon, color, sort_order
)
VALUES
(
    '1b7fd2d3-8daf-4abe-9f28-5eb63f3cbb4f',
    NULL,
    N'Ăn uống',
    'EXPENSE',
    N'🍜',
    '#F97316',
    10
);
GO

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.categories
    WHERE owner_user_id IS NULL
      AND name = N'Di chuyển'
      AND type = 'EXPENSE'
)
INSERT INTO dbo.categories
(
    id, owner_user_id, name, type, icon, color, sort_order
)
VALUES
(
    'f5cdc8ff-45ba-4b60-b288-4f62eaee37b0',
    NULL,
    N'Di chuyển',
    'EXPENSE',
    N'🚗',
    '#3B82F6',
    20
);
GO

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.categories
    WHERE owner_user_id IS NULL
      AND name = N'Nhà ở'
      AND type = 'EXPENSE'
)
INSERT INTO dbo.categories
(
    id, owner_user_id, name, type, icon, color, sort_order
)
VALUES
(
    '3335cf59-020e-4979-bd84-54b1de2b5715',
    NULL,
    N'Nhà ở',
    'EXPENSE',
    N'🏠',
    '#8B5CF6',
    30
);
GO

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.categories
    WHERE owner_user_id IS NULL
      AND name = N'Y tế'
      AND type = 'EXPENSE'
)
INSERT INTO dbo.categories
(
    id, owner_user_id, name, type, icon, color, sort_order
)
VALUES
(
    '65ff3ca6-359f-4b07-86f4-4ca4ed87d900',
    NULL,
    N'Y tế',
    'EXPENSE',
    N'🏥',
    '#EF4444',
    40
);
GO

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.categories
    WHERE owner_user_id IS NULL
      AND name = N'Giáo dục'
      AND type = 'EXPENSE'
)
INSERT INTO dbo.categories
(
    id, owner_user_id, name, type, icon, color, sort_order
)
VALUES
(
    '671df121-18fb-49bd-a4c5-b453cb7bf667',
    NULL,
    N'Giáo dục',
    'EXPENSE',
    N'📚',
    '#14B8A6',
    50
);
GO

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.categories
    WHERE owner_user_id IS NULL
      AND name = N'Lương'
      AND type = 'INCOME'
)
INSERT INTO dbo.categories
(
    id, owner_user_id, name, type, icon, color, sort_order
)
VALUES
(
    '7e80654a-1af0-4980-91e7-71af2dfd1c02',
    NULL,
    N'Lương',
    'INCOME',
    N'💰',
    '#22C55E',
    60
);
GO

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.categories
    WHERE owner_user_id IS NULL
      AND name = N'Thưởng'
      AND type = 'INCOME'
)
INSERT INTO dbo.categories
(
    id, owner_user_id, name, type, icon, color, sort_order
)
VALUES
(
    '67ff63fa-06b1-432a-b5ac-f79c1a8ae305',
    NULL,
    N'Thưởng',
    'INCOME',
    N'🎁',
    '#10B981',
    70
);
GO

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.categories
    WHERE owner_user_id IS NULL
      AND name = N'Đầu tư'
      AND type = 'INCOME'
)
INSERT INTO dbo.categories
(
    id, owner_user_id, name, type, icon, color, sort_order
)
VALUES
(
    '4e96d580-8c01-4048-b70b-dd8676317d85',
    NULL,
    N'Đầu tư',
    'INCOME',
    N'📈',
    '#06B6D4',
    80
);
GO


-- =====================================================================
-- 14. VERIFICATION QUERIES
-- =====================================================================

SELECT
    t.name AS table_name,
    SUM(p.rows) AS row_count
FROM sys.tables AS t
JOIN sys.partitions AS p
    ON p.object_id = t.object_id
   AND p.index_id IN (0, 1)
WHERE t.name IN
(
    'users',
    'categories',
    'accounts',
    'invoices',
    'invoice_items',
    'ocr_jobs',
    'transactions',
    'budgets',
    'refresh_tokens',
    'audit_logs'
)
GROUP BY t.name
ORDER BY t.name;
GO


SELECT
    OBJECT_NAME(i.object_id) AS table_name,
    i.name AS index_name,
    i.is_unique,
    i.has_filter,
    i.filter_definition
FROM sys.indexes AS i
WHERE
    OBJECT_NAME(i.object_id) IN
    (
        'users',
        'categories',
        'accounts',
        'invoices',
        'invoice_items',
        'ocr_jobs',
        'transactions',
        'budgets',
        'refresh_tokens',
        'audit_logs'
    )
    AND i.name IS NOT NULL
ORDER BY
    table_name,
    index_name;
GO


-- =====================================================================
-- END CAPITALFLOW DATABASE V3
-- =====================================================================