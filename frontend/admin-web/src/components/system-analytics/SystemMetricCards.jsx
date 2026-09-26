/**
 * ============================================================================
 * TÊN FILE: SystemMetricCards.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Phân tích vận hành
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị ba chỉ số tổng hợp mà API phân tích hệ thống đang cung cấp.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props data từ /admin/system/analytics và primitive Stat.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất nhóm thẻ chỉ số thuần trình bày.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không hiển thị nội dung giao dịch cá nhân hoặc suy đoán tài nguyên máy chủ.
 * ============================================================================
 */
import { Stat } from "../design";

export default function SystemMetricCards({ data }) {
  return (
    <div className="cf-grid">
      <Stat label="Giao dịch tháng này" value={data.transactions.this_month.toLocaleString("vi-VN")} note={`Tháng ${data.period.month}/${data.period.year}`} />
      <Stat label="Người dùng có giao dịch" value={data.active_users_this_month.toLocaleString("vi-VN")} note="Trong tháng hiện tại" />
      <Stat label="Tổng giao dịch" value={data.transactions.total_all_time.toLocaleString("vi-VN")} note="Từ khi hệ thống hoạt động" />
    </div>
  );
}
