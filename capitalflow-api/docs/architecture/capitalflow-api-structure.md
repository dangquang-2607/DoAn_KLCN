# Cấu trúc CapitalFlow API sau tái cấu trúc

## Mục đích

Tài liệu này là bản đồ tra cứu chính thức của backend. Mục tiêu là giúp xác định nhanh file nào sở hữu một chức năng, tránh tiếp tục sinh route/model/service vào các thư mục dùng chung và phân biệt source runtime với script, tài liệu hay dữ liệu cục bộ.

## Cây trách nhiệm

```text
app/
├── main.py                         Điểm vào ổn định app.main:app
├── khoi_dong/                      FastAPI, lifespan, health và ghép router
├── chuc_nang/
│   ├── nguoi_dung/
│   │   ├── dang_nhap/              Tài khoản, mật khẩu, OTP và phiên
│   │   ├── danh_muc/               Danh mục thu/chi và gợi ý phân loại
│   │   ├── hoa_don_ai/             Upload, XML, OCR, duyệt hóa đơn
│   │   └── tai_chinh/
│   │       ├── vi_tai_khoan/       Ví và liên kết ngân hàng mô phỏng
│   │       ├── giao_dich/          Giao dịch, chuyển tiền và ghi sổ
│   │       ├── ngan_sach/          Ngân sách và kỳ hạn
│   │       ├── bao_cao_tai_chinh/  Dashboard, phân tích, CSV
│   │       └── thong_bao/          Thông báo tài chính
│   └── quan_tri/
│       ├── bang_dieu_khien/       Chỉ số tổng quan
│       ├── phan_tich_van_hanh/    Phân tích hệ thống
│       ├── nguoi_dung/            Quản lý và vòng đời người dùng
│       ├── danh_muc_he_thong/     Danh mục hệ thống
│       ├── giam_sat_hoa_don/      Theo dõi và retry OCR
│       ├── nhat_ky_quan_tri/      Nhật ký hành động
│       ├── email_cau_hinh/        SMTP và nhật ký gửi thư
│       └── dung_chung/            Schema và helper riêng của quản trị
└── dung_chung/
    ├── database/                   Session, Base, đăng ký model
    ├── security/                   Mật khẩu, token, mã hóa
    ├── http/                       Dependency và middleware
    ├── email/                      Dịch vụ gửi thư dùng nhiều tính năng
    ├── tac_vu_nen/                Queue và worker
    ├── observability/             Telemetry
    └── text/                      Chuẩn hóa Unicode
```

## Quy tắc đặt file

Mỗi tính năng có thể có `api`, `nghiep_vu`, `schemas`, `luu_tru` hoặc `ha_tang` khi thật sự cần. Schema dùng tên `schemas/` khi tách thành nhiều tệp, hoặc `schemas.py` khi nằm trong một tệp. Model và schema nằm cạnh tính năng sở hữu. Không tạo thư mục tab nếu API chưa có nghiệp vụ tương ứng; vì vậy trung tâm hỗ trợ và cài đặt bảo mật vẫn dùng các route hiện có của đăng nhập, tài khoản. Chỉ đưa vào `dung_chung` khi nhiều tính năng sử dụng.

`app/main.py` chỉ export ứng dụng. `app/khoi_dong/routes.py` là nơi duy nhất ghép router cấp cao. `app/dung_chung/database/dang_ky_mo_hinh.py` nạp toàn bộ ORM model để metadata đầy đủ, nhưng model vẫn nằm trong tính năng sở hữu. Worker chạy bằng `python -m app.dung_chung.tac_vu_nen.trinh_chay`.

## Khu vực ngoài runtime

- `scripts/deployment`: chẩn đoán và smoke test triển khai.
- `docs`: tài liệu kiến trúc, tính năng, vận hành và phát hành.
- `uploads`: dữ liệu runtime, không phải source code.

## File có thể xóa và file không được xóa tùy tiện

Có thể xóa an toàn `__pycache__` vì được Python tái sinh. Không xóa module runtime, model, schema, Dockerfile hoặc script chẩn đoán chỉ vì chúng không được import trực tiếp từ `app.main`; worker và vận hành dùng các điểm vào riêng.

Migration/baseline SQL không thuộc project này. Mọi thay đổi phá hủy dữ liệu phải được duyệt trước trong `capitalflow-database`.
