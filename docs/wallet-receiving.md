# Ví mặc định, email và QR nhận tiền

Cập nhật 26/10/2026. Phạm vi triển khai: API và user-web; chuẩn bị hợp đồng cho Mobile.

## Quy tắc nghiệp vụ

- Đăng ký thành công tạo một ví mặc định, số dư 0, cùng transaction với tài khoản.
- Đăng nhập thành công bổ sung ví mặc định nếu tài khoản cũ chưa có. Đọc danh sách
  ví có cùng cơ chế dự phòng. Khóa user và unique filtered index bảo vệ gọi đồng thời.
- Mỗi user có tối đa một ví mặc định. Ví này có thể đổi tên nhưng không đóng,
  kể cả số dư 0. Ví phụ vẫn chỉ đóng khi hết tiền; lịch sử được giữ, không khôi phục.
- Email là mã nhận tiền dễ nhớ của ví mặc định. UUID vẫn là định danh cố định trong
  sổ tiền và QR. Email chuyển vào ví mặc định; QR ví nào chuyển vào chính ví đó.
- Ví phụ có mã công khai `CF-` + 8 ký tự, ví dụ `CF-7K9M2P4R`. Mã được cấp cho
  cả ví phụ đã có, không đổi khi đổi tên, không tái sử dụng khi đóng ví. Unique
  constraint và retry khi va chạm bảo vệ cấp mã đồng thời. Không cắt ngắn UUID.
- Giao diện chi tiết/sao chép và QR hiển thị email cho ví mặc định, mã ngắn cho
  ví phụ; không dùng UUID làm giá trị hiển thị dự phòng.
- Không có tiền tặng khi đăng ký/đăng nhập. Tiền đến từ nạp ngân hàng demo hoặc
  chuyển từ ví có số dư. Ghi nhận OCR/thủ công không tác động số dư.
- Tra cứu tên là bước kiểm tra người nhận, không phải xác minh danh tính pháp lý.
  Chỉ trả tên hiển thị và thông tin ví cần thiết, không trả số dư hay email của ví tra bằng UUID.
- Tài khoản bị khóa/xóa, ví đóng hoặc không tồn tại đều không nhận tiền. Lệnh chuyển
  kiểm tra lại trạng thái; kết quả tra cứu trước đó không cấp quyền chuyển.

## API dành cho web và Mobile

Các đường dẫn dưới đây có prefix `/api/v1`, đều cần Bearer token.

`GET /wallets` thêm `is_default`, `receive_code`, ví mặc định đứng đầu.

`GET /wallets/{wallet_id}/receive` chỉ chủ ví đang hoạt động được gọi:
`wallet_id`, `wallet_name`, `recipient_name`, `receive_code`, `is_default`,
`qr_version: 1`, `qr_payload`, `qr_image_data_url` (SVG nền trắng).
Web hiển thị và tải QR; không gửi dữ liệu QR cho dịch vụ tạo mã bên ngoài.

Payload QR phiên bản 1:

```text
capitalflow://transfer?v=1&wallet_id=<UUID>
```

`POST /wallets/recipients/resolve` nhận `{ "recipient": "email | mã CF- | UUID | nội dung QR" }`.
Trả `id`, `name`, `recipient_name`, `is_own`, `is_default`. Email được trim và
chuẩn hóa chữ thường. Giới hạn 30 lượt/phút theo cấu hình limiter hiện hành;
response không cache. QR sai phiên bản, thừa trường hoặc lặp wallet_id bị từ chối 422.
Mã CF- được trim và chuyển chữ hoa khi tra cứu, chỉ dùng cho ví phụ. UUID cũ còn
được nhận để tương thích và QR vẫn dùng UUID nên mã QR đã chia sẻ không bị hỏng.

Mobile khi đồng bộ:
1. Quét QR CapitalFlow hoặc nhập email/mã ví; gọi resolver. Không tự mở URL bất kỳ.
2. Hiển thị tên người nhận, tên ví, ví nguồn và số tiền để người dùng kiểm tra.
3. Chỉ khi xác nhận mới gọi `POST /wallets/{source_id}/transfers/create` với
   `{ "to_wallet_id": "UUID đã tra cứu", "amount": "100000" }` và `Idempotency-Key`.
4. Khi mất phản hồi, retry cùng nội dung và cùng key; đổi nội dung phải tạo key mới.
   Quét QR không tự chuyển tiền. Không tin tên/số tiền do nội dung QR tự khai báo.

QR này là định dạng nội bộ CapitalFlow, không phải VietQR/ngân hàng thật.
Màn hình camera, xử lý deep link và đồng bộ ví trên ứng dụng Mobile chưa triển khai
trong đợt API/user-web này; chưa nghiệm thu quét trên điện thoại thật.

## Migration và kiểm chứng

Revision hiện tại `cfdb_wallet_short_code` nối `cfdb_default_wallet`, bổ sung
`wallets.short_code` NOT NULL + unique constraint và cấp mã cho ví đã có.
`tools/apply_wallet_short_code.py --apply` đã backup/VERIFYONLY, diễn tập, đối soát
các trường cũ và chạy Alembic check. Backup:
`C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\Backup\CapitalFlow_pre_wallet_short_code_20261026_160942_c3673944.bak`.

Đã mở rộng integration test để cố ý gây trùng mã rồi retry, kiểm tra mã không đổi
khi đổi tên, mã ví đóng không nhận tiền, mã chữ thường tra đúng ví. UI kiểm tra
email ví mặc định và mã CF- của ví phụ, không hiển thị UUID trong chi tiết.
Tên miền dev đã kiểm tra trả `Cache-Control: no-store, max-age=0`, CDN no-store,
Cloudflare BYPASS; trước đó bundle có max-age=14400 gây lưu giao diện cũ.

`cfdb_default_wallet` nối `cfdb_email_only`: thêm cột, constraint ví mặc định hoạt động,
unique index theo user và tạo ví 0 cho user hiện có chưa bị xóa. Không đổi ví cũ/số dư cũ.
Không tự hạ migration khi đã có ví mặc định, tránh làm mất định danh nhận tiền.

`capitalflow-database/tools/apply_default_wallet.py --apply` đã diễn tập rollback,
đối soát dữ liệu, sao lưu COPY_ONLY/CHECKSUM + VERIFYONLY và áp dụng SQL Server local.
Backup:
`C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\Backup\CapitalFlow_pre_default_wallet_20261026_155551_55baa7c5.bak`.

Đã kiểm tra SQL schema với Alembic check, build user-web, auth_email_integration,
wallet_receiving_integration, wallet_concurrency và wallet-receiving-ui.
SQL tests dùng schema tempdb riêng và dọn sau chạy; UI intercept API, không gửi tiền thật.
Bao gồm đăng ký/login đồng thời, email/QR đúng ví, quyền chủ ví, người nhận không khả dụng,
chống retry/trừ quá số dư, tổng sổ tiền, xác nhận UI và QR ở chiều rộng 390px.
