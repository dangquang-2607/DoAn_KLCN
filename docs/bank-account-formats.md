# Định dạng số tài khoản trong bản demo

**Cập nhật 26/10/2026:** ví độc lập chỉ liên kết VCB, ACB, MB, TCB qua
`GET /api/v1/wallets/providers`. MoMo và endpoint `/accounts` bên dưới thuộc
mô hình cũ. Danh mục ví hiện tại không chứa giao dịch hoặc số dư nguồn;
`demo_bank_data.json`/`demo_source.py` đã tách vào `legacy_bank_sync/` để bảo toàn
kiểm thử nhánh tương thích, không được dùng bởi ví độc lập.
Xem [kịch bản demo hiện tại](bank-link-demo.md).

Phạm vi triển khai ngày 21/10/2026:

- Vietcombank (VCB): 10 hoặc 13 chữ số.
- ACB: 8 hoặc 9 chữ số.
- MB Bank (MB): 9, 10, 12 hoặc 13 chữ số.
- Techcombank (TCB): 10, 12 hoặc 14 chữ số.
- MoMo (MOMO): số điện thoại nội địa 10 chữ số, bắt đầu bằng 03/05/07/08/09.

Đây là tập định dạng được hỗ trợ trong demo, không phải đặc tả đầy đủ được
các ngân hàng chứng nhận. Tài khoản số chọn, tài khoản ngắn, tài khoản doanh
nghiệp, tài khoản định danh và alias có thể có định dạng khác. Không suy luận
ngân hàng chỉ từ độ dài; không coi số thẻ Visa/JCB là số tài khoản. Không kiểm
tra sự tồn tại hoặc chủ sở hữu tài khoản tại ngân hàng thật.

Nguồn tham khảo để phân biệt sản phẩm và phạm vi:

- [Vietcombank: tài khoản số đẹp và số tài khoản theo số điện thoại](https://www.vietcombank.com.vn/vi-VN/KHCN/SPDV/Dich-vu-tai-khoan/Tai-khoan-so-dep).
- [ACB: dịch vụ cấp số tài khoản theo yêu cầu](https://acb.com.vn/dich-vu-cap-so-tai-khoan-theo-yeu-cau).
- [VTC News: tài khoản ACB 8 hoặc 9 chữ số](https://amp.vtcnews.vn/tai-khoan-ngan-hang-acb-co-bao-nhieu-so-ar869878.html).
- [MB: các sản phẩm tài khoản số đẹp, theo số điện thoại](https://news.mbbank.com.vn/news/cau-thu-nham-manh-dung-djuoc-trao-tang-tai-khoan-so-djep-mbbank-1653461163).
- [Techcombank: số chọn 10/12/14 và sản phẩm ưu tiên ngắn hơn](https://techcombank.com/thong-tin/blog/cach-chon-so-tai-khoan-dep).
- [MoMo: số tài khoản là số điện thoại đăng ký](https://www.momo.vn/hoi-dap/so-tai-khoan-momo-la-gi).

## Thực thi

`number_rules.py` ở phân hệ `vi_tai_khoan` là nguồn quy tắc duy nhất.
`GET /api/v1/accounts/number-rules` cung cấp tên, pattern, nhãn, hướng dẫn và
độ dài tối đa cho frontend. Endpoint yêu cầu đăng nhập như các API tài khoản.

Cả gửi OTP và tạo ví kiểm tra định dạng rồi đối chiếu đúng tài khoản mẫu
trong `demo_catalog.py`. Endpoint quy tắc trả thêm `demo_number` để
hướng dẫn người dùng; đây là các số mẫu công khai.

OTP gắn với người dùng, tài khoản mẫu và ví cần liên kết lại (nếu có).
Tạo ví chỉ che số sau bước kiểm tra OTP. DB lưu chuỗi cùng độ dài, chỉ giữ
3 số cuối; ví dụ `0987654321` thành `*******321`, cột `VARCHAR(20)`.
Không lưu số đầy đủ vào ví hoặc bank_state; mã định danh mẫu dùng cho đồng bộ.

PATCH chỉ cho giữ thông tin liên kết hiện có. Đổi tài khoản phải tạo ví mới;
ví cũ muốn chuyển sang nguồn mẫu mới cần xác nhận OTP qua Quản lý liên kết.
Frontend giữ số dưới dạng chuỗi, xóa OTP/challenge khi đổi ngân hàng hoặc số.

OTP email xác nhận thao tác trong ứng dụng, không xác minh quyền sở hữu tài
khoản tại ngân hàng thật. Xem `bank-link-demo.md` để chạy demo và kiểm thử.

Lịch sử và số dư đầu kỳ được lưu trong `demo_bank_data.json`, đọc lại mỗi lần
đồng bộ qua `demo_source.py`; không thêm giao dịch vào `demo_catalog.py` nữa.
