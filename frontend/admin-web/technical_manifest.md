# BẢN ĐẶC TẢ KỸ THUẬT (TECHNICAL MANIFEST) - ADMIN-WEB
> **Dự án**: CapitalFlow — Nền Tảng Quản Trị Tài Chính Cá Nhân Thông Minh (Phân Hệ Admin Web).  
> **Tài liệu**: Chi tiết các Functions quan trọng, Danh mục API URLs/Routes, Biến môi trường và Danh sách Keyword chức năng.  
> **Workspace**: `d:\code\DoAn_KLCN\frontend\admin-web`

---

## 1. Danh Sách Các Functions Quan Trọng (Important Functions)

### 1.1. Tầng Giao Tiếp Mạng & Bảo Mật Phiên (`src/services/api.js`)

| Tên Function | Tham số đầu vào | Kiểu trả về | Mô tả chi tiết chức năng |
| :--- | :--- | :--- | :--- |
| `api.interceptors.request.use` | `(config)` | `config` (AxiosRequestConfig) | Can thiệp trước khi gửi request: Tự động trích xuất `admin_access_token` từ `sessionStorage` và đính kèm header `Authorization: Bearer <token>`. |
| `api.interceptors.response.use` | `(res, err)` | `Promise<AxiosResponse>` | Giám sát phản hồi HTTP: Bắt lỗi `401 Unauthorized`. Quản lý cờ `isRefreshing` và hàng đợi `refreshQueue` để xếp hàng các request đồng thời, gọi `/auth/refresh` lấy token mới và tự động gửi lại request gốc mà không làm đứt đoạn phiên người dùng. |
| `_doLogout()` | *Không có* | `void` | Kích hoạt chu trình đăng xuất an toàn: Gửi request bất đồng bộ `POST /auth/logout` kèm `refresh_token` lên server để thu hồi phiên, giải phóng bộ nhớ `sessionStorage` và chuyển hướng trình duyệt về trang chủ `/`. |

---

### 1.2. Phân Hệ Xác Thực & Đăng Nhập Quản Trị (`src/pages/Login.jsx`, `src/components/ProtectedRoute.jsx`)

| Tên Function | Tham số đầu vào | Kiểu trả về | Mô tả chi tiết chức năng |
| :--- | :--- | :--- | :--- |
| `isValidEmail` | `(val: string)` | `boolean` | Kiểm tra tính hợp lệ của địa chỉ email quản trị theo chuẩn biểu thức chính quy (Regex). |
| `triggerShake` | `(focusAfter: boolean = false)` | `void` | Kích hoạt hiệu ứng hoạt họa rung lắc khung đăng nhập báo hiệu lỗi, tự động focus vào ô email khi cần. |
| `handleLogin` | `(e: FormEvent)` | `Promise<void>` | Điều phối đăng nhập: Kiểm tra khóa Brute-force, gửi `POST /auth/login`, gọi tiếp `GET /auth/me` để thẩm định vai trò `ADMIN`. Nếu hợp lệ lưu token vào `sessionStorage` và chuyển hướng tới `/dashboard`. |
| `handleFailedAttempt` | `(newCount: number, msg: string)` | `void` | Xử lý khi đăng nhập thất bại: Tăng số lần thử, tính toán thời gian khóa (`LOCKOUT_SECONDS = 30s` / `15m`), lưu trạng thái vào `sessionStorage` và hiển thị cảnh báo số lần thử còn lại. |
| `onMouseDown` / `onMouseMove` / `onMouseUp` | `(e: MouseEvent)` | `void` | Bộ xử lý sự kiện kéo thả chuột mô phỏng vật lý sợi dây kéo đèn bàn (Desk Lamp Cord Pull): Tính toán độ kéo `pullAmount`, khi vượt ngưỡng `PULL_THRESHOLD = 60px` sẽ kích hoạt bật/tắt bóng đèn chiếu sáng giao diện. |
| `onTouchStart` / `onTouchMove` / `onTouchEnd` | `(e: TouchEvent)` | `void` | Xử lý sự kiện cảm ứng trên màn hình di động/tablet tương ứng cho cơ chế kéo dây bật đèn bàn. |
| `ProtectedRoute` | `({ children }: Props)` | `JSX.Element` | Thành phần bọc bảo vệ route: Kiểm tra sự tồn tại của `admin_access_token`. Nếu không tìm thấy, lập tức điều hướng về trang đăng nhập thông qua `<Navigate to="/" replace />`. |

