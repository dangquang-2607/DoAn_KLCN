# Cấu trúc frontend

Hai portal được chia theo các mục trên sidebar. Tên thư mục chức năng dùng tiếng
Việt không dấu; tên file, component, URL và hợp đồng API hiện có được giữ nguyên.
Mỗi portal vẫn cài dependency và build Docker độc lập.

## User web

`user-web/src/app/` chỉ giữ route, layout, provider và favicon của Next.js.
Các `page.tsx` tại đây xuất trang từ `chuc-nang/<tab>/`.
Alias `@/` trỏ tới `user-web/src/`.
Trong Explorer, chỉ thư mục có mục con. Mỗi chức năng đặt stylesheet vào thư mục `CSS/` của mình.
Xem nhánh `frontend/user-web/` trong [cây thư mục dự án](../PROJECT_STRUCTURE.md#cây-explorer-có-chú-thích).

- `/` → `chuc-nang/tong-quan/`
- `/accounts` → `chuc-nang/vi-tai-khoan/`
- `/transactions` → `chuc-nang/giao-dich/`
- `/budgets` → `chuc-nang/ngan-sach/`
- `/ocr` → `chuc-nang/hoa-don-ai/`
- `/analytics` → `chuc-nang/bao-cao-tai-chinh/`
- `/categories` → `chuc-nang/danh-muc/`
- `/settings` → `chuc-nang/cai-dat-bao-mat/`
- `/support` → `chuc-nang/trung-tam-ho-tro/`
- `/login` → `chuc-nang/dang-nhap/`

`public/`, `.env` và các file cấu hình vẫn ở gốc `user-web/`.
Không tạo lại `user-web/app/`: Next.js sẽ ưu tiên nó thay vì `src/app/`.
Nếu đang chạy dev server khi chuyển cây route, cần khởi động lại `npm run dev`.

### Tên miền và kết nối API

Chỉ dùng hai tên miền công khai:

- Người dùng: `https://app.capitalflow.online`.
- Quản trị: `https://admin.capitalflow.online`.

Cả hai frontend gọi `/api/v1` cùng origin; không cần tên miền API riêng.
Next.js (dev và production) và Vite (dev/preview) proxy tới
`API_PROXY_TARGET=http://127.0.0.1:8000`. Đây là địa chỉ nội bộ máy chủ,
không phải URL người dùng truy cập. Không cấu hình `NEXT_PUBLIC_API_URL`
hay `VITE_API_URL` nữa.

Tunnel hiện tại cần đưa app tới cổng 3010 và admin tới cổng 5173 khi chạy
bằng Node/Vite. Khởi động lại frontend sau khi sửa cấu hình proxy.
Docker dùng admin Nginx ở cổng 4000; proxy backend qua `host.docker.internal:8000`.
User-web Docker đóng gói `API_PROXY_TARGET` lúc build, cũng trỏ về host Docker.
Backend phải lắng nghe trên interface mà Docker truy cập được khi dùng cách này.
Không trỏ proxy về chính tên miền portal vì sẽ tạo vòng lặp.

CORS API chỉ chấp nhận hai origin HTTPS ở trên; URL email cũng dùng hai origin này.

## Admin web

`admin-web/src/main.jsx` khởi tạo ứng dụng; `ung-dung/App.jsx` khai báo route và
lazy-load màn hình của từng chức năng. Xem [cây admin-web hiện tại](admin-web/README.md).

- `/dashboard` → `chuc-nang/bang-dieu-khien/`
- `/system-analytics` → `chuc-nang/phan-tich-van-hanh/`
- `/users` → `chuc-nang/nguoi-dung/`
- `/categories` → `chuc-nang/danh-muc-he-thong/`
- `/ocr-monitor` → `chuc-nang/giam-sat-hoa-don/`
- `/audit-logs` → `chuc-nang/nhat-ky-quan-tri/`
- `/email-logs` → `chuc-nang/email-cau-hinh/`
- `/settings` → `chuc-nang/cai-dat-bao-mat/`
- `/support` → `chuc-nang/ho-tro/`
- `/login` → `chuc-nang/dang-nhap/`

## Bên trong một chức năng

Trang giữ tên cũ (`page.tsx`, `Users.jsx`...). `thanh-phan/` chứa component của tab;
`CSS/` chứa stylesheet và các hằng style của tab; `xu-ly/` chứa helper, hook hoặc
kiểu dữ liệu riêng. Router của user-web import trực tiếp màn hình của chức năng.
Không tạo thư mục trống chỉ để đủ bộ khung.

Trong user-web, Ngân sách chia thành `danh-sach/` (thẻ, chi tiết, menu thao tác) và `bieu-mau/` (tạo, sửa, kết thúc, xóa). Ví chia thành `nap-rut/` và `thanh-toan/`; `thanh-phan/` giữ ô nhập số tiền và bộ chọn ví dùng lại giữa các luồng. Màn hình chính nằm ngay trong thư mục chức năng.

Trong user-web, các phần cùng luồng có thể dùng chung một CSS Module. Ví dụ danh sách,
thanh lọc lịch sử và menu ngân sách dùng `ngan-sach/CSS/BudgetList.module.css`. Kiểu dữ liệu hóa đơn nằm trong
`hoa-don-ai/xu-ly/InvoiceTypes.ts`; helper lịch sử ngân sách nằm trong
`ngan-sach/xu-ly/budget-history.ts`.

## Phần dùng chung trong mỗi portal

- `dung-chung/layouts/`: sidebar, header và khung ứng dụng.
- `dung-chung/UI-chung/`: modal, input, phân trang, icon, toast và primitive UI.
- `dung-chung/xac-thuc/`: bảo vệ route, form bảo mật và các thành phần phiên đăng
  nhập được khung ứng dụng/trang cài đặt dùng lại.
- `dung-chung/connect-api/`: API client và xử lý token/refresh hiện có.
- `dung-chung/nghiep-vu/`: kiểu và helper nghiệp vụ dùng bởi nhiều tab.
- `dung-chung/tien-ich/`: ngày, tiền, lỗi, Excel và hook dùng chung.
- `dung-chung/CSS/` chứa biến thiết kế và CSS nền của từng portal.
- Trong user-web, `UI-chung/CSS/` và `thong-bao/CSS/` chứa CSS riêng của hai nhóm này.
- `user-web/src/dung-chung/thong-bao/`: trung tâm thông báo và định dạng nội dung.

Không import implementation của tab khác hoặc import từ `chuc-nang` ngược vào
`dung-chung`. Nếu nhiều tab cần cùng một kiểu/helper, đưa nó vào nhóm dùng chung
phù hợp. Ví dụ `ReportTrendPoint` dùng bởi Tổng quan và Báo cáo nằm trong
`nghiep-vu/report.ts` cùng kiểu kỳ và hàm tính kỳ báo cáo, không lấy kiểu từ component biểu đồ của tab Báo cáo.

## CSS và thứ tự nạp

User web dùng CSS Modules cho các giao diện đã có module. Tổng quan và Báo cáo có
module riêng trong `CSS/`; các class nền được `composes` từ
`dung-chung/CSS/finance-visuals.module.css`. CSS trình nhập/xem trước hóa đơn
được đặt trong `hoa-don-ai/CSS/ocr.css`.

Admin nạp `dung-chung/CSS/base.css`, `ui.css`, `shell.css` và `workspace.css`
theo thứ tự trong `src/main.jsx`. CSS riêng nằm trong `chuc-nang/<tab>/CSS/`.
Form bảo mật và phiên đăng nhập nằm trong `chuc-nang/cai-dat-bao-mat/`.
Không tự đổi thứ tự nạp nếu chưa đối chiếu cascade và responsive.
CSS đăng nhập có selector và animation riêng để không ảnh hưởng các tab khác.

### Cảnh báo CSS trong IDE

`composes` là cú pháp CSS Modules; `@theme` là directive của Tailwind CSS v4.
File `user-web/css-custom-data.json` khai báo hai cú pháp này cho bộ kiểm tra CSS
của VS Code/Antigravity, giữ các cảnh báo CSS khác hoạt động bình thường.
Trong `.vscode/settings.json` của thư mục đang mở, thêm `css.customData` với
đường dẫn tương ứng:

- Mở gốc repository: `["./frontend/user-web/css-custom-data.json"]`.
- Mở `frontend/`: `["./user-web/css-custom-data.json"]`.
- Mở `frontend/user-web/`: `["./css-custom-data.json"]`.

Không cần tắt `css.validate`, `css.lint.unknownProperties` hoặc
`css.lint.unknownAtRules`. Nếu cảnh báo cũ còn hiển thị, chạy
`Developer: Reload Window`. Thư mục `.vscode/` được Git bỏ qua nên cấu hình IDE
cần được thiết lập lại trên máy mới; file custom data được lưu trong repository.

## Nguồn giao diện dùng giữa hai portal

Hai portal giữ mã UI tại `src/dung-chung/` và build độc lập. Quy cách font,
điều khiển và khoảng cách được ghi trong `user-web/DESIGN.md` và
`admin-web/DESIGN.md`. Hiện không có thư mục `frontend/shared/` hoặc script
đồng bộ; không chạy các lệnh đồng bộ của cấu trúc cũ.

Không đồng bộ `finance.ts`/`format.js` giữa hai portal: các kiểu API và nhãn nghiệp
vụ đã khác nhau. Kiểu dữ liệu nằm tại `dung-chung/nghiep-vu/finance.ts`; formatter
nằm trong `dung-chung/tien-ich/finance.ts` (user) và `format.js` (admin).

## Xuất Excel ở user web và admin web

- **Báo cáo tài chính → Xuất Excel** tải toàn bộ giao dịch trong khoảng ngày
  đang chọn từ `/analytics/export-data`, rồi tạo file `.xlsx` trên trình duyệt.
- **Giao dịch → Xuất Excel** chỉ xuất những dòng đã tick, kể cả ở trang khác.
  Chưa chọn dòng nào thì nút xuất bị khóa. `/transactions/export-data` dùng
  cùng bộ lọc và quyền sở hữu với danh sách nhưng không phân trang.
  Không đặt bộ lọc sẽ lấy toàn bộ lịch sử. Phạm vi được ghi ngay đầu file.
- Checkbox cạnh **Ngày** chọn/bỏ chọn toàn bộ kết quả phù hợp trên mọi trang.
  Có thể tick/bỏ tick từng dòng, lựa chọn được giữ khi đổi trang. Đổi bộ lọc, từ khóa
  hoặc hóa đơn sẽ bỏ lựa chọn cũ; phản hồi chọn tất cả đến muộn bị loại bỏ.
  Xóa hàng loạt vẫn có giới hạn an toàn 100 dòng và yêu cầu xác nhận riêng.
- Cả hai dùng `createFinanceWorkbook`/`exportFinanceExcel` trong
  `user-web/src/dung-chung/tien-ich/finance.ts`. ExcelJS chỉ được nạp khi xuất.
- File có ngày và số tiền đúng kiểu Excel, bộ lọc, cố định tiêu đề, màu thu/chi
  và tổng theo từng loại tiền. Tổng chỉ tính nghiệp vụ thu/chi thông thường,
  không gồm chuyển khoản hoặc điều chỉnh số dư và không quy đổi ngoại tệ.
- Chuỗi người dùng nhập được ghi thành ô văn bản, không thực thi như công thức.
  Endpoint CSV cũ vẫn giữ để tương thích. Sau khi cập nhật dependency, chạy
  `npm install` trong `user-web/`, `admin-web/` và khởi động lại API nếu không dùng reload.
- **Admin → Người dùng** xuất các dòng đã chọn trên trang hoặc cả trang.
  **Admin → Nhật ký quản trị** xuất trang hiện tại theo bộ lọc, thời gian UTC.
  Cả hai tạo `.xlsx` có tiêu đề, phạm vi, bộ lọc, cố định hàng và cột rộng phù hợp
  qua `createExcelWorkbook`/`exportExcel` trong `admin-web/src/dung-chung/tien-ich/format.js`.

## Kiểm tra sau khi thay đổi

Trong `user-web/`: `npm run lint`, `npm run typecheck`, `npm run build`.
Trong `admin-web/`: `npm test`, `npm run lint`, `npm run build`.
Kiểm tra thêm đăng nhập, điều hướng sidebar, modal và responsive trên trình duyệt;
build thành công không thay thế kiểm thử nghiệp vụ với tài khoản hợp lệ.
