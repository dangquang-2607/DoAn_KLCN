/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: Xác thực & Đăng nhập
 * NHÓM VỆ TINH: app (Route Next.js App Router)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điểm định tuyến cho màn hình đăng nhập hệ thống của người dùng.
 *   Chuyển tiếp hiển thị sang component LoginPage từ phân hệ dang-nhap.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Component LoginPage từ phân hệ dang-nhap.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export đại diện cho trang /login.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Route công khai; tự động điều hướng sang dashboard nếu đã có token hợp lệ.
 * ============================================================================
 */

// Route Next.js: Xác thực và đăng nhập
export { default } from "@/chuc-nang/dang-nhap/page";