---

### 1.3. Phân Hệ Quản Lý Người Dùng & Điều Hành (`src/pages/Users.jsx`)

| Tên Function | Tham số đầu vào | Kiểu trả về | Mô tả chi tiết chức năng |
| :--- | :--- | :--- | :--- |
| `stringToColor` | `(str: string)` | `string` (Hex color) | Băm chuỗi văn bản (tên/email) thành mã màu Hex cố định, dùng tạo màu nền ngẫu nhiên nhất quán cho Avatar người dùng. |
| `getInitials` | `(name: string)` | `string` (1–2 ký tự) | Trích xuất chữ cái đầu của họ và tên hiển thị bên trong khối Avatar tròn. |
| `parseDateUTC` | `(dt: string \| Date)` | `Date \| null` | Chuẩn hóa chuỗi thời gian UTC an toàn, tự động bổ sung hậu tố `Z` nếu thiếu nhằm triệt tiêu hiện tượng lệch 7 múi giờ trên trình duyệt người dùng Việt Nam. |
| `formatRelativeTime` | `(dt: string, now: number)` | `string` | Định dạng thời gian tương đối bằng tiếng Việt chuẩn ngữ pháp (ví dụ: *"Vừa xong"*, *"5 phút trước"*, *"2 giờ trước"*, *"Hôm qua"*). |
| `isUserOnline` | `(user: object, now: number)` | `boolean` | Xác định người dùng có đang trực tuyến hay không dựa trên chênh lệch thời gian giữa thời điểm hiện tại và `last_active_at` ($\le 10$ phút). |
| `isUserBanned` | `(user: object)` | `boolean` | Kiểm tra tổng hợp các cờ trạng thái khóa tài khoản (`is_banned === true`, `is_active === false`, hoặc `status === 'BANNED'`). |
| `isRootAdmin` | `(user: object)` | `boolean` | Nhận diện tài khoản Quản trị viên cấp cao nhất (Super Administrator hoặc email `admin@capitalflow.vn`), vô hiệu hóa mọi hành vi can thiệp xóa/khóa đối với tài khoản này. |
| `handleToggleSelectAll` | *Không có* | `void` | Chọn hoặc bỏ chọn toàn bộ người dùng hợp lệ hiển thị trên trang hiện tại (tự động loại trừ Root Admin và tài khoản của chính mình). |
| `handleToggleSelectUser` | `(id: string)` | `void` | Thêm hoặc loại bỏ một `user_id` cụ thể ra khỏi danh sách đang chọn phục vụ thao tác hàng loạt. |
| `banMutation.mutate` | `({ id, reason, duration, forceLogout })` | `Promise<void>` | Gửi yêu cầu khóa tài khoản đơn lẻ, tùy chọn thu hồi phiên đăng nhập hiện hữu và cập nhật lại cache dữ liệu. |
| `unbanMutation.mutate` | `({ id, reason, sendEmail })` | `Promise<void>` | Mở khóa tài khoản đơn lẻ, tự động kích hoạt tiến trình ngầm gửi thư thông báo cho người dùng. |
| `changeRoleMutation.mutate` | `({ id, role })` | `Promise<void>` | Nâng cấp hoặc hạ cấp vai trò người dùng (`USER` $\leftrightarrow$ `ADMIN`). |
| `bulkBanMutation.mutate` | `({ userIds, reason })` | `Promise<void>` | Thực hiện khóa đồng loạt danh sách nhiều tài khoản cùng lúc qua một request duy nhất. |
| `bulkUnbanMutation.mutate` | `(userIds: string[])` | `Promise<void>` | Thực hiện mở khóa đồng loạt danh sách tài khoản được chọn. |
| `createUserMutation.mutate`| `(payload: object)` | `Promise<void>` | Khởi tạo tài khoản người dùng mới từ cổng quản trị, kích hoạt hệ thống tự động sinh mật khẩu tạm thời gửi qua email. |
| `resetPassMutation.mutate` | `(user: object)` | `Promise<void>` | Yêu cầu hệ thống cấp lại mật khẩu đăng nhập ngẫu nhiên cho người dùng khi được yêu cầu hỗ trợ. |
| `exportCSV` | `(onlySelected: boolean = false)` | `void` | Tổng hợp danh sách người dùng thành chuỗi CSV, thêm mã Byte Order Mark (`\uFEFF`) và tạo thẻ tải xuống tệp dữ liệu tự động, tương thích hoàn toàn font tiếng Việt trong Excel. |

