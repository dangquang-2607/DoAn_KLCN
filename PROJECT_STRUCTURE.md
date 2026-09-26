# Danh mục cấu trúc dự án CapitalFlow

> Cập nhật: 24/09/2026. Phạm vi gồm toàn bộ file first-party hiện có trong Git hoặc working tree; loại `node_modules`, `.venv`, `.next`, `dist`, cache, secret và upload runtime.

## Mục đích tài liệu

`PROJECT_STRUCTURE.md` là bản đồ sống của mã nguồn: ghi lại những file nào thuộc phạm vi được duy trì và trách nhiệm chính của từng file. Tài liệu giúp thành viên mới định vị nhanh, hỗ trợ review/đánh giá phạm vi ảnh hưởng khi thay đổi mã, và phát hiện file thừa hoặc tài liệu bị lệch so với working tree. Đây không phải manifest dùng để chạy hay build hệ thống; cấu hình thực thi vẫn nằm trong các file Docker, package và Python tương ứng.

## Quy ước quản lý

- `capitalflow-api/`: FastAPI, worker, SQLAlchemy models và kiểm thử backend; không chứa migration CSDL.
- `capitalflow-database/`: Alembic, baseline, công cụ kiểm chứng và lịch sử migration SQL Server.
- `frontend/user-web/`: cổng người dùng Next.js.
- `frontend/admin-web/`: cổng quản trị React/Vite.
- `frontend/shared/`: nguồn chuẩn của thiết kế được sao chép vào hai Docker context bằng `sync-design.mjs`.
- File migration/repair phải có dry-run hoặc tính idempotent; kiểm thử HTTP nằm trong pytest và dùng CSDL cô lập.
- Không đưa `.env`, dump CSDL, ảnh hóa đơn, email preview, cache hoặc build output vào Git.

Số lượng file thay đổi theo từng đợt tái cấu trúc; danh mục bên dưới và working tree là nguồn kiểm chứng thay vì duy trì một bộ đếm thủ công dễ sai lệch.

## Gốc dự án

| File | Mục đích |
|---|---|
| `.editorconfig` | Chuẩn hóa UTF-8, kiểu xuống dòng và thụt lề giữa các IDE. |
| `.gitignore` | Loại secret, cache, build artifact, upload runtime và dump CSDL khỏi Git. |
| `PROJECT_STRUCTURE.md` | Danh mục chuẩn của các file được duy trì và mục đích của chúng. |
| `README.md` | Hướng dẫn tổng quan, chạy local, Docker và cấu hình SQL Server của toàn hệ thống. |
| `docker-compose.yml` | Build và chạy hai frontend trên mạng Docker dùng chung. |

## Backend FastAPI

> Cấu trúc backend đã được tái tổ chức theo module. Các đường dẫn cũ `app/api`, `app/core`, `app/models`, `app/schemas` và `app/services` không còn là source runtime.

| Khu vực | Mục đích |
|---|---|
| `capitalflow-api/app/main.py` | Điểm vào mỏng, chỉ export `app.main:app`. |
| `capitalflow-api/app/bootstrap/` | Tạo FastAPI app, lifespan, handler, health/readiness và ghép router. |
| `capitalflow-api/app/shared/` | Cấu hình, database, security, HTTP middleware, telemetry và Unicode dùng chung. |
| `capitalflow-api/app/modules/dangnhap/` | Đăng ký, đăng nhập, OTP, mật khẩu, refresh token và phiên. |
| `capitalflow-api/app/modules/taichinh/` | Tài khoản, giao dịch, chuyển tiền, ngân sách và báo cáo. |
| `capitalflow-api/app/modules/hoadon/` | Upload, OCR, duyệt, xác nhận và xóa hóa đơn. |
| `capitalflow-api/app/modules/danhmuc/` | Danh mục thu/chi và phân loại tự động. |
| `capitalflow-api/app/modules/admin/` | Quản trị user, vòng đời xóa, audit và giám sát. |
| `capitalflow-api/app/modules/email/` | SMTP, template và nhật ký gửi email. |
| `capitalflow-api/app/modules/jobs/` | Queue bền vững và worker xử lý nền. |
| `capitalflow-api/tests/` | Test được chia thành unit, integration theo module và operational. |
| `capitalflow-api/scripts/deployment/` | Chẩn đoán và smoke test triển khai. |
| `capitalflow-api/scripts/load_test/` | Công cụ kiểm thử tải, không thuộc runtime production. |
| `capitalflow-api/docs/` | Tài liệu architecture, feature, operation, performance và release. |
| `capitalflow-api/artifacts/` | Output tái sinh được; không phải tài liệu chuẩn. |

