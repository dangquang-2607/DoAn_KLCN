/**
 * ============================================================================
 * TÊN FILE: transactions.styles.ts
 * MÀN HÌNH / PHÂN HỆ: Giao dịch
 * NHÓM VỆ TINH: _styles (Thiết kế)
 * MỤC ĐÍCH CỤ THỂ:
 *   Thực hiện trách nhiệm chuyên biệt của module trong user-web.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Không nhận dữ liệu runtime; cung cấp hằng style cho React.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất bộ style transactionsStyles cho phân hệ.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Validate tài khoản, tiền tệ và số tiền; mọi ghi/xóa phải làm mới các cache tài chính liên quan.
 * ============================================================================
 */
/** Style đặc thù bảng và số tiền giao dịch. */
export const transactionStyles = { amount: { fontVariantNumeric: "tabular-nums" } } as const;
