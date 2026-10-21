# Kế hoạch chống trùng hóa đơn — đợt 1

Ngày lập: 12/10/2026. Phạm vi: Không gian cá nhân CapitalFlow.

Trạng thái cập nhật 13/10/2026: backend và migration đợt 1 đã hoàn thành trước đó. Theo yêu cầu tiếp tục, đã tích hợp giao diện Web, Flutter tại `capitalflow-mobile/capitalflow-mobile` và công cụ đối soát/đánh giá đợt vận hành. **Không xây camera trên Web. Trường hợp 8 và 10–11 tạm loại khỏi phạm vi.** Camera chỉ nằm trong ứng dụng Flutter. Xem trạng thái kiểm thử và phần chưa nghiệm thu thực địa trong [triển khai các đợt tiếp theo](trien-khai-chong-trung-dot-2-4.md). Hợp đồng API ở [api-hoa-don-chong-trung.md](api-hoa-don-chong-trung.md).

Các phần phân tích hiện trạng bên dưới mô tả thời điểm lập kế hoạch ban đầu, không phải trạng thái code hiện tại. Các quyết định phạm vi cập nhật ở đầu tài liệu được ưu tiên.

## 1. Kết quả cần đạt và phạm vi

Một người dùng có thể tải hoặc chụp lại hóa đơn nhiều lần, nhưng không được ghi nhận thêm khoản chi cho cùng hóa đơn đã được nhận diện là trùng. Hai người dùng khác nhau được ghi nhận độc lập.

- Triển khai trường hợp 1: hóa đơn mới, xác nhận bình thường.
- Triển khai trường hợp 2: cùng tệp, bản cũ chưa ghi sổ; mở lại bản cũ.
- Triển khai trường hợp 3: cùng tệp, bản cũ đã ghi sổ; trả giao dịch đã có.
- Triển khai trường hợp 4: ảnh khác của cùng hóa đơn; đối chiếu dữ liệu OCR.
- Triển khai trường hợp 5: nghi trùng; đối chiếu rồi cho phép xác nhận là khoản chi khác.
- Triển khai trường hợp 6: bấm lặp, retry, nhiều tab hoặc thiết bị; ghi sổ một lần.
- Triển khai trường hợp 7: xóa chứng từ, xóa giao dịch, ghi nhận lại có chủ đích.
- Áp dụng nguyên tắc 9: phạm vi theo người dùng, không đối chiếu xuyên người dùng.
- Áp dụng quy tắc 12: tên file không phải tiêu chí; phân biệt tệp giống, nội dung giống và thông tin chưa chắc chắn.

Chưa làm: gắn hóa đơn vào khoản chi nhập tay (8); sổ chung và xác nhận đồng thời trong sổ chung (10–11); chia tiền; tự hoàn tác các giao dịch trùng có từ trước; sổ chung trên Mobile; hàng đợi ngoại tuyến hoàn chỉnh; nhận diện ảnh tương đồng bằng mô hình riêng.

Repository gồm user-web Next.js, admin-web, FastAPI và project Flutter riêng đã được người dùng xác nhận. Web nhận upload; Flutter nhận upload và camera, cùng dùng một hợp đồng chống trùng của backend.

## 2. Hiện trạng đã kiểm tra

