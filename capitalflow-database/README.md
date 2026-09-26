# CapitalFlow Database

Project này là nguồn quản lý cấu trúc SQL Server của CapitalFlow, tách biệt khỏi
mã nguồn FastAPI. Alembic là công cụ duy nhất được định hướng để quản lý phiên
bản schema sau khi giai đoạn chuyển đổi hoàn tất.

## Nguyên tắc an toàn bắt buộc

- Không tự động chạy migration khi API hoặc worker khởi động.
- Không thực thi `DROP`, `TRUNCATE`, `DELETE` hàng loạt, đổi kiểu dữ liệu có
  nguy cơ mất dữ liệu hoặc migration không thể rollback nếu chưa có xác nhận rõ
  ràng của chủ dự án.
- Trước thao tác phá hủy phải có: phạm vi ảnh hưởng, số bản ghi, dependency,
  bản sao lưu, câu lệnh dự kiến, phương án rollback và kết quả preflight.
- Migration phải được kiểm tra trên CSDL tạm trước khi áp dụng vào
  `personal_finance`.
- Không đưa dữ liệu người dùng, credential hoặc secret vào Git.

## Vai trò của các thành phần

- `alembic/versions/`: một revision cho mỗi đợt phát hành CSDL, không tạo một
  revision cho từng sửa lỗi nhỏ.
- `alembic/env.py`: kết nối Alembic với cấu hình và metadata ORM của API.
- `tools/export_live_baseline.py`: xuất baseline tự chứa từ schema SQL Server
  đang chạy; không đọc hoặc xuất dữ liệu nghiệp vụ.
- `CURRENT_SCHEMA.md`: báo cáo dễ đọc về schema, version và các sai khác cần xử
  lý trước khi Alembic trở thành nguồn duy nhất.

## Lệnh vận hành

Chạy từ thư mục `capitalflow-database`, sử dụng môi trường Python của API:

```powershell
..\capitalflow-api\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\capitalflow-api\.venv\Scripts\python.exe -m alembic current
..\capitalflow-api\.venv\Scripts\python.exe -m alembic history
..\capitalflow-api\.venv\Scripts\python.exe -m alembic upgrade head
```

Biến `DATABASE_URL` có thể được đặt tạm để trỏ tới CSDL kiểm chứng. Không lưu URL
có credential trong repository.

Trước khi tạo revision mới, bắt buộc kiểm tra metadata đang sạch:

```powershell
..\capitalflow-api\.venv\Scripts\python.exe -m alembic check
```

Mỗi đợt phát hành chỉ tạo một revision sau khi đã gom các thay đổi liên quan:

```powershell
..\capitalflow-api\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "release_YYYY_MM"
```

Revision sinh tự động chỉ là bản nháp. Phải đọc lại toàn bộ DDL, bổ sung
preflight/rollback và xin xác nhận nếu có thao tác phá hủy trước khi chạy
`upgrade head` trên database thật.

## Trạng thái chuyển đổi

Baseline mới đã dựng thành công database kiểm chứng, đối chiếu đủ 17 bảng và
vượt toàn bộ test API. SQL cùng wrapper cũ đã chuyển vào
`archive/pre_baseline_202609`; chúng chỉ còn giá trị kiểm toán và không phải lệnh
vận hành hiện hành. Sau khi được chủ dự án duyệt, bảng
`dbo.schema_migrations` và ba database kiểm chứng đã được xóa; chỉ
`dbo.alembic_version` còn quản lý version schema.
