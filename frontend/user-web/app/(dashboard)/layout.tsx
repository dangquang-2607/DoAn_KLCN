/**
 * ============================================================================
 * TÊN FILE: layout.tsx
 * MÀN HÌNH / PHÂN HỆ: User Web
 * NHÓM VỆ TINH: app (Hạ tầng định tuyến)
 * MỤC ĐÍCH CỤ THỂ:
 *   Thiết lập layout và phạm vi hiển thị của phân hệ tương ứng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất layout để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
import DashboardLayout from "@/components/layout/DashboardLayout";

// Mọi route trong nhóm dashboard đều đi qua cùng lớp bảo vệ phiên và điều hướng.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
