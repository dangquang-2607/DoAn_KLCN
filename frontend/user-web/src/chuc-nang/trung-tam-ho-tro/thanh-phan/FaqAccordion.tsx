/**
 * ============================================================================
 * TÊN FILE: FaqAccordion.tsx
 * MÀN HÌNH / PHÂN HỆ: Trung tâm hỗ trợ
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
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
const faqs = process.env.NEXT_PUBLIC_INDEPENDENT_WALLETS === "true" ? [
  ["Ví mới có sẵn tiền không?", "Không. Bạn chỉ đặt tên ví; số dư ban đầu là 0đ. Nạp từ ngân hàng liên kết hoặc nhận chuyển tiền từ ví khác để sử dụng."],
  ["Liên kết ngân hàng dùng để làm gì?", "Liên kết mô phỏng dùng để nạp tiền vào ví và rút tiền về ngân hàng. Không đồng bộ số dư hoặc giao dịch ngân hàng, không chuyển tiền thật."],
  ["Quét hóa đơn có trừ tiền trong ví không?", "Không. OCR và khoản thu chi nhập tay chỉ ghi vào sổ thu chi để tính báo cáo, ngân sách; tạo, sửa hoặc xóa khoản ghi sổ không thay đổi tiền trong ví."],
  ["Tính vào chi tiêu xuất hiện khi nào?", "Sau khi thanh toán hóa đơn bằng ví thành công. Mặc định khoản thanh toán mới được phân loại khi đủ dữ liệu và tính vào chi tiêu. Bạn có thể đổi danh mục hoặc tắt nút trong lịch sử ví."],
  ["Tắt Tính vào chi tiêu có hoàn tiền không?", "Không. Tiền đã thanh toán và lịch sử ví giữ nguyên. Khoản này chỉ bị loại khỏi sổ thu chi, báo cáo và ngân sách. Bật lại sẽ tính đúng một lần theo danh mục và phần chi tiêu cá nhân đã lưu."],
  ["Hóa đơn đã trả bằng ví có cần nhập lại qua OCR không?", "Bạn có thể gắn hóa đơn OCR vào khoản thanh toán đã có bằng lựa chọn Khoản thanh toán ví đã có. Hệ thống dùng lại một bản ghi thu chi và không trừ tiền lần hai. Nếu đã ghi sổ trước khi thanh toán, chọn khoản chi đó ở bước thanh toán."],
  ["Có thể chuyển tiền cho ai?", "Bạn có thể chuyển giữa các ví của mình hoặc sang ví của người dùng khác bằng mã ví. Kiểm tra tên người nhận, tên ví và số tiền trước khi xác nhận."],
  ["Có thể sửa hoặc xóa lịch sử tiền trong ví không?", "Không. Lịch sử nạp, rút và chuyển tiền được lưu để đối chiếu. Sổ thu chi riêng vẫn cho phép sửa và xóa khoản ghi chép của bạn."],
  ["Đóng ví có mất lịch sử không?", "Chỉ đóng được ví có số dư 0đ. Ví đã đóng không thể khôi phục hay thực hiện giao dịch; lịch sử vẫn xem được trong mục Ví đã đóng. Bạn có thể tạo ví mới với mã ví mới."],
  ["Có thể tải lên những loại tệp nào?", "Ảnh JPG, JPEG, PNG, WEBP và tài liệu PDF; mỗi tệp tối đa 10 MB. Bạn có thể chọn tối đa 5 hóa đơn để quét AI cùng lúc."],
  ["Làm thế nào để đổi mật khẩu?", "Mở Cài đặt & bảo mật, nhập mật khẩu hiện tại và mật khẩu mới. Nếu quên mật khẩu, dùng chức năng khôi phục tại trang đăng nhập."],
] : [
  ["CapitalFlow có tự kết nối ngân hàng không?", "Tính năng liên kết ngân hàng hiện là mô phỏng để thử quy trình đăng nhập, xác thực và đồng bộ; không truy cập ngân hàng thật. Bạn vẫn có thể ghi nhận giao dịch thủ công."],
  ["Quét hóa đơn có tự trừ tiền trong ví không?", "Chưa. Sau khi quét, bạn cần kiểm tra thông tin, chọn ví và xác nhận hóa đơn. Bước xác nhận mới tạo giao dịch chi tiêu và cập nhật số dư."],
  ["Có thể tải lên những loại tệp nào?", "Ảnh JPG, JPEG, PNG, WEBP và tài liệu PDF; mỗi tệp tối đa 10 MB. Bạn có thể chọn tối đa 5 hóa đơn để quét AI cùng lúc."],
  ["Làm gì khi muốn sửa một khoản chi?", "Mở Giao dịch, chọn nút sửa cạnh khoản chi và lưu thông tin mới. Hệ thống hoàn lại số dư cũ rồi áp dụng giá trị mới."],
  ["Vì sao có giao dịch không có nút sửa?", "Giao dịch chuyển tiền và điều chỉnh số dư do hệ thống tạo không thể sửa trực tiếp. Bạn có thể xóa chúng: chuyển tiền sẽ xóa cả hai vế và điều chỉnh số dư ví. Giao dịch ngân hàng mô phỏng có thể gỡ khỏi sổ theo dõi; số dư nguồn ngân hàng vẫn giữ nguyên."],
  ["Xóa ví có mất lịch sử không?", "Có. Xóa ví sẽ xóa vĩnh viễn giao dịch và hóa đơn liên quan. Các lần chuyển tiền với ví khác cũng bị xóa ở cả hai phía; ngân sách và báo cáo được tính lại."],
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
