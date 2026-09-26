# CapitalFlow API

Backend FastAPI của CapitalFlow, gồm REST API, worker xử lý nền, ORM SQLAlchemy và bộ kiểm thử. Project này **không quản lý migration SQL**; baseline và lịch sử thay đổi SQL Server nằm trong `../capitalflow-database`.

## Chạy cục bộ

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
.\.venv\Scripts\python.exe -m app.modules.jobs.runner
.\.venv\Scripts\python.exe -m pytest -q
```

Điểm vào ổn định của API luôn là `app.main:app`. Việc lắp ráp ứng dụng nằm trong `app/bootstrap`; mã nghiệp vụ nằm theo phân hệ trong `app/modules`; hạ tầng dùng chung nằm trong `app/shared`.

## Nguyên tắc cấu trúc

- `dangnhap`: tài khoản người dùng, đăng nhập, mật khẩu và phiên.
- `taichinh`: tài khoản tiền, giao dịch, ngân sách và báo cáo.
- `hoadon`: upload hóa đơn, OCR, duyệt và xác nhận.
- `danhmuc`: danh mục thu/chi và gợi ý phân loại.
- `admin`: quản trị người dùng, audit và giám sát.
- `email`: SMTP, nội dung và nhật ký gửi thư.
- `jobs`: hàng đợi bền vững và worker.
- `bootstrap`: lắp ráp FastAPI; không chứa nghiệp vụ.
- `shared`: hạ tầng dùng chung; không sở hữu nghiệp vụ.

Xem [sơ đồ cấu trúc và trách nhiệm file](docs/architecture/capitalflow-api-structure.md) trước khi thêm file mới.

## An toàn database

API chỉ ánh xạ và sử dụng schema hiện hành. Mọi `DROP`, `DELETE` hàng loạt hoặc đổi kiểu dữ liệu phải được người quản lý dự án duyệt trước và thực hiện qua project `capitalflow-database`.