- `capitalflow-api/app/chuc_nang/nguoi_dung/hoa_don_ai/api/routes.py`: upload luôn tạo Invoice mới; chưa tính mã băm. Ảnh/PDF được upload trước, người dùng bấm Quét AI sau; XML được đọc trực tiếp. Kế hoạch giữ hành vi này, không tự bật OCR cho mọi tệp tải lên.
- `.../hoa_don_ai/nghiep_vu/phat_hien_trung_lap.py`: chỉ so sánh với Invoice CONFIRMED của cùng user. Hai nhánh là MST + số hóa đơn, hoặc tên cửa hàng + ngày + tổng tiền. Kết quả hiện chỉ có boolean và lời giải thích, chưa phân cấp chắc chắn/nghi ngờ.
- `.../hoa_don_ai/api/routes.py`: GET chi tiết gọi kiểm tra trùng; POST confirm chưa gọi lại kiểm tra này sau khi áp dụng thông tin sửa.
- Confirm đã khóa dòng Invoice trên SQL Server, trả lại giao dịch nếu cùng invoice_id đã có. Model và baseline có unique index `UX_transactions_invoice`. Đây là nền tảng tốt cho cùng một bản ghi, chưa đủ cho hai invoice_id khác nhau của cùng chứng từ.
- `frontend/user-web/src/chuc-nang/hoa-don-ai/thanh-phan/InvoiceDetailForm.tsx`: cảnh báo có checkbox ở client; lựa chọn này chưa trở thành quyết định được backend kiểm chứng và ghi nhận.
- `.../hoa_don_ai/nghiep_vu/deletion.py`: xóa hóa đơn hiện gỡ Transaction.invoice_id rồi xóa Invoice. Khoản chi vẫn còn nhưng mất dữ liệu đối chiếu chống trùng.
- `.../tai_chinh/giao_dich/so_cai.py`: xóa giao dịch hiện hoàn tác tác động số dư theo nghiệp vụ sổ cái và đưa hóa đơn về REVIEW_REQUIRED. Tận dụng hành vi này, bổ sung lịch sử và phiên bản.
- Backend có `idempotent_money`, bảng bản ghi phát lại và khóa theo user. Client hiện gắn Idempotency-Key cho accounts/transactions, chưa bao gồm invoices.
- `InvoiceUploadZone.tsx` hiện có chọn tệp/kéo thả; chưa có nút camera chuyên biệt. SQL baseline đã cho phép source CAMERA; route upload hiện chưa tiếp nhận nguồn này.
- Cập nhật 19/10/2026: bộ kiểm thử tự động và môi trường QA đã được gỡ theo yêu cầu chủ dự án; chủ dự án kiểm tra trực tiếp trên ứng dụng. Các mục nghiệm thu bên dưới là kế hoạch lịch sử.

## 3. Quy tắc nghiệp vụ phải thống nhất

### 3.1. Phạm vi

Mọi truy vấn, khóa chống trùng, kết quả đối chiếu và thao tác giải quyết đều theo user_id lấy từ phiên đăng nhập. Không lấy user_id do client tự khai làm căn cứ phân quyền.

account_id trong Invoice là ví/tài khoản thanh toán, không phải phạm vi chống trùng. Cùng người dùng chọn ví khác vẫn không được ghi cùng hóa đơn lần nữa. Hai user cùng tệp hoặc cùng số hóa đơn vẫn độc lập, kể cả xác nhận đồng thời.

### 3.2. Ba mức kết quả

- NONE: chưa tìm thấy ứng viên; cho đi tiếp sau validation thông thường. NONE không có nghĩa chắc chắn hóa đơn chưa từng xuất hiện nếu dữ liệu OCR thiếu.
- SUSPECTED: có bằng chứng tương đồng nhưng chưa đủ định danh. Cần đối chiếu; có thể chọn “Đây là khoản chi khác”.
- EXACT: cùng bytes của tệp hoặc cùng định danh chứng từ đủ điều kiện. Không có nút bỏ qua để ghi sổ tiếp; mở bản gốc/giao dịch hoặc sửa thông tin OCR sai rồi đối chiếu lại.

Trạng thái xử lý vẫn là UPLOADED, PROCESSING, REVIEW_REQUIRED, CONFIRMED, FAILED. Nhãn nghi trùng và quyết định xử lý là thuộc tính riêng, không tạo tổ hợp status như REVIEW_REQUIRED_DUPLICATE. Không dùng ARCHIVED để thay thế việc giữ trạng thái đã ghi sổ.

### 3.3. Nhận diện

1. Tệp: SHA-256 do backend tính từ bytes nhận được. Không phụ thuộc tên file, thiết bị hoặc tên người upload. Không coi mã băm do client gửi là bằng chứng chính.
2. Hóa đơn có định danh đầy đủ: tạo khóa có phiên bản từ loại chứng từ, MST đã chuẩn hóa, ký hiệu, số hóa đơn và năm lập. Các thông tin ngày, tiền, loại tiền cần nhất quán; có mâu thuẫn thì yêu cầu kiểm tra/sửa, không tự hạ thành “khác hóa đơn” để vượt chặn. Chỉ MST + số hóa đơn như mã hiện tại là chưa đủ.
3. Hóa đơn bán lẻ: dùng số phiếu + điểm bán/địa chỉ + ngày giờ và thông tin tiền để đối chiếu. Đợt đầu chỉ nâng lên EXACT khi định danh đủ, rõ và quy tắc không mâu thuẫn; thiếu căn cứ về số phiếu/điểm bán thì giữ SUSPECTED. Không mặc định tên quán + ngày + số tiền là duy nhất.
4. Không có số hóa đơn: tên cửa hàng đã chuẩn hóa + ngày + số tiền + tiền tệ tạo ứng viên SUSPECTED; địa chỉ, mặt hàng, giờ hỗ trợ giải thích.
5. Cùng tên file nhưng bytes khác không có ý nghĩa trùng. Cùng số hóa đơn nhưng khác nhà bán hoặc khác năm/ký hiệu hợp lệ không tự động trùng.

