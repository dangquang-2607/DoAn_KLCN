# Vận hành bản sửa bảo mật và khả năng phục hồi

## Migration và khóa mã hóa

Chạy từ thư mục `capitalflow-api`, dùng cùng cấu hình với API:

```powershell
.\.venv\Scripts\python.exe -m scripts.migrate_financial_integrity --apply
.\.venv\Scripts\python.exe -m scripts.migrate_resilience --apply
.\.venv\Scripts\python.exe -m scripts.verify_financial_integrity
.\.venv\Scripts\python.exe -m scripts.verify_concurrent_money
```

Migration resilience tạo bảng chống lặp và hàng đợi, mở rộng cột OTP để lưu HMAC, vô hiệu hóa OTP cũ, mã hóa mật khẩu SMTP đã lưu và thêm chỉ mục báo cáo. Mặc định không có `--apply` thì rollback. Đã áp dụng migration này trên SQL Server cấu hình trong workspace; lần chạy lại trả `already_applied`.

`JOB_ENCRYPTION_KEY` là khóa Fernet riêng, bắt buộc có cùng giá trị trên API và mọi worker. Khóa đã được tạo trong `.env` cục bộ, không được đưa vào Git hoặc image Docker. Sao lưu khóa cùng bản sao lưu CSDL bằng hệ thống quản lý secret. Đổi hoặc làm mất khóa khi còn job chưa chạy sẽ khiến payload và mật khẩu SMTP không giải mã được. Không tự sinh khóa mới mỗi lần khởi động.

## Worker

Chạy API và worker thành hai tiến trình được giám sát, cùng CSDL và thư mục upload:

```powershell
.\.venv\Scripts\python.exe -m app.services.worker
```

Compose có service `capitalflow-worker`; PostgreSQL cũ nằm trong profile `legacy-postgres`, không còn là phụ thuộc mặc định của API dùng SQL Server. Image đã bổ sung ODBC Driver 18; cần cấu hình SQL Server truy cập được từ container và đường dẫn upload dùng chung. Ngày 2026-09-11 đã build thành công cả hai image trên Docker Desktop Linux. Dependency check, 62 test backend, worker CLI với hàng đợi rỗng và HTTP `/health`, `/ready`, `/openapi.json` đều qua với SQLite cô lập và mạng bị chặn.

Không chạy worker thật trong kiểm thử tự động: worker có thể gửi email và gọi Gemini. Các kiểm thử dùng CSDL riêng và chặn mạng. Hàng đợi chỉ được xử lý khi worker hoạt động; chạy API đơn lẻ sẽ để email/OCR ở trạng thái chờ.

Job được lưu cùng transaction nghiệp vụ, có lease 180 giây, token kiểm tra quyền ghi kết quả, tối đa 3 lần thực thi, thời gian chờ tăng dần và trạng thái `DEAD`. Payload được mã hóa, xóa khỏi job hoàn tất; lỗi chỉ lưu tên loại exception. Theo dõi số job `DEAD`, job chờ lâu, lease quá hạn và dung lượng upload. Không tự động phát lại job `DEAD` có nội dung email nhạy cảm; kiểm tra nguyên nhân và hiệu lực OTP trước khi phục hồi.

SMTP có cơ chế giao ít nhất một lần: nếu nhà cung cấp đã nhận email nhưng worker chết trước khi ghi nhận thành công, email có thể được gửi lại. Hệ thống không cam kết gửi đúng một lần. OCR có deadline 90 giây; không giữ connection SQL trong lúc gọi nhà cung cấp.

## Hợp đồng API

POST/PATCH/DELETE ví và giao dịch yêu cầu `Idempotency-Key` dài 8–128 ký tự chữ/số, `-` hoặc `_`. Gửi lại cùng key và cùng nội dung trả kết quả cũ; nội dung khác trả 409; thiếu key trả 428. Khóa và kết quả được commit cùng biến động số dư. User-web giữ khóa khi mất phản hồi và đổi khóa sau khi nhận thành công. Client tích hợp khác phải làm tương tự.

