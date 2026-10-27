/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: Sổ giao dịch thu chi
 * NHÓM VỆ TINH: app (Route Next.js App Router)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điểm định tuyến cho phân hệ Ghi chép, lọc, tìm kiếm và xuất dữ liệu giao dịch.
 *   Chuyển tiếp hiển thị sang component BookkeepingWorkspace.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Component BookkeepingWorkspace từ phân hệ giao-dich.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export đại diện cho trang /transactions.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Bảo đảm tính toàn vẹn của số dư ví khi tạo, sửa hoặc xóa bút toán giao dịch.
 * ============================================================================
 */

// Route Next.js: Không gian sổ thu chi độc lập
export { default } from "@/chuc-nang/giao-dich/BookkeepingWorkspace";