---

### 1.4. Phân Hệ Quản Lý Danh Mục Hệ Thống (`src/pages/Categories.jsx`)

| Tên Function | Tham số đầu vào | Kiểu trả về | Mô tả chi tiết chức năng |
| :--- | :--- | :--- | :--- |
| `add` | *Không có* | `void` | Kiểm tra tên danh mục nhập vào và kích hoạt `createMutation` để thêm mới danh mục Thu/Chi mặc định. |
| `del` | `(id: string)` | `void` | Hiển thị hộp thoại xác nhận và kích hoạt `deleteMutation` để xóa bỏ danh mục hệ thống theo ID. |
| `save` | `(id: string)` | `void` | Lưu lại thông tin tên danh mục đã chỉnh sửa trực tiếp trên dòng (inline edit) qua `updateMutation`. |

---

### 1.5. Phân Hệ Báo Cáo, Phân Tích & Giám Sát AI (`Dashboard.jsx`, `SystemAnalytics.jsx`, `OcrMonitor.jsx`)

| Tên Function | File | Tham số đầu vào | Kiểu trả về | Mô tả chi tiết chức năng |
| :--- | :--- | :--- | :--- | :--- |
| `LineChart` | `Dashboard.jsx` | `({ filter: '1H' \| '24H' \| '7N' })` | `JSX.Element` | Vẽ biểu đồ diện tích và đường cong Bézier SVG trực quan hóa lưu lượng tải và hiệu năng CPU/Network của hệ thống. |
| `OcrProgressRing` | `OcrMonitor.jsx` | `({ pct: number, size?: number })` | `JSX.Element` | Vẽ vòng tròn tiến độ hoạt họa SVG hiển thị tỷ lệ thành công của động cơ bóc tách AI OCR với mã màu thích ứng (Xanh/Vàng/Đỏ). |
| `formatDate` | `AuditLogs.jsx` / `OcrMonitor.jsx` | `(dt: string)` | `string` | Định dạng chuỗi ngày tháng theo chuẩn định dạng tiếng Việt (`DD/MM/YYYY HH:mm`). |

---

### 1.6. Phân Hệ Cấu Hình & Nhật Ký Email (`src/pages/EmailLogs.jsx`)

| Tên Function | Tham số đầu vào | Kiểu trả về | Mô tả chi tiết chức năng |
| :--- | :--- | :--- | :--- |
| `formatDateTime` | `(dt: string)` | `string` | Định dạng chuỗi thời gian chi tiết bao gồm cả giây (`DD/MM/YYYY HH:mm:ss`) phục vụ đối soát nhật ký gửi thư. |
| `handleSaveSettings` | `(e: FormEvent)` | `void` | Gửi cấu hình máy chủ SMTP mới (host, port, user, password, tls, sender) lên API lưu trữ. |
| `handleSendTestEmail` | `(e: FormEvent)` | `Promise<void>` | Gửi email kiểm thử tức thời đến hộp thư chỉ định nhằm kiểm tra tính tương thích và kết nối thực tế với máy chủ SMTP. |

---

### 1.7. Thành Phần Giao Diện Chia Sẻ & Hooks (`src/components/ui/index.jsx`, `src/hooks/useToast.js`)

| Tên Function / Component | Vị trí | Tham số / Props | Mô tả chi tiết chức năng |
| :--- | :--- | :--- | :--- |
| `Badge` | `ui/index.jsx` | `{ children, variant }` | Nhãn trạng thái tròn bo góc với các biến thể màu sắc: `default`, `success`, `danger`, `warning`, `info`, `purple`. |
| `Pagination` | `ui/index.jsx` | `{ page, pageSize, total, onPageChange }` | Bộ điều khiển phân trang dữ liệu thông minh, tự động tính toán tổng số trang và hiển thị nút lùi/tiến. |
| `Spinner` | `ui/index.jsx` | `{ size: 'sm' \| 'md' \| 'lg' }` | Vòng xoay báo hiệu trạng thái tải dữ liệu bất đồng bộ. |
| `EmptyState` | `ui/index.jsx` | `{ icon, title, desc }` | Khung hiển thị khi danh sách dữ liệu rỗng kèm biểu tượng trực quan. |
| `StatCard` | `ui/index.jsx` | `{ icon, label, value, sub, color, trend }` | Thẻ thống kê KPI cao cấp hỗ trợ đổ dốc màu (gradient) và chỉ số phần trăm tăng trưởng. |
| `useToast` | `hooks/useToast.js` | *Không có* | Hook quản lý mảng thông báo Toast nổi trên góc màn hình (`addToast`, `removeToast`, `ToastContainer`). |

