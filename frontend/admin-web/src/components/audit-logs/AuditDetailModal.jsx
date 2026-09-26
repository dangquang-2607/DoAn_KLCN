/**
 * ============================================================================
 * TÊN FILE: AuditDetailModal.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Nhật ký quản trị
 * MỤC ĐÍCH CỤ THỂ:
 *   Trình bày các trường chi tiết của một bản ghi nhật ký được chọn.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Bản ghi selected và callback đóng modal.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất modal chi tiết hoặc null khi chưa chọn bản ghi.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   React tự escape nội dung; chuỗi dài được wrap để không phá bố cục.
 * ============================================================================
 */
import { Modal } from "../design";

export default function AuditDetailModal({ selected, onClose }) {
  if (!selected) return null;
  const fields = [["Hành động", selected.action], ["Người thực hiện", selected.admin_id], ["Loại đối tượng", selected.target_type], ["Mã đối tượng", selected.target_id], ["Thời gian", new Date(selected.created_at).toLocaleString("vi-VN")]];
  return <Modal title="Chi tiết nhật ký" onClose={onClose}><div className="cf-form">{fields.map(([label, value]) => <div key={label}><div className="cf-eyebrow">{label}</div><div style={{ overflowWrap: "anywhere" }}>{value || "—"}</div></div>)}</div></Modal>;
}
