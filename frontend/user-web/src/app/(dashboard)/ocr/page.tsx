/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: Nhận diện hóa đơn AI (OCR)
 * NHÓM VỆ TINH: app (Route Next.js App Router)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điểm định tuyến cho phân hệ Tải lên, phân tích OCR và ghi sổ giao dịch từ hóa đơn.
 *   Chuyển tiếp hiển thị sang component BookkeepingInvoices.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Component BookkeepingInvoices từ phân hệ hoa-don-ai.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export đại diện cho trang /ocr.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Bảo vệ quyền riêng tư hình ảnh hóa đơn; kiểm soát phát hiện hóa đơn trùng lặp.
 * ============================================================================
 */

// Route Next.js: Không gian hóa đơn AI / OCR
export { default } from "@/chuc-nang/hoa-don-ai/BookkeepingInvoices";
