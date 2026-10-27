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

Đợt dọn có giới hạn ngày 27/10/2026 đã nâng database chính lên
`cfdb_legacy_cleanup`. Chạy `tools/apply_review_cleanup.py` để kiểm tra chỉ đọc;
thêm `--apply` mới tạo/xác minh backup, diễn tập rollback và áp dụng. Công cụ
chỉ bỏ bảng liên kết theo ví cũ khi rỗng, dọn token thuộc family hết hạn toàn bộ
không còn token con được giữ lại tham chiếu, và OTP hết hạn đã quá cửa sổ giới
hạn yêu cầu 60 giây. Không tự chạy khi API/worker khởi động và không tự lập lịch.

Cờ `--resume-failed-purge` chỉ dành cho yêu cầu ImportError đã được rà soát,
yêu cầu đúng một user PURGE_PENDING không có ví/dữ liệu tài chính/tệp. Yêu cầu
này đã hoàn tất; không dùng lại cờ trên trạng thái hiện tại. Công cụ sử dụng dịch
vụ purge trong transaction, không phát thư hoặc chạy tác vụ ngoài phạm vi.

Giữ nguyên accounts, thông báo/ngân sách lịch sử, log, khóa chống gửi lặp,
3 view cũ và bộ sơ đồ SSMS. Downgrade `cfdb_legacy_cleanup` chỉ khôi phục bảng
cũ rỗng; khôi phục dữ liệu đã xóa phải dựa vào backup đã VERIFYONLY.
Xem [kết quả triển khai và backup](CURRENT_SCHEMA.md).

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
ngưỡng, tạm dừng/tiếp tục theo ngày hiệu lực. Tiến độ và lịch sử kỳ được tính
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
