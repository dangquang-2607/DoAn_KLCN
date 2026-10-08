# Báo cáo kiểm thử nghiệm thu CapitalFlow

> **Cập nhật sau lượt kiểm thử ban đầu:** xem [Bổ sung nghiệm thu](BO_SUNG_NGHIEM_THU.md). UI-02 đã sửa/kiểm thử lại; 4 ca SQL Server cô lập đã đạt; bổ sung luồng UI và xác nhận email đến inbox. Nội dung bên dưới giữ nguyên như biên bản mốc ban đầu, không dùng các trạng thái “chưa chạy/chưa xác nhận” bên dưới thay cho bản bổ sung.

Ngày kiểm thử: 08/10/2026, múi giờ Asia/Saigon. Phạm vi: backend, user-web, admin-web hiện có trong workspace. Đây là kết quả thực thi kiểm thử, không phải chứng nhận an toàn tuyệt đối hoặc nghiệm thu toàn bộ đề tài.

## 1. Kết luận

**Chưa nên chốt bản bảo vệ là “đã hoàn thiện toàn bộ”.**

- Bộ hồi quy hiện tại: **92/92 ca đạt**, không bỏ qua ca nào, 1 cảnh báo deprecation của Starlette TestClient. Có kiểm thử mã nghiệp vụ thật, với SQLite cô lập và nhà cung cấp ngoài giả lập ở bộ tự động.
- Lint user/admin, TypeScript trên bản user QA và build user/admin đều exit 0. Build không thay thế kiểm thử vận hành bản triển khai.
- CRUD giao dịch, chống gửi lặp cùng khóa, quyền sở hữu dữ liệu, token hết hạn/quyền admin, xử lý worker thành công/thất bại: đạt trong các tình huống đã chạy ở mục 3.
- OCR thật: một hóa đơn tổng hợp không chứa thông tin cá nhân được worker xử lý thành công; các trường đối chiếu khớp mẫu.
- Email thật: gửi đúng một email được người dùng cho phép; worker `DONE`, SMTP nhận gửi và log `SENT`. Chưa có xác nhận thư đến inbox từ người nhận.
- Đã mở 9 màn hình chính user và 8 màn hình chính admin ở desktop/điện thoại, cùng trang đăng nhập. Có 41 ảnh bằng chứng. Đây là rà soát theo màn hình và các tương tác được liệt kê, **không đồng nghĩa đã thử hết mọi trạng thái/nút/hộp thoại**.
- Hai lỗi responsive đã tái hiện: đăng nhập admin không sử dụng được theo thao tác thông thường ở 390px; bộ chọn kỳ báo cáo admin mất chữ ở 768px. Cần sửa và kiểm thử lại trước khi nghiệm thu giao diện.
- Chưa thực thi cạnh tranh đồng thời trên SQL Server, chưa nghiệm thu toàn bộ mobile Flutter, chưa đo độ chính xác OCR trên tập hóa đơn đại diện và chưa kiểm thử đầy đủ môi trường triển khai thật.

Không sửa mã ứng dụng trong đợt đánh giá này. Chỉ thêm bộ kiểm thử, script cô lập và bằng chứng trong thư mục QA.

## 2. Môi trường và độ tin cậy của bằng chứng

- API QA: `127.0.0.1:8018`, mã ứng dụng hiện tại, SQLite riêng `ui-fixture.sqlite`, upload riêng `ui-uploads/`.
- User-web QA: `localhost:3018`; bản sao `src/` và tài nguyên frontend, dùng thư viện đã cài qua junction. Không đụng server Next đang chạy của người dùng ở 3010. Chỉ điều chỉnh `turbopack.root` trong cấu hình bản QA để dùng thư viện chung.
- Admin-web QA: `localhost:5188`, trỏ API QA.
- Hai tài khoản tổng hợp: `qa-user@example.com` và `qa-admin@example.com`. Không dùng giao dịch của người dùng thật.
- Suite pytest dùng SQLite riêng từng ca, khóa JWT và khóa mã hóa QA, chặn kết nối socket ngoài. Audit writer và email gửi thật bị thay bằng test double mặc định; ca kiểm thử email riêng khôi phục EmailService thật nhưng giả lập SMTP transport.
- Live email và live OCR dùng worker thật qua `run_once`, nhưng job/log/hóa đơn được ghi vào SQLite trong bộ nhớ. Không rút job từ hàng đợi thật, không ghi CSDL sản xuất. Cấu hình SMTP thật chỉ được đọc để gửi email đã được cho phép; khóa dịch vụ không được ghi trong báo cáo.
- UI QA không tự chạy worker; vì vậy số liệu giám sát OCR/email trong ảnh QA không phải log của hai ca live độc lập.
- `evidence-manifest.json` lưu SHA-256 nguồn lúc chốt bằng chứng và Git HEAD tham chiếu. Working tree đang có thay đổi chưa commit; HEAD **không đại diện đầy đủ** cho mã đã thử. Đối chiếu nguồn user-web với bản QA: không có khác biệt ở các file nguồn được kiểm tra khi thu thập manifest.
- Kích thước đã thử: desktop chủ yếu 1280×800, điện thoại 390×844; tablet 768×1024 cho giao dịch user và phân tích admin. Không suy rộng sang tất cả trình duyệt, thiết bị hay breakpoint.

