/**
 * ============================================================================
 * TÊN FILE: analytics.styles.ts
 * MÀN HÌNH / PHÂN HỆ: Báo cáo tài chính
 * NHÓM VỆ TINH: _styles (Thiết kế)
 * MỤC ĐÍCH CỤ THỂ:
 *   Thực hiện trách nhiệm chuyên biệt của module trong user-web.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Không nhận dữ liệu runtime; cung cấp hằng style cho React.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất bộ style analyticsStyles cho phân hệ.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ trình bày dữ liệu tổng hợp; chưa tự quy đổi giữa các loại tiền.
 * ============================================================================
 */
/** Style đặc thù của báo cáo; tách khỏi page để tránh inline style lặp lại. */
export const analyticsStyles = {
  footnote: { fontSize: 12 },
} as const;
