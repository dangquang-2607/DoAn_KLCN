# Dọn mã hiện hành và gỡ vòng đời xóa người dùng — 07/11/2026

Phần nhật ký tiếp tục được hoàn thiện trong lượt dọn user-web: ghi trạng thái
trước/sau, bỏ mục rỗng, tránh dòng trùng và ghi cả lỗi HTTP 500/rollback.
[Kết quả mới nhất và đánh giá phạm vi demo](../../user-web/docs/cleanup-and-readiness-2026-11-07.md).

Lượt rà trước đã bỏ route/thao tác nhưng còn lựa chọn email, nhãn nhật ký,
trạng thái xóa và mã xử lý nền. Lượt này xử lý tiếp phần còn sót sau khi chủ
dự án duyệt mở rộng phạm vi sang API/DB. Không thay đổi font, kích thước nút,
ô nhập hoặc các chức năng tài chính đã thống nhất.

## Cấu trúc admin-web

- Toàn bộ `src` từ 79 xuống 65 file (44 JSX, 9 JS, 12 CSS).
- Gom nhóm người dùng vào `UserDirectory` / `UserToolbar`; nhật ký vào
  `AuditWorkspace`; email vào `EmailLogWorkspace` / `SmtpSettingsForm`;
  các phần tổng hợp phân tích vào `AnalyticsSummary`.
- Tiện ích định dạng/nhãn nhật ký/Excel cùng nằm trong `format.js`; hai hook
  chung nằm trong `hooks.js`; giữ `horizontalWheel.js` cho hành vi cuộn.
- Trước khi gom đã đối chiếu 166 câu lệnh cấp module sau khi bỏ import/export:
  nội dung xử lý không đổi. Thay đổi chức năng có chủ đích nằm ở phần gỡ luồng cũ.
- Giữ các primitive UI, API client, xác thực và component có tương tác riêng.
  Không gom thành một file khổng lồ.
- Bỏ hai loại email xóa/khôi phục tài khoản, nhãn/xử lý trạng thái xóa, mapping
  hành động nhật ký cũ và một selector `.cf-badge.warning` không còn được dùng.

## API và database

- Gỡ model/bộ xử lý xóa, hai thư mục `nguoi_dung/luu_tru`, `nguoi_dung/vong_doi`
  cùng cache của chúng; bỏ nhánh worker, template email và helper liên quan.
- Danh sách người dùng chỉ còn trạng thái active/banned, không tìm trong email
  đã lưu trữ của luồng xóa. Hồ sơ API không trả trường vòng đời xóa.
- Bộ lọc email API chỉ chấp nhận 8 loại hiện hành. Khóa/mở khóa, cấp lại mật khẩu,
  quản lý vai trò và hai loại hỗ trợ `NO_EMAIL` / `LOCKED` vẫn giữ.
- Migration `cfdb_retire_user_deletion` đã áp dụng trên `personal_finance` sau
  backup VERIFYONLY và diễn tập rollback. Bỏ 2 bảng, 6 cột, 1 yêu cầu cũ hoàn tất,
  1 job DONE, 1 email và 9 audit cũ. Không xóa tài khoản hoặc dữ liệu tài chính.
- Đối chiếu toàn bộ dữ liệu được giữ lại trong 25 bảng trước khi commit đạt.
- Gỡ công cụ maintenance/runner SQL cũ; giữ lịch sử Alembic đã áp dụng để nâng
  cấp database cũ đúng chuỗi. Migration và công cụ gỡ schema có tên chức năng cũ
  để chỉ rõ phần cần loại bỏ; chúng không cung cấp luồng nghiệp vụ cũ.

## Font và đuôi file

Ba tệp WOFF2 đang được `base.css` tham chiếu và phục vụ font Inter offline:
Latin, Latin mở rộng, tiếng Việt. `Inter-OFL.txt` là giấy phép đi kèm. Giữ cả
nhóm để giao diện dùng đúng font đã duyệt. `.js` chứa xử lý JavaScript;
`.jsx` chứa xử lý cùng cú pháp giao diện React, đều là mã nguồn cần thiết.

## Kiểm tra

- Lint không có cảnh báo; 31 ca frontend đạt; import, CSS Module, file mồ côi,
  route và hai loại hỗ trợ được kiểm tra trên toàn bộ nguồn.
- Build đạt. Cảnh báo dung lượng chunk ExcelJS có sẵn vẫn còn.
- 197 ca kiểm thử API admin trên SQLite tạm đạt, gồm từ chối bộ lọc đã gỡ,
  quyền quản trị và hai trường hợp hỗ trợ hiện hành.
- Bộ API user chạy trên SQL Server đạt 182 lời gọi và 137 kiểm tra dữ liệu;
  toàn bộ fixture rollback sạch, không gửi thư hoặc gọi AI thật. Alembic check
  không có sai khác mới.
- Đã thao tác giao diện thực bằng dữ liệu mẫu: bộ lọc 8 loại email, trạng thái
  rỗng, tab SMTP/sửa-bỏ bản nháp, menu người dùng không có xóa, mở-hủy xác nhận
  khóa, chọn-bỏ chọn hàng loạt, xuất Excel, chi tiết nhật ký và chọn số kỳ biểu đồ.
  Không coi đây là kiểm thử liên thông tới database chính.
- Đã xóa harness, script chuyển đổi tạm và dừng Vite cổng thử 5175.
- Kiểm tra cuối: DB không còn bảng/cột/job/email hoặc module SQL chứa luồng cũ;
  khóa ngoại đều bật và trusted. API local đã khởi động lại, `/health`, `/ready`
  và `/openapi.json` đều HTTP 200. Font và quy cách điều khiển được giữ nguyên.

