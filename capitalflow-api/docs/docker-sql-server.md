# Docker Compose với SQL Server và ODBC 18

## Phạm vi và trạng thái

Compose chạy ứng dụng API và worker kết nối SQL Server đã có. Nó không cài SQL Server mới, tạo SQL login, đổi mixed authentication, cấp quyền hay thay chứng chỉ máy chủ. SQL Server, tài khoản dịch vụ và quyền truy cập do quản trị viên cung cấp từ trước.

Đã kiểm chứng image Linux, ODBC 18, bộ test offline, API với SQLite và TCP tới SQL Server local. Chưa xác nhận production: chưa đăng nhập SQL Server từ Linux bằng SQL Authentication/Kerberos, kiểm tra chứng chỉ production, diễn tập backup/restore, HA và kiểm thử tải thực tế. `ready=true` trong chẩn đoán chỉ xác nhận các kiểm tra được nêu dưới đây, không chứng nhận production.

## Cấu hình chung

1. Sao chép `.env.docker.example` thành `.env.docker`. File mẫu chứa giá trị trống và placeholder; không dùng nguyên mẫu để chạy.
2. Điền cấu hình bằng secret được cấp qua quy trình vận hành. `.env.docker` bị Git ignore; mọi `.env*` bị loại khỏi image. Hạn chế quyền đọc file; không chạy `docker compose config` không có `--quiet` vì có thể hiển thị secret.
3. Giữ nguyên `JOB_ENCRYPTION_KEY` của deployment hiện tại. Khóa mới chỉ dùng cho deployment mới; thay khóa sẽ khiến dữ liệu đã mã hóa không đọc được. API và worker phải dùng cùng khóa.
4. Dùng FQDN và cổng TCP cố định do quản trị viên cung cấp, khớp SAN của chứng chỉ SQL Server. Không dùng `localhost\SQLEXPRESS` trong container. `host.docker.internal` chỉ phù hợp kiểm tra local khi chứng chỉ và xác thực đã được cấu hình tương ứng.
5. Giữ `Encrypt=yes&TrustServerCertificate=no`. Cài CA nội bộ được cấp vào trust store của image nếu cần, bằng bản mở rộng Dockerfile chỉ sao chép **chứng chỉ CA công khai**, rồi chạy `update-ca-certificates`. Không sao chép private key vào image, không tắt kiểm tra chứng chỉ để vượt lỗi.
6. Đặt `UPLOAD_DIR=/app/uploads`; Compose gắn volume chung cho API/worker. Volume phải được sao lưu cùng dữ liệu ứng dụng.

Trong PowerShell, tại `capitalflow-api`:

```powershell
Copy-Item .env.docker.example .env.docker
# Chỉnh .env.docker bằng trình soạn thảo/secret manager; không dán secret vào shell.
$env:CAPITALFLOW_ENV_FILE = '.env.docker'
docker compose config --quiet
docker compose build
docker compose run --rm --no-deps capitalflow-api python -m scripts.diagnose_deployment
```

Không ghi đè `.env.docker` đã tồn tại; chỉ sao chép mẫu ở lần thiết lập đầu tiên. Lệnh `run` trên không khởi động worker và không gửi email.

## SQL Authentication

Dùng SQL login đã được cấp sẵn. Percent-encode username/password khi đưa vào `DATABASE_URL`; tránh double-encode. Mẫu cấu trúc nằm trong `.env.docker.example`. Không dùng tài khoản quản trị máy chủ cho ứng dụng. Nếu máy chủ chưa cho phép phương thức này, báo quản trị viên lựa chọn cách xác thực phù hợp, không tự bật mixed authentication.

## Kerberos trên Linux