Bản đồ chi tiết, quy tắc thêm file và phân loại file có thể xóa nằm tại [capitalflow-api-structure.md](capitalflow-api/docs/architecture/capitalflow-api-structure.md).

## Database SQL Server

| File | Mục đích |
|---|---|
| `capitalflow-database/README.md` | Quy trình Alembic và chính sách bắt buộc xác nhận trước thao tác phá hủy. |
| `capitalflow-database/CURRENT_SCHEMA.md` | Kiểm kê database thật, version và schema drift đã phát hiện. |
| `capitalflow-database/requirements.txt` | Dependency cho Alembic và công cụ database, tái sử dụng model API. |
| `capitalflow-database/alembic.ini` | Cấu hình Alembic độc lập khỏi runtime FastAPI. |
| `capitalflow-database/alembic/env.py` | Nạp metadata ORM, URL SQL Server và loại bảng điều khiển khỏi autogenerate. |
| `capitalflow-database/alembic/script.py.mako` | Mẫu revision có comment tiếng Việt. |
| `capitalflow-database/alembic/versions/da10f25d5743_legacy_marker.py` | Cầu nối nhận diện baseline rỗng của hệ Alembic cũ. |
| `capitalflow-database/alembic/versions/cfdb_20260924_baseline.py` | Baseline đầy đủ của 17 bảng nghiệp vụ, sinh từ schema SQL Server thật. |
| `capitalflow-database/tools/export_live_baseline.py` | Phản chiếu schema live và sinh baseline tự chứa, không xuất dữ liệu. |
| `capitalflow-database/tools/verify_baseline.py` | Dựng database tạm và so sánh bảng/cột/khóa/index/check constraint. |
| `capitalflow-database/tools/seed.py` | Seed danh mục hệ thống và tùy chọn bootstrap admin. |
| `capitalflow-database/tools/repair_unicode.py` | Dry-run/apply sửa mojibake theo ánh xạ có audit. |
| `capitalflow-database/tools/verify_schema_contract.py` | Phát hiện lệch bảng/cột giữa ORM và SQL Server. |
| `capitalflow-database/tools/verify_financial_integrity.py` | Kiểm chứng constraint và luồng tài chính bằng transaction rollback. |
| `capitalflow-database/tools/verify_concurrent_money.py` | Kiểm chứng concurrency và idempotency tiền tệ trên SQL Server thử nghiệm. |
| `capitalflow-database/tools/verify_unicode.py` | Kiểm chứng kiểu Unicode và vòng ghi/đọc tiếng Việt trên SQL Server. |
| `capitalflow-database/archive/pre_baseline_202609/` | Lịch sử SQL, wrapper và Alembic cũ; không dùng để vận hành hiện hành. |

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
| `frontend/admin-web/src/components/CategoryIcon.jsx` | Hiển thị biểu tượng và màu danh mục trong ứng dụng admin JavaScript. |
| `frontend/admin-web/src/components/CategoryIcon.tsx` | Phiên bản TypeScript có kiểu của bộ chọn/hiển thị biểu tượng danh mục admin. |
| `frontend/admin-web/src/components/DashboardLayout.jsx` | Khung điều hướng, hồ sơ và layout các trang quản trị. |
| `frontend/admin-web/src/components/Motion.jsx` | Bản đồng bộ hiệu ứng chuyển động cho admin. |
| `frontend/admin-web/src/components/ProtectedRoute.jsx` | Chặn route admin khi chưa xác thực/không đủ quyền. |
| `frontend/admin-web/src/components/SecuritySettings.jsx` | Giao diện đổi mật khẩu và thiết lập phiên bảo mật admin. |
| `frontend/admin-web/src/components/Toast.jsx` | Bản đồng bộ toast cho admin. |
| `frontend/admin-web/src/components/design.jsx` | Các primitive giao diện admin dùng chung. |
| `frontend/admin-web/src/components/audit-logs/AuditDetailModal.jsx` | Modal xem chi tiết một bản ghi nhật ký quản trị. |
| `frontend/admin-web/src/components/audit-logs/AuditLogActions.jsx` | Làm mới và xuất CSV trang nhật ký hiện tại. |
| `frontend/admin-web/src/components/audit-logs/AuditLogTable.jsx` | Bảng nhật ký quản trị, trạng thái dữ liệu và phân trang. |
| `frontend/admin-web/src/components/categories/CategoryFilters.jsx` | Lọc danh mục theo loại, trạng thái và từ khóa. |
| `frontend/admin-web/src/components/categories/CategoryList.jsx` | Danh sách thẻ danh mục cùng thao tác sửa và bật/tắt. |
| `frontend/admin-web/src/components/categories/CategoryModal.jsx` | Form modal tạo mới hoặc cập nhật danh mục hệ thống. |
| `frontend/admin-web/src/components/categories/CategoryOrderControls.jsx` | Điều khiển đổi thứ tự danh mục trong cùng loại. |
| `frontend/admin-web/src/components/dashboard/DashboardStats.jsx` | Bốn chỉ số tổng quan trên bảng điều khiển. |
| `frontend/admin-web/src/components/dashboard/InvoiceProgressWidget.jsx` | Tỷ lệ hóa đơn theo trạng thái xử lý. |
| `frontend/admin-web/src/components/dashboard/QuickManagementLinks.jsx` | Lối tắt tới ba khu vực quản trị thường dùng. |
| `frontend/admin-web/src/components/dashboard/RecentAdminActivity.jsx` | Năm hoạt động quản trị gần nhất. |
| `frontend/admin-web/src/components/email-logs/EmailDeliveryDetailModal.jsx` | Metadata và lỗi chuyển phát của một email. |
| `frontend/admin-web/src/components/email-logs/EmailLogFilters.jsx` | Bộ lọc người nhận, loại và trạng thái email. |
| `frontend/admin-web/src/components/email-logs/EmailLogTable.jsx` | Bảng lịch sử chuyển phát email và phân trang. |
| `frontend/admin-web/src/components/email-logs/SmtpSettingsForm.jsx` | Form chỉnh sửa cấu hình máy chủ SMTP. |
| `frontend/admin-web/src/components/email-logs/SmtpTestModal.jsx` | Modal gửi email kiểm thử bằng cấu hình hiện tại. |
| `frontend/admin-web/src/components/login/BruteForceLockout.jsx` | Cảnh báo khóa tạm và đồng hồ đếm ngược đăng nhập. |
| `frontend/admin-web/src/components/login/LampAnimation.jsx` | Minh họa đèn SVG và tương tác kéo dây. |
| `frontend/admin-web/src/components/login/LoginForm.jsx` | Form, validation và trạng thái xác thực quản trị. |
| `frontend/admin-web/src/components/ocr-monitor/InvoiceStatusSummary.jsx` | Phân bố số hóa đơn theo trạng thái. |
| `frontend/admin-web/src/components/ocr-monitor/OcrFailureTable.jsx` | Mười tác vụ OCR thất bại gần nhất. |
| `frontend/admin-web/src/components/ocr-monitor/OcrRetryButton.jsx` | Nút gửi lại tác vụ OCR lỗi có trạng thái loading. |
| `frontend/admin-web/src/components/ocr-monitor/OcrStatsGrid.jsx` | Năm chỉ số tổng hợp của hệ thống OCR. |
| `frontend/admin-web/src/components/settings/DisplayPreferencesPanel.jsx` | Quy ước ngôn ngữ, ngày tháng và tiền tệ đang áp dụng. |
| `frontend/admin-web/src/components/settings/EmailSettingsLink.jsx` | Liên kết tới tab cấu hình SMTP. |
| `frontend/admin-web/src/components/system-analytics/SystemMetricCards.jsx` | Ba chỉ số giao dịch và người dùng hoạt động. |
| `frontend/admin-web/src/components/system-analytics/TopCategoriesChart.jsx` | Biểu đồ năm danh mục có nhiều giao dịch nhất. |
| `frontend/admin-web/src/components/system-analytics/TransactionCompositionWidget.jsx` | Cơ cấu giao dịch theo loại. |
| `frontend/admin-web/src/components/users/index.js` | Barrel export các component và helper của màn hình quản lý người dùng. |
| `frontend/admin-web/src/components/users/UserActionModal.jsx` | Modal xác nhận khóa, mở khóa, đổi vai trò và xóa người dùng. |
| `frontend/admin-web/src/components/users/UserBulkBar.jsx` | Thanh thao tác hàng loạt cho các tài khoản được chọn. |
| `frontend/admin-web/src/components/users/UserDetailModal.jsx` | Modal xem chi tiết hồ sơ, trạng thái và lịch sử người dùng. |
| `frontend/admin-web/src/components/users/UserFilters.jsx` | Bộ lọc, tìm kiếm và điều khiển danh sách người dùng. |
| `frontend/admin-web/src/components/users/UserTable.jsx` | Bảng người dùng, chọn hàng và các hành động theo tài khoản. |
| `frontend/admin-web/src/components/users/utils.js` | Hằng số và helper trạng thái/hành động dùng chung cho quản lý người dùng. |
| `frontend/admin-web/src/hooks/useToast.js` | Hook quản lý vòng đời toast trong admin. |
| `frontend/admin-web/src/hooks/useMotionAllowed.js` | Theo dõi `prefers-reduced-motion` để tắt hiệu ứng khi người dùng yêu cầu. |
| `frontend/admin-web/src/index.css` | CSS nền và reset riêng của admin. |
| `frontend/admin-web/src/main.jsx` | Bootstrap React, React Query, Bootstrap và stylesheet admin. |
| `frontend/admin-web/src/pages/AuditLogs.jsx` | Điều phối query, phân trang và bản ghi audit đang xem. |
| `frontend/admin-web/src/pages/Categories.jsx` | Điều phối query và mutation tạo/sửa/bật-tắt/sắp xếp danh mục. |
| `frontend/admin-web/src/pages/Dashboard.jsx` | Điều phối dữ liệu tổng quan, OCR và hoạt động quản trị gần đây. |
| `frontend/admin-web/src/pages/EmailLogs.jsx` | Điều phối nhật ký email, cấu hình SMTP và gửi thử. |
| `frontend/admin-web/src/pages/Login.jsx` | Điều phối xác thực admin, khóa tạm phía client và đèn tương tác. |
| `frontend/admin-web/src/pages/OcrMonitor.jsx` | Điều phối monitor tự làm mới và mutation retry OCR. |
| `frontend/admin-web/src/pages/Settings.jsx` | Ghép các cài đặt bảo mật và hiển thị hiện có. |
| `frontend/admin-web/src/pages/SystemAnalytics.jsx` | Điều phối số liệu vận hành tổng hợp theo hợp đồng API hiện tại. |
| `frontend/admin-web/src/pages/Users.jsx` | Điều phối danh sách, chi tiết và mutation quản trị người dùng. |
| `frontend/admin-web/src/services/api.js` | Axios client, token handling và giao tiếp backend cho admin. |
| `frontend/admin-web/src/services/format.js` | Định dạng ngày/tiền, thông báo lỗi và CSV an toàn. |
| `frontend/admin-web/src/services/format.ts` | Phiên bản TypeScript của kiểu nghiệp vụ và tiện ích định dạng admin. |
| `frontend/admin-web/src/swiss.css` | Bản đồng bộ stylesheet thiết kế cho Docker context admin. |
| `frontend/admin-web/vite.config.js` | Cấu hình bundler Vite và React plugin. |

