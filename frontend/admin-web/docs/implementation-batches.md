# Triển khai admin-web theo từng đợt

User-web đã được người dùng tự kiểm thử và chốt. Công việc tiếp tục ở admin-web.

**Chốt ngày 07/11/2026:** đã hoàn tất các lượt kiểm tra giao diện còn thiếu của cả 5 đợt. Admin-web đạt điều kiện chuyển sang phần tiếp theo trong phạm vi demo khóa luận đã thống nhất. Kết quả cuối ở mục **Kiểm tra cuối trên bản build và SQL Server local** bên dưới thay thế các ghi chú “còn thiếu / chưa thử” của từng đợt. Các mục đợt 1–5 được giữ làm lịch sử triển khai.

## Đợt 1 — Đăng nhập, phiên và phân quyền

Trạng thái: hoàn thành triển khai và kiểm tra frontend ngày 06/11/2026. Xem [kết quả đợt 1](batch-1-auth.md). Tích hợp backend thật không được tính là đã chạy trong lượt này.

- Chặn gửi lặp, xử lý lỗi xác thực/mạng và kiểm tra vai trò trước khi lưu phiên.
- Thu hồi token vừa cấp nếu tài khoản không được phép vào admin.
- Kiểm tra refresh đồng thời, đăng xuất, phản hồi muộn và bắt buộc đổi mật khẩu.
- Hoàn thiện nhãn form, thao tác bàn phím và bố cục đăng nhập trên điện thoại.
- Đối chiếu chính sách mật khẩu với backend; chống gửi lặp khi đổi mật khẩu/thu hồi phiên.
- Chốt bằng kiểm tra hồi quy, lint, build và quan sát giao diện. Phân biệt kiểm thử mô phỏng với tích hợp backend thật.

## Đợt 2 — Người dùng và danh mục hệ thống

Đã triển khai frontend. Quyền đổi vai trò lấy từ hồ sơ quản trị, dựa trên cờ tài khoản hệ thống. Thao tác theo lô giữ danh sách đã xác nhận và kiểm tra lại điều kiện trước khi gửi. Form danh mục từ chối tên toàn khoảng trắng, khóa thao tác khi đang lưu và giữ mục vừa sắp xếp.

Trên bản build với dữ liệu giả lập, ADMIN thường thấy các thao tác phù hợp và tài khoản hệ thống hoặc đã xóa bị khóa ô chọn. Bấm đúp khóa theo lô, tạo danh mục, sắp xếp và đổi trạng thái mỗi thao tác gửi đúng một yêu cầu. Thay đổi giữ mục sau khi sắp xếp và cố định danh sách xác nhận theo ID đã qua lint/build sau lượt quan sát này.

Đối chiếu mã API danh mục cho thấy user-web lấy danh mục đang hoạt động mặc định. Ngừng dùng cập nhật `is_active` trên cùng ID, còn tra cứu lịch sử có thể dùng `status=all`. Chưa thử luồng liên thông với DB thật, chưa chạy phân trang nhiều trang hoặc đổi vai trò bằng System Admin trên trình duyệt.

## Đợt 3 — Dashboard, phân tích và giám sát OCR

Đã triển khai frontend. Dashboard, phân tích và giám sát OCR giữ số liệu đã tải kèm thông báo khi cập nhật thất bại. Gửi lại OCR có khóa chống gửi lặp và thông báo phân biệt yêu cầu xử lý lại với kết quả xử lý.

Đã quan sát dashboard và giám sát OCR hiển thị dữ liệu mẫu. Bấm đúp thử lại OCR gửi đúng một yêu cầu theo bộ đếm API giả lập. Kiểm tra tự động đạt cho kỳ tuần qua giao năm, ngày nhuận và tháng cũ. Ca xác nhận cảnh báo khi mất kết nối và kiểm tra biểu đồ theo kỳ trên trình duyệt còn thiếu.

## Đợt 4 — Nhật ký, email và cài đặt

Đã triển khai frontend. Xuất Excel chặn gửi lặp và chỉ hoạt động khi trang nhật ký có dữ liệu sử dụng được. Tab email theo URL để mở đúng khi tải lại. Cấu hình SMTP kiểm tra tên máy chủ và cổng, khóa form trong lúc gửi, dọn bản nháp sau khi lưu và giữ quy ước mật khẩu trống của API. Xem trước email hủy request khi rời bản ghi.