Chuẩn hóa Unicode, khoảng trắng, chữ hoa/thường có kiểm soát; tiền dùng Decimal; giữ số 0 đầu và ký tự có ý nghĩa của số hóa đơn; không tự gộp mọi chi nhánh thành một cửa hàng. Thiếu dữ liệu thì để null, không tự điền ngày hôm nay để tính khóa chống trùng. Lưu giá trị gốc để người dùng kiểm tra.

Điểm confidence tổng do OCR trả về không phải bằng chứng độc lập rằng từng trường định danh đều chính xác. Không cam kết phát hiện 100% ảnh chụp lại khi OCR thiếu hoặc sai.

## 4. Workflow cụ thể

### 4.1. Upload và camera

Chọn/chụp ảnh → xem lại → gửi bytes → kiểm tra định dạng/kích thước → tính hash → khóa theo user trong giao dịch DB ngắn → tìm bản cũ → trả bản cũ hoặc lưu bản mới.

- Không có bản cũ: tạo UPLOADED. XML hợp lệ tạo REVIEW_REQUIRED sau parse như hiện tại.
- Bản cũ UPLOADED/REVIEW_REQUIRED: mở tiếp bản đó.
- Bản cũ PROCESSING: mở tiến trình đang chạy, không xếp thêm OCR.
- Bản cũ FAILED: cho quét lại trên bản cũ.
- Bản cũ CONFIRMED: trả hóa đơn và transaction_id còn hiệu lực; không tạo bản mới.
- Bản đã ẩn/xóa ảnh nhưng khoản chi còn: báo đã ghi nhận, cho xem thông tin/giao dịch; không hứa mở được ảnh đã xóa.
- Bản nháp cũ đã xóa và chưa có khoản chi: có thể khôi phục để tiếp tục khi người dùng chủ động tải lại; ghi sự kiện khôi phục.
- Tệp cũ từng ghi sổ, sau đó giao dịch bị xóa: hiển thị lịch sử và yêu cầu một thao tác ghi nhận lại mới, không dùng lại yêu cầu xác nhận cũ.

Hai upload đồng thời cùng user phải dùng chung khóa và kiểm tra lại sau khi lấy khóa. Hash giống nhau phải trả cùng bản sử dụng được. Đọc/kiểm tra tệp trước khi khóa; không giữ khóa DB trong lúc gọi OCR. Lưu tệp và cleanup phải tôn trọng việc commit có thể thành công dù client mất phản hồi; không xóa tệp đã được DB tham chiếu.

### 4.2. OCR, xem và sửa

Sau worker OCR hoặc parse XML → lưu trường gốc/chuẩn hóa → đánh giá ứng viên → trả REVIEW_REQUIRED kèm kết quả trùng. Khi mở chi tiết hoặc sửa thông tin nhận diện, đánh giá lại theo dữ liệu hiện tại. Trước confirm luôn đánh giá lại dù UI đang hiển thị NONE.

Đối chiếu cả bản nháp lẫn bản đã ghi sổ. Nếu nhiều bản cùng định danh tồn tại: ưu tiên bản có giao dịch hiệu lực; nếu tất cả là nháp, chọn bản gốc theo created_at rồi id. Không để hai bản nháp trỏ vào nhau hoặc cùng bị chặn mà không có bản nào được tiếp tục.

Với SUSPECTED, hiển thị thông tin/ảnh của các ứng viên cùng user. “Cùng hóa đơn” đánh dấu bản mới là trùng và dẫn tới bản gốc; “Khoản chi khác” cho phép confirm có lưu quyết định; “Kiểm tra sau” giữ nháp.

Khi trường định danh, tập ứng viên hoặc phiên bản hóa đơn thay đổi, quyết định bỏ qua cũ không còn hiệu lực. Không gửi một boolean force=true có thể bỏ qua mọi kiểm tra.

### 4.3. Confirm nguyên tử

