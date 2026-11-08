# Cấu trúc dự án CapitalFlow

> Cập nhật ngày 08/11/2026 từ mã nguồn hiện hành. Đây là bản đồ tra cứu,
> không phải danh sách file được phép gỡ bỏ.

## Thành phần và điểm vào

- `capitalflow-api/`: FastAPI, worker và công cụ backend. HTTP entry là
  `app/main.py` (`app.main:app`); worker entry là
  `app/dung_chung/tac_vu_nen/trinh_chay.py`.
- `capitalflow-database/`: Alembic, seed và công cụ vận hành schema. Migration
  được chạy riêng; API/worker không tự upgrade khi khởi động.
- `frontend/user-web/`: Next.js; route nằm trong `src/app/`, màn hình nghiệp vụ
  trong `src/chuc-nang/`, phần dùng chung trong `src/dung-chung/`.
- `frontend/admin-web/`: React/Vite; `src/main.jsx` khởi tạo ứng dụng,
  `src/ung-dung/App.jsx` khai báo route và lazy-load màn hình quản trị.
- `docker-compose.yml`: đóng gói hai frontend. Compose của API/worker nằm tại
  `capitalflow-api/docker-compose.yml`; không tạo SQL Server thay chủ dự án.

Lệnh cài đặt và khởi chạy: [README gốc](README.md).
Quy ước hai portal: [frontend/README.md](frontend/README.md).
Backend/Premium: [capitalflow-api/README.md](capitalflow-api/README.md).
Database: [capitalflow-database/README.md](capitalflow-database/README.md).

## Ranh giới backend

- `app/khoi_dong/tao_ung_dung.py`: composition root FastAPI; lắp middleware,
  handler và router. `routes.py` lắp router, `vong_doi.py` quản lý lifecycle,
  `trang_thai.py` cung cấp `/health` và `/ready`.
- `app/chuc_nang/nguoi_dung/`: đăng nhập, danh mục, hóa đơn AI, tài chính và gói
  sử dụng. Router nhận yêu cầu; các module nghiệp vụ giữ kiểm tra và transaction.
- `app/chuc_nang/quan_tri/`: quản lý người dùng, danh mục hệ thống, hỗ trợ,
  giám sát hóa đơn, audit, cấu hình email và phân tích vận hành.
- `app/dung_chung/database/`: engine/session/Base và `dang_ky_mo_hinh.py`.
  Import registry phục vụ metadata và quan hệ ORM; không bỏ theo số lần đọc tên.
- `app/dung_chung/http/`: xác định user, phân quyền, rate limit và middleware.
- `app/dung_chung/email/`: dịch vụ email, trạng thái chuyển phát và chống gửi lại
  khi kết quả SMTP chưa rõ. `gui_mail.py` vẫn có consumer trong OTP ngân hàng.
- `app/dung_chung/tac_vu_nen/`: hàng đợi và worker EMAIL/OCR/BUDGET/BILLING;
  worker cũng dọn hóa đơn hết thời hạn giữ. Không còn job purge người dùng.

## Tra cứu theo nghiệp vụ

### Tài khoản và phiên đăng nhập

- Endpoint: `capitalflow-api/app/chuc_nang/nguoi_dung/dang_nhap/api/routes.py`.
- Khôi phục mật khẩu, token và phiên: cùng phân hệ, trong `nghiep_vu/`.
- UI đăng nhập: `frontend/user-web/src/chuc-nang/dang-nhap/`.
- Bảo mật và phiên: `frontend/user-web/src/chuc-nang/cai-dat-bao-mat/`;
  các Next adapter nằm dưới `src/app/(dashboard)/settings/`.

### Ví, sổ thu chi, ngân sách và báo cáo

- Ví hiện hành: `tai_chinh/vi_tai_khoan/wallet_api.py`, các service cùng thư mục
  và `luu_tru/wallet.py`; giao diện `user-web/src/chuc-nang/vi-tai-khoan/`.
- Sổ thu chi độc lập: `tai_chinh/giao_dich/bookkeeping.py`; UI
  `user-web/src/chuc-nang/giao-dich/`. Ghi thu chi không tự đổi số dư ví;
  giao dịch ví/hóa đơn liên kết có ràng buộc riêng.
- Ngân sách: `tai_chinh/ngan_sach/`; `api.py` nhận yêu cầu, `ky_han.py` xác định
  kỳ/ngày hiệu lực và số chi; `canh_bao.py` phát cảnh báo. UI tại
  `user-web/src/chuc-nang/ngan-sach/`.
- Tổng hợp và phân tích: `tai_chinh/bao_cao_tai_chinh/`; UI Tổng quan và Báo cáo
  tại `user-web/src/chuc-nang/tong-quan/` và `bao-cao-tai-chinh/`.
- Danh mục: `chuc_nang/nguoi_dung/danh_muc/` và phân hệ danh mục hệ thống admin.
- Thông báo: `tai_chinh/thong_bao/`; UI tại `user-web/src/dung-chung/thong-bao/`.
- Model `vi_tai_khoan/luu_tru/account.py` giữ dữ liệu/quan hệ legacy và event
  đã đăng ký. Nó không phải router quản lý ví hiện hành và chưa được phép xóa.

