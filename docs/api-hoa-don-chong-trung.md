# Backend chống trùng hóa đơn — Web và Flutter

Cập nhật 13/10/2026: backend, migration, Web và Flutter dùng cùng hợp đồng. Web không có camera; camera chỉ ở project Flutter riêng. Chỉ triển khai 1–7, nguyên tắc 9 và quy tắc 12; tạm bỏ 8, 10–11. Prefix đầy đủ: `/api/v1/invoices`; Bearer token xác định chủ sở hữu. Không gửi user_id trong payload.

## Quy tắc đã triển khai

- Cùng người dùng, cùng bytes: SHA-256 trên server, trả bản cũ dù đổi tên file. Nguồn CAMERA/UPLOAD không tách phạm vi chống trùng.
- Hóa đơn có MST hợp lệ + ký hiệu + số hóa đơn + năm: khóa định danh mạnh. Cùng khóa nhưng khác ngày/tiền vẫn yêu cầu kiểm tra, không cho bỏ qua như khoản chi khác.
- Hóa đơn bán lẻ chưa có namespace số phiếu đáng tin cậy: cùng cửa hàng đã chuẩn hóa, ngày, tiền và tiền tệ là SUSPECTED. Không dùng confidence tổng của AI để tự nâng thành EXACT. Ảnh chụp lại thiếu thông tin có thể không được phát hiện.
- Nếu OCR đọc tên cửa hàng khác nhau (ví dụ thêm/bớt tên chi nhánh), số hóa đơn + địa chỉ người bán + ngày + tiền + tiền tệ trùng cũng tạo SUSPECTED, với reason `SAME_RECEIPT_NUMBER_ADDRESS_DATE_AMOUNT`. Số hoặc địa chỉ rỗng không đủ căn cứ; quy tắc này không tự nâng thành EXACT.
- Hai user độc lập; các ví của cùng user dùng chung phạm vi chống trùng.
- Khóa user, unique index trên hóa đơn CONFIRMED và transaction invoice_id bảo vệ ghi sổ đồng thời. Deadlock SQL Server 1205 được rollback/thử lại tối đa 3 lần; lỗi DB khác trả yêu cầu thử lại an toàn.
- Xóa hóa đơn là ẩn metadata và enqueue xóa ảnh. Giao dịch và thông tin chống trùng được giữ. Xóa ví/người dùng vẫn dùng quy trình purge riêng.

## Request key và phiên bản

Flutter nên gửi `Idempotency-Key: <UUID>` cho upload, confirm, resolve và restore. Giữ nguyên key và payload khi mất mạng/refresh token/thử lại cùng thao tác; thao tác mới dùng key mới. Cùng key khác nội dung trả 409 IDEMPOTENCY_KEY_REUSED. Key theo user, không dùng lại cho endpoint khác.

Để tương thích Web hiện tại, header này chưa bắt buộc. Backend vẫn chống ghi lặp bằng khóa, trạng thái và unique index. Đây là điều chỉnh so với bản kế hoạch ban đầu yêu cầu header bắt buộc. Flutter phải luôn gửi để có phát lại kết quả và phát hiện thay đổi payload.

GET chi tiết trả `revision`. Flutter luôn gửi `expected_revision` khi confirm. Backend bắt buộc giá trị này sau khi khoản chi bị xóa hoặc hóa đơn được khôi phục; request cũ thiếu revision hoặc dùng revision cũ không được tạo lại khoản chi. Resolve/restore luôn yêu cầu revision. Trong lần ghi nhận đầu tiên, revision có thể bỏ qua để tương thích Web.

Web và Flutter đã gửi revision/review_token, giải thích mã lỗi có cấu trúc và cho khôi phục metadata. EXACT không có thao tác bỏ qua; SUSPECTED cần quyết định rõ ràng của người dùng. Client giữ key khi kết quả chưa chắc chắn; đổi payload dùng key khác. Flutter lưu key theo máy chủ/chủ sở hữu, không lưu nội dung hóa đơn trong SharedPreferences.

## 1. Upload ảnh từ Flutter

`POST /api/v1/invoices`, multipart:

- `file`: bytes ảnh, filename có phần mở rộng đúng nội dung.
- `source`: CAMERA hoặc UPLOAD; mặc định UPLOAD. XML hợp lệ vẫn có nguồn IMPORT.

Nhận JPG/JPEG, PNG, WEBP, PDF, XML; tối đa 10 MB. Chưa nhận HEIC. Flutter chuyển định dạng trước khi gửi nếu cần và giữ nguyên bytes khi retry. Không gửi base64 thay multipart.

Phản hồi 201 khi tạo mới; 200 khi dùng bản có sẵn. Các trường cũ id/filename/status/mime_type/created_at được giữ; bổ sung:

