/**
 * ============================================================================
 * TÊN FILE: login.styles.ts
 * MÀN HÌNH / PHÂN HỆ: Đăng nhập / Đăng ký
 * NHÓM VỆ TINH: _styles (Thiết kế)
 * MỤC ĐÍCH CỤ THỂ:
 *   Thực hiện trách nhiệm chuyên biệt của module trong user-web.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Không nhận dữ liệu runtime; cung cấp hằng style cho React.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất bộ style loginStyles cho phân hệ.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không ghi log mật khẩu/token; khóa thao tác khi đang gửi và xử lý phiên hết hạn nhất quán.
 * ============================================================================
 */
/** Style dùng riêng cho màn xác thực, tách khỏi logic đăng nhập/đăng ký. */
export const loginStyles = { fullHeight: { minHeight: "100vh" } } as const;