Các đường dẫn `tai_chinh/` phía trên nằm dưới
`capitalflow-api/app/chuc_nang/nguoi_dung/`.

### Hóa đơn AI và thanh toán hóa đơn

- API upload/xem/ghi sổ: `chuc_nang/nguoi_dung/hoa_don_ai/api/routes.py`.
- Kiểm tra upload/dedup/xác nhận/xóa: các module trong `hoa_don_ai/nghiep_vu/`.
- Gemini: `hoa_don_ai/ha_tang/gemini.py`; dữ liệu ORM trong `hoa_don_ai/luu_tru/`.
- UI OCR: `user-web/src/chuc-nang/hoa-don-ai/`; upload mới nhận ảnh
  JPG/JPEG/PNG/WebP. Viewer/ticket XML/PDF legacy cần kiểm tra riêng trước khi bỏ.
- `hoa_don_ai/ha_tang/invoice_xml.py` là ứng viên parser không có caller theo
  đợt rà soát 08/11, không phải luồng upload XML mới đang được hỗ trợ.
- Hóa đơn mô phỏng qua ví: `tai_chinh/vi_tai_khoan/bill_qr.py` và các module
  thanh toán liên quan; UI tại `vi-tai-khoan/thanh-toan/` và `DemoCheckout.tsx`.
  Route `/demo-checkout` còn phục vụ nút Tạo hóa đơn của ví.

### Premium và hỗ trợ

- Premium: `chuc_nang/nguoi_dung/goi_dich_vu/`; `api.py` nhận yêu cầu,
  `dich_vu.py` đối soát/cấp quyền, `han_muc.py` quản lý quota, `payos.py` kết nối
  nhà cung cấp, `checkout.py` kiểm tra và hiển thị QR cho chủ đơn.
- User UI: `cai-dat-bao-mat/subscription.tsx`, `checkout.tsx` và `thanh-phan/`.
  Giá/quyền thực tế do backend xác định, không lấy từ trạng thái frontend.
- Hỗ trợ tài khoản mất email/bị khóa: `chuc_nang/quan_tri/ho_tro/api.py`, gồm
  public intake `/support/account`; không đồng nghĩa admin tự tạo yêu cầu.
- Form hỗ trợ trong tài khoản và phản hồi email: `quan_tri/ho_tro/yeu_cau.py`,
  model `SupportRequest`, UI `trung-tam-ho-tro/` và admin `ho-tro/`.

## Database và công cụ vận hành

- `capitalflow-database/alembic/env.py` lấy metadata qua registry hiện hành.
- `alembic/versions/` giữ đầy đủ chuỗi migration; tại snapshot này có 28 revision,
  một head `cfdb_premium_checkout`, 28 bảng ORM. Không xóa revision theo tên
  tính năng cũ vì dựng database mới vẫn cần đi qua lịch sử.
- `archive/pre_baseline_202609/` là lịch sử có chủ đích, không chạy lại trên head.
- `tools/apply_*.py`, `retire_user_deletion.py` và các tool khác là entry CLI.
  Một số runner mới import helper từ runner cũ; phải tách phụ thuộc trước khi
  lưu trữ/xóa runner. Không chạy chúng để kiểm tra một thay đổi tài liệu/import.
- Dependency Alembic hiện còn trong requirements API; tách runtime/migration/dev
  là công việc riêng, không được coi là đã hoàn tất chỉ vì tách project database.

## Kiểm tra và artifact

- Frontend dùng các script có sẵn trong `tools/` của từng portal; xem `npm test`,
  lint, typecheck và build trong README/package.json.
- Backend có cả bộ thử SQLite in-memory/mocked và công cụ SQL/QA. Đọc docstring,
  guard, tùy chọn và phạm vi side effect trước khi chạy; không chạy hàng loạt.
- `scripts/deployment/` giữ chẩn đoán/readiness và kiểm tra image; cần đối chiếu
  revision/contract theo bản triển khai, không tự sửa schema.
- `output/` chứa báo cáo và artifact nhiều đợt; một phần có dependency/chứng cứ
  cần giữ, không phải toàn bộ đều có thể xóa.
- [Báo cáo rà soát 08/11](output/source-review-2026-11-08/REPORT.md) và
  [inventory CSV](output/source-review-2026-11-08/files.csv) là snapshot trước
  cleanup. Trạng thái các đợt xử lý nằm riêng dưới thư mục báo cáo; không sửa
  bằng chứng cũ để giả định mọi phát hiện đã được giải quyết.

## Cây Explorer có chú thích

Danh sách 540 file first-party của snapshot đã được đối chiếu tồn tại tại lần
cập nhật này. Bao gồm config/tài liệu/tool/archive; không dùng số file để đánh
đồng với số module runtime. Nội dung vendor, `.git`, output, cache/build, logs,
backup và uploads được loại. Các `.env*` cũng không liệt kê; xem mẫu cấu hình
và cách điền trong README, không đưa giá trị secret vào tài liệu.

