Dưới đây là thông tin tài khoản Quản trị viên (Admin) và hướng dẫn chi tiết cách khởi chạy toàn bộ hệ thống CapitalFlow.

🔑 1. Thông tin Tài khoản Quản trị viên (Admin)
Hệ thống đã thiết lập sẵn tài khoản Admin trong cơ sở dữ liệu với thông tin đăng nhập chính xác như sau:

Thông tin	Giá trị
Email đăng nhập	admin@capitalflow.vn (hoặc admin@cashflow.vn)
Mật khẩu	CapitalFlow@2026
Vai trò (Role)	ADMIN (Quản trị viên toàn quyền hệ thống)
Trang đăng nhập Admin	http://localhost:5173/login
(Tài khoản này cũng có thể đăng nhập được vào cả cổng người dùng http://localhost:3010/login).

🏗️ 2. Kiến trúc các dịch vụ cần chạy
Toàn bộ dự án gồm 4 tiến trình chạy song song:

Database: Microsoft SQL Server (đã được bật sẵn trên máy).
Backend API: FastAPI (Port 8000) - Cung cấp toàn bộ REST API, Auth, nghiệp vụ.
Backend Worker: Tiến trình xử lý ngầm (Outbox Worker) - Chuyên xử lý OCR hóa đơn, gửi email, tổng hợp báo cáo.
User Web: Next.js (Port 3010) - Ứng dụng quản lý tài chính cá nhân dành cho người dùng.
Admin Web: React + Vite (Port 5173) - Trang dashboard điều hành, quản trị người dùng, nhật ký email, giám sát OCR.
🚀 3. Hướng dẫn chi tiết cách chạy dự án (Local Development)
Bạn mở 4 cửa sổ Terminal / PowerShell riêng biệt để chạy 4 tiến trình:

🖥️ Terminal 1: Chạy Backend API
powershell
cd D:\code\DoAn_KLCN\capitalflow-api
.\.venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
API sẽ lắng nghe tại: http://localhost:8000
Tài liệu Swagger API: http://localhost:8000/docs
⚙️ Terminal 2: Chạy Backend Worker (Xử lý OCR & Tác vụ ngầm)
(Rất quan trọng: nếu không bật tiến trình này, tính năng quét hóa đơn OCR và gửi email sẽ ở trạng thái chờ - PENDING).

powershell
cd D:\code\DoAn_KLCN\capitalflow-api
.\.venv\Scripts\activate
python -m app.services.worker
👤 Terminal 3: Chạy giao diện User Web (Next.js)
powershell
cd D:\code\DoAn_KLCN\frontend\user-web
npm run dev
Truy cập ứng dụng người dùng tại: http://localhost:3010
🛡️ Terminal 4: Chạy giao diện Admin Web (Vite + React)
powershell
cd D:\code\DoAn_KLCN\frontend\admin-web
npm run dev
Truy cập bảng điều khiển Admin tại: http://localhost:5173
📦 4. Hướng dẫn nếu thiết lập trên máy mới (Setup from scratch)
Nếu sau này bạn tải code về một máy tính hoàn toàn mới, quy trình cài đặt ban đầu như sau:

Cài đặt Backend:

powershell
cd D:\code\DoAn_KLCN\capitalflow-api
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # Cấu hình chuỗi kết nối SQL Server trong .env
Khởi tạo dữ liệu và tài khoản Admin mặc định:

powershell
python scripts/migrate_financial_integrity.py
python scripts/migrate_resilience.py
python scripts/seed.py    # Tự động tạo Admin admin@capitalflow.vn / CapitalFlow@2026
Cài đặt Frontend:

powershell
cd D:\code\DoAn_KLCN\frontend\user-web
npm install
cd D:\code\DoAn_KLCN\frontend\admin-web
npm install
🌐 Bảng tổng hợp liên kết truy cập nhanh
Dịch vụ	Địa chỉ URL	Ghi chú
Admin Portal	http://localhost:5173	Đăng nhập: admin@capitalflow.vn / CapitalFlow@2026
User Portal	http://localhost:3010	Không gian quản lý tài chính cá nhân
Swagger Docs	http://localhost:8000/docs	Kiểm tra và test trực tiếp các API
Health Check	http://localhost:8000/ready	Kiểm tra kết nối Database và Redis/Worker
