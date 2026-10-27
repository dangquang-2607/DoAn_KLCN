# Ví độc lập và sổ thu chi — thay đổi nghiệp vụ ngày 25/10/2026

**Bổ sung 26/10/2026:** đã triển khai thanh toán hóa đơn mô phỏng và công tắc
Tính vào chi tiêu sau thanh toán. Xem [hợp đồng chi tiết](wallet-payment-spending.md).
Trước khi bật phiên bản API/web hiện tại, cần cả migration
`cfdb_independent_wallets` và `cfdb_wallet_spending`.

Theo xác nhận của chủ dự án: ví mới chỉ có tên, số dư 0 VND; số dư không âm,
không nhập/sửa trực tiếp. Nạp từ ngân hàng đã liên kết, rút về ngân hàng hoặc
nhận/chuyển tiền giữa ví. Tất cả là mô phỏng, không giữ hoặc thanh toán tiền thật.
Liên kết chỉ phục vụ nạp/rút; không đồng bộ lịch sử hay số dư ngân hàng vào ví.
Thu chi nhập tay và OCR là sổ ghi chép độc lập, không thay đổi tiền trong ví.

Danh mục ngân hàng hiện tại chỉ gồm VCB, ACB, MB, TCB trong `demo_catalog.py`.
Module ví không phụ thuộc nguồn JSON lịch sử ngân hàng. Mã đồng bộ cũ và bộ dữ
liệu mẫu được bảo toàn riêng trong `legacy_bank_sync/`, chỉ dùng cho nhánh tương
thích khi tắt cờ ví độc lập. Xem [hướng dẫn demo ngân hàng](bank-link-demo.md).

Chuyển tiền hỗ trợ cả giữa các ví của cùng người dùng và giữa hai người dùng.
Nhập mã ví, kiểm tra tên người nhận/tên ví rồi xác nhận. API không trả số dư
của người nhận. Mỗi chuyển tiền có hai vế lịch sử cùng operation_id, tổng bằng 0.

## Đóng ví và vòng đời tài khoản

- Chỉ đóng ví khi số dư đúng 0. Đóng ví đặt `is_active=false`, ngắt các liên kết
  ngân hàng; không xóa dòng ví hay lịch sử. Không có API hoặc nút khôi phục.
- Ví đã đóng không nạp/rút/chuyển/nhận tiền, không đổi tên hay liên kết lại.
  Người dùng có thể xem lịch sử trong mục **Ví đã đóng**, hoặc tạo một ví mới
  bắt đầu từ 0 với mã khác. API danh sách mặc định chỉ trả ví đang hoạt động;
  `include_closed=true` trả cả ví đã đóng của chính người đang đăng nhập.
- Kiểm tra số dư và đóng ví giữ cùng khóa dòng với thao tác chuyển tiền. Tiền
  đến trước thì đóng bị từ chối; đóng trước thì chuyển đến bị từ chối.
- Quản trị viên không được xóa vĩnh viễn người dùng đã có bất kỳ ví nào, kể cả
  ví 0đ hoặc đã đóng. API yêu cầu xóa, thử lại và worker purge cùng chặn. Có thể
  khóa/mở khóa tài khoản; mở khóa tài khoản không khôi phục ví đã đóng.

## Dữ liệu và chuyển đổi

- Bốn bảng mới `wallets`, `wallet_entries`, `wallet_demo_banks`, `wallet_bank_links`
  tách tiền ví, lịch sử bất biến, trạng thái nhà cung cấp giả lập và quyền liên kết.
- Ví mới luôn bắt đầu 0. Không chuyển số dư `accounts` cũ thành tiền trong ví mới.
- Các bảng cũ và mọi giao dịch/hóa đơn cũ được giữ nguyên. Thu chi NORMAL cũ vẫn
  nằm trong báo cáo; chuyển nội bộ/điều chỉnh cũ tiếp tục bị loại khỏi thu chi.
- `transactions.account_id` cho phép NULL cho sổ thu chi mới; ID cũ được giữ
  làm dấu vết. Không tự tạo giao dịch bù hay xóa liên kết lịch sử.
