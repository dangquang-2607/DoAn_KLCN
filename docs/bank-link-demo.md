# Ngân hàng demo hiện tại

Từ 26/10/2026: liên kết cấp người dùng, mỗi người có số tài khoản riêng.
Số tài khoản chung và quy trình từng ví bên dưới chỉ còn là tài liệu lịch sử.
Xem [hợp đồng hiện tại](user-bank-links.md).

---

# Demo hiện tại: ngân hàng liên kết với ví độc lập (26/10/2026)

Chỉ dùng bốn ngân hàng: Vietcombank (VCB) `1023456789`, ACB `123456789`,
MB `123456789012`, Techcombank (TCB) `19012345678901`. Đây là số mẫu giả định.
Danh sách nằm trong `vi_tai_khoan/demo_catalog.py`; API là `GET /api/v1/wallets/providers`.

Số tiền giả ban đầu phía ngân hàng cho mỗi người dùng: VCB 25.000.000đ,
ACB 10.000.000đ, MB 20.000.000đ, TCB 30.000.000đ. Sau khi phát sinh nạp/rút,
số còn lại thay đổi và không reset khi liên kết lại. Đây không phải số dư ví.

Form liên kết có nút **Dùng số tài khoản mẫu**. Số được sao chép có khoảng trắng,
khoảng trắng không ngắt dòng hoặc ký tự vô hình được chuẩn hóa ở cả web và API;
chữ cái, dấu phân cách khác và số không khớp tài khoản mẫu vẫn bị từ chối.

Tạo ví số dư 0 → Xem chi tiết → Ngân hàng → Liên kết ngân hàng → chọn ngân hàng,
nhập số mẫu và xác nhận OTP email. Sau đó nạp từ ngân hàng hoặc rút về ngân hàng.
Liên kết không làm thay đổi số dư ví; chỉ lệnh nạp/rút thành công mới đổi số dư.
Không đồng bộ số dư hoặc lịch sử ngân hàng, không sinh thu/chi từ dữ liệu mẫu.

`wallet_api.py` giữ số tiền giả phía ngân hàng để kiểm tra đủ tiền nạp; dữ liệu
này được quản lý riêng cho từng người dùng, không reset khi ngắt/liên kết lại
và không xuất thành báo cáo thu chi. Không có file lịch sử ngân hàng trong luồng này.

**Phần bên dưới là tài liệu lịch sử của mô hình trước đây.** Các file nguồn
được chuyển vào `vi_tai_khoan/legacy_bank_sync/`, không được nạp khi bật ví độc lập.
Mọi đường dẫn `demo_source.py`, `demo_bank_data.json`, `bank.py` và `demo_catalog.py`
trong phần lịch sử bên dưới được hiểu là bên trong thư mục lưu trữ đó.

---

# Liên kết ngân hàng mô phỏng — nguồn JSON từ 22/10/2026

Ứng dụng quản lý thu chi, không giữ tiền và không thực hiện thanh toán.
OTP qua email xác nhận thao tác liên kết trong ứng dụng; không phải OTP của
ngân hàng thật. Chỉ các tài khoản mẫu dưới đây được chấp nhận. Hai mẫu 4 số
cũ đã bỏ khỏi API/giao diện tạo kết nối. Không xóa các ví/giao dịch có sẵn.

## Tài khoản và dữ liệu nguồn

- Vietcombank `1023456789`: đầu kỳ 10.000.000đ; lương +15.000.000đ,
  siêu thị −350.000đ, tiền điện −1.200.000đ. Hiện tại **23.450.000đ**.
- ACB `123456789`: đầu kỳ 5.000.000đ; chuyển khoản đến +2.000.000đ,
  ăn uống −180.000đ, Internet −500.000đ. Hiện tại **6.320.000đ**.
- MB Bank `123456789012`: đầu kỳ 8.000.000đ; lương +12.000.000đ,
  mua sắm −800.000đ, xăng −250.000đ. Hiện tại **18.950.000đ**.
- Techcombank `19012345678901`: đầu kỳ 20.000.000đ; thưởng +5.000.000đ,
  thuê nhà −3.000.000đ, siêu thị −450.000đ, sửa điện thoại −1.400.000đ. Hiện tại **20.150.000đ**.
- MoMo `0987654321`: đầu kỳ 1.000.000đ; nạp tiền +500.000đ,
  đồ ăn −65.000đ, điện thoại −120.000đ, mua quà tặng −1.000.000đ. Hiện tại **315.000đ**.

