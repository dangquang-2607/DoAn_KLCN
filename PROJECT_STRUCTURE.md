# Danh mục cấu trúc dự án CapitalFlow

> Cập nhật: 15/09/2026. Phạm vi gồm toàn bộ file first-party hiện có trong Git hoặc working tree; loại `node_modules`, `.venv`, `.next`, `dist`, cache, secret và upload runtime.

## Quy ước quản lý

- `capitalflow-api/`: FastAPI, worker, SQLAlchemy, migration và kiểm thử backend.
- `frontend/user-web/`: cổng người dùng Next.js.
- `frontend/admin-web/`: cổng quản trị React/Vite.
- `frontend/shared/`: nguồn chuẩn của thiết kế được sao chép vào hai Docker context bằng `sync-design.mjs`.
- File migration/repair phải có dry-run hoặc tính idempotent; kiểm thử HTTP nằm trong pytest và dùng CSDL cô lập.
- Không đưa `.env`, dump CSDL, ảnh hóa đơn, email preview, cache hoặc build output vào Git.

**Tổng số file được lập danh mục: 186.**

## Gốc dự án

| File | Mục đích |
|---|---|
| `.editorconfig` | Chuẩn hóa UTF-8, kiểu xuống dòng và thụt lề giữa các IDE. |
| `.gitignore` | Loại secret, cache, build artifact, upload runtime và dump CSDL khỏi Git. |
| `PROJECT_STRUCTURE.md` | Danh mục chuẩn của các file được duy trì và mục đích của chúng. |
| `README.md` | Hướng dẫn tổng quan, chạy local, Docker và cấu hình SQL Server của toàn hệ thống. |
| `docker-compose.yml` | Build và chạy hai frontend trên mạng Docker dùng chung. |

## Backend FastAPI