## User Web

Cấu trúc áp dụng quy ước feature-driven: `page.tsx` điều phối query/state/nghiệp vụ; `_components` chứa UI riêng của route; `_styles` chứa style đặc thù; `components` chỉ dành cho thành phần dùng chung toàn ứng dụng.

### Khung ứng dụng và đăng nhập

| File | Mục đích |
|---|---|
| `frontend/user-web/app/layout.tsx` | Root layout, metadata, font và provider. |
| `frontend/user-web/app/globals.css` | CSS toàn cục và nạp design system. |
| `frontend/user-web/app/swiss.css` | Bản đồng bộ design token Swiss Platinum/Cobalt. |
| `frontend/user-web/app/providers.tsx` | Khởi tạo React Query client phía trình duyệt. |
| `frontend/user-web/app/favicon.ico` | Biểu tượng trình duyệt. |
| `frontend/user-web/app/login/page.tsx` | Điều phối đăng nhập, đăng ký và khôi phục tài khoản. |
| `frontend/user-web/app/login/_components/FirstTimePasswordModal.tsx` | Đổi mật khẩu tạm ở lần đăng nhập đầu. |
| `frontend/user-web/app/login/_components/ForgotPasswordModal.tsx` | Gửi OTP và đặt lại mật khẩu. |
| `frontend/user-web/app/login/_components/PasswordStrengthBar.tsx` | Phản hồi độ mạnh mật khẩu. |
| `frontend/user-web/app/login/_styles/login.styles.ts` | Style riêng của màn xác thực. |