Lint và build đã đạt. Các ca trình duyệt về xuất Excel, lọc và xem nhật ký, lưu cấu hình và xem trước email còn thiếu. Chưa thử SMTP thật.

## Đợt 5 — Hồi quy liên thông và responsive

Đã chạy `npm test` (31 ca), `npm run lint`, `npm run build` và `git diff --check` cho admin-web. Build có cảnh báo chunk ExcelJS vượt 500 kB. Dữ liệu trình duyệt là dữ liệu mô phỏng. Người dùng đã chốt user-web từ trước, vì vậy lượt này chỉ đối chiếu hợp đồng API khi cần.

Đã kiểm tra đăng nhập ở desktop, tablet và mobile trong đợt 1, cùng các ca chọn tài khoản, thao tác danh mục và retry OCR trên desktop ở đợt 2–3. Quyền điều khiển trình duyệt hiện tắt trong Work settings. Hồi quy giao diện bản build cuối, responsive các màn nghiệp vụ và tích hợp API/DB thật còn mở.

Bằng chứng gồm [ảnh danh mục desktop](/D:/code/DoAn_KLCN/output/admin-web-qa/categories-desktop.jpg) và [số yêu cầu API mô phỏng](/D:/code/DoAn_KLCN/output/admin-web-qa/batches-qa-counts.json).

## Hỗ trợ tài khoản

- Người dùng mở **Cần hỗ trợ đăng nhập?** từ màn đăng nhập và chọn **Mất quyền truy cập email đăng ký** hoặc **Tài khoản bị khóa**. Admin có thể nhập phiếu nhận ngoài hệ thống. Hai kênh dùng chung một phiếu đang mở cho cùng email và loại vấn đề.
- Phiếu mất quyền truy cập email yêu cầu một địa chỉ liên hệ khác để admin trao đổi. Phiếu tài khoản bị khóa có thể chuyển cho admin gốc. Việc mở khóa thực hiện trong **Người dùng**, theo quyền quản trị hiện có.
- Admin hỗ trợ xử lý phiếu và có thể chuyển cấp. Ca đã chuyển cấp do admin gốc xử lý. Đổi quyền quản trị thu hồi phiên trước.
- 205 kiểm tra API trên SQL Server riêng đã đạt, gồm hai loại phiếu, OTP tự phục vụ, OTP liên kết ngân hàng và thanh toán ví.

Ngày 07/11/2026 đã nâng `personal_finance` local đến revision `cfdb_support_two_cases`. Đã xác minh backup `CapitalFlow_pre_two_support_cases_20261106_190108_ee693d09.bak` và đối soát dữ liệu ở các cột giữ lại trong 26 bảng.

## Kiểm tra cuối trên bản build và SQL Server local

Ngày 07/11/2026, kiểm tra bản build production của admin-web qua trình duyệt, FastAPI thật và SQL Server local riêng. Tài khoản, hóa đơn, giao dịch, cấu hình gửi thư và phiếu đều là dữ liệu thử. Các lỗi HTTP 503 được tạo có kiểm soát bằng proxy loopback. Lượt này không thay đổi dữ liệu của `personal_finance` và không mở rộng chức năng sản phẩm.

