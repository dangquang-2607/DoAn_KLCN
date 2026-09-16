# CapitalFlow

CapitalFlow là hệ thống quản lý tài chính gồm FastAPI API, background worker,
cổng người dùng Next.js và cổng quản trị React/Vite. Dữ liệu được lưu trên
Microsoft SQL Server; OCR chạy qua Gemini trong hàng đợi nền.

Xem [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) để tra cứu toàn bộ file
first-party và mục đích của từng file.

## Thành phần và cổng mặc định

| Thành phần | URL | Vai trò |
|---|---|---|
| API | `http://localhost:8000` | REST API, `/docs`, `/health`, `/ready` |
| User Web | `http://localhost:3010` | Tài khoản, giao dịch, ngân sách và OCR |
| Admin Web | `http://localhost:5173` | Người dùng, danh mục, audit và vận hành |
| Worker | Không mở HTTP | Email, OCR và purge người dùng |

## Yêu cầu

- Python 3.12 và Node.js 20.
- Microsoft SQL Server với hostname/FQDN, TCP port và database rõ ràng.
- Microsoft ODBC Driver 18 for SQL Server.
- Chứng chỉ SQL Server có chuỗi CA được máy chạy API/worker tin cậy.
- Docker Desktop nếu chạy bằng container.

## Cấu hình backend

```powershell
cd capitalflow-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Thay mọi placeholder trong `.env`. `DATABASE_URL` production phải dùng ODBC 18,
`Encrypt=yes` và `TrustServerCertificate=no`. Không commit `.env`, khóa Fernet,
JWT secret, mật khẩu SMTP hoặc thông tin đăng nhập SQL Server.

API và worker phải dùng cùng `DATABASE_URL`, `JOB_ENCRYPTION_KEY` và
`UPLOAD_DIR`. `JOB_ENCRYPTION_KEY` phải là Fernet key hợp lệ và được sao lưu
cùng dữ liệu hàng đợi.

## Migration và seed

```powershell
.\.venv\Scripts\python.exe -m scripts.migrate_financial_integrity --apply
.\.venv\Scripts\python.exe -m scripts.migrate_resilience --apply
.\.venv\Scripts\python.exe -m scripts.migrate_user_deletion --apply
```

`scripts/seed.py` luôn seed danh mục hệ thống. Script chỉ bootstrap system admin
khi cả `CAPITALFLOW_BOOTSTRAP_ADMIN_EMAIL` và
`CAPITALFLOW_BOOTSTRAP_ADMIN_PASSWORD` được cấp từ secret store hoặc phiên
terminal. Không có tài khoản hoặc mật khẩu admin mặc định trong source code.

```powershell
.\.venv\Scripts\python.exe -m scripts.seed
```

## Chạy local

Mở bốn terminal:

```powershell
# Backend API
cd capitalflow-api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# Background worker
cd capitalflow-api
.\.venv\Scripts\python.exe -m app.services.worker

# User Web
cd frontend/user-web
npm ci
npm run dev

# Admin Web
cd frontend/admin-web
npm ci
npm run dev
```

Worker là tiến trình bắt buộc cho email, OCR và hard-delete. Nếu worker dừng,
API vẫn phục vụ các nghiệp vụ đồng bộ nhưng job sẽ giữ trạng thái chờ.

## Docker

Hai frontend được build từ Compose ở thư mục gốc:

```powershell
docker compose config --quiet
docker compose build
docker compose up -d
```

API và worker dùng Compose riêng để không tự ý tạo hoặc thay đổi SQL Server:

```powershell
cd capitalflow-api
$env:CAPITALFLOW_ENV_FILE = '.env.docker'
docker compose config --quiet
docker compose build
docker compose up -d
```

Tạo `.env.docker` từ `.env.docker.example`. Có thể dùng SQL Authentication đã
được cấp sẵn hoặc Kerberos với ODBC 18. Compose không tạo SQL login, không bật
mixed authentication và không hạ kiểm tra TLS.

## Kiểm thử

```powershell
cd capitalflow-api
.\.venv\Scripts\python.exe -m compileall -q app scripts tests
.\.venv\Scripts\python.exe -m pytest -q

cd ..\frontend\user-web
npm run typecheck
npm test -- --run
npm run build

cd ..\admin-web
npm run lint
npm run build
```

Sau khi build backend image, smoke-test production artifact:

```powershell
cd capitalflow-api
.\.venv\Scripts\python.exe -m scripts.verify_docker
```

## Chẩn đoán triển khai

```powershell
cd capitalflow-api
.\.venv\Scripts\python.exe -m scripts.diagnose_deployment
```

Chỉ triển khai khi lệnh trả `ready: true`. Không xử lý lỗi chứng chỉ bằng cách
bật `TrustServerCertificate=yes`; hãy cài đúng CA, hostname và certificate.

Runbook chi tiết:

- [Docker và SQL Server](capitalflow-api/docs/docker-sql-server.md)
- [Toàn vẹn tài chính](capitalflow-api/docs/financial-integrity-release.md)
- [Khả năng phục hồi](capitalflow-api/docs/resilience-release.md)
- [Xóa người dùng](capitalflow-api/docs/user-deletion-release.md)

## Quy tắc repository

- Không commit dump CSDL, ảnh hóa đơn, email preview, `.env`, cache hoặc build output.
- `frontend/shared/` là nguồn chuẩn của `Motion.jsx`, `Toast.jsx` và `swiss.css`.
  Sau khi sửa, chạy `node frontend/shared/sync-design.mjs` rồi kiểm tra diff.
- `insert_dummy_data.sql` chỉ dành cho dữ liệu phát triển và được giữ theo chủ đích.
