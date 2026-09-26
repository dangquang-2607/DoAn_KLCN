# Báo cáo kiểm thử tải staging

Ngày chạy: 20/09/2026  
Mục tiêu: đánh giá p95/p99, SQLAlchemy connection pool, deadlock và khả năng phục vụ 500 request/giây.

## Phạm vi và cách chạy

- API FastAPI, SQL Server thật và bộ phát tải chạy trên cùng máy Windows staging.
- Mỗi lần chạy tạo một database `CapitalFlow_LoadTest_*` độc lập, tạo dữ liệu thử, chạy tải, kiểm tra toàn vẹn tiền và xóa database sau khi hoàn tất.
- Hỗn hợp request có xác thực: danh sách giao dịch 30%, dashboard 25%, tài khoản 15%, danh mục 15%, ngân sách 10% và chuyển tiền nguyên tử 5%.
- Các lần chạy đều kiểm tra mã HTTP, cặp giao dịch chuyển tiền, tổng số dư trước/sau, bộ đếm deadlock của SQL Server, log deadlock victim và pool timeout.

## Kết quả chính

### Một worker, mục tiêu 500 RPS trong 30 giây

- 15.000/15.000 request thành công; 14.250 phản hồi HTTP 200 và 750 phản hồi HTTP 201.
- Thông lượng thực tế: 90,33 RPS. Hệ thống phải xử lý tiếp hàng đợi trong khoảng 194,43 giây.
- p50: 4.383,94 ms; p95: 20.302,39 ms; p99: 31.906,79 ms; tối đa: 69.362,03 ms.
- Không ghi nhận pool timeout hoặc deadlock.
- Toàn vẹn tài chính đạt: không có cặp transfer sai và tổng số dư giữ nguyên `2.000.000.000,00` VND.

### Bốn worker, mục tiêu 500 RPS trong 20 giây

- 10.000/10.000 request thành công.
- Thông lượng thực tế: 88,12 RPS.
- p50: 4.394,61 ms; p95: 20.838,92 ms; p99: 31.498,13 ms; tối đa: 78.961,17 ms.
- SQL Server đạt tối đa 42 session trong mẫu đo; không có pool timeout, deadlock hoặc sai lệch số dư.
- Tăng số worker trên cùng máy không cải thiện thông lượng, vì API, bộ phát tải và SQL Server cạnh tranh cùng tài nguyên máy chủ.

### Ngưỡng ổn định đã đo

- 75 RPS: 1.125/1.125 request thành công; p95 24,40 ms; p99 61,27 ms; pool dùng tối đa 4/10 connection; tối đa 7 SQL session.
- 100 RPS: 1.500/1.500 request thành công; p95 32,52 ms; p99 87,10 ms; pool dùng tối đa 5/10 connection; tối đa 8 SQL session.
- 100 RPS là mức ổn định cao nhất đã xác nhận trong đợt này, không được hiểu là giới hạn tối đa tuyệt đối.

## Kết luận vận hành

Cấu hình và hạ tầng staging hiện tại chưa đáp ứng 500 RPS. Việc không xuất hiện HTTP 5xx ở bài 500 RPS không đồng nghĩa hệ thống chịu được tải: request bị xếp hàng, khiến p95 vượt 20 giây và thông lượng thực chỉ khoảng 90 RPS.

Connection pool không phải nút thắt tại 100 RPS; tăng `pool_size` khi chưa có số liệu chờ pool sẽ làm tăng số connection SQL Server mà chưa chắc tăng thông lượng. Với cấu hình `pool_size=10`, `max_overflow=20`, mỗi worker có thể mở tối đa 30 connection; bốn worker có khả năng tạo 120 connection.

Không phát hiện deadlock trong workload này và bất biến tiền được giữ nguyên. Kết quả này chỉ chứng minh các kịch bản đã chạy, không chứng minh mọi đường ghi đều không thể deadlock.

## Bước kiểm chứng tiếp theo

1. Tách bộ phát tải, API và SQL Server sang ba máy hoặc container host riêng để loại bỏ cạnh tranh CPU/I/O cục bộ.
2. Dùng dữ liệu staging có quy mô gần production, tối thiểu kịch bản dữ liệu tăng 20 lần.
3. Thu thập CPU, RAM, event-loop delay, AnyIO thread-token usage, pool wait time, thời gian từng truy vấn, SQL wait stats và execution plan.
4. Chạy tải bậc thang 100, 150, 200, 300, 400 và 500 RPS; giữ mỗi bậc đủ lâu để thấy trạng thái ổn định.
5. Chỉ điều chỉnh worker, pool và truy vấn sau khi xác định nút thắt bằng telemetry; lặp lại kiểm tra toàn vẹn tiền và deadlock sau mỗi thay đổi.

## Tệp kết quả

- `artifacts/load-tests/load-test-20260920062301_b2a736.*`: một worker, mục tiêu 500 RPS.
- `artifacts/load-tests/load-test-20260920062805_8acfa6.*`: bốn worker, mục tiêu 500 RPS.
- `artifacts/load-tests/load-test-20260920063919_af8f28.*`: một worker, 75 RPS.
- `artifacts/load-tests/load-test-20260920063949_89baae.*`: một worker, 100 RPS.
