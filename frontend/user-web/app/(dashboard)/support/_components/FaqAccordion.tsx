/**
 * ============================================================================
 * TÊN FILE: FaqAccordion.tsx
 * MÀN HÌNH / PHÂN HỆ: Trung tâm hỗ trợ
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị câu hỏi thường gặp theo cấu trúc có thể truy cập bằng bàn phím.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất FaqAccordion để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
/**
 * Danh sách câu hỏi thường gặp về cách CapitalFlow cập nhật số dư, OCR và bảo mật.
 * Dùng details/summary gốc để giữ khả năng truy cập bàn phím.
 */
const faqs = [
  ["CapitalFlow có tự kết nối ngân hàng không?", "Các tài khoản hiện được theo dõi thủ công. Bạn tạo tài khoản, nhập số dư ban đầu và ghi nhận thu chi hoặc chuyển tiền trong hệ thống."],
  ["Quét hóa đơn có tự trừ tiền trong ví không?", "Chưa. Sau khi quét, bạn cần kiểm tra thông tin, chọn ví và xác nhận hóa đơn. Bước xác nhận mới tạo giao dịch chi tiêu và cập nhật số dư."],
  ["Có thể tải lên những loại tệp nào?", "Ảnh JPG, JPEG, PNG, WEBP và tài liệu PDF; mỗi tệp tối đa 10 MB. Bạn có thể chọn tối đa 5 hóa đơn để quét AI cùng lúc."],
  ["Làm gì khi muốn sửa một khoản chi?", "Mở Giao dịch, chọn nút sửa cạnh khoản chi và lưu thông tin mới. Hệ thống hoàn lại số dư cũ rồi áp dụng giá trị mới."],
  ["Xóa tài khoản có mất lịch sử không?", "Bạn cần đưa số dư về 0 trước khi ngừng sử dụng ví. Các giao dịch đã ghi nhận vẫn được giữ lại."],
  ["Làm thế nào để đổi mật khẩu?", "Mở Cài đặt & bảo mật, nhập mật khẩu hiện tại và mật khẩu mới. Nếu quên mật khẩu, dùng chức năng khôi phục tại trang đăng nhập."],
];

export default function FaqAccordion() {
  return (
    <>
      <h2 style={{ fontSize: 20, margin: 0 }}>Câu hỏi thường gặp</h2>
      <div className="cf-stack cf-help" style={{ gap: 12 }}>
        {faqs.map(([question, answer]) => (
          <details key={question}><summary>{question}</summary><p>{answer}</p></details>
        ))}
      </div>
    </>
  );
}
