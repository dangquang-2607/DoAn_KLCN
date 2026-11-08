# Dọn mã và đánh giá phạm vi demo — 07/11/2026

Kết luận: có thể chốt đợt dọn admin/user-web và chuyển sang phần tiếp theo của
đồ án theo phạm vi hiện có. Không phát hiện lỗi chặn trong lượt hồi quy này.
Kết luận phục vụ demo khóa luận; không phải cam kết hệ thống tài chính thực tế
không bao giờ có lỗi, chứng nhận bảo mật hoặc kết quả chịu tải production.

## Vấn đề nhật ký và thay đổi đã thực hiện

Ba mục trước đây là ảnh chụp dữ liệu trước thay đổi, sau thay đổi và thông tin
bổ sung của cùng một sự kiện. Chúng không phải ba báo cáo lỗi. Middleware chỉ
ghi tên thao tác, đường dẫn và kết quả HTTP, không đọc dữ liệu trước/sau; nó
luôn tạo `query_keys: []` ngay cả khi không có tham số. Các action nghiệp vụ còn
ghi thêm sự kiện, khiến cùng một thao tác admin có hai dòng gần giống nhau.

Đã sửa:

- Thao tác quản trị ghi trạng thái trước/sau cần thiết: khóa/mở khóa, vai trò,
  danh mục, trạng thái phiếu hỗ trợ. Cấp lại mật khẩu, gửi thử, SMTP và retry
  OCR ghi kết quả an toàn, không lưu mật khẩu/OTP hoặc nội dung tài chính cá nhân.
- Gắn bối cảnh HTTP và mã yêu cầu vào sự kiện nghiệp vụ. Thao tác thành công
  có chi tiết được ghi một lần; lỗi/rollback vẫn có sự kiện yêu cầu riêng.
- Bỏ metadata rỗng. UI chỉ hiện mục có dữ liệu, diễn giải trường/trạng thái
  bằng tiếng Việt và giữ đúng giá trị `false`/`0`.
- Nhật ký cũ không có snapshot được giải thích là chỉ ghi thao tác/kết quả.
  Không tự tạo dữ liệu trước/sau cho lịch sử đã qua.
- Bổ sung nhãn thu chi, ngân sách, ví và phiếu; sửa nhãn đọc QR bị diễn giải
  nhầm thành đối chiếu hóa đơn.

Đã quan sát trên trình duyệt: tài khoản `Có thể truy cập → Đã khóa`, thu hồi
phiên; phiếu `Chờ admin gốc → Đã xử lý`. Một sự kiện đăng nhập không có snapshot
không còn ba mục rỗng. Kiểm thử cũng xác nhận rollback không để lại snapshot
thành công giả, thông tin nhạy cảm vẫn được che.

## Dọn user-web

- Kiểm kê toàn bộ `src`: 129 còn 127 file, 103 còn 101 file TypeScript/TSX;
  các file còn lại đều nối vào entry theo quy ước Next.js hoặc import.
- Gỡ 81 khối chú thích sinh tự động; giữ chú thích giải thích nghiệp vụ.
- Gỡ `TransferFlow` không có nơi dùng, nhóm luật kiểm tra số tài khoản đời cũ
  và bảng loại tài khoản cũ không còn dùng trong ví độc lập.
- Chuyển hàm chuẩn hóa số ngân hàng đang dùng về `formValidation.ts`; gộp kiểu
  và helper kỳ báo cáo vào `report.ts`; bỏ hai tệp nguồn cũ sau khi sửa import.
- Bỏ 11 export chỉ được dùng nội bộ. Đối chiếu AST trước/sau: 321 câu lệnh
  còn lại giữ nguyên phần triển khai khi bỏ khác biệt import/export/chú thích.
- Bỏ 75 selector không còn nơi dùng trong OCR/CSS nền. Giữ nguyên khai báo,
  thứ tự và điều kiện media của 565 selector còn lại trong ba file được dọn;
  giữ import Tailwind/`swiss.css`, keyframe và CSS Module đang dùng.