Các khoản nạp/chuyển đến ở đây là giao dịch mẫu đơn lẻ. Chưa tự đối ghép
chuyển tiền giữa hai tài khoản liên kết để loại khỏi báo cáo thu/chi tổng hợp.
Ngày và mã giao dịch được ghi rõ trong JSON, không tự đổi theo ngày liên kết.
Techcombank và MoMo có 4 giao dịch; các tài khoản còn lại có 3 giao dịch khởi tạo.
Khoản MoMo `sample-3` được sửa dấu thành chi −1.000.000đ ngày 25/10/2026,
giữ nguyên mã và ngày giao dịch. Ví đã liên kết cập nhật khoản cũ ở lần đồng bộ
thành công tiếp theo, không tạo thêm khoản chi. Sửa file nguồn không tự ghi vào DB.

## File chỉnh dữ liệu mẫu

- `capitalflow-api/app/chuc_nang/nguoi_dung/tai_chinh/vi_tai_khoan/demo_bank_data.json`:
  số dư đầu kỳ và toàn bộ lịch sử nguồn theo ngân hàng.
- `demo_catalog.py`: chỉ giữ mã ngân hàng, số tài khoản và định danh tài khoản mẫu.
- `demo_source.py`: đọc lại JSON từ đĩa mỗi lần đồng bộ, kiểm tra dữ liệu.
- `bank.py`: đối chiếu với lịch sử đã nhập, cập nhật ví và ghi nhận lỗi nguồn.

Để thêm giao dịch Techcombank, thêm đối tượng sau vào `accounts.TCB.events`.
Mã `tcb-005` chỉ dùng nếu chưa có trong danh sách:

```json
{
  "id": "tcb-005",
  "date": "2026-10-22",
  "amount": "-100000",
  "description": "Thanh toán ăn uống",
  "status": "BOOKED"
}
```

Lưu file rồi bấm Đồng bộ trên ví; không cần khởi động lại API cho những lần
sửa JSON. Nếu không có khoản phát sinh khác, TCB từ 20.150.000đ xuống 20.050.000đ.
Bấm lần nữa không nhập trùng. Muốn sửa giao dịch đã có, giữ nguyên `id` rồi sửa
số tiền/mô tả/ngày; danh mục và ghi chú do người dùng gán vẫn được giữ.

Quy tắc file:

- Giữ `schema_version: 1` và đủ năm mục `VCB`, `ACB`, `MB`, `TCB`, `MOMO`.
- Tiền là chuỗi số thập phân, không dùng dấu phân cách nghìn; dương là thu,
  âm là chi. Ngày dùng `YYYY-MM-DD`; mã duy nhất trong mỗi ngân hàng.
- `opening_balance` là số dư trước toàn bộ lịch sử trong file. Thêm giao dịch
  mới không cần thay số dư đầu kỳ; số dư nguồn được tính từ toàn bộ BOOKED.
- `PENDING` chưa tính vào số dư ghi sổ/báo cáo; đổi sang `BOOKED` rồi đồng bộ
  để ghi nhận. Không chuyển BOOKED ngược về PENDING; dùng giao dịch điều chỉnh
  mã mới để mô phỏng hoàn tiền.
- Không xóa hoặc đổi mã giao dịch đã đồng bộ. API từ chối nếu nguồn thiếu mã cũ
  để tránh mất lịch sử. JSON không hỗ trợ comment hoặc dấu phẩy thừa.
- File lỗi, thiếu, trùng mã, sai ngày/số tiền: lần đầu hiện chưa có dữ liệu;
  lần sau giữ nguyên số dư/giao dịch và thời điểm thành công cuối. Sửa file rồi
  đồng bộ lại. Không ghi một phần dữ liệu khi nguồn không hợp lệ.
- Giữ các mã `sample-0`, `sample-1`, `sample-2`, `sample-3` đang có. Định danh
  tài khoản cũ dạng `tcb-demo` vẫn được nhận diện, không đổi bank_reference.
- Những giao dịch đã tạo bằng nút demo cũ (`demo-*`) được giữ riêng trong ví
  khi chuyển sang JSON. Không tự chép dữ liệu ví vào file mẫu dùng chung.
  Từ nay thêm giao dịch qua JSON; các nút phát sinh giao dịch cũ đã bỏ.