```json
{
  "id": "<invoice UUID>",
  "outcome": "CREATED",
  "status": "UPLOADED",
  "revision": 1,
  "transaction_id": null,
  "deleted_at": null
}
```

outcome có thể là CREATED, REUSED_DRAFT, ALREADY_CONFIRMED hoặc RESTORE_REQUIRED. ALREADY_CONFIRMED trả transaction_id còn hiệu lực. RESTORE_REQUIRED không tự phục hồi ảnh; gọi restore có chủ đích rồi upload lại nếu cần ảnh.

Upload ảnh/PDF chưa tự chạy AI. Dùng `POST /{id}/ocr` hoặc `/batch-ocr` như hiện có. PROCESSING không tạo thêm job khi bấm lặp. XML được đọc trực tiếp. Backend lưu giờ lập nếu OCR đọc được, không tự bịa giờ.

## 2. Xem danh sách/chi tiết và kiểm tra dữ liệu sửa

GET danh sách mặc định `visibility=active` loại bản đã ẩn; `visibility=hidden` chỉ trả bản đã ẩn của chính chủ. Cả hai trả duplicate_level, duplicate_candidate_count, duplicate_of_invoice_id và revision. Truy vấn ứng viên theo lô, không truy vấn riêng từng dòng.

GET `/{id}` giữ is_duplicate/duplicate_reason cho client cũ, bổ sung duplicate_check, revision, deleted_at, transaction_id và invoice_time. Bản đã ẩn vẫn xem được metadata bởi chính chủ; endpoint /file trả 404 nếu ảnh đã xóa.

`POST /{id}/duplicate-check` nhận các trường đang sửa: merchant_name, merchant_address, merchant_tax_code, invoice_number, invoice_symbol, invoice_date, invoice_time, total_amount. Gửi `{}` để kiểm tra dữ liệu đang lưu. Endpoint không lưu các thay đổi này.

```json
{
  "level": "SUSPECTED",
  "can_override": true,
  "review_token": "<64 hex characters>",
  "candidate_count": 1,
  "candidates": [
    {
      "invoice_id": "<other invoice UUID>",
      "transaction_id": "<transaction UUID or null>",
      "level": "SUSPECTED",
      "reason": "SAME_MERCHANT_DATE_AMOUNT",
      "status": "CONFIRMED",
      "merchant_name": "K-Box Coffee",
      "invoice_date": "2026-10-11",
      "total_amount": "45000.00",
      "currency": "VND",
      "deleted_at": null,
      "revision": 2
    }
  ]
}
```

Tối đa 20 ứng viên được trả để đối chiếu; token bao gồm toàn bộ tập bằng chứng. Sửa thông tin hoặc có ứng viên thay đổi làm token cũ hết hiệu lực. EXACT không có quyền bỏ qua. Lý do mạnh: SAME_FILE, SAME_IDENTITY hoặc IDENTITY_DATA_CONFLICT.

## 3. Xác nhận ghi sổ

`POST /{id}/confirm` giữ các trường chỉnh sửa hiện có và thêm expected_revision, invoice_time, accept_distinct, duplicate_review_token.

```json
{
  "account_id": "<wallet UUID>",
  "expected_revision": 3,
  "merchant_name": "K-Box Coffee",
  "total_amount": "45000.00",
  "accept_distinct": true,
  "duplicate_review_token": "<token from duplicate-check using the same edits>"
}
```

Chỉ gửi accept_distinct=true khi người dùng đã đối chiếu và quyết định đây là khoản chi khác. Không cần token nếu NONE. Token sai/cũ sẽ trả cảnh báo mới; đừng tự chấp nhận lại bằng chương trình.

Thành công trả success, transaction_id, outcome CREATED/ALREADY_CONFIRMED và revision. Retry cùng key phát lại nguyên kết quả đã lưu. Nếu giao dịch đã xóa, trả CONFIRMATION_NO_LONGER_ACTIVE thay vì tái tạo khoản chi.

Các lỗi 409 có `detail.code`, `detail.message`; lỗi trùng kèm duplicate_check hoặc matched_invoice_id. Backend kiểm tra sau khi áp dụng dữ liệu sửa, không chỉ dựa vào kết quả kiểm tra trước đó.

- INVOICE_DUPLICATE_EXACT: mở bản gốc/giao dịch hoặc sửa trường OCR đọc sai.
- INVOICE_DUPLICATE_REVIEW_REQUIRED: hiển thị đối chiếu và quyết định của người dùng.
- INVOICE_VERSION_CONFLICT: tải lại bản mới.
- INVOICE_DELETED: cần khôi phục.
- IDEMPOTENCY_KEY_REUSED: key đã dùng với payload khác.
- CONFIRMATION_NO_LONGER_ACTIVE: khoản chi của yêu cầu cũ đã bị xóa.
- INVOICE_WRITE_CONFLICT: tải lại sau xung đột ràng buộc DB.
- 503 INVOICE_RETRY_REQUIRED: kết quả chưa chắc chắn, thử lại đúng key/payload hoặc tải trạng thái từ backend; không báo thành công lạc quan.

