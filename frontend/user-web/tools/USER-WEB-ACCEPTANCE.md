# Nghiệm thu user-web

Đợt hiện tại là `userweb-2026-11-05-final-02`, gồm **130 tình huống giao diện**.
Chốt ngày **06/11/2026: 130/130 ca đạt, đủ điều kiện chuyển sang admin-web**.

Đây là biên bản nghiệm thu lịch sử. Hai ca `BUDGET-07` và `BUDGET-08` ghi nhận các thao tác ngân sách đã ngừng cung cấp. Các mốc từng lưu vẫn được dùng khi tính ngân sách và lịch sử cũ.
Lượt cuối bổ sung bằng chứng cho `LEDGER-08`, `INVOICE-04`, `INVOICE-16`, `UX-10`
và kiểm thử lại ví/QR, mất phản hồi sau thanh toán và responsive trên build cuối.
Client, QR, TypeScript, ESLint, production build, HTTP và API tích hợp đều đạt.
Xem `output/user-web-qa/closure-2026-11-06.md` để đối chiếu kết quả và phạm vi.

Kết quả 128/128 của đợt `final-01` được lưu trong
`output/user-web-qa/userweb-2026-11-05-final-02/previous-plan.json` để tham khảo.

Danh sách hiện tại dùng thanh toán hóa đơn qua QR, bổ sung ca xác nhận gỡ nhập tay
và ca OCR bằng Gemini thật. Không dùng kết quả đợt trước để tự đánh dấu ca mới đạt.
Kết quả từng ca nằm trong `user-web-acceptance.json`; trạng thái tổng hợp ở
`output/user-web-qa/verification-status.json`.

Lượt chốt dùng database dùng một lần `cf_userweb_test_e5cab4e5aa98`.
Portal bản production tại `127.0.0.1:3011`, API tại 8011 và proxy tạo lỗi
có kiểm soát tại 8012. Các lượt trước có database riêng trong hồ sơ đợt.

SMTP thật chỉ được phép gửi đến `danghongquang2607@gmail.com`.
Người dùng đã xác nhận nhận OTP và đặt lại mật khẩu thành công.
Gemini thật dùng ảnh hóa đơn tổng hợp đã được cho phép. Các ca lỗi OCR có kiểm soát
vẫn dùng mô phỏng và được ghi riêng. Chỉ tính ca GUI đạt khi đã quan sát trên trình
duyệt hoặc người dùng trực tiếp xác nhận.

## Điều kiện chốt đợt

- Toàn bộ 130 tình huống đạt trong lượt hồi quy cuối, có cùng `execution_run_id`, thời điểm và bằng chứng quan sát trình duyệt hoặc phần người dùng trực tiếp thực hiện.
- Không còn tình huống thất bại, bị chặn hoặc chưa chạy; không còn lỗi chặn nghiệp vụ.
- TypeScript, ESLint, production build, kiểm tra client và hồi quy API đều đạt trên mã cuối cùng.
- Không dùng số lượng kiểm tra unit/API để cộng vào số tình huống giao diện đã đạt.
- Kiểm thử trong database/tệp tạm. SMTP/Gemini thật có phạm vi và bằng chứng riêng; các ca mô phỏng được ghi rõ. Kết quả chức năng không thay thế đo SQL, RAM hoặc chịu tải.
- Thay đổi mật khẩu được người dùng tự nhập và gửi ở giao diện. Cấp quyền camera và xóa vĩnh viễn tuân theo yêu cầu xác nhận tại thời điểm thao tác của công cụ.

## Cách tính

- Tỷ lệ đã thực thi = `(đạt + thất bại) / 130`.
- Tỷ lệ đạt trên phạm vi = `đạt / 130`.
- Tỷ lệ đạt trong phần đã chạy = `đạt / (đạt + thất bại)`; luôn báo cùng tỷ lệ thực thi, không dùng riêng chỉ số này để chốt đợt.
- Chưa chạy và bị chặn không được tính là đạt. Kết quả quan sát ở lượt cũ là tham khảo cho đến khi được chạy lại theo danh sách nghiệm thu.

## Lệnh kiểm tra

Chạy từ `frontend/user-web`:

```powershell
npm test
npm run typecheck -- --incremental false
npm run lint
npm run build
node tools/verify-user-web-acceptance.mjs
```