## 3. Năm luồng nghiệp vụ người dùng yêu cầu

### TC-MONEY — Thêm, sửa, xóa giao dịch và số dư: ĐẠT trong ca đã chạy

Ca tự động: `test_crud_balance_and_replay[INCOME/EXPENSE]`, `test_normal_transaction_lifecycle`, `test_expense_can_move_wallets_and_change_type`, `test_failed_transfer_preserves_balances`.

Ví ban đầu 1.000; thu 100 → 1.100; sửa thành 250 → 1.250; xóa → 1.000. Chi có biến động ngược lại: 900 → 750 → 1.000. Gửi lại yêu cầu tạo cùng khóa không cộng/trừ thêm. Có ca đổi ví, đổi loại giao dịch và rollback khi lỗi lưu bản ghi chống lặp.

Trên UI: thêm khoản chi 12.345, sửa thành 23.456; hàng giao dịch và số dư cập nhật. Sau các dữ liệu seed và chuyển nội bộ 10.000, UI hiển thị Tiết kiệm QA 1.966.544, Ví tiền mặt QA 5.825.000; tổng 7.791.544. Xóa đã được chạy qua API trong suite, không thực hiện xóa trên UI trong lần rà này.

### TC-REPLAY — Bấm/gửi chuyển tiền nhiều lần: ĐẠT đối với replay đã thử

`test_transfer_repeat_20_times_one_pair`: 20 POST tuần tự, cùng `Idempotency-Key`, cùng payload → cùng phản hồi 201, đúng 2 bản ghi đối ứng, số dư A 1.000 → 900 và B 200 → 300. Cùng khóa nhưng đổi số tiền → 409, số dư không đổi thêm.

UI: double-click nút xác nhận chuyển 10.000 một lần; quan sát đúng một cặp có Ref `7D8BDF2C`, không thấy cặp trùng trong lần thử đó.

`test_transfer_current_paired_delete_restores_both_wallets`: không cho sửa riêng một vế; xóa một vế qua API xóa cả cặp và hoàn nguyên hai ví. Chuyển nội bộ không làm tăng doanh thu/chi phí thống kê.

**Giới hạn:** 20 yêu cầu tuần tự và một lần double-click không chứng minh tính đúng khi nhiều kết nối cạnh tranh đồng thời trên SQL Server. Chưa chạy stress/concurrency trên DB triển khai.

### TC-OWNER — Không truy cập dữ liệu người khác: ĐẠT với endpoint đã thử

`test_two_users_cannot_read_or_mutate_each_others_data`: hai user độc lập. Danh sách không lẫn ví/giao dịch; sửa/xóa ví và giao dịch của user khác → 404; đọc hóa đơn, tệp, dòng hàng, kích hoạt OCR và xóa hóa đơn người khác → 404. Tham chiếu ví không thuộc quyền trong chuyển tiền → 400 theo hợp đồng API hiện tại; tiền chủ ví không đổi.

Các ca danh mục/ngân sách còn kiểm tra quyền sở hữu, lịch sử và phạm vi dữ liệu. Không được diễn giải thành pentest toàn bộ hệ thống hoặc đã thử tất cả endpoint.

### TC-AUTH — Hết phiên và quyền admin: ĐẠT ở backend đã thử