### Dashboard tổng quan

| File | Mục đích |
|---|---|
| `frontend/user-web/app/(dashboard)/layout.tsx` | Gắn khung bảo vệ đăng nhập cho nhóm route nghiệp vụ. |
| `frontend/user-web/app/(dashboard)/page.tsx` | Điều phối dữ liệu dashboard. |
| `frontend/user-web/app/(dashboard)/_components/OverviewStats.tsx` | Bốn chỉ số tài chính tổng quan. |
| `frontend/user-web/app/(dashboard)/_components/QuickActions.tsx` | Thêm giao dịch, quét hóa đơn, xem ví và làm mới. |
| `frontend/user-web/app/(dashboard)/_components/RecentTransactions.tsx` | Giao dịch gần nhất. |
| `frontend/user-web/app/(dashboard)/_components/AccountsWidget.tsx` | Tóm tắt ví và số dư. |
| `frontend/user-web/app/(dashboard)/_components/BudgetsWidget.tsx` | Tóm tắt tiến độ ngân sách. |
| `frontend/user-web/app/(dashboard)/_styles/overview.styles.ts` | Style riêng của dashboard. |

### Ví và tài khoản

| File | Mục đích |
|---|---|
| `frontend/user-web/app/(dashboard)/accounts/page.tsx` | Điều phối CRUD tài khoản và cache số dư. |
| `frontend/user-web/app/(dashboard)/accounts/_components/AccountCard.tsx` | Thẻ tài khoản, số dư và thao tác. |
| `frontend/user-web/app/(dashboard)/accounts/_components/AccountModal.tsx` | Form tạo/chỉnh sửa tài khoản. |
| `frontend/user-web/app/(dashboard)/accounts/_components/AccountDeleteModal.tsx` | Xác nhận ngừng sử dụng tài khoản an toàn. |
| `frontend/user-web/app/(dashboard)/accounts/_styles/accounts.styles.ts` | Style riêng của thẻ tài khoản. |

