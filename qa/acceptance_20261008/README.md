# Bộ kiểm thử nghiệm thu — 08/10/2026

Kết quả lượt tiếp tục và giới hạn còn lại: [Bổ sung nghiệm thu](BO_SUNG_NGHIEM_THU.md). Biên bản gốc bên dưới được giữ để truy vết lịch sử.

Đọc [báo cáo](BAO_CAO_NGHIEM_THU.md) trước khi dùng kết quả để báo cáo/bảo vệ. Các file này không sửa nghiệp vụ ứng dụng và không phải kết luận nghiệm thu toàn hệ thống.

## Chạy lại suite offline

Từ PowerShell ở `D:\code\DoAn_KLCN`, dùng môi trường Python hiện có đã cài pytest và dependencies của API:

```powershell
$env:PYTHONPATH = 'D:\code\DoAn_KLCN\capitalflow-api'
& .\capitalflow-api\.venv\Scripts\python.exe -m pytest qa/acceptance_20261008/tests -q --junitxml=qa/acceptance_20261008/results-current.xml
```

Suite cô lập DB từ trước khi import ứng dụng; không chạy suite cũ từ đường dẫn đã xóa, không trỏ sang SQL Server thật. Lệnh ghi đè báo cáo lần hiện tại: nếu cần lưu lịch sử, chọn tên XML khác. Không dùng thời gian chạy hoặc tỷ lệ pass làm tỷ lệ bao phủ code.

## Các script

- `serve_fixture.py`: API QA 8018, SQLite riêng, SMTP/AI credentials trống, không chạy worker. Chạy với `PYTHONPATH` ở trên, từ thư mục QA. Chỉ bind loopback.
- `seed_ui.py`: dữ liệu mẫu qua API QA; **chỉ chạy trên fixture mới**, không seed lặp vào fixture hiện tại.
- `live_email_smoke.py`: đúng một attempt qua worker SMTP thật, SQLite trong bộ nhớ. Đã chạy với người nhận được cho phép; **không chạy lại, không xóa marker** để gửi thêm khi chưa được cho phép. Cần chạy từ thư mục API để nạp cấu hình hiện có; `--recipient` và `--send-once` là tham số bắt buộc.
- `render_sample.ps1`: sinh ảnh hóa đơn tổng hợp, không phải ảnh người dùng; ghi `synthetic-invoice.png`.
- `live_ocr_smoke.py`: một worker iteration/provider thật trên ảnh tổng hợp, không xử lý job sản xuất. Đã có `live-ocr-result.json`; từ chối chạy lặp nếu marker tồn tại. Không xóa marker để âm thầm tiêu thụ thêm quota.
- `collect_evidence.ps1`: lưu hash nguồn, danh sách ảnh, số ca và so sánh bản user QA với nguồn. Không đọc `.env` hay ghi khóa dịch vụ. Chạy lại sẽ ghi đè manifest mốc chốt.

User frontend QA dùng bản sao mã ở `user-web-fixture/`, không commit thư viện/cache/SQLite. Admin build QA dùng `admin-build/`. Các thư mục sinh này đã được ignore; test, script, ảnh và báo cáo vẫn được giữ để xem/commit có chọn lọc.

## Dữ liệu bằng chứng

- `results-baseline.xml`: 79 ca trước điều chỉnh các kỳ vọng legacy, 3 thất bại được giải thích trong báo cáo.
- `results-acceptance.xml`: 13 ca bổ sung.
- `results-current.xml`: toàn bộ 92 ca cuối, 0 fail/error/skip.
- `live-email-result.json`: SMTP nhận gửi; người nhận đã xác nhận đến inbox trong cuộc trò chuyện ngày 08/10/2026.
- `live-ocr-result.json`: OCR thật một mẫu, không phải benchmark độ chính xác.
- `screenshots/`: 41 ảnh chụp thực tế; không phải video đo animation hoặc bằng chứng đã thử mọi trạng thái.
- `ui-observations.json`: số đo các màn hình lượt tiếp tục; không chứa toàn bộ lượt desktop trước đó.
- `ui-admin-login-finding.json`, `ui-tablet-select-finding.json`: số đo hai lỗi UI tái hiện.
- `evidence-manifest.json`: hash nguồn khi đóng gói, không thay thế commit bất biến.
- `static-checks.json`: kết quả lint/typecheck/build và giới hạn môi trường.

Không đẩy `.env`, DB QA có token/session, thư viện, cache hoặc file sinh build lên Git. Không thu hồi/sửa/xóa dữ liệu thật để chạy kiểm thử.

## Lượt tiếp tục

- `serve_extended.py`: chỉ dùng QA loopback, access token ngắn/lỗi refresh theo `qa-control.json`; worker được kích hoạt thủ công tại `/__qa/process`, SMTP transport và OCR provider giả lập. Không triển khai endpoint này lên môi trường thật.
- `expire_qa_refresh.py`: chỉ hết hạn refresh token của `qa-user@example.com` trong SQLite QA để thử giao diện; không dùng trên production.
- `sql_staging_probe.py`: kiểm tra SQL Server chỉ đọc; `sql_concurrency.py`: đã tạo DB QA riêng và chạy 4 ca, có marker chống chạy lặp. Không xóa marker/DB để tự ý chạy lại.
- `results-followup.xml`: 92/92 ca đạt trong lượt chạy lại.
- `sql-concurrency-result.json`, `ui2-retest.json`, `ui-api-trace.jsonl`, `ui-worker-sink.json`: bằng chứng bổ sung. `SENT` của sink không phải email gửi thật.
- Thu manifest bổ sung không ghi đè mốc cũ: `./qa/acceptance_20261008/collect_evidence.ps1 -ManifestName evidence-followup.json -ResultsName results-followup.xml`.
