# CapitalFlow Mobile

Ứng dụng Flutter (Android) của hệ thống CapitalFlow — quản lý tài chính cá nhân tích hợp nhận dạng
hóa đơn bằng OCR. App gọi **cùng REST API FastAPI** với hai cổng web nên dùng chung cơ sở dữ liệu
SQL Server, và đồng bộ thông báo qua `GET /api/v1/notifications` mỗi 5 giây khi
ứng dụng đang mở. Backend hiện chưa triển khai `/notifications/sync` hoặc WebSocket
`/notifications/ws`; mobile không tự kết nối lại các đường dẫn không tồn tại này.

> Hướng dẫn cài đặt chi tiết từng bước: [`../HUONG_DAN_MOBILE.md`](../HUONG_DAN_MOBILE.md)

## Chạy nhanh

```powershell
cd capitalflow-mobile
flutter create --platforms=android --org vn.edu.huit --project-name capitalflow_mobile .
dart run tool/setup_android.dart
flutter pub get
flutter analyze
flutter test
flutter run
```

Backend (`capitalflow-api`) và worker phải đang chạy; bảng `notifications` phải được tạo trước
(script `capitalflow-database/sql/20261006_notifications.sql`).

- Máy ảo Android: địa chỉ máy chủ mặc định `http://10.0.2.2:8000` (không cần đổi).
- Điện thoại thật: đổi trong màn **Máy chủ** (biểu tượng ở góc trên phải màn Đăng nhập).

## Điện thoại thật: USB, Wi-Fi và đo độ mượt

USB: giữ backend ở `127.0.0.1:8000`, bật USB debugging, chấp nhận máy tính trên
điện thoại, rồi chạy trong thư mục `capitalflow-mobile`:

```powershell
.\tool\connect_phone.ps1
flutter run --profile -d <device-id>
```

Trong app chọn **Máy chủ → Điện thoại thật qua USB**, lưu
`http://127.0.0.1:8000`, rồi bấm **Thử lại**. Script kiểm tra `/health`, chọn
thiết bị đã được cấp quyền và thiết lập `adb reverse tcp:8000 tcp:8000`.
Nếu có nhiều thiết bị, truyền `-DeviceId`; SDK khác vị trí mặc định thì truyền
`-AdbPath`. Chạy lại script sau khi kết nối lại USB/ADB hoặc khởi động lại điện thoại.
`127.0.0.1` trên điện thoại không tự trỏ về máy tính nếu thiếu chuyển tiếp này.

Wi-Fi: điện thoại và máy tính cùng mạng; chạy backend từ `capitalflow-api`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Chọn IPv4 của card mạng LAN/Wi-Fi trong `ipconfig`, nhập
`http://<IPv4-may-tinh>:8000` trong app. Cho phép cổng 8000 trên mạng riêng trong
Windows Firewall nếu đang bị chặn. Không dùng `0.0.0.0` làm địa chỉ trong app.
Backend chỉ bind `127.0.0.1` sẽ không nhận kết nối LAN.

