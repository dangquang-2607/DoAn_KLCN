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
