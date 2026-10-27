# Đăng ký, đăng nhập và OTP bằng email

Cập nhật 26/10/2026. CapitalFlow đã bỏ chức năng số điện thoại theo yêu cầu.

- Đăng ký nhận `email`, `password`, `full_name`; không yêu cầu hay lưu số điện thoại.
- Đăng ký tạo ví mặc định số dư 0; đăng nhập bổ sung nếu tài khoản cũ chưa có.
  [Quy tắc ví mặc định và nhận tiền bằng email/QR](wallet-receiving.md).
- Mỗi email chỉ thuộc một tài khoản đang giữ định danh đó. API chuẩn hóa chữ thường;
  unique index `UX_users_email` bảo vệ cả đăng ký đồng thời. Email trùng trả 409.
- Đăng nhập bằng `{email, password}`. Payload `identifier` cũ còn tương thích nếu
  giá trị là email hợp lệ; số điện thoại bị từ chối. Không gửi cả hai trường.
- OTP quên mật khẩu và OTP liên kết ngân hàng gửi qua email, phân biệt purpose.
  Kiểm thử đã xác nhận mã reset chỉ dùng một lần và mật khẩu mới đăng nhập được.
- Không còn endpoint `/auth/phone/*`, giao diện xác minh điện thoại, OTP demo/SMS,
  adapter Twilio hoặc cấu hình SMS trong ứng dụng.
- Email bị khóa/xóa không được đăng nhập. Chính sách vòng đời và giải phóng email
  của quản trị được giữ nguyên; việc bỏ số điện thoại không xóa tài khoản.

## Database và triển khai

Migration email `cfdb_email_only` nối sau `cfdb_phone_verify`. Bỏ ba cột điện thoại,
check/index liên quan và OTP purpose PHONE_DEMO/PHONE_SMS; giữ người dùng, mật khẩu,
phiên đăng nhập, liên kết ngân hàng, số dư, giao dịch và OTP email.
Các migration cũ vẫn nằm trong chuỗi lịch sử để cài đặt/nâng cấp database.

`tools/apply_email_only.py --apply` diễn tập rollback và đối soát dữ liệu, tạo
backup COPY_ONLY/CHECKSUM, VERIFYONLY rồi áp dụng. Downgrade chỉ phục hồi cấu trúc
cột NULL; khôi phục giá trị điện thoại cũ cần bản backup.

Đã chạy `auth_email_integration.py`, `test_auth_email.py`, `user_banks_integration.py`,
`auth-email-ui.cjs`, `user-banks-ui.cjs` và production build. Test dữ liệu trong
schema tempdb riêng, email được mock; không gửi email thử cho tài khoản thật.
