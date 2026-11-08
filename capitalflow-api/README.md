# CapitalFlow API

## Free/Premium và payOS

Gói Premium giá 30.000 VND cho 30 ngày, thanh toán từng lần. Gia hạn khi còn hạn
cộng tiếp 30 ngày từ ngày hết hạn hiện tại. Quyền gói gắn với user, dùng chung
cho web/mobile, không gắn với vai trò quản trị hoặc số dư ví mô phỏng.

- Free có 2 ví đang hoạt động, 3 ngân sách còn áp dụng và 5 lượt AI/tháng.
- Premium có 10 ví, 20 ngân sách và 100 lượt AI/tháng. Hạn mức ngân sách tính cả
  ngân sách sắp áp dụng, bỏ các ngân sách đã kết thúc. Dữ liệu cũ không bị xóa
  hoặc khóa xem khi hết Premium. Mọi báo cáo và xuất dữ liệu tiếp tục dùng chung.
- AI tính theo tháng dương lịch Việt Nam tại lúc bắt đầu tác vụ. Giữ chỗ trước
  khi gọi AI, chỉ ghi lượt đã dùng khi nhận diện thành công. Lỗi/thử lại kỹ thuật
  cùng tác vụ không trừ thêm; quét lại chủ động tạo tác vụ mới. Xóa hóa đơn không
  hoàn lại lượt đã dùng. Lượt cũ trước khi phát hành không bị tính hồi tố.
- Endpoint `/api/v1/billing/subscription`, `/checkout`, `/orders` chỉ trả dữ liệu
  tài khoản đang đăng nhập. Giá và thời hạn do server xác định.
- Webhook `/api/v1/billing/payos/webhook` xác minh HMAC và đối soát server-to-server
  với payOS trước khi cấp quyền. Return URL không tự cấp Premium. Đơn được khóa
  cùng user khi cấp quyền để chống cộng hạn lặp. Số tiền không khớp chuyển REVIEW.
- Worker `BILLING` đối soát đơn chờ tối đa một ngày sau thời hạn thanh toán,
  hỗ trợ trường hợp mất webhook hoặc người dùng đóng trình duyệt.
- Trang `/settings/subscription/checkout?payment_order=<UUID>` hiển thị QR và
  thông tin chuyển khoản trong CapitalFlow. Backend giữ chuỗi QR gốc từ payOS,
  kiểm tra CRC/số tiền VND rồi tạo PNG; chỉ trả cho chủ đơn còn hạn và chờ thanh
  toán. Thông tin QR đã lưu không bị xóa khi API đối soát chỉ trả trạng thái.
  Phản hồi billing không được cache. Đơn cũ thiếu QR dùng trang payOS dự phòng.

Áp dụng đến migration `cfdb_premium_checkout` theo quy trình sao lưu tại project
database trước khi bật API/worker mới. Điền `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`,
`PAYOS_CHECKSUM_KEY` trong `.env` backend rồi tải lại API và worker. Không đưa khóa
vào frontend hoặc Git. Từ thư mục API, chạy `python tools/configure_payos_webhook.py`
để xác minh và đăng ký webhook HTTPS của kênh đã cấu hình; không tạo đơn thu tiền.

Kiểm thử `python tools/verify_premium_billing.py` dùng SQLite trong bộ nhớ và
payOS mô phỏng, không chuyển tiền hoặc gọi AI thật. Bước kiểm chứng tiền thật
cần người dùng tự thanh toán qua giao diện nâng cấp tại Cài đặt & bảo mật.

API hiện chưa có thao tác hoàn tiền hoặc tự xử lý đơn REVIEW. Đơn cần đối chiếu
được kiểm tra trên payOS và xử lý qua Trung tâm hỗ trợ; không tự cấp quyền khi
số tiền sai. Khi phát hành mobile trên các kho ứng dụng, tích hợp billing của
kho theo chính sách tương ứng; backend gói vẫn dùng chung.

Backend FastAPI của CapitalFlow, gồm REST API, worker xử lý nền, ORM SQLAlchemy và bộ kiểm thử. Project này **không quản lý migration SQL**; baseline và lịch sử thay đổi SQL Server nằm trong `../capitalflow-database`.