### Giao dịch

| File | Mục đích |
|---|---|
| `frontend/user-web/app/(dashboard)/transactions/page.tsx` | Điều phối CRUD, chuyển tiền, query và cache sổ giao dịch. |
| `frontend/user-web/app/(dashboard)/transactions/_components/TransactionTable.tsx` | Bảng giao dịch và phân trang. |
| `frontend/user-web/app/(dashboard)/transactions/_components/TransactionFilters.tsx` | Tìm kiếm, bộ lọc và xuất CSV. |
| `frontend/user-web/app/(dashboard)/transactions/_components/TransactionModal.tsx` | Form tạo/sửa thu chi và gợi ý danh mục. |
| `frontend/user-web/app/(dashboard)/transactions/_components/TransferModal.tsx` | Chuyển tiền nội bộ cùng loại tiền. |
| `frontend/user-web/app/(dashboard)/transactions/_components/TransactionDeleteModal.tsx` | Xác nhận xóa và hoàn số dư. |
| `frontend/user-web/app/(dashboard)/transactions/_styles/transactions.styles.ts` | Style riêng của bảng giao dịch. |

### Ngân sách

| File | Mục đích |
|---|---|
| `frontend/user-web/app/(dashboard)/budgets/page.tsx` | Điều phối CRUD và cache ngân sách. |
| `frontend/user-web/app/(dashboard)/budgets/_components/BudgetCard.tsx` | Tiến độ, hạn mức và cảnh báo ngân sách. |
| `frontend/user-web/app/(dashboard)/budgets/_components/BudgetModal.tsx` | Form tạo/chỉnh sửa ngân sách. |
| `frontend/user-web/app/(dashboard)/budgets/_components/BudgetDeleteModal.tsx` | Xác nhận xóa cấu hình ngân sách. |
| `frontend/user-web/app/(dashboard)/budgets/_styles/budgets.styles.ts` | Style riêng của thẻ/progress ngân sách. |