- Nhà cung cấp mô phỏng có số dư thử nội bộ riêng mỗi người dùng/ngân hàng,
  dùng chung khi liên kết nhiều ví. Không hiện số dư này trên web, không đưa vào
  tổng tiền ví/báo cáo, không đọc hay nhập lịch sử JSON ngân hàng cũ. Ngắt/liên kết
  lại không cấp lại tiền thử. OTP email chỉ xác nhận thao tác trong ứng dụng.

## Thứ tự triển khai và tương thích

1. Kiểm chứng migration `cfdb_independent_wallets` trong transaction rollback,
   đối soát hash dữ liệu các bảng cũ và giữ index trước/sau. Migration chỉ thêm
   bảng và nới NULL; API cũ vẫn hoạt động với schema mở rộng trong giai đoạn này.
2. Kiểm thử các route ví mới và sổ thu chi mới trên schema mở rộng: quyền sở hữu,
   thiếu tiền, số âm, khóa/retry, liên kết/OTP, báo cáo và ngân sách độc lập.
3. Kiểm tra type/lint/build web và các luồng giao diện, rồi mới chuyển API/web.
   Các route tạo/sửa tiền và đồng bộ ngân hàng cũ phải ngừng nhận ghi ở thời điểm
   chuyển; không duy trì hai mô hình ghi tiền đồng thời trên giao diện mới.
4. Bật `INDEPENDENT_WALLETS_ENABLED=true` ở API và
   `NEXT_PUBLIC_INDEPENDENT_WALLETS=true` ở user-web, khởi động lại API/worker
   và build lại web. Mặc định mã nguồn giữ cờ false để không chạy trước migration.
   Không chỉ tắt cờ để quay về mô hình cũ sau khi đã phát sinh dữ liệu mới.
5. Mobile chưa được sửa trong đợt này. Các endpoint accounts/transactions/bank
   cũ không được đăng ký khi bật cờ; xác nhận OCR cũ trả 409 để yêu cầu cập nhật.
   Endpoint bookkeeping từ chối account_id khác null. Mobile cần đồng bộ hợp
   đồng mới trước khi dùng với API đã chuyển đổi.

Downgrade từ chối nếu đã có tiền/lịch sử ví mới hoặc thu chi không gắn tài khoản.
Không xóa dữ liệu để ép rollback. Cần dùng backup hoặc migration tiến khi đã có
dữ liệu mới. Tài liệu `bank-link-demo.md` mô tả mô hình cũ, không dùng làm hợp đồng
cho ví độc lập.

## Kết quả kiểm chứng và triển khai local — 25/10/2026

- Đã nâng database local lên `cfdb_independent_wallets` bằng
  `capitalflow-database/tools/apply_independent_wallets.py --apply` sau khi
  backup COPY_ONLY/CHECKSUM và RESTORE VERIFYONLY. Diễn tập upgrade/downgrade
  rollback đạt; hash dữ liệu và index của 20 bảng cũ không đổi. Bốn bảng mới
  rỗng tại thời điểm chuyển đổi. Không chuyển số dư tài khoản cũ thành tiền ví.
- Đã bật hai cờ trong `.env` local của API và user-web. Chưa triển khai remote.
- 30 unit test đạt; bộ SQL OCR cũ đạt với cờ false. Bộ
  `tests/independent_wallet_integration.py` kiểm tra nạp/rút, cùng/khác chủ ví,
  thiếu tiền, phân quyền, retry, rollback nguyên tử, OTP/liên kết hết hạn,
  sổ thu chi/OCR, ngân sách/báo cáo, đóng ví và chặn purge trên SQL rollback.
- `tests/wallet_concurrency.py` chạy hai connection thật trên schema riêng
  trong tempdb: đóng/nhận tiền theo cả hai thứ tự, retry đồng thời và rút vượt
  số dư. Đạt; schema QA được dọn. Không tạo database kiểm chứng mới.
- `frontend/user-web/tests/wallet-workflow.cjs` đạt luồng UI nạp/rút/chuyển,
  xác nhận người nhận, mất phản hồi rồi thử lại không nạp trùng, đóng ví,
  xem lịch sử đã đóng, thu chi nhập tay, xác nhận OCR, dashboard, viewport 390px.
  Token/OTP và hóa đơn đã nhận dạng là fixture; dữ liệu được rollback khi dừng.
- TypeScript, ESLint và production build được kiểm tra. Chưa kiểm chứng ngân
  hàng thật, email SMTP thật, gọi OCR provider thật hoặc hiệu năng điện thoại thật.
