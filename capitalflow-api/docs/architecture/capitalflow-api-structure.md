# Cấu trúc CapitalFlow API sau tái cấu trúc

## Mục đích

Tài liệu này là bản đồ tra cứu chính thức của backend. Mục tiêu là giúp xác định nhanh file nào sở hữu một chức năng, tránh tiếp tục sinh route/model/service vào các thư mục dùng chung và phân biệt source runtime với test, script hay artifact.

## Cây trách nhiệm

```text
app/
├── main.py                 Điểm vào ổn định app.main:app
├── bootstrap/              Lắp ráp FastAPI, lifespan, handler, health và router
├── shared/                 Cấu hình, database, security, HTTP và telemetry dùng chung
└── modules/
    ├── dangnhap/           Đăng ký, đăng nhập, OTP, mật khẩu và phiên
    ├── taichinh/           Tài khoản, giao dịch, ngân sách và báo cáo
    ├── hoadon/             Upload, OCR, duyệt và xác nhận hóa đơn
    ├── danhmuc/            Danh mục thu/chi và phân loại tự động
    ├── admin/              Người dùng, vòng đời xóa, audit và monitoring
    ├── email/              SMTP, render và nhật ký email
    └── jobs/               Queue bền vững và worker
```

## Quy tắc đặt file

Mỗi module có thể có `api`, `application`, `schemas`, `persistence` hoặc `infrastructure` khi thật sự cần. Không tạo file giữ chỗ rỗng chỉ để khớp sơ đồ. File mới phải đặt cạnh nghiệp vụ sở hữu nó; chỉ đưa vào `shared` khi ít nhất hai module dùng chung và nội dung không chứa quy tắc nghiệp vụ.

`app/main.py` chỉ export ứng dụng. `app/bootstrap/routers.py` là nơi duy nhất ghép router cấp cao. `app/shared/database/model_registry.py` nạp toàn bộ ORM model để metadata đầy đủ, nhưng model vẫn nằm trong module sở hữu.

## Khu vực ngoài runtime

- `tests/unit`: kiểm thử logic cô lập.
- `tests/integration/<module>`: kiểm thử API/service theo phân hệ.
- `tests/operational`: contract bảo mật, resilience và UI/runtime.
- `scripts/deployment`: chẩn đoán và smoke test triển khai.
- `scripts/load_test`: công cụ tải, không được import vào runtime production.
- `docs`: tài liệu chuẩn; output sinh tự động phải vào `artifacts`.
- `uploads`: dữ liệu runtime, không phải source code.

## File có thể xóa và file không được xóa tùy tiện

Có thể xóa an toàn `__pycache__`, `.pytest_cache` và output trong `artifacts/load-tests` vì đều tái sinh được. Không xóa module runtime, model, schema, test hồi quy, Dockerfile hoặc script chẩn đoán chỉ vì chúng không được import trực tiếp từ `app.main`; worker, CI và vận hành dùng các điểm vào riêng.

Migration/baseline SQL không thuộc project này. Mọi thay đổi phá hủy dữ liệu phải được duyệt trước trong `capitalflow-database`.
