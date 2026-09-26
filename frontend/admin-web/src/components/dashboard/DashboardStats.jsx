/**
 * ============================================================================
 * TÊN FILE: DashboardStats.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Bảng điều khiển
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị bốn chỉ số tổng quan do trang Dashboard cung cấp.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props data từ API /admin/overview và các primitive thiết kế dùng chung.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất component DashboardStats thuần trình bày, không tự gọi API.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ hiển thị số liệu tổng hợp; không suy diễn hoặc sửa dữ liệu nguồn.
 * ============================================================================
 */
import { ArrowLeftRight, ScanLine, ShieldCheck, Users } from "lucide-react";
import { Stat } from "../design";

export default function DashboardStats({ data }) {
  return (
    <div className="cf-grid-4">
      <Stat label="Tổng người dùng" value={data.users.total.toLocaleString("vi-VN")} icon={<Users />} note="Tài khoản đã đăng ký" />
      <Stat label="Tài khoản hoạt động" value={data.users.active.toLocaleString("vi-VN")} icon={<ShieldCheck />} note={`${data.users.banned} tài khoản đang bị khóa`} />
      <Stat label="Tổng giao dịch" value={data.total_transactions.toLocaleString("vi-VN")} icon={<ArrowLeftRight />} note="Tất cả thời gian" />
      <Stat label="Tổng hóa đơn" value={data.invoices.total.toLocaleString("vi-VN")} icon={<ScanLine />} note={`${data.invoices.completed} đã xác nhận`} />
    </div>
  );
}
