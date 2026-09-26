/**
 * ============================================================================
 * TÊN FILE: InvoiceProgressWidget.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Bảng điều khiển
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị tỷ lệ hóa đơn theo từng trạng thái xử lý OCR.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Trạng thái React Query và dữ liệu /admin/system/ocr-monitor từ Dashboard.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất widget tiến trình và liên kết sang trang giám sát OCR.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Tỷ lệ chỉ phục vụ trình bày; luôn chống chia cho 0 khi chưa có hóa đơn.
 * ============================================================================
 */
import { Link } from "react-router-dom";
import { ErrorState, Loading, Panel } from "../design";

const STATUS_ROWS = [["uploaded", "Chưa quét"], ["processing", "Đang xử lý"], ["review_required", "Chờ kiểm tra"], ["completed", "Đã xác nhận"], ["failed", "Xử lý thất bại"]];

export default function InvoiceProgressWidget({ query }) {
  return (
    <Panel title="Tiến trình hóa đơn" action={<Link className="cf-inline-link" to="/ocr-monitor">Chi tiết →</Link>}>
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : (
        <div className="cf-panel-body cf-stack" style={{ gap: 20 }}>
          {STATUS_ROWS.map(([key, label]) => {
            const value = query.data.invoices[key];
            const total = query.data.invoices.total;
            return <div key={key}><div className="cf-row cf-between" style={{ fontSize: 14, marginBottom: 9 }}><span>{label}</span><strong className="cf-number">{value}</strong></div><div className="cf-progress"><span style={{ width: `${total ? (value / total) * 100 : 0}%`, background: key === "failed" ? "var(--cf-danger)" : undefined }} /></div></div>;
          })}
        </div>
      )}
    </Panel>
  );
}
