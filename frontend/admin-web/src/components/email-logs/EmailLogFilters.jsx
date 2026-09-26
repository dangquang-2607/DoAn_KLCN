/**
 * ============================================================================
 * TÊN FILE: EmailLogFilters.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Email & cấu hình
 * MỤC ĐÍCH CỤ THỂ:
 *   Thu thập các bộ lọc nhật ký email mà backend đang hỗ trợ.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Giá trị search/type/status, danh mục loại email và callback cập nhật.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất thanh lọc không tự gọi API.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Page đặt lại phân trang về 1 mỗi khi filter thay đổi.
 * ============================================================================
 */
import { Field } from "../design";

export default function EmailLogFilters({ search, type, status, types, onSearchChange, onTypeChange, onStatusChange }) {
  return <div className="cf-toolbar"><Field label="Người nhận"><input className="cf-input" placeholder="Tìm theo email…" value={search} onChange={(event) => onSearchChange(event.target.value)} /></Field><Field label="Loại email"><select className="cf-input" value={type} onChange={(event) => onTypeChange(event.target.value)}><option value="">Tất cả loại</option>{Object.entries(types).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="Trạng thái"><select className="cf-input" value={status} onChange={(event) => onStatusChange(event.target.value)}><option value="">Tất cả trạng thái</option><option value="SENT">Đã gửi</option><option value="LOGGED_DEV">Lưu xem trước</option><option value="FAILED">Thất bại</option></select></Field></div>;
}