Lệnh cuối chỉ tổng hợp bằng chứng đã ghi trong JSON; không tự điều khiển trình duyệt, không tự đánh dấu đạt. Exit code `2` nghĩa là nghiệm thu chưa đủ, không phải phát hiện mới rằng ứng dụng bị lỗi. Khi chạy cần cập nhật môi trường test thực tế trong bản ghi kết quả.

Khi API thử riêng tại 8011 và Next.js tại 3011 đang chạy, kiểm tra luồng HTTP qua chính proxy của user-web:

```powershell
npm run test:http -- --report D:/code/DoAn_KLCN/output/user-web-qa/portal-http-regression.json
```

Bộ này kiểm tra HTML của các route và các yêu cầu đăng nhập, ví, QR, ghi sổ, báo cáo, đăng xuất đi qua cổng 3011. Nó từ chối thay đổi dữ liệu nếu API không xác nhận database thử có tên `cf_userweb_test_<12hex>`. Mỗi lần chạy tạo một tài khoản fixture riêng, được giữ đến khi database thử bị dọn. Đây là kiểm tra HTTP thực, **không phải kiểm thử giao diện trình duyệt**, không cộng vào 130 tình huống nghiệm thu.

Có thể lưu danh sách các kiểm tra client đã đạt:

```powershell
npm test -- --report D:/code/DoAn_KLCN/output/user-web-qa/client-regression.json
```

Từ `capitalflow-api`, chạy các kiểm tra API riêng:

```powershell
.venv/Scripts/python.exe tools/verify_bill_qr.py
.venv/Scripts/python.exe tools/verify_api_integration.py
```

Không chạy các lệnh tắt môi trường thử trong khi người dùng hoặc phiên kiểm thử giao diện còn sử dụng database thử.

## Kiểm thử lỗi kết nối có kiểm soát

`capitalflow-api/tools/serve_user_web_fault_proxy.py` chỉ chuyển tiếp tới API thử tại 8011, từ chối chạy nếu tên database không khớp giá trị thử được chỉ định. Nó không ghi log token, mật khẩu hay nội dung phản hồi.

```powershell
# Chạy từ capitalflow-api; thay tên bằng database thử thực tế.
.venv/Scripts/python.exe tools/serve_user_web_fault_proxy.py --expected-database cf_userweb_test_3caaee587d01

# Chạy Next thử riêng từ frontend/user-web, giữ nguyên API 8011 đang chạy.
$env:API_PROXY_TARGET='http://127.0.0.1:8012'
$env:NEXT_DIST_DIR='.next/user-web-test'
node node_modules/next/dist/bin/next dev --port 3011
```

Đổi chế độ bằng `POST http://127.0.0.1:8012/__fault` với JSON `{"mode":"..."}`:

- `fail_read`: GET danh sách `/api/v1/bookkeeping` trả 503 để kiểm tra giao diện lỗi/thử lại.
- `delay_read`: cùng GET trên bị trễ 3 giây để kiểm tra điều hướng khi đang tải.
- `lose_payment_response`: chuyển tiếp đúng một POST thanh toán ví thành công tới API thật trong database thử, sau đó thay phản hồi thành 503 và tự về `off`. Gửi lại đúng thông tin phải dùng cùng khóa và chỉ có một lần trừ tiền.
- `off`: mọi yêu cầu đi qua như bình thường; luôn trả chế độ về `off` khi tạm dừng hoặc kết thúc.

`GET /__fault` cho biết số yêu cầu khớp, số yêu cầu hoàn tất và mã phản hồi upstream; không trả dữ liệu bí mật. Kiểm tra HTTP riêng của proxy có tại `output/user-web-qa/fault-proxy-self-check.json`. Kết quả đó không thay thế quan sát giao diện UX-06/07/08.

## Các giới hạn cần đối chiếu trước khi chốt

- Bản ghi bằng chứng chỉ ghi nhận những gì đã quan sát, kể cả khi chiến dịch tiếp tục qua nhiều database thử. `environment_sessions` giữ tên database cho từng phần; phiên hiện tại phải được ghi riêng.
- Camera và khả năng hiển thị PDF tích hợp phụ thuộc trình duyệt. Kết quả trên `app.capitalflow.online` không tự thay thế phép thử trên `localhost:3011`; phải kiểm tra đúng phiên mã và môi trường.
- Sau thay đổi cuối cùng, vẫn cần lượt đi qua toàn bộ chuỗi user-web và các kích thước 1440×900, 768×1024, 390×844. Build thành công không tự đánh dấu những tình huống này đạt.