OCR trả 202 khi đã xếp hàng; client polling trạng thái hóa đơn. Đổi/đặt lại mật khẩu thu hồi access/refresh token cũ; frontend chuyển về đăng nhập. Trang đăng nhập/đăng ký được giữ nguyên.

## Giới hạn xác minh và việc còn cần triển khai

- Chưa có kiểm thử tải 500 request/giây hoặc đo dữ liệu lớn gấp 20 lần; các con số đó chưa được cam kết. SQL connection có thời hạn kết nối 5 giây, chờ pool 5 giây, chờ khóa 5 giây và query timeout 10 giây cho pyodbc; đây không phải SLA 5 giây đầu cuối.
- SQL Server và volume upload vẫn là điểm phụ thuộc cần cấu hình HA, backup và diễn tập khôi phục ở hạ tầng.
- Rate limiter hiện lưu bộ đếm theo tiến trình. Trước khi chạy nhiều API replica cần kho đếm chung hoặc giới hạn tại gateway; giới hạn hàng đợi đã được đồng bộ bằng SQL Server.
- Token vẫn ở sessionStorage; cần đợt chuyển sang cookie HttpOnly/CSRF và rà soát CSP riêng nếu yêu cầu giảm tác động XSS. Chưa sửa giao diện đăng nhập theo ràng buộc hiện tại.
- Upload bị ngắt do tiến trình chết sau khi ghi file nhưng trước commit có thể để lại file mồ côi. Không xóa tự động file ngoài transaction khi chưa xác minh chính sách lưu trữ và tiến trình đang ghi.
- Đã kiểm chứng 4 connection SQL Server đồng thời gửi 40 yêu cầu cho 20 chuyển khoản: mỗi chuyển khoản chỉ có một cặp bút toán và số dư cuối đúng. Script tạo user thử riêng rồi xóa toàn bộ dữ liệu thử trong `finally`. Chưa kiểm chứng khôi phục sau sự cố máy thật; bài test này không thay thế kiểm thử tải 500 request/giây.

Không coi danh sách kiểm thử đã qua là chứng nhận đã loại bỏ mọi lỗ hổng của toàn dự án.


## Kết quả kiểm chứng Docker ngày 2026-09-11

Chạy lại từ thư mục capitalflow-api:

```powershell
docker compose config --quiet
docker compose build
.\.venv\Scripts\python.exe -m scripts.verify_docker
```

Script dùng credentials thử ngẫu nhiên, SQLite riêng và `--network none`, tự xóa container kiểm tra API. Không tiêu thụ hàng đợi thật hoặc gửi email. Image không chứa `.env` và `.venv`; ODBC Driver 18 tải được. Không có dependency Python bị thiếu hoặc xung đột theo `pip check`.

Kết nối TCP từ container tới SQL Server trên host đã qua tại `host.docker.internal:53588`. Đây là cổng động hiện tại của SQLEXPRESS, có thể đổi khi dịch vụ khởi động lại. Cần cổng TCP ổn định khi triển khai.

Cấu hình local dùng `localhost\SQLEXPRESS`, ODBC 17 và `Trusted_Connection`. Container Linux hiện có ODBC 18 và chưa cấu hình Kerberos, nên chưa đăng nhập CSDL thật được bằng cấu hình local này. Kết quả `/ready` với SQLite không chứng minh quyền SQL Server sản xuất đã được cấu hình.

Để chạy với SQL Server thật, tạo `.env.docker` riêng với cùng `JOB_ENCRYPTION_KEY`, `UPLOAD_DIR=/app/uploads`, URL dùng hostname/cổng truy cập được và driver ODBC 18. Sử dụng SQL Authentication được cấp sẵn hoặc cấu hình Kerberos đầy đủ. Percent-encode mật khẩu trong URL; không đưa secret vào command line. Không tự bật mixed authentication, tạo SQL login hay hạ TLS để vượt lỗi kết nối.

Chọn file cấu hình riêng, giữ nguyên `.env` local:

```powershell
$env:CAPITALFLOW_ENV_FILE = '.env.docker'
docker compose config --quiet
```

Chưa chạy API/worker lâu dài với CSDL thật. Worker thật có thể gửi email và gọi Gemini ngay khi được khởi động.
