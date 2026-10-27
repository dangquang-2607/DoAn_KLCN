# Thùng rác hóa đơn — giữ 30 ngày

Áp dụng mã nguồn ngày 27/10/2026. Không cần migration: dùng deleted_at làm thời điểm đưa vào Thùng rác, không thay trạng thái OCR gốc trong DB.

## Người dùng thao tác

1. Chọn “Chuyển vào Thùng rác”, xác nhận. Hóa đơn rời danh sách hoạt động; ảnh và mặt hàng vẫn được giữ. Nếu đang OCR, kết quả đang chạy không được phép ghi đè bản trong Thùng rác.
2. Chọn bộ lọc “Thùng rác”. Web hiển thị nhãn Thùng rác và ngày/giờ hết hạn, quy đổi từ UTC theo múi giờ trình duyệt.
3. Trước hạn 30 ngày, bấm “Khôi phục hóa đơn”: đưa bản trở lại, giữ ảnh nếu ảnh còn tồn tại, không tự tạo thêm khoản chi. Hóa đơn đang OCR khi bị bỏ vào Thùng rác cần quét lại sau khi khôi phục.
4. Đúng thời điểm deleted_at + 30 × 24 giờ trở đi: không cho khôi phục hoặc tải ảnh gốc. Worker định kỳ xóa vĩnh viễn bản hóa đơn, dòng hàng, lịch sử thao tác, tác vụ OCR liên quan và yêu cầu xóa tệp vật lý.

Xóa lặp khi đã trong Thùng rác không kéo dài thời hạn. Khôi phục rồi đưa vào Thùng rác lần nữa bắt đầu thời hạn 30 ngày mới.

Trong Thùng rác, nút thao tác đổi thành **Xóa vĩnh viễn**. Người dùng có thể xóa một hóa đơn, chọn nhiều checkbox hoặc chọn tất cả trên trang để xóa hàng loạt (tối đa 100 bản/lần). Hộp xác nhận nêu rõ không thể khôi phục và giữ khoản chi đã ghi sổ. Chỉ khi xác nhận mới gọi API xóa; hủy không thay đổi dữ liệu. Không cần chờ đủ 30 ngày để chủ động xóa vĩnh viễn.

API `POST /api/v1/invoices/batch-purge` nhận `invoice_ids`, dùng cho cả một và nhiều hóa đơn. Chỉ truy cập bản của người dùng đăng nhập; khóa user và kiểm tra tất cả bản còn tồn tại phải nằm trong Thùng rác trước khi purge. Nếu có bản vừa được khôi phục, trả 409 và không xóa bản nào trong lô. ID lặp được gộp; bản đã xóa trả trong not_found, nên thử lại không xóa nhầm bản khác. Xóa tệp vật lý qua worker sau commit giống luồng tự dọn.

## Tác vụ nền

Worker ALL hoặc lane có FILE_DELETE quét mỗi 60 giây, tối đa 100 hóa đơn/lượt. Nếu worker dừng, dữ liệu vật lý có thể còn sau hạn; khi worker chạy lại, tiếp tục dọn. Thời hạn khôi phục vẫn được API kiểm tra độc lập. Không khẳng định xóa tệp đúng từng giây ở mốc hết hạn.

Lần dọn lấy khóa người dùng rồi đọc lại thời điểm xóa: hóa đơn vừa khôi phục sẽ không bị một kết quả quét cũ xóa nhầm. Xóa DB và enqueue xóa tệp cùng giao dịch; tác vụ FILE_DELETE kiểm tra không còn hóa đơn tham chiếu tệp trước khi unlink. Cần duy trì worker và theo dõi job DEAD để biết lỗi xóa tệp sau các lần thử lại.

Lệnh worker dùng chung: `python -m app.dung_chung.tac_vu_nen.trinh_chay`. Docker lane EMAIL,BUDGET,FILE_DELETE,USER_PURGE,USER_FILE_PURGE đã bao gồm lane dọn này. Worker chỉ OCR không dọn Thùng rác.

## Khoản chi và chống trùng

Khoản chi đã ghi sổ và số dư được giữ nguyên. Khi xóa vĩnh viễn hóa đơn, chỉ gỡ liên kết transaction.invoice_id; không xóa giao dịch hoặc hoàn tiền vào ví.

Trong thời gian còn bản ghi Thùng rác, SHA và dữ liệu vẫn tham gia phát hiện trùng, kể cả bản chưa ghi sổ. Tải cùng hóa đơn sẽ dẫn về bản cũ, không tự khôi phục. Sau khi xóa vĩnh viễn, dữ liệu chống trùng của hóa đơn cũng không còn: không thể dùng bản đã xóa để bảo đảm chặn một lần tải/ghi sổ lại. Người dùng cần đối chiếu khoản chi cũ nếu tải lại về sau.

## Tương thích dữ liệu cũ

- Bộ lọc API mới `visibility=trash`; `visibility=hidden` vẫn nhận để client cũ hoạt động.
- `deleted_at` vẫn giữ trong API, bổ sung `trash_expires_at` và `can_restore` ở danh sách/chi tiết.
- Các bản “Đã ẩn” cũ trở thành bản trong Thùng rác, tính hạn từ deleted_at đã có. Bản cũ quá 30 ngày thuộc diện dọn; không tự gia hạn thêm từ ngày nâng cấp.
- Ảnh mà cơ chế cũ đã xóa không thể tái tạo. Khôi phục metadata có thể vẫn yêu cầu tải lại đúng ảnh. Các bản đưa vào Thùng rác bằng mã mới giữ ảnh trong thời hạn.
- Xóa vĩnh viễn ở đây áp dụng dữ liệu hóa đơn và tệp trong ứng dụng; không tự thay chính sách sao lưu của SQL Server/hạ tầng.

## Kiểm chứng

- Kiểm thử SQL/HTTP thực với dữ liệu giả, rollback toàn bộ: chuyển Thùng rác giữ ảnh/mặt hàng, không enqueue xóa ảnh sớm, không đổi hạn khi xóa lặp, lọc mới/cũ, khôi phục; hết hạn trả 410; quét dọn chỉ xóa bản quá hạn, giữ transaction và số dư, enqueue đúng tệp.
- Kiểm thử đơn vị: trước/đúng mốc 30 ngày; một thao tác khôi phục thắng trước khi worker khóa thì không purge.
- Kiểm thử web dùng API giả lập: bộ lọc Thùng rác, ngày hết hạn, khôi phục và làm mới màn hình.
- Kiểm thử xóa thủ công: đơn lẻ, hàng loạt, chọn tất cả, hủy hộp thoại không gửi yêu cầu, giới hạn 100, quyền sở hữu, thử lại và từ chối lô chứa bản vừa khôi phục. Khoản chi/số dư được giữ nguyên.
- Không thực hiện xóa tệp cá nhân trong các bài kiểm thử; các fixture SQL được rollback.