---

## 2. Danh Mục Các API URLs & Routes Tương Ứng

Tất cả các endpoint dưới đây đều được định tuyến thông qua máy chủ backend FastAPI với tiền tố chung: `${VITE_API_URL}/api/v1`.

| Phương thức (Method) | Đường dẫn API Endpoint | Mô tả chức năng chi tiết | Tham số (Params / Body) | Màn hình sử dụng | Yêu cầu quyền (Role) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/auth/login` | Đăng nhập hệ thống, cấp cặp JWT Access & Refresh Token | Body: `{ email, password }` | `Login.jsx` | Công khai |
| **GET** | `/auth/me` | Lấy thông tin hồ sơ và vai trò của người dùng hiện tại | Header: `Bearer <token>` | `Login.jsx`, `Users.jsx` | Người dùng hợp lệ |
| **POST** | `/auth/refresh` | Cấp Access Token mới thông qua cơ chế Family Rotation | Body: `{ refresh_token }` | `api.js` | Token hợp lệ |
| **POST** | `/auth/logout` | Đăng xuất tài khoản, thu hồi hiệu lực của Refresh Token | Body: `{ refresh_token }` | `api.js`, `DashboardLayout.jsx` | Người dùng hợp lệ |
| **GET** | `/admin/dashboard/stats` | Lấy các chỉ số KPI thời gian thực tổng hợp hệ thống | *Không có* | `Dashboard.jsx` | `ADMIN` |
| **GET** | `/admin/system/analytics` | Báo cáo thống kê vĩ mô tổng lượng thu chi và danh mục | *Không có* | `SystemAnalytics.jsx` | `ADMIN` |
| **GET** | `/admin/system/ocr-monitor` | Lấy thống kê tỷ lệ thành công và trạng thái động cơ AI OCR | *Không có* | `OcrMonitor.jsx` | `ADMIN` |
| **GET** | `/admin/users` | Lấy danh sách tài khoản người dùng có phân trang và tìm kiếm | Query: `page`, `page_size`, `search` | `Users.jsx` | `ADMIN` |
| **POST** | `/admin/users` | Khởi tạo tài khoản mới từ phía quản trị viên | Body: `{ full_name, email, role }` | `Users.jsx` | `ADMIN` |
| **PATCH** | `/admin/users/{id}/ban` | Khóa tài khoản người dùng, chọn thời hạn và thu hồi phiên | Path: `id`, Body: `{ reason, duration, force_logout }` | `Users.jsx` | `ADMIN` |
| **PATCH** | `/admin/users/{id}/unban` | Mở khóa tài khoản người dùng, tùy chọn gửi email | Path: `id`, Body: `{ reason, send_email }` | `Users.jsx` | `ADMIN` |
| **PATCH** | `/admin/users/{id}/role` | Thay đổi quyền hạn tài khoản giữa USER và ADMIN | Path: `id`, Body: `{ role }` | `Users.jsx` | `ADMIN` |
| **POST** | `/admin/users/bulk-ban` | Thực hiện khóa hàng loạt nhiều tài khoản cùng lúc | Body: `{ user_ids, reason }` | `Users.jsx` | `ADMIN` |
| **POST** | `/admin/users/bulk-unban`| Thực hiện mở khóa hàng loạt tài khoản đã chọn | Body: `{ user_ids }` | `Users.jsx` | `ADMIN` |
| **POST** | `/admin/users/{id}/reset-password` | Tự động sinh mật khẩu kích hoạt tạm thời và gửi email | Path: `id` | `Users.jsx` | `ADMIN` |
| **GET** | `/admin/categories` | Lấy danh sách toàn bộ danh mục Thu/Chi mặc định hệ thống | *Không có* | `Categories.jsx` | `ADMIN` |
| **POST** | `/admin/categories` | Thêm mới một danh mục mặc định cấp hệ thống | Body: `{ name, type, icon }` | `Categories.jsx` | `ADMIN` |
| **PATCH** | `/admin/categories/{id}`| Cập nhật tên hoặc thuộc tính của danh mục hệ thống | Path: `id`, Body: `{ name }` | `Categories.jsx` | `ADMIN` |
| **DELETE**| `/admin/categories/{id}`| Xóa bỏ một danh mục mặc định khỏi hệ thống | Path: `id` | `Categories.jsx` | `ADMIN` |
| **GET** | `/admin/audit-logs` | Truy xuất nhật ký kiểm toán quản trị bất biến (Audit Trail) | Query: `page`, `page_size` | `AuditLogs.jsx` | `ADMIN` |
| **GET** | `/admin/email/logs` | Xem lịch sử gửi email toàn hệ thống có lọc đa điều kiện | Query: `page`, `page_size`, `search`, `email_type`, `status` | `EmailLogs.jsx` | `ADMIN` |
| **GET** | `/admin/email/settings`| Đọc thông số cấu hình kết nối máy chủ gửi thư SMTP | *Không có* | `EmailLogs.jsx` | `ADMIN` |
| **PUT** | `/admin/email/settings`| Cập nhật tham số cấu hình máy chủ gửi thư SMTP | Body: `{ smtp_host, smtp_port, smtp_user, smtp_password, smtp_tls, smtp_ssl, emails_from_email, emails_from_name }` | `EmailLogs.jsx` | `ADMIN` |
| **POST** | `/admin/email/test` | Bắn email kiểm thử trực tiếp để nghiệm thu máy chủ SMTP | Body: `{ recipient_email }` | `EmailLogs.jsx` | `ADMIN` |

---

## 3. Các Biến Môi Trường & Bộ Nhớ Phiên (Environment Variables & Session Storage)

### 3.1. Biến Môi Trường Ứng Dụng (`.env` / Vite Build)

| Tên biến | Kiểu dữ liệu | Giá trị mặc định | Mô tả ý nghĩa & Phạm vi áp dụng |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | `string` (URL) | `http://localhost:8000` | Địa chỉ gốc của máy chủ backend API (FastAPI). Vite yêu cầu tiền tố `VITE_` để cho phép biến được nhúng vào mã nguồn client tại thời điểm đóng gói bundle (`import.meta.env.VITE_API_URL`). Trong môi trường Docker hoặc Kubernetes, biến này được cấu hình trỏ tới Domain/Gateway chính thức. |

