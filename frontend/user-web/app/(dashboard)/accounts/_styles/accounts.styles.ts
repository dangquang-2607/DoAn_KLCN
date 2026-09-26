/**
 * ============================================================================
 * TÊN FILE: accounts.styles.ts
 * MÀN HÌNH / PHÂN HỆ: Ví & tài khoản
 * NHÓM VỆ TINH: _styles (Thiết kế)
 * MỤC ĐÍCH CỤ THỂ:
 *   Thực hiện trách nhiệm chuyên biệt của module trong user-web.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Không nhận dữ liệu runtime; cung cấp hằng style cho React.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất bộ style accountsStyles cho phân hệ.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Bảo toàn số dư và lịch sử; không cho ngừng tài khoản khi số dư khác 0.
 * ============================================================================
 */
/** Style đặc thù lưới và thẻ tài khoản. */
export const accountStyles = { balance: { fontSize: 30, fontWeight: 650, margin: "22px 0" } } as const;
