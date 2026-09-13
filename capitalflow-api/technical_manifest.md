# BẢN ĐẶC TẢ KỸ THUẬT TOÀN DỰ ÁN CAPITALFLOW (TECHNICAL MANIFEST)

> **Tài liệu Kỹ thuật**: Liệt kê chi tiết danh sách Functions quan trọng, toàn bộ API URLs / Routes, Biến môi trường và Bảng tra cứu từ khóa chức năng tương ứng.  
> **Phạm vi áp dụng**: Toàn bộ dự án **CapitalFlow** (`D:\code\DoAn_KLCN`) bao gồm Backend API (`capitalflow-api`), Cổng Quản trị Viên (`admin-web`), và Cổng Người Dùng Cuối (`user-web`).

---

## 1. Danh sách các Functions & Methods Quan trọng Toàn Dự Án (Core Functions)

### 1.1. Phân hệ Backend API (`capitalflow-api`)

#### A. Bảo mật, Xác thực & Phiên làm việc (`app/core/security.py`, `app/api/dependencies.py`, `app/api/routes/auth.py`)

| Tên Hàm / Phương thức | Vị trí Module | Tham số chính | Kiểu trả về | Mô tả chức năng & Nghiệp vụ kỹ thuật |
| :--- | :--- | :--- | :--- | :--- |
| `hash_password` | `app/core/security.py` | `password: str` | `str` | Băm mật khẩu người dùng bằng thuật toán Argon2 hiện đại thông qua `pwdlib`. Chống lại các cuộc tấn công bẻ khóa phần cứng GPU/ASIC. |
| `verify_password` | `app/core/security.py` | `password: str`, `hashed_password: str` | `bool` | So khớp mật khẩu thuần với chuỗi mã băm Argon2 đã lưu trong CSDL một cách an toàn. |
| `create_access_token` | `app/core/security.py` | `user_id: str`, `role: str` | `str` | Sinh chuỗi JWT Access Token (HS256) chứa claims `sub`, `role`, `type=access`, và thời hạn `exp` theo biến môi trường (15 phút). |
| `decode_token` | `app/core/security.py` | `token: str` | `dict` | Giải mã và kiểm tra tính hợp lệ của chữ ký số JWT. Ném ngoại lệ nếu token bị sửa đổi hoặc đã hết hạn. |
| `get_db` | `app/api/dependencies.py` | `request: Request` | `Generator[Session]` | FastAPI Dependency khởi tạo DB Session cho mỗi request, gán vào `request.state.db` và đóng kết nối an toàn trong khối `finally`. |
| `get_current_user` | `app/api/dependencies.py` | `request: Request`, `credentials`, `db: Session` | `User` | Xác thực Bearer Token, kiểm tra tài khoản còn tồn tại/chưa bị khóa, cập nhật `last_active_at` (throttle 60s), lưu `request.state.user_id` cho Middleware. |
| `require_admin` | `app/api/dependencies.py` | `current_user: User` | `User` | Kiểm tra quyền quản trị (`role == UserRole.ADMIN`). Ném ra ngoại lệ `HTTPException(403)` nếu là người dùng thông thường. |
| `_create_refresh_token` | `app/api/routes/auth.py` | `db`, `user_id`, `family_id`, `parent_token_id`, `device_name`, `ip_address`, `user_agent` | `tuple[str, UUID]` | Tạo mã chuỗi Refresh Token ngẫu nhiên URL-safe, lưu giá trị băm SHA-256 vào CSDL kèm thông tin họ phiên `family_id` và thiết bị. |
| `_hash_token` | `app/api/routes/auth.py` | `raw_token: str` | `str` | Băm chuỗi Refresh Token bằng SHA-256 trước khi truy vấn hoặc lưu trữ trong CSDL. |

#### B. Xử lý Giao dịch & Ngân sách (`app/services/transaction_service.py`)

| Tên Hàm / Phương thức | Tham số chính | Kiểu trả về | Mô tả chức năng & Nghiệp vụ kỹ thuật |
| :--- | :--- | :--- | :--- |
| `_verify_account_ownership` | `db: Session`, `account_id: UUID`, `user_id: UUID` | `Account` | **IDOR Guard**: Kiểm tra tài khoản ví có tồn tại, đang kích hoạt và thuộc sở hữu của user hay không. Ném lỗi 400 nếu vi phạm. |
| `_verify_category_ownership` | `db: Session`, `category_id: UUID`, `user_id: UUID` | `None` | **IDOR Guard**: Kiểm tra danh mục chi tiêu có thuộc về user hiện tại hoặc là danh mục chung của hệ thống (`owner_user_id IS NULL`). |
| `_adjust_balance` | `db: Session`, `account_id: UUID`, `amount: Decimal`, `tx_type: TransactionType`, `is_revert: bool` | `None` | Điều chỉnh số dư ví tiền. Sử dụng `with_for_update()` để khóa hàng (Pessimistic Locking). Hỗ trợ cả chế độ cộng/trừ thông thường và hoàn ứng (`is_revert=True`). |
| `create_transaction` | `db: Session`, `user_id: UUID`, `source: TransactionSource`, `**kwargs` | `Transaction` | Khởi tạo giao dịch mới, áp dụng IDOR Guard, chuẩn hóa dấu số tiền theo quy tắc CSDL (`INCOME > 0`, `EXPENSE < 0`), cập nhật số dư ví và lưu CSDL. |
| `update_transaction` | `db: Session`, `tx_id: UUID`, `user_id: UUID`, `payload: TransactionUpdate` | `Transaction` | Cập nhật giao dịch: Hoàn ứng số dư cũ trước, kiểm tra quyền sở hữu ví/danh mục mới, cập nhật thuộc tính và áp dụng số dư mới. |
| `delete_transaction` | `db: Session`, `tx_id: UUID`, `user_id: UUID` | `None` | Xóa giao dịch khỏi hệ thống và hoàn trả lại số dư tài khoản về trạng thái trước đó. |
| `transfer_money` | `db: Session`, `user_id: UUID`, `from_account_id: UUID`, `to_account_id: UUID`, `amount: Decimal`, `...` | `tuple[Transaction, Transaction]` | **Chuyển tiền nguyên tử (ACID)**: Khóa 2 ví theo thứ tự UUID chuẩn hóa để chống Deadlock; kiểm tra số dư khả dụng ví nguồn; trừ ví nguồn, cộng ví đích; sinh 2 giao dịch liên kết qua `transfer_pair_id`. |
| `check_budget_alerts_background`| `db: Session`, `user_id: UUID`, `txn: Transaction` | `None` | **Cảnh báo ngân sách chạy ngầm**: Tính toán tổng chi tiêu thực tế trong kỳ; nếu vượt ngưỡng $\ge 80\%$ hoặc $\ge 100\%$, kích hoạt hàm gửi email cảnh báo của `EmailService`. |