- Access token hết hạn → 401; refresh token hết hạn → 401; refresh đã logout → 401.
- JWT có claim ADMIN nhưng tài khoản DB là USER → 403.
- Admin hợp lệ gọi API quản trị → 200; hạ role trong DB, giữ token cũ → 403.
- Có ca đổi mật khẩu/OTP thu hồi token, khóa/mở khóa tài khoản không khôi phục phiên cũ, refresh rotation và token sai loại.
- UI: đăng nhập và đăng xuất user/admin thành công trên luồng đã thử; logout đưa về login.

Chưa chạy hết luồng frontend chờ access token tự hết hạn rồi refresh, nhiều tab cùng refresh, mất mạng giữa refresh hoặc phục hồi ứng dụng sau đóng trình duyệt. Đăng nhập admin mobile có lỗi UI-01, dù quyền backend đúng.

### TC-WORKER — OCR/email và sự cố dịch vụ ngoài: ĐẠT trong phạm vi dưới đây

Suite gọi `run_once` thật với provider giả lập:

- OCR trả dữ liệu hợp lệ → job `DONE`, invoice `REVIEW_REQUIRED`, tổng tiền/dòng hàng được ghi đúng.
- OCR timeout hoặc tổng tiền âm → thử lại theo giới hạn; sau 3 lần job `DEAD`, invoice `FAILED`.
- SMTP thành công → `DONE`/`SENT`; timeout hoặc thiếu cấu hình → retry rồi `DEAD`/`FAILED`. Chi tiết lỗi nhạy cảm không bị đưa nguyên văn vào log email.
- Thêm ca rollback outbox, payload mã hóa, lane chỉ nhận đúng loại job, worker chết và hết retry, lease cũ không được hoàn tất lease mới.

Ca live OCR (`live-ocr-result.json`):

- Nguồn: `synthetic-invoice.png`, cửa hàng QA STORE, ngày 08/10/2026, Notebook 2 × 50.000, trước thuế 100.000, VAT 10.000, tổng 110.000 VND.
- Worker `DONE`, 1 attempt, invoice `REVIEW_REQUIRED`; tên cửa hàng, ngày, số lượng, đơn giá, thành tiền, subtotal, VAT và tổng khớp mẫu.
- Provider thật không bị mock. Chỉ một mẫu tổng hợp; chưa có tỷ lệ chính xác đại diện, chưa thử hóa đơn mờ/nghiêng/nhiều trang hay mọi loại nhà cung cấp.

Ca live SMTP (`live-email-result.json`):

- Gửi đúng một email tới địa chỉ người dùng đã chỉ định, tiêu đề `[CapitalFlow QA] Kiem thu nghiem thu 08-10-2026`.
- Worker `DONE`, attempts 1, error null, log `SENT`.
- Điều này chứng minh SMTP chấp nhận gửi; chưa chứng minh inbox delivery hoặc không vào spam. Script có marker chống vô tình gửi lại.

## 4. Lỗi đã tái hiện

### UI-01 — Ưu tiên cao: đăng nhập admin bị cắt trên điện thoại

Tái hiện: viewport 390×844 → mở mới `/login` admin, không có session; tải lại trang vẫn lỗi. Phần đèn nằm lệch ra trái; nút dây kéo bật đèn ở ngoài viewport nên không thể làm hiện form theo thao tác được hướng dẫn.

Đo DOM: SVG đèn x = -115, rộng 220; hình tròn đầu dây x = -52, rộng 14. Form từ x ≈ 233 đến x ≈ 517 trong viewport rộng 390. Toàn trang không có scroll ngang vì bị cắt, nên chỉ đo `scrollWidth` sẽ bỏ sót lỗi này.

Ảnh: [admin-login-mobile-reloaded.jpg](screenshots/admin-login-mobile-reloaded.jpg). Số đo: [ui-admin-login-finding.json](ui-admin-login-finding.json).

Nơi cần xem khi sửa: `frontend/admin-web/src/chuc-nang/dang-nhap/Login.jsx`, `thanh-phan/LampAnimation.jsx`, `thanh-phan/LoginForm.jsx`. Đề xuất: bố cục xếp dọc/đèn thu gọn ở mobile và lối mở form tiếp cận được bằng bàn phím. Chưa triển khai sửa.

Tiêu chí retest: 320/360/390/430px mở mới login; dây/nút thay thế ở trong viewport; form và nút submit đầy đủ; đăng nhập được; desktop giữ hoạt ảnh; thử bàn phím và reduced motion.

### UI-02 — Ưu tiên vừa: ô chọn tháng admin bị co còn 36px ở tablet

