# CapitalFlow Database

Project này là nguồn quản lý cấu trúc SQL Server của CapitalFlow, tách biệt khỏi
mã nguồn FastAPI. Alembic là công cụ duy nhất được định hướng để quản lý phiên
bản schema sau khi giai đoạn chuyển đổi hoàn tất.

## Nguyên tắc an toàn bắt buộc

- Không tự động chạy migration khi API hoặc worker khởi động.
- Không thực thi `DROP`, `TRUNCATE`, `DELETE` hàng loạt, đổi kiểu dữ liệu có
  nguy cơ mất dữ liệu hoặc migration không thể rollback nếu chưa có xác nhận rõ
  ràng của chủ dự án.
- Trước thao tác phá hủy phải có: phạm vi ảnh hưởng, số bản ghi, dependency,
  bản sao lưu, câu lệnh dự kiến, phương án rollback và kết quả preflight.
- Rà soát migration, backup và đối soát dữ liệu trước/sau khi áp dụng vào
  `personal_finance`. Chỉ tạo database kiểm chứng khi chủ dự án yêu cầu.
- Không đưa dữ liệu người dùng, credential hoặc secret vào Git.

## Vai trò của các thành phần

- `alembic/versions/`: một revision cho mỗi đợt phát hành CSDL, không tạo một
  revision cho từng sửa lỗi nhỏ.
- `alembic/env.py`: kết nối Alembic với cấu hình và metadata ORM của API.
- `tools/export_live_baseline.py`: xuất baseline tự chứa từ schema SQL Server
  đang chạy; không đọc hoặc xuất dữ liệu nghiệp vụ.
- `CURRENT_SCHEMA.md`: báo cáo dễ đọc về schema, version và các sai khác cần xử
  lý trước khi Alembic trở thành nguồn duy nhất.

## Lệnh vận hành

QR thanh toán trong CapitalFlow dùng revision hiện tại `cfdb_premium_checkout`,
sau `cfdb_premium_billing`. `tools/apply_premium_checkout.py` mặc định chỉ đọc
preflight; `--apply` backup/VERIFYONLY, diễn tập rollback, nâng và đối soát dữ
liệu/chỉ mục hiện có. Database local đã nâng ngày 08/11/2026. Chỉ thêm một cột
nullable giữ QR payOS, không tạo đơn thanh toán; downgrade chặn khi cột có dữ liệu.

Free/Premium dùng revision `cfdb_premium_billing`, sau `cfdb_support_requests`.
`tools/apply_premium_billing.py` mặc định diễn tập nâng/hạ và rollback; `--apply`
xác minh backup rồi nâng và đối chiếu mọi dữ liệu hiện có. Database local đã
nâng ngày 08/11/2026, không chạy lại công cụ trên revision mới. Ba bảng mới không
thay đổi cấu trúc hoặc dữ liệu người dùng/tài chính cũ. Không hạ migration khi
đã có giao dịch hoặc lượt sử dụng; đường downgrade có kiểm tra chặn mất dữ liệu.

Yêu cầu hỗ trợ qua form dùng revision `cfdb_support_requests`, sau
`cfdb_reporting_cover`. `tools/apply_support_requests.py` diễn tập nâng schema
và rollback; `--apply` xác minh backup rồi nâng và đối chiếu dữ liệu hiện có.
Database local đã nâng ngày 08/11/2026, không chạy lại công cụ trên revision mới.
Khi triển khai mã mới, API cần bảng `support_requests` và worker cần tải lại để
nhận tác vụ `send_support_reply`. Email dùng cấu hình SMTP hiện hành, kết quả
xem tại Nhật ký email với loại Phản hồi hỗ trợ. Kiểm tra luồng bằng
`capitalflow-api/tools/verify_support_requests.py` dùng dữ liệu trong bộ nhớ và
SMTP mô phỏng, không gửi email thật.

