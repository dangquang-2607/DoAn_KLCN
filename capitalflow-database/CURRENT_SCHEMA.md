# Schema hiện tại của CapitalFlow

## Dọn môi trường QA ngày 19/10/2026

- Đã xóa hai database `capitalflow_*_verify_*`, `CapitalFlow_QA_20261008_b5fcca32`
  và ba database `cf_invoice_dedup_qa_*` được nhắc trong lịch sử bên dưới.
- Trước khi xóa đã backup `COPY_ONLY`, `CHECKSUM` và chạy `RESTORE VERIFYONLY`.
  Sáu file có tiền tố `QA_cleanup_20261019_` nằm trong thư mục Backup mặc định
  của instance `localhost\SQLEXPRESS`; có thể restore nếu cần lấy lại dữ liệu QA.
- `personal_finance` giữ nguyên revision `cfdb_invoice_dedup`; số bản ghi của
  22 bảng trước/sau thao tác không đổi. Không xóa bảng nghiệp vụ.
- Đã gỡ công cụ kiểm chứng/đánh giá riêng. Các mục phía dưới là lịch sử nâng schema,
  không phải danh sách database QA đang tồn tại hoặc lệnh kiểm thử hiện hành.

## Backend chống trùng hóa đơn — đã nâng database chính (2026-10-12)

- Revision mới trong source: `cfdb_invoice_dedup`, sau `cfdb_recurring_budgets`; thêm định danh/hash, revision, soft delete, liên kết bản trùng, bảng `invoice_events` và unique index cho hóa đơn CONFIRMED.
- Database ứng dụng `personal_finance` đã ở `cfdb_invoice_dedup`; backfill 13/13 hóa đơn có hash, không thiếu tệp. Đối chiếu toàn bộ bản ghi accounts/transactions và số lượng bản ghi trước/sau: giữ nguyên.
- Backup COPY_ONLY/CHECKSUM đã qua RESTORE VERIFYONLY: `C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\Backup\CapitalFlow_pre_invoice_dedup_20261012_080354_9c8c9bee.bak`.
- Migration và `alembic check` đã qua trên SQL Server QA riêng `cf_invoice_dedup_qa_23f0160b6859`. Đã kiểm chứng upload/confirm đồng thời, cùng định danh ở hai bản upload và hai user độc lập.
- DB QA của lần kiểm tra ban đầu `cf_invoice_dedup_qa_8371b6fc4e52` cũng được giữ lại; không dùng làm database ứng dụng.
- Công cụ `tools/apply_invoice_dedup.py` thực hiện preflight, backup, khóa ghi, migration/backfill trong cùng transaction, đối soát tài chính và kiểm tra schema trước commit. Đã diễn tập lỗi và rollback về schema cũ trên QA `cf_invoice_dedup_qa_33091e2dbc6a` trước khi áp dụng database chính.
- Kiểm tra chỉ đọc sau commit: phát hiện trùng xử lý đủ 13 hóa đơn (12 NONE, 1 EXACT); API đang chạy công bố endpoint mới. Giữ nguyên 1 giao dịch OCR lịch sử không còn liên kết hóa đơn, không tự phỏng đoán liên kết hoặc sửa tiền.
- `tools/backfill_invoice_dedup.py` vẫn hỗ trợ dry-run và `--apply` độc lập khi writer đã dừng; từ chối nhóm đã ghi trùng hoặc liên kết bất nhất.
- Hợp đồng API, thay đổi tương thích và quy trình phát hành: `docs/api-hoa-don-chong-trung.md` tại gốc repository.

## Cập nhật ngân sách định kỳ ngày 2026-10-02

- Database chính `personal_finance` đã nâng lên `cfdb_recurring_budgets`. Năm ngân sách cũ vẫn là ngân sách có ngày cố định; không tự đổi thành định kỳ.
- Thêm `budgets.is_recurring`, `budgets.recurrence_end_date` và bảng `budget_changes` để lưu tên, hạn mức, ngưỡng, tạm dừng/tiếp tục theo ngày hiệu lực.
- Đã thử migration và `alembic check` trên SQL Server tạm `capitalflow_budget_verify_20261002_014038` (được giữ để đối chiếu).
- Đã tạo backup `COPY_ONLY` và `RESTORE VERIFYONLY` thành công: `C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\Backup\CapitalFlow_pre_recurring_budgets_20261002_014044.bak`.
- Sau nâng cấp, số bản ghi `users`, `categories`, `budgets`, `transactions`, `notifications` giữ nguyên; cả năm ngân sách cũ có `is_recurring = 0`.

## Cập nhật trung tâm thông báo ngày 2026-09-30

- Database chính `personal_finance` hiện ở revision `cfdb_notifications`.
  Migration thêm bảng `notifications` (gắn với `users`, có loại, mức độ,
  nguồn phát sinh, liên kết điều hướng, thời điểm đọc và khóa chống trùng).
- Trước khi nâng, bản sao lưu `COPY_ONLY` đã vượt `RESTORE VERIFYONLY`:
  `C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\Backup\CapitalFlow_pre_notifications_20260930_083310.bak`.
- Đối chiếu trước/sau nâng: `accounts` 18, `transactions` 187; một thông báo
  cũ trong `accounts.savings_state` được chuyển sang bảng mới, giữ trạng thái
  đã đọc nếu có. JSON cũ chưa bị xóa bởi migration để giữ khả năng đối chiếu.
- Đã thử migration và `alembic check` trên SQL Server tạm
  `capitalflow_notification_verify_20260930_082723`. Database kiểm chứng
  được giữ lại, chưa xóa.
