# Bàn giao triển khai chống trùng hóa đơn — đợt 2–4

Cập nhật 13/10/2026. Phạm vi theo xác nhận của người dùng: Không gian cá nhân, trường hợp 1–7, nguyên tắc độc lập giữa người dùng ở 9 và quy tắc nhận diện ở 12. **Tạm bỏ trường hợp 8, 10–11. Không xây camera trên Web.** Flutter dùng project `capitalflow-mobile` đã được người dùng xác nhận.

## Đợt 2 — Web

Đã triển khai:

- Upload phân biệt tạo mới, dùng lại bản nháp, đã ghi sổ và cần khôi phục. Tải nhiều tệp báo số lượng theo kết quả từng tệp; đổi tên không biến bản cũ thành hóa đơn mới.
- Hiển thị ứng viên nghi trùng, ngày, số tiền, lý do, đã ghi sổ/đã ẩn. Có thể mở hóa đơn gốc ngoài trang danh sách hiện tại hoặc xem khoản chi liên quan.
- EXACT không cho bỏ qua. SUSPECTED yêu cầu đối chiếu và xác nhận là khoản chi khác; sửa trường nhận diện làm mất quyết định cũ. Kiểm tra lại trên server trước confirm.
- Gửi expected_revision và review_token; giữ form khi xung đột, có thao tác tải phiên bản mới. Có thể đánh dấu cùng hóa đơn hoặc bỏ đánh dấu.
- Giữ Idempotency-Key khi mất mạng hoặc phản hồi chưa rõ; phân tách theo người dùng, dọn khóa khi đăng xuất. Không lưu nội dung hóa đơn vào sessionStorage.
- Bộ lọc Đã ẩn gọi `visibility=hidden`, khôi phục metadata có revision, giải thích việc tải lại ảnh. Xóa chứng từ không hoàn tác khoản chi.



## Đợt 3 — Flutter Android

Đã triển khai:

- Camera/thư viện có bước xem lại; camera có Chụp lại, Hủy và Lưu vào hàng đợi. Chỉ lưu để gửi sau khi người dùng chấp nhận ảnh. Camera gửi source=CAMERA; tệp/thư viện gửi UPLOAD.
- Bổ sung sau đợt 3: bytes và khóa upload được lưu cùng nhau trong SQLite trên thiết bị, khôi phục khi mở lại. Đổi tên không tạo thêm mục chờ cho cùng bytes. Chỉ yêu cầu OCR nếu hóa đơn còn UPLOADED, đọc lại trạng thái trước khi thử lại OCR.
- Hiểu đầy đủ kết quả upload, mở bản cũ thay vì báo tạo mới. Có bộ lọc Đã ẩn và khôi phục metadata.
- Màn kiểm tra bổ sung địa chỉ, ký hiệu, giờ hóa đơn. Preview dùng đúng các trường đang chỉnh sửa, kể cả trường bị xóa thành null.
- Hộp đối chiếu EXACT/SUSPECTED, mở bản gốc, đánh dấu cùng hóa đơn; SUSPECTED chỉ bỏ qua bằng lựa chọn rõ ràng. Có thể bỏ đánh dấu cùng hóa đơn.
- Confirm gửi revision, token và quyết định. Mất phản hồi giữ nguyên payload, khóa yêu cầu và khóa form; bấm thử lại không tự đối chiếu lại rồi chấp nhận một quyết định khác.
- Khóa confirm vẫn lưu trong SharedPreferences theo phạm vi máy chủ/chủ sở hữu/endpoint/nội dung; đăng xuất dọn các khóa này. Khóa upload của hàng đợi lưu cùng bytes trong SQLite riêng và được giữ qua đăng xuất để đúng chủ sở hữu tiếp tục sau này. Đổi tài khoản/máy chủ không hiển thị kết quả hoặc gửi ảnh của phiên cũ.
- Refresh token gặp lỗi 5xx/429 không tự coi phiên đã hết hạn. Retry sau refresh giữ nguyên khóa.


APK local: `capitalflow-mobile/build/app/outputs/flutter-apk/app-debug.apk`. Đây là bản debug để kiểm thử, chưa phải gói release đã ký để phát hành.

Giới hạn còn lại:

- Trong lượt nghiệm thu đợt 3 ban đầu không có Android kết nối; lượt bổ sung hàng đợi dùng máy ảo Android, xem báo cáo riêng. Chưa nghiệm thu quyền camera, ảnh xoay, chụp lại, hủy và hoạt động khi hệ điều hành hủy tiến trình trên điện thoại thật.
- Project hiện có target Android; chưa có target iOS nên không công bố đã hỗ trợ/kiểm chứng iOS.
- Hàng đợi ngoại tuyến đã được bổ sung theo yêu cầu tiếp theo: SQLite bền vững, retry, WorkManager và quản lý bản chờ. Xem [bàn giao hàng đợi Android](hang-doi-hoa-don-ngoai-tuyen-android.md). Sửa form/xác nhận khoản chi vẫn cần mạng.
- HEIC chưa được backend chấp nhận; client từ chối định dạng không hỗ trợ. Không tự tạo bộ chuyển đổi HEIC trong đợt này.

## Theo dõi vận hành

Route hóa đơn ghi `invoice_metric` vào logger `capitalflow.invoice_metrics`: operation,
method, status, handler_ms và outcome/duplicate_level/error_code khi có. Không ghi
request body, số tiền, tên file, ID hay token vào dòng metric.
Các bộ kiểm thử và công cụ đánh giá riêng đã được gỡ ngày 19/10/2026.
Chủ dự án trực tiếp kiểm tra luồng trên ứng dụng và đối chiếu kết quả.

## Lỗi đã xử lý trong đợt này

- Khôi phục hóa đơn đã ghi sổ nhưng không tải lại được ảnh gốc: backend trước đó chỉ gắn file khi chưa có giao dịch. Đã cho phép gắn lại file thiếu sau khi khôi phục rõ ràng, giữ nguyên giao dịch/trạng thái/số dư. Bài kiểm thử API xác nhận chỉ có một giao dịch và số dư không bị trừ thêm.
- Flutter trước đây chưa đọc `detail` dạng object nên mất thông báo/mã lỗi chống trùng; đã bổ sung.
- Flutter trước đây phát sinh khóa mới giữa các lần người dùng bấm lại và coi refresh 5xx là hết phiên; đã sửa với kiểm thử mất phản hồi, refresh và chuyển user.


## Chạy ứng dụng

Xem [hướng dẫn API, worker và Web](../README.md) và
[hướng dẫn chạy trên điện thoại](../capitalflow-mobile/README.md).

## Thứ tự đưa vào chạy thử

1. Giữ schema `cfdb_invoice_dedup` đã áp dụng. Đợt này không có migration mới hoặc backfill mới.
2. Khởi động backend/worker cùng mã hiện tại; thay Web build cùng hợp đồng. Không chạy backend confirm cũ song song với bản mới. Bảo đảm logger INFO được thu thập nếu cần số liệu vận hành.
3. Cài APK debug trên thiết bị thử, trỏ tới backend thử nghiệm. Dùng dữ liệu/ ví thử để nghiệm thu camera và đồng thời Web–Mobile; kiểm tra số giao dịch và số dư sau mỗi thao tác.
4. Đối chiếu danh sách hóa đơn, số giao dịch và số dư trên ứng dụng sau từng thao tác. Chưa triển khai trường hợp 8, 10–11.

Nếu cần rollback ứng dụng, dừng thao tác confirm trong khoảng chuyển đổi; giữ schema/lịch sử/giao dịch, không downgrade xóa dữ liệu hoặc tự hoàn tiền.