#### C. Bóc tách Hóa đơn AI OCR & Xử lý Dữ liệu (`app/services/gemini_service.py`, `app/api/routes/invoices.py`)

| Tên Hàm / Phương thức | Vị trí Module | Tham số chính | Kiểu trả về | Mô tả chức năng & Nghiệp vụ kỹ thuật |
| :--- | :--- | :--- | :--- | :--- |
| `run_gemini_ocr` | `app/services/gemini_service.py` | `file_bytes: bytes`, `mime_type: str` | `dict` | Gửi dữ liệu file hóa đơn sang Google Gemini Vision với cơ chế tự động **Fallback**: Thử `gemini-3.5-flash-lite` trước, nếu thất bại tự động gọi `gemini-3.6-flash`. |
| `_call_gemini_model` | `app/services/gemini_service.py` | `model_name: str`, `file_bytes: bytes`, `mime_type: str` | `dict` | Mã hóa Base64 tệp tin, truyền Prompt kế toán tiếng Việt chuyên sâu, gọi HTTP API của Google AI và làm sạch cú pháp JSON kết quả. |
| `_parse_amount` | `app/api/routes/invoices.py` | `raw: any` | `Decimal` | Xử lý và chuẩn hóa chuỗi số tiền Việt Nam (loại bỏ "đ", "VND", phân tách dấu chấm/dấu phẩy) sang kiểu `Decimal` an toàn. |
| `_parse_date` | `app/api/routes/invoices.py` | `raw: any` | `date \| None` | Nhận diện và chuyển đổi các định dạng ngày tháng tiếng Việt và quốc tế (`dd/MM/yyyy`, `yyyy-MM-dd`, `dd-MM-yyyy`). |
| `_safe_delete_invoice` | `app/api/routes/invoices.py` | `db: Session`, `invoice: Invoice` | `None` | Xóa hóa đơn an toàn với Foreign Key SQL Server: Gỡ liên kết `Transaction.invoice_id = None`, xóa các mặt hàng `InvoiceItem` và lịch sử `OcrJob`, xóa file vật lý trên đĩa và xóa bản ghi `Invoice`. |
| `_check_duplicate` | `app/api/routes/invoices.py` | `db: Session`, `user_id: UUID`, `invoice: Invoice` | `tuple[bool, str \| None]` | Đối chiếu hóa đơn mới với các hóa đơn đã `CONFIRMED` theo MST + Số hóa đơn hoặc Tên người bán + Ngày + Số tiền. |

#### D. Gửi Email & Thông báo Đa Chế độ (`app/services/email_service.py`)

| Tên Phương thức | Tham số chính | Kiểu trả về | Mô tả chức năng & Nghiệp vụ kỹ thuật |
| :--- | :--- | :--- | :--- |
| `send_email_sync` | `recipient: str`, `subject: str`, `html_content: str`, `email_type: str`, `...` | `bool` | **Dual-Mode Engine**: Tự động nhận diện cấu hình SMTP. Nếu có SMTP gửi qua mạng thật (STARTTLS/SSL); nếu chưa cấu hình thì ghi log Console và lưu bản preview HTML vào thư mục `uploads/emails/`. Lưu kết quả vào `EmailLog`. |
| `_save_preview_html` | `recipient: str`, `email_type: str`, `html_content: str` | `str \| None` | Ghi tệp HTML xem trước vào đĩa trong môi trường Development/Testing. |
| `_log_delivery` | `recipient: str`, `subject: str`, `email_type: str`, `status: str`, `...` | `None` | Ghi nhận nhật ký trạng thái chuyển phát email (`SENT`, `LOGGED_DEV`, `FAILED`) vào bảng `email_logs`. |
| `send_password_reset_otp` | `recipient`, `full_name`, `otp_code`, `...` | `bool` | Tạo và gửi mẫu email chứa mã xác thực OTP 6 số (hiệu lực 10 phút). |
| `send_welcome_email` | `recipient`, `full_name`, `...` | `bool` | Gửi email chào mừng thành viên mới đăng ký tài khoản thành công. |
| `send_budget_alert_email` | `recipient`, `full_name`, `category_name`, `budget_amount`, `spent_amount`, `percentage`, `...` | `bool` | Gửi cảnh báo định mức chi tiêu khi đạt ngưỡng 80% hoặc vượt 100% ngân sách. |
| `send_account_created_by_admin_email` | `recipient`, `full_name`, `temp_password`, `role`, `...` | `bool` | Gửi thông tin tài khoản và mật khẩu tạm thời khi Quản trị viên tạo mới người dùng. |
| `send_temporary_password_email` | `recipient`, `full_name`, `temp_password`, `...` | `bool` | Gửi mật khẩu tạm thời khi Admin đặt lại mật khẩu cho thành viên. |
| `send_account_banned_email` | `recipient`, `full_name`, `reason`, `...` | `bool` | Gửi email thông báo tài khoản người dùng đã bị khóa kèm lý do. |
| `send_account_unbanned_email` | `recipient`, `full_name`, `...` | `bool` | Gửi email thông báo tài khoản người dùng đã được mở khóa hoạt động trở lại. |
| `send_role_updated_email` | `recipient`, `full_name`, `new_role`, `...` | `bool` | Gửi email thông báo thay đổi quyền hạn/vai trò tài khoản (USER / ADMIN). |
| `send_test_email` | `recipient`, `subject`, `message`, `...` | `bool` | Gửi email thử nghiệm kiểm tra tính sẵn sàng của máy chủ SMTP. |

#### E. Middleware & Kiểm toán Hệ thống (`app/api/middleware/audit_middleware.py`)

| Tên Hàm / Phương thức | Tham số chính | Kiểu trả về | Mô tả chức năng & Nghiệp vụ kỹ thuật |
| :--- | :--- | :--- | :--- |
| `AuditMiddleware.dispatch` | `request: Request`, `call_next: Callable` | `Response` | Đón bắt các HTTP Method làm thay đổi dữ liệu (`POST`, `PUT`, `PATCH`, `DELETE`), bỏ qua các đường dẫn hệ thống/tài liệu, kích hoạt ghi log độc lập. |
| `_write_audit_log` | `user_id`, `method`, `path`, `status_code`, `query_params`, `ip_address`, `user_agent`, `request_id` | `None` | Mở một **Independent DB Session** riêng biệt, ghi nhật ký vào bảng `audit_logs`. Không bao giờ làm gián đoạn response của người dùng nếu gặp lỗi ghi log. |
| `_infer_action` | `method: str`, `path: str` | `str` | Tự động phân tích phương thức HTTP và tài nguyên URL để suy luận mã hành động (ví dụ: `CREATE_TRANSACTION`, `DELETE_ACCOUNT`). |
| `_extract_entity` | `path: str` | `tuple[str \| None, UUID \| None]` | Trích xuất tên loại thực thể và UUID của đối tượng chịu tác động từ đường dẫn URL. |
| `_get_client_ip` | `request: Request` | `str` | Bóc tách địa chỉ IP thực tế của Client, hỗ trợ việc phân giải qua Header `X-Forwarded-For` khi chạy sau Proxy/Reverse Proxy. |

