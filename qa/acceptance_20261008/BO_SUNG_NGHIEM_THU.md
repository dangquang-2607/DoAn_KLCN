# Bổ sung nghiệm thu — 08/10/2026

Phạm vi yêu cầu: sửa UI-02; thử cạnh tranh/rollback/deadlock trên SQL Server riêng; bổ sung các luồng UI chưa chạy. Đây là kết quả trên working tree hiện tại, không phải chứng nhận một release bất biến hoặc nghiệm thu toàn bộ đồ án.

## 1. UI-02: đã sửa và kiểm thử lại

Nguồn sửa duy nhất của ứng dụng trong lượt này: `frontend/admin-web/src/chuc-nang/phan-tich-van-hanh/CSS/workspace-live.css`.

Ở container <=550px, bộ chọn kỳ bị co theo nội dung trong khi select đặt `width:0`. Sửa cho vùng chọn kỳ chiếm một hàng, select nhận chiều rộng khả dụng và nút điều hướng không co. Không thay nghiệp vụ hay animation.

- Tablet 768×1024, sidebar mở: select từ 36px lên **273px**; đọc được nhãn tháng.
- Mobile 390×844: **183px**; desktop 1280×800: **210px**.
- Đổi tháng 10 sang 09/2026 hoạt động; không có tràn ngang trang ở ba kích thước đã thử.
- Bằng chứng: `ui2-retest.json`, `screenshots/ui2-after-tablet-768.jpg`, `ui2-after-mobile-390.jpg`, `ui2-after-desktop-1280.jpg`.
- UI-01 đăng nhập admin mobile không thuộc yêu cầu sửa lần này, vẫn chưa đóng.

## 2. SQL Server thực: 4 ca đạt

DB riêng được tạo và giữ lại: **CapitalFlow_QA_20261008_b5fcca32**, trên SQL Server 2022 hiện có. Không ghi DB nghiệp vụ `personal_finance`. Schema sinh từ SQLAlchemy models hiện tại, không phải restore DB production hoặc xác nhận toàn bộ migration.

Gọi hàm route nghiệp vụ thật `transfer_tx` với session SQL độc lập chạy đồng thời; không phải tải HTTP qua nhiều máy/worker. Ledger gồm số dư mở đầu và các vế chuyển khoản.

1. 10 tác vụ cùng khóa: đúng 1 chuyển khoản, 2 vế, 1 bản ghi chống lặp; số dư **99.900 / 1.100**, khớp tổng ledger.
2. 10 tác vụ khác khóa: thêm đúng 10 chuyển khoản; tổng 22 vế/11 bản ghi; số dư **98.900 / 2.100**, khớp ledger.
3. Chèn lỗi trước khi lưu replay sau biến động tiền: rollback toàn bộ; số dư/ledger/replay giữ nguyên.
4. Tạo deadlock SQL thật lỗi 1205 bằng thứ tự khóa ngược: nạn nhân rollback; thử lại rõ ràng bằng cùng khóa thành công, không trùng; cuối cùng **98.800 / 2.200**, 24 vế/12 replay.

**Giới hạn:** ứng dụng chưa được chứng minh tự retry deadlock; ca này là retry tường minh do script. Không suy ra SLA tải lớn hoặc môi trường triển khai production. Bằng chứng: `sql_concurrency.py`, `sql-concurrency-result.json`.

## 3. UI nghiệp vụ đã chạy

### Phiên đăng nhập và kết nối

- Access token hết hạn, refresh còn hiệu lực: đã thấy 401 → refresh 200 → tải tiếp thành công trên user (09:33) và admin (13:57). Dùng access token QA 15 giây, không thay thời hạn token production.
- Refresh service trả 503: 14:04:32, GET dashboard 401 → POST refresh 503 → logout 204 → UI chuyển về login. Bằng chứng `ui-refresh-503-login.jpg`. An toàn theo hướng từ chối truy cập nhưng **UX chưa tốt**: gián đoạn tạm thời làm mất phiên; chưa sửa vì ngoài phạm vi UI-02.
- Dừng riêng QA API trong khi frontend vẫn chạy: UI hiện “Không thể tải dữ liệu / Kiểm tra kết nối và thử lại”. Khởi động API lại và bấm Làm mới: dữ liệu trở lại, tổng số dư 7.680.544₫. Ảnh `ui-api-offline.jpg`, `ui-api-recovered.jpg`. Đây là mất kết nối API, không phải giả lập toàn bộ thiết bị offline.
- Refresh token thực sự hết hạn: script hết hạn 4 token đang hoạt động của user QA trong SQLite. Trace lúc 14:09:59 ghi GET bảo vệ 401 → POST refresh 401 → logout 204. **Đạt từ chối phía API; ảnh trạng thái UI cuối còn thiếu** do phiên trình duyệt bị ngắt trước khi chụp. Không đánh dấu đầy đủ E2E UI cho ca này.
- Có hiện tượng một số khối tổng quan báo lỗi ở lần tải đầu, nhưng thao tác Thử lại/Làm mới tải được. Chưa xác định nguyên nhân từ ứng dụng hay môi trường trình duyệt QA; không dùng hiện tượng này để kết luận lỗi production, cũng không bỏ qua khi chốt nghiệm thu.