## Kịch bản demo

1. Mở Ví & tài khoản → Thêm tài khoản → Ví liên kết → MoMo.
2. Nhập `0987654321`, đặt tên ví, bấm Liên kết; email tài khoản người dùng
   nhận OTP. Đây cũng là xác nhận đồng ý đọc dữ liệu mô phỏng.
3. Nhập OTP. Hệ thống lưu liên kết đã xác nhận rồi thử lấy số dư/lịch sử
   trong savepoint riêng. Nếu nguồn lỗi, liên kết vẫn được lưu; nhập liệu dở
   dang được rollback. Chưa lấy được lần nào sẽ hiện **Chưa có dữ liệu số dư**
   trên thẻ ví, chi tiết và Tổng quan, không hiện 0đ. Thành công: số dư 1.315.000đ, số tài khoản `*******321`, trạng thái đã liên kết.
4. Xem chi tiết → Quản lý liên kết và đồng bộ. Kiểm tra ngày bắt đầu lịch sử,
   lần cập nhật cuối và danh sách giao dịch tại trang Giao dịch.
5. Bấm Đồng bộ lần nữa: số dư không đổi, không thêm giao dịch trùng.
6. Thêm khoản chi `-50000`, mã mới, trạng thái BOOKED vào `accounts.MOMO.events`
   trong JSON. Ví vẫn 1.315.000đ đến khi bấm Đồng bộ; sau đó còn 1.265.000đ.
7. Thêm khoản PENDING để minh họa đang chờ, đồng bộ rồi đổi thành BOOKED và
   đồng bộ tiếp. Khoản đang chờ chỉ ảnh hưởng khả dụng tại nguồn, chưa vào thu/chi.
8. Giả lập nguồn gián đoạn: đồng bộ báo lỗi và giữ số dư/lịch sử/lần cập nhật cũ.
9. Ngắt liên kết hoặc làm quyền hết hạn: phải gửi OTP email để liên kết lại
   cùng tài khoản; lịch sử và biến động nguồn được giữ, không nhân đôi.

## Quy tắc đồng bộ và dữ liệu

- Số dư hiện tại lấy từ nguồn, không suy ra chỉ từ lịch sử vừa tải.
- `balance_available=false` nghĩa là chưa lấy được số dư, kể cả khi cột sổ cái
  nội bộ đang khởi tạo 0. Frontend không trình bày giá trị nội bộ đó là số dư.
  Số dư 0 được nguồn xác nhận có `balance_available=true` và vẫn hiển thị 0đ.
- `sync_error`/`bank_sync_error` lưu lỗi nguồn; `last_sync` chỉ thay đổi khi
  đồng bộ thành công. `last_sync_attempt` ghi lần thử riêng. Lỗi đồng bộ nguồn
  trả kết quả trạng thái với `sync_error`; HTTP 200 không tự có nghĩa đồng bộ
  thành công. Frontend kiểm tra lỗi này trước khi báo thành công.
- Khi nguồn lỗi lần sau, giữ nguyên số dư/giao dịch và thời điểm thành công
  trước đó. Thử lại thành công mới cập nhật dữ liệu và xóa lỗi. Tổng quan báo
  tổng tài sản chưa đầy đủ nếu có ví chưa có dữ liệu số dư.
- Lần đầu lấy lịch sử 90 ngày tính cả ngày hiện tại, từng trang 100 giao dịch.
  Bản mô phỏng duyệt lại các trang để phát hiện mới/thay đổi; chưa có cursor
  hoặc webhook của nhà cung cấp thật. Phạm vi ban đầu cố định để giữ lịch sử
  đã theo dõi; các lần sau bao gồm dữ liệu mới kể từ mốc đó.
- Mã nguồn giao dịch ổn định và unique index chống nhập trùng. Cập nhật số tiền,
  ngày hoặc mô tả ở nguồn sẽ cập nhật dòng đã nhập; danh mục/ghi chú của người
  dùng được giữ. Demo hỗ trợ BOOKED/PENDING, chưa mô phỏng mọi trạng thái đảo/hủy.