- Thêm kiểm tra cấu trúc thường trực: 12 route, 323 import nội bộ, 452 tham
  chiếu thành viên CSS Module, đúng hai loại hỗ trợ và không có file mồ côi.
- Không đổi font, cỡ nút/ô nhập, luồng thanh toán, mô hình ví hoặc dữ liệu chính.
  Không tái triển khai hỗ trợ OTP, nghi chiếm tài khoản hay tra soát thanh toán.
- Giữ phần trang trí đăng nhập theo ý chủ dự án; không coi các nhãn/số minh họa
  là bằng chứng về tính năng hoặc hiệu quả thực tế.

## Kiểm thử trên mã sau dọn

- User-web: 69 kiểm tra logic đạt; cấu trúc/import/CSS đạt; TypeScript, ESLint
  và production build đạt.
- Admin-web: 34 kiểm tra logic đạt; cấu trúc, lint, build đạt. Cảnh báo chunk
  ExcelJS lớn vẫn là giới hạn đã biết, không phải lỗi build.
- API admin: 209 ca đạt trên SQLite tạm, 0 thất bại. Có các ca quyền truy cập,
  trạng thái trước/sau, tránh ghi trùng, rollback, HTTP 500 và che nội dung nhạy cảm.
- API user trên SQL Server: 182 lời gọi và 137 kiểm tra dữ liệu đạt; 99 thao
  tác được bảo vệ được kiểm tra, fixture rollback sạch. Không gửi thư/gọi AI thật.
- HTTP xuyên qua portal production: 58 kiểm tra qua 37 request đạt, gồm đăng
  ký/đăng nhập, xác thực, proxy, QR, ví, ghi thu chi, báo cáo và logout.
- GUI: kiểm tra 9 màn tại 320/390/768/1280px (36 lượt bố cục) không thấy tràn
  ngang toàn trang; font Inter vẫn tải. Đây là desktop resize, không thay thế
  kiểm tra thiết bị/camera thật.
- GUI có dữ liệu: khoản chi 25.000đ xuất hiện đúng ở báo cáo; ví vẫn 0đ. Ngân
  sách Ăn uống 100.000đ tính đã dùng 25%, còn 75.000đ; form và footer dùng được
  ở 390px. Đổi kỳ báo cáo, tạo ví 0đ, từ chối QR sai và form số ngân hàng/OTP
  đã được quan sát. Ca OTP GUI dừng ở bước hiện ô nhập, không nhận là đã xác
  nhận liên kết trong lượt này.
- Hai ca hỗ trợ: gửi phiếu bị khóa, từ chối email liên hệ trùng, gửi phiếu mất
  email bằng email khác, admin nhận/chuyển cấp/đổi trạng thái; nhật ký ghi đúng.
- Database thử đã được xóa; hai portal thử đã dừng. Đã bỏ hai bản build tạm,
  các script chuyển đổi một lần và 18 đường dẫn type-check của đợt thử cũ.
  API chính `/health` và `/ready` vẫn HTTP 200, database chính còn nguyên 4 tài khoản.

## Phạm vi bằng chứng và mức hoàn thiện

Hồ sơ nghiệm thu 130 tình huống của user-web là kết quả lịch sử đợt trước.
Lượt này kiểm tra hồi quy sau dọn mã, không chạy lại toàn bộ 130 ca và không
cộng unit/API vào số ca GUI đó. SMTP thật, Gemini thật, quyền camera và thao
tác đổi mật khẩu do người dùng trực tiếp làm vẫn thuộc bằng chứng cũ; lượt
này mock dịch vụ ngoài để kiểm tra ổn định, không phát thư thật.

Với phạm vi vừa phải của khóa luận, các luồng chính đã có, giao diện thống
nhất, nguồn được dọn và các kiểm tra nêu trên đều đạt. Có thể chuyển tiếp.
Bước hợp lý tiếp theo là chốt kịch bản trình diễn với dữ liệu mẫu, đối chiếu
tài liệu/ảnh theo đúng chức năng hiện có, chuẩn bị bản sao lưu và chạy thử một
lượt trên máy/môi trường dùng báo cáo. Không cần mở thêm nghiệp vụ quản trị
phức tạp chỉ để tăng số lượng chức năng.

