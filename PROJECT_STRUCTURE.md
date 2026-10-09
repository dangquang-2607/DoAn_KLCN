# Cây cấu trúc dự án CapitalFlow

> Cập nhật sơ đồ backend ngày 07/10/2026. Phần cây frontend bên dưới là ảnh chụp cũ; cấu trúc frontend hiện hành xem `frontend/README.md`.

> Ngày 09/10/2026: phần nghiệm thu/demo được gom vào `nghiem_thu/`.
> `qa/` → `nghiem_thu/qa/`; `scripts/demo/` → `nghiem_thu/scripts/demo/`;
> `compose.demo.yml` và `.demo.local.json` → bên trong `nghiem_thu/`;
> upload demo mới nằm ở `nghiem_thu/demo-uploads/`. Mã nguồn API/database/frontend không đổi.
> Xem [lệnh chạy hiện tại](nghiem_thu/README.md). Bằng chứng cũ giữ nguyên đường dẫn lịch sử.

## Cách đọc

- Phần trước dấu `#` là cây thư mục; phần sau là mục đích của thành phần.
- `[LOCAL]` chỉ tồn tại trên máy; `[GENERATED]` có thể tái tạo; `[SENSITIVE]` có thể chứa secret hoặc dữ liệu người dùng.
- Nội dung dependency, cache, Git metadata và upload được thu gọn; cây backend được nhóm theo tab; cấu hình, tài liệu và migration khác được liệt kê ở dưới.
- Không commit `.env`, dump database, upload, cache hoặc build output.

## Tra cứu nhanh khi giảng viên hoặc hội đồng hỏi

### Khởi động và kiến trúc backend

- **“Ứng dụng FastAPI được tạo ở đâu?”** → `capitalflow-api/app/khoi_dong/tao_ung_dung.py`; `app/main.py` chỉ export đối tượng `app`.

- **“Router của các module được gắn vào API ở đâu?”** → `app/khoi_dong/routes.py`; router của tài chính, đăng nhập, hóa đơn, danh mục và quản trị nằm tại thư mục sở hữu trong `app/chuc_nang/`.

- **“Code chạy lúc server khởi động/tắt nằm ở đâu?”** → `app/khoi_dong/vong_doi.py`.

- **“Xử lý lỗi chung và health check ở đâu?”** → `app/khoi_dong/bo_xu_ly.py` và `app/khoi_dong/trang_thai.py`.

- **“Biến môi trường được đọc ở đâu?”** → `app/dung_chung/config.py`; giá trị thật nằm trong `capitalflow-api/.env`, không đưa lên Git.

- **“Kết nối SQL Server và tạo DB session ở đâu?”** → `app/dung_chung/database/ket_noi.py`, `session.py`; metadata ORM được gom bởi `dang_ky_mo_hinh.py`.

- **“API lấy người dùng hiện tại hoặc kiểm tra quyền admin ở đâu?”** → `app/dung_chung/http/phu_thuoc.py`.

- **“Giới hạn upload, rate limit và audit request ở đâu?”** → `app/dung_chung/http/trung_gian/gioi_han_noi_dung.py`, `gioi_han_tan_suat.py`, `trung_gian/kiem_toan.py`.

### Đăng nhập và bảo mật

- **“Đăng ký, đăng nhập, refresh token, đăng xuất và OTP ở đâu?”** → endpoint trong `chuc_nang/nguoi_dung/dang_nhap/api/routes.py`.

- **“Quên mật khẩu hoặc mật khẩu tạm xử lý ở đâu?”** → `chuc_nang/nguoi_dung/dang_nhap/nghiep_vu/khoi_phuc_mat_khau.py`; UI nằm ở `frontend/user-web/src/chuc-nang/dang-nhap/thanh-phan/ForgotPasswordModal.tsx` và `FirstTimePasswordModal.tsx`.

- **“Quản lý các phiên đăng nhập ở đâu?”** → `session_management.py`; phía giao diện là `user-web/src/chuc-nang/cai-dat-bao-mat/thanh-phan/SessionManager.tsx`.

- **“Access/refresh token được tạo và thu hồi ở đâu?”** → `chuc_nang/nguoi_dung/dang_nhap/nghiep_vu/tokens.py`, model `luu_tru/refresh_token.py`, primitive JWT tại `app/dung_chung/security/tokens.py`.

- **“Mật khẩu được hash/verify ở đâu?”** → `app/dung_chung/security/passwords.py`.

- **“Model và schema người dùng nằm ở đâu?”** → `chuc_nang/nguoi_dung/dang_nhap/luu_tru/nguoi_dung.py` và `schemas/auth.py`.

- **“Frontend bảo vệ route người dùng/admin ở đâu?”** → `frontend/user-web/src/dung-chung/layouts/DashboardLayout.tsx` và `frontend/admin-web/src/dung-chung/xac-thuc/ProtectedRoute.jsx`.

### Tài khoản, giao dịch và ngân sách

- **“CRUD tài khoản/ví và số dư ở đâu?”** → backend `chuc_nang/nguoi_dung/tai_chinh/vi_tai_khoan/api.py`, schema `vi_tai_khoan/schemas.py`, model `vi_tai_khoan/luu_tru/account.py`; UI tại `user-web/src/chuc-nang/vi-tai-khoan/`.

- **“Liên kết ngân hàng mô phỏng, OTP và đồng bộ giao dịch ở đâu?”** → backend `chuc_nang/nguoi_dung/tai_chinh/vi_tai_khoan/bank.py`; giao diện từng bước trong `user-web/src/chuc-nang/vi-tai-khoan/thanh-phan/BankConnection.tsx`. Đây là dữ liệu demo, không kết nối ngân hàng thật.

- **“Mục tiêu tiết kiệm, thông báo và không tính vào tổng ở đâu?”** → form nhập tại `AccountModal.tsx`, tiến độ/hạn và trạng thái ví trong `AccountDetailsModal.tsx` mở từ card gọn `AccountCard.tsx`; chuông tại `user-web/src/dung-chung/thong-bao/NotificationCenter.tsx`, API tại `chuc_nang/nguoi_dung/tai_chinh/thong_bao/api.py`, sinh thông báo qua `thong_bao/dich_vu.py`, loại khỏi tổng tài sản tại `bao_cao_tai_chinh/dashboard.py`.

- **“Thông báo được phát từ chức năng nào và lưu ở đâu?”** → biến động số dư/mục tiêu tại `tai_chinh/vi_tai_khoan/luu_tru/account.py`; ngân sách và khoản chi lớn tại `tai_chinh/giao_dich/so_cai.py` cùng `tai_chinh/thong_bao/dich_vu.py`; trạng thái ngân hàng demo tại `tai_chinh/vi_tai_khoan/bank.py`; đổi/đặt lại mật khẩu tại `dang_nhap/api/routes.py`. Bản ghi lưu ở `tai_chinh/thong_bao/luu_tru/thong_bao.py`, hiển thị tại `user-web/src/dung-chung/thong-bao/NotificationCenter.tsx`.

- **“Tạo/sửa/xóa một hoặc nhiều giao dịch ở đâu?”** → endpoint `chuc_nang/nguoi_dung/tai_chinh/giao_dich/api.py` (POST `/batch-delete`, DELETE theo ID; tạo/sửa khoản chi còn xếp job kiểm tra ngưỡng ngân sách); `chuc_nang/nguoi_dung/tai_chinh/giao_dich/so_cai.py` xóa nguyên tử, mở rộng cặp chuyển tiền, tính lại số dư ví tự quản, giữ số dư nguồn ngân hàng và trả hóa đơn OCR về kiểm duyệt. Checkbox/thanh Xóa ở `user-web/src/chuc-nang/giao-dich/page.tsx` và `TransactionTable.tsx`.

- **“Chuyển tiền giữa hai tài khoản ở đâu?”** → endpoint transfer trong `tai_chinh/giao_dich/api.py`, tính nguyên tử và cập nhật hai số dư trong `tai_chinh/giao_dich/so_cai.py`; UI tại `TransferModal.tsx`.

- **“Làm sao tránh ghi giao dịch hai lần?”** → `chuc_nang/nguoi_dung/tai_chinh/giao_dich/luy_dang.py` và model `luu_tru/ban_ghi_luy_dang.py`.

- **“Dữ liệu giao dịch được lưu bằng model nào?”** → `chuc_nang/nguoi_dung/tai_chinh/giao_dich/luu_tru/giao_dich.py`.

