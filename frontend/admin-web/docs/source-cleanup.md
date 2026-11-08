# Rà soát và dọn cấu trúc admin-web — 07/11/2026

**Ghi nhận lượt trước.** Các nhãn/trạng thái xóa được giữ ở lượt này đã được
gỡ tiếp trong [lượt dọn thứ hai](source-cleanup-round-2.md), gồm cả API/DB theo
phạm vi chủ dự án duyệt. Cây nguồn và kết quả kiểm tra mới xem báo cáo đó.

Đã kiểm kê toàn bộ mã trong `src`, các import, route, nơi gọi API, CSS, cấu hình build và tài liệu chỉ dẫn. Không chỉnh API, user-web hoặc dữ liệu chính.

- Chuyển 18 file về vị trí có chủ sở hữu rõ ràng: router và layout ứng dụng, thành phần bảo mật, formatter nhật ký, UI dùng chung và CSS của từng nhóm.
- Loại component `BrandLogo` không có nơi gọi; giữ `BrandMark` được ứng dụng sử dụng. Ba helper chỉ dùng nội bộ không còn export. Giữ hàm tạo workbook được chức năng xuất Excel dùng nội bộ.
- Bỏ 436 selector CSS không có nơi sử dụng trong mã hiện tại. Khi rà soát có xét các class tạo động, trạng thái, module và media query; không dùng việc class chưa xuất hiện trên một ảnh chụp làm căn cứ xóa.
- Đổi tên class giao diện mang hậu tố `demo` sang tên chức năng hiện tại. Xóa banner chú thích sinh tự động chứa đường dẫn cũ. Favicon dùng tệp có sẵn thay cho bản SVG lặp trong HTML.
- Không tìm thấy route/xử lý cho tra soát thanh toán, hỗ trợ không nhận OTP hoặc nghi tài khoản bị chiếm. Hỗ trợ vẫn đúng hai ca mất quyền truy cập email đăng ký và tài khoản bị khóa. Giữ nhãn nhật ký và trạng thái tài khoản cần để hiển thị dữ liệu thực.

## Xác minh

- 67 module giữ nguyên nội dung xử lý sau khi chuẩn hóa đường dẫn, tên class và các phần thừa đã nêu.
- Mã nguồn từ 9.122 xuống 7.382 dòng, gồm cả phần chú thích dư đã gỡ. CSS chung sau build từ khoảng 127,6 kB xuống 94,7 kB.
- 12 khai báo route và 37 vị trí gọi API được giữ nguyên.
- 1.203 selector CSS còn lại giữ nguyên khai báo, thứ tự và điều kiện media; tách UI/khung ứng dụng tại ranh giới có sẵn, không đổi thứ tự nạp.
- Bộ kiểm tra cấu trúc xác minh toàn bộ file nguồn còn được nối từ `main.jsx`, import không gãy và các tên CSS Module hợp lệ.
- Lint, 31 ca logic, kiểm tra cấu trúc và build đạt. Cảnh báo chunk ExcelJS lớn vẫn là cảnh báo có sẵn.
- Bản preview trả được entry cho toàn bộ 10 trang đăng nhập/nghiệp vụ; đây là kiểm tra phục vụ file, không phải kiểm thử thao tác trình duyệt. Môi trường và database thử đã được dọn; database chính giữ nguyên.

Trình duyệt local đang bị tắt trong Work settings ở lượt này, vì vậy không ghi nhận kiểm thử tương tác mới. Các kết quả giao diện trước đây được giữ làm bằng chứng lịch sử, không tính lại thành lượt kiểm thử sau dọn mã.

[Cây thư mục hiện tại](../README.md) · [Đối chiếu xử lý và CSS trước/sau](../../../output/admin-web-qa/cleanup-equivalence.json) · [Manifest nguồn sau dọn](../../../output/admin-web-qa/source-audit-after.json).
