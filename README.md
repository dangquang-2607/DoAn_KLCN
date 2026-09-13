# 🚀 CapitalFlow — Hệ Thống Quản Lý Tài Chính & OCR Hóa Đơn Tự Động

> **Đồ án Khóa luận Tốt nghiệp (KLCN)**  
> Nền tảng quản lý tài chính cá nhân và doanh nghiệp thông minh, tích hợp trí tuệ nhân tạo (Gemini AI / Tesseract OCR) tự động trích xuất dữ liệu hóa đơn, thiết lập ngân sách và bảng điều khiển trực quan.

---

## 🔑 1. Tài Khoản Quản Trị Hệ Thống (Default Credentials)

Hệ thống đã thiết lập sẵn tài khoản Quản trị viên (Admin) mặc định trong cơ sở dữ liệu:

| Cổng dịch vụ | Địa chỉ URL | Email đăng nhập | Mật khẩu mặc định | Quyền hạn |
| :--- | :--- | :--- | :--- | :--- |
| **Bảng điều khiển Admin** | [http://localhost:5173](http://localhost:5173) | `admin@capitalflow.vn` *(hoặc `admin@cashflow.vn`)* | `CapitalFlow@2026` | **Quản trị viên toàn quyền (ADMIN)** |
| **Cổng người dùng User** | [http://localhost:3010](http://localhost:3010) | `admin@capitalflow.vn` | `CapitalFlow@2026` | Đăng nhập được cả 2 cổng |

*💡 Bạn cũng có thể bấm nút **"Đăng ký tài khoản mới"** tại cổng User để trải nghiệm đầy đủ quy trình của người dùng thông thường.*

---

## 🌐 2. Bảng Tổng Hợp Cổng Dịch Vụ

| Dịch vụ | Đường dẫn URL | Mô tả chức năng |
| :--- | :--- | :--- |
| 🛡️ **Admin Web** | [http://localhost:5173](http://localhost:5173) | Trang quản trị hệ thống, duyệt người dùng, giám sát OCR, Email Logs |
| 👤 **User Web** | [http://localhost:3010](http://localhost:3010) | Không gian cá nhân: Quản lý chi tiêu, ví tài khoản, quét hóa đơn OCR, ngân sách |
| ⚡ **Backend API** | [http://localhost:8000](http://localhost:8000) | RESTful API nền tảng FastAPI |
| 📚 **Swagger Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Tài liệu kiểm thử và tương tác trực tiếp toàn bộ API |
| 🩺 **Health Check** | [http://localhost:8000/ready](http://localhost:8000/ready) | Kiểm tra trạng thái sẵn sàng của Database và Worker |

---

## 🏗️ 3. Yêu Cầu Môi Trường (Prerequisites)

Để chạy dự án mượt mà trên máy tính mới, cần cài đặt sẵn:
- **Git**
- **Python**: Phiên bản `>= 3.11` (Khuyên dùng Python 3.11 hoặc 3.12)
- **Node.js**: Phiên bản `>= 18.x` (Khuyên dùng Node 20 LTS)
- **Microsoft SQL Server**: Phiên bản 2019 / 2022 (hoặc SQL Server Express)
- **ODBC Driver for SQL Server**: Phiên bản 17 hoặc 18

---

## 🛠️ 4. Hướng Dẫn Cài Đặt Ban Đầu Cho Máy Mới (Setup From Scratch)

### Bước 1: Tải mã nguồn về máy
Mở Terminal / Command Prompt và chạy:
```bash
git clone https://github.com/dangquang-2607/DoAn_KLCN.git
cd DoAn_KLCN
```

---

### Bước 2: Cài đặt và Cấu hình Backend (`capitalflow-api`)

1. Di chuyển vào thư mục backend và khởi tạo môi trường ảo Python:
```powershell
cd capitalflow-api
python -m venv .venv
.\.venv\Scripts\activate
```

2. Cài đặt toàn bộ thư viện cần thiết:
```powershell
pip install -r requirements.txt
```

3. Tạo file cấu hình môi trường `.env`:
```powershell
copy .env.example .env
```
> ⚠️ **Lưu ý quan trọng**: Mở file `.env` vừa tạo và chỉnh sửa biến `DATABASE_URL` cho khớp với mật khẩu SQL Server trên máy bạn:
> ```env
> DATABASE_URL=mssql+pyodbc://sa:YourPassword123@localhost:1433/capitalflow?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
> ```

4. Chạy migration và khởi tạo tài khoản Admin mặc định:
```powershell
python scripts/migrate_financial_integrity.py
python scripts/migrate_resilience.py
python scripts/seed.py
```
*(Lệnh `seed.py` sẽ tự động tạo tài khoản Admin `admin@capitalflow.vn` / `CapitalFlow@2026` cùng danh mục hệ thống).*

---

### Bước 3: Cài đặt Frontend (`user-web` & `admin-web`)

Mở terminal mới và cài đặt dependencies cho 2 ứng dụng giao diện:

1. Cài đặt **User Web** (Next.js):
```powershell
cd DoAn_KLCN/frontend/user-web
npm install
```

2. Cài đặt **Admin Web** (Vite + React):
```powershell
cd DoAn_KLCN/frontend/admin-web
npm install
```

---

## 🚀 5. Hướng Dẫn Khởi Chạy Toàn Bộ Dự Án

Để trải nghiệm trọn vẹn mọi tính năng của hệ thống, bạn mở **4 cửa sổ Terminal riêng biệt**:

### 🖥️ Terminal 1: Chạy Backend API (FastAPI)
```powershell
cd DoAn_KLCN/capitalflow-api
.\.venv\Scripts\activate
python -m uvicorn app.main:app --reload --port 8000
```
*(API chạy thành công tại [http://localhost:8000](http://localhost:8000))*

---

### ⚙️ Terminal 2: Chạy Background Worker (Tác vụ ngầm & OCR)
```powershell
cd DoAn_KLCN/capitalflow-api
.\.venv\Scripts\activate
python -m app.services.worker
```
*(Bắt buộc phải bật tiến trình này để xử lý quét hóa đơn và gửi email tự động).*

---

### 👤 Terminal 3: Chạy Ứng Dụng Người Dùng (User Web)
```powershell
cd DoAn_KLCN/frontend/user-web
npm run dev
```
*(Giao diện người dùng mở tại [http://localhost:3010](http://localhost:3010))*

---

### 🛡️ Terminal 4: Chạy Bảng Điều Khiển Quản Trị (Admin Web)
```powershell
cd DoAn_KLCN/frontend/admin-web
npm run dev
```
*(Bảng quản trị Admin mở tại [http://localhost:5173](http://localhost:5173))*

---

## 💡 6. Khắc Phục Lỗi Thường Gặp (Troubleshooting)

1. **Lỗi kết nối cơ sở dữ liệu (`Login failed for user` hoặc `SSL Certificate error`)**:
   - Thêm tham số `&TrustServerCertificate=yes` vào cuối chuỗi `DATABASE_URL` trong file `.env`.
   - Đảm bảo SQL Server đang ở trạng thái `Running` trong Windows Services.
   - Bật giao thức `TCP/IP` (port 1433) trong *SQL Server Configuration Manager*.

2. **Quét hóa đơn OCR không chạy / Treo ở trạng thái PENDING**:
   - Hãy chắc chắn rằng bạn đã khởi chạy **Terminal 2 (`worker`)**.
   - Kiểm tra `GOOGLE_AI_API_KEY` trong file `.env` nếu sử dụng tính năng trích xuất thông minh với Gemini AI.

3. **Xung đột cổng kết nối (Port already in use)**:
   - Port 8000: Backend API
   - Port 3010: User Web
   - Port 5173: Admin Web  
   *(Nếu bị trùng với ứng dụng khác, hãy tắt tiến trình cũ đang chiếm cổng hoặc chỉ định port khác khi chạy lệnh dev).*

---

## 👥 Dự Án Khóa Luận Tốt Nghiệp
- **Tên đồ án**: Xây dựng hệ thống quản lý tài chính cá nhân & OCR hóa đơn thông minh CapitalFlow.
- **Công nghệ chính**: FastAPI, Python 3.12, SQL Server, Next.js 15, Vite React, Tailwind CSS, Framer Motion, Tesseract & Gemini AI.
