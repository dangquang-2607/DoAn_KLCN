/**
 * ============================================================================
 * TÊN FILE: emailStatus.js
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Cấu hình Email & Nhật ký gửi
 * NHÓM VỆ TINH: xu-ly (Tiện ích chuẩn hóa trạng thái email)
 * MỤC ĐÍCH CỤ THỂ:
 *   Định nghĩa từ điển nhãn trạng thái email, màu sắc huy hiệu và mô tả tiếng Việt
 *   cho các trạng thái: SENT, FAILED, PENDING, DELIVERED.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Mã trạng thái email chuẩn từ backend.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Các hàm resolveEmailStatus, emailStatusBadge.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Cung cấp giá trị mặc định an toàn khi gặp mã trạng thái lạ chưa hỗ trợ.
 * ============================================================================
 */
export function emailStatus(status) {
  return ({ SENT: { label: "Đã gửi", tone: "teal" }, LOGGED_DEV: { label: "Lưu xem trước", tone: "violet" },
    FAILED: { label: "Thất bại", tone: "coral" }, QUEUED: { label: "Đang chờ", tone: "amber" },
    PENDING: { label: "Đang chờ", tone: "amber" } })[status] || { label: status || "Chưa ghi nhận", tone: "slate" };
}