1. Kiểm tra đăng nhập và Idempotency-Key; cùng key nhưng nội dung khác trả lỗi có mã rõ ràng.
2. Lấy khóa user theo cơ chế sẵn có; tất cả đường ghi/xóa liên quan dùng thứ tự khóa thống nhất.
3. Khóa và đọc lại Invoice, kiểm tra quyền, trạng thái xóa, revision và giao dịch hiện có.
4. Nếu yêu cầu đã thành công: trả kết quả đã tạo, không ghi lại. Nếu giao dịch đó đã bị xóa, trả trạng thái hết hiệu lực để người dùng làm thao tác mới, không tự tái tạo khoản chi.
5. Validation và áp dụng dữ liệu cuối cùng người dùng sửa; tính lại hash nội dung chuẩn hóa/định danh phía server.
6. Kiểm tra trùng trên dữ liệu cuối; chặn EXACT, yêu cầu đối chiếu SUSPECTED chưa có quyết định hợp lệ.
7. Tạo giao dịch qua create_transaction(commit=False); cập nhật số dư theo sổ cái; đặt CONFIRMED; lưu quyết định/lịch sử, idempotency và job ngân sách trong cùng transaction.
8. Commit đúng một nơi. Nếu thất bại, rollback toàn bộ thay đổi tài chính. Lỗi unique/deadlock/timeout được chuyển thành kết quả có thể tải lại/thử lại an toàn, không trả stack trace.

Giữ UX_transactions_invoice. Bổ sung unique index có điều kiện cho (user_id, strong_identity_key) và (user_id, file_sha256) khi CONFIRMED và khóa không null; bản đã ẩn nhưng khoản chi còn vẫn thuộc phạm vi unique. Kiểm tra DDL và dữ liệu cũ trên SQL Server trước khi chốt migration.

Khóa theo user giúp hai invoice_id khác nhau trong cùng tài khoản không đồng thời vượt qua kiểm tra. Unique index là lớp bảo vệ cuối cho định danh chắc chắn. Nghi trùng không được áp unique cứng vì có thể là hai khoản chi hợp lệ.

Nếu tái sử dụng idempotent_money, phải tách commit đang nằm trong confirm ra ngoài để wrapper sở hữu transaction; không chỉ gắn decorator vào hàm hiện tại. Mở rộng phát lại để nhận biết kết quả đã bị xóa và revision lỗi thời mà không đổi hành vi các endpoint tài chính khác ngoài ý muốn.

### 4.4. Xóa và ghi nhận lại

Chọn soft delete metadata Invoice cho đợt này: giữ định danh/liên kết giao dịch để chống trùng; ẩn khỏi danh sách mặc định; ảnh có thể xóa theo job. Không tiếp tục gỡ invoice_id khỏi giao dịch khi chỉ xóa chứng từ.

- Xóa hóa đơn đã ghi sổ: số dư không đổi, CONFIRMED và định danh vẫn được bảo vệ; đánh dấu deleted_at. Thông báo rõ “Xóa ảnh và ẩn hóa đơn; khoản chi vẫn được giữ”.
- Xóa bản nháp: ẩn, không ảnh hưởng tiền; vô hiệu hóa OCR đang chạy bằng trạng thái/phiên bản phù hợp. Worker không được ghi kết quả muộn để phục hồi bản đã xóa.
- Xóa giao dịch: hoàn tác qua sổ cái như hiện có; chuyển hóa đơn về REVIEW_REQUIRED, tăng revision và ghi lịch sử. Bản ẩn vẫn giữ ẩn cho đến khi người dùng chọn khôi phục/ghi nhận lại.
- Ghi nhận lại: thao tác mới, revision mới, Idempotency-Key mới, chạy lại đầy đủ kiểm tra. Yêu cầu cũ gửi muộn không được tái tạo chi phí.
- Xóa ví hoặc xóa vĩnh viễn người dùng: cập nhật luồng purge/FK theo metadata mới; khi khoản chi bị xóa theo luồng hợp lệ thì không để khóa CONFIRMED treo. Không giữ dấu vết người dùng sau purge toàn bộ ngoài chính sách hiện có.

Worker FILE_DELETE hiện kiểm tra storage_key còn được Invoice tham chiếu. Cần tách liên kết storage_key trong cùng transaction enqueue xóa ảnh, giữ file hash và metadata; xử lý cuộc đua khôi phục/tải ảnh mới để không xóa nhầm ảnh đang dùng. Không xóa file trực tiếp trước commit.

## 5. Dữ liệu cần bổ sung

Invoice dự kiến thêm:

- file_sha256 nullable cho dữ liệu cũ; backend bắt buộc tính cho upload mới.
- strong_identity_key nullable, identity_rule_version và các trường chuẩn hóa phục vụ truy vấn có index.
- invoice_time nullable nếu đọc được, cùng loại chứng từ để phân biệt quy tắc VAT/bán lẻ; bổ sung schema OCR/XML tương ứng nếu nguồn có dữ liệu.
- deleted_at, revision số nguyên tăng khi nội dung/trạng thái có ảnh hưởng thay đổi.
- duplicate_of_invoice_id nullable cho liên kết bản trùng đã được giải quyết; server kiểm tra cùng user và tránh vòng lặp. Không lấy liên kết này làm chân lý thay cho kiểm tra live trước confirm.