- **84 xác nhận giao diện đạt**, trong đó có **36 kiểm tra bố cục**: 9 màn nghiệp vụ ở chiều rộng 320, 390, 768 và 1280 px. Không tràn ngang toàn trang. Đã thao tác menu điện thoại, form danh mục dài, chi tiết nhật ký và cấu hình SMTP trên màn nhỏ. Đây là giả lập kích thước bằng trình duyệt desktop, không phải kiểm thử thiết bị vật lý.
- **Nhật ký quản trị:** phân trang, nhóm hoạt động, kết quả HTTP, tìm kiếm, ngày Việt Nam, chi tiết che mật khẩu, bỏ lọc và danh sách rỗng. Tệp Excel tải xuống được mở lại bằng ExcelJS: đúng 9 dòng đã lọc, 7 cột, mã HTTP 422, cột thời gian là ngày Excel và không chứa mật khẩu mẫu. Bấm đúp xuất chỉ tạo một tệp; danh sách rỗng không cho xuất.
- **Email và cấu hình:** phân trang, lọc người nhận/loại/trạng thái, nguyên nhân lỗi, trạng thái rỗng; xem trước thư thử trong iframe có sandbox; không xem nội dung thư nghiệp vụ. Đã thử lỗi tải bản xem trước rồi tải lại thành công. SMTP chặn hostname/cổng sai, bỏ bản nháp, lưu một lần khi bấm đúp, dọn ô mật khẩu sau lưu, giữ secret khi mật khẩu trống, giữ tab khi tải lại và giữ bản nháp khi API lỗi. Gửi thử chỉ báo đã xếp hàng; bấm đúp tạo một yêu cầu.
- **Tổng quan, phân tích, OCR:** giữ dữ liệu đã tải và cảnh báo khi cập nhật thất bại. Đổi kỳ ngày/tuần/tháng đồng bộ biểu đồ; tháng không có giao dịch hiển thị 0. Gửi lại OCR chỉ tạo một yêu cầu và chuyển đúng sang hàng đợi, không báo đã xử lý xong.
- **Người dùng, danh mục:** phân trang danh sách thật, tìm kiếm và đổi tài khoản QA sang admin hỗ trợ bằng admin gốc. Tên danh mục toàn khoảng trắng bị chặn; tạo, sửa, sắp xếp, ngừng dùng và kích hoạt lại được lưu đúng. Bấm đúp tạo/sắp xếp/đổi vai trò đều chỉ tạo một yêu cầu.
- **Hỗ trợ và phiên:** đóng phiếu mất email và tìm lại qua bộ lọc Đã xử lý; admin hỗ trợ chuyển phiếu khóa tài khoản cho admin gốc rồi không được tự đóng. Admin hỗ trợ chỉ có Hỗ trợ tài khoản và bảo mật cá nhân; mở trực tiếp `/users` được chuyển về `/support`. Đăng xuất rồi mở trang bảo vệ được chuyển về đăng nhập.
- **Kiểm tra mã:** lint, build và 31 ca frontend đạt; `git diff --check` không có lỗi khoảng trắng. Không cần sửa mã giao diện sản phẩm trong lượt kiểm tra cuối. Giữ font Inter và kích thước điều khiển đã thống nhất; không thêm ngoại lệ thiết kế mới.
- **Hồi quy API cuối:** chạy lại đủ **205 kiểm tra đạt, 0 thất bại, 27 endpoint quản trị**, trên SQL Server tạm được áp dụng toàn bộ migration rồi dọn sau kiểm thử. Lệnh tái hiện: `capitalflow-api/.venv/Scripts/python.exe -B output/admin-web-qa/run-isolated-sqlserver.py --assess-wallet-safety` từ thư mục gốc dự án. Các thư gửi ra ngoài được mô phỏng trong bộ API này.

Bằng chứng:

- [84 xác nhận giao diện và số đo responsive](../../../output/admin-web-qa/admin-final-ui-results.json)
- [Bộ đếm yêu cầu của trình duyệt](../../../output/admin-web-qa/admin-final-request-counts.json)
- [Kết quả API cuối](../../../output/admin-web-qa/admin-final-api-results.json)
- [Tệp Excel đã đối chiếu](../../../output/admin-web-qa/admin-final-audit-export.xlsx)
- [Hỗ trợ trên desktop](../../../output/admin-web-qa/admin-final-support-desktop.png), [quyền admin hỗ trợ](../../../output/admin-web-qa/admin-final-support-restricted.png), [xem trước email](../../../output/admin-web-qa/admin-final-email-desktop.png), [nhật ký mobile](../../../output/admin-web-qa/admin-final-audit-mobile.png), [SMTP mobile](../../../output/admin-web-qa/admin-final-smtp-mobile.png).

Giới hạn còn lại phù hợp phạm vi demo: chưa xác nhận thư đến hộp thư SMTP thật; lượt giao diện chỉ kiểm tra đưa OCR vào hàng đợi, không chạy dịch vụ OCR thật. Phiếu mất quyền truy cập email là tiếp nhận và quản lý yêu cầu, chưa tự động xác minh danh tính hoặc đổi email. Cảnh báo build về chunk ExcelJS trên 500 kB còn tồn tại, không chặn chức năng xuất tệp. Không dùng kết quả này để kết luận hệ thống sẵn sàng vận hành thực tế ở mọi môi trường.

Sau lượt chốt trên, admin-web đã áp dụng [quy chuẩn giao diện của user-web](../DESIGN.md) về font, kích thước điều khiển và khoảng cách. Lượt đồng bộ kiểm tra riêng giao diện và đăng nhập; không thay đổi API, phân quyền hoặc phạm vi hỗ trợ đã chốt.
