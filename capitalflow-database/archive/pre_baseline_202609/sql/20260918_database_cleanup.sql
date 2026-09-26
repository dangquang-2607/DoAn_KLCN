/*
Safely remove global legacy categories produced by the old Unicode repair flow.
All references are moved to the canonical category before deletion and the
deleted row is retained in audit_logs as JSON.
*/

IF OBJECT_ID('tempdb..#legacy_categories') IS NOT NULL
    DROP TABLE #legacy_categories;

SELECT legacy.id AS legacy_id,
       canonical.id AS canonical_id,
       legacy.name,
       legacy.type,
       legacy.icon,
       legacy.color,
       legacy.keywords,
       legacy.sort_order,
       legacy.is_active,
       legacy.created_at,
       legacy.updated_at
INTO #legacy_categories
FROM dbo.categories AS legacy
LEFT JOIN dbo.categories AS canonical
  ON canonical.owner_user_id IS NULL
 AND canonical.type = legacy.type
 AND canonical.name = LEFT(legacy.name, LEN(legacy.name) - LEN(N' (bản cũ)'))
WHERE legacy.owner_user_id IS NULL
  AND legacy.name LIKE N'% (bản cũ)';

IF EXISTS (SELECT 1 FROM #legacy_categories WHERE canonical_id IS NULL)
    THROW 51018, N'Không tìm thấy danh mục chuẩn tương ứng; đã hủy dọn dữ liệu.', 1;

UPDATE transaction_row
SET category_id = legacy.canonical_id
FROM dbo.transactions AS transaction_row
INNER JOIN #legacy_categories AS legacy
  ON legacy.legacy_id = transaction_row.category_id;

UPDATE budget
SET category_id = legacy.canonical_id
FROM dbo.budgets AS budget
INNER JOIN #legacy_categories AS legacy
  ON legacy.legacy_id = budget.category_id;

UPDATE invoice
SET category_id = legacy.canonical_id
FROM dbo.invoices AS invoice
INNER JOIN #legacy_categories AS legacy
  ON legacy.legacy_id = invoice.category_id;

INSERT dbo.audit_logs (
    user_id, action, entity_type, entity_id,
    old_values_json, new_values_json, metadata_json, created_at
)
SELECT NULL,
       N'DATABASE_CLEANUP',
       N'category',
       legacy_id,
       (
           SELECT name, type, icon, color, keywords, sort_order,
                  is_active, created_at, updated_at
           FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
       ),
       (
           SELECT canonical_id AS merged_into, CAST(1 AS bit) AS deleted
           FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
       ),
       N'{"migration":"20260918_database_cleanup"}',
       SYSUTCDATETIME()
FROM #legacy_categories;

DELETE category
FROM dbo.categories AS category
INNER JOIN #legacy_categories AS legacy
  ON legacy.legacy_id = category.id;

;WITH ordered AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY type
               ORDER BY sort_order, name, id
           ) * 10 AS new_order
    FROM dbo.categories
    WHERE owner_user_id IS NULL
)
UPDATE category
SET sort_order = ordered.new_order
FROM dbo.categories AS category
INNER JOIN ordered ON ordered.id = category.id;

DROP TABLE #legacy_categories;