- Khi số tiền hoặc ngày của giao dịch nguồn thay đổi và kết quả là khoản chi,
  đồng bộ tạo tác vụ kiểm tra ngân sách mới trong cùng transaction với cập nhật
  giao dịch/số dư. Chỉ đổi diễn giải hoặc đồng bộ dữ liệu không đổi không tạo
  tác vụ này. Thay đổi A → B → A vẫn được kiểm tra lại. Cảnh báo/email chống
  trùng theo ngân sách, kỳ và ngưỡng; thông báo cũ là lịch sử tại lúc phát sinh,
  không bị xóa khi chi tiêu giảm. Tiến độ hiện tại được tính lại từ giao dịch.
- Sổ cái tạo bản ghi SYSTEM/ADJUSTMENT để khớp số dư nguồn khi lịch sử không đầy
  đủ. Bản ghi này không tính vào báo cáo thu/chi. Không cộng lịch sử hai lần.
- Ví liên kết mới chỉ đọc về tiền: không thêm thu/chi thủ công, không chuyển
  tiền, không sửa số tiền hoặc xóa giao dịch nguồn. Vẫn sửa danh mục/ghi chú.
- Chỉ lưu số che trong `accounts.account_number_masked` (VARCHAR(20));
  `bank_state.external_account` là mã mẫu như `momo-demo`, không phải số thật.
- OTP có thời hạn 5 phút, chờ tối thiểu 30 giây giữa các lần gửi, tối đa 5 lần
  thử sai. Mã lưu dạng hash; challenge gắn với user, mẫu và ví cần liên kết.
  Gửi lại vô hiệu hóa mã cũ. Lỗi gửi email vô hiệu hóa challenge vừa tạo.
- Mỗi người dùng chỉ có một ví cho mỗi tài khoản mẫu, kể cả khi đã ngắt liên kết.
  JSON là nguồn mẫu dùng chung; mỗi người có lịch sử đồng bộ, quyền truy cập và trạng thái gián đoạn riêng.
- Ví nguồn cũ được đánh dấu cần liên kết lại; không tự gán nó vào một số mẫu.
  Lịch sử cũ giữ nguyên, giao dịch từ mẫu mới được thêm sau xác nhận OTP.

## Kiểm chứng

Từ `capitalflow-api`:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
.\.venv\Scripts\python.exe tests/bank_link_integration.py
.\.venv\Scripts\python.exe -B tests/financial_consistency_integration.py
.\.venv\Scripts\python.exe -B tests/retail_invoice_sql_integration.py
.\.venv\Scripts\python.exe -m pyrefly check app/chuc_nang/nguoi_dung/tai_chinh/vi_tai_khoan
```

Integration dùng SQL Server cấu hình hiện có, dữ liệu thử nằm trong transaction
ngoài và được rollback. Email bị mock; không gửi thư thật. Đối soát hash dữ liệu
20 bảng trước/sau, kiểm tra 5 mẫu, sửa JSON khi đang chạy, giữ mã cũ, lỗi file, OTP, phân trang trên 200 giao dịch, lịch sử
ngoài 90 ngày, đối soát số dư, gián đoạn, liên kết lại và bảo vệ giao dịch nguồn.

`financial_consistency_integration.py` gọi HTTP routes thật với SQL Server và
dispatcher BUDGET thật, chỉ xử lý job của tài khoản thử. Kiểm tra thêm/sửa/đổi ví/
xóa giao dịch, chuyển nội bộ, thiếu số dư, điều chỉnh số dư, xác nhận hóa đơn/
retry/xóa/xác nhận lại; đối chiếu số dư ví, tổng sổ giao dịch, dashboard, báo cáo
và tiến độ ngân sách sau từng bước. Kiểm tra sửa số tiền/ngày/dấu giao dịch nguồn,
ngưỡng 80%/100%, giao nhận tác vụ lặp, giữ ghi chú, rollback cả outbox khi đồng bộ
lỗi giữa chừng và quyền sở hữu dữ liệu. Retry mất phản hồi được mô phỏng bằng
cách bỏ qua kết quả đầu rồi gửi lại cùng khóa. Không chạy worker nhận dạng OCR,
gửi email hoặc thao tác UI trình duyệt; không mô phỏng nhiều request đồng thời.

Migration `cfdb_bank_link_v2` chỉ mở rộng cột số che, không sửa bản ghi hiện có.
Hướng phát triển: API chính thức, cấp quyền/thu hồi của nhà cung cấp, phân trang
hoặc cursor thực, webhook, lịch sử theo phạm vi API cho phép, đối ghép chuyển tiền
nội bộ và xử lý giao dịch hủy/đảo. Không cần thêm chức năng thanh toán.