Thêm lịch sử quyết định hóa đơn gồm user_id, invoice_id, hành động, thời điểm, revision/digest đã đối chiếu, IDs ứng viên và transaction_id dưới dạng snapshot khi cần. Các hành động tối thiểu: ACCEPT_DISTINCT, MARK_DUPLICATE, HIDE, TRANSACTION_DELETED, RECONFIRM. Không ghi toàn bộ ảnh/OCR thô vào log. Xác định FK và purge để lịch sử không ngăn xóa giao dịch/người dùng theo luồng được phép.

duplicate_level và danh sách ứng viên là kết quả đánh giá. Nếu cache để hiển thị danh sách phải lưu thời điểm/phiên bản đánh giá, nhưng confirm luôn tính lại. Tránh một cột is_duplicate cũ khiến cảnh báo tồn tại mãi sau khi người dùng đã sửa đúng.

Indexes cần phục vụ truy vấn trong user theo hash, strong key, ngày/tiền tệ/số tiền và merchant chuẩn hóa; không quét toàn hệ thống cho mỗi bản ghi. Màn hình danh sách đánh giá theo lô, tránh N+1 truy vấn.

## 6. Hợp đồng API đề xuất

Tên trường/mã sau là thiết kế mới, chưa tồn tại đầy đủ trong dự án.

- POST /invoices: nhận source UPLOAD/CAMERA (XML vẫn IMPORT), Idempotency-Key; trả id, status và outcome CREATED/REUSED_DRAFT/ALREADY_CONFIRMED/RESTORE_REQUIRED. 201 khi tạo mới, 200 khi trả bản có sẵn. Không dùng lỗi 409 cho thao tác upload lặp hợp lệ.
- GET /invoices và GET /invoices/{id}: thêm revision, deleted_at phù hợp quyền xem, duplicate_level, reasons, matched_invoice_id/transaction_id, candidates giới hạn và can_override. Không trả ID, tên hay số tiền từ user khác.
- POST /invoices/{id}/duplicate-check: nhận các trường đang sửa để đánh giá trước khi lưu; trả digest và snapshot ứng viên. Endpoint chỉ kiểm tra, không tạo khoản chi. Kết quả không thay thế kiểm tra confirm.
- POST /invoices/{id}/duplicate-resolution: quyết định “Cùng hóa đơn”, liên kết bản gốc cùng user; không tạo tiền. Có revision và chống yêu cầu lặp.
- POST /invoices/{id}/confirm: thêm expected_revision và quyết định “Khoản chi khác” gắn với snapshot hợp lệ; bắt buộc Idempotency-Key. Trả CREATED hoặc ALREADY_CONFIRMED cùng transaction_id. Bộ kiểm tra server không tin can_override do client gửi.
- POST /invoices/{id}/restore: khôi phục nháp có chủ đích; không ghi sổ, không khôi phục ảnh đã xóa nếu không có bytes mới.
- DELETE và batch-delete: đổi sang ẩn/xóa ảnh như mục 4.4, trả kết quả từng mục; cập nhật cả OpenAPI description và nội dung modal.

Mã lỗi nghiệp vụ tối thiểu: INVOICE_DUPLICATE_EXACT, INVOICE_DUPLICATE_REVIEW_REQUIRED, INVOICE_VERSION_CONFLICT, INVOICE_DELETED, IDEMPOTENCY_KEY_REUSED, CONFIRMATION_NO_LONGER_ACTIVE. Lỗi 409 có cấu trúc cho client hiển thị đúng thao tác tiếp theo; validation thông thường giữ 422. Request thiếu key có thể dùng 428 như các thao tác tài chính hiện tại.

Kết quả confirm phải phản ánh dữ liệu cuối cùng đã sửa. Nếu lỗi làm rollback các sửa đổi thì frontend giữ form và quyết định chưa lưu để người dùng không mất công nhập.

## 7. Web và Mobile Web

