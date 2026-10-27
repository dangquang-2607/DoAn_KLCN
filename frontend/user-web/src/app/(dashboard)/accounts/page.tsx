/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: Quản lý Ví & Tài khoản
 * NHÓM VỆ TINH: app (Route Next.js App Router)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điểm định tuyến cho phân hệ Quản lý ví và tài khoản thanh toán độc lập.
 *   Chuyển tiếp hiển thị sang component WalletWorkspace.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Component không gian làm việc WalletWorkspace từ phân hệ vi-tai-khoan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export đại diện cho trang /accounts.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Yêu cầu phiên đăng nhập hợp lệ (được bảo vệ bởi DashboardLayout).
 * ============================================================================
 */

// Route Next.js: Không gian quản lý ví độc lập
export { default } from "@/chuc-nang/vi-tai-khoan/thanh-phan/WalletWorkspace";