- **“CRUD, tự chuyển kỳ và lịch sử ngân sách ở đâu?”** → `chuc_nang/nguoi_dung/tai_chinh/ngan_sach/api.py` nhận tạo/sửa/tạm dừng/kết thúc và lịch sử theo năm; `ngan_sach/ky_han.py` xác định kỳ tuần/tháng/năm, phiên bản hạn mức, ngày tạm dừng và cộng khoản chi; `ngan_sach/schemas.py` định nghĩa API, `ngan_sach/luu_tru/ngan_sach.py` lưu cấu hình và thay đổi có ngày hiệu lực; UI tại `user-web/src/chuc-nang/ngan-sach/`.

- **“Dashboard người dùng lấy số liệu ở đâu?”** → `chuc_nang/nguoi_dung/tai_chinh/bao_cao_tai_chinh/dashboard.py`; các phép tổng hợp chung trong `bao_cao_tai_chinh/dich_vu.py`.

- **“Biểu đồ phân tích và xuất CSV ở đâu?”** → backend `chuc_nang/nguoi_dung/tai_chinh/bao_cao_tai_chinh/phan_tich.py`; frontend `user-web/src/chuc-nang/bao-cao-tai-chinh/`; helper CSV tại `frontend/user-web/src/dung-chung/tien-ich/finance.ts`.

- **“Ngày nhập/hiển thị dd/mm/yyyy ở đâu?”** → ô nhập dùng chung `user-web/src/dung-chung/UI-chung/DateInput.tsx` (lọc chữ, tự chèn `/`, giữ ISO cho API), helper `dateLabel`, `formatDateForDisplay`, `formatDateForTyping`, `parseDateForApi` tại `user-web/src/dung-chung/tien-ich/finance.ts`; cổng admin dùng `admin-web/src/dung-chung/tien-ich/format.ts` để định dạng ngày.

### Hóa đơn và OCR

- **“Upload, xem, chạy OCR, xác nhận hoặc xóa hóa đơn ở đâu?”** → `chuc_nang/nguoi_dung/hoa_don_ai/api/routes.py`.

- **“Phát hiện hóa đơn trùng ở đâu?”** → `chuc_nang/nguoi_dung/hoa_don_ai/nghiep_vu/phat_hien_trung_lap.py`.

- **“Chuẩn hóa kết quả OCR thành dữ liệu hóa đơn ở đâu?”** → `chuc_nang/nguoi_dung/hoa_don_ai/nghiep_vu/phan_tich_du_lieu.py`.

- **“Tích hợp Gemini AI ở đâu?”** → `chuc_nang/nguoi_dung/hoa_don_ai/ha_tang/gemini.py`.

- **“Đọc hóa đơn điện tử XML ở đâu?”** → `chuc_nang/nguoi_dung/hoa_don_ai/ha_tang/invoice_xml.py`.

- **“Xóa hóa đơn và file liên quan ở đâu?”** → `chuc_nang/nguoi_dung/hoa_don_ai/nghiep_vu/deletion.py`.

- **“Trạng thái hóa đơn, dòng hàng và job OCR lưu ở đâu?”** → `luu_tru/invoice.py`, `invoice_item.py`, `tac_vu_ocr.py`.

- **“Hàng đợi nền và worker OCR chạy ở đâu?”** → `dung_chung/tac_vu_nen/hang_doi.py`, `trinh_chay.py`, model `luu_tru/tac_vu_nen.py`.

- **“Màn hình OCR người dùng nằm ở đâu?”** → `frontend/user-web/src/chuc-nang/hoa-don-ai/page.tsx`; upload, queue và form duyệt nằm trong thư mục con `thanh-phan/`.

- **“Admin giám sát/retry OCR ở đâu?”** → backend `chuc_nang/quan_tri/giam_sat_hoa_don/api.py`; frontend `admin-web/src/chuc-nang/giam-sat-hoa-don/OcrMonitor.jsx`.

### Danh mục và email

- **“Người dùng CRUD, ẩn/khôi phục hoặc xin gợi ý danh mục ở đâu?”** → `chuc_nang/nguoi_dung/danh_muc/api.py` (lọc active/archived/all, tạo trùng danh mục ẩn trả lời mời khôi phục, restore giữ ID cũ); thuật toán gợi ý chỉ dùng danh mục hoạt động nằm trong `phan_loai.py`.

- **“Danh mục đã ẩn được tìm và sử dụng lại ở đâu?”** → `user-web/src/chuc-nang/danh-muc/page.tsx` (tab Đang dùng/Đã ẩn); xác nhận khôi phục dùng chung với tạo nhanh trong OCR tại `user-web/src/dung-chung/nghiep-vu/danh-muc/CategoryRestoreModal.tsx`, nhận diện lỗi trùng đã ẩn tại `user-web/src/dung-chung/nghiep-vu/danh-muc/categories.ts`.

- **“Danh mục được lưu ở đâu?”** → `chuc_nang/nguoi_dung/danh_muc/luu_tru/danh_muc.py`; kiểu request/response tại `schemas.py`.

- **“Admin quản lý và sắp xếp danh mục ở đâu?”** → backend `chuc_nang/quan_tri/danh_muc_he_thong/api.py`; frontend `admin-web/src/chuc-nang/danh-muc-he-thong/Categories.jsx`.

- **“Gửi email qua SMTP ở đâu?”** → `dung_chung/email/dich_vu.py`; lịch sử và cấu hình lưu ở `luu_tru/nhat_ky_email.py`, `cau_hinh_he_thong.py`.

- **“Admin xem log email hoặc sửa SMTP ở đâu?”** → backend `chuc_nang/quan_tri/email_cau_hinh/api.py`; frontend `admin-web/src/chuc-nang/email-cau-hinh/EmailLogs.jsx`.

### Quản trị hệ thống

- **“Admin xem/sửa/khóa/mở khóa người dùng ở đâu?”** → `chuc_nang/quan_tri/nguoi_dung/api.py`; giao diện tại `admin-web/src/chuc-nang/nguoi-dung/Users.jsx`.

- **“Xóa tài khoản, khôi phục hoặc theo dõi tiến trình xóa ở đâu?”** → `chuc_nang/quan_tri/nguoi_dung/vong_doi/api.py`, nghiệp vụ tại `dich_vu.py`, trạng thái tại `luu_tru/xoa_nguoi_dung.py`.

- **“Audit log được ghi và truy vấn ở đâu?”** → middleware `app/dung_chung/http/trung_gian/kiem_toan.py`, model `chuc_nang/quan_tri/nhat_ky_quan_tri/luu_tru/nhat_ky.py`, API `chuc_nang/quan_tri/nhat_ky_quan_tri/api.py`, UI `admin-web/src/chuc-nang/nhat-ky-quan-tri/AuditLogs.jsx`.

- **“Dashboard và analytics quản trị lấy dữ liệu ở đâu?”** → `chuc_nang/quan_tri/bang_dieu_khien/api.py` và `chuc_nang/quan_tri/phan_tich_van_hanh/api.py`; UI tại `Dashboard.jsx` và `SystemAnalytics.jsx`.

- **“Các route của admin web được khai báo ở đâu?”** → `frontend/admin-web/src/App.jsx`.

- **“Admin web gọi backend và quản lý token ở đâu?”** → `frontend/admin-web/src/dung-chung/connect-api/api.js`.

### Database và triển khai

- **“Schema hiện hành và migration mới nằm ở đâu?”** → `capitalflow-database/CURRENT_SCHEMA.md`, `alembic/env.py`, `alembic/versions/`.

- **“Migration cũ nằm ở đâu?”** → `capitalflow-database/archive/pre_baseline_202609/`; chỉ tham khảo, không dùng làm luồng migration mới.

- **“Seed và công cụ vận hành database ở đâu?”** → `capitalflow-database/tools/seed.py`, các script `apply_*`, `export_live_baseline.py` và `repair_unicode.py`.

- **“Docker build và compose ở đâu?”** → Dockerfile/compose trong từng ứng dụng; `docker-compose.yml` ở gốc điều phối hai frontend.

## Cây Explorer có chú thích

