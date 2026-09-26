/**
 * ============================================================================
 * TÊN FILE: CategoryFilters.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Danh mục hệ thống
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều khiển loại danh mục, trạng thái và từ khóa tìm kiếm trên dữ liệu đã tải.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Giá trị filter và callback cập nhật do trang Categories truyền xuống.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất thanh lọc không gọi API và không sở hữu dữ liệu danh mục.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Bộ lọc chạy phía client, không thay đổi dữ liệu hệ thống.
 * ============================================================================
 */
import { Search } from "lucide-react";

export default function CategoryFilters({ type, status, search, onTypeChange, onStatusChange, onSearchChange }) {
  return (
    <div className="cf-row cf-between">
      <div className="cf-row">
        <div className="cf-tabs" role="tablist" aria-label="Loại danh mục">
          {[["EXPENSE", "Chi tiêu"], ["INCOME", "Thu nhập"]].map(([value, label]) => <button key={value} role="tab" aria-selected={type === value} onClick={() => onTypeChange(value)}>{label}</button>)}
        </div>
        <select className="cf-input cf-compact-select" value={status} onChange={(event) => onStatusChange(event.target.value)} aria-label="Lọc trạng thái">
          <option value="ALL">Mọi trạng thái</option><option value="ACTIVE">Đang dùng</option><option value="INACTIVE">Ngừng dùng</option>
        </select>
      </div>
      <div className="cf-search"><Search /><input className="cf-input" value={search} onChange={(event) => onSearchChange(event.target.value)} aria-label="Tìm danh mục" placeholder="Tìm danh mục…" /></div>
    </div>
  );
}
