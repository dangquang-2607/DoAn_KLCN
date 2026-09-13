# DANH MỤC KỸ THUẬT VÀ TÀI LIỆU VẬN HÀNH (TECHNICAL MANIFEST)
**Dự án:** `user-web` (CapitalFlow Frontend Client Portal)  
**Mục đích:** Đặc tả chi tiết các biến môi trường, endpoints API, danh sách hàm quan trọng và bảng từ khóa chức năng của hệ thống.

---

## 1. Danh sách Biến Môi Trường (Environment Variables Manifest)

| Tên biến môi trường | Kiểu dữ liệu | Giá trị mặc định / Khuyến nghị | Bắt buộc | Mô tả & Mục đích sử dụng |
| :--- | :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_API_URL` | `string` | `http://localhost:8000` | **Có** | Địa chỉ máy chủ Backend (FastAPI). Tiền tố `NEXT_PUBLIC_` cho phép bundle client-side truy cập được biến này để cấu hình Base URL cho Axios. |
| `GOOGLE_AI_API_KEY` | `string` | *(Không có)* | Tùy chọn | Khóa API của Google AI Studio để kết nối với mô hình Gemini trích xuất OCR hóa đơn trực tiếp từ module `lib/gemini.ts`. |
| `GOOGLE_AI_ENDPOINT` | `string` | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` | Tùy chọn | URL endpoint tương thích chuẩn OpenAI của Google Gemini API. |
| `GOOGLE_AI_MODEL` | `string` | `gemini-2.0-flash` | Tùy chọn | Tên mô hình Gemini được chỉ định xử lý OCR thị giác máy tính cho hóa đơn. |
| `OLLAMA_REFINE` | `boolean` | `false` | Tùy chọn | Cờ bật/tắt bước kiểm tra tính nhất quán số học và chuẩn hóa dữ liệu hóa đơn thông qua mô hình LLM cục bộ Ollama. |
| `OLLAMA_ENDPOINT` | `string` | `http://localhost:11434/v1/chat/completions` | Tùy chọn | Địa chỉ máy chủ Ollama chạy trên môi trường local của người dùng/máy chủ. |
| `OLLAMA_MODEL` | `string` | `qwen2.5:4b` | Tùy chọn | Tên mô hình chạy trên Ollama (ví dụ `qwen2.5:4b` hoặc `llama3.2`) để rà soát lỗi hóa đơn. |
| `PORT` | `number` | `3010` | Tùy chọn | Cổng lắng nghe của máy chủ Web khi chạy lệnh `npm run dev` hoặc container Docker (khác với cổng 3000 để tránh xung đột). |
| `NODE_ENV` | `string` | `production` / `development` | Tùy chọn | Chế độ thực thi ứng dụng Node.js. |
| `HOSTNAME` | `string` | `0.0.0.0` | Tùy chọn | Địa chỉ IP máy chủ bind cổng mạng trong môi trường triển khai Docker. |

---

## 2. Danh sách API URLs & Routes

### 2.1. Danh sách Tuyến đường Frontend (Next.js Application Routes)

