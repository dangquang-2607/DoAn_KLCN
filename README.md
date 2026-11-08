# CapitalFlow

CapitalFlow là hệ thống quản lý tài chính gồm FastAPI API, background worker,
cổng người dùng Next.js và cổng quản trị React/Vite. Dữ liệu được lưu trên
Microsoft SQL Server; OCR chạy qua Gemini trong hàng đợi nền.

Xem [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) để tra cứu toàn bộ file
first-party và mục đích của từng file.

Database chính trên máy phát triển là `personal_finance`. Các bộ kiểm tra hiện
có nằm trong `capitalflow-api/tools/` và `tools/` của từng frontend. Một số công
cụ backend có thể tạo database QA hoặc dữ liệu thử; cần đọc phạm vi và điều kiện
của từng công cụ trước khi chạy. Không tự tạo thêm file test, dữ liệu giả, báo cáo
nghiệm thu hoặc database QA khi chưa được chủ dự án yêu cầu.
Chủ dự án tự khởi chạy API/worker/frontend; hướng dẫn nằm bên dưới.

Hai giao diện được tổ chức theo sidebar trong `src/chuc-nang/`, còn phần dùng
chung nằm tại `src/dung-chung/`. Xem [hướng dẫn frontend](frontend/README.md)
để tìm từng tab, CSS và quy trình đồng bộ giao diện.

## Thành phần và cổng mặc định

| Thành phần | URL | Vai trò |
|---|---|---|
| API | `http://localhost:8000` | REST API, `/docs`, `/health`, `/ready` |
| User Web | `http://localhost:3010` | Tài khoản, giao dịch, ngân sách và OCR |
| Admin Web | `http://localhost:5173` | Người dùng, danh mục, audit và vận hành |
| Worker | Không mở HTTP | Email, OCR, ngân sách, đối soát billing và dọn hóa đơn hết hạn |

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

Migration thuộc project `capitalflow-database` và phải được chạy riêng. Hiện
`capitalflow-api/requirements.txt` vẫn chứa Alembic, nên image API/worker còn cài
thư viện này dù Dockerfile chỉ sao chép mã `app/`. Việc tách dependency runtime,
migration và dev là một thay đổi riêng; không tự chạy migration khi khởi động.

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

Worker xử lý EMAIL, OCR, BUDGET, BILLING và dọn hóa đơn đã xóa hết thời hạn giữ.
Nếu worker dừng, API vẫn phục vụ các nghiệp vụ đồng bộ nhưng job sẽ giữ trạng
thái chờ. Worker hiện không có luồng purge tài khoản người dùng.

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
npm test
npm run lint
npm run typecheck
npm run build

cd ..\admin-web
npm test
npm run lint
npm run build
```

Công cụ kiểm tra image nằm tại
`capitalflow-api/scripts/deployment/verify_docker.py`. Script tạo container cô
lập, kiểm tra dependency/worker/HTTP contract và dọn container của chính nó.
Các assertion contract trong script còn có đường dẫn API cũ; cần cập nhật và
kiểm chứng theo phiên bản triển khai trước khi dùng làm cổng phát hành.
