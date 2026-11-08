# Đợt 1 — Đăng nhập, phiên và phân quyền

Hoàn thành phạm vi frontend ngày 06/11/2026. User-web đã được người dùng chốt và không được sửa trong đợt này.

## Thay đổi

- Chặn gửi lặp ngay trong handler đăng nhập, đổi mật khẩu và thu hồi phiên.
- Xác minh vai trò ADMIN từ `/auth/me` trước khi lưu token; cùng một hàm kiểm tra vai trò được dùng ở layout quản trị.
- Thu hồi refresh token vừa được cấp nếu kiểm tra vai trò thất bại hoặc người dùng rời màn đăng nhập. Hủy request khi màn đăng nhập bị tháo khỏi cây giao diện.
- Phân biệt lỗi xác thực, lỗi mạng và HTTP 429. Trạng thái tạm dừng đăng nhập phản ánh thời gian chờ; không gọi đó là khóa tài khoản ở backend.
- Bổ sung nhãn/id, autocomplete, mô tả lỗi, tên nút hiện mật khẩu và trạng thái busy. Form bị ẩn không nhận focus bàn phím.
- Thêm nút bật/tắt đèn bằng bàn phím và sửa bố cục điện thoại. Giữ tương tác kéo dây; tăng vùng chạm và xử lý touch-cancel, đa chạm, mất focus cửa sổ.
- Đối chiếu mật khẩu mới với chính sách backend: 6–128 codepoint, ít nhất 6 ký tự không phải khoảng trắng; giữ nguyên nội dung mật khẩu khi gửi.
- Khóa ô nhập khi đang đổi mật khẩu; dọn timer chuyển về đăng nhập khi component bị tháo.
- Chặn thao tác thu hồi phiên hiện tại ở handler; giữ phiên hiện tại sau khi thu hồi phiên khác.

## Kiểm tra tự động

- `npm run lint`: đạt, không cảnh báo lint.
- `npm run build`: đạt. Cảnh báo kích thước chunk ExcelJS lớn đã có từ trước, chưa xử lý trong đợt xác thực.
- `npm test`: 24 kiểm tra đạt; dùng Axios interceptor thật và HTTP adapter trong bộ nhớ, không gửi request ra dịch vụ thật.
- Các ca gồm vai trò thiếu/sai kiểu/USER, từ chối và thu hồi phiên mới, giữ nguyên password, Unicode/khoảng trắng/giới hạn mật khẩu, profile lỗi và hủy đăng nhập.
- Refresh: hai 401 dùng chung một lần refresh; lỗi tạm thời giữ phiên; refresh bị từ chối xóa phiên; phản hồi muộn sau logout không ghi đè phiên mới; 403 nghiệp vụ không tự refresh hay đăng xuất.

## Quan sát giao diện trực tiếp

Các ca xác thực và đổi mật khẩu dưới đây dùng tài khoản tổng hợp cùng API mô phỏng trong bộ nhớ; không thay đổi mật khẩu hay phiên của tài khoản thật. HTML/entry kiểm thử đã được gỡ trước bản build cuối.

