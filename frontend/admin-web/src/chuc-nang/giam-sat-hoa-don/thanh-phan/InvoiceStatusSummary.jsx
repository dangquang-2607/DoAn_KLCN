/**
 * ============================================================================
 * TÊN FILE: InvoiceStatusSummary.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Giám sát hóa đơn OCR
 * MỤC ĐÍCH CỤ THỂ:
 *   Tóm tắt số hóa đơn theo từng trạng thái xử lý.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props invoices và Panel dùng chung.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất nhóm badge trạng thái và số lượng tương ứng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Nhãn "Đã xác nhận" phản ánh hóa đơn đã được người dùng ghi nhận.
 * ============================================================================
 */
import { Panel } from "../../../dung-chung/UI-chung/design";

const STATUSES = [["uploaded", "Chưa quét"], ["processing", "Đang xử lý"], ["review_required", "Chờ kiểm tra"], ["completed", "Đã xác nhận"], ["failed", "Thất bại"]];

export default function InvoiceStatusSummary({ invoices }) {
  return <Panel title="Trạng thái hóa đơn"><div className="cf-panel-body cf-grid">{STATUSES.map(([key, label]) => <div className="cf-row cf-between" key={key}><span className={`cf-badge ${key === "failed" ? "danger" : key === "completed" ? "success" : "info"}`}>{label}</span><strong className="cf-number">{invoices[key]}</strong></div>)}</div></Panel>;
}