---

### 1.2. Phân hệ Cổng Quản trị (`frontend/admin-web`)

#### A. Quản lý Mạng & Refresh Token (`src/services/api.js`)

| Tên Hàm / Thuộc tính | Tham số chính | Kiểu trả về | Mô tả chức năng & Nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `processQueue` | `error: Error, token: string \| null` | `void` | Duyệt qua hàng đợi các request bị tạm giữ do Access Token hết hạn, thực thi lại hoặc từ chối toàn bộ. |
| `api.interceptors.request` | `config: AxiosRequestConfig` | `AxiosRequestConfig` | Tự động đính kèm `Authorization: Bearer <admin_access_token>` vào header của mọi request gọi đến API. |
| `api.interceptors.response`| `response / error` | `Promise<any>` | Chặn lỗi `401 Unauthorized`, gọi `/auth/refresh` bằng `admin_refresh_token`, tự động xoay vòng token và phát lại request gốc trong suốt. |
| `authApi.login` | `({ email, password })` | `Promise<AxiosResponse>` | Đăng nhập tài khoản Quản trị viên. |
| `usersApi.getAll` | `(params: object)` | `Promise<AxiosResponse>` | Lấy danh sách toàn bộ người dùng có phân trang, tìm kiếm và lọc trạng thái. |
| `usersApi.ban` / `usersApi.unban` | `(id: string, payload: object)` | `Promise<AxiosResponse>` | Khóa hoặc mở khóa tài khoản người dùng đơn lẻ kèm lý do. |
| `usersApi.bulkBan` / `bulkUnban` | `(payload: object)` | `Promise<AxiosResponse>` | Khóa hoặc mở khóa tài khoản hàng loạt nhiều người dùng. |
| `emailApi.getLogs` | `(params: object)` | `Promise<AxiosResponse>` | Truy vấn lịch sử gửi email toàn hệ thống có phân trang. |
| `systemApi.getOverview` | *Không có* | `Promise<AxiosResponse>` | Lấy chỉ số KPIs tổng quan hệ thống: Tổng số người dùng, tỷ lệ hoạt động, tỷ lệ thành công OCR. |

#### B. Xác thực, Quản lý Người dùng & Trực quan hóa (`Login.jsx`, `Users.jsx`, `OcrMonitor.jsx`, `Dashboard.jsx`)

| Tên Hàm / Phương thức | File Nguồn | Tham số chính | Kiểu trả về | Mô tả chức năng & Nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| `handleLogin` | `src/pages/Login.jsx` | `e: FormEvent` | `Promise<void>` | Gửi đăng nhập, thẩm định quyền `ADMIN` qua `GET /auth/me`, lưu token vào `sessionStorage` và chuyển hướng tới `/dashboard`. |
| `triggerShake` | `src/pages/Login.jsx` | `focusAfter: boolean` | `void` | Kích hoạt hiệu ứng hoạt họa rung lắc khung đăng nhập báo hiệu lỗi thông tin. |
| `ProtectedRoute` | `src/components/ProtectedRoute.jsx`| `{ children }` | `JSX.Element` | Chốt kiểm soát route: Kiểm tra token hợp lệ trong `sessionStorage`, nếu chưa có sẽ chuyển về `/`. |
| `parseDateUTC` | `src/pages/Users.jsx` | `dt: string \| Date` | `Date \| null` | Chuẩn hóa chuỗi thời gian UTC an toàn, tự động bổ sung hậu tố `Z` để triệt tiêu hiện tượng lệch múi giờ trên trình duyệt Việt Nam. |
| `formatRelativeTime` | `src/pages/Users.jsx` | `dt: string, now: number` | `string` | Định dạng thời gian tương đối bằng tiếng Việt chuẩn ngữ pháp (*"Vừa xong"*, *"5 phút trước"*, *"Hôm qua"*). |
| `isUserOnline` | `src/pages/Users.jsx` | `user: object, now: number` | `boolean` | Xác định người dùng có đang trực tuyến hay không dựa trên chênh lệch giữa hiện tại và `last_active_at` ($\le 10$ phút). |
| `exportCSV` | `src/pages/Users.jsx` | `onlySelected: boolean` | `void` | Tổng hợp danh sách người dùng thành chuỗi CSV, chèn mã Byte Order Mark (`\uFEFF`) giúp hiển thị chuẩn tiếng Việt có dấu trong Excel. |
| `OcrProgressRing` | `src/pages/OcrMonitor.jsx` | `{ pct: number, size?: number }` | `JSX.Element` | Vẽ vòng tròn tiến độ SVG hoạt họa hiển thị tỷ lệ thành công bóc tách hóa đơn AI với màu sắc thích ứng (Xanh/Vàng/Đỏ). |
| `LineChart` | `src/pages/Dashboard.jsx` | `{ filter: '1H' \| '24H' \| '7N' }` | `JSX.Element` | Vẽ biểu đồ diện tích đường cong Bézier SVG trực quan hóa lưu lượng tải hệ thống. |
| `useToast` | `src/hooks/useToast.js` | *Custom Hook* | `object` | Cung cấp các hàm phát thông báo Toast nổi: `toast.success`, `toast.error`, `toast.warning`, `toast.info`. |

---

### 1.3. Phân hệ Cổng Người Dùng Cuối (`frontend/user-web`)

#### A. Quản lý Mạng & Token Interceptor (`lib/api.ts`)

| Tên Hàm / Phương thức | Tham số chính | Kiểu trả về | Mô tả chức năng & Nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `setupInterceptors` | `instance: AxiosInstance` | `void` | Thiết lập Request/Response Interceptors cho Axios: Gắn Token và tự động refresh token khi gặp mã lỗi 401. |
| `refreshAuthToken` | *Không có* | `Promise<string \| null>` | Gửi Refresh Token lấy Access Token mới, lưu vào `localStorage` và giải phóng hàng đợi request. |
| `logoutAndRedirect` | *Không có* | `void` | Xóa sạch token trên trình duyệt và chuyển hướng người dùng về trang `/login`. |

#### B. Trích xuất Hóa đơn & Tiện ích Dữ liệu (`lib/gemini.ts`, `lib/ocr-parse.ts`, `lib/ui-helpers.ts`)

