# CapitalFlow user-web

Cổng người dùng Next.js App Router. Phạm vi demo hiện hành gồm đăng ký/đăng nhập,
ví và ngân hàng mô phỏng, chuyển tiền/QR nội bộ, ghi thu chi, hóa đơn OCR, ngân
sách, báo cáo, danh mục, thông báo và quản lý phiên. Hỗ trợ tài khoản chỉ có
`LOCKED` (bị khóa) và `NO_EMAIL` (mất quyền truy cập email đăng ký).

Mục Cài đặt & bảo mật có hai trang: `/settings` quản lý tài khoản/phiên và
`/settings/subscription` quản lý hạn mức, bảng giá, lịch sử. Nâng cấp mở trang
`/settings/subscription/checkout?payment_order=<UUID>` với QR payOS, sao chép và
tải ảnh; trạng thái được kiểm tra qua backend. Đơn cũ thiếu dữ liệu QR có link
payOS dự phòng. Không cấp Premium theo tham số URL hoặc thao tác phía trình duyệt.

Tên miền `app.capitalflow.online` được chuyển sang HTTPS qua `src/proxy.ts`,
tôn trọng `X-Forwarded-Proto` của Cloudflare để tránh vòng lặp khi origin dùng
HTTP local. Localhost tiếp tục dùng HTTP. `browserCrypto.ts` giữ cùng dấu băm
SHA-256 và UUID ngẫu nhiên bảo mật khi Safari thiếu SubtleCrypto/randomUUID;
khóa chống gửi trùng không đổi giữa các cách băm. Camera không hỗ trợ quét
trực tiếp chuyển sang chụp ảnh; chọn ảnh từ thư viện không cần quyền camera.
Icon SVG, favicon ICO và Apple PNG dùng cùng logo. `devIndicators: false` ẩn
nút debug N; lỗi runtime vẫn được báo. Khi phục vụ công khai ổn định, dùng bản
build production thay cho `next dev`.

## Tổ chức mã nguồn

```text
src/
├── app/                    # Route, layout, provider, error/loading, icon
├── chuc-nang/              # Trang nghiệp vụ, component và CSS theo chức năng
│   ├── dang-nhap/
│   ├── tong-quan/
│   ├── vi-tai-khoan/       # nap-rut/, thanh-toan/, thanh-phan/, CSS/, xu-ly/
│   ├── giao-dich/
│   ├── hoa-don-ai/
│   ├── ngan-sach/          # danh-sach/, bieu-mau/, CSS/
│   ├── bao-cao-tai-chinh/
│   ├── danh-muc/
│   ├── cai-dat-bao-mat/
│   └── trung-tam-ho-tro/
└── dung-chung/
    ├── connect-api/        # Phiên, token, refresh và client API
    ├── layouts/            # Bảo vệ trang, điều hướng và khung ứng dụng
    ├── nghiep-vu/          # Kiểu tài chính và report.ts
    ├── tien-ich/           # Số tiền, ngày, Excel, form và biểu đồ
    ├── UI-chung/           # Dialog, field, bảng trạng thái, ngày/tiền...
    ├── thong-bao/
    ├── xac-thuc/
    └── CSS/                # globals.css → swiss.css và bố cục dùng chung
```

`app/` giữ đúng quy ước Next.js. Màn nghiệp vụ đặt tại `chuc-nang`; `thanh-phan`
chứa phần giao diện, `CSS` chứa stylesheet của nhóm, `xu-ly` chỉ giữ xử lý thực
sự dùng riêng. Không tạo thư mục rỗng hoặc gom toàn bộ trang vào một file lớn.

Kiểu báo cáo và cách tính kỳ nằm chung tại `dung-chung/nghiep-vu/report.ts`.
Chuẩn hóa số ngân hàng nằm tại `dung-chung/tien-ich/formValidation.ts`, dùng
trước bước kiểm tra số được cấp trong màn ví. Kiểu `finance.ts` và tiện ích
`tien-ich/finance.ts` có vai trò khác nhau; không ghép chỉ vì cùng tên.

## CSS, font và tài nguyên

`app/layout.tsx` nạp `globals.css`; file này giữ thứ tự import Tailwind rồi
`swiss.css`. Khai báo `source("../../")` tại `globals.css` giới hạn Tailwind
quét thư mục `src`, tránh lấy tên lớp từ dữ liệu thử hoặc bản build bên ngoài.
CSS Module giữ bố cục của từng chức năng, kể cả `composes` dùng
chung. Font Inter giữ qua `next/font`, không đổi quy cách điều khiển đã thống
nhất trong [DESIGN.md](DESIGN.md). `public/` chứa tài nguyên cần cho trình xem
PDF và giao diện; không coi tệp worker là mã nguồn dư chỉ vì không import bằng TS.

Phần minh họa trang đăng nhập được giữ theo lựa chọn của chủ dự án. Các con số
và nhãn trang trí không dùng làm bằng chứng đo hiệu suất hoặc chứng nhận bảo mật.

## Chạy và kiểm tra

```sh
npm ci
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
```

Dev chạy tại 3010. API gọi `/api/v1` cùng origin; `API_PROXY_TARGET` là đích nội
bộ, mặc định `http://127.0.0.1:8000`. Không ghi secret vào mã nguồn.

`npm test` gồm kiểm tra logic và cấu trúc: import, route, thứ tự nạp CSS, các
thành viên CSS Module, file mồ côi và các luồng đã bỏ. Kiểm tra Tailwind còn
biên dịch stylesheet thật, xác nhận bỏ qua tệp ngoài `src` và phân tích CSS
sinh ra ở chế độ dev. `test:http` cần portal
test cổng 3011/API dùng một lần có endpoint kiểm chứng; script từ chối ghi nếu
database không mang tên kiểm thử. Không chạy ca ghi HTTP vào database chính.

[Báo cáo dọn mã và kiểm thử 07/11/2026](docs/cleanup-and-readiness-2026-11-07.md).
