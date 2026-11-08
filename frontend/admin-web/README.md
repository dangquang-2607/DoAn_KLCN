# CapitalFlow admin-web

Cổng quản trị React/Vite. Chỉ giữ các chức năng hiện hành: đăng nhập, tổng quan, phân tích, người dùng, danh mục, giám sát hóa đơn, nhật ký, email, bảo mật và hỗ trợ tài khoản.

## Cấu trúc mã nguồn

```text
admin-web/
├── src/
│   ├── main.jsx                         # Khởi tạo React, QueryClient và CSS
│   ├── ung-dung/
│   │   ├── App.jsx                      # Router và tải trang theo nhu cầu
│   │   └── layouts/DashboardLayout.jsx   # Điều hướng, hồ sơ và phạm vi truy cập
│   ├── chuc-nang/
│   │   ├── dang-nhap/
│   │   ├── bang-dieu-khien/
│   │   ├── phan-tich-van-hanh/
│   │   ├── nguoi-dung/
│   │   ├── danh-muc-he-thong/
│   │   ├── giam-sat-hoa-don/
│   │   ├── nhat-ky-quan-tri/
│   │   ├── email-cau-hinh/
│   │   ├── cai-dat-bao-mat/              # Mật khẩu và phiên đăng nhập
│   │   └── ho-tro/                      # Mất email đăng ký / tài khoản bị khóa
│   └── dung-chung/
│       ├── CSS/                         # Nền, UI, khung, bố cục quản trị chung
│       ├── UI-chung/                    # Field, modal, bảng trạng thái, menu...
│       ├── connect-api/                 # API client, token và refresh
│       ├── xac-thuc/                    # Chặn route, chính sách mật khẩu và phiên
│       └── tien-ich/                    # Formatter, Excel, nhãn nhật ký và hook
├── public/                              # Favicon và Inter dùng offline
├── tools/                               # Kiểm thử logic và kiểm tra cây import
├── docs/                                # Báo cáo triển khai, kiểm thử và dọn mã
├── DESIGN.md                            # Quy chuẩn giao diện đã thống nhất
├── index.html
├── vite.config.js
├── package.json
├── Dockerfile
└── nginx.conf
```

Mỗi chức năng giữ màn chính ngay tại thư mục chức năng. `thanh-phan/` chứa component con, `xu-ly/` chứa xử lý riêng và `CSS/` chứa stylesheet riêng. Chỉ tạo thư mục khi có file. Không đặt CSS trong `thanh-phan/` hoặc đặt trang nghiệp vụ vào nhóm dùng chung.

Các phần nhỏ cùng màn được gom theo nhóm xử lý:

- Người dùng: `UserDirectory.jsx` (danh sách, hồ sơ, menu), `UserToolbar.jsx` (lọc, xuất Excel, chọn hàng loạt), `UserActionModal.jsx` (xác nhận thao tác).
- Nhật ký: `AuditWorkspace.jsx` (bảng, chi tiết và xuất Excel).
- Email: `EmailLogWorkspace.jsx` (lọc, danh sách và chi tiết), `SmtpSettingsForm.jsx` (biểu mẫu và trạng thái SMTP), `SmtpTestModal.jsx` (gửi thử).
- Phân tích: `AnalyticsSummary.jsx` (chỉ số, danh mục và cơ cấu); biểu đồ và bộ chọn kỳ giữ riêng vì có tương tác độc lập.
- Tiện ích chung chỉ còn `format.js` (định dạng, nhãn nhật ký, Excel), `hooks.js` (tìm kiếm có độ trễ, tùy chọn chuyển động) và `horizontalWheel.js` (cuộn ngang).

`.js` là JavaScript xử lý dữ liệu; `.jsx` là JavaScript có cú pháp giao diện React. Cả hai là mã nguồn đang dùng, không phải file sinh thừa. Không cần đổi đuôi để làm gọn cấu trúc.

Ba file `.woff2` trong `public/fonts/` được `base.css` dùng cho Latin, Latin mở rộng và tiếng Việt. Giữ cùng `Inter-OFL.txt` để admin tải đúng font Inter khi chạy offline. Xóa riêng các tệp này sẽ làm thiếu font hoặc chuyển sang font dự phòng.

`ung-dung/` kết hợp các chức năng; `dung-chung/` không import ngược vào chức năng. Tên URL và hợp đồng API được giữ nguyên. Hỗ trợ tài khoản chỉ có `NO_EMAIL` và `LOCKED`.

## CSS

`main.jsx` nạp theo thứ tự `base.css` → `ui.css` → `shell.css` → `workspace.css`. Thứ tự này giữ nguyên thứ tự áp dụng trước khi tách file. Các module `management`, `operations`, `overview` giữ phần bố cục dùng chung giữa các màn cùng nhóm. CSS riêng của biểu đồ, đăng nhập, hỗ trợ và thanh thao tác người dùng nằm trong `CSS/` của chức năng sở hữu.

Không sao chép một bộ CSS mới cho mỗi trang; dùng các biến điều khiển và thành phần tại [DESIGN.md](DESIGN.md).

## Chạy và kiểm tra

```sh
npm ci
npm run dev
npm test
npm run test:dev
npm run lint
npm run build
```

Dev mặc định cổng 5173. API đi qua `/api/v1` cùng origin; đặt `API_PROXY_TARGET` cho địa chỉ API nội bộ. Giữ `.env` ở máy chạy, không đưa vào Git.

Tên miền demo dùng bản đã build. Khi khởi động môi trường trình diễn:

```sh
npm run demo
```

Lệnh này build trước rồi phục vụ bản build tại 5173; các file JavaScript có
tên theo nội dung để cả ứng dụng tải cùng phiên bản. `npm run dev` dành cho
sửa mã. Hai chế độ cùng dùng 5173 nên chỉ chạy một chế độ tại một thời điểm.
Sau khi sửa mã, khởi động lại chế độ demo để build lại. API mặc định vẫn là
`http://127.0.0.1:8000`. `vite preview` ở đây phục vụ demo local qua tunnel;
triển khai lâu dài dùng Docker/nginx của dự án.

Khi đưa phiên dev qua tên miền/tunnel, giữ các header `no-store` trong
`vite.config.js` để CDN không trộn mã React cũ với module mới. Cấu hình còn
gom React về một nguồn và tối ưu sẵn các dependency của route lazy. Sau khi
đổi cấu hình hoặc bộ thư viện, tải lại toàn trang bằng Ctrl+F5.

`test:dev` khởi động Vite trên cổng tự cấp với cache riêng, đối chiếu module
React của entry, renderer, hook và 11 module lazy, đồng thời kiểm tra header
cache. Bộ thử tự dừng server và xóa cache, không gọi API hoặc database. Có
thể chạy `npm run test:dev -- --serve` trong terminal để giữ trang
`/__runtime-check` tại URL được in ra: trang này dùng phiên giả và API lỗi giả
lập để kiểm tra giao diện, không dùng cho kiểm thử dữ liệu nghiệp vụ.

`npm test` gồm kiểm tra logic xác thực/phiên/quyền/kỳ báo cáo và kiểm tra cấu trúc: import hợp lệ, không có file nguồn mồ côi, CSS Module không có tên sai, đúng hai loại hỗ trợ và không còn dấu hiệu của các luồng đã gỡ. Chi tiết mới nhất tại [docs/source-cleanup-round-2.md](docs/source-cleanup-round-2.md). Dependency trong `node_modules/` và bản build `dist/` được tạo lại bằng npm, không phải mã nguồn để sửa thủ công.
