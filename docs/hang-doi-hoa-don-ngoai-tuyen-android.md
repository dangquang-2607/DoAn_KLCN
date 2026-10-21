# Hàng đợi hóa đơn ngoại tuyến — Flutter Android

Cập nhật 13/10/2026. Project hiện tại: `capitalflow-mobile/`. Phạm vi là lưu tệp, tải hóa đơn và gửi yêu cầu OCR trong Không gian cá nhân. Không tự xác nhận khoản chi. Không bổ sung iOS, camera Web, trường hợp 8 hoặc sổ chung 10–11.

## Luồng sử dụng

1. Đăng nhập khi có mạng ít nhất một lần. Khi mở lại mà mất mạng, phiên đã lưu cho phép truy cập ứng dụng để thêm hóa đơn.
2. Chụp/chọn ảnh, xem lại rồi chọn **Lưu vào hàng đợi**; tệp PDF/XML cũng được đưa vào hàng đợi. Chỉ báo đã lưu khi dữ liệu đã ghi thành công trên thiết bị.
3. Mở **Hàng đợi trên điện thoại** trong màn Hóa đơn AI để xem tiến độ, tạm dừng/tự gửi, thử lại hoặc xóa bản cục bộ.
4. Có mạng: ứng dụng tự tải tệp, dùng lại hóa đơn cũ nếu trùng, rồi yêu cầu OCR nếu trạng thái còn `UPLOADED`. Khi phản hồi OCR bị mất, đọc lại trạng thái trước khi yêu cầu tiếp.
5. Chọn **Mở hóa đơn trên máy chủ** để kiểm tra và xác nhận theo quy trình chống trùng hiện có. Hàng đợi không gọi confirm, restore hoặc API ghi giao dịch.

Ảnh chỉ xem trước nhưng chưa bấm lưu chưa được cam kết lưu bền vững. Nếu Android hủy Activity trong lúc chụp/chọn ảnh, ứng dụng dùng `retrieveLostData` để đề nghị xem lại khi người dùng trở về màn Hóa đơn; việc khôi phục này phụ thuộc dữ liệu camera/picker còn cung cấp. Một khi thông báo đã lưu vào hàng đợi xuất hiện, tệp không còn phụ thuộc ảnh tạm của camera.

## Lưu trữ và chống gửi lặp

- SQLite riêng trong vùng dữ liệu ứng dụng lưu bytes, tên tệp, nguồn, SHA-256, khóa yêu cầu và trạng thái trong cùng giao dịch. Không lưu token vào DB hàng đợi. Android manifest tắt backup ứng dụng.
- Tệp đang chờ có cùng nội dung trong cùng tài khoản/máy chủ dùng chung một mục dù đổi tên. Hai tài khoản khác nhau có phạm vi riêng.
- Khóa upload ngẫu nhiên được ghi cùng tệp và giữ nguyên khi mất phản hồi, đóng tiến trình hoặc đăng nhập lại. Backend tiếp tục là nơi quyết định hóa đơn có trùng và có được ghi sổ hay không.
- Hai bộ gửi (ứng dụng đang mở và WorkManager) lấy việc qua transaction/lease. Phản hồi từ phiên hoặc lease cũ không ghi đè trạng thái mới.
- Bytes được đọc từng khối 512 KiB để không vượt giới hạn một hàng dữ liệu của SQLite trên Android. Kiểm tra lại SHA-256 trước khi gửi.
- Tối đa 10 MiB/tệp; toàn thiết bị có tối đa 20 mục chưa hoàn tất và 100 MiB bytes chờ. Vượt giới hạn hoặc ghi thất bại báo lỗi, không báo đã lưu và không tự xóa ảnh đang chờ.
- Sau khi máy chủ nhận tệp thành công, giải phóng bytes cục bộ; giữ metadata để tiếp tục OCR hoặc mở hóa đơn. Nếu bản gốc đang ẩn, giữ ảnh chờ để người dùng khôi phục rõ ràng trước khi thử lại.
- Lịch sử hoàn tất được dọn khi kích hoạt hàng đợi: tối đa 7 ngày và 200 mục. Tệp chưa hoàn tất không bị tự dọn theo tuổi.

## Mạng, tiến trình và phiên đăng nhập

