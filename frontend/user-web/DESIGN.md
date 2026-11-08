# Chuẩn giao diện user-web

Phạm vi: giao diện người dùng CapitalFlow hiện có. Giữ phong cách, màu sắc, bố cục và hành vi đã hoàn thiện. Chuẩn hóa các thành phần cùng chức năng; không áp một kích thước cho cả nút thao tác, dòng chọn bản ghi và thẻ thông tin.

## Font chữ

- Dùng Inter đã tải qua `next/font`, biến `--font-inter`; mọi thành phần dùng `--cf-font` hoặc kế thừa từ thành phần cha.
- Nội dung và điều khiển: 14px. Nhãn form: 14px, độ đậm 600, dòng 20px. Chú thích: 13px, dòng 20px.
- Tiêu đề trang tiếp tục dùng `PageHead` và kiểu tiêu đề chung hiện có; tiêu đề modal dùng `.cf-dialog-head h2`. Các số tiền và biểu đồ giữ cấp độ nhấn mạnh riêng; mã kỹ thuật có thể dùng monospace.
- Không khai báo thêm font riêng trong từng màn hoặc dùng `!important` để ép toàn bộ ứng dụng.

## Button và ô nhập

- Button tiêu chuẩn: cao tối thiểu 40px, chữ 14px/20px, độ đậm 600, padding dọc 9px/ngang 16px, bo góc 6px, khoảng cách icon và chữ 8px. Nhãn dài được xuống dòng và nút được tăng chiều cao.
- Textbox, select, ô ngày và ô tiền: tối thiểu 40px, chữ 14px/20px, padding dọc 9px/ngang 12px, bo góc 6px. Chừa thêm chỗ cho lịch, kính lúp, nút hiện mật khẩu hoặc đơn vị tiền.
- Textarea: tối thiểu 80px, được tăng chiều cao; không ép về chiều cao của textbox một dòng.
- Nút nhỏ dùng `.cf-btn-sm`: tối thiểu 32px, chữ 13px/20px, padding dọc 5px/ngang 12px. Dùng cho thao tác phụ trong bảng, không dùng cho hành động chính ở đầu trang hoặc cuối form.
- Nút chỉ có icon: mặc định 40×40px; trong bảng và danh sách dày dùng 32×32px. Giữ nhãn truy cập và focus hiển thị rõ.
- Bộ lọc theo kỳ, tab, nút chọn bản ghi và form đăng nhập/đăng ký có vai trò riêng; giữ cấu trúc hiện tại và đồng nhất trong cùng nhóm. Ô nhập đăng nhập trên điện thoại giữ chữ 16px.

## Khoảng cách

- Nhãn cách ô nhập 6px; các trường/cột form cách nhau 16px; nhóm button cách nhau 8px.
- Form trong modal: padding 20px 24px; thanh hành động: 12px 24px. Khi rộng tối đa 540px, form/header dùng 16px 20px và thanh hành động dùng 12px 20px.
- Giữ khoảng cuộn và chiều cao giới hạn của modal; footer phải thao tác được khi nội dung dài. Vùng trang, bảng, thẻ số liệu và hóa đơn dùng khoảng cách theo vai trò hiện có.

## Nơi sửa chuẩn

Token và primitive chung nằm trong `src/dung-chung/CSS/swiss.css`. CSS module giữ bố cục riêng, trạng thái và ngoại lệ có ý nghĩa; không chép lại chiều cao, font, padding, bo góc của `.cf-btn`/`.cf-input` vào từng màn.

Những biến dùng chung gồm `--cf-control-height`, `--cf-control-font-size`, `--cf-control-line-height`, `--cf-control-padding-y`, `--cf-button-padding-x`, `--cf-input-padding-x`, `--cf-control-radius`, `--cf-label-gap`, `--cf-field-gap`, `--cf-dialog-padding` và `--cf-dialog-footer-padding`.

## Xác minh ngày 07/11/2026

Đã đối chiếu 9 màn ở chiều rộng 320, 390, 768 và 1280px bằng trình duyệt desktop; không tràn ngang toàn trang. Đã đo form giao dịch, ví, ngân sách, quét QR, ô giờ OCR và nút thanh bên. TypeScript, lint, build và 69 kiểm tra hiện có đạt. Dữ liệu thử dùng SQL Server riêng và được dọn sau kiểm tra; không thay đổi luồng nghiệp vụ hoặc dữ liệu chính.

[Số đo giao diện](../../output/user-web-qa/design-normalization-ui.json) · [Form giao dịch](../../output/user-web-qa/design-transaction-desktop.png) · [Ngân sách trên điện thoại](../../output/user-web-qa/design-budget-mobile.png).
