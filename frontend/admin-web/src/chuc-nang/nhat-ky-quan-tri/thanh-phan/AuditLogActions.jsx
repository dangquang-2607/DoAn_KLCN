/**
 * ============================================================================
 * TÊN FILE: AuditLogActions.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Nhật ký quản trị
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp thao tác làm mới và xuất CSV cho trang nhật ký hiện tại.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Trang hiện tại, danh sách log, trạng thái query và tiện ích exportCsv.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất cụm nút dùng trong PageHead.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ xuất các cột đang được phép hiển thị và giữ cơ chế chống CSV injection.
 * ============================================================================
 */
import { Download, RefreshCw } from "lucide-react";
import { exportCsv } from "../../../dung-chung/tien-ich/format";

export default function AuditLogActions({ page, list, fetching, onRefresh }) {
  const exportCurrentPage = () => exportCsv(`nhat-ky-trang-${page}.csv`, [["Thời gian UTC", "Người thực hiện", "Mã người thực hiện", "Hành động", "Đối tượng", "Mã đối tượng", "Mã HTTP"], ...list.map((log) => [log.created_at, log.actor_name, log.admin_id, log.action, log.target_type, log.target_id, log.status_code])]);
  return <><button className="cf-btn" onClick={onRefresh} disabled={fetching}><RefreshCw />Làm mới</button><button className="cf-btn" disabled={!list.length} onClick={exportCurrentPage}><Download />Xuất trang này</button></>;
}
