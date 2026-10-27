# Mã tương thích đồng bộ ngân hàng cũ

Các file trong thư mục này được bảo toàn để chạy kiểm thử và đọc lại luồng
tài khoản cũ. Chúng không thuộc mô hình ví độc lập đang sử dụng.

- `bank.py`: đồng bộ số dư và nhập giao dịch ngân hàng theo mô hình trước đây.
- `demo_catalog.py`: danh sách mẫu cũ, gồm cả MoMo.
- `demo_source.py`, `demo_bank_data.json`: nguồn lịch sử và số dư mẫu của luồng cũ.

Khi `INDEPENDENT_WALLETS_ENABLED=true`, router ví không import nhóm module
này và không mở endpoint đồng bộ. Không sửa JSON ở đây để demo ví hiện tại.
Nhánh tương thích chỉ được đăng ký khi chủ động tắt cờ ví độc lập.

Luồng hiện tại dùng `../demo_catalog.py` (VCB, ACB, MB, TCB),
`../number_rules.py`, `../link_otp.py` và `../wallet_api.py`.
Ngân hàng chỉ dùng để liên kết, nạp và rút; không nhập lịch sử ngân hàng vào
sổ thu chi. Không xóa hay thay đổi dữ liệu đã lưu trong database khi tách mã.