| File | Mục đích |
|---|---|
| `capitalflow-api/.dockerignore` | Thu hẹp Docker build context vào runtime cần thiết. |
| `capitalflow-api/.env.docker.example` | Mẫu biến môi trường Docker cho SQL auth/Kerberos với ODBC 18. |
| `capitalflow-api/.env.example` | Mẫu biến môi trường phát triển, không chứa secret thật. |
| `capitalflow-api/.gitignore` | Loại môi trường ảo, secret, cache, upload và Alembic revision cục bộ khỏi Git. |
| `capitalflow-api/Dockerfile` | Tạo production image API/worker với ODBC 18 và whitelist runtime. |
| `capitalflow-api/alembic.ini` | Cấu hình Alembic dự phòng cho quản lý migration SQLAlchemy. |
| `capitalflow-api/alembic/README` | Ghi chú cấu hình Alembic. |
| `capitalflow-api/alembic/env.py` | Khởi tạo metadata và kết nối khi chạy Alembic. |
| `capitalflow-api/alembic/script.py.mako` | Mẫu sinh revision Alembic. |
| `capitalflow-api/app/__init__.py` | Đánh dấu package Python và công khai import cần thiết. |
| `capitalflow-api/app/api/__init__.py` | Đánh dấu package Python và công khai import cần thiết. |
| `capitalflow-api/app/api/dependencies.py` | Xác thực access token, tải current user và áp dụng guard phân quyền. |
| `capitalflow-api/app/api/middleware/__init__.py` | Đánh dấu package Python và công khai import cần thiết. |
| `capitalflow-api/app/api/middleware/audit_middleware.py` | Ghi audit request và lọc dữ liệu nhạy cảm. |
| `capitalflow-api/app/api/middleware/body_limit.py` | Giới hạn kích thước request body để chống payload DoS. |
| `capitalflow-api/app/api/routes/__init__.py` | Đánh dấu package Python và công khai import cần thiết. |
| `capitalflow-api/app/api/routes/accounts.py` | API CRUD tài khoản/ví và điều chỉnh số dư có audit. |
| `capitalflow-api/app/api/routes/admin.py` | API quản trị người dùng, hệ thống, log và trạng thái purge. |
| `capitalflow-api/app/api/routes/analytics.py` | API số liệu phân tích tài chính. |
| `capitalflow-api/app/api/routes/auth.py` | API đăng ký, đăng nhập, refresh, OTP và bảo mật phiên. |
| `capitalflow-api/app/api/routes/budgets.py` | API CRUD/theo dõi ngân sách. |
| `capitalflow-api/app/api/routes/categories.py` | API CRUD danh mục hệ thống và tùy chỉnh. |
| `capitalflow-api/app/api/routes/dashboard.py` | API dữ liệu tổng quan dashboard. |
| `capitalflow-api/app/api/routes/invoices.py` | API upload, duyệt và quản lý hóa đơn/OCR. |
| `capitalflow-api/app/api/routes/transactions.py` | API CRUD giao dịch và chuyển tiền. |
| `capitalflow-api/app/core/__init__.py` | Đánh dấu package Python và công khai import cần thiết. |
| `capitalflow-api/app/core/config.py` | Đọc và xác thực cấu hình từ biến môi trường. |
| `capitalflow-api/app/core/database.py` | Tạo SQLAlchemy engine, session factory và dependency CSDL. |
| `capitalflow-api/app/core/limiter.py` | Cấu hình rate limiting dùng chung. |
| `capitalflow-api/app/core/secrets_store.py` | Mã hóa/giải mã secret lưu trong CSDL. |
| `capitalflow-api/app/core/security.py` | Hash mật khẩu và tạo/giải mã JWT có kiểm tra claim. |
| `capitalflow-api/app/core/unicode_text.py` | Chuẩn hóa Unicode tiếng Việt tại biên dữ liệu. |
| `capitalflow-api/app/main.py` | Khởi tạo FastAPI, middleware, router và endpoint health/readiness. |
| `capitalflow-api/app/models/__init__.py` | Đánh dấu package Python và công khai import cần thiết. |
| `capitalflow-api/app/models/account.py` | Model tài khoản/ví và ràng buộc số dư. |
| `capitalflow-api/app/models/audit_log.py` | Model nhật ký kiểm toán. |
| `capitalflow-api/app/models/background_job.py` | Model durable background job, lease và retry. |
| `capitalflow-api/app/models/base.py` | Declarative base và quy ước model SQLAlchemy. |
| `capitalflow-api/app/models/budget.py` | Model ngân sách và chỉ mục lọc. |
| `capitalflow-api/app/models/category.py` | Model danh mục hệ thống/tùy chỉnh. |
| `capitalflow-api/app/models/email_log.py` | Model trạng thái gửi email. |
| `capitalflow-api/app/models/idempotency.py` | Model khóa idempotency cho request ghi. |
| `capitalflow-api/app/models/invoice.py` | Model hóa đơn và quan hệ tự tham chiếu. |
| `capitalflow-api/app/models/invoice_item.py` | Model dòng hàng hóa/dịch vụ trên hóa đơn. |
| `capitalflow-api/app/models/ocr_job.py` | Model tiến trình và kết quả OCR. |
| `capitalflow-api/app/models/password_reset.py` | Model OTP/token đặt lại mật khẩu. |
| `capitalflow-api/app/models/refresh_token.py` | Model refresh token rotation/revocation. |
| `capitalflow-api/app/models/system_setting.py` | Model cấu hình vận hành hệ thống. |
| `capitalflow-api/app/models/transaction.py` | Model sổ cái giao dịch, transfer và adjustment. |
| `capitalflow-api/app/models/user.py` | Model người dùng, trạng thái bảo mật và vòng đời xóa. |
| `capitalflow-api/app/models/user_deletion.py` | Model yêu cầu purge và checkpoint xóa file. |
| `capitalflow-api/app/schemas/__init__.py` | Đánh dấu package Python và công khai import cần thiết. |
| `capitalflow-api/app/schemas/account.py` | Pydantic request/response schema cho miền account. |
| `capitalflow-api/app/schemas/auth.py` | Pydantic request/response schema cho miền auth. |
| `capitalflow-api/app/schemas/budget.py` | Pydantic request/response schema cho miền budget. |
| `capitalflow-api/app/schemas/category.py` | Pydantic request/response schema cho miền category. |
| `capitalflow-api/app/schemas/invoice.py` | Pydantic request/response schema cho miền invoice. |
| `capitalflow-api/app/schemas/ocr_job.py` | Pydantic request/response schema cho miền ocr_job. |
| `capitalflow-api/app/schemas/transaction.py` | Pydantic request/response schema cho miền transaction. |
| `capitalflow-api/app/services/__init__.py` | Đánh dấu package Python và công khai import cần thiết. |
| `capitalflow-api/app/services/email_service.py` | Render, vệ sinh HTML và gửi/log email. |
| `capitalflow-api/app/services/gemini_service.py` | Gọi Gemini OCR với timeout, giới hạn và kiểm tra phản hồi. |
| `capitalflow-api/app/services/idempotency.py` | Thực thi request idempotent và lưu kết quả. |
| `capitalflow-api/app/services/jobs.py` | Mã hóa payload và enqueue/lease background job. |
| `capitalflow-api/app/services/reporting.py` | Tổng hợp số liệu thu chi, loại transfer khỏi báo cáo. |
| `capitalflow-api/app/services/sessions.py` | Quản lý phiên đăng nhập và refresh token. |
| `capitalflow-api/app/services/transaction_service.py` | Áp dụng sổ cái, khóa ghi và toàn vẹn số dư. |
| `capitalflow-api/app/services/user_deletion.py` | Soft delete, restore, purge CSDL và lập lịch xóa file. |
| `capitalflow-api/app/services/worker.py` | Worker xử lý OCR, email, purge user và retry. |
| `capitalflow-api/docker-compose.yml` | Chạy API và worker dùng chung volume upload, kết nối SQL Server ngoài Compose. |
| `capitalflow-api/docs/docker-sql-server.md` | Runbook triển khai và vận hành: docker sql server. |
| `capitalflow-api/docs/financial-integrity-release.md` | Runbook triển khai và vận hành: financial integrity release. |
| `capitalflow-api/docs/resilience-release.md` | Runbook triển khai và vận hành: resilience release. |
| `capitalflow-api/docs/user-deletion-release.md` | Runbook triển khai và vận hành: user deletion release. |
| `capitalflow-api/migrations/20260910_financial_integrity.sql` | Migration SQL Server idempotent cho financial integrity. |
| `capitalflow-api/migrations/20260914_user_deletion.sql` | Migration SQL Server idempotent cho user deletion. |
| `capitalflow-api/migrations/20260915_invoice_review_fields.sql` | Bổ sung ký hiệu, thuế suất và hình thức thanh toán của hóa đơn. |
| `capitalflow-api/pyrefly.toml` | Cấu hình kiểm tra kiểu thống nhất cho app, script và tests. |
| `capitalflow-api/pyrightconfig.json` | Cấu hình phân tích kiểu Python cho editor/CI. |
| `capitalflow-api/pytest.ini` | Giới hạn pytest vào thư mục tests và quy ước tên test. |
| `capitalflow-api/requirements.txt` | Danh sách package Python được khóa phiên bản. |
| `capitalflow-api/scripts/diagnose_deployment.py` | Chẩn đoán production: ODBC 18, TLS, SQL schema và storage. |
| `capitalflow-api/scripts/insert_dummy_data.sql` | Dữ liệu mẫu SQL được giữ theo chủ đích; chỉ dùng môi trường phát triển. |
| `capitalflow-api/scripts/migrate_financial_integrity.py` | Áp dụng/kiểm tra migration toàn vẹn tài chính. |
| `capitalflow-api/scripts/migrate_invoice_review_fields.py` | Kiểm tra hoặc áp dụng migration trường kiểm tra hóa đơn trong transaction. |
| `capitalflow-api/scripts/migrate_resilience.py` | Áp dụng migration resilience/idempotency/job. |
| `capitalflow-api/scripts/migrate_user_deletion.py` | Áp dụng migration vòng đời xóa người dùng. |
| `capitalflow-api/scripts/repair_unicode.py` | Dry-run/apply sửa mojibake theo ánh xạ có audit. |
| `capitalflow-api/scripts/seed.py` | Seed danh mục và bootstrap system admin từ biến môi trường. |
| `capitalflow-api/scripts/verify_concurrent_money.py` | Kiểm chứng ghi tiền đồng thời và khóa sổ cái. |
| `capitalflow-api/scripts/verify_docker.py` | Smoke test production image trong container cô lập. |
| `capitalflow-api/scripts/verify_financial_integrity.py` | Kiểm chứng constraint/index và luồng tài chính trên SQL Server. |
| `capitalflow-api/scripts/verify_unicode.py` | Quét dữ liệu/cấu hình để phát hiện lỗi Unicode. |
| `capitalflow-api/tests/__init__.py` | Đánh dấu package Python và công khai import cần thiết. |
| `capitalflow-api/tests/conftest.py` | Fixture CSDL SQLite, client và dữ liệu dùng chung cho pytest. |
| `capitalflow-api/tests/test_audit_p0.py` | Kiểm thử audit, payload limit và kiểm soát P0. |
| `capitalflow-api/tests/test_deployment_diagnostics.py` | Kiểm thử logic chẩn đoán triển khai. |
| `capitalflow-api/tests/test_invoice_review.py` | Kiểm thử chỉnh sửa mặt hàng OCR và bảo toàn số lượng thập phân. |
| `capitalflow-api/tests/test_resilience.py` | Kiểm thử rollback, retry, timeout và failure scenarios. |
| `capitalflow-api/tests/test_security_constraints.py` | Kiểm thử validation, JWT, ownership và constraint bảo mật. |
| `capitalflow-api/tests/test_transactions.py` | Kiểm thử sổ cái, transfer và cập nhật/xóa giao dịch. |
| `capitalflow-api/tests/test_ui_contracts.py` | Kiểm thử regression cho refresh session và secret SMTP. |
| `capitalflow-api/tests/test_unicode_integrity.py` | Kiểm thử chuẩn hóa Unicode xuyên suốt schema/service. |
| `capitalflow-api/tests/test_user_deletion.py` | Kiểm thử soft delete, restore, purge, retry và guards. |

