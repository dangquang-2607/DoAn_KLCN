# CapitalFlow

CapitalFlow là hệ thống quản lý tài chính gồm FastAPI API, background worker,
cổng người dùng Next.js và cổng quản trị React/Vite. Dữ liệu được lưu trên
Microsoft SQL Server; OCR chạy qua Gemini trong hàng đợi nền.

Xem [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) để tra cứu toàn bộ file
first-party và mục đích của từng file.

Phần nghiệm thu/demo được gom vào [nghiem_thu/](nghiem_thu/README.md):
báo cáo và DB QA, script demo, Compose demo và cấu hình local riêng.
Lệnh chạy API/worker/frontend thông thường không đổi. Không dùng API QA giả lập
ở cổng 8018 làm backend cho dữ liệu thật. Hướng dẫn demo Docker trên laptop:
[nghiem_thu/scripts/demo/README.md](nghiem_thu/scripts/demo/README.md).

Hai giao diện được tổ chức theo sidebar trong `src/chuc-nang/`, còn phần dùng
chung nằm tại `src/dung-chung/`. Xem [hướng dẫn frontend](frontend/README.md)
để tìm từng tab, CSS và quy trình đồng bộ giao diện.

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
pip install -r ..\capitalflow-database\requirements.txt
Copy-Item .env.example .env
```

Dependency Alembic được khai báo trong `capitalflow-database/requirements.txt`,
không nằm trong dependency production của FastAPI. Image API/worker vì vậy chỉ
chứa thư viện runtime và không mang công cụ thay đổi schema.

Thay mọi placeholder trong `.env`. `DATABASE_URL` production phải dùng ODBC 18,
`Encrypt=yes` và `TrustServerCertificate=no`. Không commit `.env`, khóa Fernet,
JWT secret, mật khẩu SMTP hoặc thông tin đăng nhập SQL Server.

API và worker phải dùng cùng `DATABASE_URL`, `JOB_ENCRYPTION_KEY` và
`UPLOAD_DIR`. `JOB_ENCRYPTION_KEY` phải là Fernet key hợp lệ và được sao lưu
cùng dữ liệu hàng đợi.

## Database migration và seed

Schema SQL Server được quản lý trong project `capitalflow-database`, tách khỏi
runtime FastAPI. Migration không tự chạy khi API hoặc worker khởi động.

```powershell
cd capitalflow-api
.\.venv\Scripts\python.exe -m alembic -c ..\capitalflow-database\alembic.ini current
.\.venv\Scripts\python.exe -m alembic -c ..\capitalflow-database\alembic.ini upgrade head
```

`capitalflow-database/tools/seed.py` luôn seed danh mục hệ thống. Script chỉ bootstrap system admin
khi cả `CAPITALFLOW_BOOTSTRAP_ADMIN_EMAIL` và
`CAPITALFLOW_BOOTSTRAP_ADMIN_PASSWORD` được cấp từ secret store hoặc phiên
terminal. Không có tài khoản hoặc mật khẩu admin mặc định trong source code.

```powershell
.\.venv\Scripts\python.exe -B ..\capitalflow-database\tools\seed.py
```

## Chạy local

Mở bốn terminal:

```powershell
# Backend API
cd capitalflow-api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# Worker chạy nền (xử lý tất cả loại job khi phát triển local)
cd capitalflow-api
.\.venv\Scripts\python.exe -m app.dung_chung.tac_vu_nen.trinh_chay

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

## Kiểm tra build

```powershell
cd capitalflow-api
.\.venv\Scripts\python.exe -m compileall -q app scripts

cd ..\frontend\user-web
npm run typecheck
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