### Hóa đơn AI

| File | Mục đích |
|---|---|
| `frontend/user-web/app/(dashboard)/ocr/page.tsx` | Điều phối upload, quét, preview, xác nhận và xóa hóa đơn. |
| `frontend/user-web/app/(dashboard)/ocr/_components/InvoiceUploadZone.tsx` | Chọn hoặc kéo thả file hóa đơn. |
| `frontend/user-web/app/(dashboard)/ocr/_components/InvoiceQueueList.tsx` | Hàng đợi, lọc, chọn lô và phân trang hóa đơn. |
| `frontend/user-web/app/(dashboard)/ocr/_components/InvoiceDetailForm.tsx` | Duyệt/chỉnh sửa kết quả OCR trước khi ghi khoản chi. |
| `frontend/user-web/app/(dashboard)/ocr/_components/InvoiceStatusBadge.tsx` | Badge trạng thái xử lý OCR. |
| `frontend/user-web/app/(dashboard)/ocr/_components/InvoiceTypes.ts` | Kiểu và nhãn trạng thái hóa đơn. |
| `frontend/user-web/app/(dashboard)/ocr/_styles/ocr.styles.ts` | Style riêng của preview và layout OCR. |

### Báo cáo tài chính

| File | Mục đích |
|---|---|
| `frontend/user-web/app/(dashboard)/analytics/page.tsx` | Điều phối kỳ báo cáo, query và xuất CSV. |
| `frontend/user-web/app/(dashboard)/analytics/_components/CashflowBarChart.tsx` | Biểu đồ xu hướng thu chi. |
| `frontend/user-web/app/(dashboard)/analytics/_components/CategoryExpensePie.tsx` | Biểu đồ cơ cấu chi theo danh mục. |
| `frontend/user-web/app/(dashboard)/analytics/_components/CashflowSummaryTable.tsx` | Đối soát tổng thu, chi và dòng tiền. |
| `frontend/user-web/app/(dashboard)/analytics/_styles/analytics.styles.ts` | Style riêng của báo cáo. |

### Danh mục

| File | Mục đích |
|---|---|
| `frontend/user-web/app/(dashboard)/categories/page.tsx` | Điều phối CRUD, loại và tìm kiếm danh mục. |
| `frontend/user-web/app/(dashboard)/categories/_components/CategoryTable.tsx` | Danh sách danh mục hệ thống/cá nhân. |
| `frontend/user-web/app/(dashboard)/categories/_components/CategoryModal.tsx` | Form danh mục, icon, màu và từ khóa. |
| `frontend/user-web/app/(dashboard)/categories/_components/CategoryDeleteModal.tsx` | Xác nhận ẩn danh mục cá nhân. |
| `frontend/user-web/app/(dashboard)/categories/_styles/categories.styles.ts` | Style riêng của danh mục. |

### Cài đặt và hỗ trợ

| File | Mục đích |
|---|---|
| `frontend/user-web/app/(dashboard)/settings/page.tsx` | Điều phối trang cài đặt/bảo mật. |
| `frontend/user-web/app/(dashboard)/settings/_components/SecuritySettings.tsx` | Hồ sơ và đổi mật khẩu. |
| `frontend/user-web/app/(dashboard)/settings/_components/SessionManager.tsx` | Các phiên đăng nhập còn hiệu lực. |
| `frontend/user-web/app/(dashboard)/settings/_styles/settings.styles.ts` | Style riêng của form bảo mật. |
| `frontend/user-web/app/(dashboard)/support/page.tsx` | Điều phối trung tâm hỗ trợ. |
| `frontend/user-web/app/(dashboard)/support/_components/FaqAccordion.tsx` | Câu hỏi thường gặp. |
| `frontend/user-web/app/(dashboard)/support/_components/ContactSupportCard.tsx` | Các kênh tự hỗ trợ theo nghiệp vụ. |
| `frontend/user-web/app/(dashboard)/support/_styles/support.styles.ts` | Style riêng của hỗ trợ. |

### Thành phần dùng chung và hạ tầng

