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
- `dung-chung/tien-ich/`: ngày, tiền, lỗi, CSV và hook dùng chung.
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

## Kiểm tra sau khi thay đổi

Trong `user-web/`: `npm run lint`, `npm run typecheck`, `npm run build`.
Trong `admin-web/`: `npm run lint`, `npm run build`.
Kiểm tra thêm đăng nhập, điều hướng sidebar, modal và responsive trên trình duyệt;
build thành công không thay thế kiểm thử nghiệp vụ với tài khoản hợp lệ.
