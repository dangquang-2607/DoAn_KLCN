# Cấu trúc frontend

Hai portal được chia theo các mục trên sidebar. Tên thư mục chức năng dùng tiếng
Việt không dấu; tên file, component, URL và hợp đồng API hiện có được giữ nguyên.
Mỗi portal vẫn cài dependency và build Docker độc lập.

## User web

`user-web/src/app/` chỉ giữ route, layout, provider và favicon của Next.js.
Các `page.tsx` tại đây xuất trang từ `chuc-nang/<tab>/index.ts`.
Alias `@/` trỏ tới `user-web/src/`.

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

### Chạy thử user web trên điện thoại trong mạng LAN

Chạy backend ở cổng `8000`, sau đó chạy `npm run dev` trong `user-web/`.
Điện thoại và máy tính dùng chung Wi-Fi; mở `http://<IP-LAN-của-máy-tính>:3010`.
Không dùng `localhost` trên điện thoại để trỏ tới máy tính.

Ở chế độ development, trình duyệt gọi `/api/v1` qua cùng cổng `3010`;
Next.js chuyển tiếp tới `API_PROXY_TARGET`, hoặc `NEXT_PUBLIC_API_URL` nếu không
khai báo biến đó (mặc định `http://127.0.0.1:8000`). Backend có thể tiếp tục chỉ
lắng nghe trên `127.0.0.1`; không cần mở thêm cổng backend hay nới CORS cho LAN.
Next.js tự thêm các địa chỉ IPv4 mạng của máy vào `allowedDevOrigins` khi khởi
động để tài nguyên dev/HMR tải được. Khởi động lại dev server nếu IP Wi-Fi đổi.

Cấu hình proxy này chỉ dùng trong development. Bản production vẫn dùng
`NEXT_PUBLIC_API_URL` làm địa chỉ API trực tiếp từ trình duyệt.

## Admin web

`admin-web/src/main.jsx` khởi tạo ứng dụng; `App.jsx` khai báo route và lazy-load
điểm xuất `index.js` của từng tab.

- `/dashboard` → `chuc-nang/bang-dieu-khien/`
- `/system-analytics` → `chuc-nang/phan-tich-van-hanh/`
- `/users` → `chuc-nang/nguoi-dung/`
- `/categories` → `chuc-nang/danh-muc-he-thong/`
- `/ocr-monitor` → `chuc-nang/giam-sat-hoa-don/`
- `/audit-logs` → `chuc-nang/nhat-ky-quan-tri/`
- `/email-logs` → `chuc-nang/email-cau-hinh/`
- `/settings` → `chuc-nang/cai-dat-bao-mat/`
- `/login` → `chuc-nang/dang-nhap/`

## Bên trong một chức năng

Trang giữ tên cũ (`page.tsx`, `Users.jsx`...). `thanh-phan/` chứa component của tab;
`CSS/` chứa stylesheet và các hằng style của tab; `xu-ly/` chứa helper, hook hoặc
kiểu dữ liệu riêng. `index.ts`/`index.js` là điểm xuất trang cho router.
Không tạo thư mục trống chỉ để đủ bộ khung.

CSS Module chỉ phục vụ một component được đặt cạnh component, ví dụ
`vi-tai-khoan/thanh-phan/AccountCard.module.css`. Kiểu dữ liệu hóa đơn nằm trong
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
- `dung-chung/styles/`: biến thiết kế, CSS nền và các quy tắc dùng chung.
- `user-web/src/dung-chung/thong-bao/`: trung tâm thông báo và định dạng nội dung.

Không import implementation của tab khác hoặc import từ `chuc-nang` ngược vào
`dung-chung`. Nếu nhiều tab cần cùng một kiểu/helper, đưa nó vào nhóm dùng chung
phù hợp. Ví dụ `ReportTrendPoint` dùng bởi Tổng quan và Báo cáo nằm trong
`nghiep-vu/report-types.ts`, không lấy kiểu từ component biểu đồ của tab Báo cáo.

## CSS và thứ tự nạp

User web dùng CSS Modules cho các giao diện đã có module. Tổng quan và Báo cáo có
module riêng trong `CSS/`; các class nền được `composes` từ
`dung-chung/styles/finance-visuals.module.css`. CSS trình nhập/xem trước hóa đơn
được đặt trong `hoa-don-ai/CSS/ocr.css`.

Admin web giữ các class hiện có. `src/workspace.css` **chỉ là danh sách import**
để nạp CSS theo các giai đoạn cascade hiện có, không chứa rule của tab. Nội dung
riêng nằm trong `chuc-nang/<tab>/CSS/`; nội dung form bảo mật dùng chung nằm trong
`dung-chung/xac-thuc/`. Không tự đổi thứ tự import nếu chưa kiểm tra desktop và
responsive. Cách nạp tập trung này giữ style ổn định khi đi qua các route lazy.
`dung-chung/styles/workspace-responsive.css` được nạp cuối để các khung chi tiết
dùng chung bỏ giới hạn chiều cao trên màn hình hẹp, sau biến thể desktop của tab.
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

`frontend/shared/` giữ `swiss.css`, `Toast.jsx`, `Motion.jsx`, `CategoryIcon.tsx`
và script đồng bộ. Bản sao trong mỗi portal phục vụ build độc lập.

```powershell
# Chạy từ thư mục gốc repository, sau khi sửa primitive trong frontend/shared.
node frontend/shared/sync-design.mjs
node frontend/shared/sync-design.mjs --check
```

Không đồng bộ `finance.ts`/`format.ts` giữa hai portal: các kiểu API và nhãn nghiệp
vụ đã khác nhau. Kiểu dữ liệu nằm tại `dung-chung/nghiep-vu/finance.ts`; formatter
nằm trong `dung-chung/tien-ich/finance.ts` (user) và `format.ts` (admin).

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
  qua `createExcelWorkbook`/`exportExcel` trong `admin-web/src/dung-chung/tien-ich/format.ts`.

## Kiểm tra sau khi thay đổi

Trong `user-web/`: `npm run lint`, `npm run typecheck`, `npm run build`.
Trong `admin-web/`: `npm run lint`, `npm run build`.
Kiểm tra thêm đăng nhập, điều hướng sidebar, modal và responsive trên trình duyệt;
build thành công không thay thế kiểm thử nghiệp vụ với tài khoản hợp lệ.
