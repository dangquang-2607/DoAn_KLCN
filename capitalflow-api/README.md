# CapitalFlow API

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

Xem [sơ đồ cấu trúc và trách nhiệm file](docs/architecture/capitalflow-api-structure.md) trước khi thêm file mới.

## An toàn database

API chỉ ánh xạ và sử dụng schema hiện hành. Mọi `DROP`, `DELETE` hàng loạt hoặc đổi kiểu dữ liệu phải được người quản lý dự án duyệt trước và thực hiện qua project `capitalflow-database`.
