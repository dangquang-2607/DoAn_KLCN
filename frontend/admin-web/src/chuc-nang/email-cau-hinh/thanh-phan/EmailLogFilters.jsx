/**
 * ============================================================================
 * TÊN FILE: EmailLogFilters.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Cấu hình Email & Nhật ký gửi
 * MỤC ĐÍCH CỤ THỂ:
 *   Thanh công cụ lọc nhật ký gửi email theo trạng thái (thành công, thất bại, đang chờ),
 *   loại email (xác thực, thông báo, khôi phục) và tìm kiếm theo địa chỉ người nhận.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props filters, onFilterChange callback.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export EmailLogFilters component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Tối ưu tìm kiếm với debounce, tránh gửi truy vấn dồn dập về máy chủ.
 * ============================================================================
 */
import { Search } from "lucide-react";

/**
 * Thanh lọc nhật ký email theo trạng thái, loại email và từ khóa người nhận.
 */
export default function EmailLogFilters({ search, type, status, types, onSearchChange, onTypeChange, onStatusChange }) {
  return <div className="adm-rest-controls"><label className="adm-rest-search"><Search size={17} /><span className="adm-visually-hidden">Người nhận</span><input placeholder="Tìm email người nhận" value={search} onChange={(event) => onSearchChange(event.target.value)} /></label><label><span className="adm-visually-hidden">Loại email</span><select value={type} onChange={(event) => onTypeChange(event.target.value)}><option value="">Mọi loại email</option>{Object.entries(types).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span className="adm-visually-hidden">Trạng thái email</span><select value={status} onChange={(event) => onStatusChange(event.target.value)}><option value="">Mọi trạng thái</option><option value="SENT">Đã gửi</option><option value="LOGGED_DEV">Lưu xem trước</option><option value="FAILED">Thất bại</option></select></label></div>;
}