- InvoiceQueueList: nhãn “Nghi trùng” hoặc “Bản trùng” riêng cạnh trạng thái; có thể lọc để xử lý. Mở bản cũ phải hoạt động cả khi bản đó không nằm trong trang phân trang đang xem.
- InvoiceDetailForm: thay checkbox chung hiện tại bằng khung đối chiếu, lý do và hành động có ý nghĩa. EXACT không có nút bỏ qua; SUSPECTED có “Khoản chi khác”.
- Cho xem/sửa số hóa đơn, MST, ký hiệu và ngày giờ nếu có; đây là dữ liệu cần thiết để người dùng sửa nhận diện sai. Sửa trường liên quan phải xóa quyết định bỏ qua cũ.
- Sau confirm: phân biệt “Đã ghi sổ” với “Hóa đơn này đã được ghi sổ trước đó”; cập nhật danh sách, chi tiết, giao dịch, ví và báo cáo liên quan.
- Upload nhiều tệp: thông báo riêng số mới, số dùng lại và số lỗi; không đếm bản dùng lại như hóa đơn mới.
- Camera chỉ trong Flutter: chụp → xem lại → chụp lại/dùng ảnh. Web chỉ chọn tệp. Cần kiểm chứng bằng điện thoại thật trước nghiệm thu camera; project hiện có Android, chưa có target iOS.
- JPEG/PNG/WEBP trong giới hạn 10 MB theo backend hiện tại. Không mặc định HEIC được hỗ trợ; báo hướng dẫn rõ nếu nhận định dạng này. Chuẩn hóa ảnh phía client nếu có phải chỉ thực hiện một lần cho một lần gửi và giữ nguyên payload khi retry.
- Camera gửi source CAMERA; filename chỉ để hiển thị. Từ chối quyền/hủy camera không tạo bản hóa đơn.
- Giữ Idempotency-Key cho cùng thao tác qua retry mạng/làm mới token; thao tác mới hoặc payload mới dùng key mới. Cô lập bộ nhớ pending theo user và xóa khi đăng xuất để không lẫn tài khoản.
- Đợt này chỉ ghi sổ online. Mất mạng hiển thị chưa xác định/chờ thử lại và tải trạng thái từ backend; không cập nhật số dư thành công lạc quan. Không tự xây chế độ offline đầy đủ.

## 8. Các nhóm file triển khai

Các đường dẫn sau tính từ gốc repository; file mới là đề xuất.

1. Database: một revision phát hành trong capitalflow-database/alembic/versions, cập nhật CURRENT_SCHEMA.md sau kiểm chứng; công cụ preflight/backfill riêng trong capitalflow-database/tools.
2. Model/schema: hoa_don_ai/luu_tru/invoice.py, schemas/invoice.py; model lịch sử quyết định mới và đăng ký metadata ORM.
3. Nhận diện: mở rộng nghiep_vu/phat_hien_trung_lap.py; thêm nghiep_vu/chuan_hoa_hoa_don.py và nghiep_vu/xac_nhan_hoa_don.py để route không gánh toàn bộ quy tắc.
4. API: hoa_don_ai/api/routes.py; giữ module routes.py re-export nếu có, không tạo hai bộ endpoint khác nhau.
5. OCR: dung_chung/tac_vu_nen/trinh_chay.py, hoa_don_ai/ha_tang/gemini.py, invoice_xml.py và schema OCR. Không thay model AI hay nhà cung cấp trong đầu việc này.
6. Sổ cái/idempotency: tai_chinh/giao_dich/so_cai.py, luy_dang.py và model liên quan nếu cần metadata phát lại; giữ một nơi commit và khóa user thống nhất.
7. Vòng đời: hoa_don_ai/nghiep_vu/deletion.py, tai_chinh/vi_tai_khoan/deletion.py, quan_tri/nguoi_dung/vong_doi/dich_vu.py, worker FILE_DELETE/USER_PURGE.
8. User Web: hoa-don-ai/page.tsx, xu-ly/InvoiceTypes.ts, InvoiceUploadZone.tsx, InvoiceQueueList.tsx, InvoiceDetailForm.tsx, InvoiceStatusBadge.tsx; component đối chiếu mới (camera ở Flutter) và CSS trong cùng module.
9. Client API: dung-chung/connect-api/api.ts để xử lý mã lỗi và vòng đời request key, không làm thay đổi ngoài ý muốn các thao tác accounts/transactions hiện có.
10. Test: mở rộng bộ integration/hoadon, operational và bổ sung bài kiểm tra đồng thời trên SQL Server; E2E luồng Web/camera.

Working tree đang có nhiều thay đổi chưa commit, gồm page OCR, API client và sổ cái/giao dịch. Khi triển khai phải đọc diff và tích hợp vào trạng thái hiện tại, không reset hoặc ghi đè phần đang làm. Trước khi viết Next.js đọc tài liệu cục bộ theo frontend/user-web/AGENTS.md.

