/**
 * ============================================================================
 * TÊN FILE: ocr.styles.ts
 * MÀN HÌNH / PHÂN HỆ: Hóa đơn AI / OCR
 * NHÓM VỆ TINH: _styles (Thiết kế)
 * MỤC ĐÍCH CỤ THỂ:
 *   Thực hiện trách nhiệm chuyên biệt của module trong user-web.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Không nhận dữ liệu runtime; cung cấp hằng style cho React.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất bộ style ocrStyles cho phân hệ.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Giới hạn định dạng/kích thước/số lượng tệp; chỉ tạo khoản chi sau bước người dùng xác nhận.
 * ============================================================================
 */
/** Style đặc thù layout hai cột và vùng xem trước hóa đơn. */
export const ocrStyles = { preview: { minHeight: 240 } } as const;