- Các phần bên dưới là lịch sử của các đợt baseline và ví mô phỏng; không
  phản ánh revision mới nhất nếu đọc riêng lẻ.

## Cập nhật ví và ngân hàng mô phỏng ngày 2026-09-29

- Database chính `personal_finance` đã nâng từ `cfdb_20260924_baseline` lên
  `cfdb_wallet_demo` sau khi migration được thử trên SQL Server tạm theo chuỗi
  nâng → hạ → nâng và backup `COPY_ONLY` qua `RESTORE VERIFYONLY`.
- Số bản ghi sau nâng giữ nguyên: `accounts` 12, `transactions` 176.
- Bổ sung 7 cột `accounts`, 1 cột `transactions` và unique index có điều kiện
  cho tham chiếu giao dịch ngân hàng; không thêm bảng và không xóa dữ liệu cũ.
- `alembic current` báo `cfdb_wallet_demo (head)`; `alembic check` không phát hiện
  thay đổi schema còn thiếu.
- Các mục kiểm kê phía dưới ghi lại đợt baseline ngày 24/09 để đối chiếu lịch sử.

## Nguồn kiểm kê

- SQL Server: `localhost\SQLEXPRESS`.
- Database: `personal_finance`.
- Ngày kiểm kê: 2026-09-24.
- 20 bảng vật lý tại thời điểm kiểm kê ban đầu, gồm 17 bảng nghiệp vụ,
  `alembic_version`, `schema_migrations` và `sysdiagrams`. Sau khi chuyển đổi,
  bảng version legacy đã được dọn nên database còn 19 bảng vật lý.
- 259 cột trên toàn database tại thời điểm kiểm kê trước khi dọn bảng legacy.

Hai bảng không thuộc baseline nghiệp vụ mới:

- `alembic_version`: bảng version do Alembic quản lý.
- `sysdiagrams`: metadata sơ đồ do SQL Server Management Studio tạo.

## Trạng thái version hiện tại

- Alembic cũ: `da10f25d5743` — baseline đánh dấu rỗng, không dựng schema.
- Hệ migration cũ từng ghi nhận chín version, từ
  `20260910_financial_integrity` tới `20260918_worker_lane_index`; lịch sử đã
  chuyển vào archive và bảng `dbo.schema_migrations` đã được xóa sau khi duyệt.

## Đối chiếu ORM và database

SQLAlchemy metadata đăng ký đủ 17 bảng nghiệp vụ. Lần kiểm tra đầu phát hiện 66
khác biệt khi so sánh trực tiếp. Các nhóm chính:

- SQL Server phản chiếu `DATETIME2`, `CHAR`, `BIT` và kiểu UUID cụ thể hơn khai
  báo ORM tổng quát.
- Một số index production có nhiều cột hoặc `INCLUDE` khác index trong model.
- Một số khóa ngoại production có tên và chính sách `ON DELETE` không được mô
  tả đầy đủ trong model.
- Các bảng điều khiển migration và `sysdiagrams` không thuộc ORM.

Baseline mới được xuất từ schema SQL Server thực tế. Thay vì tự động áp 66 thay
đổi nguy hiểm vào database, metadata ORM đã được hiệu chỉnh để mô tả đúng kiểu
tương đương, index và khóa ngoại đang vận hành. Sau hiệu chỉnh,
`alembic check` không còn đề xuất upgrade operation nào; database thật không bị
chạy DDL trong quá trình đồng bộ này.

## Kết quả chuyển baseline ngày 2026-09-24

- Backup `COPY_ONLY` đã chạy `RESTORE VERIFYONLY` thành công trước khi chuyển.
- Baseline mới dựng đủ 17 bảng trên database kiểm chứng SQL Server.
- Chữ ký bảng, cột, khóa chính/ngoại, index và check constraint: 0 sai khác.
- Seed tạo thành công 16 danh mục hệ thống trên database kiểm chứng.
- `/health` và `/ready`: HTTP 200; OpenAPI có 58 path.
- Pytest API: 97 test đạt, còn một cảnh báo deprecation từ Starlette.
- `personal_finance` đã được stamp sang `cfdb_20260924_baseline`.
- Checksum schema và tổng 1.385 bản ghi nghiệp vụ không đổi trước/sau stamp.

Ba database kiểm chứng đã hoàn thành nhiệm vụ và được xóa sau khi chủ dự án duyệt:

- `capitalflow_baseline_verify_20260924`: bản thử đầu, thiếu CHECK constraint.
- `capitalflow_baseline_verify_20260924_v2`: baseline đầy đủ trước khi thêm cầu nối legacy.
- `capitalflow_baseline_verify_20260924_v3`: baseline đầy đủ cuối cùng, 0 sai khác.

Sau khi dọn, `personal_finance` còn đúng 17 bảng nghiệp vụ, 1.385 bản ghi nghiệp
vụ và version Alembic `cfdb_20260924_baseline`. Bản backup `COPY_ONLY` đã xác
minh vẫn là phương án khôi phục cho trạng thái trước chuyển đổi.

## Bảng nghiệp vụ trong baseline

- `accounts`
- `audit_logs`
- `background_jobs`
- `budgets`
- `categories`
- `email_logs`
- `idempotency_records`
- `invoice_items`
- `invoices`
- `ocr_jobs`
- `password_reset_otps`
- `refresh_tokens`
- `system_settings`
- `transactions`
- `user_deletion_files`
- `user_deletion_requests`
- `users`

Bảng legacy có thể khôi phục từ archive hoặc bản backup đã xác minh:
C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\Backup\CapitalFlow_pre_alembic_20260924_091601.bak
