-- Run via python -m scripts.migrate_financial_integrity --apply (one transaction).
SET XACT_ABORT ON;
SET NOCOUNT ON;
IF EXISTS (SELECT 1 FROM dbo.transactions WHERE amount=0)
    THROW 51000, 'Zero transactions require explicit reconciliation.', 1;
IF EXISTS (SELECT 1 FROM dbo.budgets WHERE currency <> 'VND')
    THROW 51001, 'Non-VND budgets require explicit reconciliation, not relabeling.', 1;
GO
IF COL_LENGTH('dbo.transactions','kind') IS NULL
    ALTER TABLE dbo.transactions ADD kind VARCHAR(20) NOT NULL CONSTRAINT DF_transactions_kind DEFAULT 'NORMAL';
IF COL_LENGTH('dbo.transactions','transfer_id') IS NULL
    ALTER TABLE dbo.transactions ADD transfer_id UNIQUEIDENTIFIER NULL;
IF COL_LENGTH('dbo.users','token_version') IS NULL
    ALTER TABLE dbo.users ADD token_version INT NOT NULL CONSTRAINT DF_users_token_version DEFAULT 0;
GO
-- Do not guess historic pairs with collisions, missing legs, or unequal amounts.
SELECT id,user_id,account_id,amount,type,transaction_date,RIGHT(description,8) AS legacy_ref
INTO #legacy_legs FROM dbo.transactions
WHERE source='SYSTEM' AND kind='NORMAL'
  AND (description LIKE N'Chuyển tiền đi%Ref:%' OR description LIKE N'Nhận chuyển tiền%Ref:%');
IF EXISTS (
    SELECT user_id,legacy_ref FROM #legacy_legs GROUP BY user_id,legacy_ref
    HAVING COUNT(*)<>2 OR SUM(amount)<>0 OR COUNT(DISTINCT account_id)<>2
       OR COUNT(DISTINCT type)<>2 OR COUNT(DISTINCT transaction_date)<>1
) THROW 51002, 'Ambiguous historic transfer: reconcile before migration.', 1;
SELECT user_id,legacy_ref,NEWID() AS transfer_id INTO #legacy_pairs
FROM #legacy_legs GROUP BY user_id,legacy_ref;
UPDATE t SET t.kind='TRANSFER',t.transfer_id=p.transfer_id
FROM dbo.transactions t JOIN #legacy_legs l ON t.id=l.id
JOIN #legacy_pairs p ON p.user_id=l.user_id AND p.legacy_ref=l.legacy_ref;
DROP TABLE #legacy_legs;
DROP TABLE #legacy_pairs;
-- Opening baseline preserves balances; it does not invent historic cash income.
INSERT INTO dbo.transactions
(id,user_id,account_id,amount,type,source,kind,transaction_date,description,note)
SELECT NEWID(),a.user_id,a.id,a.balance-COALESCE(t.total,0),
       CASE WHEN a.balance-COALESCE(t.total,0)>0 THEN 'INCOME' ELSE 'EXPENSE' END,
       'SYSTEM','ADJUSTMENT',CAST(SYSUTCDATETIME() AS DATE),N'Mốc đối soát số dư',
       N'Baseline migration 20260910: số dư hiện tại trừ tổng giao dịch đã có; không phải thu/chi mới.'