## Admin Web

| File | Mục đích |
|---|---|
| `frontend/admin-web/.dockerignore` | Loại dependency/cache khỏi Docker context admin. |
| `frontend/admin-web/.gitignore` | Loại dependency, build output, log và cấu hình editor cục bộ khỏi Git. |
| `frontend/admin-web/.oxlintrc.json` | Cấu hình quy tắc Oxlint cho mã React admin. |
| `frontend/admin-web/Dockerfile` | Build Vite và phục vụ admin bằng Nginx. |
| `frontend/admin-web/index.html` | HTML entry cho ứng dụng Vite admin. |
| `frontend/admin-web/nginx.conf` | Nginx static hosting và SPA fallback cho admin. |
| `frontend/admin-web/package-lock.json` | Khóa dependency transitive của admin để build lặp lại. |
| `frontend/admin-web/package.json` | Scripts và dependency trực tiếp của admin. |
| `frontend/admin-web/public/favicon.svg` | Biểu tượng trình duyệt của cổng quản trị. |
| `frontend/admin-web/src/App.jsx` | Khai báo router admin và lazy-load từng trang nghiệp vụ. |
| `frontend/admin-web/src/components/DashboardLayout.jsx` | Khung điều hướng, hồ sơ và layout các trang quản trị. |
| `frontend/admin-web/src/components/Motion.jsx` | Bản đồng bộ hiệu ứng chuyển động cho admin. |
| `frontend/admin-web/src/components/ProtectedRoute.jsx` | Chặn route admin khi chưa xác thực/không đủ quyền. |
| `frontend/admin-web/src/components/SecuritySettings.jsx` | Giao diện đổi mật khẩu và thiết lập phiên bảo mật admin. |
| `frontend/admin-web/src/components/Toast.jsx` | Bản đồng bộ toast cho admin. |
| `frontend/admin-web/src/components/design.jsx` | Các primitive giao diện admin dùng chung. |
| `frontend/admin-web/src/hooks/useToast.js` | Hook quản lý vòng đời toast trong admin. |
| `frontend/admin-web/src/hooks/useMotionAllowed.js` | Theo dõi `prefers-reduced-motion` để tắt hiệu ứng khi người dùng yêu cầu. |
| `frontend/admin-web/src/index.css` | CSS nền và reset riêng của admin. |
| `frontend/admin-web/src/main.jsx` | Bootstrap React, React Query, Bootstrap và stylesheet admin. |
| `frontend/admin-web/src/pages/AuditLogs.jsx` | Trang quản trị AuditLogs được lazy-load theo route. |
| `frontend/admin-web/src/pages/Categories.jsx` | Trang quản trị Categories được lazy-load theo route. |
| `frontend/admin-web/src/pages/Dashboard.jsx` | Trang quản trị Dashboard được lazy-load theo route. |
| `frontend/admin-web/src/pages/EmailLogs.jsx` | Trang quản trị EmailLogs được lazy-load theo route. |
| `frontend/admin-web/src/pages/Login.jsx` | Trang quản trị Login được lazy-load theo route. |
| `frontend/admin-web/src/pages/OcrMonitor.jsx` | Trang quản trị OcrMonitor được lazy-load theo route. |
| `frontend/admin-web/src/pages/Settings.jsx` | Trang quản trị Settings được lazy-load theo route. |
| `frontend/admin-web/src/pages/SystemAnalytics.jsx` | Trang quản trị SystemAnalytics được lazy-load theo route. |
| `frontend/admin-web/src/pages/Users.jsx` | Trang quản trị Users được lazy-load theo route. |
| `frontend/admin-web/src/services/api.js` | Axios client, token handling và giao tiếp backend cho admin. |
| `frontend/admin-web/src/services/format.js` | Định dạng ngày/tiền, thông báo lỗi và CSV an toàn. |
| `frontend/admin-web/src/swiss.css` | Bản đồng bộ stylesheet thiết kế cho Docker context admin. |
| `frontend/admin-web/vite.config.js` | Cấu hình bundler Vite và React plugin. |