| Tuyến đường (URL Path) | Tệp Component tương ứng | Quyền truy cập | Mô tả chức năng |
| :--- | :--- | :---: | :--- |
| `/login` | [`app/login/page.tsx`](file:///d:/code/DoAn_KLCN/frontend/user-web/app/login/page.tsx) | Công khai | Cổng xác thực: Đăng nhập, Đăng ký, Quên mật khẩu qua OTP email, Đổi mật khẩu bắt buộc khi tài khoản mới khởi tạo. |
| `/` | [`app/(dashboard)/page.tsx`](file:///d:/code/DoAn_KLCN/frontend/user-web/app/(dashboard)/page.tsx) | Cần đăng nhập | Bảng điều khiển tổng quan: Tổng tài sản ròng, dòng tiền thu/chi tháng hiện tại, 5 giao dịch mới nhất, lối tắt thao tác nhanh. |
| `/accounts` | [`app/(dashboard)/accounts/page.tsx`](file:///d:/code/DoAn_KLCN/frontend/user-web/app/(dashboard)/accounts/page.tsx) | Cần đăng nhập | Quản lý ví và tài khoản: Danh sách thẻ ngân hàng, ví điện tử, số dư thực tế, xu hướng biến động số dư. |
| `/transactions` | [`app/(dashboard)/transactions/page.tsx`](file:///d:/code/DoAn_KLCN/frontend/user-web/app/(dashboard)/transactions/page.tsx) | Cần đăng nhập | Sổ cái giao dịch: Bảng kê toàn bộ thu/chi, phân trang dữ liệu, bộ lọc theo thời gian/danh mục/tài khoản, tìm kiếm từ khóa, xuất dữ liệu. |
| `/budgets` | [`app/(dashboard)/budgets/page.tsx`](file:///d:/code/DoAn_KLCN/frontend/user-web/app/(dashboard)/budgets/page.tsx) | Cần đăng nhập | Quản lý ngân sách: Tổng hạn mức chi tiêu hàng tháng, thanh tiến độ chi tiêu theo từng danh mục, cảnh báo vượt ngưỡng đỏ (≥ 90%). |
| `/ocr` | [`app/(dashboard)/ocr/page.tsx`](file:///d:/code/DoAn_KLCN/frontend/user-web/app/(dashboard)/ocr/page.tsx) | Cần đăng nhập | Trạm số hóa hóa đơn AI (OCR Studio): Tải lên hóa đơn, quét đơn lẻ / quét hàng loạt (≤ 5), xem trước ảnh phóng to/xoay, tự động khớp danh mục, cảnh báo trùng lặp, xác nhận ghi sổ cái. |
| `/categories` | [`app/(dashboard)/categories/page.tsx`](file:///d:/code/DoAn_KLCN/frontend/user-web/app/(dashboard)/categories/page.tsx) | Cần đăng nhập | Danh mục thu/chi: Trang cấu hình danh mục chi tiêu người dùng (giao diện placeholder đang phát triển). |
| `/analytics` | [`app/(dashboard)/analytics/page.tsx`](file:///d:/code/DoAn_KLCN/frontend/user-web/app/(dashboard)/analytics/page.tsx) | Cần đăng nhập | Báo cáo & Phân tích tài chính: Biểu đồ Recharts Donut/Pie phân bổ chi tiêu, biểu đồ cột dòng tiền 6 tháng, tỷ lệ tiết kiệm ròng. |
| `/settings` | [`app/(dashboard)/settings/page.tsx`](file:///d:/code/DoAn_KLCN/frontend/user-web/app/(dashboard)/settings/page.tsx) | Cần đăng nhập | Cài đặt hệ thống: Quản lý thông tin hồ sơ và tùy chọn ứng dụng (giao diện placeholder đang phát triển). |
| `/support` | [`app/(dashboard)/support/page.tsx`](file:///d:/code/DoAn_KLCN/frontend/user-web/app/(dashboard)/support/page.tsx) | Cần đăng nhập | Trung tâm trợ giúp: Thông tin hướng dẫn và kênh liên hệ hỗ trợ khách hàng (support@capitalflow.vn). |

---

### 2.2. Danh sách Endpoints Backend tích hợp (API Routes via Axios Client)

Toàn bộ các yêu cầu gửi đến API đều có tiền tố `${NEXT_PUBLIC_API_URL}/api/v1`.

| Phương thức | Đường dẫn API Endpoint | Tệp gọi chính | Payload / Tham số | Mô tả nghiệp vụ |
| :---: | :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | `app/login/page.tsx` | `{ email, password }` | Đăng nhập hệ thống, nhận cặp Access Token & Refresh Token. |
| `POST` | `/auth/register` | `app/login/page.tsx` | `{ full_name, email, password }` | Đăng ký tài khoản người dùng mới. |
| `POST` | `/auth/refresh` | `lib/api.ts` | `{ refresh_token }` | Cấp mới Access Token khi token cũ hết hạn (tự động qua Interceptor). |
| `POST` | `/auth/logout` | `lib/api.ts` | `{ refresh_token }` | Thu hồi Refresh Token trên máy chủ và hủy phiên đăng nhập. |
| `GET` | `/auth/me` | `DashboardLayout.tsx` | *(Bearer Token)* | Lấy hồ sơ người dùng hiện tại, kiểm tra cờ `is_banned` và `must_change_password`. |
| `POST` | `/auth/forgot-password` | `app/login/page.tsx` | `{ email }` | Gửi mã OTP 6 chữ số qua email để phục hồi mật khẩu. |
| `POST` | `/auth/reset-password` | `app/login/page.tsx` | `{ email, otp_code, new_password }` | Đặt lại mật khẩu mới bằng mã OTP đã xác thực. |
| `POST` | `/auth/first-time-password` | `app/login/page.tsx` | `{ new_password }` | Cưỡng chế đổi mật khẩu trong lần đăng nhập đầu tiên. |
| `GET` | `/accounts` | `accounts/page.tsx`, `page.tsx` | *(None)* | Lấy danh sách ví và tài khoản ngân hàng cùng số dư hiện có. |
| `GET` | `/transactions` | `transactions/page.tsx`, `page.tsx`, `analytics/page.tsx` | `params: { page, page_size, q }` | Truy vấn danh sách giao dịch lịch sử có phân trang và lọc dữ liệu. |
| `GET` | `/budgets` | `budgets/page.tsx` | *(None)* | Lấy hạn mức và tiến độ chi tiêu ngân sách trong tháng hiện tại. |
| `GET` | `/categories` | `ocr/page.tsx` | *(None)* | Lấy danh mục thu/chi phục vụ gán nhãn hóa đơn và giao dịch. |
| `POST` | `/categories` | `ocr/page.tsx` | `{ name, type: 'EXPENSE' }` | Tạo nhanh danh mục chi tiêu mới trực tiếp từ giao diện hóa đơn. |
| `GET` | `/invoices` | `ocr/page.tsx` | `params: { page, page_size: 100 }` | Lấy danh sách hóa đơn đã tải lên (chờ xử lý hoặc đã xác nhận). |
| `POST` | `/invoices` | `ocr/page.tsx` | `FormData: { file }` | Tải lên tệp hóa đơn mới (JPG, PNG, PDF), trạng thái ban đầu là `UPLOADED`. |
| `GET` | `/invoices/{id}` | `ocr/page.tsx` | `Path: id` | Lấy chi tiết thông tin hóa đơn đã trích xuất, cảnh báo trùng lặp và các items. |
| `GET` | `/invoices/{id}/file` | `ocr/page.tsx` | `Path: id`, `responseType: blob` | Tải dữ liệu nhị phân của tệp hóa đơn để hiển thị trên trình xem trước ảnh. |
| `POST` | `/invoices/{id}/ocr` | `ocr/page.tsx` | `Path: id` | Kích hoạt AI Gemini quét và nhận diện thông tin hóa đơn đơn lẻ. |
| `POST` | `/invoices/batch-ocr` | `ocr/page.tsx` | `{ invoice_ids: string[] }` | Kích hoạt quét AI hàng loạt cho danh sách tối đa 5 hóa đơn. |
| `POST` | `/invoices/{id}/confirm` | `ocr/page.tsx` | `{ account_id, category_id, total_amount, ... }` | Xác nhận hóa đơn, chuyển trạng thái `CONFIRMED` và ghi giao dịch vào sổ cái. |
| `DELETE` | `/invoices/{id}` | `ocr/page.tsx` | `Path: id` | Xóa một hóa đơn khỏi hệ thống. |
| `POST` | `/invoices/batch-delete` | `ocr/page.tsx` | `{ invoice_ids: string[] }` | Xóa hàng loạt nhiều hóa đơn được chọn. |

---

## 3. Danh sách Functions quan trọng (Core Functions Manifest)

### 3.1. Module Mạng & Bảo mật (`lib/api.ts`)

| Tên Function | Tham số đầu vào | Giá trị trả về | Mô tả & Cơ chế hoạt động |
| :--- | :--- | :--- | :--- |
| `api.interceptors.request.use` | `config: InternalAxiosRequestConfig` | `InternalAxiosRequestConfig` | Kiểm tra môi trường client (`typeof window !== 'undefined'`). Nếu chưa có Header `Authorization`, tự động lấy Access Token từ `sessionStorage` và gắn vào dạng `Bearer <token>`. |
| `api.interceptors.response.use` | `onFulfilled, onRejected` | `Promise<AxiosResponse>` | Bắt mã lỗi HTTP 401. Nếu không phải từ endpoint auth và request chưa từng retry, đưa request vào `refreshQueue` và gọi `/auth/refresh`. Sau khi làm mới thành công, replay lại toàn bộ request chờ. Nếu refresh thất bại, gọi `_doLogout()`. |
| `_doLogout` | *(Không có)* | `void` | Gửi request thông báo đăng xuất tới backend, xóa sạch Access Token & Refresh Token trong `sessionStorage`, sau đó chuyển hướng người dùng về trang `/login`. |

---

### 3.2. Module Trợ giúp Giao diện (`lib/ui-helpers.ts`)

| Tên Function | Tham số đầu vào | Giá trị trả về | Mô tả & Cơ chế hoạt động |
| :--- | :--- | :--- | :--- |
| `getHashColor` | `str: string = ''` | `{ text: string, bg: string }` | Thuật toán băm chuỗi (djb2-style hash code) ánh xạ chuỗi bất kỳ sang một bộ màu sắc Tailwind cố định (Indigo, Emerald, Rose, Blue, v.v.), đảm bảo màu hiển thị luôn nhất quán cho cùng một nhãn danh mục. |
| `getCategoryIcon` | `categoryName: string = ''` | `LucideIcon` | Ánh xạ tên danh mục tiếng Việt (ví dụ: ăn uống, di chuyển, mua sắm, điện nước, công nghệ) sang biểu tượng Lucide tương ứng (`Utensils`, `Car`, `Store`, `Receipt`, `Cloud`, v.v.). Mặc định trả về `LayoutGrid`. |
| `getAccountIcon` | `accountType: string = ''` | `LucideIcon` | Ánh xạ loại tài khoản (tiền mặt, thẻ tín dụng, tiết kiệm, tiền điện tử, ngân hàng) sang icon đại diện (`Wallet`, `CreditCard`, `PiggyBank`, `Bitcoin`, `Landmark`). |

---

### 3.3. Module Xử lý AI OCR & Phân tích Dữ liệu (`lib/`)

| Tên Function | Tệp nguồn | Tham số đầu vào | Giá trị trả về | Mô tả & Cơ chế hoạt động |
| :--- | :--- | :--- | :--- | :--- |
| `hasGeminiCredentials` | `lib/gemini.ts` | *(Không có)* | `boolean` | Kiểm tra xem các biến môi trường `GOOGLE_AI_ENDPOINT` và `GOOGLE_AI_API_KEY` đã được thiết lập hay chưa. |
| `buildFilePart` | `lib/gemini.ts` | `fileName: string, buffer: Buffer` | `ContentPart` | Chuyển đổi tệp hóa đơn nhị phân thành cấu trúc payload OpenAI-compatible (Base64 data URL cho ảnh JPG/PNG/WebP hoặc File attachment cho tệp PDF). |
| `callGemini` | `lib/gemini.ts` | `fileName: string, buffer: Buffer` | `Promise<string>` | Gửi yêu cầu HTTP POST tới Google Gemini API kèm prompt kế toán tiếng Việt chuẩn, nhận chuỗi nội dung văn bản JSON từ model `gemini-2.0-flash`. |
| `ocrWithGemini` | `lib/gemini.ts` | `fileName: string` | `Promise<string>` | Đọc tệp an toàn từ thư mục `data/uploads/` bằng `path.basename` và thực hiện gọi `callGemini`. |
| `runOcrOnFile` | `lib/gemini.ts` | `fileName: string` | `Promise<string[]>` | Thực hiện quét OCR một tệp, bóc tách JSON và chuyển đổi thành mảng 15 phần tử để lưu trữ CSV. |
| `refineWithOllama` | `lib/ollama.ts` | `rawJson: string` | `Promise<string>` | Gửi kết quả JSON thô tới mô hình Ollama cục bộ để kiểm tra tính nhất quán số học (`doanh số + thuế = tổng tiền`). Áp dụng nguyên tắc Graceful Degradation: trả về JSON gốc nếu Ollama tắt. |
| `extractJson` | `lib/ocr-parse.ts` | `text: string` | `Record<string, unknown>` | Làm sạch các ký tự code block (```` ```json ````), tìm vị trí ngoặc nhọn `{` và `}` đầu/cuối rồi parse thành Javascript Object an toàn. |
| `normalizeAmount` | `lib/ocr-parse.ts` | `raw: string` | `string` | Chuẩn hóa chuỗi số tiền: loại bỏ dấu chấm/phẩy phân cách nghìn kiểu Việt Nam/Mỹ, đưa về định dạng số nguyên hoặc số thập phân chuẩn. |
| `toInvoiceRow` | `lib/ocr-parse.ts` | `json: Record<string, unknown>, sourceFile: string` | `string[]` | Ánh xạ 14 trường thông tin trích xuất từ hóa đơn theo đúng thứ tự cột của bảng dữ liệu kế toán và bổ sung cột thứ 15 là tên tệp gốc. |

---

### 3.4. Functions Nghiệp vụ tại Trang OCR (`app/(dashboard)/ocr/page.tsx`)

| Tên Function | Tham số đầu vào | Giá trị trả về | Mô tả & Cơ chế hoạt động |
| :--- | :--- | :--- | :--- |
| `matchCategory` | `aiSuggestion: string, categories: Category[]` | `string (category_id)` | Quét các từ khóa gợi ý chi phí từ AI (ăn uống, di chuyển, mua sắm, tiện ích, sức khỏe...) đối chiếu với danh mục người dùng để tự động chọn mã danh mục phù hợp. |
| `handleFileChange` | `e: ChangeEvent<HTMLInputElement>` | `Promise<void>` | Đọc danh sách tệp người dùng chọn từ máy tính, tuần tự upload lên server qua endpoint `/invoices` dạng `multipart/form-data`. |
| `handleScanOcr` | `id: string` | `Promise<void>` | Gọi API `/invoices/{id}/ocr` để thực hiện nhận diện AI đơn lẻ cho hóa đơn đang chọn, xử lý thông báo thành công hoặc cảnh báo trùng lặp/rate-limit 429. |
| `handleRetryOcr` | `id: string, e: React.MouseEvent` | `Promise<void>` | Thao tác quét lại dành riêng cho các hóa đơn có trạng thái xử lý lỗi `FAILED`. |
| `handleBatchOcr` | *(Không có)* | `Promise<void>` | Lọc danh sách hóa đơn được tích chọn, kiểm tra ràng buộc số lượng tối đa `MAX_BATCH_OCR = 5`, gửi request `/invoices/batch-ocr`. |
| `confirmMutation` | *(useMutation)* | `Promise<AxiosResponse>` | Xác thực dữ liệu form (bắt buộc chọn ví thanh toán), gửi request `/invoices/{id}/confirm` để tạo giao dịch sổ cái và cập nhật số dư. |
| `handleBatchDelete` | *(Không có)* | `Promise<void>` | Hiển thị hộp thoại xác nhận hủy, sau đó gọi `/invoices/batch-delete` để xóa đồng thời nhiều hóa đơn đã chọn. |
| `handleCreateCategory` | *(Không có)* | `Promise<void>` | Tạo nhanh một danh mục chi tiêu mới (`POST /categories`) ngay trên modal hóa đơn khi chưa có danh mục phù hợp. |
| `toggleSelectId` | `id: string, e: React.MouseEvent` | `void` | Thêm hoặc xóa một ID hóa đơn khỏi `Set<string>` phục vụ chế độ thao tác hàng loạt (Bulk Mode). |
| `toggleSelectAll` | *(Không có)* | `void` | Chọn tất cả hoặc bỏ chọn toàn bộ danh sách hóa đơn thuộc tab hiện tại. |

---

### 3.5. Functions Nghiệp vụ tại Trang Xác thực (`app/login/page.tsx`)

| Tên Function | Tham số đầu vào | Giá trị trả về | Mô tả & Cơ chế hoạt động |
| :--- | :--- | :--- | :--- |
| `isValidEmail` | `email: string` | `boolean` | Kiểm tra định dạng địa chỉ email thông qua biểu thức chính quy (Regex RFC chuẩn). |
| `getPasswordStrength` | `pass: string` | `number (0 - 5)` | Đánh giá độ mạnh mật khẩu dựa trên 5 tiêu chí: độ dài ≥ 6, độ dài ≥ 8, chữ in hoa, chữ số, ký tự đặc biệt. |
| `getStrengthLabel` | `score: number` | `{ text, color, textColor }` | Chuyển đổi điểm số mật khẩu thành nhãn hiển thị trực quan (Rất yếu, Yếu, Trung bình, Mạnh, Rất an toàn). |
| `handleLogin` | `e: React.FormEvent` | `Promise<void>` | Kiểm tra trạng thái khóa brute-force, validate email/mật khẩu, gọi `POST /auth/login`, lưu token, xử lý cờ `must_change_password`. |
| `handleRegister` | `e: React.FormEvent` | `Promise<void>` | Xác thực tính hợp lệ của họ tên, email, mật khẩu xác nhận, điều khoản dịch vụ; gọi `POST /auth/register` và tự động chuyển sang tab đăng nhập. |
| `handleSendForgotOtp` | `e: React.FormEvent` | `Promise<void>` | Gửi yêu cầu cấp mã OTP phục hồi mật khẩu qua `POST /auth/forgot-password`, kích hoạt đếm ngược 60 giây cho nút gửi lại mã. |
| `handleResetPassword` | `e: React.FormEvent` | `Promise<void>` | Xác nhận mã OTP 6 chữ số và thiết lập mật khẩu mới qua `POST /auth/reset-password`. |
| `handleFirstTimeSubmit` | `e: React.FormEvent` | `Promise<void>` | Gửi mật khẩu mới qua `POST /auth/first-time-password` để kích hoạt tài khoản được cấp quyền lần đầu. |
| `triggerShake` | *(Không có)* | `void` | Kích hoạt class animation CSS `animate-shake` để tạo hiệu ứng rung lắc phản hồi khi người dùng nhập sai thông tin. |

---

## 4. Bảng Keywords Chức năng (Functional Keywords & Domain Glossary)

| Keyword Tiếng Anh | Thuật ngữ Tiếng Việt | Phạm vi nghiệp vụ | Ý nghĩa kỹ thuật & Vị trí ứng dụng |
| :--- | :--- | :---: | :--- |
| **Silent Refresh** | Tự động làm mới Token ngầm | Authentication | Kỹ thuật dùng `refresh_token` để lấy `access_token` mới khi nhận lỗi 401 mà không làm gián đoạn trải nghiệm người dùng (`lib/api.ts`). |
| **Brute-Force Lockout** | Khóa chống dò mật khẩu | Security | Cơ chế khóa tạm thời tài khoản 30 giây sau 5 lần đăng nhập thất bại liên tiếp (`app/login/page.tsx`). |
| **Must Change Password** | Bắt buộc đổi mật khẩu | Security | Cờ kiểm soát người dùng mới tạo bắt buộc phải đổi mật khẩu do admin cấp trong phiên đầu tiên (`DashboardLayout.tsx`). |
| **Net Worth** | Tổng tài sản ròng | Financial Overview | Tổng số dư cộng dồn của tất cả các tài khoản/ví đang hoạt động của người dùng (`app/(dashboard)/page.tsx`). |
| **Net Cashflow** | Dòng tiền ròng | Financial Overview | Hiệu số giữa Tổng thu nhập (Income) và Tổng chi phí (Expense) trong chu kỳ tháng (`app/(dashboard)/analytics/page.tsx`). |
| **Invoice OCR** | Nhận diện ký tự hóa đơn | AI & Computer Vision | Quá trình sử dụng thị giác máy tính và AI Gemini để đọc hiểu và cấu trúc hóa dữ liệu từ ảnh/PDF hóa đơn (`app/(dashboard)/ocr/page.tsx`). |
| **Batch OCR** | Quét AI hàng loạt | AI Batch Processing | Tính năng quét đồng thời một nhóm hóa đơn với giới hạn an toàn `MAX_BATCH_OCR = 5` để tránh tràn quota và nghẽn tài nguyên. |
| **Duplicate Check** | Kiểm tra hóa đơn trùng lặp | Invoice Audit | Tính năng phát hiện hóa đơn đã từng được tải lên hoặc ghi sổ dựa trên số hóa đơn, ngày lập và mã số thuế (`is_duplicate`). |
| **Category Heuristic** | Khớp danh mục theo từ khóa | Business Intelligence | Thuật toán so khớp từ khóa tiếng Việt trong nội dung hóa đơn để đề xuất danh mục chi phí tự động (`matchCategory`). |
| **Budget Danger Zone** | Cảnh báo vượt định mức ngân sách | Budgeting | Trạng thái hiển thị cảnh báo đỏ khi tỷ lệ chi tiêu thực tế đạt hoặc vượt ngưỡng 90% ngân sách đã đặt (`app/(dashboard)/budgets/page.tsx`). |
| **Inline Table Editing** | Chỉnh sửa trực tiếp trên ô bảng | Data Manipulation | Khả năng click vào từng ô trên bảng dữ liệu để sửa nhanh giá trị và lưu tự động (`components/ResultsTable.tsx`). |
| **Tabular Numbers** | Số phông đồng độ rộng | Typography | Quy chuẩn định dạng CSS `font-variant-numeric: tabular-nums` giúp các cột số tiền tài chính thẳng hàng và dễ so sánh thị giác (`globals.css`). |
| **Graceful Degradation** | Thoái lui mềm khi lỗi dịch vụ | System Reliability | Thiết kế đảm bảo nếu dịch vụ phụ trợ (Ollama) gặp sự cố, luồng chính (Gemini OCR) vẫn hoàn thành công việc bình thường (`lib/ollama.ts`). |
| **Multi-Stage Build** | Đóng gói Docker đa giai đoạn | DevOps & Deployment | Kỹ thuật tách riêng container build dependencies và container chạy runtime tối giản (Node Alpine) để giảm dung lượng image (`Dockerfile`). |
