# Đối chiếu hóa đơn tự động

Giao diện web tự gọi API đối chiếu sau 600 ms khi người dùng dừng sửa thông tin, và kiểm tra lại mỗi 10 giây khi biểu mẫu có thể chỉnh sửa. Phản hồi của dữ liệu cũ bị hủy/bỏ qua. Việc đối chiếu dùng dữ liệu đã có trong cơ sở dữ liệu, không gọi Gemini thêm.

## Điểm tương đồng phiên bản 1

Đây là điểm của quy tắc nghiệp vụ, không phải xác suất AI hoặc phần trăm ảnh giống nhau.

- Người bán: 15 điểm; chuẩn hóa dấu, chữ hoa/thường và quy tắc tên cửa hàng hiện có.
- Địa chỉ: 10 điểm.
- Ngày: 15 điểm.
- Tổng tiền: 20 điểm; phải cùng tiền tệ.
- Hai bằng chứng tốt nhất trong số số phiếu, giờ/phút và giỏ hàng chi tiết: tối đa 40 điểm, mỗi bằng chứng 20 điểm. Giỏ hàng dùng quy tắc đối chiếu chi tiết hiện có (ít nhất ba dòng khác nhau, dữ liệu số hợp lệ).
- Trường thiếu không được tính điểm. Số phiếu, mã số thuế hoặc giờ có mâu thuẫn rõ ràng giới hạn điểm tối đa ở 80.
- Cùng SHA-256 hoặc cùng định danh hóa đơn mạnh: 100 điểm.

Chỉ tìm trong cùng tài khoản, với các ứng viên cùng ngày/tiền tệ, cùng số phiếu, cùng SHA-256 hoặc cùng định danh mạnh. Một ngày hoặc số tiền giống nhau đơn lẻ không đủ để cảnh báo.

## Hiển thị và ghi sổ

- Trên 80%: cửa sổ tự mở với nút mở đúng hóa đơn đối chiếu.
- Từ 50% đến 80% (bao gồm đúng 80%): nhãn Nghi trùng và nút đối chiếu.
- Dưới 50%: không thêm ứng viên chỉ dựa trên điểm thấp; các bằng chứng trùng chắc chắn hiện có vẫn được giữ.
- Đóng cửa sổ không làm nó mở lại do polling/sửa dữ liệu nếu cùng hóa đơn đích và cùng điểm. Chuyển sang hóa đơn khác bắt đầu một phiên xem mới.
- Thông báo nằm ngoài hai tab Thông tin/Mặt hàng để vẫn hiển thị khi đang sửa mặt hàng.
- Điểm phục vụ thông báo; quy tắc EXACT/SUSPECTED và review token vẫn kiểm soát ghi sổ. Điểm cao không tự gộp/xóa hóa đơn hay tự tạo giao dịch.
- Bản nháp cũ được ưu tiên làm bản gốc; bản đã ghi sổ được ưu tiên đối chiếu.

Giai đoạn tải lên hiện đã có kiểm tra SHA-256 và OCR trước khi tạo bản mới. Xem [workflow đầy đủ](workflow-hoa-don-hai-giai-doan.md). Phần trên mô tả giai đoạn đối chiếu sau khi hóa đơn đã vào danh sách, không thay thế cổng kiểm tra tải lên. Khi chưa đủ dữ liệu, giao diện thông báo rõ thay vì khẳng định không trùng.

## Kiểm chứng

Backend: `python -m unittest discover -s tests -p test_retail_invoice_duplicates.py` tại capitalflow-api.

Frontend: `npm run typecheck`, ESLint các tệp thay đổi, và `node tests/automatic-invoice-duplicates.cjs` tại frontend/user-web (cần Playwright, Edge và Next chạy tại localhost:3010; có thể đổi bằng QA_FRONTEND_URL).

Kiểm thử trình duyệt giả lập toàn bộ API: tự kiểm tra, cửa sổ trên 80%, nhãn tại 80%, phản hồi cũ, lỗi mạng, đóng thông báo, tab mặt hàng và điều hướng tới bản cũ. Không gửi ảnh hoặc gọi Gemini.
