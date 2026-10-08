# Tiến độ bản bàn giao — 08/10/2026

## Đã thực hiện sau báo cáo bổ sung

- Sửa interceptor user/admin: refresh 401/403 mới kết thúc phiên; 503/5xx/429/mất mạng giữ token, từ chối request và hàng đợi để UI thử lại. Timeout refresh 15 giây. Không tự bỏ qua xác thực.
- `node --test qa/acceptance_20261008/refresh-client.test.cjs`: 14/14 đạt với transport/storage giả lập, thực thi interceptor nguồn thực của hai web.
- Lint user/admin và typecheck bản user QA: exit 0.
- User UI: refresh 503 không chuyển login; sau phục hồi có refresh 200 và dữ liệu tải được bằng các nút Thử lại, không nhập lại mật khẩu. Ảnh `refresh-fixed-503-keeps-page.jpg`, `refresh-fixed-recovered.jpg`. Một số khối cần thử lại riêng; chưa đóng hiện tượng tải đồng thời lỗi đã ghi ở báo cáo trước.
- User UI refresh token hết hạn: API refresh 401, logout 204 và ảnh cuối `refresh-expired-final-login.jpg` tại login. Đã bổ sung bằng chứng thiếu.
- Admin UI: refresh 503 vẫn ở dashboard với nút Thử lại; khi phục hồi → refresh 200 → dashboard tải thành công không đăng nhập lại. Ảnh `admin-refresh-503-keeps-page.jpg`, `admin-refresh-recovered.jpg`.
- Email ngân sách thật: đã được người dùng cho phép đúng một thư; `live_budget_email.py` tạo dữ liệu tổng hợp riêng trong SQLite bộ nhớ, chạy BUDGET → EMAIL → SMTP thật, mỗi job 1 attempt DONE, BUDGET_ALERT SENT. Người nhận xác nhận **inbox** trong chat. `live-budget-email-result.json` lưu kết quả. Không gửi lại/không xóa marker.

## Đang chờ trước khi hoàn tất

- Admin UI: đã được cho phép nâng `qa-lifecycle-1357@example.com` lên ADMIN, kiểm tra rồi hạ về USER. Có ảnh `admin-role-promoted.jpg`, `admin-role-restored-user.jpg`. Chưa thử đăng nhập bằng chính tài khoản vừa nâng quyền.
- Cấp lại mật khẩu: đã bàn giao bước cuối cho người dùng; trace ghi POST reset-password trả 200 lúc 07:57:56 UTC (14:57:56 Việt Nam). DB QA xác nhận USER, must_change_password=1, token_version=4. Worker RESET_PASSWORD_TEMP SENT tới sink, không gửi email thật. Chưa kiểm thử đăng nhập/đổi mật khẩu tạm trên UI của tài khoản này.
- Xóa vĩnh viễn: đã chuẩn bị đúng tài khoản QA id 201c01a1-ce55-4349-a561-3ee25700559b (0 giao dịch, 0 hóa đơn), đang chờ xác nhận tại thời điểm thực hiện. Ảnh `admin-purge-confirmation.jpg`; chưa gọi đây là ca đạt.
- Môi trường được chọn: laptop, Windows API + SQL Express Trusted_Connection, hai web Docker. DB SQL riêng `CapitalFlow_QA_20261008_b5fcca32`; hướng dẫn tại `scripts/demo/README.md`. SMTP/AI tắt, không khởi động worker demo.
- Đã build hai image sau vá thư viện, smoke sơ bộ 32 kiểm tra HTTP đạt (readiness/storage, HTML/assets, CORS, login/refresh/logout, USER bị chặn admin403, khách401). Phát hiện thư mục upload demo chưa được tạo; đã sửa entrypoint demo tạo đúng thư mục riêng trước khởi động.
- Đã được phép chốt toàn bộ mã hiện tại, không push. Kết quả sau commit phải nằm trong `qa/release-runs/<full-commit>/<timestamp>/verification.json` cùng logs/image IDs. Chỉ mốc có completed và mọi exit_code=0 mới đạt suite/build/HTTP smoke của bản demo; không suy ra nghiệm thu toàn bộ đồ án.

## Bản vá thư viện 08/10/2026

- Theo yêu cầu người dùng: Next.js và eslint-config-next 16.3.5 → 16.3.8; Axios ^1.19.0 → ^1.20.0 ở cả hai web, lockfiles cập nhật các phụ thuộc có bản vá tương thích.
- npm audit --omit=dev: user và admin không có cảnh báo. npm audit toàn bộ admin: 0. User còn 5 high ở chuỗi công cụ lint braces → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next; không dùng audit --force để hạ major Next lint về14. Đây không phải kết luận không còn lỗ hổng.
- Sau cập nhật: 92 backend tests, 14 interceptor tests đạt; lint hai web/typecheck user đạt; hai Docker builds đạt. Các test interceptor dùng transport giả lập, không phải bằng chứng toàn bộ hành vi Axios ngoài trình duyệt.
- UI-01 màn hình đèn đăng nhập admin mobile, benchmark OCR có đáp án, Flutter và các giới hạn trong báo cáo gốc vẫn chưa được đóng bởi lượt sửa này.
