/**
 * ============================================================================
 * TÊN FILE: AuditLogActions.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Nhật ký quản trị
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp thao tác làm mới và xuất Excel cho trang nhật ký hiện tại.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Trang hiện tại, danh sách log, trạng thái query và tiện ích exportExcel.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất cụm nút dùng trong PageHead.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ xuất các cột đang được phép hiển thị; dữ liệu văn bản không trở thành công thức.
 * ============================================================================
 */
import { Download, RefreshCw } from "lucide-react";
import { useState } from "react";
import { errorMessage, exportExcel } from "../../../dung-chung/tien-ich/format";

export default function AuditLogActions({ page, list, fetching, onRefresh }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const exportCurrentPage = async () => {
    if (exporting) return;
    setExporting(true); setError("");
    try {
      await exportExcel(`nhat-ky-trang-${page}.xlsx`, {
        title: "CapitalFlow — Nhật ký quản trị",
        scope: `Trang ${page}: ${list.length} bản ghi theo bộ lọc hiện tại. Thời gian UTC.`,
        columns: [
          { title: "Thời gian UTC", width: 25, type: "datetime" },
          { title: "Người thực hiện", width: 30 }, { title: "Mã người thực hiện", width: 40 },
          { title: "Hành động", width: 32 }, { title: "Đối tượng", width: 24 },
          { title: "Mã đối tượng", width: 40 }, { title: "Mã HTTP", width: 14, type: "number" },
        ],
        rows: list.map((log) => [log.created_at, log.actor_name, log.admin_id, log.action, log.target_type, log.target_id, log.status_code]),
      });
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setExporting(false); }
  };
  return <><button className="cf-btn" onClick={onRefresh} disabled={fetching}><RefreshCw />Làm mới</button><button className="cf-btn" disabled={!list.length || exporting || fetching} onClick={exportCurrentPage}><Download />{exporting ? "Đang xuất…" : "Xuất Excel trang này"}</button>{error && <span role="alert" className="cf-danger">{error}</span>}</>;
}