| Tên Hàm / Phương thức | File Nguồn | Tham số chính | Kiểu trả về | Mô tả chức năng & Nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| `extractInvoiceData` | `lib/gemini.ts` | `fileBase64: string, mimeType: string` | `Promise<object>` | Gửi yêu cầu phân tích hóa đơn trực tiếp từ Client tới Google Gemini Vision API (chế độ dự phòng client-side). |
| `cleanCurrency` | `lib/ocr-parse.ts` | `val: any` | `number` | Loại bỏ các ký tự tiền tệ ("đ", "VND", khoảng trắng, dấu chấm/phẩy) để chuyển về số thực an toàn. |
| `parseVietnameseDate` | `lib/ocr-parse.ts` | `dateStr: string` | `string \| null` | Phân giải các định dạng ngày tháng tiếng Việt sang chuẩn `YYYY-MM-DD`. |
| `validateInvoiceItems` | `lib/ocr-parse.ts` | `items: any[]` | `InvoiceItem[]` | Kiểm tra tính hợp lệ và cấu trúc các dòng mặt hàng hóa đơn được bóc tách. |
| `formatCurrencyVND` | `lib/ui-helpers.ts` | `amount: number` | `string` | Định dạng số tiền sang chuẩn hiển thị Việt Nam Đồng (ví dụ: `150.000 ₫`). |
| `getHashColor` | `lib/ui-helpers.ts` | `str: string` | `string` | Băm tên danh mục hoặc tên ví để tạo mã màu hiển thị ngẫu nhiên nhưng cố định. |

#### C. Nghiệp vụ Giao diện Người Dùng (`app/(dashboard)/*`)

| Tên Hàm / Handler | File Nguồn | Tham số chính | Kiểu trả về | Mô tả chức năng & Nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| `handleFileUpload` | `components/UploadZone.tsx` | `files: FileList \| File[]` | `Promise<void>` | Tiếp nhận tệp kéo thả hoặc chọn từ máy tính, kiểm tra định dạng và kích thước ($\le 10$MB), gọi `POST /api/v1/invoices`. |
| `handleBatchOcr` | `app/(dashboard)/ocr/page.tsx` | `invoiceIds: string[]` | `Promise<void>` | Gửi yêu cầu quét AI hàng loạt (tối đa 5 hóa đơn) và hiển thị tiến độ bóc tách. |
| `handleInlineItemEdit` | `components/ResultsTable.tsx` | `itemId: string, field: string, value: any` | `void` | Cho phép người dùng chỉnh sửa nội tuyến trực tiếp trên bảng kết quả bóc tách trước khi xác nhận. |
| `handleConfirmInvoice` | `app/(dashboard)/ocr/page.tsx` | `invoiceId: string, payload: object` | `Promise<void>` | Gửi xác nhận hóa đơn, chỉ định ví và danh mục để tự động hạch toán giao dịch vào sổ cái. |
| `calculateNetWorth` | `app/(dashboard)/page.tsx` | `accounts: Account[]` | `number` | Tính toán tổng tài sản ròng bằng tổng số dư của toàn bộ các tài khoản ví đang hoạt động. |

---

## 2. Danh mục Toàn bộ API URLs & Routes Toàn Hệ Thống

### 2.1. Phân hệ Backend API (`capitalflow-api` - 45 Endpoints dưới `/api/v1`)

#### A. Phân hệ Hệ thống (System)
| Method | Đường dẫn API | Xác thực | Rate Limit | Tóm tắt Chức năng |
| :---: | :--- | :---: | :---: | :--- |
| `GET` | `/health` | Không | Không | Kiểm tra trạng thái sẵn sàng và phiên bản hệ sinh thái API (Health Check). |
| `GET` | `/docs` | Không | Không | Giao diện tài liệu trực quan tương tác Swagger UI. |
| `GET` | `/redoc` | Không | Không | Giao diện tài liệu chuẩn ReDoc. |

#### B. Phân hệ Xác thực & Phiên làm việc (`/api/v1/auth`)
| Method | Đường dẫn API | Xác thực | Rate Limit | Tóm tắt Chức năng |
| :---: | :--- | :---: | :---: | :--- |
| `POST` | `/api/v1/auth/register` | Không | Không | Đăng ký tài khoản người dùng mới và tự động gửi email chào mừng. |
| `POST` | `/api/v1/auth/login` | Không | `10/min` | Đăng nhập hệ thống, cấp Access Token và Refresh Token xoay vòng. |
| `POST` | `/api/v1/auth/forgot-password` | Không | `5/min` | Yêu cầu cấp mã OTP 6 số về email để xác nhận đổi mật khẩu (10 phút). |
| `POST` | `/api/v1/auth/verify-otp` | Không | Không | Kiểm tra tính hợp lệ và thời hạn hiệu lực của mã OTP nhập vào. |
| `POST` | `/api/v1/auth/reset-password` | Không | Không | Xác thực mã OTP và cập nhật mật khẩu mới cho người dùng. |
| `POST` | `/api/v1/auth/refresh` | Không | Không | Đổi Refresh Token lấy Access Token mới (cơ chế Family Token Rotation). |
| `POST` | `/api/v1/auth/logout` | Không | Không | Đăng xuất người dùng và thu hồi hiệu lực của Refresh Token hiện tại. |
| `GET` | `/api/v1/auth/sessions` | Bearer Token | Không | Lấy danh sách các phiên đăng nhập đang hoạt động của người dùng. |
| `GET` | `/api/v1/auth/me` | Bearer Token | Không | Lấy thông tin chi tiết hồ sơ người dùng đang đăng nhập. |
| `POST` | `/api/v1/auth/first-time-password` | Bearer Token | Không | Thiết lập mật khẩu chính thức lần đầu tiên sau khi được Admin cấp tài khoản. |
| `POST` | `/api/v1/auth/change-password` | Bearer Token | Không | Đổi mật khẩu cá nhân của người dùng bằng cách xác thực mật khẩu hiện tại. |

#### C. Phân hệ Tài khoản Ví (`/api/v1/accounts`)
| Method | Đường dẫn API | Xác thực | Rate Limit | Tóm tắt Chức năng |
| :---: | :--- | :---: | :---: | :--- |
| `GET` | `/api/v1/accounts` | Bearer Token | Không | Lấy danh sách các tài khoản ví tài chính đang hoạt động (`is_active=True`). |
| `POST` | `/api/v1/accounts` | Bearer Token | Không | Tạo mới tài khoản ví (tiền mặt, ngân hàng, ví điện tử, thẻ tín dụng). |
| `PATCH`| `/api/v1/accounts/{acc_id}` | Bearer Token | Không | Cập nhật thông tin tài khoản ví (tên, số dư, ghi chú). |
| `DELETE`|`/api/v1/accounts/{acc_id}`| Bearer Token | Không | Xóa mềm tài khoản ví (cảnh báo HTTP 409 nếu còn số dư, `?force=true` để xóa). |