## Chạy cục bộ

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
.\.venv\Scripts\python.exe -m app.dung_chung.tac_vu_nen.trinh_chay
```

Điểm vào ổn định của API luôn là `app.main:app`. Việc lắp ráp ứng dụng nằm trong `app/khoi_dong`; mã nghiệp vụ nằm theo phân hệ trong `app/chuc_nang`; hạ tầng dùng chung nằm trong `app/dung_chung`.

## Nguyên tắc cấu trúc

- `chuc_nang/nguoi_dung`: đăng nhập, ví, giao dịch, ngân sách, hóa đơn AI, báo cáo, danh mục và thông báo.
- `chuc_nang/quan_tri`: bảng điều khiển, phân tích, quản trị người dùng, danh mục hệ thống, giám sát hóa đơn, nhật ký và email.
- `dung_chung/email`: dịch vụ gửi thư dùng chung.
- `dung_chung/tac_vu_nen`: hàng đợi bền vững và worker.
- `khoi_dong`: lắp ráp FastAPI; không chứa nghiệp vụ.
- `dung_chung`: hạ tầng dùng chung; không sở hữu nghiệp vụ.

Xem [sơ đồ cấu trúc và trách nhiệm file](../PROJECT_STRUCTURE.md) trước khi thêm file mới.

## An toàn database

API chỉ ánh xạ và sử dụng schema hiện hành. Mọi `DROP`, `DELETE` hàng loạt hoặc đổi kiểu dữ liệu phải được người quản lý dự án duyệt trước và thực hiện qua project `capitalflow-database`.

## Các mức kiểm tra backend

Các lệnh sau chạy kiểm tra hiện có với SQLite trong bộ nhớ và biên dịch vụ được
mô phỏng; không dùng chúng để kết luận đã kiểm chứng SQL Server hay dịch vụ thật:

```powershell
.\.venv\Scripts\python.exe -B tools/verify_backend_guards.py
.\.venv\Scripts\python.exe -B tools/verify_budget_daily.py
.\.venv\Scripts\python.exe -B tools/verify_support_requests.py
.\.venv\Scripts\python.exe -B tools/verify_premium_billing.py
```

Các công cụ `verify_api_integration.py`, `verify_worker.py`,
`verify_fault_concurrency.py`, `verify_sql_performance.py` và
`serve_user_web_test_api.py` có phạm vi SQL/QA riêng. Không chạy hàng loạt chỉ
để kiểm tra import hoặc một thay đổi tài liệu.

### Kiểm tra Worker độc lập có database QA

```powershell
.\.venv\Scripts\python.exe -B tools/verify_worker.py --label final
```

Bộ thử chỉ chạy khi cấu hình là development trên SQL Server local. Nó tạo DB
`cf_worker_qa_<12hex>`, áp dụng migration, chạy các ca hàng đợi/retry/OCR/tệp/
ngân sách rồi tự xóa DB thử. SMTP và Gemini được thay bằng hàm mô phỏng; hàng
đợi và tệp của môi trường chính không được dùng.

Ca phục hồi dừng một tiến trình con QA thật, sau đó giả lập thời điểm hết hạn
giữ tác vụ để kiểm tra nhận lại. Ca timeout xác minh cấu hình 90 giây nhưng
rút thời gian chờ trong phép thử xuống 20ms. Kết quả tại `output/worker-qa/`
ở gốc workspace; các phép thử này không thay cho đo tải hoặc thời gian chạy lâu.

Tác vụ EMAIL dùng cùng mã tác vụ làm mã bản ghi chuyển phát. Worker lưu dấu
SENDING trước khi gọi SMTP. SENT/LOGGED_DEV được bỏ qua khi phục hồi; lỗi chắc
chắn chưa gửi giữ retry có giới hạn. Kết quả chưa rõ hoặc tiến trình dừng giữa
lúc gửi chuyển UNKNOWN, dừng tự gửi lại và hiện “Cần kiểm tra” ở nhật ký admin.
Đây là chính sách đã duyệt để tránh tự phát lại; trường hợp chưa tới hộp thư
có thể cần được yêu cầu gửi lại có chủ đích. Không coi SENT là bằng chứng đã đọc.
