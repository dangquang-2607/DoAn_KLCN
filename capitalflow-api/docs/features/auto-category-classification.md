# Tự động phân loại giao dịch

## Luồng quyết định

1. Nếu người dùng chọn danh mục, hệ thống giữ nguyên lựa chọn và ghi nguồn `MANUAL`.
2. Nếu chưa chọn, hệ thống tìm các giao dịch cùng người dùng, cùng loại thu/chi và có mô tả tương đương sau chuẩn hóa Unicode.
3. Nếu lịch sử chưa đủ, hệ thống đối chiếu mô tả, ghi chú và tên mặt hàng với từ khóa của các danh mục đang hoạt động.
4. Chỉ kết quả có độ tin cậy từ `0.9000` mới được tự động gán. Kết quả thấp hơn chỉ xuất hiện dưới dạng gợi ý trên giao diện.
5. Nội dung không khớp vẫn được lưu ở trạng thái chưa phân loại.

Không có dữ liệu giao dịch nào được gửi sang dịch vụ AI bên ngoài cho nghiệp vụ phân loại.

## Dữ liệu kiểm toán

Mỗi giao dịch lưu:

- `category_confidence`: độ tin cậy tại thời điểm phân loại.
- `category_source`: `MANUAL`, `USER_HISTORY`, `CATEGORY_KEYWORD` hoặc `LEGACY`.
- `category_was_auto`: xác định danh mục đã được hệ thống tự gán hay chưa.

Khi người dùng sửa danh mục, giao dịch được đánh dấu là lựa chọn thủ công. Mô tả và danh mục sau khi sửa sẽ là tín hiệu lịch sử cho lần tiếp theo.

## API

`POST /api/v1/categories/suggest`

Payload gồm `type`, `description`, `note` và tối đa 50 `item_names`. API chỉ tìm trong danh mục hệ thống hoặc danh mục cá nhân mà người dùng hiện tại được phép truy cập.

## SQL Server

Schema của chức năng này đã được hợp nhất vào baseline của project
`capitalflow-database`. Không chạy lại wrapper migration legacy. Kiểm tra version:

```powershell
.\.venv\Scripts\python.exe -m alembic -c ..\capitalflow-database\alembic.ini current
```

Wrapper và SQL cũ chỉ còn trong `capitalflow-database/archive/pre_baseline_202609`
để tra cứu lịch sử, không phải lệnh vận hành hiện hành.
