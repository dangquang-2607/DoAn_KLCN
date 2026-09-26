# Lịch sử trước baseline 2026-09

Thư mục này lưu dấu vết của hệ migration cũ trước khi Alembic đầy đủ trở thành
nguồn quản lý schema. Nội dung chỉ dùng để kiểm toán hoặc điều tra lịch sử,
không phải lệnh triển khai hiện hành.

- `sql/`: tám migration đã áp dụng và script dựng schema legacy có tính phá hủy.
- `runners/`: wrapper Python cũ dùng `dbo.schema_migrations`.
- `alembic_legacy/`: baseline Alembic rỗng trước khi chuyển đổi.

Không chạy trực tiếp bất kỳ file nào trong archive. Database mới phải được dựng
bằng `capitalflow-database/alembic`. Database hiện tại đã được stamp sang
`cfdb_20260924_baseline` sau khi backup, kiểm chứng schema và chạy test API.

