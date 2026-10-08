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

## Ba loại ví và kết nối ngân hàng mô phỏng

Revision `cfdb_wallet_demo` thêm cột cho mục tiêu tiết kiệm, trạng thái liên kết
ngân hàng mô phỏng và mã tham chiếu giao dịch ngân hàng. Revision đã được kiểm
chứng trên database tạm trước khi áp dụng. Chức năng này không kết nối tới ngân
hàng thật; không nhập thông tin ngân hàng thật vào giao diện mô phỏng.

Đường hạ migration từ `cfdb_wallet_demo` sẽ từ chối nếu đã có dữ liệu trong các
trường ví mới hoặc giao dịch ngân hàng, để tránh mất dữ liệu. Khi đó cần giữ
schema hoặc khôi phục từ bản sao lưu đã kiểm chứng.

## Ngân sách định kỳ

Revision `cfdb_recurring_budgets` giữ nguyên các ngân sách có khoảng ngày cố
định, bổ sung cấu hình tuần/tháng/năm lặp tự động và lịch thay đổi hạn mức,
ngưỡng, tạm dừng/tiếp tục theo ngày hiệu lực. Tiến độ và lịch sử kỳ được tính
từ giao dịch; không cần job tạo thêm ngân sách mỗi tháng. Migration đã được kiểm
chứng trên SQL Server tạm; nâng database chính với backup và đối chiếu bằng
`tools/apply_recurring_budgets.py`. Database chính đã
nâng ngày 02/10/2026; vị trí backup và database thử ghi ở `CURRENT_SCHEMA.md`.

## Trung tâm thông báo chung

Revision `cfdb_notifications` tạo bảng `notifications` tách khỏi JSON của ví.
Migration chuyển thông báo tiết kiệm cũ sang bảng mới, bảo toàn thời điểm đọc;
JSON cũ vẫn còn trong tài khoản để kiểm tra lịch sử. Bảng mới hỗ trợ thông báo
biến động ví, mục tiêu tiết kiệm, ngưỡng ngân sách, khoản chi bất thường, trạng
thái kết nối ngân hàng demo và sự kiện bảo mật tài khoản. API chỉ trả dữ liệu
của người dùng đăng nhập; mỗi mục được đánh dấu đã đọc khi người dùng bấm vào.

`tools\apply_notifications.py` là quy trình nâng cấp một lần cho
`personal_finance` từ đúng revision `cfdb_wallet_demo`: kiểm tra dữ liệu cũ,
tạo backup `COPY_ONLY`, chạy `RESTORE VERIFYONLY`, nâng schema rồi đối chiếu số
ví/giao dịch và thông báo. Database chính đã được nâng vào 30/09/2026; không
chạy lại script trên trạng thái hiện tại. Đường hạ migration sẽ từ chối nếu
bảng thông báo có dữ liệu, để không làm mất lịch sử người dùng.

## Trạng thái chuyển đổi

Baseline mới đã dựng thành công database kiểm chứng, đối chiếu đủ 17 bảng và
vượt toàn bộ test API. SQL cùng wrapper cũ đã chuyển vào
`archive/pre_baseline_202609`; chúng chỉ còn giá trị kiểm toán và không phải lệnh
vận hành hiện hành. Sau khi được chủ dự án duyệt, bảng
`dbo.schema_migrations` và ba database kiểm chứng đã được xóa; chỉ
`dbo.alembic_version` còn quản lý version schema.