FROM dbo.accounts a OUTER APPLY (SELECT SUM(amount) AS total FROM dbo.transactions t WHERE t.account_id=a.id) t
WHERE a.balance<>COALESCE(t.total,0);
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.categories') AND name='UX_categories_global_name_type') DROP INDEX [UX_categories_global_name_type] ON dbo.[categories];
CREATE UNIQUE INDEX [UX_categories_global_name_type] ON dbo.categories (name, type) WHERE owner_user_id IS NULL;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.categories') AND name='UX_categories_user_name_type') DROP INDEX [UX_categories_user_name_type] ON dbo.[categories];
CREATE UNIQUE INDEX [UX_categories_user_name_type] ON dbo.categories (owner_user_id, name, type) WHERE owner_user_id IS NOT NULL;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.budgets') AND name='UX_budgets_user_category_period') DROP INDEX [UX_budgets_user_category_period] ON dbo.[budgets];
CREATE UNIQUE INDEX [UX_budgets_user_category_period] ON dbo.budgets (user_id, category_id, start_date, end_date) WHERE category_id IS NOT NULL;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.budgets') AND name='UX_budgets_user_overall_period') DROP INDEX [UX_budgets_user_overall_period] ON dbo.[budgets];
CREATE UNIQUE INDEX [UX_budgets_user_overall_period] ON dbo.budgets (user_id, start_date, end_date) WHERE category_id IS NULL;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.transactions') AND name='UX_transactions_transfer_leg') DROP INDEX [UX_transactions_transfer_leg] ON dbo.[transactions];
CREATE UNIQUE INDEX [UX_transactions_transfer_leg] ON dbo.transactions (transfer_id, type) WHERE transfer_id IS NOT NULL;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.budgets') AND name='CK_budgets_amount_limit') ALTER TABLE dbo.budgets DROP CONSTRAINT [CK_budgets_amount_limit];
ALTER TABLE dbo.budgets WITH CHECK ADD CONSTRAINT [CK_budgets_amount_limit] CHECK (amount_limit > 0);
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.budgets') AND name='CK_budgets_currency_vnd') ALTER TABLE dbo.budgets DROP CONSTRAINT [CK_budgets_currency_vnd];
ALTER TABLE dbo.budgets WITH CHECK ADD CONSTRAINT [CK_budgets_currency_vnd] CHECK (currency = 'VND');
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.budgets') AND name='CK_budgets_dates') ALTER TABLE dbo.budgets DROP CONSTRAINT [CK_budgets_dates];
ALTER TABLE dbo.budgets WITH CHECK ADD CONSTRAINT [CK_budgets_dates] CHECK (end_date >= start_date);
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.transactions') AND name='CK_transactions_amount_sign') ALTER TABLE dbo.transactions DROP CONSTRAINT [CK_transactions_amount_sign];
ALTER TABLE dbo.transactions WITH CHECK ADD CONSTRAINT [CK_transactions_amount_sign] CHECK ((type = 'INCOME' AND amount > 0) OR (type = 'EXPENSE' AND amount < 0));
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.transactions') AND name='CK_transactions_kind') ALTER TABLE dbo.transactions DROP CONSTRAINT [CK_transactions_kind];
ALTER TABLE dbo.transactions WITH CHECK ADD CONSTRAINT [CK_transactions_kind] CHECK (kind IN ('NORMAL', 'TRANSFER', 'ADJUSTMENT'));
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.transactions') AND name='CK_transactions_transfer_link') ALTER TABLE dbo.transactions DROP CONSTRAINT [CK_transactions_transfer_link];
ALTER TABLE dbo.transactions WITH CHECK ADD CONSTRAINT [CK_transactions_transfer_link] CHECK ((kind = 'TRANSFER' AND transfer_id IS NOT NULL) OR (kind <> 'TRANSFER' AND transfer_id IS NULL));
GO
CREATE OR ALTER VIEW [dbo].[vw_monthly_cashflow]
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
WHERE t.kind = 'NORMAL'
GROUP BY
    t.user_id,
    DATEFROMPARTS(YEAR(t.transaction_date), MONTH(t.transaction_date), 1);
GO
CREATE OR ALTER VIEW [dbo].[vw_monthly_category_spending]
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

WHERE t.type = 'EXPENSE' AND t.kind = 'NORMAL'

GROUP BY
    t.user_id,
    t.category_id,
    c.name,
    c.icon,
    c.color,
    DATEFROMPARTS(YEAR(t.transaction_date), MONTH(t.transaction_date), 1);
GO
CREATE OR ALTER VIEW [dbo].[vw_budget_progress]
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
        AND t.type = 'EXPENSE' AND t.kind = 'NORMAL'
        AND t.transaction_date BETWEEN b.start_date AND b.end_date
        AND
        (
            b.category_id IS NULL
            OR t.category_id = b.category_id
        )
) AS x;