| File | Mục đích |
|---|---|
| `frontend/user-web/components/layout/DashboardLayout.tsx` | Sidebar, header, hồ sơ và bảo vệ phiên. |
| `frontend/user-web/components/ui/ui.tsx` | Primitive PageHead, Panel, Field, Modal, Alert, Loading, ErrorState và Empty. |
| `frontend/user-web/components/ui/CategoryIcon.tsx` | Icon, màu và bộ chọn danh mục dùng chung. |
| `frontend/user-web/components/ui/Motion.jsx`, `Motion.d.ts` | Hiệu ứng dùng chung và khai báo TypeScript. |
| `frontend/user-web/components/ui/Toast.jsx`, `Toast.d.ts` | Toast dùng chung và khai báo TypeScript. |
| `frontend/user-web/lib/api.ts` | Axios client, JWT và refresh token khi 401. |
| `frontend/user-web/lib/finance.ts` | Kiểu tài chính, định dạng và CSV an toàn. |
| `frontend/user-web/hooks/useMotionAllowed.ts` | Theo dõi prefers-reduced-motion an toàn với SSR. |
| `frontend/user-web/tests/api.test.ts` | Hồi quy refresh token và lỗi API. |
| `frontend/user-web/tests/finance.test.ts` | Hồi quy định dạng và chống CSV injection. |
| `frontend/user-web/.dockerignore`, `.gitignore` | Loại cache, secret và artifact khỏi Docker/Git. |
| `frontend/user-web/AGENTS.md`, `CLAUDE.md` | Quy tắc framework/coding-agent của workspace. |
| `frontend/user-web/Dockerfile` | Build và chạy Next.js standalone. |
| `frontend/user-web/eslint.config.mjs` | Cấu hình ESLint. |
| `frontend/user-web/next.config.ts` | Cấu hình Next.js. |
| `frontend/user-web/package.json`, `package-lock.json` | Script, dependency trực tiếp và khóa dependency. |
| `frontend/user-web/postcss.config.mjs` | Cấu hình PostCSS/Tailwind. |
| `frontend/user-web/tsconfig.json` | TypeScript và alias `@/`. |
| `frontend/user-web/vitest.config.mts` | Cấu hình unit test. |

### File/thư mục không phải source cần bảo trì

| Đường dẫn | Phân loại | Có thể xóa? | Điều kiện an toàn |
|---|---|---|---|
| `frontend/user-web/.next/` | Build output/cache Next.js. | Có. | Dừng tiến trình Next trước; lần chạy sau sẽ build lại. |
| `frontend/user-web/tsconfig.tsbuildinfo` | Cache incremental TypeScript. | Có. | Chỉ làm lần typecheck kế tiếp chậm hơn. |
| `frontend/user-web/node_modules/` | Dependency đã cài. | Có điều kiện. | Chỉ xóa khi sẽ chạy lại `npm ci`; không phải file rác runtime. |
| `frontend/user-web/.vscode/` | Thiết lập editor cục bộ, không được Git theo dõi. | Có nếu không dùng. | Không ảnh hưởng ứng dụng. |
| `frontend/user-web/data/uploads/` | Dữ liệu runtime/upload cục bộ. | Không xóa hàng loạt. | Cần retention, backup và xác minh dữ liệu người dùng. |
| `frontend/user-web/.env` | Cấu hình môi trường/secret cục bộ. | Không. | Xóa có thể làm sai API URL hoặc môi trường chạy. |
| `frontend/user-web/tests/`, `vitest.config.mts` | Hàng rào hồi quy, không vào bundle production. | Không. | Bắt buộc giữ trong quá trình tái cấu trúc. |

## Thiết kế dùng chung

| File | Mục đích |
|---|---|
| `frontend/shared/CategoryIcon.tsx` | Nguồn chuẩn cho icon, màu và bộ chọn danh mục dùng giữa các frontend. |
| `frontend/shared/finance.ts` | Nguồn chuẩn cho kiểu tài chính, định dạng và xuất CSV dùng giữa các frontend. |
| `frontend/shared/Motion.jsx` | Nguồn chuẩn cho các hiệu ứng chuyển động dùng chung. |
| `frontend/shared/Toast.jsx` | Nguồn chuẩn cho toast tự biến mất và animation dùng chung. |
| `frontend/shared/swiss.css` | Nguồn chuẩn của design tokens và phong cách Swiss Platinum/Cobalt. |
| `frontend/shared/sync-design.mjs` | Đồng bộ ba tài nguyên thiết kế dùng chung sang hai frontend. |