### 3.2. Cấu Hình Runtime & Cổng Máy Chủ Docker Nginx

| Thông số cấu hình | Giá trị cấu hình | Tệp khai báo | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| `HTTP Port` | `80` | `nginx.conf`, `Dockerfile` | Cổng tiếp nhận lưu lượng HTTP nội bộ bên trong Docker container. |
| `SPA Fallback Rule` | `try_files $uri $uri/ /index.html;` | `nginx.conf` | Cho phép React Router điều hướng các đường dẫn ảo (`/dashboard`, `/users`...) mà không bị lỗi `404 Not Found` từ Nginx. |
| `Node Base Image` | `node:20-alpine` | `Dockerfile` | Môi trường đóng gói mã nguồn và build bundle JS/CSS. |
| `Nginx Base Image`| `nginx:alpine` | `Dockerfile` | Máy chủ web siêu nhẹ đóng vai trò phục vụ static files sau khi build. |

### 3.3. Các Khóa Dữ Liệu Lưu Trữ Trong Trình Duyệt (`sessionStorage`)

| Khóa lưu trữ (Key) | Kiểu dữ liệu | Phạm vi & Mục đích sử dụng |
| :--- | :--- | :--- |
| `admin_access_token` | `string` (JWT) | Lưu Access Token có thời hạn ngắn, tự động gắn vào Header của các API quản trị. Tự hủy khi đóng tab trình duyệt. |
| `admin_refresh_token`| `string` (UUID) | Lưu Refresh Token bí mật, sử dụng khi Access Token hết hạn để xin cấp mới mà không bắt người dùng đăng nhập lại. |
| `admin_fail_count` | `number` | Lưu số lần đăng nhập thất bại liên tiếp trên máy khách phục vụ cơ chế phòng vệ Brute-force. |
| `admin_lock_until` | `number` (Timestamp)| Lưu mốc thời gian hết hiệu lực của trạng thái khóa đăng nhập máy khách. |

