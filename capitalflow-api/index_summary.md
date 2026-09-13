# TỔNG QUAN HỆ THỐNG CAPITALFLOW (INDEX SUMMARY)

> **Tài liệu Kỹ thuật**: Sơ đồ cấu trúc thư mục, Hệ sinh thái công nghệ, Luồng dữ liệu chính và Các nguyên tắc thiết kế (Design Patterns).  
> **Phạm vi áp dụng**: Toàn bộ dự án **CapitalFlow** (`D:\code\DoAn_KLCN`) bao gồm Backend API (`capitalflow-api`), Cổng Quản trị Viên (`admin-web`), và Cổng Người Dùng Cuối (`user-web`).

---

## 1. Sơ đồ Cấu trúc Thư mục Toàn Dự án (Directory Structure)

Hệ thống **CapitalFlow** được tổ chức theo mô hình kiến trúc phân tách độc lập (Decoupled Multi-tier Architecture) với 3 dự án thành phần cùng kịch bản điều phối container Docker Compose tại thư mục gốc:

```text
D:\code\DoAn_KLCN/
├── .gitignore                          # Cấu hình bỏ qua tệp tin Git toàn dự án
├── docker-compose.yml                  # Kịch bản điều phối toàn bộ dịch vụ (API, Admin Web, User Web, CSDL)
│
├── capitalflow-api/                    # [BACKEND] Dịch vụ API trung tâm (FastAPI / Python 3.11+)
│   ├── .env / .env.example             # Biến môi trường & tệp cấu hình mẫu
│   ├── .gitignore                      # Gitignore cho phân hệ Backend
│   ├── Dockerfile                      # Khởi tạo container môi trường ứng dụng FastAPI
│   ├── docker-compose.yml              # Điều phối container phát triển cục bộ của Backend
│   ├── requirements.txt                # Thư viện phụ thuộc Python (FastAPI, SQLAlchemy, SlowAPI, Argon2, v.v.)
│   ├── pyrightconfig.json              # Cấu hình kiểm tra kiểu tĩnh (Static Type Checking)
│   ├── alembic.ini                     # Cấu hình công cụ di trú CSDL Alembic
│   ├── alembic/                        # Các phiên bản migration kịch bản CSDL
│   ├── docs/                           # Tài liệu kỹ thuật & kịch bản CSDL (CSDL.sql cho SQL Server / Postgres)
│   ├── uploads/                        # Thư mục lưu trữ tệp hóa đơn tải lên
│   │   └── emails/                     # Thư mục lưu trữ bản xem trước HTML email (Dev Mode)
│   ├── scripts/                        # Kịch bản bảo trì, seed dữ liệu mẫu & refactor
│   │   ├── seed.py                     # Khởi tạo dữ liệu người dùng ban đầu
│   │   ├── seed_dummy_data.py          # Sinh dữ liệu giao dịch & danh mục mẫu
│   │   └── generate_v3_models.py       # Hỗ trợ sinh model tự động
│   ├── tests/                          # Bộ kiểm thử tự động (Pytest)
│   └── app/                            # Mã nguồn ứng dụng chính (Application Root)
│       ├── main.py                     # Điểm khởi chạy FastAPI, Lifespan, CORS, Middleware, Router v1
│       ├── api/                        # Tầng điều hướng & tiếp nhận yêu cầu (API Layer)
│       │   ├── dependencies.py         # Quản trị Session DB, xác thực JWT, phân quyền RBAC
│       │   ├── middleware/             # Middleware tùy chỉnh
│       │   │   └── audit_middleware.py # Ghi nhận Audit Log tự động qua Independent DB Session
│       │   └── routes/                 # 9 Phân hệ Routes chính (versioned dưới /api/v1)
│       │       ├── auth.py             # Đăng ký, đăng nhập, đổi mật khẩu, OTP, quản lý phiên
│       │       ├── accounts.py         # Quản lý tài khoản ví (tiền mặt, ngân hàng, ví điện tử)
│       │       ├── categories.py       # Danh mục thu/chi (hệ thống & người dùng)
│       │       ├── transactions.py     # Giao dịch thu/chi, chuyển tiền nguyên tử giữa các ví
│       │       ├── budgets.py          # Ngân sách chi tiêu & theo dõi tiến độ thực tế
│       │       ├── dashboard.py        # Thống kê tổng quan tài sản ròng, dòng tiền tháng
│       │       ├── analytics.py        # Phân tích cơ cấu chi tiêu & xu hướng tài chính 6 tháng
│       │       ├── invoices.py         # Tải lên, OCR với Gemini AI, xác nhận hóa đơn & xóa an toàn
│       │       └── admin.py            # Quản trị người dùng, nhật ký email, cấu hình SMTP, KPIs
│       ├── core/                       # Cấu hình cốt lõi & cơ sở hạ tầng (Infrastructure)
│       │   ├── config.py               # Quản lý cài đặt cấu hình hệ thống bằng Pydantic BaseSettings
│       │   ├── database.py             # Khởi tạo SQLAlchemy Engine, SessionLocal & Connection Pool
│       │   ├── limiter.py              # Cấu hình Rate Limiter (SlowAPI) bảo vệ API
│       │   └── security.py             # Mã hóa mật khẩu Argon2, tạo & giải mã JWT Tokens
│       ├── models/                     # Mô hình thực thể cơ sở dữ liệu (SQLAlchemy ORM)
│       │   ├── base.py                 # DeclarativeBase dùng chung
│       │   ├── user.py                 # Bảng users (USER / ADMIN)
│       │   ├── account.py              # Bảng accounts (CASH, BANK, EWALLET, CREDIT, v.v.)
│       │   ├── category.py             # Bảng categories (INCOME, EXPENSE)
│       │   ├── transaction.py          # Bảng transactions (MANUAL, OCR, IMPORT, SYSTEM)
│       │   ├── budget.py               # Bảng budgets (hạn mức & cảnh báo phần trăm)
│       │   ├── invoice.py              # Bảng invoices (quản lý tệp hóa đơn & trạng thái OCR)
│       │   ├── invoice_item.py         # Bảng invoice_items (chi tiết hàng hóa dịch vụ bóc tách)
│       │   ├── ocr_job.py              # Bảng ocr_jobs (theo dõi tiến độ & lịch sử quét AI)
│       │   ├── refresh_token.py        # Bảng refresh_tokens (xoay vòng token & phòng chống tấn công)
│       │   ├── audit_log.py            # Bảng audit_logs (lưu vết thao tác thay đổi dữ liệu)
│       │   ├── email_log.py            # Bảng email_logs (lưu vết lịch sử gửi email)
│       │   └── password_reset.py       # Bảng password_reset_otps (mã OTP quên mật khẩu)
│       ├── schemas/                    # Mô hình xác thực dữ liệu vào/ra (Pydantic DTOs)
│       │   ├── auth.py                 # Schemas đăng nhập, đăng ký, OTP, đổi mật khẩu
│       │   ├── account.py              # Schemas tạo, cập nhật và hiển thị tài khoản ví
│       │   ├── category.py             # Schemas danh mục thu chi
│       │   ├── transaction.py          # Schemas giao dịch thu/chi & chuyển tiền liên ví
│       │   ├── budget.py               # Schemas ngân sách & tiến độ thực tế
│       │   ├── invoice.py              # Schemas tải lên, xác nhận hóa đơn & quét AI hàng loạt
│       │   └── ocr_job.py              # Schemas trạng thái công việc OCR
│       └── services/                   # Tầng xử lý nghiệp vụ chuyên sâu (Business Logic Layer)
│           ├── transaction_service.py  # Điều chỉnh số dư, IDOR Guard, chuyển tiền ACID, cảnh báo ngân sách
│           ├── gemini_service.py       # Bóc tách hóa đơn bằng Google Gemini Vision (Dual-Model Fallback)
│           └── email_service.py        # Gửi email đa chế độ (Real SMTP & Console/HTML Preview)
│
└── frontend/                           # [FRONTEND] Các ứng dụng web giao diện người dùng
    ├── admin-web/                      # [PORTAL QUẢN TRỊ] Admin Portal (React 19 + Vite 8 + Tailwind v4)
    │   ├── .env                        # Biến môi trường kết nối API (VITE_API_URL)
    │   ├── .oxlintrc.json              # Cấu hình kiểm tra cú pháp và chất lượng mã nguồn Oxlint
    │   ├── Dockerfile                  # Đóng gói Multi-stage container (Node build -> Nginx runtime)
    │   ├── index.html                  # Điểm neo HTML duy nhất cho SPA
    │   ├── nginx.conf                  # Máy chủ Nginx phục vụ tệp tĩnh & chuyển tiếp SPA fallback
    │   ├── package.json                # Khai báo dependencies (React 19, Recharts, TanStack Query)
    │   ├── vite.config.js              # Cấu hình bundler Vite, plugins Tailwind v4 & React
    │   └── src/                        # Mã nguồn ứng dụng Quản trị
    │       ├── main.jsx                # Entrypoint khởi tạo React DOM & QueryClientProvider
    │       ├── App.jsx                 # Bộ điều tuyến ứng dụng React Router DOM v7 & ProtectedRoute
    │       ├── index.css               # Design tokens, màu sắc Swiss Platinum & Cobalt Blue
    │       ├── components/             # Components giao diện dùng chung
    │       │   ├── DashboardLayout.jsx # Khung tổng quan: Sidebar, Header, Breadcrumbs, User Profile
    │       │   ├── ProtectedRoute.jsx  # Chốt kiểm soát đăng nhập & vai trò ADMIN trước khi hiển thị
    │       │   └── ui/                 # Thư viện UI nguyên tử (Badge, Pagination, Spinner, StatCard)
    │       ├── hooks/                  # Custom React Hooks
    │       │   └── useToast.js         # Quản lý thông báo toast đa dạng (Success, Error, Info, Warning)
    │       ├── pages/                  # Các màn hình chức năng Quản trị
    │       │   ├── Login.jsx           # Đăng nhập bảo mật, phòng chống Brute-force & kéo dây đèn bàn
    │       │   ├── Dashboard.jsx       # Bảng điều khiển KPI toàn hệ thống, biểu đồ SVG, chỉ số tức thì
    │       │   ├── Users.jsx           # Quản lý tài khoản người dùng, khóa/mở khóa đơn & hàng loạt, xuất CSV
    │       │   ├── Categories.jsx      # Quản trị danh mục Thu/Chi mặc định của toàn hệ sinh thái
    │       │   ├── SystemAnalytics.jsx # Phân tích vận hành vĩ mô, biểu đồ Recharts, bảo vệ quyền riêng tư
    │       │   ├── OcrMonitor.jsx      # Giám sát dịch vụ AI OCR (Google Gemini), tỷ lệ thành công & lỗi
    │       │   ├── AuditLogs.jsx       # Nhật ký kiểm toán bảo mật bất biến (Audit Trail) của Quản trị viên
    │       │   ├── EmailLogs.jsx       # Lịch sử gửi thư hệ thống, thử nghiệm gửi mail & cấu hình SMTP
    │       │   └── Settings.jsx        # Thiết lập thông số bảo mật, sao lưu dữ liệu & chế độ bảo trì
    │       └── services/               # Tầng giao tiếp mạng
    │           └── api.js              # Axios Client, Interceptors JWT Bearer & cơ chế xoay vòng Token
    │
    └── user-web/                       # [PORTAL NGƯỜI DÙNG] End-User Portal (Next.js 16 + TypeScript)
        ├── .env                        # Biến môi trường máy khách (NEXT_PUBLIC_API_URL, PORT)
        ├── Dockerfile                  # Đóng gói Multi-stage container cho môi trường Production (Standalone)
        ├── next.config.ts              # Cấu hình Next.js (Standalone build, chuyển tiếp URL, tối ưu)
        ├── package.json                # Dependencies (Next.js 16, React 19, TypeScript, TanStack Query)
        ├── postcss.config.mjs          # Cấu hình tiền xử lý CSS với Tailwind CSS v4
        ├── tsconfig.json               # Cấu hình TypeScript compiler & alias path `@/*`
        ├── vitest.config.ts            # Cấu hình kiểm thử đơn vị với Vitest
        ├── app/                        # Next.js App Router root
        │   ├── layout.tsx              # Root Layout bọc toàn bộ ứng dụng, nạp font & metadata
        │   ├── globals.css             # Định kiểu toàn cục, CSS tokens, dark mode & animation
        │   ├── providers.tsx           # Bọc TanStack Query Client Provider cho toàn bộ Client Components
        │   ├── login/                  # Phân hệ Xác thực Người dùng
        │   │   └── page.tsx            # Đăng nhập, Đăng ký, Quên mật khẩu (OTP), Đổi mật khẩu lần đầu
        │   └── (dashboard)/            # Nhóm Routes giao diện Người dùng (yêu cầu đăng nhập)
        │       ├── layout.tsx          # Layout bọc Dashboard (Sidebar, Header, Account Switcher)
        │       ├── page.tsx            # Bảng tổng quan: Tài sản ròng, dòng tiền tháng, 5 giao dịch gần nhất
        │       ├── accounts/page.tsx   # Quản lý danh sách ví, số dư tức thời, phân loại tài khoản
        │       ├── transactions/page.tsx # Sổ cái chi tiết, tìm kiếm, lọc nâng cao, phân trang giao dịch
        │       ├── budgets/page.tsx    # Thiết lập hạn mức ngân sách, theo dõi tiến độ chi tiêu theo danh mục
        │       ├── ocr/page.tsx        # Trạm số hóa hóa đơn AI OCR Studio (Drag-and-drop, xem trước, xác nhận)
        │       ├── categories/page.tsx # Danh mục thu chi cá nhân của người dùng
        │       ├── analytics/page.tsx  # Biểu đồ phân tích tài chính Recharts (cơ cấu chi tiêu, xu hướng 6 tháng)
        │       ├── settings/page.tsx   # Cài đặt thông tin cá nhân, tùy chọn hiển thị & bảo mật
        │       └── support/page.tsx    # Hướng dẫn sử dụng & cổng hỗ trợ người dùng
        ├── components/                 # Các UI Components tái sử dụng
        │   ├── DashboardLayout.tsx     # Shell giao diện trung tâm của người dùng
        │   ├── ErrorBoundary.tsx       # Bắt ngoại lệ giao diện runtime an toàn
        │   ├── FileList.tsx            # Hiển thị danh sách tệp hóa đơn tải lên kèm trạng thái xử lý
        │   ├── ResultsTable.tsx        # Bảng dữ liệu hóa đơn cho phép chỉnh sửa nội tuyến (Inline Editing)
        │   └── UploadZone.tsx          # Vùng kéo thả tệp hóa đơn tải lên (Drag & Drop)
        └── lib/                        # Thư viện tiện ích & tầng kết nối
            ├── api.ts                  # Axios Client, tự động làm mới Token qua Interceptors
            ├── gemini.ts               # Kết nối trực tiếp Google Gemini API (dự phòng client-side)
            ├── ocr-parse.ts            # Xử lý chuỗi JSON OCR, chuẩn hóa số tiền, phân tích bảng CSV
            ├── paths.ts                # Quản lý đường dẫn dữ liệu cục bộ
            └── ui-helpers.ts           # Hàm tạo màu ngẫu nhiên nhất quán & ánh xạ biểu ngữ Lucide
```

---

## 2. Hệ sinh thái Công nghệ Sử dụng Toàn Dự án (Technology Stack)

| Phân hệ / Tầng | Công nghệ / Thư viện | Phiên bản | Vai trò & Đặc tính Nổi bật |
| :--- | :--- | :--- | :--- |
| **Orchestration & DevOps** | **Docker & Docker Compose** | `3.8+` | Đóng gói và điều phối 3 dịch vụ đồng thời (`api:8000`, `admin-web:4000`, `user-web:3010`) trong cùng mạng ảo `capitalflow-net`. |
| **Web Server / Gateway** | **Nginx** (Alpine) | `Latest` | Đóng vai trò máy chủ phục vụ static assets và xử lý điều hướng Single Page Application (`try_files $uri /index.html`) cho Admin Web. |
| **Backend Core** | **FastAPI** + **Starlette** | `^0.115 / ^0.141` | Khung ứng dụng Web ASGI Python bất đồng bộ, hiệu năng cao, tự động sinh tài liệu Swagger UI & ReDoc. |
| **Runtime Backend** | **Python**, **Uvicorn**, **AnyIO** | `3.11+` | Nền tảng thực thi non-blocking I/O, quản lý connection pool và lifecycle qua cơ chế `lifespan`. |
| **Cơ sở Dữ liệu & ORM** | **SQLAlchemy 2.0**, **Alembic** | `^2.0` | ORM thế hệ mới sử dụng `select()` syntax; hỗ trợ chuyển đổi linh hoạt giữa **Microsoft SQL Server** (`pymssql`, `pyodbc`) và **PostgreSQL** (`psycopg`). Sử dụng SQL Views tối ưu (`vw_monthly_cashflow`, `vw_budget_progress`). |
| **Mã hóa Mật khẩu** | **Argon2** (`pwdlib`, `argon2-cffi`) | `Latest` | Thuật toán băm mật khẩu hiện đại nhất thế giới, vượt trội hoàn toàn so với bcrypt nhờ khả năng chống tấn công brute-force phần cứng (GPU/ASIC). |
| **Xác thực & Phiên làm việc**| **PyJWT** | `^2.9` | Cấp phát & xác thực chuỗi Stateless JWT (HS256) kết hợp cơ chế **Refresh Token Family Rotation** lưu vết thiết bị và IP. |
| **Trí tuệ Nhân tạo AI OCR** | **Google Gemini Vision AI** | `v1beta` | Bóc tách thông tin hóa đơn tiếng Việt có cấu trúc; hỗ trợ cơ chế **Dual-Model Fallback** (`gemini-3.5-flash-lite` $\to$ `gemini-3.6-flash`). |
| **Kiểm soát Tần suất** | **SlowAPI** (`limits`) | `^0.1.9` | Chống vét cạn mật khẩu và lạm dụng tài nguyên: Login (10 lần/phút), Quên mật khẩu (5 lần/phút), Quét AI (15 lần/phút). |
| **Hệ thống Email** | **SMTPLib**, **MIME Multipart** | Native | Động cơ gửi thư **Dual-Mode**: Tự động chuyển đổi giữa gửi thư SMTP thật (STARTTLS/SSL) và ghi log ra Terminal kèm tệp xem trước HTML tại local. |
| **Admin Web Core** | **React 19**, **Vite 8** | `^19.2.8 / ^8.2.0` | Ứng dụng Single Page Application (SPA) siêu nhẹ, build cực nhanh thông qua engine native ES modules. |
| **Admin Web Routing** | **React Router DOM** | `^7.18.2` | Quản trị định tuyến phân tầng, bảo vệ route quản trị (`ProtectedRoute`), quản lý trạng thái thanh địa chỉ. |
| **User Web Core** | **Next.js** (App Router) | `16.3.1` | Khung ứng dụng React Server Components & Client Components tối ưu SEO, hỗ trợ Standalone containerization. |
| **User Web Language** | **TypeScript** | `^5.0` | Kiểm tra kiểu tĩnh chặt chẽ toàn diện cho DTOs, Props, API Responses và Data Models. |
| **Quản lý Server State** | **TanStack React Query** | `^5.x` | Quản trị bộ nhớ cache dữ liệu máy chủ trên cả 2 frontend; tự động polling, deduplication, và invalidate cache thông minh. |
| **HTTP Client** | **Axios** | `^1.7 / ^1.19` | Thư viện gọi HTTP API tích hợp Request Interceptors gắn Bearer Token và Response Interceptors tự động xếp hàng refresh token trong suốt. |
| **Giao diện & Tiện ích CSS**| **Tailwind CSS v4** | `^4.x` | Hệ thống Utility-first CSS hiệu năng cao với `@tailwindcss/vite` (Admin) và `@tailwindcss/postcss` (User Web). |
| **Thư viện Giao diện Phụ** | **Bootstrap 5** | `^5.3.8` | Hỗ trợ hệ thống lưới Grid System và Table hiển thị dữ liệu nhiều cột trong Admin Portal. |
| **Trực quan hóa Dữ liệu** | **Recharts** + **Custom SVG** | `^3.10` | Biểu đồ vùng diện tích dòng tiền, biểu đồ cột thu chi, biểu đồ tròn cơ cấu tài chính và vòng tiến độ AI SVG sắc nét. |
| **Biểu tượng (Iconography)** | **Lucide React** | `^1.x` | Bộ biểu tượng vector hiện đại, đồng bộ phong cách thiết kế trên toàn bộ giao diện người dùng và quản trị. |

---

## 3. Các Luồng Dữ liệu Nghiệp vụ Chính Toàn Dự Án (Main Data Flows)

### 3.1. Luồng Xác thực & Xoay vòng Phiên Đa Tầng (End-to-End Authentication & Token Rotation Flow)

```
[User Web / Admin Web] 
        │ (1) POST /auth/login {email, password}
        ▼
   [FastAPI Core]
        │ ── Kiểm tra Rate Limit (SlowAPI: 10/min)
        │ ── Xác thực Argon2 Hash & Cờ is_active / is_banned
        │ ── Cập nhật last_login_at
        │ ── Khởi tạo Access Token (15m) + Refresh Token ngẫu nhiên
        │ ── Băm SHA-256 Refresh Token kèm family_id, Device, IP
        ▼
   [Database (MSSQL / Postgres)] (Lưu refresh_tokens)
        │
        ◄── Trả về {access_token, refresh_token, token_type: "bearer"}
[Client Storage] (sessionStorage / localStorage)
```

1. **Đăng nhập & Cấp quyền**:
   - Client gửi thông tin tài khoản. Hệ thống kiểm tra tần suất qua SlowAPI.
   - So khớp mật khẩu bằng `pwdlib` (Argon2). Nếu tài khoản bị khóa (`is_active=False` hoặc `status=BANNED`), hệ thống chặn ngay lập tức.
   - Admin Web thực hiện bước kiểm tra bổ sung: gọi tiếp `GET /api/v1/auth/me` để thẩm định quyền `ADMIN`. Nếu không phải Admin, ngay lập tức từ chối và xóa phiên.
2. **Cơ chế Xoay vòng Token Tự động (Transparent Family Rotation)**:
   - Khi Access Token hết hạn (15 phút), Axios Response Interceptor chặn lỗi `401 Unauthorized`.
   - Request bị lỗi được đưa vào hàng đợi (`queue`), trong khi một request gọi `POST /api/v1/auth/refresh` được kích hoạt ngầm.
   - **Phát hiện tái sử dụng token (Token Reuse Detection)**: Nếu mã Refresh Token gửi lên đã có dấu thời gian thu hồi (`revoked_at`), hệ thống phát hiện đây là hành vi tấn công đánh cắp token. Ngay lập tức thu hồi toàn bộ token thuộc cùng `family_id` và buộc đăng xuất trên tất cả thiết bị.
   - Nếu token hợp lệ, hệ thống đánh dấu thu hồi token cũ, cấp một cặp token mới cùng `family_id` và thực thi lại toàn bộ các request đang chờ trong hàng đợi mà người dùng không hề bị gián đoạn thao tác.
3. **Quy trình Quên mật khẩu & OTP 6 số**:
   - Người dùng gửi yêu cầu quên mật khẩu $\to$ Backend vô hiệu hóa các OTP cũ, sinh chuỗi OTP 6 số ngẫu nhiên có hiệu lực 10 phút.
   - Tác vụ ngầm `BackgroundTasks` gửi email chứa OTP về hòm thư người dùng mà không chặn phản hồi HTTP.
   - Người dùng nhập mã OTP kèm mật khẩu mới tại màn hình `/login` để hoàn tất cập nhật.

---

### 3.2. Luồng Giao dịch Sổ cái & Chuyển tiền Liên ví Nguyên tử (Ledger & Atomic Transfer Flow)

```
[Client (User-Web)]
        │ (1) POST /api/v1/transactions hoặc /transactions/transfer
        ▼
 [API Dependencies] (get_current_user -> IDOR Guard)
        │
        ▼
 [Transaction Service]
        │ ── Sắp xếp ID các ví theo thứ tự chữ cái (Chống Deadlock)
        │ ── Khóa hàng bằng with_for_update() (Pessimistic Locking)
        │ ── Kiểm tra số dư khả dụng (nếu EXPENSE hoặc chuyển tiền)
        │ ── Chuẩn hóa dấu: INCOME > 0, EXPENSE < 0
        │ ── Cập nhật trường balance của bảng accounts
        │ ── Ghi nhận 1 Transaction (thu/chi) hoặc 2 Transactions (transfer_pair_id)
        ▼
 [Database Commit] (Giao dịch hoàn tất nguyên tử ACID)
        │
        ├──► [BackgroundTasks] (Không chặn phản hồi API)
        │         │ ── Tính tổng chi tiêu danh mục trong tháng qua SQL View
        │         │ ── So sánh với hạn mức Budget
        │         └──► Nếu >= 80% hoặc >= 100%: Gửi email cảnh báo qua EmailService
        ▼
 [Phản hồi HTTP 200/201] ──► [Client TanStack Query] Invalidate cache ['accounts', 'transactions']
```

1. **Bảo vệ Sở hữu Chéo (IDOR Guard)**:
   - Trước khi thực hiện bất kỳ giao dịch nào, `transaction_service.py` kiểm tra xem `account_id` và `category_id` có thuộc sở hữu của người dùng hiện tại hay không (`_verify_account_ownership`, `_verify_category_ownership`).
2. **Khóa Bi quan (Pessimistic Concurrency Control)**:
   - Sử dụng `select(Account).where(...).with_for_update()` để khóa hàng tài khoản ví trong CSDL.
   - Triệt tiêu triệt để hiện tượng xung đột dữ liệu (Race Condition) khi người dùng phát sinh nhiều giao dịch đồng thời từ nhiều tab hoặc thiết bị.
3. **Chống Deadlock khi Chuyển tiền Liên ví**:
   - Khi chuyển tiền từ Ví A sang Ví B, hàm `transfer_money` sắp xếp 2 chuỗi UUID theo thứ tự tăng dần trước khi gọi lệnh khóa.
   - Quy tắc khóa có thứ tự nhất quán đảm bảo hai luồng chuyển tiền chéo nhau (A $\to$ B và B $\to$ A) không bao giờ rơi vào trạng thái Deadlock.
4. **Cảnh báo Ngân sách Bất đồng bộ**:
   - Sau khi ghi sổ thành công, một tác vụ `BackgroundTasks` kiểm tra ngân sách chi tiêu của danh mục tương ứng.
   - Nếu tỷ lệ chi chạm ngưỡng $\ge 80\%$ hoặc vượt hạn mức $\ge 100\%$, hệ thống tự động soạn thảo và gửi email cảnh báo tức thời.

---

### 3.3. Luồng Số hóa Hóa đơn Thông minh AI OCR & Hạch toán (Invoice AI OCR & Ledger Sync Flow)

```
[User Web (OCR Studio)]
        │ (1) Drag-and-drop file hóa đơn (.jpg, .png, .pdf)
        ▼
 [POST /api/v1/invoices]
        │ ── Lưu tệp lên đĩa vật lý (uploads/<uuid>.<ext>)
        │ ── Tạo bản ghi Invoice (status: UPLOADED)
        ▼
 [POST /api/v1/invoices/{id}/ocr hoặc batch-ocr]
        │ ── Kiểm soát tần suất qua SlowAPI (15 yêu cầu/phút)
        │ ── Đọc bytes tệp tin, mã hóa Base64
        │ ── Gửi Prompt kế toán tiếng Việt sang Google Gemini Vision API
        │ ── [DUAL-MODEL FALLBACK]: Thử gemini-3.5-flash-lite, nếu lỗi chuyển sang gemini-3.6-flash
        │ ── Trích xuất JSON: Nhà cung cấp, MST, Ngày, Tổng tiền, Chi tiết mặt hàng (InvoiceItem)
        │ ── Kiểm tra trùng lặp (_check_duplicate) theo MST+Số HĐ hoặc Tên+Ngày+Tiền
        │ ── Cập nhật Invoice (status: REVIEW_REQUIRED, cờ is_duplicate)
        ▼
 [Giao diện User Web] 
        │ ── Hiển thị tệp ảnh xem trước (phóng to, thu nhỏ, xoay chiều)
        │ ── Hiển thị bảng ResultsTable cho phép sửa trực tiếp (Inline Editing)
        │ ── Người dùng chọn Tài khoản ví thanh toán & Danh mục chi tiêu
        ▼
 [POST /api/v1/invoices/{id}/confirm]
        │ ── Chuyển trạng thái Invoice sang CONFIRMED
        │ ── Tự động gọi create_transaction(source=OCR, type=EXPENSE, amount=-total_amount)
        │ ── Khóa ví, trừ số dư tài khoản và lưu hóa đơn liên kết
        ▼
 [Hoàn tất Ghi sổ Sổ cái]
```

1. **Tải lên & Lưu trữ An toàn**: Tệp hóa đơn được cấp mã định danh UUID ngẫu nhiên để tránh trùng tên và ghi đè trên đĩa vật lý.
2. **Khả năng Chịu lỗi Cao (Dual-Model Fallback)**: Dịch vụ `gemini_service.py` ưu tiên sử dụng model nhẹ tốc độ cao (`gemini-3.5-flash-lite`). Nếu gặp lỗi kết nối hoặc vượt hạn ngạch (429 Too Many Requests), hệ thống tự động fallback sang `gemini-3.6-flash` giúp đảm bảo trải nghiệm không bị gián đoạn.
3. **Phát hiện Trùng lặp Thông minh**: Đối chiếu hóa đơn mới với các hóa đơn đã được xác nhận trong hệ thống để cảnh báo người dùng nếu hóa đơn này đã từng được thanh toán trước đó.
4. **Xóa An toàn Ràng buộc Khóa Ngoại (Safe FK Deletion)**: Khi người dùng xóa hóa đơn đơn lẻ hoặc hàng loạt (`batch-delete`), hệ thống tự động gỡ liên kết `Transaction.invoice_id = None` trước khi xóa hóa đơn con, xóa tệp vật lý và xóa bản ghi cha để không vi phạm ràng buộc Foreign Key trên Microsoft SQL Server.

---

### 3.4. Luồng Quản trị Vận hành & Giám sát Toàn Diện (Administration & Governance Flow)

```
[Admin Web Portal]
        │ (1) Thao tác Quản trị (Khóa user, Đổi quyền, Cấu hình SMTP, Giám sát AI)
        ▼
 [Admin API Routes (/api/v1/admin/*)]
        │ ── Kiểm tra quyền Quản trị viên (require_admin: role == ADMIN)
        │ ── Thực thi nghiệp vụ quản lý người dùng, cấu hình
        ▼
 [Audit Middleware] (Chạy trên toàn bộ các phương thức POST, PUT, PATCH, DELETE)
        │ ── Trích xuất client IP, User-Agent, Path, Entity ID, User ID
        │ ── Tự động suy luận mã hành động (_infer_action: BAN_USER, UPDATE_SETTINGS)
        │ ── Mở Independent DB Session (SessionLocal()) ghi vào bảng audit_logs
        │ ── Bắt toàn bộ ngoại lệ ghi log, không làm gián đoạn response chính
        ▼
 [Admin Portal Real-time Views]
        ├── Dashboard: Thống kê KPI, biểu đồ lưu lượng SVG
        ├── Users: Danh sách phân trang, tìm kiếm, lọc trạng thái, xuất file CSV tiếng Việt
        ├── OcrMonitor: Giám sát tỷ lệ thành công bóc tách hóa đơn, thời gian phản hồi (ms)
        ├── EmailLogs: Lịch sử gửi thư, cấu hình máy chủ SMTP trực tiếp (Hot-Reload)
        └── AuditLogs: Xem vết kiểm toán bất biến phục vụ an ninh hệ thống
```

---

## 4. Các Nguyên tắc Thiết kế (Design Patterns) Đang Áp Dụng

### 4.1. Nhóm Mẫu Kiến trúc & Hạ tầng (Architectural Patterns)

1. **Decoupled Multi-tier Client-Server Pattern (Kiến trúc Phân tách Đa tầng)**:
   - Hệ thống chia tách rõ rệt: Tầng Lưu trữ Dữ liệu (MSSQL / Postgres), Tầng Dịch vụ API trung tâm (`capitalflow-api`), và Hai cổng giao diện độc lập (`admin-web` và `user-web`).
   - Đảm bảo tính mở rộng cao, cho phép nâng cấp giao diện hoặc mở rộng thêm ứng dụng di động (Mobile App) trong tương lai mà không làm thay đổi logic lõi của Backend.
2. **Layered Architecture Pattern (Kiến trúc Phân tầng 3 lớp chuẩn mực)**:
   - Áp dụng trong `capitalflow-api`:
     - *API/Route Layer (`app/api/routes`)*: Tiếp nhận request, thẩm định DTOs, điều phối mã trạng thái HTTP.
     - *Business Service Layer (`app/services`)*: Nắm giữ toàn bộ quy tắc nghiệp vụ (IDOR Guard, kiểm soát khóa số dư, gọi AI, gửi thư).
     - *Data Access / Model Layer (`app/models`, `app/schemas`)*: Quản lý ánh xạ ORM và ràng buộc CSDL.
3. **Containerization & Reverse Proxy Pattern**:
   - Sử dụng Docker Compose kết nối các container qua mạng ảo `capitalflow-net`. Nginx được cấu hình làm máy chủ web phân phối tệp tĩnh và điều phối fallback cho ứng dụng SPA Admin Web.

---

### 4.2. Nhóm Mẫu Thiết kế Backend (Backend Patterns)

4. **Dependency Injection Pattern (Tiêm phụ thuộc)**:
   - Sử dụng cú pháp `Depends()` của FastAPI trong toàn bộ các endpoints để tiêm Session CSDL (`get_db`), xác thực người dùng (`get_current_user`), và chốt chặn phân quyền (`require_admin`). Giúp mã nguồn module hóa và dễ dàng mock dữ liệu khi viết Unit Test.
5. **Pessimistic Concurrency Control Pattern (Kiểm soát Đồng thời Bi quan)**:
   - Áp dụng `with_for_update()` khi truy vấn bản ghi `Account` trước khi cộng/trừ số dư.
   - Sắp xếp thứ tự khóa theo UUID để loại bỏ hoàn toàn nguy cơ Deadlock khi chuyển tiền qua lại giữa các ví.
6. **Dual-Mode / Strategy Pattern (Chiến lược Đa chế độ)**:
   - Ứng dụng trong `EmailService`: Tự động nhận biết môi trường cấu hình. Nếu có thông số SMTP hợp lệ sẽ gửi qua mạng thật (STARTTLS/SSL); nếu ở môi trường phát triển (Dev) sẽ tự động kích hoạt chế độ ghi log ra Terminal và xuất tệp xem trước HTML tại `uploads/emails/`.
7. **Fallback Pattern (Dự phòng Tự động Chịu lỗi)**:
   - Triển khai trong `gemini_service.py`: Tự động chuyển đổi giữa model chính (`gemini-3.5-flash-lite`) và model phụ (`gemini-3.6-flash`) khi xảy ra sự cố mạng hoặc cạn kiệt quota.
8. **Token Family Rotation Pattern (Xoay vòng Token theo Họ)**:
   - Quản lý Refresh Token theo cây phả hệ (`family_id`). Thu hồi token cũ sau mỗi lần sử dụng; nếu phát hiện token đã thu hồi bị gửi lại, ngay lập tức hủy toàn bộ phiên của họ token đó để chống tấn công Replay Attack.
9. **Independent Session Logging Pattern (Ghi nhật ký qua Session Độc lập)**:
   - `AuditMiddleware` tự khởi tạo một `SessionLocal()` riêng biệt để ghi log kiểm toán sau khi request hoàn tất, không phụ thuộc vào transaction session của route chính và không bao giờ làm gián đoạn response gửi về người dùng.
10. **Asynchronous Background Processing Pattern (Xử lý Bất đồng bộ Ngầm)**:
    - Sử dụng `BackgroundTasks` của FastAPI cho các tác vụ tốn thời gian như gửi email xác nhận, gửi cảnh báo vượt ngân sách, giúp API phản hồi tức thì với độ trễ thấp nhất.
11. **Soft Delete Pattern (Xóa mềm Bảo toàn Dữ liệu)**:
    - Áp dụng trên bảng `accounts` (`is_active = False`). Bảo tồn nguyên vẹn lịch sử giao dịch kế toán, đồng thời trả về cảnh báo HTTP 409 Conflict nếu ví vẫn còn số dư trước khi xóa.

---

### 4.3. Nhóm Mẫu Thiết kế Frontend (Frontend Patterns)

12. **Transparent Token Refresh & Request Queueing Pattern (Làm mới Token trong suốt)**:
    - Triển khai tại cả hai ứng dụng frontend (`admin-web/src/services/api.js` và `user-web/lib/api.ts`): Tự động chặn lỗi 401, tạm dừng các request tiếp theo, gọi API refresh token và tự động gửi lại các request ban đầu một cách liền mạch với trải nghiệm người dùng.
13. **Optimistic UI & Cache Invalidation Pattern (Cập nhật Giao diện & Làm tươi Cache)**:
    - Tận dụng TanStack React Query (`useQuery`, `useMutation`): Khi tạo/sửa giao dịch hoặc hóa đơn, frontend tự động kích hoạt hủy tính hợp lệ của cache (`invalidateQueries`) để kéo dữ liệu mới nhất mà không cần tải lại toàn trang.
14. **Protected Route & Role Guard Pattern (Bảo vệ Tuyến đường Phân quyền)**:
    - Sử dụng component bọc `<ProtectedRoute />` trong Admin Web và Route Handlers / Layout Guards trong User Web để kiểm tra tính hợp lệ của Access Token và vai trò người dùng trước khi render cây thành phần DOM.
15. **Compound Component & Atomic UI Design Pattern (Thành phần UI Nguyên tử Tái sử dụng)**:
    - Tổ chức các components giao diện theo từng khối chuyên biệt, độc lập và dễ tái sử dụng: `StatCard`, `Badge`, `EmptyState`, `UploadZone`, `ResultsTable`, `FileList`.
16. **Error Boundary Pattern (Khoanh vùng Bắt lỗi Giao diện)**:
    - Bọc các thành phần nhạy cảm với dữ liệu (như bảng kết quả OCR, biểu đồ phân tích) bằng React Error Boundary để bắt lỗi runtime và hiển thị giao diện thay thế thân thiện thay vì làm sập toàn bộ ứng dụng.