[Cây hiện tại](../README.md) · [Manifest sau gom](../../../output/admin-web-qa/source-audit-consolidated.json)
· [Nhóm file đã gom](../../../output/admin-web-qa/source-consolidation.json)
· [API admin](../../../output/admin-web-qa/retirement-api-results.json)
· [Đối soát DB](../../../output/admin-web-qa/user-deletion-retirement.json).

## Bổ sung sửa trang trắng ở phiên dev — 07/11/2026

Console báo `Invalid hook call` tại `useMotionAllowed` của `DashboardLayout`.
Các package React/React DOM đều là 19.2.8; hook được gọi đúng trong component.
Ảnh Console có các mã phiên React khác nhau. Kiểm tra HTTP còn cho thấy CDN
trả `max-age=14400` cho module nguồn, dù local trả `no-cache`. Những bằng chứng
này phù hợp với việc nạp lẫn các module dev đã tối ưu/cache ở các thời điểm khác nhau.

Đã cấu hình `resolve.dedupe`, tối ưu trước các dependency của route lazy và
thêm `no-store` cho trình duyệt/CDN trong dev. Đây là các cơ chế được hỗ trợ
trong [cấu hình Vite](https://vite.dev/config/shared-options#resolve-dedupe)
và [tối ưu dependency](https://vite.dev/config/dep-optimization-options#optimizedeps-include).
Sau sửa, entry, hook và renderer dùng cùng URL React; phản hồi public của
module nguồn là `no-store`, CDN trả DYNAMIC/BYPASS.

34 kiểm tra logic, kiểm tra cấu trúc và lint đạt; production build thành công,
còn cảnh báo dung lượng chunk đã có. `test:dev` đối chiếu graph module thật
qua HTTP, kiểm tra 11 module lazy, 10 module cùng React và header cache.
Cache/cổng của bộ thử được tách khỏi dev chính.

GUI dùng phiên giả trên cổng thử, chặn toàn bộ API bằng adapter trong bộ thử:
9 trang đều render được khung và tiêu đề. API nghiệp vụ được cố ý trả 503;
trang hiển thị trạng thái lỗi thay vì trắng toàn bộ. Đây là kiểm tra render
và xử lý lỗi, không phải kiểm thử lại dữ liệu/luồng nghiệp vụ trên DB chính.
Tên miền thật đã hiển thị màn đăng nhập, không có lỗi Console trong phiên mới.

- [Graph module](../../../output/admin-web-qa/react-runtime-module-graph.log),
  [HTTP tên miền thật](../../../output/admin-web-qa/react-runtime-public-http.json),
  [GUI 9 trang](../../../output/admin-web-qa/react-runtime-gui.json).
- [Logic/cấu trúc](../../../output/admin-web-qa/react-runtime-tests.log),
  [lint](../../../output/admin-web-qa/react-runtime-lint.log),
  [build](../../../output/admin-web-qa/react-runtime-build.log).
- [Khung nhật ký ở bộ thử API lỗi](../../../output/admin-web-qa/react-runtime-fixed.jpg),
  [đăng nhập tên miền thật](../../../output/admin-web-qa/react-runtime-public-login.jpg).

### Kiểm tra đăng nhập/reload và bản build dùng trình diễn

Phép kiểm tra graph module và API lỗi ở trên chưa đủ xác nhận phiên đang dùng
của người dùng. Đã bổ sung kiểm tra bản build với API thật và tài khoản thử
trên SQLite trong RAM; không chạy worker, không gửi thư và không dùng DB chính.
Đăng nhập thành công, mở 9 trang và reload từng trang; cả 9 giữ đúng tiêu đề,
phiên đăng nhập hoạt động và Console không có lỗi/cảnh báo.
Giới hạn: API thử phát sinh một số `InterfaceError` khi các request đồng thời
dùng chung SQLite StaticPool. Do đó lượt này chỉ xác nhận render, phiên và
reload; không kết luận toàn bộ API nghiệp vụ của 9 trang đều đạt. Lỗi này
thuộc bộ thử SQLite riêng, không phải bằng chứng lỗi ở SQL Server chính.

Tên miền `admin.capitalflow.online` hiện được phục vụ bằng chính bản build
đã thử tại cổng 5173, thay cho Vite dev. HTML và entry JavaScript qua 10 URL
public đều HTTP 200, dùng cùng entry có hash; không còn nạp `/@vite/client`.
Preview dùng header `no-store` cho môi trường demo. Đã thêm `npm run demo`
(build rồi preview) để khởi động lại theo cùng chế độ. Đây là môi trường demo
local qua tunnel; cấu hình Docker/nginx vẫn dành cho triển khai lâu dài.

Người dùng đã tải lại tab đang lỗi và xác nhận **“Đã hiện giao diện”**.
Các server thử 5176/8021 và fixture tạm đã được dừng/gỡ; DB thử chỉ nằm trong
RAM nên không có database thử cần giữ hoặc xóa ở SQL Server.

- [Đăng nhập và reload 9 trang](../../../output/admin-web-qa/react-built-reload-results.json),
  [ảnh nhật ký có dữ liệu thử](../../../output/admin-web-qa/react-built-reload-fixed.jpg).
- [HTTP tên miền chạy bản build](../../../output/admin-web-qa/react-built-public-http.json),
  [ảnh đăng nhập public](../../../output/admin-web-qa/react-built-public-login.jpg).
- [Trạng thái sau dọn phiên thử và xác nhận của người dùng](../../../output/admin-web-qa/react-built-environment-final.json).
- [Logic/cấu trúc](../../../output/admin-web-qa/react-final-tests.log),
  [lint](../../../output/admin-web-qa/react-final-lint.log),
  [build](../../../output/admin-web-qa/react-final-build.log).