Tái hiện: đăng nhập admin → `/system-analytics` → viewport 768×1024, sidebar mở. Ô “Chọn kỳ phân tích” có width 36px, height 40px, font 13px; tên tháng không đọc được. Chọn tháng 09/2026 vẫn cập nhật state, nên đây là lỗi trình bày, không phải API không đổi kỳ.

Ảnh: [admin-analytics-tablet.jpg](screenshots/admin-analytics-tablet.jpg). Số đo: [ui-tablet-select-finding.json](ui-tablet-select-finding.json).

CSS liên quan: `frontend/admin-web/src/chuc-nang/phan-tich-van-hanh/CSS/workspace-live.css`, container breakpoint 550px áp dụng `flex:1; width:0` cho select trong layout hẹp. Đây là điểm cần kiểm tra khi sửa, chưa xác nhận là nguyên nhân duy nhất.

Tiêu chí retest: tên kỳ đọc được ở 768/820/1024px với sidebar mở/đóng; không đè nút trước/sau/lịch; đổi kỳ vẫn đúng số liệu.

### Quan sát cần theo dõi, không gộp thành lỗi đã nghiệm thu

- Nhãn “Đến 08/10/2026” trong báo cáo user có chữ rất nhỏ ở ảnh di động; cần chuẩn hóa tiêu chí khả đọc rồi đánh giá.
- UI upload/FAQ liệt kê JPG, PNG, WEBP, PDF nhưng backend đã xử lý XML ở test; tài liệu sử dụng và giao diện cần thống nhất loại tệp hỗ trợ.
- Preview XML từng quan sát trống trong trình duyệt kiểm thử; chưa tách được giới hạn trình xem với lỗi ứng dụng nên chưa kết luận.
- Mã login admin đặt `LOCKOUT_SECONDS = 30` nhưng thông báo có câu “15 phút”. Đây là bất nhất đọc từ mã, chưa chạy luồng 5 lần nhập sai để xác nhận toàn bộ trải nghiệm.

## 5. Phạm vi kiểm tra trực quan và tương tác

User desktop và mobile: Tổng quan, Ví & tài khoản, Giao dịch, Ngân sách, Hóa đơn AI, Báo cáo tài chính, Danh mục, Cài đặt & bảo mật, Trung tâm hỗ trợ. Trang login đã quan sát và thử đăng nhập/logout; form đăng ký chưa hoàn tất kiểm chứng trong lần tiếp tục do phiên trình duyệt kết thúc.

Admin desktop và mobile: Bảng điều khiển, Người dùng, Danh mục hệ thống, Phân tích vận hành, Giám sát hóa đơn, Nhật ký quản trị, Email & cấu hình, Cài đặt & bảo mật. Login desktop chạy được sau kéo dây; login mobile lỗi UI-01.

Đã thao tác: menu di động, chuyển route, thêm/sửa khoản chi, double-click chuyển tiền, validation form rỗng, mở/hủy modal, tìm kiếm giao dịch (lọc đúng 1 dòng “QA thao tác giao diện”), đổi kỳ báo cáo, FAQ đóng/mở, đăng nhập/logout. Hoạt ảnh chuyển trang/modal và bật đèn desktop quan sát hoạt động trong mẫu thử.

Chưa chứng nhận: mọi animation ở mọi trạng thái; FPS/độ mượt định lượng; reduced motion, keyboard-only/screen reader; toàn bộ popover/datepicker/tooltip; tất cả thao tác admin tạo/khóa/xóa/đổi quyền trên UI; mọi breakpoint; Safari/Firefox; thiết bị cảm ứng thật; theme tối/sáng nếu bổ sung sau này. Không dùng 41 ảnh để thay thế các ca tương tác chưa chạy.

Không thấy tràn ngang toàn trang ở 17 màn hình chính tại 390px. Bảng giao dịch rộng hơn vùng nhìn và cần cuộn ngang; điều này không tự động là lỗi, nhưng các cột quan trọng bị khuất ở ảnh ban đầu. UI-01 minh họa vì sao không tràn ngang vẫn có thể mất nội dung.

## 6. Truy vết yêu cầu đề tài → chức năng → kiểm thử → kết quả

Các tên test dưới đây nằm trong `tests/`; kết quả máy đọc được trong `results-current.xml`. “Đạt” chỉ áp dụng tiêu chí nêu ở từng mục, không phải toàn bộ phân hệ.

