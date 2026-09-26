IF COL_LENGTH('dbo.categories', 'keywords') IS NULL
    ALTER TABLE dbo.categories ADD keywords NVARCHAR(1000) NULL;
GO

IF COL_LENGTH('dbo.transactions', 'category_confidence') IS NULL
    ALTER TABLE dbo.transactions ADD category_confidence DECIMAL(5,4) NULL;
IF COL_LENGTH('dbo.transactions', 'category_source') IS NULL
    ALTER TABLE dbo.transactions ADD category_source VARCHAR(30) NULL;
IF COL_LENGTH('dbo.transactions', 'category_was_auto') IS NULL
    ALTER TABLE dbo.transactions ADD category_was_auto BIT NOT NULL
        CONSTRAINT DF_transactions_category_was_auto DEFAULT (0);
GO

UPDATE dbo.categories SET keywords = CASE name
    WHEN N'Ăn uống' THEN N'nhà hàng, quán ăn, cơm, phở, bún, bánh mì, cà phê, cafe, trà sữa, đồ ăn, thực phẩm, siêu thị'
    WHEN N'Di chuyển' THEN N'xăng, dầu, grab, taxi, xe buýt, vé xe, vé tàu, gửi xe, cầu đường, bảo dưỡng xe'
    WHEN N'Nhà ở' THEN N'tiền thuê nhà, chung cư, nội thất, gia dụng, sửa nhà'
    WHEN N'Y tế' THEN N'bệnh viện, phòng khám, nhà thuốc, thuốc, nha khoa, xét nghiệm, khám bệnh'
    WHEN N'Giáo dục' THEN N'học phí, trường học, khóa học, sách, giáo trình, trung tâm ngoại ngữ'
    WHEN N'Mua sắm' THEN N'mua sắm, cửa hàng, quần áo, giày dép, mỹ phẩm, thương mại điện tử'
    WHEN N'Giải trí' THEN N'rạp phim, xem phim, karaoke, trò chơi, game, âm nhạc, du lịch'
    WHEN N'Hóa đơn điện nước' THEN N'tiền điện, tiền nước, internet, wifi, điện thoại, viễn thông'
    WHEN N'Bảo hiểm' THEN N'bảo hiểm, bảo hiểm nhân thọ, bảo hiểm xe, bảo hiểm y tế'
    WHEN N'Chi phí doanh nghiệp' THEN N'văn phòng, phần mềm, hosting, tên miền, quảng cáo, tiếp khách, công tác'
    WHEN N'Lương' THEN N'lương, tiền lương, payroll, salary'
    WHEN N'Thưởng' THEN N'thưởng, bonus, hoa hồng'
    WHEN N'Đầu tư' THEN N'cổ tức, lợi nhuận đầu tư, chứng khoán, trái phiếu, tiền lãi'
    WHEN N'Kinh doanh' THEN N'doanh thu, bán hàng, kinh doanh, khách hàng thanh toán'
    WHEN N'Thu nhập khác' THEN N'hoàn tiền, quà tặng, trợ cấp, thu nhập khác'
    ELSE keywords END
WHERE owner_user_id IS NULL AND (keywords IS NULL OR LTRIM(RTRIM(keywords)) = '');
GO

UPDATE dbo.transactions
SET category_confidence = 1.0000,
    category_source = 'LEGACY',
    category_was_auto = 0
WHERE category_id IS NOT NULL AND category_source IS NULL;