#### D. Phân hệ Danh mục Thu/Chi (`/api/v1/categories`)
| Method | Đường dẫn API | Xác thực | Rate Limit | Tóm tắt Chức năng |
| :---: | :--- | :---: | :---: | :--- |
| `GET` | `/api/v1/categories` | Bearer Token | Không | Lấy danh sách danh mục thu/chi (kết hợp danh mục hệ thống và tùy chỉnh). |
| `POST` | `/api/v1/categories` | Bearer Token | Không | Tạo danh mục thu chi tùy chỉnh mới cho người dùng hiện tại. |

#### E. Phân hệ Sổ cái Giao dịch (`/api/v1/transactions`)
| Method | Đường dẫn API | Xác thực | Rate Limit | Tóm tắt Chức năng |
| :---: | :--- | :---: | :---: | :--- |
| `GET` | `/api/v1/transactions` | Bearer Token | Không | Phân trang danh sách giao dịch, hỗ trợ lọc theo loại, ví, danh mục, thời gian. |
| `POST` | `/api/v1/transactions` | Bearer Token | Không | Tạo giao dịch thu/chi, cập nhật số dư ví và quét cảnh báo ngân sách ngầm. |
| `POST` | `/api/v1/transactions/transfer` | Bearer Token | Không | Chuyển tiền nguyên tử (ACID) giữa hai ví cá nhân, chống Deadlock. |
| `PATCH`| `/api/v1/transactions/{tx_id}`| Bearer Token | Không | Cập nhật thông tin giao dịch và tự động hoàn ứng, điều chỉnh lại số dư ví. |
| `DELETE`|`/api/v1/transactions/{tx_id}`| Bearer Token | Không | Xóa giao dịch tài chính và hoàn trả số dư ví về trạng thái ban đầu. |

#### F. Phân hệ Ngân sách Chi tiêu (`/api/v1/budgets`)
| Method | Đường dẫn API | Xác thực | Rate Limit | Tóm tắt Chức năng |
| :---: | :--- | :---: | :---: | :--- |
| `GET` | `/api/v1/budgets` | Bearer Token | Không | Danh sách ngân sách kèm tiến độ sử dụng và số tiền đã chi (qua SQL View). |
| `GET` | `/api/v1/budgets/{budget_id}` | Bearer Token | Không | Xem chi tiết tiến độ chi tiêu của một ngân sách cụ thể. |
| `POST` | `/api/v1/budgets` | Bearer Token | Không | Tạo mới hạn mức ngân sách định kỳ cho một danh mục chi tiêu. |
| `PATCH`| `/api/v1/budgets/{budget_id}` | Bearer Token | Không | Điều chỉnh hạn mức ngân sách hoặc khoảng thời gian áp dụng. |
| `DELETE`|`/api/v1/budgets/{budget_id}` | Bearer Token | Không | Xóa bỏ một kế hoạch ngân sách khỏi hệ thống. |

#### G. Phân hệ Tổng quan & Phân tích (`/api/v1/dashboard`, `/api/v1/analytics`)
| Method | Đường dẫn API | Xác thực | Rate Limit | Tóm tắt Chức năng |
| :---: | :--- | :---: | :---: | :--- |
| `GET` | `/api/v1/dashboard` | Bearer Token | Không | Dữ liệu màn hình chính: Tổng tài sản ròng, thu/chi tháng, dòng tiền, 5 giao dịch gần nhất. |
| `GET` | `/api/v1/analytics` | Bearer Token | Không | Báo cáo chi tiết dòng tiền tháng, tỷ trọng chi tiêu danh mục và xu hướng 6 tháng. |

#### H. Phân hệ Quản lý Hóa đơn & AI OCR (`/api/v1/invoices`)
| Method | Đường dẫn API | Xác thực | Rate Limit | Tóm tắt Chức năng |
| :---: | :--- | :---: | :---: | :--- |
| `POST` | `/api/v1/invoices` | Bearer Token | Không | Tải lên tệp hóa đơn (JPG, PNG, WEBP, PDF tối đa 10MB) -> Trạng thái `UPLOADED`. |
| `GET` | `/api/v1/invoices` | Bearer Token | Không | Lấy danh sách hóa đơn phân trang, có thể lọc theo trạng thái. |
| `GET` | `/api/v1/invoices/{invoice_id}`| Bearer Token | Không | Chi tiết hóa đơn, danh sách mặt hàng đã trích xuất và cờ cảnh báo trùng lặp. |
| `GET` | `/api/v1/invoices/{invoice_id}/file`| Bearer Token | Không | Tải về/Xem trước file ảnh hoặc PDF gốc của hóa đơn. |
| `GET` | `/api/v1/invoices/{invoice_id}/items`| Bearer Token | Không | Lấy danh sách chi tiết các mặt hàng/dòng chi phí của hóa đơn. |
| `POST` | `/api/v1/invoices/{invoice_id}/ocr` | Bearer Token | `15/min` | Kích hoạt Google Gemini AI nhận diện và trích xuất dữ liệu hóa đơn đơn lẻ. |
| `POST` | `/api/v1/invoices/batch-ocr` | Bearer Token | `15/min` | Quét AI hàng loạt nhiều hóa đơn cùng lúc (tối đa 5 hóa đơn/lần). |
| `POST` | `/api/v1/invoices/{invoice_id}/confirm`| Bearer Token | Không | Xác nhận dữ liệu bóc tách, tự động hạch toán giao dịch `EXPENSE` vào ví. |
| `DELETE`|`/api/v1/invoices/{invoice_id}`| Bearer Token | Không | Xóa vĩnh viễn hóa đơn và tệp vật lý, tự động gỡ FK ràng buộc an toàn. |
| `POST` | `/api/v1/invoices/batch-delete`| Bearer Token | Không | Xóa an toàn hàng loạt hóa đơn (không giới hạn số lượng). |

