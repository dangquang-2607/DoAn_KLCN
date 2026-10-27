/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: Bảng điều khiển Tổng quan (Dashboard)
 * NHÓM VỆ TINH: app (Route Next.js App Router)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điểm định tuyến chính của khu vực bảng điều khiển người dùng sau khi xác thực.
 *   Chuyển tiếp hiển thị sang component IndependentOverview.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Component IndependentOverview từ phân hệ tong-quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export đại diện cho route gốc dashboard (/).
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Tổng hợp trạng thái tài chính real-time từ các ví, ngân sách và giao dịch gần đây.
 * ============================================================================
 */

// Route Next.js: Không gian tổng quan tài chính độc lập
export { default } from "@/chuc-nang/tong-quan/IndependentOverview";
