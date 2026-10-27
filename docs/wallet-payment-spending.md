# Thanh toán ví và tính vào chi tiêu

Cập nhật ngày 26/10/2026. Phạm vi triển khai: API và user-web; mobile đồng bộ sau.

## Hai loại lịch sử

- **Lịch sử ví** là chứng từ tiền đã nạp, rút, chuyển hoặc thanh toán. Thanh toán
  thành công trừ tiền đúng một lần và giữ nguyên chứng từ, kể cả khi người dùng
  tắt tính chi tiêu hoặc đóng ví.
- **Sổ thu chi** phục vụ báo cáo và ngân sách cá nhân. OCR/nhập tay chỉ ghi sổ,
  không trừ hoặc cộng tiền ví. Khoản thanh toán ví được đưa vào sổ khi bật
  **Tính vào chi tiêu**.

Công tắc chỉ xuất hiện sau khi thanh toán ví thành công, trong lịch sử/chi tiết
thanh toán và phần chỉnh sửa khoản ghi nhận liên quan. Không đặt công tắc này
trong bước tạo thanh toán hay trong form ghi thu chi độc lập bằng OCR/nhập tay.

## Bật, tắt và danh mục

Thanh toán mới mặc định bật. Hệ thống sử dụng bộ phân loại hiện có khi đủ độ
tin cậy; ví dụ hóa đơn siêu thị có thể được phân vào Mua sắm. Không đủ dữ liệu
thì để chưa phân loại và cho người dùng chọn. Không bảo đảm mọi hóa đơn đều
được phân loại đúng tự động.

- Bật: khoản ghi nhận xuất hiện trong sổ thu chi, báo cáo và mức đã chi của
  ngân sách tổng/ngân sách danh mục phù hợp với ngày giao dịch.
- Tắt: khoản đó không xuất hiện trong danh sách sổ thu chi, báo cáo, xuất sổ
  hoặc mức đã chi của ngân sách; người dùng vẫn xem được trong lịch sử ví.
- Bật lại: dùng lại cùng khoản ghi nhận, không sinh khoản chi thứ hai.
- Tắt hoặc sửa số tiền ghi nhận **không hoàn tiền**, không sửa số tiền thanh toán,
  không đổi số dư ví. Không tự tạo ngân sách mới khi người dùng chưa có ngân sách.

Ví dụ ví có 1.000.000đ, thanh toán đi chợ 100.000đ: ví còn 900.000đ. Bật tính
chi tiêu thì Mua sắm ghi 100.000đ; tắt thì khoản này đóng góp 0đ vào báo cáo
và ngân sách, ví vẫn còn 900.000đ. Nếu chỉ 40.000đ là phần chi cá nhân, người
dùng có thể sửa số tiền ghi nhận thành 40.000đ, trong khi chứng từ ví vẫn 100.000đ.
Số tiền ghi nhận phải dương và không vượt số tiền đã thanh toán.

## OCR, nhập tay và chống tính hai lần

Một thanh toán có một khoản ghi nhận chuẩn được liên kết bằng `wallet_entry_id`.
Tắt công tắc giữ khoản chuẩn ở trạng thái không tính, thay vì xóa dữ liệu liên kết.

- Đã thanh toán rồi mới OCR hóa đơn: chọn khoản thanh toán có sẵn; gắn hóa đơn
  vào cùng khoản ghi nhận, giữ số tiền cá nhân và quyết định bật/tắt trước đó.
- Đã nhập khoản chi trước khi thanh toán: có thể chọn khoản ghi nhận đó khi trả
  hóa đơn. API kiểm tra chủ sở hữu, loại chi, số tiền và liên kết hóa đơn.
- Khoản OCR/nhập tay trùng số tiền/ngày với thanh toán được yêu cầu đối chiếu.
  Có thể chọn thanh toán có sẵn hoặc xác nhận đây là khoản khác; không tự gộp
  chỉ vì số tiền giống nhau.
- Không cho xóa khoản ghi nhận gắn thanh toán. Muốn loại khỏi thống kê thì tắt
  công tắc. Khoản ghi sổ độc lập vẫn theo quy trình sửa/xóa của sổ thu chi.

## API và dữ liệu

- `POST /api/v1/wallets/{wallet_id}/payments/create`: thanh toán mô phỏng, có
  idempotency và kiểm tra số dư; không nhận công tắc trước thanh toán.
- Lịch sử ví trả chứng từ cùng danh mục, số tiền ghi nhận, trạng thái tính chi tiêu.
- `PATCH /api/v1/bookkeeping/{id}`: cập nhật thông tin ghi nhận và công tắc
  cho khoản đã liên kết thanh toán; không thay đổi sổ tiền ví.
- Các truy vấn báo cáo, ngân sách và xuất sổ chỉ tính khoản hợp lệ có
  `include_in_reports=true`. Nạp/rút/chuyển tiền ví không tự trở thành thu/chi.
- Migration `cfdb_wallet_spending` bổ sung trường liên kết, cờ tính báo cáo,
  thông tin hóa đơn và loại PAYMENT. Unique index chặn hai khoản ghi nhận
  cùng một chứng từ ví.

## Kiểm chứng đã thực hiện

- 30 unit test; integration trên SQL Server thực với rollback dữ liệu thử.
- Thanh toán/retry không trừ hai lần; thiếu tiền bị chặn; mã hóa đơn trùng của
  cùng người dùng bị chặn; tắt/bật và sửa phần chi không đổi số dư.
- Ngân sách theo danh mục, báo cáo, xuất sổ và liên kết OCR không tính hai lần.
- Kiểm thử đồng thời chuyển/đóng ví, retry cùng khóa và tranh chấp số dư.
- Trình duyệt: luồng ví, thanh toán, bật/tắt, ngân sách, OCR, nhập tay,
  giao diện 390px và không có ngoại lệ runtime trong luồng kiểm thử.
- User-web lint, TypeScript và production build đạt; regression nghiệp vụ
  hóa đơn và tính nhất quán tài chính cũ đạt khi tắt cờ ví độc lập.
- Migration đã backup, diễn tập nâng/hạ bằng rollback và kiểm tra dữ liệu/index;
  24 bảng tồn tại trước migration giữ nguyên các trường dữ liệu cũ.

Đây là thanh toán và ngân hàng **mô phỏng**, chưa tích hợp nhà cung cấp thật,
đối soát thanh toán bất đồng bộ hoặc hoàn tiền. Bộ thử giao diện dùng OTP và
hóa đơn OCR có sẵn; không thay thế nghiệm thu SMTP, nhà cung cấp OCR thật hay
đo hiệu năng trên điện thoại thật. Các bài kiểm thử chỉ xác nhận phạm vi đã chạy.

Ảnh MoMo do chủ dự án cung cấp là tham khảo trải nghiệm, không phải bằng chứng
về cấu trúc dữ liệu hay thuật toán nội bộ MoMo. Tham khảo tính năng công khai:
[Quản lý chi tiêu MoMo](https://www.momo.vn/quan-ly-chi-tieu).