#### I. Phân hệ Quản trị Hệ thống (`/api/v1/admin`)
| Method | Đường dẫn API | Xác thực | Rate Limit | Tóm tắt Chức năng |
| :---: | :--- | :---: | :---: | :--- |
| `GET` | `/api/v1/admin/overview` | Admin Token | Không | Thống kê chỉ số KPI toàn hệ thống (Active/Banned Users, Tỷ lệ OCR thành công). |
| `GET` | `/api/v1/admin/users` | Admin Token | Không | Danh sách người dùng toàn hệ thống có phân trang, tìm kiếm và lọc. |
| `GET` | `/api/v1/admin/users/{user_id}` | Admin Token | Không | Xem chi tiết một người dùng kèm thống kê số ví, giao dịch, hóa đơn. |
| `POST` | `/api/v1/admin/users` | Admin Token | Không | Admin tạo tài khoản mới, tự động sinh mật khẩu tạm thời và gửi email kích hoạt. |
| `POST` | `/api/v1/admin/users/{user_id}/reset-password`| Admin Token | Không | Admin cấp lại mật khẩu tạm thời mới và gửi thẳng đến email người dùng. |
| `PATCH`| `/api/v1/admin/users/{user_id}/ban` | Admin Token | Không | Khóa tài khoản người dùng, ghi Audit Log và gửi email thông báo. |
| `PATCH`| `/api/v1/admin/users/{user_id}/unban` | Admin Token | Không | Mở khóa tài khoản người dùng, ghi Audit Log và gửi email thông báo. |
| `PATCH`| `/api/v1/admin/users/{user_id}/role` | Admin Token | Không | Cập nhật vai trò người dùng (`USER` hoặc `ADMIN`), gửi email thông báo. |
| `POST` | `/api/v1/admin/users/bulk-ban` | Admin Token | Không | Khóa tài khoản người dùng hàng loạt kèm lý do và gửi email thông báo. |
| `POST` | `/api/v1/admin/users/bulk-unban` | Admin Token | Không | Mở khóa hàng loạt tài khoản người dùng và gửi email thông báo. |
| `POST` | `/api/v1/admin/email/test` | Admin Token | Không | Gửi email kiểm thử kết nối máy chủ gửi thư SMTP. |
| `GET` | `/api/v1/admin/email/logs` | Admin Token | Không | Danh sách nhật ký gửi email toàn hệ thống có phân trang và bộ lọc. |
| `GET` | `/api/v1/admin/email/settings` | Admin Token | Không | Xem các thông số cấu hình máy chủ SMTP hiện tại. |
| `PUT` | `/api/v1/admin/email/settings` | Admin Token | Không | Cập nhật cấu hình SMTP trực tiếp từ giao diện Admin Portal (Hot-Reload). |
| `GET` | `/api/v1/admin/audit-logs` | Admin Token | Không | Xem nhật ký kiểm toán các thao tác của Quản trị viên trong hệ thống. |
| `GET` | `/api/v1/admin/system/analytics` | Admin Token | Không | Thống kê vận hành hệ thống tổng hợp (top chi tiêu, người dùng active trong tháng). |
| `GET` | `/api/v1/admin/system/ocr-monitor` | Admin Token | Không | Giám sát hiệu suất vận hành dịch vụ OCR, tỷ lệ lỗi và danh sách lỗi gần nhất. |

---

### 2.2. Tuyến đường Giao diện Cổng Quản trị (`admin-web` - React Router DOM)

| Đường dẫn Tuyến | Component Màn hình | Yêu cầu Quyền | Tóm tắt Chức năng Màn hình |
| :--- | :--- | :---: | :--- |
| `/` | `src/pages/Login.jsx` | Công khai | Cổng đăng nhập Quản trị viên, hoạt họa dây đèn bàn kéo thả, chống Brute-force. |
| `/dashboard` | `src/pages/Dashboard.jsx` | `ADMIN` Token | Bảng điều khiển KPI toàn hệ thống, biểu đồ lưu lượng SVG, cảnh báo vận hành. |
| `/users` | `src/pages/Users.jsx` | `ADMIN` Token | Quản lý người dùng, Khóa/Mở khóa đơn & hàng loạt, Đổi vai trò, Xuất file CSV tiếng Việt. |
| `/categories` | `src/pages/Categories.jsx` | `ADMIN` Token | Quản lý danh mục Thu/Chi mặc định hệ thống kèm bảng chọn emoji trực quan. |
| `/system-analytics` | `src/pages/SystemAnalytics.jsx` | `ADMIN` Token | Báo cáo vận hành vĩ mô, biểu đồ cột Recharts, số liệu người dùng tích cực. |
| `/ocr-monitor` | `src/pages/OcrMonitor.jsx` | `ADMIN` Token | Bảng giám sát động cơ AI OCR Gemini, vòng tròn tiến độ SVG, danh sách lỗi gần nhất. |
| `/audit-logs` | `src/pages/AuditLogs.jsx` | `ADMIN` Token | Nhật ký kiểm toán bảo mật bất biến (Audit Trail) của toàn bộ Quản trị viên. |
| `/email-logs` | `src/pages/EmailLogs.jsx` | `ADMIN` Token | Lịch sử chuyển phát email, kiểm thử gửi thư trực tiếp và cấu hình tham số SMTP. |
| `/settings` | `src/pages/Settings.jsx` | `ADMIN` Token | Thiết lập bảo mật, cấu hình sao lưu dữ liệu và chế độ bảo trì hệ thống. |

---

### 2.3. Tuyến đường Giao diện Cổng Người Dùng Cuối (`user-web` - Next.js App Router)

| Tuyến đường (URL Path) | Component Tương ứng | Yêu cầu Quyền | Tóm tắt Chức năng Màn hình |
| :--- | :--- | :---: | :--- |
| `/login` | `app/login/page.tsx` | Công khai | Đăng nhập, Đăng ký thành viên, Quên mật khẩu qua OTP email, Đổi mật khẩu lần đầu. |
| `/` | `app/(dashboard)/page.tsx` | Người dùng đã đăng nhập | Tổng quan tài chính: Tổng tài sản ròng, dòng tiền tháng, 5 giao dịch gần nhất. |
| `/accounts` | `app/(dashboard)/accounts/page.tsx` | Người dùng đã đăng nhập | Quản lý ví tài chính, ngân hàng, ví điện tử, cập nhật số dư tức thời. |
| `/transactions` | `app/(dashboard)/transactions/page.tsx` | Người dùng đã đăng nhập | Sổ cái chi tiết: Bảng kê toàn bộ giao dịch, lọc theo ví/danh mục/ngày, tìm kiếm từ khóa. |
| `/budgets` | `app/(dashboard)/budgets/page.tsx` | Người dùng đã đăng nhập | Quản trị ngân sách: Hạn mức chi tiêu hàng tháng, thanh tiến độ, cảnh báo chạm ngưỡng. |
| `/ocr` | `app/(dashboard)/ocr/page.tsx` | Người dùng đã đăng nhập | **Invoice OCR Studio**: Kéo thả tệp hóa đơn, xem trước ảnh/PDF, bóc tách AI, kiểm tra trùng lặp và xác nhận ghi sổ cái. |
| `/categories` | `app/(dashboard)/categories/page.tsx` | Người dùng đã đăng nhập | Quản lý danh mục thu/chi cá nhân của người dùng. |
| `/analytics` | `app/(dashboard)/analytics/page.tsx` | Người dùng đã đăng nhập | Báo cáo tài chính: Biểu đồ Donut cơ cấu chi tiêu, biểu đồ cột dòng tiền 6 tháng. |
| `/settings` | `app/(dashboard)/settings/page.tsx` | Người dùng đã đăng nhập | Cài đặt thông tin cá nhân, mật khẩu và tùy chọn ứng dụng. |
| `/support` | `app/(dashboard)/support/page.tsx` | Người dùng đã đăng nhập | Trung tâm trợ giúp: Hướng dẫn sử dụng và kênh liên hệ hỗ trợ người dùng. |