1. **Khảo sát nhu cầu quản lý tài chính và phương pháp OCR:** đây là yêu cầu tài liệu nghiên cứu; chưa có bằng chứng khảo sát được đánh giá trong đợt chạy này. Trạng thái: chưa nghiệm thu tài liệu khảo sát.
2. **Phân tích/thiết kế hệ thống web và mobile:** kiểm thử hiện thực web/API không thay cho việc duyệt UML, ERD, use case hoặc kiến trúc mobile. Trạng thái: chưa nghiệm thu đầy đủ tài liệu thiết kế.
3. **Quản trị người dùng:** API admin, quản lý role/ban/session; `test_admin_permission_uses_database_not_claim`, `test_ban_revokes_sessions_after_unban`, `test_setup_session_is_restricted_and_consumed`. Đạt các ràng buộc quyền/phiên đã thử; UI danh sách đã xem; toàn bộ vòng đời quản trị UI chưa chạy hết.
4. **Quản lý danh mục thu/chi:** user danh mục riêng, admin danh mục chung; `test_category_crud_owner_and_history`, `test_admin_manages_and_reorders_global_categories`, `test_category_type_must_match_transaction`. Đạt các ca CRUD/phạm vi/loại và lịch sử trong suite; ảnh desktop/mobile có bằng chứng hiển thị.
5. **Quản lý ví/tài khoản ngân hàng:** tạo tài khoản/số dư, CRUD và chuyển nội bộ; TC-MONEY, TC-REPLAY, TC-OWNER. Đạt ví và sổ cái đã thử. Liên kết ngân hàng demo không phải kết nối ngân hàng thật đã nghiệm thu.
6. **Quản lý giao dịch thu/chi:** TC-MONEY; UI tạo/sửa/tìm kiếm; `test_create_and_update_reject_invalid_amount_through_api`. Đạt ca thực thi; delete UI và cạnh tranh SQL Server còn thiếu.
7. **Ngân sách theo tháng/danh mục:** `test_unique_scopes_and_duplicate_budget`, `test_budget_update_currency_date_and_owner_checks`, `test_transfer_does_not_trigger_false_budget_email`. Đạt ràng buộc trùng/phạm vi/tiền tệ/ngày/quyền và không cảnh báo sai vì chuyển tiền; chưa đủ chuỗi E2E vượt ngưỡng → worker → email inbox, hoặc mọi trường hợp ngân sách lặp.
8. **Hóa đơn điện tử và hóa đơn giấy:** `test_structured_invoice_xml_is_parsed_without_ocr`, `test_user_can_replace_own_ocr_items`, `test_confirmed_invoice_items_are_immutable`, `test_invoice_confirm_retry_returns_same_transaction`, `test_invoice_failure_rolls_back_all_money`; thêm live OCR mẫu ảnh. Đạt các ca đã chạy; chưa kiểm hết UI preview và tất cả định dạng.
9. **Báo cáo/thống kê/trực quan:** `test_custom_range_analytics_and_full_csv_export`, kiểm tra chuyển nội bộ không bóp méo báo cáo, UI đổi kỳ và biểu đồ. Đạt dữ liệu thử/API; giao diện có UI-02, chưa nghiệm thu mọi phép tổng hợp hoặc dữ liệu lớn.
10. **Ứng dụng mobile: ghi giao dịch, chụp/tải hóa đơn, lịch sử, ngân sách, nhắc chi tiêu:** chưa chạy ứng dụng Flutter trong đợt này. Responsive web không thay thế bằng chứng mobile native. Trạng thái: chưa có kết quả thực thi để nghiệm thu các yêu cầu này.
11. **OCR: tên cửa hàng, ngày, danh sách sản phẩm, tổng tiền, VAT:** live mẫu QA khớp đầy đủ các trường; test worker mock và XML bổ trợ. Đạt smoke test một mẫu; chưa đủ đánh giá độ chính xác trên tập dữ liệu đại diện.
12. **Tự phân loại giao dịch:** `test_keyword_suggestion_is_auto_applied_and_auditable`, `test_user_history_learns_from_manual_category_correction`, `test_unknown_description_remains_uncategorized`. Đạt ví dụ từ khóa/lịch sử và giữ chưa phân loại khi không đủ thông tin; chưa có chỉ số chất lượng tổng quát.
13. **Kiểm thử và đánh giá hệ thống:** đã cung cấp suite 92 ca, ca live, ảnh, lỗi tái hiện và hồ sơ truy vết này. Còn thiếu concurrency SQL Server, triển khai, hồi quy sau sửa UI và các phần chưa thử được liệt kê.
14. **Công nghệ ReactJS, Flutter, Python và CSDL theo đề tài:** nguồn web hiện tại dùng React (user TypeScript/Next, admin JavaScript/Vite); backend Python. SQLite chỉ là môi trường cô lập của đợt kiểm thử, không được trình bày thay cho CSDL triển khai của đồ án. Chưa đánh giá thực thi Flutter hoặc triển khai DB trong báo cáo này.