## 4. Đánh dấu cùng hóa đơn, xóa và khôi phục

`POST /{id}/duplicate-resolution`:

```json
{"expected_revision": 2, "action": "SAME_INVOICE", "matched_invoice_id": "<candidate invoice UUID>"}
```

Chỉ chấp nhận ứng viên cùng user, không liên kết vào chính bản đó hoặc tạo vòng lặp. CLEAR xóa quyết định liên kết; không bỏ qua lần kiểm tra chống trùng tiếp theo. CONFIRMED/PROCESSING không được sửa quyết định.

DELETE `/{id}` và POST `/batch-delete` giữ URL/kiểu phản hồi cũ. Hành vi mới là ẩn hóa đơn, xóa ảnh bằng job sau commit và giữ khoản chi. Xóa lại bản đã ẩn không đổi tiền hoặc tạo job dư.

`POST /{id}/restore` nhận `{"expected_revision": 3}`. Chỉ khôi phục metadata; trả requires_file=true nếu cần gửi lại ảnh. Không tạo tiền. Request confirm sau restore phải mang revision hiện tại.

Xóa khoản chi qua API giao dịch như hiện có sẽ hoàn tác số dư theo sổ cái, chuyển hóa đơn về REVIEW_REQUIRED và tăng revision/generation. Ghi nhận lại là thao tác mới, key mới, revision mới.

## 5. Migration và kiểm chứng

Migration mới: `cfdb_invoice_dedup`, sau `cfdb_recurring_budgets`. API mới cần schema mới trước khi chạy. Không tự chạy migration lúc API khởi động.

Thứ tự trên môi trường triển khai: backup → tạm dừng ghi hóa đơn/worker phiên bản cũ → upgrade schema → chạy backfill dry-run → đối soát nếu có xung đột → backfill --apply → khởi động API/worker mới → smoke test. Không mở ghi khi backfill chưa hoàn tất. Công cụ không tự gộp hay xóa khoản chi cũ.

Với database SQL Server `personal_finance` của dự án, chạy công cụ triển khai từ gốc repository sau khi chọn đúng DATABASE_URL và dừng writer phiên bản cũ:

```powershell
.\capitalflow-api\.venv\Scripts\python.exe capitalflow-database/tools/apply_invoice_dedup.py
```

Công cụ kiểm tra trước migration, tạo backup COPY_ONLY/CHECKSUM và RESTORE VERIFYONLY, khóa các bảng liên quan trong thời gian nâng cấp, rồi migration và backfill trong cùng transaction. So sánh toàn bộ bản ghi accounts/transactions và số lượng bản ghi trước/sau; có sai lệch thì rollback. `alembic check` phải đạt trước commit. Công cụ chỉ chấp nhận database `personal_finance` đã cấu hình; các tùy chọn diễn tập QA đã được gỡ.

Các lệnh thủ công dưới dùng khi triển khai riêng từng bước trên môi trường đã sao lưu và dừng writer:

```powershell
.\capitalflow-api\.venv\Scripts\python.exe -m alembic -c capitalflow-database/alembic.ini upgrade head
.\capitalflow-api\.venv\Scripts\python.exe capitalflow-database/tools/backfill_invoice_dedup.py
.\capitalflow-api\.venv\Scripts\python.exe capitalflow-database/tools/backfill_invoice_dedup.py --apply
```

Backfill là toàn bộ hoặc rollback, có thể chạy lại; chưa có checkpoint chia batch. Dry-run báo tệp thiếu, nhóm CONFIRMED trùng và giao dịch OCR mất liên kết. --apply từ chối nếu có nhóm CONFIRMED trùng hoặc trạng thái/liên kết bất nhất. Không khôi phục liên kết cũ bằng phỏng đoán. Các file còn thiếu không thể backfill hash; vẫn đối chiếu theo nội dung đã lưu khi đủ dữ liệu.

Bộ test và database QA đã được dọn ngày 19/10/2026 theo yêu cầu chủ dự án.
Kiểm tra trực tiếp qua Web/Mobile: tải lại cùng file, thử hóa đơn nghi trùng,
xác nhận, ẩn/khôi phục rồi đối chiếu số giao dịch và số dư.

## Theo dõi và kiểm chứng

Route hóa đơn ghi log `capitalflow.invoice_metrics` với tiền tố `invoice_metric`: operation, method, status, handler_ms; outcome/duplicate_level/error_code nếu có. Không log tên file, nội dung OCR, ID người dùng/hóa đơn, token hoặc số tiền. `handler_ms` đo thời gian xử lý route, không bao gồm toàn bộ thời gian truyền file. HTTP 422 do schema cũng được ghi đúng mã.

