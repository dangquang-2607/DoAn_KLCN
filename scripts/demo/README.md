# Demo trên laptop Windows

Phương án đã chọn: API và SQL Express chạy trên Windows (Windows Authentication), user/admin web chạy Docker. Chỉ mở cổng loopback; không phải cấu hình để công khai Internet.

DB riêng: `CapitalFlow_QA_20261008_b5fcca32`, đã tạo trong kiểm thử SQL. Không dùng `personal_finance`. DB này dùng DDL models hiện tại, không chứng nhận migration production. Không xóa DB khi tắt demo.

## Chuẩn bị một lần

Từ thư mục gốc bằng PowerShell:

```powershell
.\capitalflow-api\.venv\Scripts\python.exe scripts/demo/prepare.py
.\capitalflow-api\.venv\Scripts\python.exe scripts/demo/seed.py
```

`prepare.py` tạo `.demo.local.json` bị Git ignore, khóa riêng, SMTP/AI tắt. Không ghi đè khi file đã có. Giữ file này tại máy; không chia sẻ, không commit. Tệp upload nằm riêng trong `demo-uploads/`.

## Chạy

Terminal 1:

```powershell
.\capitalflow-api\.venv\Scripts\python.exe scripts/demo/run_api.py
```

Terminal 2 (Docker Desktop đang chạy):

```powershell
$env:DEMO_VERSION = git rev-parse --short HEAD
docker compose -f compose.demo.yml build
docker compose -f compose.demo.yml up -d --no-build
```

- User: http://localhost:3028 — `demo-user@example.com`.
- Admin: http://localhost:4028 — `demo-admin@example.com`.
- Mật khẩu tài khoản demo tổng hợp: `QA-local-only-2026!`. Không dùng mật khẩu này cho dữ liệu thật.
- API readiness: http://localhost:8028/ready.

Các biến API frontend được đóng vào image lúc build. Không dùng tag mới để ngụ ý image cũ chứa mã mới; phải build trước `up`.

## Giới hạn an toàn

Không tự khởi động worker khi chạy demo này. SMTP/AI đã tắt để tránh xử lý nhầm hàng đợi hoặc gửi thư/tiêu quota. Muốn demo OCR/email thật cần cấu hình riêng và xác nhận người nhận/phạm vi trước khi mở worker; không chạy worker cấu hình production để thay thế. Các ca live OCR/email có bằng chứng riêng trong thư mục QA.

## Dừng

```powershell
docker compose -f compose.demo.yml down
```

Nhấn Ctrl+C ở terminal API. Lệnh này không xóa DB, dữ liệu hay thư viện. Không dùng `down -v`/xóa DB để dọn mà chưa sao lưu và xác nhận.

Bản bàn giao chỉ được coi là đã kiểm thử sau khi có commit hash cùng kết quả suite/build/smoke; tài liệu này tự nó không phải chứng nhận.

## Kiểm chứng đúng commit

Sau khi commit mã nguồn và chạy API ở terminal riêng:

```powershell
.\scripts\demo\verify.ps1
```

Script từ chối working tree còn thay đổi; chạy suite/lint/typecheck/audit runtime, build và khởi động image gắn 12 ký tự commit, kiểm tra HTTP trên SQL QA thật. Bằng chứng nằm tại `qa/release-runs/<commit>/<timestamp>/` (Git ignore để không làm thay đổi commit đang kiểm chứng). `verification.json` chỉ hoàn tất nếu mọi bước đạt. Ảnh UI bổ sung cần lưu cùng mốc này. Không dùng `-SkipBuild` nếu image đúng commit chưa tồn tại.

Script không kiểm thử toàn bộ UI, không gửi email, không gọi OCR và không thay thế benchmark OCR/Flutter. User web còn cảnh báo dev-only trong chuỗi lint `braces`; không chạy `npm audit fix --force` vì npm đề xuất hạ major cấu hình lint. `npm audit --omit=dev` bằng 0 không đồng nghĩa chứng nhận bảo mật toàn hệ thống.