---

## 3. Danh mục Toàn bộ Các Biến Môi trường Hệ thống (Environment Variables)

### 3.1. Biến Môi trường Backend (`capitalflow-api/.env`)

| Tên Biến Môi trường | Kiểu Dữ liệu | Giá trị Mặc định / Mẫu | Bắt buộc | Mục đích & Ý nghĩa Kỹ thuật |
| :--- | :---: | :--- | :---: | :--- |
| `APP_NAME` | `str` | `CapitalFlow API` | Không | Tên hiển thị của dịch vụ trên Swagger UI và tiêu đề email. |
| `APP_ENV` | `str` | `development` | Không | Môi trường thực thi (`development`, `staging`, `production`). |
| `DEBUG` | `bool` | `True` | Không | Bật/tắt chế độ debug và hiển thị chi tiết stack trace khi phát sinh lỗi. |
| `DATABASE_URL` | `str` | *Bắt buộc cấu hình* | **Có** | Chuỗi kết nối SQLAlchemy (ví dụ: `mssql+pyodbc://...` hoặc `postgresql+psycopg://...`). |
| `JWT_SECRET_KEY` | `str` | *Bắt buộc cấu hình* | **Có** | Chuỗi khóa bí mật dùng để ký và xác thực chữ ký JWT Access Token. |
| `JWT_ALGORITHM` | `str` | `HS256` | Không | Thuật toán mã hóa chữ ký số JWT. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `int` | `15` | Không | Thời hạn sống của Access Token tính bằng phút. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `int` | `7` | Không | Thời hạn sống của Refresh Token tính bằng ngày. |
| `FRONTEND_URL` | `str` | `http://localhost:3010` | Không | Địa chỉ URL của cổng người dùng cuối (phục vụ CORS và liên kết email). |
| `ADMIN_URL` | `str` | `http://localhost:5173` | Không | Địa chỉ URL của cổng quản trị viên (phục vụ cấu hình CORS). |
| `GOOGLE_AI_API_KEY` | `str` | `""` | Khuyến nghị | Khóa API Google Gemini AI để kích hoạt tính năng bóc tách hóa đơn OCR. |
| `GOOGLE_AI_MODEL` | `str` | `gemini-3.5-flash-lite` | Không | Model AI ưu tiên cho tác vụ bóc tách OCR (dự phòng `gemini-3.6-flash`). |
| `UPLOAD_DIR` | `str` | `<root>/uploads` | Không | Đường dẫn thư mục lưu trữ hóa đơn tải lên và tệp email preview. |
| `SMTP_HOST` | `str` | `smtp.gmail.com` | Không | Địa chỉ máy chủ gửi thư SMTP. |
| `SMTP_PORT` | `int` | `587` | Không | Cổng kết nối máy chủ gửi thư (587 cho STARTTLS hoặc 465 cho SSL). |
| `SMTP_USER` | `str` | `""` | Không | Tên người dùng / Địa chỉ hòm thư gửi SMTP. |
| `SMTP_PASSWORD` | `str` | `""` | Không | Mật khẩu ứng dụng (App Password) của tài khoản gửi thư. |
| `SMTP_TLS` | `bool` | `True` | Không | Kích hoạt giao thức mã hóa STARTTLS. |
| `SMTP_SSL` | `bool` | `False` | Không | Kích hoạt giao thức mã hóa SSL trực tiếp. |
| `EMAILS_FROM_EMAIL` | `str` | `support@capitalflow.vn` | Không | Địa chỉ email người gửi hiển thị trong hòm thư người nhận. |
| `EMAILS_FROM_NAME` | `str` | `CapitalFlow Finance` | Không | Tên hiển thị người gửi trên email thông báo. |

### 3.2. Biến Môi trường Cổng Quản trị (`frontend/admin-web/.env`)

| Tên Biến Môi trường | Kiểu Dữ liệu | Giá trị Mẫu | Bắt buộc | Mục đích & Ý nghĩa Kỹ thuật |
| :--- | :---: | :--- | :---: | :--- |
| `VITE_API_URL` | `str` | `http://localhost:8000/api/v1` | **Có** | Địa chỉ Base URL của Backend API để Axios Client kết nối. |

### 3.3. Biến Môi trường Cổng Người Dùng Cuối (`frontend/user-web/.env`)

| Tên Biến Môi trường | Kiểu Dữ liệu | Giá trị Mẫu | Bắt buộc | Mục đích & Ý nghĩa Kỹ thuật |
| :--- | :---: | :--- | :---: | :--- |
| `NEXT_PUBLIC_API_URL` | `str` | `http://localhost:8000/api` | **Có** | Địa chỉ Base URL của Backend API cho Client Components kết nối. |
| `PORT` | `int` | `3010` | Không | Cổng lắng nghe của máy chủ Web Next.js (chống trùng cổng 3000). |
| `NODE_ENV` | `str` | `development` / `production` | Không | Môi trường thực thi ứng dụng Node.js. |
| `HOSTNAME` | `str` | `0.0.0.0` | Không | Địa chỉ IP bind mạng trong môi trường Docker Container. |

### 3.4. Biến Môi trường Điều phối Gốc (`docker-compose.yml`)

| Tên Biến Môi trường | Dịch vụ Liên quan | Giá trị Mẫu | Mục đích & Ý nghĩa Kỹ thuật |
| :--- | :--- | :--- | :--- |
| `POSTGRES_USER` | `db` | `capitalflow` | Tên tài khoản quản trị CSDL PostgreSQL. |
| `POSTGRES_PASSWORD` | `db` | `capitalflow_dev` | Mật khẩu truy cập CSDL cục bộ. |
| `POSTGRES_DB` | `db` | `capitalflow` | Tên cơ sở dữ liệu mặc định. |
| `DATABASE_URL` | `api` | `postgresql+psycopg://...` | Chuỗi kết nối nội bộ giữa container API và container Database. |

---

## 4. Bảng Tra cứu Từ khóa Chức năng Tương ứng Toàn Dự Án (Functional Keywords)