```text
CapitalFlow/
├── .vscode/
│   └── settings.json
├── capitalflow-api/  # FastAPI, worker, công cụ backend
│   ├── .vscode/
│   │   └── settings.json
│   ├── app/  # mã runtime theo nghiệp vụ
│   │   ├── chuc_nang/
│   │   │   ├── nguoi_dung/
│   │   │   │   ├── dang_nhap/
│   │   │   │   │   ├── api/
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   └── routes.py
│   │   │   │   │   ├── luu_tru/
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   ├── dat_lai_mat_khau.py
│   │   │   │   │   │   ├── nguoi_dung.py
│   │   │   │   │   │   └── refresh_token.py
│   │   │   │   │   ├── nghiep_vu/
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   ├── khoi_phuc_mat_khau.py
│   │   │   │   │   │   ├── session_management.py
│   │   │   │   │   │   └── tokens.py
│   │   │   │   │   ├── schemas/
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   └── auth.py
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── routes.py
│   │   │   │   ├── danh_muc/
│   │   │   │   │   ├── luu_tru/
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   └── danh_muc.py
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── api.py
│   │   │   │   │   ├── phan_loai.py
│   │   │   │   │   ├── routes.py
│   │   │   │   │   └── schemas.py
│   │   │   │   ├── goi_dich_vu/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── api.py
│   │   │   │   │   ├── checkout.py
│   │   │   │   │   ├── dich_vu.py
│   │   │   │   │   ├── han_muc.py
│   │   │   │   │   ├── luu_tru.py
│   │   │   │   │   └── payos.py
│   │   │   │   ├── hoa_don_ai/
│   │   │   │   │   ├── api/
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   ├── routes.py
│   │   │   │   │   │   └── telemetry.py
│   │   │   │   │   ├── ha_tang/
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   ├── gemini.py
│   │   │   │   │   │   └── invoice_xml.py
│   │   │   │   │   ├── luu_tru/
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   ├── invoice.py
│   │   │   │   │   │   ├── invoice_item.py
│   │   │   │   │   │   ├── lich_su.py
│   │   │   │   │   │   ├── posting_evidence.py
│   │   │   │   │   │   └── tac_vu_ocr.py
│   │   │   │   │   ├── nghiep_vu/
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   ├── chuan_hoa_hoa_don.py
│   │   │   │   │   │   ├── deletion.py
│   │   │   │   │   │   ├── do_tuong_dong.py
│   │   │   │   │   │   ├── doi_chieu_ban_le.py
│   │   │   │   │   │   ├── kiem_tra_tai_len.py
│   │   │   │   │   │   ├── luy_dang.py
│   │   │   │   │   │   ├── phan_tich_du_lieu.py
│   │   │   │   │   │   ├── phat_hien_trung_lap.py
│   │   │   │   │   │   ├── posting_evidence.py
│   │   │   │   │   │   ├── tai_len.py
│   │   │   │   │   │   ├── vong_doi.py
│   │   │   │   │   │   └── xac_nhan_hoa_don.py
│   │   │   │   │   ├── schemas/
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   └── invoice.py
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── routes.py
│   │   │   │   ├── tai_chinh/
│   │   │   │   │   ├── bao_cao_tai_chinh/
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   ├── dich_vu.py
│   │   │   │   │   │   └── phan_tich.py
│   │   │   │   │   ├── giao_dich/
│   │   │   │   │   │   ├── luu_tru/
│   │   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   │   ├── ban_ghi_luy_dang.py
│   │   │   │   │   │   │   └── giao_dich.py
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   ├── bookkeeping.py
│   │   │   │   │   │   ├── filters.py
│   │   │   │   │   │   ├── luy_dang.py
│   │   │   │   │   │   ├── payment_records.py
│   │   │   │   │   │   ├── schemas.py
│   │   │   │   │   │   ├── so_cai.py
│   │   │   │   │   │   └── wallet_records.py
│   │   │   │   │   ├── ngan_sach/
│   │   │   │   │   │   ├── luu_tru/
│   │   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   │   └── ngan_sach.py
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   ├── api.py
│   │   │   │   │   │   ├── canh_bao.py
│   │   │   │   │   │   ├── ky_han.py
│   │   │   │   │   │   └── schemas.py
│   │   │   │   │   ├── thong_bao/
│   │   │   │   │   │   ├── luu_tru/
│   │   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   │   └── thong_bao.py
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   ├── api.py
│   │   │   │   │   │   └── dich_vu.py
│   │   │   │   │   ├── vi_tai_khoan/
│   │   │   │   │   │   ├── luu_tru/
│   │   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   │   ├── account.py
│   │   │   │   │   │   │   └── wallet.py
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   ├── bill_qr.py
│   │   │   │   │   │   ├── link_otp.py
│   │   │   │   │   │   ├── number_rules.py
│   │   │   │   │   │   ├── receiving.py
│   │   │   │   │   │   ├── user_banks.py
│   │   │   │   │   │   ├── wallet_api.py
│   │   │   │   │   │   └── wallet_codes.py
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── routes.py
│   │   │   │   └── __init__.py
│   │   │   ├── quan_tri/
│   │   │   │   ├── bang_dieu_khien/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── api.py
│   │   │   │   ├── danh_muc_he_thong/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── api.py
│   │   │   │   ├── dung_chung/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── tien_ich.py
│   │   │   │   ├── email_cau_hinh/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── api.py
│   │   │   │   ├── giam_sat_hoa_don/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── api.py
│   │   │   │   ├── ho_tro/
│   │   │   │   │   ├── api.py
│   │   │   │   │   ├── luu_tru.py
│   │   │   │   │   └── yeu_cau.py
│   │   │   │   ├── nguoi_dung/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── api.py
│   │   │   │   ├── nhat_ky_quan_tri/
│   │   │   │   │   ├── luu_tru/
│   │   │   │   │   │   ├── __init__.py
│   │   │   │   │   │   └── nhat_ky.py
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── api.py
│   │   │   │   ├── phan_tich_van_hanh/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── api.py
│   │   │   │   ├── __init__.py
│   │   │   │   └── routes.py
│   │   │   └── __init__.py
│   │   ├── dung_chung/  # hạ tầng dùng chung
│   │   │   ├── database/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── dang_ky_mo_hinh.py
│   │   │   │   ├── ket_noi.py
│   │   │   │   ├── nen_tang.py
│   │   │   │   └── session.py
│   │   │   ├── email/
│   │   │   │   ├── luu_tru/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── cau_hinh_he_thong.py
│   │   │   │   │   └── nhat_ky_email.py
│   │   │   │   ├── __init__.py
│   │   │   │   └── dich_vu.py
│   │   │   ├── http/
│   │   │   │   ├── trung_gian/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── gioi_han_noi_dung.py
│   │   │   │   │   └── kiem_toan.py
│   │   │   │   ├── __init__.py
│   │   │   │   ├── gioi_han_tan_suat.py
│   │   │   │   └── phu_thuoc.py
│   │   │   ├── quan_sat/
│   │   │   │   ├── __init__.py
│   │   │   │   └── do_luong.py
│   │   │   ├── security/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── passwords.py
│   │   │   │   ├── secrets.py
│   │   │   │   └── tokens.py
│   │   │   ├── tac_vu_nen/
│   │   │   │   ├── luu_tru/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   └── tac_vu_nen.py
│   │   │   │   ├── __init__.py
│   │   │   │   ├── hang_doi.py
│   │   │   │   └── trinh_chay.py
│   │   │   ├── text/
│   │   │   │   ├── __init__.py
│   │   │   │   └── unicode.py
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── gui_mail.py
│   │   │   └── money.py
│   │   ├── khoi_dong/  # composition root và lifecycle
│   │   │   ├── __init__.py
│   │   │   ├── bo_xu_ly.py
│   │   │   ├── routes.py
│   │   │   ├── tao_ung_dung.py
│   │   │   ├── trang_thai.py
│   │   │   └── vong_doi.py
│   │   ├── __init__.py
│   │   └── main.py
│   ├── scripts/  # công cụ triển khai
│   │   └── deployment/
│   │       ├── __init__.py
│   │       ├── diagnose.py
│   │       └── verify_docker.py
│   ├── tools/  # CLI/kiểm tra; đọc side effect trước khi chạy
│   │   ├── backfill_wallet_records.py
│   │   ├── configure_payos_webhook.py
│   │   ├── serve_user_web_fault_proxy.py
│   │   ├── serve_user_web_test_api.py
│   │   ├── sql_qa_data.py
│   │   ├── verify_api_integration.py
│   │   ├── verify_backend_guards.py
│   │   ├── verify_bill_qr.py
│   │   ├── verify_budget_daily.py
│   │   ├── verify_fault_concurrency.py
│   │   ├── verify_premium_billing.py
│   │   ├── verify_sql_performance.py
│   │   ├── verify_support_requests.py
│   │   ├── verify_web_faults.mjs
│   │   └── verify_worker.py
│   ├── .dockerignore
│   ├── .gitignore
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── pyrefly.toml
│   ├── pyrightconfig.json
│   ├── README.md
│   └── requirements.txt
├── capitalflow-database/  # migration và vận hành schema
│   ├── alembic/
│   │   ├── versions/  # chuỗi revision hiện hành; giữ đầy đủ lịch sử
│   │   │   ├── cfdb_20260924_baseline.py
│   │   │   ├── cfdb_account_support.py
│   │   │   ├── cfdb_account_support_only.py
│   │   │   ├── cfdb_bank_link_v2.py
│   │   │   ├── cfdb_bank_otp.py
│   │   │   ├── cfdb_default_wallet.py
│   │   │   ├── cfdb_email_only.py
│   │   │   ├── cfdb_independent_wallets.py
│   │   │   ├── cfdb_invoice_dedup.py
│   │   │   ├── cfdb_invoice_evidence.py
│   │   │   ├── cfdb_legacy_cleanup.py
│   │   │   ├── cfdb_notifications.py
│   │   │   ├── cfdb_phone_verify.py
│   │   │   ├── cfdb_premium_billing.py
│   │   │   ├── cfdb_premium_checkout.py
│   │   │   ├── cfdb_recurring_budgets.py
│   │   │   ├── cfdb_reporting_cover.py
│   │   │   ├── cfdb_retire_user_deletion.py
│   │   │   ├── cfdb_support_operations.py
│   │   │   ├── cfdb_support_requests.py
│   │   │   ├── cfdb_support_two_cases.py
│   │   │   ├── cfdb_transfer_note.py
│   │   │   ├── cfdb_user_banks.py
│   │   │   ├── cfdb_user_phone.py
│   │   │   ├── cfdb_wallet_accounts.py
│   │   │   ├── cfdb_wallet_short_code.py
│   │   │   ├── cfdb_wallet_spending.py
│   │   │   └── da10f25d5743_legacy_marker.py
│   │   ├── env.py
│   │   ├── README
│   │   └── script.py.mako
│   ├── archive/  # lịch sử có chủ đích, không chạy trên head
│   │   └── pre_baseline_202609/
│   │       ├── alembic_legacy/
│   │       │   ├── versions/
│   │       │   │   └── da10f25d5743_baseline.py
│   │       │   ├── alembic.ini
│   │       │   ├── env.py
│   │       │   ├── README
│   │       │   └── script.py.mako
│   │       ├── runners/
│   │       │   ├── apply_sql_migration.py
│   │       │   ├── migrate_auto_category_classification.py
│   │       │   ├── migrate_category_management.py
│   │       │   ├── migrate_database_cleanup.py
│   │       │   ├── migrate_financial_integrity.py
│   │       │   ├── migrate_invoice_review_fields.py
│   │       │   ├── migrate_remove_unused_columns.py
│   │       │   └── migrate_resilience.py
│   │       ├── sql/
│   │       │   ├── 20260910_financial_integrity.sql
│   │       │   ├── 20260915_invoice_review_fields.sql
│   │       │   ├── 20260916_category_management.sql
│   │       │   ├── 20260917_auto_category_classification.sql
│   │       │   ├── 20260918_database_cleanup.sql
│   │       │   ├── 20260918_remove_unused_columns.sql
│   │       │   ├── 20260918_worker_lane_index.sql
│   │       │   └── legacy_clean_install_schema.sql
│   │       └── README.md
│   ├── data/
│   │   └── system_category_keywords_20261102.json
│   ├── tools/  # CLI có guard và phụ thuộc chéo
│   │   ├── apply_bank_link_v2.py
│   │   ├── apply_bank_otp.py
│   │   ├── apply_default_wallet.py
│   │   ├── apply_email_only.py
│   │   ├── apply_independent_wallets.py
│   │   ├── apply_invoice_dedup.py
│   │   ├── apply_notifications.py
│   │   ├── apply_premium_billing.py
│   │   ├── apply_premium_checkout.py
│   │   ├── apply_recurring_budgets.py
│   │   ├── apply_support_requests.py
│   │   ├── apply_user_banks.py
│   │   ├── apply_user_phone.py
│   │   ├── apply_wallet_short_code.py
│   │   ├── apply_wallet_spending.py
│   │   ├── backfill_invoice_dedup.py
│   │   ├── export_live_baseline.py
│   │   ├── import_system_category_keywords.py
│   │   ├── repair_unicode.py
│   │   ├── reset_demo_users.py
│   │   ├── retire_user_deletion.py
│   │   └── seed.py
│   ├── .gitignore
│   ├── alembic.ini
│   ├── CURRENT_SCHEMA.md
│   ├── README.md
│   └── requirements.txt
├── frontend/  # hai portal build độc lập
│   ├── .vscode/
│   │   └── settings.json
│   ├── admin-web/  # portal quản trị React/Vite
│   │   ├── docs/
│   │   │   ├── batch-1-auth.md
│   │   │   ├── implementation-batches.md
│   │   │   ├── source-cleanup-round-2.md
│   │   │   └── source-cleanup.md
│   │   ├── public/
│   │   │   ├── fonts/
│   │   │   │   ├── inter-latin-ext.woff2
│   │   │   │   ├── inter-latin.woff2
│   │   │   │   ├── Inter-OFL.txt
│   │   │   │   └── inter-vietnamese.woff2
│   │   │   └── favicon.svg
│   │   ├── src/
│   │   │   ├── chuc-nang/
│   │   │   │   ├── bang-dieu-khien/
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── DashboardStats.jsx
│   │   │   │   │   │   ├── OperationsCenter.jsx
│   │   │   │   │   │   └── RecentAdminActivity.jsx
│   │   │   │   │   └── Dashboard.jsx
│   │   │   │   ├── cai-dat-bao-mat/
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── LoginSessions.jsx
│   │   │   │   │   │   └── SecuritySettings.jsx
│   │   │   │   │   ├── xu-ly/
│   │   │   │   │   │   └── sessionPresentation.js
│   │   │   │   │   └── Settings.jsx
│   │   │   │   ├── dang-nhap/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   └── login.css
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── LampAnimation.jsx
│   │   │   │   │   │   └── LoginForm.jsx
│   │   │   │   │   └── Login.jsx
│   │   │   │   ├── danh-muc-he-thong/
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── CategoryList.jsx
│   │   │   │   │   │   └── CategoryModal.jsx
│   │   │   │   │   └── Categories.jsx
│   │   │   │   ├── email-cau-hinh/
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── EmailLogWorkspace.jsx
│   │   │   │   │   │   ├── SmtpSettingsForm.jsx
│   │   │   │   │   │   └── SmtpTestModal.jsx
│   │   │   │   │   └── EmailLogs.jsx
│   │   │   │   ├── giam-sat-hoa-don/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   └── status-donut.css
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── OcrFailureTable.jsx
│   │   │   │   │   │   ├── OcrStatusDonut.jsx
│   │   │   │   │   │   └── OcrWorkspace.jsx
│   │   │   │   │   └── OcrMonitor.jsx
│   │   │   │   ├── ho-tro/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   └── SupportCases.module.css
│   │   │   │   │   ├── SupportCases.jsx
│   │   │   │   │   └── SupportRequests.jsx
│   │   │   │   ├── nguoi-dung/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   └── UserBulkBar.module.css
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── UserActionModal.jsx
│   │   │   │   │   │   ├── UserDirectory.jsx
│   │   │   │   │   │   └── UserToolbar.jsx
│   │   │   │   │   ├── xu-ly/
│   │   │   │   │   │   └── utils.js
│   │   │   │   │   └── Users.jsx
│   │   │   │   ├── nhat-ky-quan-tri/
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   └── AuditWorkspace.jsx
│   │   │   │   │   └── AuditLogs.jsx
│   │   │   │   └── phan-tich-van-hanh/
│   │   │   │       ├── CSS/
│   │   │   │       │   └── volume-chart.css
│   │   │   │       ├── thanh-phan/
│   │   │   │       │   ├── AnalyticsPeriodFilter.jsx
│   │   │   │       │   ├── AnalyticsSummary.jsx
│   │   │   │       │   └── AnalyticsVolumeChart.jsx
│   │   │   │       ├── xu-ly/
│   │   │   │       │   └── report-period.js
│   │   │   │       └── SystemAnalytics.jsx
│   │   │   ├── dung-chung/
│   │   │   │   ├── connect-api/
│   │   │   │   │   └── api.js
│   │   │   │   ├── CSS/
│   │   │   │   │   ├── base.css
│   │   │   │   │   ├── management.module.css
│   │   │   │   │   ├── operations.module.css
│   │   │   │   │   ├── overview.module.css
│   │   │   │   │   ├── shell.css
│   │   │   │   │   ├── ui.css
│   │   │   │   │   └── workspace.css
│   │   │   │   ├── tien-ich/
│   │   │   │   │   ├── format.js
│   │   │   │   │   ├── hooks.js
│   │   │   │   │   └── horizontalWheel.js
│   │   │   │   ├── UI-chung/
│   │   │   │   │   ├── ActionMenu.jsx
│   │   │   │   │   ├── BrandMark.jsx
│   │   │   │   │   ├── CategoryIcon.jsx
│   │   │   │   │   ├── DateInput.jsx
│   │   │   │   │   ├── Inspector.jsx
│   │   │   │   │   ├── Toast.jsx
│   │   │   │   │   ├── ui.jsx
│   │   │   │   │   └── WorkspaceHead.jsx
│   │   │   │   └── xac-thuc/
│   │   │   │       ├── adminSession.js
│   │   │   │       ├── passwordPolicy.js
│   │   │   │       └── ProtectedRoute.jsx
│   │   │   ├── ung-dung/  # route và shell admin
│   │   │   │   ├── layouts/
│   │   │   │   │   └── DashboardLayout.jsx
│   │   │   │   └── App.jsx
│   │   │   └── main.jsx
│   │   ├── tools/
│   │   │   ├── verify-admin-web.mjs
│   │   │   ├── verify-dev-runtime.mjs
│   │   │   └── verify-structure.mjs
│   │   ├── .dockerignore
│   │   ├── .gitignore
│   │   ├── .oxlintrc.json
│   │   ├── DESIGN.md
│   │   ├── Dockerfile
│   │   ├── index.html
│   │   ├── nginx.conf
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── README.md
│   │   └── vite.config.js
│   ├── user-web/  # portal người dùng Next.js
│   │   ├── .vscode/
│   │   │   └── settings.json
│   │   ├── docs/
│   │   │   └── cleanup-and-readiness-2026-11-07.md
│   │   ├── public/
│   │   │   └── favicon.svg
│   │   ├── src/
│   │   │   ├── app/  # entry/convention Next.js
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── accounts/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── analytics/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── budgets/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── categories/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── demo-checkout/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── ocr/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── settings/
│   │   │   │   │   │   ├── subscription/
│   │   │   │   │   │   │   ├── checkout/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── support/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── transactions/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── account-support/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── demo/
│   │   │   │   │   └── tong-quan/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── apple-icon.png
│   │   │   │   ├── error.tsx
│   │   │   │   ├── favicon.ico
│   │   │   │   ├── icon.svg
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   ├── not-found.tsx
│   │   │   │   └── providers.tsx
│   │   │   ├── chuc-nang/  # màn hình theo nghiệp vụ
│   │   │   │   ├── bao-cao-tai-chinh/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   └── analytics.module.css
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── ReportCardHeader.tsx
│   │   │   │   │   │   ├── ReportCharts.tsx
│   │   │   │   │   │   ├── ReportPeriodFilter.tsx
│   │   │   │   │   │   └── SpendingReport.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── cai-dat-bao-mat/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   ├── checkout.module.css
│   │   │   │   │   │   ├── settings.module.css
│   │   │   │   │   │   └── subscription.module.css
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── PremiumCheckout.tsx
│   │   │   │   │   │   ├── SessionManager.tsx
│   │   │   │   │   │   └── SubscriptionSettings.tsx
│   │   │   │   │   ├── xu-ly/
│   │   │   │   │   │   └── subscription.ts
│   │   │   │   │   ├── checkout.tsx
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── subscription.tsx
│   │   │   │   ├── dang-nhap/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   └── login.module.css
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── FirstTimePasswordModal.tsx
│   │   │   │   │   │   └── ForgotPasswordModal.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── danh-muc/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   └── categories.module.css
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── CategoryDeleteModal.tsx
│   │   │   │   │   │   ├── CategoryModal.tsx
│   │   │   │   │   │   └── CategoryTable.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── giao-dich/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   └── Transactions.module.css
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── TransactionDeleteModal.tsx
│   │   │   │   │   │   ├── TransactionFilters.tsx
│   │   │   │   │   │   ├── TransactionModal.tsx
│   │   │   │   │   │   ├── TransactionTable.tsx
│   │   │   │   │   │   └── WalletTransactionDetails.tsx
│   │   │   │   │   └── BookkeepingWorkspace.tsx
│   │   │   │   ├── hoa-don-ai/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   ├── invoice-density.module.css
│   │   │   │   │   │   └── ocr.css
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── InvoiceDuplicateReview.tsx
│   │   │   │   │   │   ├── InvoiceIntakeFeedback.tsx
│   │   │   │   │   │   ├── InvoicePdfPreview.tsx
│   │   │   │   │   │   ├── InvoiceQueueList.tsx
│   │   │   │   │   │   ├── InvoiceRecordForm.tsx
│   │   │   │   │   │   ├── InvoiceStatusBadge.tsx
│   │   │   │   │   │   ├── InvoiceTrashNotice.tsx
│   │   │   │   │   │   └── InvoiceUploadZone.tsx
│   │   │   │   │   ├── xu-ly/
│   │   │   │   │   │   ├── invoiceApi.ts
│   │   │   │   │   │   ├── InvoiceTypes.ts
│   │   │   │   │   │   ├── invoiceUpload.ts
│   │   │   │   │   │   └── useAutomaticDuplicateCheck.ts
│   │   │   │   │   └── BookkeepingInvoices.tsx
│   │   │   │   ├── ngan-sach/
│   │   │   │   │   ├── bieu-mau/
│   │   │   │   │   │   ├── BudgetDeleteModal.tsx
│   │   │   │   │   │   ├── BudgetEditForm.tsx
│   │   │   │   │   │   └── BudgetModal.tsx
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   ├── budget-density.module.css
│   │   │   │   │   │   ├── BudgetEditForm.module.css
│   │   │   │   │   │   └── BudgetList.module.css
│   │   │   │   │   ├── danh-sach/
│   │   │   │   │   │   ├── BudgetCard.tsx
│   │   │   │   │   │   └── BudgetWorkspace.tsx
│   │   │   │   │   ├── xu-ly/
│   │   │   │   │   │   └── budget-history.ts
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── tong-quan/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   └── overview.module.css
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── AccountsWidget.tsx
│   │   │   │   │   │   ├── BudgetsWidget.tsx
│   │   │   │   │   │   ├── CardAction.tsx
│   │   │   │   │   │   ├── OverviewCharts.tsx
│   │   │   │   │   │   ├── OverviewStats.tsx
│   │   │   │   │   │   ├── QuickActions.tsx
│   │   │   │   │   │   ├── RecentTransactions.tsx
│   │   │   │   │   │   └── SpendingReports.tsx
│   │   │   │   │   ├── IndependentOverview.tsx
│   │   │   │   │   ├── monthlyTrend.ts
│   │   │   │   │   └── useVietnamDay.ts
│   │   │   │   ├── trung-tam-ho-tro/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   └── support.module.css
│   │   │   │   │   ├── thanh-phan/
│   │   │   │   │   │   ├── ContactSupportCard.tsx
│   │   │   │   │   │   ├── FaqAccordion.tsx
│   │   │   │   │   │   └── SupportRequestForm.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   └── vi-tai-khoan/
│   │   │   │       ├── CSS/
│   │   │   │       │   ├── BillPayment.module.css
│   │   │   │       │   ├── BillReceipt.module.css
│   │   │   │       │   ├── MockInvoiceModal.module.css
│   │   │   │       │   ├── TopupWithdrawModal.module.css
│   │   │   │       │   ├── WalletDialog.module.css
│   │   │   │       │   ├── WalletHistory.module.css
│   │   │   │       │   └── WalletWorkspace.module.css
│   │   │   │       ├── nap-rut/
│   │   │   │       │   └── TopupWithdrawModal.tsx
│   │   │   │       ├── thanh-phan/
│   │   │   │       │   ├── AmountInput.tsx
│   │   │   │       │   ├── MockInvoiceModal.tsx
│   │   │   │       │   └── WalletCards.tsx
│   │   │   │       ├── thanh-toan/
│   │   │   │       │   ├── BillQrScanner.tsx
│   │   │   │       │   └── BillReceipt.tsx
│   │   │   │       ├── xu-ly/
│   │   │   │       │   └── billQr.ts
│   │   │   │       ├── DemoCheckout.tsx
│   │   │   │       ├── WalletHistoryDialog.tsx
│   │   │   │       └── WalletWorkspace.tsx
│   │   │   ├── dung-chung/
│   │   │   │   ├── connect-api/
│   │   │   │   │   └── api.ts
│   │   │   │   ├── CSS/
│   │   │   │   │   ├── finance-visuals.module.css
│   │   │   │   │   ├── globals.css
│   │   │   │   │   ├── swiss.css
│   │   │   │   │   └── workspace-density.module.css
│   │   │   │   ├── layouts/
│   │   │   │   │   ├── DashboardLayout.module.css
│   │   │   │   │   └── DashboardLayout.tsx
│   │   │   │   ├── nghiep-vu/
│   │   │   │   │   ├── danh-muc/
│   │   │   │   │   │   ├── categories.ts
│   │   │   │   │   │   └── CategoryRestoreModal.tsx
│   │   │   │   │   ├── finance.ts
│   │   │   │   │   ├── PaymentRecordReview.tsx
│   │   │   │   │   └── report.ts
│   │   │   │   ├── thong-bao/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   └── NotificationCenter.module.css
│   │   │   │   │   ├── NotificationCenter.tsx
│   │   │   │   │   └── notificationText.ts
│   │   │   │   ├── tien-ich/
│   │   │   │   │   ├── browserCrypto.ts
│   │   │   │   │   ├── decimal.ts
│   │   │   │   │   ├── finance.ts
│   │   │   │   │   ├── formValidation.ts
│   │   │   │   │   ├── horizontalWheel.ts
│   │   │   │   │   ├── moneyInput.ts
│   │   │   │   │   └── reportChart.ts
│   │   │   │   ├── UI-chung/
│   │   │   │   │   ├── CSS/
│   │   │   │   │   │   ├── ListDetailLayout.module.css
│   │   │   │   │   │   └── MoneyInput.module.css
│   │   │   │   │   ├── CategoryIcon.tsx
│   │   │   │   │   ├── DateInput.tsx
│   │   │   │   │   ├── ListDetailLayout.tsx
│   │   │   │   │   ├── MoneyInput.tsx
│   │   │   │   │   ├── Motion.tsx
│   │   │   │   │   ├── Toast.tsx
│   │   │   │   │   └── ui.tsx
│   │   │   │   └── xac-thuc/
│   │   │   │       ├── passwordPolicy.ts
│   │   │   │       └── SecuritySettings.tsx
│   │   │   └── proxy.ts
│   │   ├── tools/
│   │   │   ├── user-web-acceptance.json
│   │   │   ├── USER-WEB-ACCEPTANCE.md
│   │   │   ├── verify-structure.mjs
│   │   │   ├── verify-tailwind.mjs
│   │   │   ├── verify-user-web-acceptance.mjs
│   │   │   ├── verify-user-web-http.mjs
│   │   │   └── verify-user-web.mjs
│   │   ├── .dockerignore
│   │   ├── .gitignore
│   │   ├── AGENTS.md
│   │   ├── CLAUDE.md
│   │   ├── css-custom-data.json
│   │   ├── DESIGN.md
│   │   ├── Dockerfile
│   │   ├── eslint.config.mjs
│   │   ├── next-env.d.ts
│   │   ├── next.config.ts
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── postcss.config.mjs
│   │   ├── README.md
│   │   └── tsconfig.json
│   └── README.md
├── .gitignore
├── docker-compose.yml
├── PROJECT_STRUCTURE.md
└── README.md
```