Trace: `ui-api-trace.jsonl` (UTC, cộng 7 giờ để đối chiếu giờ VN). Các attempt ban đầu 14:02 dùng origin khác và fault middleware chặn OPTIONS không được dùng làm bằng chứng chính cho POST refresh 503; đã hiệu chỉnh harness và chạy lại lúc 14:04.

### Vòng đời người dùng qua admin

Tài khoản tổng hợp `qa-lifecycle-1357@example.com`, id `201c01a1-ce55-4349-a561-3ee25700559b`:

- Tạo USER → khóa → mở khóa → xóa mềm (không giải phóng email) → lọc thùng rác → khôi phục: UI và phản hồi API thành công, cuối cùng tài khoản Hoạt động, giữ nguyên id/email.
- Ảnh: `ui-admin-banned.jpg`, `ui-admin-soft-deleted.jpg`, `ui-admin-restored.jpg`.
- Email ACCOUNT_CREATED/BANNED/UNBANNED/DELETED/RESTORED xử lý qua worker đến SMTP giả lập, không gửi ra ngoài.
- Chưa thử trên UI: nâng quyền ADMIN, đổi/cấp lại mật khẩu, xóa vĩnh viễn, người dùng này đăng nhập sau khôi phục. Không suy rộng kết quả thành toàn bộ vòng đời/quyền admin đã nghiệm thu.

### Hóa đơn upload → preview → confirm

Upload ảnh tổng hợp `synthetic-invoice.png` qua UI, xem bản gốc, Quét AI, worker xử lý, chọn ví và xác nhận hóa đơn `d980f3ea-74bb-46f6-b550-0b2b00da197f`.

Kết quả QA STORE 110.000₫ được xác nhận, sinh giao dịch; ví Tiết kiệm QA **1.966.544 → 1.856.544₫**. Ảnh `ui-invoice-confirmed.jpg`; giao dịch tương ứng hiện trên danh sách.

OCR provider trong lượt UI này **giả lập**; ca Gemini thật một mẫu của biên bản trước nằm riêng ở `live-ocr-result.json`. Không gọi UI này là OCR thật E2E hoặc benchmark chính xác.

### Ngân sách → worker → thông báo/email

Tạo ngân sách QA tổng hợp 100.000₫ trên UI, ghi chi tiêu mẫu 1.000₫ qua UI, tổng chi kỳ 319.456₫. Chạy worker: BUDGET DONE → EMAIL DONE; BUDGET_ALERT SENT tới **SMTP sink tại máy**, 0 email ngoài. Reload UI thấy “Ngân sách đã vượt hạn mức” và tên ngân sách; ảnh `ui-budget-notification.jpg`.

`ui-worker-sink.json` có một số job BUDGET cũ DEAD/PENDING ValueError: job được tạo trước khi harness giữ ổn định khóa mã hóa QA qua lần khởi động, không giải mã được sau đổi khóa. Đã sửa riêng harness dùng `.qa-worker.key` (ignore). Job mới sau sửa DONE. Không dùng lỗi harness cũ để kết luận worker sản phẩm hỏng.

**Email cảnh báo tới inbox thật: chưa kiểm**, vì chưa được phép gửi thêm. Người dùng đã xác nhận email SMTP thử trước đó đến **hộp thư đến** ngày 08/10/2026; đã cập nhật `live-email-result.json`. Xác nhận này không thay cho thử inbox loại BUDGET_ALERT.

## 4. Hồi quy và bằng chứng

- `results-followup.xml`: **92 passed**, 0 fail/error/skip, 1 cảnh báo Starlette TestClient deprecation; 7,57 giây. Không phải độ bao phủ code.
- Admin `npm run lint`: đạt; build vào `admin-build-followup/`: đạt, Vite cảnh báo output nằm ngoài project nên không tự dọn thư mục.
- Không chạy lại build user trong lượt này vì không sửa mã production user; kết quả build mốc trước giữ riêng.
- User QA copy khác nguồn tại `globals.css`: giới hạn Tailwind quét trong src để tránh quét artifact QA cạnh bên, và cấu hình `turbopack.root` riêng. Không sửa nguồn user production.
- `evidence-followup.json` lưu hash và khác biệt lúc thu thập, không thay thế commit/release. Không commit, không thay cấu hình triển khai.
- Không xóa DB SQL staging hoặc dữ liệu QA; giữ lại để đối chiếu. Không đẩy DB, key, token/cache lên Git.
- Đã tắt các server QA do lượt kiểm thử tạo ở 8018/3018/5188 và đặt lại fault injection về tắt; không tắt server ngoài phạm vi QA.

## 5. Kết luận nghiệm thu

**Đã đóng UI-02 và đạt 4 ca SQL trong phạm vi mô tả; đã bổ sung thực thi các luồng UI nêu trên. Chưa đủ căn cứ xác nhận toàn bộ đồ án hoàn thiện.**

Còn phải đóng UI-01; hoàn thiện bằng chứng UI refresh hết hạn và các nhánh admin chưa thử; quyết định cách xử lý gián đoạn refresh; thử email ngân sách inbox thật khi được phép; benchmark OCR có đáp án; kiểm thử Flutter; và chốt commit/release với suite/build/smoke trên cấu hình triển khai. Không dùng working tree đang thay đổi làm bản được chứng nhận.
