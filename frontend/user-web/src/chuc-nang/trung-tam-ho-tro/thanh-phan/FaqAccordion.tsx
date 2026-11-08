import { Panel } from "@/dung-chung/UI-chung/ui";
import styles from "../CSS/support.module.css";

/**
 * Danh sách câu hỏi thường gặp về cách CapitalFlow cập nhật số dư, OCR và bảo mật.
 * Dùng details/summary gốc để giữ khả năng truy cập bàn phím.
 */
const faqs = [
  ["Ví mới có sẵn tiền không?", "Không. Bạn chỉ đặt tên ví; số dư ban đầu là 0đ. Nạp từ ngân hàng liên kết hoặc nhận chuyển tiền từ ví khác để sử dụng."],
  ["Liên kết ngân hàng dùng để làm gì?", "Liên kết tài khoản ngân hàng được cấp để nạp và rút tiền cho các ví của bạn. Số dư và lịch sử được quản lý trong hệ thống; không đồng bộ giao dịch từ ngân hàng bên ngoài."],
  ["Quét hóa đơn có trừ tiền trong ví không?", "Không. OCR và khoản thu chi nhập tay chỉ ghi vào sổ thu chi để tính báo cáo, ngân sách; tạo, sửa hoặc xóa khoản ghi sổ không thay đổi tiền trong ví."],
  ["Giao dịch ví nào được tính vào thu chi?", "Thu/chi được tổng hợp từ sổ thu chi; giao dịch ví chỉ được tính khi bật “Tính vào thu chi”. Mặc định, nạp/rút ngân hàng và chuyển giữa các ví của bạn không được tính; thanh toán hóa đơn và chuyển/nhận tiền với người khác được tính. Khi được tính, tiền chuyển đi là chi tiêu, tiền nhận về là thu nhập. Bạn có thể bật hoặc tắt lựa chọn này trong chi tiết giao dịch ví ở Lịch sử giao dịch, rồi lưu thay đổi. Tổng quan và Báo cáo sử dụng lựa chọn đã lưu, không chỉ dựa vào mặc định. Thay đổi lựa chọn này không làm thay đổi số dư ví."],
  ["Tắt Tính vào thu chi có hoàn tiền không?", "Không. Tiền đã thanh toán và lịch sử giao dịch giữ nguyên. Khoản này chỉ bị loại khỏi báo cáo và ngân sách. Bật lại sẽ tính đúng một lần theo danh mục và phần chi tiêu cá nhân đã lưu."],
  ["Hóa đơn đã trả bằng ví có cần nhập lại qua OCR không?", "Bạn có thể gắn hóa đơn OCR vào khoản thanh toán đã có bằng lựa chọn Khoản thanh toán ví đã có. Hệ thống dùng lại một bản ghi thu chi và không trừ tiền lần hai."],
  ["Có thể chuyển tiền cho ai?", "Bạn có thể chuyển giữa các ví của mình hoặc sang ví của người dùng khác bằng mã ví. Kiểm tra tên người nhận, tên ví và số tiền trước khi xác nhận."],
  ["Có thể sửa hoặc xóa lịch sử tiền trong ví không?", "Không. Lịch sử nạp, rút và chuyển tiền được lưu để đối chiếu. Sổ thu chi riêng vẫn cho phép sửa và xóa khoản ghi chép của bạn."],
  ["Đóng ví có mất lịch sử không?", "Chỉ đóng được ví có số dư 0đ. Ví đã đóng không thể khôi phục hay thực hiện giao dịch; lịch sử vẫn xem được trong mục Ví đã đóng. Bạn có thể tạo ví mới với mã ví mới."],
  ["Có thể tải lên những loại tệp nào?", "Chỉ nhận ảnh JPG, JPEG, PNG và WEBP, tối đa 3 ảnh mỗi lượt và 2 MB mỗi ảnh. Hệ thống tự nhận diện lần lượt từng ảnh khi tải lên. Bạn có thể chọn tối đa 5 hóa đơn đã có để quét lại."],
  ["Làm thế nào để đổi mật khẩu?", "Mở Cài đặt & bảo mật, nhập mật khẩu hiện tại và mật khẩu mới. Nếu quên mật khẩu, dùng chức năng khôi phục tại trang đăng nhập."],
];

export default function FaqAccordion() {
  return (
    <Panel title="Câu hỏi thường gặp">
      <div className={styles.faqList}>
        {faqs.map(([question, answer]) => (
          <details key={question}><summary>{question}</summary><p>{answer}</p></details>
        ))}
      </div>
    </Panel>
  );
}