`flutter run` mặc định là debug, không dùng để kết luận hiệu năng thực tế.
Đo bằng `--profile` trên điện thoại thật; dùng `--release` khi trải nghiệm thường ngày.
Tham khảo [Flutter performance profiling](https://docs.flutter.dev/perf/ui-performance).
Có thể đặt địa chỉ mặc định lúc build bằng `--dart-define=API_BASE_URL=http://...`;
địa chỉ đã lưu trong màn Máy chủ vẫn được ưu tiên.

## Theo dõi thời gian OCR

Phân biệt các bước: chuẩn bị/lưu ảnh trên điện thoại → upload → yêu cầu OCR →
worker chờ/chạy/thử lại → mobile nhận kết quả. Máy chủ dùng cùng đường OCR cho
web và mobile. `source=UPLOAD` không đủ để kết luận yêu cầu đến từ web.

Worker cần khởi động lại để nhận thay đổi log:

```powershell
# Chạy từ capitalflow-api, trong terminal riêng.
.\.venv\Scripts\python.exe -m app.dung_chung.tac_vu_nen.trinh_chay
```

Log `ocr_provider_http` ghi HTTP status, loại lỗi, dung lượng và thời gian gọi
nhà cung cấp; `ocr_worker_attempt` ghi số lần thử, trạng thái và thời gian mỗi lần.
Không ghi ảnh, nội dung hóa đơn, token hoặc khóa API. Timeout toàn lần OCR vẫn
là 90 giây; retry có thể làm thời gian người dùng chờ dài hơn nhiều.
`ocr_jobs.processing_ms` và `started_at` phản ánh **lần chạy cuối**, không phải
tổng thời gian các lần thử. Chênh lệch `started_at - created_at` có thể chứa cả
các lần chạy lỗi và khoảng chờ retry; không gọi riêng số đó là thời gian xếp hàng.

Nếu nhiều job EMAIL/BUDGET đang chiếm worker, có thể tách terminal worker OCR
với `--kinds OCR` và terminal tác vụ khác với
`--kinds EMAIL,FILE_DELETE,BUDGET,USER_PURGE,USER_FILE_PURGE`.
Không tăng số worker OCR ồ ạt khi nhà cung cấp trả 429.
Đối chiếu cùng tệp, cùng backend, cùng trạng thái worker để so sánh mobile/web;
không so ảnh camera mới với bản web đã tái sử dụng kết quả OCR do chống trùng.

Mobile chỉ dựng tab khi được mở lần đầu, trì hoãn tự tải lại tab ẩn và gộp các
lần tải ví/danh mục đồng thời. Băm ảnh lớn chạy ngoài luồng UI, giữ nguyên byte
ảnh và khóa chống trùng. Ảnh xem trước được giải mã ở kích thước giới hạn;
ảnh phóng to vẫn dùng bản đầy đủ. Hàng đợi foreground xử lý tối đa 40 bước
(20 tệp × upload/OCR) mỗi lượt thay vì 6 bước; không phải chờ nhịp 15 giây chỉ
vì vượt ba tệp. WorkManager và retry khi mất mạng vẫn theo chính sách hiện có.

## Thông báo trong khay Android

Vào **Thêm → Thông báo & nhắc nhở**, bật **Hiện thông báo trên điện thoại**,
rồi chọn **Gửi thông báo thử**. Kéo thanh trạng thái xuống để kiểm tra.
Thông báo thử không cần backend. Nếu Android chặn quyền, ứng dụng hiển thị lỗi
thay vì báo gửi thành công. OPPO/ColorOS có thể cần bật thêm banner/âm thanh
trong Cài đặt → Ứng dụng → CapitalFlow → Thông báo.

Thông báo chưa đọc do backend trả về được gửi ra khay khi app đang mở và kết nối
được laptop. Thông báo đã đọc không được phát lại. Hơn ba mục được gộp thành
một thông báo để tránh nhiều âm báo cùng lúc. Lưu riêng các ID đã gửi thành công
theo máy chủ/tài khoản; tải lại danh sách hoặc mở lại app không gửi trùng.
Khi bị chặn quyền/gửi thất bại, lần đồng bộ sau có thể gửi lại.

Thông báo đã hiện vẫn nằm trong khay khi về màn hình chính; chạm vào sẽ mở
trung tâm thông báo. Nhận thông báo mới tức thời lúc app đã đóng chưa được hỗ trợ.
Laptop phải bật backend cho thông báo nghiệp vụ; chưa cấu hình Firebase/FCM.
Icon `ic_stat_capitalflow` là drawable riêng và được giữ khi build release
bằng `android/app/src/main/res/raw/keep.xml`.

Kiểm tra trực tiếp bằng nút **Gửi thông báo thử** trong ứng dụng, sau đó
kéo thanh trạng thái Android xuống và chạm thông báo để kiểm tra điều hướng.

## Cấu trúc mã nguồn

| Đường dẫn | Mục đích |
|---|---|
| `lib/main.dart` | Khởi tạo dịch vụ, provider, điều hướng theo trạng thái đăng nhập. |
| `lib/core/api_client.dart` | HTTP client: JWT, tự làm mới token, `Idempotency-Key`, chuẩn hóa lỗi. |
| `lib/core/app_config.dart` | Địa chỉ backend (REST + WebSocket). |
| `lib/core/token_store.dart` | Lưu token trong vùng bảo mật của thiết bị. |
| `lib/core/formatters.dart`, `theme.dart`, `category_style.dart` | Định dạng tiền/ngày, giao diện, icon và màu danh mục (khớp bản web). |
| `lib/models/models.dart` | Kiểu dữ liệu ánh xạ hợp đồng API. |
| `lib/services/repositories.dart` | Lời gọi REST theo phân hệ: tài chính, hóa đơn, thông báo, quản trị. |
| `lib/services/auth_controller.dart` | Phiên đăng nhập, đăng ký, OTP, đổi mật khẩu. |
| `lib/services/app_data.dart` | Bộ nhớ ví/danh mục và "số phiên bản dữ liệu" để các màn hình tự tải lại. |
| `lib/services/notification_center.dart` | Đồng bộ REST định kỳ khi app ở foreground, khử trùng, hiện banner. |
| `lib/services/realtime_socket.dart` | Client WebSocket dự phòng; chưa kích hoạt vì backend chưa có endpoint. |
| `lib/services/local_notifier.dart` | Thông báo hệ thống Android và lịch nhắc hằng ngày. |
| `lib/services/app_settings.dart` | Tùy chọn thông báo của người dùng. |
| `lib/widgets/` | Thành phần giao diện dùng chung, bộ chọn, biểu đồ tự vẽ. |
| `lib/screens/auth/` | Đăng nhập, đăng ký, quên mật khẩu (OTP), đặt mật khẩu lần đầu. |
| `lib/screens/dashboard_screen.dart` | Tổng quan: tài sản, thu chi tháng, ví, ngân sách, giao dịch gần đây. |
| `lib/screens/transactions/` | Lịch sử giao dịch, ghi/sửa giao dịch thủ công, chuyển tiền. |
| `lib/screens/budgets/` | Theo dõi và quản lý ngân sách. |
| `lib/screens/invoices/` | Chụp/tải hóa đơn, theo dõi OCR, kiểm tra và xác nhận kết quả. |
| `lib/screens/analytics/` | Báo cáo, thống kê và biểu đồ. |
| `lib/screens/accounts/`, `categories/` | Ví & tài khoản; danh mục thu – chi. |
| `lib/screens/notifications/` | Trung tâm thông báo. |
| `lib/screens/settings/` | Bảo mật, cài đặt thông báo & nhắc nhở, cấu hình máy chủ. |
| `lib/screens/admin/` | Quản trị người dùng (chỉ với tài khoản admin). |
| `tool/setup_android.dart` | Cấu hình `AndroidManifest.xml` và Gradle sau `flutter create`. |

Thư mục `android/` không nằm trong mã nguồn: nó được `flutter create` sinh ra theo đúng phiên bản
Flutter đang cài, rồi `tool/setup_android.dart` bổ sung cấu hình cần thiết.

## Thư viện sử dụng

`http`, `provider`, `shared_preferences`, `flutter_secure_storage`, `image_picker`, `file_selector`,
`flutter_local_notifications`, `timezone`, `crypto`, `sqflite`, `workmanager`. Biểu đồ được tự vẽ bằng `CustomPainter`.


## Chống trùng hóa đơn (13/10/2026)

Web và Mobile dùng chung API chống trùng trong Không gian cá nhân. Camera có bước xem lại/chụp lại/hủy; gửi source CAMERA. Hóa đơn đã tồn tại mở lại bản cũ. Khi chỉ nghi trùng, người dùng cần đối chiếu trước khi xác nhận khoản chi khác; trùng chắc chắn không được bỏ qua.

Mất phản hồi confirm: giữ nguyên thông tin và bấm **Thử lại xác nhận**. Không đóng/mở liên tục để tạo yêu cầu mới. Mục **Đã ẩn** cho khôi phục metadata; tải lại cùng ảnh nếu ảnh đã bị xóa. Khoản chi đã ghi sổ không bị trừ thêm bởi thao tác khôi phục/tải lại.

Backend cần schema `cfdb_invoice_dedup`, API `visibility=hidden`, duplicate-check, duplicate-resolution và restore. Phạm vi hiện tại loại trừ gắn khoản chi nhập tay (8) và sổ chung (10–11). Xem [bàn giao và giới hạn nghiệm thu](../docs/trien-khai-chong-trung-dot-2-4.md). Android APK debug build được; camera trên điện thoại thật vẫn cần nghiệm thu.


## Hàng đợi hóa đơn ngoại tuyến (Android)

Chụp/chọn ảnh → xem lại → **Lưu vào hàng đợi**. Ảnh được ghi trong SQLite trên thiết bị trước khi báo thành công. Đóng ứng dụng rồi mở lại vẫn tiếp tục bằng cùng khóa upload; đổi tài khoản/máy chủ không gửi lẫn ảnh. Có màn quản lý, tạm dừng, thử lại và xóa bản cục bộ.

Ứng dụng tự gửi khi đang mở; Android WorkManager hỗ trợ gửi nền khi hệ điều hành cho phép và có mạng. Không tự xác nhận khoản chi. Giới hạn 20 tệp/100 MiB đang chờ trên thiết bị, 10 MiB/tệp. Buộc dừng cần mở lại ứng dụng; gỡ cài đặt/xóa dữ liệu sẽ mất ảnh chưa gửi.

Xem [thiết kế, giới hạn và cách kiểm tra trực tiếp](../docs/hang-doi-hoa-don-ngoai-tuyen-android.md).