```text
DoAn_KLCN/                                                      # Workspace CapitalFlow: backend, database và hai frontend
├── .git/                                                       # [LOCAL/GENERATED] Metadata và lịch sử Git; không chỉnh sửa thủ công
├── capitalflow-api/                                            # Backend FastAPI, worker, kiểm thử và tài liệu vận hành
│   ├── .venv/                                                  # [LOCAL/GENERATED] Môi trường Python; dependency bên trong được thu gọn
│   ├── .vscode/                                                # [LOCAL] Cấu hình VS Code cho backend
│   │   └── settings.json                                       # [LOCAL] Thiết lập Python, format và phân tích mã
│   │
│   ├── app/                                                    # Mã nguồn runtime backend
│   │   ├── main.py                                             # Điểm vào ASGI ổn định
│   │   ├── khoi_dong/                                          # FastAPI, lifespan, health và router
│   │   ├── chuc_nang/
│   │   │   ├── nguoi_dung/
│   │   │   │   ├── dang_nhap/                                  # Đăng nhập, OTP, mật khẩu, phiên
│   │   │   │   ├── danh_muc/                                   # Danh mục thu/chi và phân loại
│   │   │   │   ├── hoa_don_ai/                                 # Upload, XML, OCR và duyệt hóa đơn
│   │   │   │   └── tai_chinh/
│   │   │   │       ├── vi_tai_khoan/                           # Ví và ngân hàng mô phỏng
│   │   │   │       ├── giao_dich/                              # Giao dịch, chuyển tiền, ghi sổ
│   │   │   │       ├── ngan_sach/                              # Kỳ và hạn mức ngân sách
│   │   │   │       ├── bao_cao_tai_chinh/                      # Dashboard, phân tích, CSV
│   │   │   │       └── thong_bao/                              # Thông báo tài chính
│   │   │   └── quan_tri/
│   │   │       ├── bang_dieu_khien/                           # KPI quản trị
│   │   │       ├── phan_tich_van_hanh/                        # Phân tích hệ thống
│   │   │       ├── nguoi_dung/                                # Quản lý và vòng đời người dùng
│   │   │       ├── danh_muc_he_thong/                         # Danh mục hệ thống
│   │   │       ├── giam_sat_hoa_don/                          # Giám sát OCR
│   │   │       ├── nhat_ky_quan_tri/                          # Audit log
│   │   │       ├── email_cau_hinh/                            # SMTP và nhật ký email
│   │   │       └── dung_chung/                                # Helper admin
│   │   └── dung_chung/
│   │       ├── database/                                 # Kết nối, lớp nền và đăng ký mô hình
│   │       ├── security/                                       # Token, mật khẩu, secret
│   │       ├── http/                                          # Dependency và middleware
│   │       ├── email/                                         # Dịch vụ email dùng chung
│   │       ├── tac_vu_nen/                                   # Queue và worker
│   │       ├── quan_sat/                                     # Telemetry
│   │       └── text/                                      # Chuẩn hóa Unicode
│   │
│   ├── docs/                                                   # Tài liệu kiến trúc, tính năng và vận hành
│   │   ├── architecture/                                       # Tài liệu quyết định và cấu trúc kiến trúc
│   │   │   ├── backend-refactor-baseline.md                    # Ghi lại hiện trạng và quyết định trước/sau khi tái cấu trúc backend
│   │   │   └── capitalflow-api-structure.md                    # Giải thích kiến trúc module, dependency và quy tắc thêm code backend
│   │   │
│   │   ├── features/                                           # Tài liệu tính năng
│   │   │   └── auto-category-classification.md                 # Mô tả thuật toán gợi ý danh mục và hợp đồng API liên quan
│   │   │
│   │   ├── operations/                                         # Runbook triển khai/vận hành
│   │   │   └── docker-sql-server.md                            # Runbook chạy API với SQL Server bằng Docker
│   │   │
│   │   └── releases/                                           # Ghi chú phát hành
│   │       └── resilience-release.md                           # Ghi chú các cơ chế retry, idempotency và phục hồi lỗi
│   │
│   ├── scripts/                                                # Công cụ chạy thủ công ngoài runtime API
│   │   ├── deployment/                                         # Chẩn đoán và smoke test triển khai.
│   │   │   ├── __init__.py
│   │   │   ├── diagnose.py                                     # Thu thập tín hiệu chẩn đoán deployment
│   │   │   └── verify_docker.py                                # Smoke-check backend trong Docker
│   │
│   ├── uploads/                                                # [LOCAL/SENSITIVE] Hóa đơn và email preview; không liệt kê nội dung
│   ├── .dockerignore                                           # Loại cache, secret và file thừa khỏi Docker build context
│   ├── .env                                                    # [LOCAL/SENSITIVE] Secret và biến môi trường thật của backend
│   ├── .env.docker.example                                     # Mẫu biến môi trường khi chạy backend trong Docker
│   ├── .env.example                                            # Mẫu biến môi trường khi chạy backend trực tiếp
│   ├── .gitignore                                              # Loại file cục bộ, secret và artifact khỏi Git
│   ├── docker-compose.yml                                      # Cấu hình YAML cho docker compose
│   ├── Dockerfile                                              # Đóng gói FastAPI và worker thành Docker image
│   ├── pyrefly.toml                                            # Cấu hình kiểm tra kiểu Python bằng Pyrefly
│   ├── pyrightconfig.json                                      # Cấu hình JSON cho pyrightconfig
│   ├── README.md                                               # Hướng dẫn riêng cho khu vực này: cách chạy, quy ước và lưu ý vận hành
│   └── requirements.txt                                        # Dependency Python cần cho runtime production
|
|
|
|
├── capitalflow-database/                                       # Alembic, baseline và công cụ quản trị SQL Server
│   ├── alembic/                                                # Môi trường migration Alembic hiện hành
│   │   ├── versions/                                           # Các revision Alembic
│   │   │   ├── cfdb_20260924_baseline.py                       # Baseline đầy đủ của 17 bảng nghiệp vụ, sinh từ schema SQL Server thật.
│   │   │   ├── cfdb_notifications.py                           # Tạo bảng thông báo và chuyển lịch sử ví kèm trạng thái đã đọc.
│   │   │   ├── cfdb_recurring_budgets.py                       # Thêm chế độ định kỳ và lịch thay đổi ngân sách, giữ nguyên dữ liệu ngân sách có ngày cố định.
│   │   │   ├── cfdb_wallet_accounts.py                         # Thêm trường ví/mục tiêu/trạng thái kết nối mô phỏng, mở rộng loại ví và khóa duy nhất giao dịch ngân hàng; giữ nguyên dữ liệu cũ.
│   │   │   └── da10f25d5743_legacy_marker.py                   # Cầu nối nhận diện baseline rỗng của hệ Alembic cũ.
│   │   ├── env.py                                              # Nạp metadata ORM, URL SQL Server và loại bảng điều khiển khỏi autogenerate.
│   │   ├── README                                              # Hướng dẫn riêng cho khu vực này: cách chạy, quy ước và lưu ý vận hành
│   │   └── script.py.mako                                      # Mẫu revision có comment tiếng Việt.
│   ├── archive/                                                # Kho migration lịch sử
│   │   └── pre_baseline_202609/                                # Lịch sử SQL, wrapper và Alembic cũ; không dùng để vận hành hiện hành.
│   │       ├── alembic_legacy/                                 # Môi trường Alembic cũ chỉ để tham chiếu
│   │       │   ├── versions/                                   # Các revision Alembic
│   │       │   │   └── da10f25d5743_baseline.py                # Revision baseline Alembic cũ để tham chiếu lịch sử
│   │       │   ├── alembic.ini                                 # Cấu hình kết nối, logging và vị trí revision Alembic legacy
│   │       │   ├── env.py                                      # Bootstrap môi trường Alembic legacy
│   │       │   ├── README                                      # Hướng dẫn riêng cho khu vực này: cách chạy, quy ước và lưu ý vận hành
│   │       │   └── script.py.mako                              # Template Alembic dùng để sinh nội dung revision legacy
│   │       ├── runners/                                        # Runner Python cho migration cũ
│   │       │   ├── apply_sql_migration.py                      # Runner áp dụng migration SQL legacy có kiểm soát
│   │       │   ├── migrate_auto_category_classification.py     # Runner migration legacy: auto category classification
│   │       │   ├── migrate_category_management.py              # Runner migration legacy: category management
│   │       │   ├── migrate_database_cleanup.py                 # Runner migration legacy: database cleanup
│   │       │   ├── migrate_financial_integrity.py              # Runner migration legacy: financial integrity
│   │       │   ├── migrate_invoice_review_fields.py            # Runner migration legacy: invoice review fields
│   │       │   ├── migrate_remove_unused_columns.py            # Runner migration legacy: remove unused columns
│   │       │   ├── migrate_resilience.py                       # Runner migration legacy: resilience
│   │       │   └── migrate_user_deletion.py                    # Runner migration legacy: user deletion
│   │       ├── sql/                                            # Các migration SQL lịch sử
│   │       │   ├── 20260910_financial_integrity.sql            # DDL/migration SQL lịch sử: 20260910 financial integrity
│   │       │   ├── 20260914_user_deletion.sql                  # DDL/migration SQL lịch sử: 20260914 user deletion
│   │       │   ├── 20260915_invoice_review_fields.sql          # DDL/migration SQL lịch sử: 20260915 invoice review fields
│   │       │   ├── 20260916_category_management.sql            # DDL/migration SQL lịch sử: 20260916 category management
│   │       │   ├── 20260917_auto_category_classification.sql   # DDL/migration SQL lịch sử: 20260917 auto category classification
│   │       │   ├── 20260918_database_cleanup.sql               # DDL/migration SQL lịch sử: 20260918 database cleanup
│   │       │   ├── 20260918_remove_unused_columns.sql          # DDL/migration SQL lịch sử: 20260918 remove unused columns
│   │       │   ├── 20260918_worker_lane_index.sql              # DDL/migration SQL lịch sử: 20260918 worker lane index
│   │       │   └── legacy_clean_install_schema.sql             # DDL/migration SQL lịch sử: legacy clean install schema
│   │       └── README.md                                       # Hướng dẫn riêng cho khu vực này: cách chạy, quy ước và lưu ý vận hành
│   ├── tools/                                                  # Công cụ seed, repair và áp dụng migration database
│   │   ├── apply_notifications.py                              # Preflight, backup COPY_ONLY, RESTORE VERIFYONLY, nâng migration và đối chiếu dữ liệu.
│   │   ├── apply_recurring_budgets.py                          # Backup đã kiểm tra rồi nâng schema định kỳ trên personal_finance và đối chiếu số bản ghi.
│   │   ├── export_live_baseline.py                             # Phản chiếu schema live và sinh baseline tự chứa, không xuất dữ liệu.
│   │   ├── repair_unicode.py                                   # Dry-run/apply sửa mojibake theo ánh xạ có audit.
│   │   └── seed.py                                             # Seed danh mục hệ thống và tùy chọn khoi_dong admin.
│   ├── .gitignore                                              # Loại file cục bộ, secret và artifact khỏi Git
│   ├── alembic.ini                                             # Cấu hình Alembic độc lập khỏi runtime FastAPI.
│   ├── CURRENT_SCHEMA.md                                       # Kiểm kê database thật, version và schema drift đã phát hiện.
│   ├── README.md                                               # Quy trình Alembic và chính sách bắt buộc xác nhận trước thao tác phá hủy.
│   └── requirements.txt                                        # Dependency cho Alembic và công cụ database, tái sử dụng model API.
|
|
|
|
├── frontend/                                                   # Hai giao diện người dùng và quản trị, cùng thư viện UI dùng chung.
│   ├── admin-web/                                              # Cổng quản trị dùng React/Vite; định tuyến tại src/App.jsx.
│   │   ├── public/                                             # Tài nguyên tĩnh được phục vụ trực tiếp cho trình duyệt.
│   │   │   └── favicon.svg                                     # Biểu tượng ứng dụng hiển thị trên tab trình duyệt.
│   │   ├── src/                                                # Mã nguồn của ứng dụng.
│   │   │   ├── chuc-nang/                                      # Nhóm mã theo từng chức năng trên thanh điều hướng.
│   │   │   │   ├── bang-dieu-khien/                            # Trang tổng quan và chỉ số vận hành dành cho quản trị.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   ├── admin-workspace.css                 # Kiểu dáng bố cục và thành phần của giao diện quản trị.
│   │   │   │   │   │   ├── workspace-live.css                  # Kiểu dáng bổ sung cho các thành phần làm việc của quản trị.
│   │   │   │   │   │   └── workspace-pages.css                 # Kiểu dáng các trang chức năng quản trị.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── DashboardStats.jsx                  # Hiển thị các chỉ số tổng quan của quản trị.
│   │   │   │   │   │   ├── InvoiceProgressWidget.jsx           # Hiển thị tiến độ xử lý hóa đơn.
│   │   │   │   │   │   ├── OperationsCenter.jsx                # Tổng hợp tình trạng vận hành và các mục cần xử lý.
│   │   │   │   │   │   ├── QuickManagementLinks.jsx            # Liên kết nhanh tới các chức năng quản trị.
│   │   │   │   │   │   └── RecentAdminActivity.jsx             # Hiển thị các hoạt động quản trị gần đây.
│   │   │   │   │   ├── Dashboard.jsx                           # Ghép giao diện và dữ liệu cho trang tổng quan quản trị.
│   │   │   │   │   └── index.js                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   ├── cai-dat-bao-mat/                            # Cài đặt giao diện, tài khoản và bảo mật.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   ├── settings-workspace.css              # Kiểu dáng các bảng cài đặt quản trị.
│   │   │   │   │   │   └── workspace-sections.css              # Kiểu dáng các vùng nội dung trong giao diện quản trị.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── DisplayPreferencesPanel.jsx         # Bảng tùy chỉnh hiển thị giao diện.
│   │   │   │   │   │   └── EmailSettingsLink.jsx               # Liên kết từ trang cài đặt tới cấu hình email.
│   │   │   │   │   ├── index.js                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   │   └── Settings.jsx                            # Trang cài đặt giao diện và bảo mật của quản trị.
│   │   │   │   ├── dang-nhap/                                  # Đăng nhập và các thao tác khôi phục mật khẩu.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   └── login.css                           # Kiểu dáng trang đăng nhập quản trị.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── BruteForceLockout.jsx               # Hiển thị trạng thái khóa do đăng nhập sai nhiều lần.
│   │   │   │   │   │   ├── LampAnimation.jsx                   # Hiệu ứng đèn trang trí cho trang đăng nhập.
│   │   │   │   │   │   └── LoginForm.jsx                       # Biểu mẫu nhập thông tin và gửi yêu cầu đăng nhập.
│   │   │   │   │   ├── index.js                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   │   └── Login.jsx                               # Trang đăng nhập dành cho quản trị.
│   │   │   │   ├── danh-muc-he-thong/                          # Quản lý danh mục thu/chi dùng chung toàn hệ thống.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   ├── admin-workspace.css                 # Kiểu dáng bố cục và thành phần của giao diện quản trị.
│   │   │   │   │   │   ├── workspace-live.css                  # Kiểu dáng bổ sung cho các thành phần làm việc của quản trị.
│   │   │   │   │   │   └── workspace-sections.css              # Kiểu dáng các vùng nội dung trong giao diện quản trị.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── CategoryFilters.jsx                 # Bộ lọc danh sách danh mục hệ thống.
│   │   │   │   │   │   ├── CategoryList.jsx                    # Hiển thị danh sách danh mục hệ thống.
│   │   │   │   │   │   ├── CategoryModal.jsx                   # Hộp thoại tạo và chỉnh sửa danh mục hệ thống.
│   │   │   │   │   │   └── CategoryOrderControls.jsx           # Điều khiển thứ tự hiển thị danh mục.
│   │   │   │   │   ├── Categories.jsx                          # Trang quản lý danh mục hệ thống.
│   │   │   │   │   └── index.js                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   ├── email-cau-hinh/                             # Cấu hình SMTP và theo dõi lịch sử gửi email.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   ├── admin-workspace.css                 # Kiểu dáng bố cục và thành phần của giao diện quản trị.
│   │   │   │   │   │   ├── workspace-live.css                  # Kiểu dáng bổ sung cho các thành phần làm việc của quản trị.
│   │   │   │   │   │   └── workspace-sections.css              # Kiểu dáng các vùng nội dung trong giao diện quản trị.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── EmailDeliveryDetailModal.jsx        # Hộp thoại chi tiết một lần gửi email.
│   │   │   │   │   │   ├── EmailInspector.jsx                  # Bảng xem chi tiết bản ghi email đang chọn.
│   │   │   │   │   │   ├── EmailLogFilters.jsx                 # Bộ lọc lịch sử gửi email.
│   │   │   │   │   │   ├── EmailLogTable.jsx                   # Bảng lịch sử và trạng thái gửi email.
│   │   │   │   │   │   ├── SmtpModePanel.jsx                   # Hiển thị chế độ và trạng thái cấu hình gửi email.
│   │   │   │   │   │   ├── SmtpSettingsForm.jsx                # Biểu mẫu cấu hình máy chủ SMTP.
│   │   │   │   │   │   └── SmtpTestModal.jsx                   # Hộp thoại gửi email thử để kiểm tra cấu hình.
│   │   │   │   │   ├── xu-ly/                                  # Hàm xử lý, hook và kiểu dữ liệu riêng của chức năng.
│   │   │   │   │   │   └── emailStatus.js                      # Chuẩn hóa thông tin hiển thị trạng thái email.
│   │   │   │   │   ├── EmailLogs.jsx                           # Trang nhật ký email và cấu hình SMTP.
│   │   │   │   │   └── index.js                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   ├── giam-sat-hoa-don/                           # Giám sát trạng thái hóa đơn và xử lý OCR.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   ├── admin-workspace.css                 # Kiểu dáng bố cục và thành phần của giao diện quản trị.
│   │   │   │   │   │   ├── workspace-live.css                  # Kiểu dáng bổ sung cho các thành phần làm việc của quản trị.
│   │   │   │   │   │   └── workspace-pages.css                 # Kiểu dáng các trang chức năng quản trị.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── InvoiceStatusSummary.jsx            # Tổng hợp số hóa đơn theo trạng thái.
│   │   │   │   │   │   ├── ocr-status-donut.css                # Kiểu dáng biểu đồ vòng trạng thái OCR.
│   │   │   │   │   │   ├── OcrFailureTable.jsx                 # Bảng các tác vụ OCR gặp lỗi.
│   │   │   │   │   │   ├── OcrRetryButton.jsx                  # Nút yêu cầu chạy lại OCR.
│   │   │   │   │   │   ├── OcrStatsGrid.jsx                    # Các thẻ chỉ số thống kê OCR.
│   │   │   │   │   │   ├── OcrStatusDonut.jsx                  # Biểu đồ vòng thể hiện phân bố trạng thái OCR.
│   │   │   │   │   │   └── OcrWorkspace.jsx                    # Khung giao diện làm việc và theo dõi OCR.
│   │   │   │   │   ├── index.js                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   │   └── OcrMonitor.jsx                          # Trang giám sát hóa đơn và tác vụ OCR.
│   │   │   │   ├── nguoi-dung/                                 # Quản lý tài khoản và trạng thái người dùng.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   ├── admin-workspace.css                 # Kiểu dáng bố cục và thành phần của giao diện quản trị.
│   │   │   │   │   │   ├── workspace-live.css                  # Kiểu dáng bổ sung cho các thành phần làm việc của quản trị.
│   │   │   │   │   │   └── workspace-sections.css              # Kiểu dáng các vùng nội dung trong giao diện quản trị.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── index.js                            # Xuất tập trung các thành phần giao diện của chức năng.
│   │   │   │   │   │   ├── UserActionModal.jsx                 # Hộp thoại thao tác quản trị trên tài khoản người dùng.
│   │   │   │   │   │   ├── UserBulkBar.jsx                     # Thanh thao tác cho nhiều người dùng đã chọn.
│   │   │   │   │   │   ├── UserDetailModal.jsx                 # Hộp thoại xem thông tin chi tiết người dùng.
│   │   │   │   │   │   ├── UserFilters.jsx                     # Tìm kiếm và lọc danh sách người dùng.
│   │   │   │   │   │   ├── UserInspector.jsx                   # Bảng thông tin của người dùng đang chọn.
│   │   │   │   │   │   ├── UserRowActions.jsx                  # Các thao tác trên từng dòng người dùng.
│   │   │   │   │   │   └── UserTable.jsx                       # Bảng danh sách người dùng.
│   │   │   │   │   ├── xu-ly/                                  # Hàm xử lý, hook và kiểu dữ liệu riêng của chức năng.
│   │   │   │   │   │   └── utils.js                            # Hàm hỗ trợ cho chức năng quản lý người dùng.
│   │   │   │   │   ├── index.js                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   │   └── Users.jsx                               # Trang quản lý tài khoản người dùng.
│   │   │   │   ├── nhat-ky-quan-tri/                           # Tra cứu nhật ký hành động quản trị.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   ├── workspace-live.css                  # Kiểu dáng bổ sung cho các thành phần làm việc của quản trị.
│   │   │   │   │   │   └── workspace-pages.css                 # Kiểu dáng các trang chức năng quản trị.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── AuditDetailModal.jsx                # Hộp thoại xem chi tiết bản ghi kiểm toán.
│   │   │   │   │   │   ├── AuditInspector.jsx                  # Bảng xem bản ghi nhật ký đang chọn.
│   │   │   │   │   │   ├── AuditLogActions.jsx                 # Các thao tác trên nhật ký quản trị.
│   │   │   │   │   │   └── AuditLogTable.jsx                   # Bảng các bản ghi nhật ký quản trị.
│   │   │   │   │   ├── AuditLogs.jsx                           # Trang tra cứu nhật ký quản trị.
│   │   │   │   │   └── index.js                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   └── phan-tich-van-hanh/                         # Thống kê hoạt động và phân tích số liệu hệ thống.
│   │   │   │       ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │       │   ├── admin-workspace.css                 # Kiểu dáng bố cục và thành phần của giao diện quản trị.
│   │   │   │       │   ├── system-analytics.css                # Kiểu dáng trang phân tích vận hành.
│   │   │   │       │   └── workspace-live.css                  # Kiểu dáng bổ sung cho các thành phần làm việc của quản trị.
│   │   │   │       ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │       │   ├── analytics-volume-chart.css          # Kiểu dáng biểu đồ khối lượng hoạt động.
│   │   │   │       │   ├── AnalyticsPeriodFilter.jsx           # Bộ chọn khoảng thời gian phân tích vận hành.
│   │   │   │       │   ├── AnalyticsVolumeChart.jsx            # Biểu đồ khối lượng hoạt động theo thời gian.
│   │   │   │       │   ├── SystemMetricCards.jsx               # Các thẻ chỉ số thống kê hệ thống.
│   │   │   │       │   ├── TopCategoriesChart.jsx              # Biểu đồ các danh mục nổi bật.
│   │   │   │       │   └── TransactionCompositionWidget.jsx    # Hiển thị cơ cấu giao dịch.
│   │   │   │       ├── xu-ly/                                  # Hàm xử lý, hook và kiểu dữ liệu riêng của chức năng.
│   │   │   │       │   └── report-period.js                    # Tính khoảng thời gian dùng cho báo cáo quản trị.
│   │   │   │       ├── index.js                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │       └── SystemAnalytics.jsx                     # Trang phân tích hoạt động hệ thống.
│   │   │   ├── dung-chung/                                     # Thành phần và tiện ích dùng chung giữa các chức năng.
│   │   │   │   ├── connect-api/                                # Kết nối backend và xử lý token xác thực.
│   │   │   │   │   └── api.js                                  # API client quản trị, gửi request và xử lý token.
│   │   │   │   ├── layouts/                                    # Khung trang dùng chung: thanh điều hướng và phần đầu trang.
│   │   │   │   │   └── DashboardLayout.jsx                     # Khung quản trị với thanh điều hướng và đầu trang.
│   │   │   │   ├── nghiep-vu/                                  # Kiểu dữ liệu và hàm nghiệp vụ dùng giữa các chức năng.
│   │   │   │   │   ├── auditPresentation.js                    # Định dạng nội dung nhật ký để hiển thị.
│   │   │   │   │   └── finance.ts                              # Kiểu dữ liệu tài chính và nhãn loại tài khoản.
│   │   │   │   ├── styles/                                     # CSS nền, biến giao diện và kiểu dáng dùng chung.
│   │   │   │   │   ├── admin-workspace.css                     # Kiểu dáng bố cục và thành phần của giao diện quản trị.
│   │   │   │   │   ├── index.css                               # CSS nền và quy tắc giao diện quản trị.
│   │   │   │   │   ├── swiss.css                               # Biến và quy tắc thiết kế giao diện dùng chung.
│   │   │   │   │   ├── workspace-live.css                      # Kiểu dáng bổ sung cho các thành phần làm việc của quản trị.
│   │   │   │   │   ├── workspace-pages.css                     # Kiểu dáng các trang chức năng quản trị.
│   │   │   │   │   ├── workspace-responsive.css                # Điều chỉnh bố cục quản trị theo kích thước màn hình.
│   │   │   │   │   └── workspace-sections.css                  # Kiểu dáng các vùng nội dung trong giao diện quản trị.
│   │   │   │   ├── tien-ich/                                   # Hàm định dạng, xử lý lỗi và hook dùng chung.
│   │   │   │   │   ├── adminPresentation.js                    # Định dạng số, thời gian và màu trạng thái quản trị.
│   │   │   │   │   ├── format.js                               # Xuất lại các hàm định dạng và nhãn loại tài khoản.
│   │   │   │   │   ├── format.ts                               # Định dạng tiền, ngày, lỗi và xuất dữ liệu CSV.
│   │   │   │   │   ├── useDebouncedValue.js                    # Trì hoãn cập nhật giá trị khi người dùng nhập liên tục.
│   │   │   │   │   ├── useMotionAllowed.js                     # Hook xác định có cho phép hiệu ứng chuyển động.
│   │   │   │   │   └── useToast.js                             # Hook sử dụng thông báo toast.
│   │   │   │   ├── UI-chung/                                   # Các thành phần giao diện cơ bản dùng lại nhiều nơi.
│   │   │   │   │   ├── ActionMenu.jsx                          # Menu thao tác dùng chung.
│   │   │   │   │   ├── CategoryIcon.jsx                        # Hiển thị biểu tượng danh mục.
│   │   │   │   │   ├── CategoryIcon.tsx                        # Hiển thị biểu tượng danh mục.
│   │   │   │   │   ├── design.jsx                              # Các thành phần giao diện và trạng thái dùng chung.
│   │   │   │   │   ├── Inspector.jsx                           # Khung xem chi tiết đối tượng đang chọn.
│   │   │   │   │   ├── Motion.jsx                              # Các thành phần hiệu ứng chuyển động dùng chung.
│   │   │   │   │   ├── Toast.jsx                               # Hiển thị và quản lý thông báo toast.
│   │   │   │   │   └── WorkspaceHead.jsx                       # Phần đầu trang với tiêu đề và thao tác.
│   │   │   │   └── xac-thuc/                                   # Bảo vệ trang và quản lý mật khẩu, phiên đăng nhập.
│   │   │   │       ├── admin-workspace.css                     # Kiểu dáng bố cục và thành phần của giao diện quản trị.
│   │   │   │       ├── LoginSessions.jsx                       # Hiển thị và quản lý các phiên đăng nhập.
│   │   │   │       ├── ProtectedRoute.jsx                      # Kiểm tra xác thực trước khi mở trang quản trị.
│   │   │   │       ├── SecuritySettings.jsx                    # Biểu mẫu thay đổi thiết lập bảo mật tài khoản.
│   │   │   │       ├── sessionPresentation.js                  # Định dạng thông tin phiên đăng nhập.
│   │   │   │       ├── workspace-live.css                      # Kiểu dáng bổ sung cho các thành phần làm việc của quản trị.
│   │   │   │       └── workspace-sections.css                  # Kiểu dáng các vùng nội dung trong giao diện quản trị.
│   │   │   ├── App.jsx                                         # Khai báo route và tải các trang quản trị.
│   │   │   ├── main.jsx                                        # Khởi tạo React và nạp các stylesheet.
│   │   │   └── workspace.css                                   # Gom các import CSS theo thứ tự áp dụng.
│   │   ├── .dockerignore                                       # Loại tệp không cần thiết khỏi Docker build context.
│   │   ├── .gitignore                                          # Loại dependency, cache và tệp cục bộ khỏi Git.
│   │   ├── .oxlintrc.json                                      # Cấu hình quy tắc kiểm tra mã bằng Oxlint.
│   │   ├── Dockerfile                                          # Đóng gói ứng dụng thành Docker image.
│   │   ├── index.html                                          # Trang HTML gốc để React gắn giao diện.
│   │   ├── nginx.conf                                          # Cấu hình Nginx phục vụ giao diện quản trị.
│   │   ├── package-lock.json                                   # Khóa phiên bản chính xác của dependency npm.
│   │   ├── package.json                                        # Khai báo dependency và lệnh chạy, build, kiểm tra.
│   │   └── vite.config.js                                      # Cấu hình Vite cho ứng dụng quản trị.
│   ├── shared/                                                 # Nguồn thành phần UI được đồng bộ sang hai giao diện.
│   │   ├── CategoryIcon.tsx                                    # Hiển thị biểu tượng danh mục.
│   │   ├── Motion.jsx                                          # Các thành phần hiệu ứng chuyển động dùng chung.
│   │   ├── swiss.css                                           # Biến và quy tắc thiết kế giao diện dùng chung.
│   │   ├── sync-design.mjs                                     # Đồng bộ và kiểm tra các thành phần UI giữa hai giao diện.
│   │   └── Toast.jsx                                           # Hiển thị và quản lý thông báo toast.
│   ├── user-web/                                               # Cổng người dùng dùng Next.js App Router.
│   │   ├── .vscode/                                            # Thiết lập IDE cục bộ của dự án.
│   │   │   └── settings.json                                   # Thiết lập VS Code cho dự án.
│   │   ├── data/                                               # Thư mục dữ liệu cục bộ.
│   │   │   └── uploads/                                        # Nơi chứa tệp tải lên cục bộ.
│   │   ├── public/                                             # Tài nguyên tĩnh được phục vụ trực tiếp cho trình duyệt.
│   │   ├── src/                                                # Mã nguồn của ứng dụng.
│   │   │   ├── app/                                            # Khai báo route, layout và provider của Next.js.
│   │   │   │   ├── (dashboard)/                                # Nhóm trang dùng chung khung giao diện sau đăng nhập.
│   │   │   │   │   ├── accounts/                               # Đường dẫn /accounts cho trang ví và tài khoản.
│   │   │   │   │   │   └── page.tsx                            # Route Next.js dẫn tới trang ví và tài khoản.
│   │   │   │   │   ├── analytics/                              # Đường dẫn /analytics cho báo cáo tài chính.
│   │   │   │   │   │   └── page.tsx                            # Route Next.js dẫn tới trang báo cáo tài chính.
│   │   │   │   │   ├── budgets/                                # Đường dẫn /budgets cho trang ngân sách.
│   │   │   │   │   │   └── page.tsx                            # Route Next.js dẫn tới trang ngân sách.
│   │   │   │   │   ├── categories/                             # Đường dẫn /categories cho trang danh mục.
│   │   │   │   │   │   └── page.tsx                            # Route Next.js dẫn tới trang danh mục.
│   │   │   │   │   ├── ocr/                                    # Đường dẫn /ocr cho trang xử lý hóa đơn.
│   │   │   │   │   │   └── page.tsx                            # Route Next.js dẫn tới trang xử lý hóa đơn.
│   │   │   │   │   ├── settings/                               # Đường dẫn /settings cho trang cài đặt và bảo mật.
│   │   │   │   │   │   └── page.tsx                            # Route Next.js dẫn tới trang cài đặt và bảo mật.
│   │   │   │   │   ├── support/                                # Đường dẫn /support cho trung tâm hỗ trợ.
│   │   │   │   │   │   └── page.tsx                            # Route Next.js dẫn tới trang hỗ trợ.
│   │   │   │   │   ├── transactions/                           # Đường dẫn /transactions cho trang giao dịch.
│   │   │   │   │   │   └── page.tsx                            # Route Next.js dẫn tới trang giao dịch.
│   │   │   │   │   ├── layout.tsx                              # Áp dụng khung giao diện cho nhóm trang sau đăng nhập.
│   │   │   │   │   └── page.tsx                                # Route trang chủ dẫn tới chức năng tổng quan.
│   │   │   │   ├── login/                                      # Đường dẫn /login cho trang đăng nhập.
│   │   │   │   │   └── page.tsx                                # Route Next.js dẫn tới trang đăng nhập.
│   │   │   │   ├── favicon.ico                                 # Biểu tượng ứng dụng hiển thị trên tab trình duyệt.
│   │   │   │   ├── layout.tsx                                  # Layout gốc và cấu hình chung của ứng dụng Next.js.
│   │   │   │   └── providers.tsx                               # Gắn các provider dùng chung vào ứng dụng Next.js.
│   │   │   ├── chuc-nang/                                      # Nhóm mã theo từng chức năng trên thanh điều hướng.
│   │   │   │   ├── bao-cao-tai-chinh/                          # Báo cáo thu/chi, dòng tiền và biểu đồ phân tích.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   ├── analytics.module.css                # CSS đóng phạm vi cho trang báo cáo tài chính.
│   │   │   │   │   │   └── analytics.styles.ts                 # Các hằng kiểu dáng cho trang báo cáo tài chính.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── CashflowBarChart.tsx                # Biểu đồ cột so sánh dòng tiền thu và chi.
│   │   │   │   │   │   ├── CashflowSummaryTable.tsx            # Bảng tổng hợp số liệu dòng tiền.
│   │   │   │   │   │   ├── CategoryExpensePie.tsx              # Biểu đồ tròn phân bố chi tiêu theo danh mục.
│   │   │   │   │   │   ├── ReportCharts.tsx                    # Ghép các biểu đồ của báo cáo tài chính.
│   │   │   │   │   │   └── ReportPeriodFilter.tsx              # Bộ chọn kỳ và khoảng thời gian báo cáo.
│   │   │   │   │   ├── index.ts                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   │   └── page.tsx                                # Trang giao diện chính của chức năng báo cáo tài chính.
│   │   │   │   ├── cai-dat-bao-mat/                            # Cài đặt giao diện, tài khoản và bảo mật.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   └── SessionManager.tsx                  # Hiển thị và thu hồi phiên đăng nhập.
│   │   │   │   │   ├── index.ts                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   │   └── page.tsx                                # Trang giao diện chính của chức năng cài đặt và bảo mật.
│   │   │   │   ├── dang-nhap/                                  # Đăng nhập và các thao tác khôi phục mật khẩu.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   └── login.styles.ts                     # Các hằng kiểu dáng cho trang đăng nhập.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── FirstTimePasswordModal.tsx          # Yêu cầu đổi mật khẩu khi đăng nhập lần đầu.
│   │   │   │   │   │   ├── ForgotPasswordModal.tsx             # Luồng quên mật khẩu, xác minh OTP và đặt lại mật khẩu.
│   │   │   │   │   │   └── PasswordStrengthBar.tsx             # Hiển thị mức độ mạnh của mật khẩu.
│   │   │   │   │   ├── index.ts                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   │   └── page.tsx                                # Trang giao diện chính của chức năng đăng nhập.
│   │   │   │   ├── danh-muc/                                   # Quản lý danh mục thu/chi.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   └── categories.styles.ts                # Các hằng kiểu dáng cho trang danh mục.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── CategoryDeleteModal.tsx             # Hộp thoại xác nhận thao tác xóa hoặc ẩn danh mục.
│   │   │   │   │   │   ├── CategoryModal.tsx                   # Biểu mẫu tạo và chỉnh sửa danh mục.
│   │   │   │   │   │   └── CategoryTable.tsx                   # Bảng danh mục thu/chi của người dùng.
│   │   │   │   │   ├── index.ts                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   │   └── page.tsx                                # Trang giao diện chính của chức năng danh mục.
│   │   │   │   ├── giao-dich/                                  # Quản lý giao dịch và chuyển tiền giữa các ví.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   └── transactions.styles.ts              # Các hằng kiểu dáng cho trang giao dịch.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── TransactionDeleteModal.tsx          # Hộp thoại xác nhận xóa giao dịch.
│   │   │   │   │   │   ├── TransactionFilters.tsx              # Bộ lọc danh sách giao dịch.
│   │   │   │   │   │   ├── TransactionModal.tsx                # Biểu mẫu tạo và chỉnh sửa giao dịch.
│   │   │   │   │   │   ├── TransactionTable.tsx                # Bảng giao dịch và thao tác chọn nhiều dòng.
│   │   │   │   │   │   └── TransferModal.tsx                   # Biểu mẫu chuyển tiền giữa các tài khoản.
│   │   │   │   │   ├── index.ts                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   │   └── page.tsx                                # Trang giao diện chính của chức năng giao dịch.
│   │   │   │   ├── hoa-don-ai/                                 # Tải hóa đơn, nhận dạng OCR và duyệt kết quả.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   ├── ocr.css                             # Kiểu dáng trang xử lý và duyệt hóa đơn.
│   │   │   │   │   │   └── ocr.styles.ts                       # Các hằng kiểu dáng cho trang xử lý hóa đơn.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── InvoiceDetailForm.tsx               # Biểu mẫu xem, sửa và duyệt dữ liệu hóa đơn.
│   │   │   │   │   │   ├── InvoiceQueueList.tsx                # Danh sách hóa đơn trong hàng đợi xử lý.
│   │   │   │   │   │   ├── InvoiceStatusBadge.tsx              # Nhãn hiển thị trạng thái hóa đơn.
│   │   │   │   │   │   └── InvoiceUploadZone.tsx               # Vùng chọn hoặc kéo thả tệp hóa đơn để tải lên.
│   │   │   │   │   ├── xu-ly/                                  # Hàm xử lý, hook và kiểu dữ liệu riêng của chức năng.
│   │   │   │   │   │   └── InvoiceTypes.ts                     # Kiểu dữ liệu dùng trong giao diện xử lý hóa đơn.
│   │   │   │   │   ├── index.ts                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   │   └── page.tsx                                # Trang giao diện chính của chức năng xử lý hóa đơn.
│   │   │   │   ├── ngan-sach/                                  # Quản lý hạn mức, kỳ ngân sách và lịch sử chi tiêu.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   ├── budget-history.module.css           # CSS đóng phạm vi cho phần lịch sử ngân sách.
│   │   │   │   │   │   └── budgets.styles.ts                   # Các hằng kiểu dáng cho trang ngân sách.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── BudgetCard.tsx                      # Thẻ hiển thị hạn mức và tiến độ ngân sách.
│   │   │   │   │   │   ├── BudgetDeleteModal.tsx               # Hộp thoại xác nhận xóa ngân sách.
│   │   │   │   │   │   └── BudgetModal.tsx                     # Biểu mẫu tạo và chỉnh sửa ngân sách.
│   │   │   │   │   ├── xu-ly/                                  # Hàm xử lý, hook và kiểu dữ liệu riêng của chức năng.
│   │   │   │   │   │   └── budget-history.ts                   # Hàm và kiểu hỗ trợ lịch sử ngân sách.
│   │   │   │   │   ├── index.ts                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   │   └── page.tsx                                # Trang giao diện chính của chức năng ngân sách.
│   │   │   │   ├── tong-quan/                                  # Tổng quan tài sản, thu/chi, ví và ngân sách.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   ├── overview.module.css                 # CSS đóng phạm vi cho trang tổng quan.
│   │   │   │   │   │   └── overview.styles.ts                  # Các hằng kiểu dáng cho trang tổng quan.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── AccountsWidget.tsx                  # Tóm tắt các ví và tài khoản trên trang tổng quan.
│   │   │   │   │   │   ├── BudgetsWidget.tsx                   # Tóm tắt tiến độ ngân sách trên trang tổng quan.
│   │   │   │   │   │   ├── OverviewCharts.tsx                  # Nhóm biểu đồ trên trang tổng quan tài chính.
│   │   │   │   │   │   ├── OverviewStats.tsx                   # Các chỉ số tài sản, thu và chi tổng quan.
│   │   │   │   │   │   ├── QuickActions.tsx                    # Các thao tác nhanh từ trang tổng quan.
│   │   │   │   │   │   └── RecentTransactions.tsx              # Hiển thị các giao dịch gần đây.
│   │   │   │   │   ├── index.ts                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   │   └── page.tsx                                # Trang giao diện chính của chức năng tổng quan.
│   │   │   │   ├── trung-tam-ho-tro/                           # Câu hỏi thường gặp và thông tin liên hệ hỗ trợ.
│   │   │   │   │   ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │   │   │   └── support.styles.ts                   # Các hằng kiểu dáng cho trang hỗ trợ.
│   │   │   │   │   ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │   │   │   ├── ContactSupportCard.tsx              # Thẻ thông tin liên hệ hỗ trợ.
│   │   │   │   │   │   └── FaqAccordion.tsx                    # Danh sách câu hỏi thường gặp có thể thu gọn.
│   │   │   │   │   ├── index.ts                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │   │   └── page.tsx                                # Trang giao diện chính của chức năng hỗ trợ.
│   │   │   │   └── vi-tai-khoan/                               # Quản lý ví, mục tiêu tiết kiệm và ngân hàng mô phỏng.
│   │   │   │       ├── CSS/                                    # CSS và hằng kiểu dáng riêng của chức năng.
│   │   │   │       │   └── accounts.styles.ts                  # Các hằng kiểu dáng cho trang ví và tài khoản.
│   │   │   │       ├── thanh-phan/                             # Các thành phần giao diện riêng của chức năng.
│   │   │   │       │   ├── AccountCard.module.css              # CSS đóng phạm vi cho thẻ ví và tài khoản.
│   │   │   │       │   ├── AccountCard.tsx                     # Thẻ thông tin ví, số dư và trạng thái tài khoản.
│   │   │   │       │   ├── AccountDeleteModal.tsx              # Hộp thoại xác nhận xóa ví hoặc tài khoản.
│   │   │   │       │   ├── AccountDetailsModal.tsx             # Hộp thoại chi tiết ví và mục tiêu tiết kiệm.
│   │   │   │       │   ├── AccountModal.tsx                    # Biểu mẫu tạo và chỉnh sửa ví hoặc tài khoản.
│   │   │   │       │   └── BankConnection.tsx                  # Giao diện liên kết, xác minh và đồng bộ ngân hàng mô phỏng.
│   │   │   │       ├── index.ts                                # Xuất trang hoặc thành phần chính của chức năng.
│   │   │   │       └── page.tsx                                # Trang giao diện chính của chức năng ví và tài khoản.
│   │   │   └── dung-chung/                                     # Thành phần và tiện ích dùng chung giữa các chức năng.
│   │   │       ├── connect-api/                                # Kết nối backend và xử lý token xác thực.
│   │   │       │   └── api.ts                                  # API client người dùng, gửi request và xử lý token.
│   │   │       ├── layouts/                                    # Khung trang dùng chung: thanh điều hướng và phần đầu trang.
│   │   │       │   └── DashboardLayout.tsx                     # Khung người dùng với thanh điều hướng và đầu trang.
│   │   │       ├── nghiep-vu/                                  # Kiểu dữ liệu và hàm nghiệp vụ dùng giữa các chức năng.
│   │   │       │   ├── danh-muc/                               # Quản lý danh mục thu/chi.
│   │   │       │   │   ├── categories.ts                       # Hàm hỗ trợ xử lý danh mục, gồm lỗi trùng danh mục đã ẩn.
│   │   │       │   │   └── CategoryRestoreModal.tsx            # Hộp thoại khôi phục danh mục đã ẩn.
│   │   │       │   ├── finance.ts                              # Kiểu dữ liệu tài chính và nhãn loại tài khoản.
│   │   │       │   ├── report-period.ts                        # Hàm xác định kỳ và khoảng ngày của báo cáo.
│   │   │       │   └── report-types.ts                         # Kiểu dữ liệu dùng chung cho báo cáo tài chính.
│   │   │       ├── styles/                                     # CSS nền, biến giao diện và kiểu dáng dùng chung.
│   │   │       │   ├── finance-visuals.module.css              # Kiểu dáng dùng chung cho biểu đồ và số liệu tài chính.
│   │   │       │   ├── globals.css                             # CSS toàn cục cho giao diện người dùng.
│   │   │       │   └── swiss.css                               # Biến và quy tắc thiết kế giao diện dùng chung.
│   │   │       ├── thong-bao/                                  # Hiển thị và quản lý thông báo của người dùng.
│   │   │       │   ├── NotificationCenter.module.css           # CSS đóng phạm vi cho chuông và danh sách thông báo.
│   │   │       │   ├── NotificationCenter.tsx                  # Chuông và danh sách thông báo của người dùng.
│   │   │       │   └── notificationText.ts                     # Chuẩn hóa nội dung hiển thị của thông báo.
│   │   │       ├── tien-ich/                                   # Hàm định dạng, xử lý lỗi và hook dùng chung.
│   │   │       │   ├── finance.ts                              # Định dạng tiền, ngày, lỗi và xuất dữ liệu CSV.
│   │   │       │   └── useMotionAllowed.ts                     # Hook xác định có cho phép hiệu ứng chuyển động.
│   │   │       ├── UI-chung/                                   # Các thành phần giao diện cơ bản dùng lại nhiều nơi.
│   │   │       │   ├── CategoryIcon.tsx                        # Hiển thị biểu tượng danh mục.
│   │   │       │   ├── DateInput.tsx                           # Ô nhập ngày dd/mm/yyyy và chuyển đổi sang định dạng API.
│   │   │       │   ├── Motion.d.ts                             # Khai báo kiểu TypeScript cho các thành phần chuyển động.
│   │   │       │   ├── Motion.jsx                              # Các thành phần hiệu ứng chuyển động dùng chung.
│   │   │       │   ├── Toast.d.ts                              # Khai báo kiểu TypeScript cho thông báo toast.
│   │   │       │   ├── Toast.jsx                               # Hiển thị và quản lý thông báo toast.
│   │   │       │   └── ui.tsx                                  # Các thành phần giao diện cơ bản dùng chung.
│   │   │       └── xac-thuc/                                   # Bảo vệ trang và quản lý mật khẩu, phiên đăng nhập.
│   │   │           ├── SecuritySettings.tsx                    # Biểu mẫu bảo mật và đổi mật khẩu người dùng.
│   │   │           └── settings.styles.ts                      # Các hằng kiểu dáng cho trang cài đặt và bảo mật.
│   │   ├── .dockerignore                                       # Loại tệp không cần thiết khỏi Docker build context.
│   │   ├── .gitignore                                          # Loại dependency, cache và tệp cục bộ khỏi Git.
│   │   ├── AGENTS.md                                           # Hướng dẫn làm việc trong dự án dành cho tác nhân AI.
│   │   ├── CLAUDE.md                                           # Hướng dẫn dự án dành cho Claude.
│   │   ├── Dockerfile                                          # Đóng gói ứng dụng thành Docker image.
│   │   ├── eslint.config.mjs                                   # Cấu hình quy tắc kiểm tra mã bằng ESLint.
│   │   ├── next.config.ts                                      # Cấu hình framework Next.js.
│   │   ├── package-lock.json                                   # Khóa phiên bản chính xác của dependency npm.
│   │   ├── package.json                                        # Khai báo dependency và lệnh chạy, build, kiểm tra.
│   │   ├── postcss.config.mjs                                  # Cấu hình xử lý CSS bằng PostCSS.
│   │   └── tsconfig.json                                       # Cấu hình TypeScript và bí danh đường dẫn import.
│   └── README.md                                               # Hướng dẫn cấu trúc và các lệnh kiểm tra frontend.
│
├── .editorconfig                                               # Chuẩn hóa UTF-8, kiểu xuống dòng và thụt lề giữa các IDE.
├── .gitignore                                                  # Loại cache, secret và artifact khỏi Docker/Git.
├── docker-compose.yml                                          # Build và chạy hai frontend trên mạng Docker dùng chung.
├── PROJECT_STRUCTURE.md                                        # [LOCAL DOC] Bản sao cây Explorer kèm mục đích từng thành phần
└── README.md                                                   # Hướng dẫn tổng quan, chạy local, Docker và cấu hình SQL Server của toàn hệ thống.
```

## Nguyên tắc đặt file

- Backend: `chuc_nang/` chứa nghiệp vụ, `dung_chung/` chứa hạ tầng dùng chung, `khoi_dong/` chỉ khởi tạo và ghép ứng dụng.
- Database: revision hiện hành nằm trong `alembic/versions/`; `archive/` chỉ lưu lịch sử.
- Hai frontend: mã của từng tab nằm trong `src/chuc-nang/<tab>/`; component riêng ở `thanh-phan/`, CSS ở `CSS/`, helper/hook ở `xu-ly/`; phần dùng nhiều tab ở `src/dung-chung/`.
- `frontend/shared/` chỉ đồng bộ primitive giao diện; không ghi đè kiểu nghiệp vụ/formatter riêng của hai portal. Xem `frontend/README.md`.
