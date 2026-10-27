# Ngân hàng cấp người dùng và OTP email — 26/10/2026

Phạm vi: API và user-web. Mobile chưa đổi hợp đồng trong đợt này.

## Ngân hàng demo

- `GET /wallets/providers` cấp bốn tài khoản riêng khi người dùng mở phần ví.
  Khóa người dùng và unique `(user_id, provider)` ngăn cấp lặp khi gửi đồng thời.
  Unique `(provider, account_number)` ngăn hai người nhận cùng tài khoản.
- Số tiền giả ban đầu: VCB 25.000.000đ; ACB 10.000.000đ; MB 20.000.000đ;
  TCB 30.000.000đ. Liên kết lại không cấp lại tiền và không đổi số tài khoản.
- Không đồng bộ số dư hoặc lịch sử ngân hàng, không sinh thu/chi từ tiền mẫu.
- Liên kết kiểm tra cả người sở hữu, ngân hàng và số tài khoản. Số của người khác
  bị từ chối trước khi gửi OTP, không tiết lộ thông tin chủ tài khoản.
- `GET /wallets/banks`, `POST /wallets/banks/send-otp`, `POST /wallets/banks`,
  `DELETE /wallets/banks/{link_id}` quản lý liên kết cấp người dùng.
  OTP liên kết vẫn gửi email, ràng buộc người dùng và ngân hàng demo cụ thể.
- Liên kết dùng cho mọi ví đang hoạt động, kể cả ví tạo sau này. Đóng một ví
  không ngắt liên kết. Ngắt/hết hạn liên kết chặn nạp/rút ở mọi ví.
- `GET /wallets/{wallet_id}/banks` còn tương thích dạng đọc. Lệnh ghi theo từng
  ví được thay bằng hợp đồng cấp người dùng ở trên.
- Web: **Ví → Ngân hàng của tôi**, dùng được cả khi chưa tạo ví. Form hiển thị
  số demo riêng, giải thích việc ngắt liên kết ảnh hưởng tất cả ví.

## Xác nhận bằng email

OTP liên kết gửi tới email của người dùng, ràng buộc tài khoản ngân hàng được cấp
riêng. Số điện thoại, OTP điện thoại và kết nối SMS đã bỏ khỏi dự án.
Xem [hợp đồng email](auth-email.md). Việc bỏ điện thoại không thay đổi quyền sở hữu
ngân hàng hoặc liên kết dùng chung mọi ví.

## Kiểm chứng

`user_banks_integration.py`: cấp riêng/dồng thời, chặn liên kết tài khoản người khác,
liên kết trước khi tạo ví, dùng chung/ngắt liên kết mọi ví, giữ số dư khi liên kết lại.
`user-banks-ui.cjs`: quản lý ngân hàng dùng chung và xác nhận không còn UI điện thoại.