Gỡ vòng đời xóa/khôi phục người dùng: migration `cfdb_retire_user_deletion`,
sau `cfdb_support_two_cases`. `tools/retire_user_deletion.py` mặc định chỉ đọc;
`--apply` tạo backup COPY_ONLY/CHECKSUM, chạy VERIFYONLY, diễn tập rollback rồi
mới áp dụng. Công cụ chặn nếu còn tài khoản/yêu cầu/tác vụ xóa chưa giải quyết,
đối chiếu mọi dòng được giữ lại trước khi commit. Phạm vi gồm hai bảng lịch sử,
sáu cột vòng đời cũ và bản ghi email/job/nhật ký của riêng chức năng đã bỏ.
Không xóa người dùng, ví, giao dịch hoặc hóa đơn. Khôi phục phần đã dọn dùng
bản backup đã xác minh; downgrade không dựng lại dữ liệu giả.

Công cụ một lần `apply_review_cleanup.py` và runner xóa người dùng trước
baseline đã được gỡ. Những migration Alembic đã áp dụng vẫn được giữ để nâng
cấp database cũ đúng thứ tự; chúng không đăng ký chức năng xóa người dùng vào API.
Xem [trạng thái schema và kết quả đối soát](CURRENT_SCHEMA.md).

Chỉ dùng email (sau `cfdb_phone_verify`): chạy `tools/apply_email_only.py --apply`
để backup, diễn tập và bỏ dữ liệu điện thoại mà giữ nguyên người dùng/tài chính.
Các migration điện thoại trước đây chỉ còn là lịch sử nâng cấp.
[Hợp đồng đăng ký/đăng nhập](../docs/auth-email.md).

Ví độc lập (sau revision `cfdb_bank_link_v2`): chạy
`tools/apply_independent_wallets.py` để diễn tập rollback; thêm `--apply` để
backup, kiểm chứng và áp dụng. Công cụ không bật cờ ứng dụng. Xem
[hợp đồng ví độc lập](../docs/independent-wallets.md) trước khi chuyển API/web.

Thanh toán hóa đơn và tính chi tiêu (sau `cfdb_independent_wallets`): chạy
`tools/apply_wallet_spending.py` để diễn tập; thêm `--apply` để backup, kiểm
chứng và áp dụng. Phiên bản API/web ví độc lập hiện tại yêu cầu hoàn tất cả
hai migration trước khi bật cờ. Xem [nghiệp vụ thanh toán](../docs/wallet-payment-spending.md).

Chạy từ thư mục `capitalflow-database`, sử dụng môi trường Python của API:

```powershell
..\capitalflow-api\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\capitalflow-api\.venv\Scripts\python.exe -m alembic current
..\capitalflow-api\.venv\Scripts\python.exe -m alembic history
..\capitalflow-api\.venv\Scripts\python.exe -m alembic upgrade head
```

Biến `DATABASE_URL` có thể được đặt tạm để trỏ tới CSDL kiểm chứng. Không lưu URL
có credential trong repository.

Trước khi tạo revision mới, bắt buộc kiểm tra metadata đang sạch:

```powershell
..\capitalflow-api\.venv\Scripts\python.exe -m alembic check
```

Mỗi đợt phát hành chỉ tạo một revision sau khi đã gom các thay đổi liên quan:

```powershell
..\capitalflow-api\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "release_YYYY_MM"
```

Revision sinh tự động chỉ là bản nháp. Phải đọc lại toàn bộ DDL, bổ sung
preflight/rollback và xin xác nhận nếu có thao tác phá hủy trước khi chạy
`upgrade head` trên database thật.

## Ba loại ví và kết nối ngân hàng mô phỏng

Revision hiện tại `cfdb_bank_link_v2` mở rộng cột số tài khoản đã che từ 8 lên
20 ký tự. Công cụ `tools/apply_bank_link_v2.py` mặc định chỉ preflight;
`--apply` chỉ nhận baseline `cfdb_bank_otp`, tạo/xác minh backup, diễn tập
rollback và đối soát dữ liệu trước/sau. Đã áp dụng vào 21/10/2026, không chạy
lại trên DB đã nâng. Luồng mới che mọi chữ số trừ 3 số cuối. Chi tiết demo và
kiểm thử tại `../docs/bank-link-demo.md`.