- Nút bật đèn hoạt động bằng Enter; tab không đi vào form đang ẩn.
- Kéo dây bằng chuột mở được form; kéo ngắn dưới ngưỡng không đổi trạng thái.
- Desktop 1280×900, tablet 768×1024, mobile 390×844 và 320×740: không tràn ngang; form dùng được ở màn hình hẹp.
- Form rỗng/email sai: hiện thông báo tiếng Việt, chưa gửi yêu cầu đăng nhập.
- Hiện/ẩn mật khẩu đổi đúng loại input và giữ nội dung.
- Tài khoản USER: không vào dashboard, request thu hồi token mới được ghi nhận một lần.
- Lỗi mạng: giữ form và báo lỗi hệ thống. HTTP 429: vô hiệu hóa input theo Retry-After rồi tự cho phép thử lại.
- Năm lần đăng nhập sai: biểu mẫu tạm dừng 30 giây. Tải lại URL đăng nhập vẫn giữ thời gian chờ.
- ADMIN hợp lệ: mở dashboard; bấm đúp chỉ tăng bộ đếm đăng nhập một lần. Dữ liệu dashboard bị loại khỏi fixture nên màn lỗi dữ liệu ở đó không được tính là nghiệm thu dashboard.
- Đăng xuất: một request logout; mở trực tiếp `/users` sau đó được đưa về `/login`.
- Tài khoản bắt buộc đổi mật khẩu: chuyển sang mục Người dùng vẫn giữ màn thiết lập; không yêu cầu mật khẩu hiện tại; đổi thành công về đăng nhập.
- Đổi mật khẩu thường: chặn thiếu mật khẩu hiện tại, thiếu ký tự có nghĩa và xác nhận không khớp trước khi gửi. Bấm đúp chỉ gửi một request, ô nhập bị khóa khi đang xử lý, thành công về đăng nhập.
- Thu hồi phiên khác: bấm đúp chỉ gửi một request; phiên hiện tại còn; nút thu hồi các phiên khác bị tắt khi chỉ còn phiên hiện tại.
- Console trình duyệt không ghi nhận lỗi trong các lượt quan sát trên.

## Đối chiếu bản production

Log máy chủ Vite có một lỗi `Invalid hook call` khi entry kiểm thử tạm được nạp lại. Các lượt quan sát sau đó không gặp lại. `npm ls react react-dom --all` xác nhận cùng React/React DOM 19.2.8, không có bản cài trùng.

Đã mở nguyên bản `dist` sau build trên localhost:5174, với HTTP auth giả lập trong bộ nhớ và tài khoản tổng hợp. ADMIN vào được layout, mở và tải lại màn bảo mật; USER bị từ chối; tài khoản bắt buộc đổi mật khẩu vẫn bị giữ ở màn thiết lập khi chuyển sang Người dùng; đăng xuất về đăng nhập. Console không có lỗi React hoặc cảnh báo trong lượt này. Mobile 390×844 có scrollWidth bằng clientWidth (390 px). Lỗi cũ chưa tái hiện trên production; chưa đủ bằng chứng để kết luận nguyên nhân của lỗi Vite.

Máy chủ kiểm thử production đã được dừng. Dữ liệu nghiệp vụ dashboard cố ý trả 503 nên kết quả này chỉ xác minh luồng xác thực/layout, không nghiệm thu dashboard hay backend thật.

## Giới hạn bằng chứng

Chưa chạy lại tích hợp auth với API/DB thật. Chưa kiểm tra thao tác chạm trên thiết bị vật lý, touch-cancel/blur giữa một gesture bằng thiết bị thật, hoặc trình đọc màn hình. Kiểm tra responsive ở trên dùng viewport trình duyệt; không được diễn giải thành đã kiểm tra cảm ứng thật. Các trạng thái touch-cancel/blur đã có xử lý trong mã nhưng không được đánh dấu là đã quan sát thành công.

## Ảnh đối chiếu

- [Desktop](/D:/code/DoAn_KLCN/output/admin-web-qa/batch-1/login-desktop.jpg)
- [Tablet](/D:/code/DoAn_KLCN/output/admin-web-qa/batch-1/login-tablet.jpg)
- [Mobile](/D:/code/DoAn_KLCN/output/admin-web-qa/batch-1/login-mobile.jpg)
- [Mobile trên bản production](/D:/code/DoAn_KLCN/output/admin-web-qa/batch-1/login-production-mobile.jpg)

## Đợt tiếp theo

Đợt 2 xử lý quản lý người dùng và danh mục hệ thống theo kế hoạch `implementation-batches.md`. Các phân hệ khác chưa được tính là đã nghiệm thu bởi kết quả đợt 1.