## 7. Ba khác biệt với bộ test cũ

Lần baseline có 79 ca: 76 đạt, 3 thất bại. Lưu nguyên kết quả ở `results-baseline.xml`, không xóa dấu vết. Sau đối chiếu mã hiện tại, cập nhật kỳ vọng kiểm thử và thêm 13 ca acceptance; tổng cuối 92 đạt.

1. Test cũ kỳ vọng cấm DELETE riêng giao dịch chuyển tiền (409). Mã hiện tại cho xóa cả cặp (204). Thêm test xác nhận cả cặp biến mất, số dư cả hai ví khôi phục và không ảnh hưởng báo cáo sai. Không nới lỏng ràng buộc “không tạo/mất tiền”.
2. Test cũ kỳ vọng không xóa adjustment. Mã/UI hiện tại cho xóa và điều chỉnh lại số dư. Kỳ vọng được đổi sang kiểm tra số dư khớp sổ cái sau xóa. Tên test legacy `test_adjustment_is_immutable_and_reconciles` còn cũ; không dùng tên đó để tuyên bố adjustment hoàn toàn bất biến. Chính sách xóa adjustment cần được ghi rõ trong tài liệu nghiệp vụ.
3. XML trước kỳ vọng `source=XML`; hiện tại `source=IMPORT`. Chỉ đổi kỳ vọng nhãn nguồn; giữ kiểm tra dữ liệu hóa đơn và dòng hàng.

Đây là xác minh theo hành vi hiện tại, không phải phê duyệt ngầm mọi thay đổi nghiệp vụ. Trước bảo vệ cần thống nhất quy tắc xóa cặp chuyển tiền và adjustment trong tài liệu.

## 8. Điều kiện trước khi chốt bản bảo vệ

1. Sửa UI-01/UI-02 rồi chạy lại đúng bước tái hiện, desktop và mobile; bổ sung ảnh sau sửa.
2. Chạy cạnh tranh cùng khóa/khác khóa trên SQL Server staging tách biệt, đối chiếu ledger và số dư; thử rollback/deadlock theo môi trường thực.
3. Hoàn thành các ca UI chưa thử: refresh hết hạn/mất mạng, vòng đời admin, upload-preview-confirm hóa đơn, cảnh báo ngân sách tới inbox; không gửi thêm email nếu chưa được cho phép.
4. Ghi nhận người nhận đã nhận email ở inbox/spam. Nếu chưa nhận, kiểm tra delivery trước khi gọi email E2E hoàn tất.
5. Lập tập hóa đơn có đáp án và đo chính xác từng trường; bổ sung kiểm thử Flutter và bằng chứng tài liệu theo các mục chưa nghiệm thu.
6. Đóng băng một commit/release có cấu hình triển khai phù hợp, chạy suite/build/smoke lại trên bản đó; không gắn chứng nhận vào một working tree còn thay đổi.

## 9. Cách trình bày trước hội đồng

Có thể nói: “Nhóm đã thực thi 92 ca hồi quy trên môi trường cô lập, kiểm thử replay chuyển khoản, quyền sở hữu dữ liệu, token và worker; đã chạy OCR thật trên một hóa đơn mẫu và SMTP thật một email. Báo cáo ghi riêng phạm vi, lỗi UI và điều kiện chưa nghiệm thu.”

Không nên nói: “Hệ thống không còn lỗi”, “đảm bảo an toàn tuyệt đối”, “OCR chính xác 100%”, hoặc “toàn bộ giao diện/mobile đã hoàn thiện” từ các bằng chứng hiện tại.

Xem [README kiểm thử](README.md) để chạy lại; [manifest](evidence-manifest.json), [kết quả pytest](results-current.xml), [SMTP](live-email-result.json), [OCR](live-ocr-result.json), [quan sát UI](ui-observations.json), [kiểm tra tĩnh](static-checks.json) là các bằng chứng kèm theo.