Revision `cfdb_bank_otp` bổ sung `password_reset_otps.purpose` và mặc định
thời gian tạo OTP cho luồng gửi email liên kết ngân hàng. Database chính đã
được nâng ngày 21/10/2026; xem bản sao lưu và kết quả kiểm tra trong
`CURRENT_SCHEMA.md`. Công cụ `tools/apply_bank_otp.py` chỉ kiểm tra khi chạy
không tham số; `--apply` yêu cầu database đang ở đúng `cfdb_invoice_dedup`,
tạo và xác minh backup, diễn tập rollback, sau đó nâng schema và đối soát
dữ liệu. Không chạy lại trên database đã nâng. OTP thử sử dụng email giả lập
và được rollback; công cụ không gửi thư thật.

Revision `cfdb_wallet_demo` thêm cột cho mục tiêu tiết kiệm, trạng thái liên kết
ngân hàng mô phỏng và mã tham chiếu giao dịch ngân hàng. Revision đã được kiểm
chứng trên database tạm trước khi áp dụng. Chức năng này không kết nối tới ngân
hàng thật; không nhập thông tin ngân hàng thật vào giao diện mô phỏng.

Đường hạ migration từ `cfdb_wallet_demo` sẽ từ chối nếu đã có dữ liệu trong các
trường ví mới hoặc giao dịch ngân hàng, để tránh mất dữ liệu. Khi đó cần giữ
schema hoặc khôi phục từ bản sao lưu đã kiểm chứng.

## Ngân sách định kỳ

Revision `cfdb_recurring_budgets` giữ nguyên các ngân sách có khoảng ngày cố
định, bổ sung cấu hình tuần/tháng/năm lặp tự động và lịch thay đổi hạn mức,
ngưỡng theo ngày hiệu lực. Các mốc tạm dừng/tiếp tục và ngày dừng lặp đã lưu
được giữ để đọc dữ liệu cũ. Tiến độ và lịch sử kỳ được tính
từ giao dịch; không cần job tạo thêm ngân sách mỗi tháng. Migration đã được kiểm
chứng trên SQL Server tạm; nâng database chính với backup và đối chiếu bằng
`tools/apply_recurring_budgets.py`. Database chính đã
nâng ngày 02/10/2026; vị trí backup và database thử ghi ở `CURRENT_SCHEMA.md`.

## Trung tâm thông báo chung

Revision `cfdb_notifications` tạo bảng `notifications` tách khỏi JSON của ví.
Migration chuyển thông báo tiết kiệm cũ sang bảng mới, bảo toàn thời điểm đọc;
JSON cũ vẫn còn trong tài khoản để kiểm tra lịch sử. Bảng mới hỗ trợ thông báo
biến động ví, mục tiêu tiết kiệm, ngưỡng ngân sách, khoản chi bất thường, trạng
thái kết nối ngân hàng demo và sự kiện bảo mật tài khoản. API chỉ trả dữ liệu
của người dùng đăng nhập; mỗi mục được đánh dấu đã đọc khi người dùng bấm vào.

`tools\apply_notifications.py` là quy trình nâng cấp một lần cho
`personal_finance` từ đúng revision `cfdb_wallet_demo`: kiểm tra dữ liệu cũ,
tạo backup `COPY_ONLY`, chạy `RESTORE VERIFYONLY`, nâng schema rồi đối chiếu số
ví/giao dịch và thông báo. Database chính đã được nâng vào 30/09/2026; không
chạy lại script trên trạng thái hiện tại. Đường hạ migration sẽ từ chối nếu
bảng thông báo có dữ liệu, để không làm mất lịch sử người dùng.

## Trạng thái chuyển đổi

Baseline mới đã dựng thành công database kiểm chứng, đối chiếu đủ 17 bảng và
vượt toàn bộ test API. SQL cùng wrapper cũ đã chuyển vào
`archive/pre_baseline_202609`; chúng chỉ còn giá trị kiểm toán và không phải lệnh
vận hành hiện hành. Sau khi được chủ dự án duyệt, bảng
`dbo.schema_migrations` và ba database kiểm chứng đã được xóa; chỉ
`dbo.alembic_version` còn quản lý version schema.
