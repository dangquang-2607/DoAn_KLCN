# Triển khai tính năng xóa tài khoản người dùng

Tính năng dùng hai luồng độc lập:

- **Xóa mềm** vô hiệu hóa tài khoản, thu hồi token, thay email bằng alias nội bộ và giữ email gốc ở dạng mã hóa để có thể khôi phục.
- **Xóa vĩnh viễn** khóa tài khoản ngay và tạo `USER_PURGE`. Worker xóa dữ liệu trong một transaction theo đúng thứ tự khóa ngoại, sau đó xóa file bằng `USER_FILE_PURGE`. File chỉ bị xóa sau khi transaction cơ sở dữ liệu đã commit.

## Migration SQL Server

Chạy kiểm tra có rollback trước:

```powershell
cd capitalflow-api
.\.venv\Scripts\python.exe -m scripts.migrate_user_deletion
```

Kết quả mong đợi là `validated_and_rolled_back`. Sau đó áp dụng:

```powershell
.\.venv\Scripts\python.exe -m scripts.migrate_user_deletion --apply
```

Lần chạy tiếp theo phải trả về `already_applied`. Migration không tạo tài khoản SQL, không đổi chế độ xác thực và không chứa secret.

API và worker phải dùng cùng `DATABASE_URL`, `JOB_ENCRYPTION_KEY` và vùng lưu trữ `UPLOAD_DIR`. Với Docker Compose, API và worker đã cùng mount volume `capitalflow_uploads`.

## Trạng thái vận hành

Luồng xóa vĩnh viễn đi qua các trạng thái `PENDING`, `RUNNING`, `FILES_PENDING`, rồi `COMPLETE`. Khi thất bại ba lần, trạng thái chuyển thành `FAILED` và lưu mã lỗi không chứa payload hay thông tin nhạy cảm.

Admin có thể xem tiến độ qua `GET /api/v1/admin/user-deletions/{request_id}`. Giao diện quản trị hiển thị nút thử lại. Backend tách hai trường hợp:

- `POST /api/v1/admin/user-deletions/{request_id}/retry-purge` khi transaction cơ sở dữ liệu chưa hoàn tất.
- `POST /api/v1/admin/user-deletions/{request_id}/retry-files` khi cơ sở dữ liệu đã purge nhưng còn file lỗi.

Không khôi phục tài khoản ở trạng thái `PURGE_PENDING`. Xóa hàng loạt chỉ hỗ trợ xóa mềm để hạn chế phạm vi của một thao tác quản trị.

## Kiểm tra trước phát hành

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m scripts.diagnose_deployment
```

Chẩn đoán production chỉ đạt khi có migration `20260914_user_deletion`, ODBC 18, TLS xác minh chứng chỉ, kết nối SQL Server và storage dùng chung ghi/đọc được. Worker phải chạy liên tục; nếu worker dừng, tài khoản vẫn bị khóa nhưng yêu cầu purge giữ ở hàng đợi cho tới khi worker hoạt động lại.

Nhật ký nghiệp vụ được giữ nhưng IP, user-agent và các JSON gắn với người bị xóa được xóa nội dung. Recipient trong email log được thay bằng địa chỉ redacted. Chính sách retention cho log, backup và bản sao lưu storage vẫn phải được cấu hình ở hạ tầng theo yêu cầu pháp lý của đơn vị vận hành.