## 9. Thứ tự triển khai và đầu ra từng chặng

### Chặng A — chốt dữ liệu và hợp đồng

Chốt quy tắc EXACT/SUSPECTED, state transition, cấu trúc API, semantics xóa và bộ mẫu hóa đơn. Đầu ra: ví dụ request/response, các invariant và fixture test. Không thiết kế dựa riêng vào một hóa đơn K-Box.

### Chặng B — migration và chuyển đổi dữ liệu

Kiểm tra Alembic current/head và alembic check; viết migration cộng thêm schema, script backfill có resume/dry-run. Kiểm chứng trên DB SQL Server tạm trước khi áp dụng DB chính, theo capitalflow-database/README.md.

Backfill hash cho tệp còn tồn tại, chuẩn hóa trường đã có; file mất thì để null có thống kê, không bịa hash. Truy vấn các nhóm trùng đã CONFIRMED, các hóa đơn CONFIRMED không có giao dịch và giao dịch OCR đã mất liên kết. Không tự xóa/gộp tiền hoặc đổi hóa đơn thật thành chưa ghi sổ. Các giao dịch bị gỡ liên kết trước đây không thể khôi phục chắc chắn chỉ từ mô tả và số tiền.

Chỉ bật unique index sau khi dữ liệu xung đột đã được xử lý bằng quy trình đối soát riêng. Nếu còn nhóm xung đột thì chưa được coi là hoàn thành rollout; báo cáo rõ nhóm cần xử lý, không âm thầm bỏ qua index. Việc xử lý dữ liệu tài chính thật là quyết định riêng, không nằm trong backfill tự động.

Đầu ra: migration chạy được, báo cáo trước/sau số hóa đơn/giao dịch/tổng số dư, không thay đổi tiền bởi migration.

### Chặng C — backend và toàn vẹn ghi sổ

Xây chuẩn hóa/đối chiếu, upload dùng lại, xác nhận có kiểm tra lại/khóa/idempotency, quyết định nghi trùng, vòng đời xóa/khôi phục; tích hợp worker và XML. Hoàn thiện kiểm thử API trước khi giao diện dựa vào mã lỗi mới.

Đầu ra: gọi trực tiếp API vẫn không vượt được chống trùng bằng cách bỏ checkbox hoặc đổi account_id.

### Chặng D — Web và Flutter

Cập nhật types/client, cảnh báo/đối chiếu, nhãn, chọn bản cũ, hiển thị xóa và camera. Tích hợp retry và giữ form khi conflict. Kiểm tra màn hình nhỏ lẫn desktop.

Đầu ra: hoàn thành các luồng người dùng mà không cần đọc mã lỗi kỹ thuật.

### Chặng E — nghiệm thu

Unit/integration + SQL Server concurrency + Web E2E + điện thoại thật. Lưu bằng chứng cho working tree/commit hiện tại, không dùng báo cáo QA cũ làm chứng nhận.

### Chặng F — phát hành

Backup và preflight → schema mở rộng → backfill/đối soát → unique constraints → backend/worker/client tương thích → bật tính năng → smoke test bằng dữ liệu thử. Trong khoảng chuyển phiên bản phải tạm dừng ghi hóa đơn hoặc dùng cờ kiểm soát để không còn instance cũ ghi theo logic cũ. Không cho worker cũ cập nhật lại hóa đơn đã ẩn theo schema mới.

Nếu rollback ứng dụng: tạm dừng confirm thay vì quay về backend cũ có thể bỏ qua kiểm tra; giữ schema/lịch sử và các giao dịch đã ghi. Không downgrade phá dữ liệu chỉ để khôi phục giao diện. Theo dõi số upload dùng lại, cảnh báo, hard-block, quyết định bỏ qua, conflict/deadlock và độ trễ, không ghi nội dung hóa đơn vào log.

## 10. Bộ nghiệm thu tối thiểu

### Nhận diện và quyền riêng tư