### 4.1. Nhóm Xác thực, Quản trị Phiên & An ninh (Auth & Security)
- `Argon2 Password Hashing`: Thuật toán băm mật khẩu chống lại tấn công vét cạn phần cứng GPU/ASIC.
- `Stateless JWT Authentication`: Cơ chế xác thực Bearer Token phi trạng thái hiệu năng cao.
- `Token Family Rotation`: Chuỗi xoay vòng Refresh Token theo họ, phát hiện và ngăn chặn hành vi tái sử dụng token bị đánh cắp.
- `Active Session Tracking`: Theo dõi và lưu vết phiên làm việc dựa trên địa chỉ IP, tên thiết bị (`device_name`) và User-Agent.
- `Password Reset OTP`: Xác thực khôi phục tài khoản qua mã số 6 chữ số có hạn định 10 phút gửi qua email.
- `Role-Based Access Control (RBAC)`: Phân định ranh giới chặt chẽ giữa người dùng (`USER`) và Quản trị viên (`ADMIN`).
- `IDOR Prevention Guard`: Cơ chế thẩm tra quyền sở hữu tuyệt đối đối với từng tài khoản ví, danh mục, giao dịch và hóa đơn.
- `Rate Limiting (SlowAPI)`: Kiểm soát tần suất gọi API chống tấn công DDoS và brute-force tài khoản.
- `Transparent Refresh Interceptor`: Tự động chặn lỗi 401 trên Frontend và thực hiện xoay vòng token trong suốt với người dùng.

### 4.2. Nhóm Quản lý Tài chính, Kế toán Cá nhân & Sổ cái (Finance & Accounting)
- `Multi-Account Wallet Management`: Quản lý linh hoạt đa dạng tài khoản (Tiền mặt, Ngân hàng, Ví điện tử, Thẻ tín dụng).
- `Pessimistic Locking Concurrency`: Khóa hàng `with_for_update()` ngăn chặn xung đột số dư (Race Condition) khi giao dịch đồng thời.
- `Atomic Money Transfer (ACID)`: Chuyển tiền liên ví đảm bảo tính nguyên tử, triệt tiêu Deadlock bằng cách sắp xếp thứ tự khóa UUID.
- `Transaction Ledger`: Sổ cái giao dịch thu/chi với phân loại nguồn gốc rõ ràng (`MANUAL`, `OCR`, `IMPORT`, `SYSTEM`).
- `Soft Deletion Policy`: Xóa mềm tài khoản ví (`is_active = False`) để bảo toàn lịch sử đối soát giao dịch kế toán.
- `Proactive Budget Monitoring`: Theo dõi định mức chi tiêu định kỳ với cơ chế tự động gửi email cảnh báo ở ngưỡng 80% và 100%.
- `Optimized SQL Views`: Nâng cao hiệu năng truy vấn dòng tiền qua `vw_monthly_cashflow` và `vw_budget_progress`.
- `Net Worth Calculation`: Tính toán tổng tài sản ròng và phân tích trực quan xu hướng tài chính 6 tháng qua Recharts.

### 4.3. Nhóm Trí tuệ Nhân tạo & Số hóa Hóa đơn (AI & Invoices)
- `Google Gemini Vision AI OCR`: Bóc tách thông tin hóa đơn tự động bằng mô hình đa phương thức.
- `Dual-Model Fallback Resilience`: Dự phòng tự động giữa `gemini-3.5-flash-lite` và `gemini-3.6-flash` khi quá tải quota.
- `Vietnamese Invoice Parser`: Trích xuất chuẩn xác Mã số thuế (MST), Tên nhà cung cấp, Số hóa đơn, Doanh số và Thuế GTGT.
- `Duplicate Invoice Detection`: Phát hiện hóa đơn trùng lặp dựa trên MST + Số HĐ hoặc Tên người bán + Ngày + Số tiền.
- `Batch AI OCR Studio`: Quét OCR hàng loạt nhiều hóa đơn trong một phiên làm việc (tối đa 5 hóa đơn/lần).
- `Inline Table Editing`: Cho phép người dùng chỉnh sửa trực tiếp các trường dữ liệu bóc tách trước khi xác nhận.
- `Invoice-Transaction Sync`: Tự động hạch toán giao dịch chi tiêu vào sổ cái ngay khi người dùng bấm xác nhận hóa đơn.
- `Safe FK Deletion Engine`: Xóa an toàn hóa đơn, tự động tháo gỡ ràng buộc Foreign Key với bảng Giao dịch trên CSDL.

### 4.4. Nhóm Quản trị Vận hành, Kiểm toán & Email (Operations & Governance)
- `Independent Session Audit Logging`: Ghi nhận nhật ký kiểm toán tự động qua Session DB độc lập, không làm gián đoạn luồng API chính.
- `Audit Trail Compliance`: Lưu vết toàn bộ thao tác nhạy cảm của Quản trị viên phục vụ đối soát an ninh thông tin.
- `Dual-Mode Email Engine`: Tự động chuyển đổi linh hoạt giữa gửi thư SMTP thật và chế độ ghi log/HTML xem trước tại local.
- `Non-blocking BackgroundTasks`: Thực thi các tác vụ gửi email thông báo và tính toán ngân sách ngầm không chặn luồng HTTP.
- `Runtime SMTP Hot-Reload`: Xem và cập nhật trực tiếp thông số kết nối máy chủ gửi thư từ Admin Portal không cần khởi động lại API.
- `AI Service Health Monitoring`: Giám sát tỷ lệ bóc tách thành công, thời gian xử lý (ms) và nhật ký lỗi của động cơ OCR.
- `Bulk User Operations`: Khóa hoặc mở khóa tài khoản hàng loạt nhiều người dùng chỉ với một thao tác.
- `UTF-8 BOM CSV Export`: Xuất báo cáo danh sách người dùng sang file CSV tương thích hoàn toàn font tiếng Việt trong Excel.

### 4.5. Nhóm Kỹ thuật Giao diện, Hiệu năng & Trực quan hóa (Frontend UI/UX & State)
- `Server State Management (TanStack Query)`: Quản lý cache dữ liệu máy chủ, tự động làm tươi dữ liệu khi có biến động.
- `Error Boundary Isolation`: Bắt ngoại lệ runtime ở cấp độ thành phần giao diện, ngăn chặn hiện tượng sập toàn bộ ứng dụng.
- `Compound Component Architecture`: Xây dựng các UI components nguyên tử tái sử dụng cao (`StatCard`, `Badge`, `UploadZone`, `ResultsTable`).
- `Responsive Layout & Dark Mode`: Thiết kế giao diện hiện đại tương thích trên mọi kích thước màn hình với hệ thống design tokens Tailwind CSS v4.
- `Micro-animations & Interactive Pull-Cord`: Nâng cao trải nghiệm người dùng với các hiệu ứng hoạt họa tinh tế (kéo dây đèn bàn, rung lắc form lỗi).