---

## 4. Danh Mục Keyword Chức Năng (Functional Keywords & Tags)

```text
├── [BẢO MẬT & XÁC THỰC]
│   ├── JWT Authentication (JSON Web Token)
│   ├── Silent Token Refresh (Tự động xoay vòng Token không gián đoạn)
│   ├── Refresh Token Family Rotation (Chống tấn công tái sử dụng Token)
│   ├── Client-side Brute-force Prevention (Phòng thủ dò mật khẩu)
│   ├── Account Lockout Countdown (Đếm ngược khóa đăng nhập)
│   ├── RBAC - Role Based Access Control (Phân quyền Quản trị & Người dùng)
│   ├── Super Admin Protection (Bảo vệ tài khoản gốc bất khả xâm phạm)
│   └── Protected Route Guard (Chốt chặn điều hướng trang)
│
├── [ĐIỀU HÀNH & QUẢN TRỊ NGƯỜI DÙNG]
│   ├── User Moderation (Điều hành người dùng)
│   ├── Force Logout (Cưỡng chế hủy phiên đăng nhập tức thì)
│   ├── Ban / Unban Lifecycle (Vòng đời khóa và mở khóa tài khoản)
│   ├── Bulk Actions (Thao tác hàng loạt: Khóa/Mở khóa nhiều user)
│   ├── Indeterminate Multi-selection (Chọn toàn bộ / một phần)
│   ├── UTC Time Synchronization (Đồng bộ thời gian UTC tránh lệch múi giờ)
│   ├── Real-time Online Heartbeat (Đo lường người dùng online dưới 10 phút)
│   ├── Temporary Password Dispatch (Cấp mật khẩu kích hoạt tạm thời)
│   └── CSV Export with UTF-8 BOM (Xuất báo cáo tiếng Việt chuẩn Excel)
│
├── [DANH MỤC HỆ THỐNG]
│   ├── Global Default Categories (Danh mục mặc định toàn hệ thống)
│   ├── Income / Expense Classification (Phân loại Danh mục Thu / Chi)
│   ├── Emoji Visual Picker (Bộ chọn biểu tượng cảm xúc trực quan)
│   └── Inline Quick Edit (Chỉnh sửa tên danh mục trực tiếp trên dòng)
│
├── [GIÁM SÁT KỸ THUẬT & ĐO LƯỜNG TỰ ĐỘNG]
│   ├── Real-time Auto Polling (Truy vấn tự động thời gian thực 20s - 30s)
│   ├── Telemetry Metrics (Chỉ số đo lường hiệu năng hệ thống)
│   ├── Google Gemini AI OCR Monitor (Giám sát động cơ bóc tách hóa đơn)
│   ├── OCR Success / Error Rate Ring (Vòng tròn tiến độ SVG tỷ lệ OCR)
│   ├── Recharts Data Visualization (Biểu đồ cột phân tích giao dịch)
│   └── Privacy-first Aggregation (Thống kê vĩ mô không vi phạm dữ liệu cá nhân)
│
├── [KIỂM TOÁN & HỆ THỐNG EMAIL]
│   ├── Immutable Audit Trail (Nhật ký quản trị bất biến, chống ghi đè)
│   ├── SMTP Server Configuration (Cấu hình máy chủ gửi thư Gmail/Custom)
│   ├── Dual-mode Delivery (Chế độ kép: Ghi Log Console hoặc Gửi SMTP Thật)
│   ├── Instant Email Test Sandbox (Hộp cát thử nghiệm gửi email tức thời)
│   └── Email Delivery Logs (Nhật ký phân phối email chi tiết từng trạng thái)
│
└── [KIẾN TRÚC & DEVOPS]
    ├── React 19 Concurrent Features (React 19 hiện đại)
    ├── TanStack React Query Caching & Mutations (Quản lý Server State tối ưu)
    ├── Vite 8 Lightning Bundler (Build siêu tốc)
    ├── Tailwind CSS v4 & Bootstrap Hybrid Styling (Hệ thống giao diện linh hoạt)
    ├── Docker Multi-stage Container (Container hóa đa tầng siêu nhẹ)
    └── Nginx Single Page Application Fallback (Định tuyến SPA mượt mà)
```
