/**
 * ============================================================================
 * TÊN FILE: report-types.ts
 * MÀN HÌNH / PHÂN HỆ: Báo cáo & Phân tích tài chính
 * NHÓM VỆ TINH: dung-chung (Định nghĩa kiểu dữ liệu báo cáo)
 * MỤC ĐÍCH CỤ THỂ:
 *   Định nghĩa cấu trúc dữ liệu chuỗi thời gian cho biểu đồ xu hướng tài chính
 *   (ReportTrendPoint gồm thu nhập, chi phí, dòng tiền ròng và số dư tích lũy).
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Không phụ thuộc bên ngoài.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Type ReportTrendPoint.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Đảm bảo kiểu dữ liệu khớp chính xác với schema trả về từ backend API.
 * ============================================================================
 */
export type ReportTrendPoint = { date: string; income: number; expense: number; net: number; cumulative: number };