Nếu phần tiếp theo là đưa lên máy chủ public, cần smoke test lại tại đích vì
HTTPS, SMTP, Gemini, proxy và cấu hình triển khai không được chứng nhận chỉ
bằng bản test local. Các việc này không làm thay đổi kết luận chốt đợt dọn mã.

## Bằng chứng

### Bổ sung sau lỗi CSS trên phiên dev

Phiên dev đang chạy từng trả HTTP 500 tại `/accounts`; CSS do Tailwind sinh
chứa tên lớp/ký tự điều khiển không hợp lệ. Các kiểm tra production trước đó
không phát hiện lỗi của phiên dev này. Chưa xác định được tệp đầu vào cụ thể
đã tạo tên lớp lỗi trong cache cũ; quét mới không tái hiện các tên lớp đó.

Đã giới hạn nguồn Tailwind tại `globals.css` vào `src` và thêm kiểm tra hồi quy
`tools/verify-tailwind.mjs` vào `npm test`. Kiểm tra dùng một tệp mồi ngoài
`src`, xác nhận tệp đó bị bỏ qua, giữ utility đang sử dụng và phân tích CSS
thật qua Lightning CSS. Không đổi bộ thiết kế hoặc nghiệp vụ.

Kết quả sau sửa: 69 kiểm tra logic, kiểm tra cấu trúc/Tailwind, lint và kiểm
tra TypeScript đều đạt; production build thành công. Dev khởi động mới bằng
cache riêng tại 3012 tải cả 12 route HTTP 200. Phiên dev chính tại 3010 vẫn
chạy; truy cập `/accounts` qua `app.capitalflow.online` hiện trang đăng nhập
đúng khi chưa có phiên, không còn màn lỗi CSS. Lượt này không đăng nhập hoặc
kiểm thử lại nghiệp vụ có dữ liệu.

- [Dev khởi động mới](../../../output/user-web-qa/dev-css-cold-results.json),
  [log dev](../../../output/user-web-qa/dev-css-cold.log).
- [Kiểm tra hồi quy](../../../output/user-web-qa/dev-css-tests.log),
  [lint](../../../output/user-web-qa/dev-css-lint.log),
  [TypeScript](../../../output/user-web-qa/dev-css-typecheck.log),
  [production build](../../../output/user-web-qa/dev-css-production-build.log).
- [Trang public sau sửa](../../../output/user-web-qa/dev-css-fixed.jpg).

### Hồ sơ dọn mã trước đó

- [Đối chiếu mã](../../../output/user-web-qa/cleanup-equivalence.json),
  [CSS](../../../output/user-web-qa/cleanup-css-equivalence.json),
  [manifest nguồn](../../../output/user-web-qa/source-audit-cleanup.json).
- [Logic user](../../../output/user-web-qa/cleanup-tests.log),
  [API user](../../../output/user-web-qa/cleanup-api-regression.json),
  [HTTP qua portal](../../../output/user-web-qa/cleanup-http-results.json).
- [GUI và phạm vi quan sát](../../../output/user-web-qa/cleanup-gui-observations.json),
  [36 bố cục](../../../output/user-web-qa/cleanup-responsive.json).
- [API admin](../../../output/admin-web-qa/audit-detail-api-results.json),
  [logic admin](../../../output/admin-web-qa/audit-detail-tests.log),
  [bằng chứng nhật ký](../../../output/admin-web-qa/audit-support-before-after.jpg).

Các link trên trỏ về `output` tại gốc workspace; xem [cây nguồn](../README.md)
để bảo trì. Môi trường GUI/HTTP dùng database một lần
`cf_userweb_test_5d1f9d5218a8`; việc dọn môi trường được ghi tại
[biên bản môi trường](../../../output/user-web-qa/cleanup-environment.json).