- Khi ứng dụng đang mở: kiểm tra mỗi 15 giây và khi trở lại foreground. Lỗi mạng/408/429/5xx thử lại với thời gian tăng dần, tối đa 15 phút; có nút thử lại.
- Android WorkManager đăng ký việc một lần có ràng buộc mạng và việc định kỳ 15 phút. Đây là lịch tối thiểu đề nghị; Android có thể trì hoãn vì pin, Doze hoặc giới hạn nền. Không hứa gửi đúng một thời điểm hay ngay khi có mạng. Xem [hợp đồng PeriodicWorkRequest của Android](https://developer.android.google.cn/reference/androidx/work/PeriodicWorkRequest).
- Đóng giao diện/tiến trình không xóa hàng đợi. Khi Android cho tác vụ nền chạy hoặc khi mở ứng dụng lại, công việc tiếp tục từ checkpoint đã ghi. Nếu người dùng **Buộc dừng**, cần mở ứng dụng lại để tiếp tục; xóa dữ liệu ứng dụng/gỡ cài đặt sẽ mất bản chưa gửi.
- Tác vụ nền dùng access token hiện có và không tự xoay refresh token, tránh xung đột với ứng dụng đang mở. Khi gặp 401, chuyển sang chờ phiên; foreground tiếp nhận và làm mới token. Nếu phiên bị thu hồi, cần đăng nhập lại.
- Đăng xuất dừng gửi và ẩn danh sách, giữ ảnh chờ cho đúng tài khoản đăng nhập lại. Tài khoản khác không nhìn thấy/gửi ảnh đó. Đổi máy chủ kết thúc phiên cũ trước khi đổi địa chỉ; hàng đợi vẫn gắn với máy chủ cũ.
- Tạm dừng chặn các lần gửi tiếp theo. Yêu cầu đã lên mạng có thể đã được máy chủ nhận. Xóa bản cục bộ chỉ xóa hàng đợi, không xóa hóa đơn/khoản chi phía máy chủ; giao diện giải thích điều này.
- Nếu WorkManager không đăng ký được, hiển thị thông báo và vẫn gửi khi mở ứng dụng. Nếu không mở/ghi được SQLite thì không bỏ qua bằng cách chỉ giữ ảnh trong RAM.

## Trạng thái và xử lý lỗi

- `waiting`: chờ tải lên hoặc yêu cầu OCR.
- `retry`: lỗi tạm thời, tự thử lại bằng cùng khóa.
- `auth`: cần foreground xử lý phiên đăng nhập.
- `attention`: cần người dùng xử lý, ví dụ bản gốc đã ẩn, định dạng bị từ chối hoặc bytes không còn nguyên vẹn.
- `done`: đã hoàn tất phần tải lên/yêu cầu quét; không đồng nghĩa đã ghi sổ hoặc OCR đã chạy xong.

Ảnh JPG/PNG/WEBP và hóa đơn PDF/XML theo hợp đồng hiện tại. HEIC vẫn bị từ chối. Chưa có khả năng sửa form và xác nhận khoản chi khi ngoại tuyến.

## Mã nguồn và kiểm tra trực tiếp

- `lib/services/invoice_queue_store.dart`: schema SQLite, hạn mức, hash, lease và checkpoint.
- `lib/services/invoice_queue_runner.dart`: gửi/retry và xử lý phản hồi; không có thao tác tiền.
- `lib/services/invoice_queue.dart`: trạng thái giao diện, phiên, lifecycle và foreground retry.
- `lib/services/invoice_queue_background.dart`: WorkManager và kiểm tra phiên đăng nhập.
- `lib/screens/invoices/invoice_queue_screen.dart`: danh sách cục bộ và các thao tác.

Chủ dự án tự kiểm tra trên thiết bị: lưu ảnh vào hàng đợi khi mất mạng, đóng/mở lại,
bật mạng và đối chiếu trạng thái gửi; kiểm tra đổi tài khoản không gửi lẫn ảnh và
việc tải lại cùng ảnh không ghi nhận thêm khoản chi. Bộ test tự động và dữ liệu QA
đã được gỡ ngày 19/10/2026. Không gỡ app/xóa dữ liệu nếu còn ảnh chưa gửi.
Không cần migration SQL Server cho hàng đợi; backend vẫn cần schema chống trùng.

## Lỗi phát hiện và đã sửa khi kiểm thử

- Android từ chối mở SQLite khi dùng `execute` với PRAGMA trả về kết quả: chuyển `busy_timeout` và `secure_delete` sang `rawQuery`; kiểm thử native đã đi qua khởi tạo DB và gửi nền.
- Đọc một BLOB lớn có thể vượt CursorWindow: đọc theo khối 512 KiB, kiểm chứng bytes 10 MiB trên Android.
- Nhiều ảnh cùng timestamp có thể gửi sai thứ tự: dùng rowid để giữ thứ tự thêm khi timestamp bằng nhau.
- Trạng thái chờ phiên do worker nền trước đây không được tiếp nhận tự động ở foreground: thêm nhánh tiếp nhận để client chính xử lý refresh.
- Thông báo không đăng ký được lịch nền bị lần đồng bộ tiếp theo xóa mất: tách thông báo lịch nền khỏi lỗi đồng bộ.
- Danh sách đã gửi có thể liên tục kích hoạt tải lại dữ liệu tài chính mỗi 15 giây: chỉ báo thay đổi khi trạng thái/liên kết hóa đơn thực sự đổi.

Plugin `workmanager_android` hiện build được nhưng Flutter phát cảnh báo tương thích Kotlin Gradle Plugin cho các phiên bản Flutter tương lai. Cần kiểm tra/nâng plugin khi nâng Flutter; đây không phải lỗi build của bản bàn giao.
