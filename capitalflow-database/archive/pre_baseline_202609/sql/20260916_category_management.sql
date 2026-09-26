IF COL_LENGTH('dbo.categories', 'icon') IS NULL
    ALTER TABLE dbo.categories ADD icon NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.categories', 'color') IS NULL
    ALTER TABLE dbo.categories ADD color VARCHAR(20) NULL;
IF COL_LENGTH('dbo.categories', 'sort_order') IS NULL
    ALTER TABLE dbo.categories ADD sort_order INT NOT NULL CONSTRAINT DF_categories_sort_order DEFAULT (0);
IF COL_LENGTH('dbo.categories', 'is_active') IS NULL
    ALTER TABLE dbo.categories ADD is_active BIT NOT NULL CONSTRAINT DF_categories_is_active DEFAULT (1);
GO

UPDATE dbo.categories SET icon = CASE name
    WHEN N'Ăn uống' THEN 'utensils' WHEN N'Di chuyển' THEN 'car'
    WHEN N'Nhà ở' THEN 'home' WHEN N'Y tế' THEN 'heart-pulse'
    WHEN N'Giáo dục' THEN 'graduation-cap' WHEN N'Mua sắm' THEN 'shopping-bag'
    WHEN N'Giải trí' THEN 'film' WHEN N'Hóa đơn điện nước' THEN 'lightbulb'
    WHEN N'Bảo hiểm' THEN 'shield' WHEN N'Chi phí doanh nghiệp' THEN 'briefcase'
    WHEN N'Lương' THEN 'banknote' WHEN N'Thưởng' THEN 'gift'
    WHEN N'Đầu tư' THEN 'trending-up' WHEN N'Kinh doanh' THEN 'store'
    WHEN N'Thu nhập khác' THEN 'wallet' ELSE COALESCE(NULLIF(icon, ''), 'package') END,
    color = CASE name
    WHEN N'Ăn uống' THEN 'orange' WHEN N'Di chuyển' THEN 'sky'
    WHEN N'Nhà ở' THEN 'teal' WHEN N'Y tế' THEN 'rose'
    WHEN N'Giáo dục' THEN 'cobalt' WHEN N'Mua sắm' THEN 'amber'
    WHEN N'Giải trí' THEN 'rose' WHEN N'Hóa đơn điện nước' THEN 'amber'
    WHEN N'Bảo hiểm' THEN 'teal' WHEN N'Chi phí doanh nghiệp' THEN 'slate'
    WHEN N'Lương' THEN 'green' WHEN N'Thưởng' THEN 'amber'
    WHEN N'Đầu tư' THEN 'cobalt' WHEN N'Kinh doanh' THEN 'teal'
    ELSE COALESCE(NULLIF(color, ''), 'slate') END
WHERE owner_user_id IS NULL;
GO

;WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY type ORDER BY CASE WHEN sort_order = 0 THEN 1 ELSE 0 END, sort_order, name) * 10 AS new_order
    FROM dbo.categories WHERE owner_user_id IS NULL
)
UPDATE category SET sort_order = ordered.new_order
FROM dbo.categories category INNER JOIN ordered ON ordered.id = category.id;