Dùng URL không chứa username/password, có `Trusted_Connection=yes`, ODBC 18 và TLS kiểm tra chứng chỉ. Kerberos cần DNS/KDC truy cập được, đồng hồ đồng bộ, FQDN/SPN đúng và principal đã có quyền trong SQL Server. Linux không tự kế thừa phiên Windows hay fallback sang NTLM. [Microsoft: Integrated Authentication](https://learn.microsoft.com/en-us/sql/connect/odbc/linux-mac/using-integrated-authentication?view=sql-server-ver17).

Image hiện có ODBC; nếu lấy ticket trong container, mở rộng image với `krb5-user` và cấu hình noninteractive do đội vận hành cung cấp. Có thể thay bằng hệ thống cấp/đổi ticket bên ngoài. Không tạo realm, principal hoặc keytab trong mã ứng dụng.

Ví dụ **cấu trúc** override Compose do đội vận hành hoàn thiện (các biến đường dẫn phải trỏ tới tài nguyên được cấp sẵn):

```yaml
services:
  capitalflow-api:
    environment:
      KRB5_CONFIG: /etc/krb5.conf
      KRB5CCNAME: FILE:/run/kerberos/ccache
    volumes:
      - ${KRB5_CONFIG_PATH}:/etc/krb5.conf:ro
      - ${KRB5_CACHE_DIRECTORY}:/run/kerberos:ro
  capitalflow-worker:
    environment:
      KRB5_CONFIG: /etc/krb5.conf
      KRB5CCNAME: FILE:/run/kerberos/ccache
    volumes:
      - ${KRB5_CONFIG_PATH}:/etc/krb5.conf:ro
      - ${KRB5_CACHE_DIRECTORY}:/run/kerberos:ro
```

Với phương án này, tiến trình cấp ticket bên ngoài quản lý file `ccache`, quyền UID đọc và gia hạn trước khi hết hạn; gắn thư mục để việc thay file cache được nhìn thấy trong container. Không commit cache/keytab; không COPY chúng vào image. Nếu dùng `kinit -kt`, keytab được mount bằng secret ở tiến trình cấp ticket, không truyền mật khẩu bằng tham số. Kiểm tra ticket bằng `klist` trong môi trường có Kerberos tooling; không đưa đầu ra chứa danh tính nội bộ vào log công khai.

Áp dụng override cho **mọi** lệnh chẩn đoán/khởi động liên quan, ví dụ thêm `-f docker-compose.yml -f compose.kerberos.yml` sau `docker compose`. Override ở trên là mẫu cấu trúc, chưa phải cấu hình Kerberos đã được kiểm chứng tại hệ thống này.

## Chẩn đoán và khởi động

`scripts.diagnose_deployment` trả JSON với `ready`, `stage`, `code` và exit code 0/1. Không in URL, password, payload hoặc nội dung exception. Các bước: cấu hình ODBC 18/TLS → driver → TCP (timeout 5 giây) → đăng nhập SQL/SELECT 1 → hai migration và quyền đọc bảng → file thử tạm trong upload (tự xóa). Không chạy DDL/DML, migration, gửi email hoặc claim job. Công cụ không xác minh toàn bộ quyền INSERT/UPDATE/DELETE của ứng dụng.

Nếu thiếu migration, dùng quy trình migration đã được phê duyệt trong `resilience-release.md` với tài khoản triển khai phù hợp; công cụ chẩn đoán không tự sửa CSDL.

Sau khi chẩn đoán qua và các điều kiện vận hành đã được xác nhận:

```powershell
docker compose up -d capitalflow-api
docker compose ps
# Worker bắt đầu xử lý hàng đợi thật, có thể gửi email/gọi Gemini:
docker compose up -d capitalflow-worker
```

Compose kiểm tra `/ready` mỗi 30 giây, timeout 20 giây, 3 lần thất bại đánh dấu unhealthy. `/health` xác nhận tiến trình sống; `/ready` kiểm tra SQL SELECT 1 và thư mục upload tồn tại. Healthcheck không tự restart container unhealthy và không giám sát tiến độ worker. Cần cảnh báo job DEAD, tuổi hàng đợi, ticket sắp hết hạn, dung lượng upload và quy trình khôi phục riêng.

## Điều kiện trước khi xác nhận production

Chạy chẩn đoán trong mạng production với đúng CA/tài khoản hoặc ticket; xác minh quyền nghiệp vụ trên staging; kiểm tra TLS, rotation secret/ticket, backup/restore, giám sát worker, ingress HTTPS, rate limiting dùng chung khi nhiều replica và tải mục tiêu. Không suy diễn kết quả SQLite hoặc TCP thành xác nhận đăng nhập SQL Server hay sẵn sàng production. [Microsoft: ODBC encryption options](https://learn.microsoft.com/en-us/sql/connect/odbc/dsn-connection-string-attribute?view=sql-server-ver17).