- T01: hóa đơn mới → đúng một giao dịch và đúng một lần thay đổi số dư.
- T02: cùng bytes đổi tên file khi nháp → trả cùng invoice_id, không tăng số bản nháp/OCR job.
- T03: cùng bytes sau ghi sổ → giao dịch cũ, số dư không đổi.
- T04: cùng filename nhưng ảnh khác → không tự coi trùng.
- T05: chụp lại ảnh khác bytes, định danh đầy đủ khớp → chặn lần ghi sổ thứ hai.
- T06: cùng quán/ngày/tiền nhưng hai lần mua → SUSPECTED, xác nhận khoản chi khác hợp lệ thì có hai khoản chi.
- T07: OCR thiếu/sai số hóa đơn → có thể sửa; đánh giá lại đúng, không dùng quyết định cũ.
- T08: cùng số hóa đơn ở nhà bán/ký hiệu/năm khác nhau → không hard-block chỉ vì số giống.
- T09: XML và ảnh của cùng hóa đơn → đối chiếu được khi định danh đủ.
- T10: hai user cùng file/nội dung xác nhận trước-sau và đồng thời → mỗi user có một giao dịch riêng; không lộ ứng viên của nhau.
- T11: giả mạo matched_invoice_id/transaction_id của user khác → bị từ chối, không lộ dữ liệu.
- T12: cùng user đổi ví thanh toán khi tải lại → vẫn chống trùng trên toàn sổ cá nhân.

### Đồng thời và retry

- T13: hai upload cùng user/cùng bytes đồng thời → một bản nháp dùng được.
- T14: hai confirm cùng invoice_id, cùng hoặc khác key → một giao dịch.
- T15: hai invoice_id khác nhau nhưng cùng strong key, xác nhận đồng thời → chỉ một giao dịch hiệu lực.
- T16: Web và Mobile cùng xác nhận → kết quả giống T14/T15.
- T17: mất phản hồi sau DB commit rồi retry → trả giao dịch cũ, không thay đổi tiền lần hai.
- T18: cùng Idempotency-Key nhưng payload khác → lỗi xung đột, không tạo tiền.
- T19: lỗi giữa tạo giao dịch và commit → không có giao dịch/số dư/trạng thái CONFIRMED dang dở.
- T20: ứng viên mới xuất hiện hoặc dữ liệu bị sửa sau khi người dùng bỏ qua cảnh báo → yêu cầu đối chiếu lại theo snapshot mới.

T13–T20 cần test có nhiều kết nối thật, điểm đồng bộ để tạo race và kiểm tra kết quả DB sau cùng trên SQL Server tạm; test tuần tự hoặc SQLite không thay thế bằng chứng này.

### Vòng đời, camera và hồi quy

- T21: xóa ảnh/hóa đơn đã ghi sổ rồi upload lại → vẫn chặn ghi trùng, khoản chi cũ còn.
- T22: xóa khoản chi OCR → số dư được hoàn tác theo sổ cái, hóa đơn có thể ghi lại bằng thao tác mới.
- T23: request confirm cũ gửi muộn sau T22 → không tự tạo lại khoản chi.
- T24: xóa khi OCR đang chạy → kết quả worker đến muộn không làm sống lại bản đã xóa.
- T25: batch-delete/khôi phục/xóa ví/purge user → FK, hash, file và khóa duy nhất nhất quán.
- T26: retry OCR bản FAILED hoặc tải lại bản PROCESSING → không sinh job dư ngoài retry hợp lệ.
- T27: camera Android/iOS → xem lại, chụp lại, hủy, từ chối quyền, ảnh xoay, tệp quá lớn/HEIC; lỗi dễ hiểu, không tạo nháp khi hủy.
- T28: mất mạng/refresh token/đăng xuất đổi user → không lẫn request key hoặc hiện thành công giả.
- T29: migration với bản cũ thiếu file, có nhóm đã ghi trùng → báo cáo đúng, không tự đổi tiền, không bật unique sai.
- T30: chức năng sổ cái, ví, ngân sách, báo cáo, XML, OCR hàng loạt và quyền admin tiếp tục hoạt động.

Điều kiện hoàn thành: vượt các test bắt buộc, không có thay đổi tiền do migration, không phát sinh giao dịch trùng trong những tình huống nhận diện chắc chắn, cho phép hai lần mua thật khi chỉ nghi trùng, không lộ thông tin xuyên user, Web/camera dùng chung quy tắc server. Sai hoặc thiếu OCR vẫn là giới hạn cần hiển thị trung thực.

## 11. Quyết định triển khai đề xuất

Thực hiện theo thứ tự: dữ liệu/API → backend và ghi sổ → vòng đời xóa → Web/camera → SQL Server concurrency và nghiệm thu → rollout. Có thể chia thành các nhóm thay đổi để review, nhưng không phát hành nửa chừng khi chưa có bảo vệ backend hoặc chưa giữ dấu vết sau xóa.

Flutter đã được đưa vào phạm vi bổ sung theo xác nhận của người dùng, dùng cùng API, revision và Idempotency-Key. Không triển khai sổ chung hoặc gắn hóa đơn vào khoản chi nhập tay trong đợt này.
