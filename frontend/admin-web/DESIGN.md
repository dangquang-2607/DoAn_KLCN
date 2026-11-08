# Chuẩn giao diện admin-web

Áp dụng [quy chuẩn user-web](../user-web/DESIGN.md) cho font, kiểu chữ tiêu đề, điều khiển và khoảng cách. Giữ nội dung, màu sắc, cách tổ chức màn hình và chức năng của cổng quản trị.

- **Font:** Inter; nội dung, nhãn, button và ô nhập thông thường 14px/20px; chú thích 13px/20px. Nhãn và button đậm 600. Font được phục vụ từ `public/fonts` với các bộ ký tự Latin, Latin mở rộng và tiếng Việt, lấy từ cùng bộ Inter mà user-web đã tải. Kèm [giấy phép Inter](public/fonts/Inter-OFL.txt).
- **Tiêu đề trang:** dùng kiểu `.cf-workspace-head` như user-web: Inter đậm 780, cỡ chữ `clamp(32px, 3vw, 46px)`, giãn dòng 1,1 và giãn ký tự `-.055em`. Phần mô tả dùng 14px với giãn dòng 1,65. Biến thể compact của admin chỉ điều chỉnh khoảng cách bố cục.
- **Điều khiển:** button và ô nhập chuẩn 40px, bo góc 6px. Padding button dọc 9px/ngang 16px; ô nhập dọc 9px/ngang 12px. Dành chỗ thêm cho kính lúp, mũi tên, lịch và nút hiện mật khẩu. Nút dài được tăng chiều cao.
- **Biến thể:** nút nhỏ 32px, chữ 13px/20px, padding 5px/12px. Nút chỉ có icon 40×40px, thao tác trong bảng/danh sách 32×32px. Textarea tối thiểu 80px và có thể kéo cao. Bộ lọc ghép của nhật ký lấy kích thước 40px theo khung ngoài; ô nằm bên trong chừa chỗ cho viền.
- **Form:** nhãn cách ô nhập 6px; giữa các trường 16px; giữa các nút 8px. Padding phần đầu và nội dung modal là 20px/24px, footer 12px/24px. Từ 540px trở xuống, đầu/nội dung là 16px/20px, footer 12px/20px. Phần nội dung được cuộn khi dài.
- **Đăng nhập:** giữ bố cục đèn; ô nhập và nút đăng nhập cao 48px trong nhóm riêng. Trên điện thoại, chữ ô nhập là 16px.

Các biến `--cf-control-*`, `--cf-button-padding-x`, `--cf-input-padding-x`, `--cf-label-gap`, `--cf-field-gap` và `--cf-dialog-*` được đặt trong `src/dung-chung/CSS/ui.css` với cùng tên và giá trị như user-web. CSS theo màn chỉ điều chỉnh bố cục và các trường hợp riêng của admin. Khung ứng dụng nằm trong `shell.css`, các quy tắc quản trị chung nằm trong `workspace.css`; thứ tự nạp được khai báo tại `src/main.jsx`.

Ngày 07/11/2026: đã kiểm tra bản build với API và SQL Server local riêng. Đã đo 9 màn nghiệp vụ và tab SMTP tại 320, 390, 768, 1280px; không tràn ngang toàn trang. Kiểm tra modal danh mục, hỗ trợ, gửi thư thử, font tiếng Việt và đăng nhập mobile. Admin hỗ trợ vẫn bị chuyển về màn hỗ trợ khi mở trực tiếp trang người dùng. Lint, build và 31 kiểm tra frontend đạt.

[Số đo và kết quả](../../output/admin-web-qa/design-normalization-ui.json) · [Modal danh mục desktop](../../output/admin-web-qa/design-admin-category-desktop.png) · [Modal email điện thoại](../../output/admin-web-qa/design-admin-email-mobile.png).