## User Web

| File | Mục đích |
|---|---|
| `frontend/user-web/.dockerignore` | Loại dependency, cache và dữ liệu test khỏi Docker context user. |
| `frontend/user-web/.gitignore` | Loại dependency, Next build output, secret và type cache khỏi Git. |
| `frontend/user-web/AGENTS.md` | Quy tắc Next.js do framework quản lý cho coding agent. |
| `frontend/user-web/CLAUDE.md` | Cầu nối công cụ Claude tới AGENTS.md. |
| `frontend/user-web/Dockerfile` | Build và chạy Next.js standalone production. |
| `frontend/user-web/app/(dashboard)/accounts/page.tsx` | CRUD tài khoản/ví. |
| `frontend/user-web/app/(dashboard)/analytics/page.tsx` | Biểu đồ và phân tích thu chi. |
| `frontend/user-web/app/(dashboard)/budgets/page.tsx` | CRUD và theo dõi ngân sách. |
| `frontend/user-web/app/(dashboard)/categories/page.tsx` | CRUD danh mục tùy chỉnh. |
| `frontend/user-web/app/(dashboard)/layout.tsx` | Layout bảo vệ và điều hướng cho nhóm route nghiệp vụ. |
| `frontend/user-web/app/(dashboard)/ocr/page.tsx` | Tải hóa đơn, theo dõi OCR và duyệt dữ liệu bóc tách. |
| `frontend/user-web/app/(dashboard)/page.tsx` | Dashboard tổng quan tài chính người dùng. |
| `frontend/user-web/app/(dashboard)/settings/page.tsx` | Trang thiết lập tài khoản và bảo mật. |
| `frontend/user-web/app/(dashboard)/support/page.tsx` | Trang trợ giúp sử dụng nghiệp vụ. |
| `frontend/user-web/app/(dashboard)/transactions/page.tsx` | CRUD giao dịch và chuyển tiền nội bộ. |
| `frontend/user-web/app/favicon.ico` | Biểu tượng trình duyệt của cổng người dùng. |
| `frontend/user-web/app/globals.css` | CSS toàn cục và nạp stylesheet Swiss. |
| `frontend/user-web/app/layout.tsx` | Root layout, metadata, font và provider của cổng người dùng. |
| `frontend/user-web/app/login/page.tsx` | Trang đăng nhập/đăng ký người dùng hiện hữu. |
| `frontend/user-web/app/providers.tsx` | Khởi tạo React Query client phía người dùng. |
| `frontend/user-web/app/swiss.css` | Bản đồng bộ stylesheet thiết kế cho Docker context user. |
| `frontend/user-web/components/DashboardLayout.tsx` | Sidebar/header, kiểm tra phiên và layout user portal. |
| `frontend/user-web/components/Motion.d.ts` | Khai báo TypeScript cho Motion.jsx. |
| `frontend/user-web/components/Motion.jsx` | Bản đồng bộ hiệu ứng chuyển động cho user portal. |
| `frontend/user-web/components/SecuritySettings.tsx` | Đổi mật khẩu và quản lý phiên phía người dùng. |
| `frontend/user-web/components/Toast.d.ts` | Khai báo TypeScript cho Toast.jsx. |
| `frontend/user-web/components/Toast.jsx` | Bản đồng bộ toast cho user portal. |
| `frontend/user-web/components/ui.tsx` | Primitive UI dùng chung trong user portal. |
| `frontend/user-web/eslint.config.mjs` | Cấu hình ESLint theo Next.js/TypeScript. |
| `frontend/user-web/lib/api.ts` | Axios client và xử lý access/refresh token phía người dùng. |
| `frontend/user-web/lib/finance.ts` | Kiểu nghiệp vụ, định dạng tiền/ngày, lỗi và xuất CSV. |
| `frontend/user-web/hooks/useMotionAllowed.ts` | Theo dõi `prefers-reduced-motion` an toàn với SSR. |
| `frontend/user-web/next.config.ts` | Cấu hình Next.js và standalone output. |
| `frontend/user-web/package-lock.json` | Khóa dependency transitive của user portal. |
| `frontend/user-web/package.json` | Scripts và dependency trực tiếp của user portal. |
| `frontend/user-web/postcss.config.mjs` | Kích hoạt Tailwind CSS qua PostCSS. |
| `frontend/user-web/tests/api.test.ts` | Kiểm thử refresh token và lỗi API client. |
| `frontend/user-web/tests/finance.test.ts` | Kiểm thử định dạng và CSV an toàn. |
| `frontend/user-web/tsconfig.json` | Cấu hình TypeScript và alias @/. |
| `frontend/user-web/vitest.config.mts` | Cấu hình ESM cho unit test Vitest. |

## Thiết kế dùng chung

| File | Mục đích |
|---|---|
| `frontend/shared/Motion.jsx` | Nguồn chuẩn cho các hiệu ứng chuyển động dùng chung. |
| `frontend/shared/Toast.jsx` | Nguồn chuẩn cho toast tự biến mất và animation dùng chung. |
| `frontend/shared/swiss.css` | Nguồn chuẩn của design tokens và phong cách Swiss Platinum/Cobalt. |
| `frontend/shared/sync-design.mjs` | Đồng bộ ba tài nguyên thiết kế dùng chung sang hai frontend. |
