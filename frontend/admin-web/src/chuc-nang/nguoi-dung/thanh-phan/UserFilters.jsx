/**
 * ============================================================================
 * TÊN FILE: UserFilters.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Quản lý Người dùng
 * MỤC ĐÍCH CỤ THỂ:
 *   Thanh công cụ lọc người dùng theo trạng thái (hoạt động, bị khóa, chờ kích hoạt),
 *   vai trò (admin, user), và ô tìm kiếm theo tên hoặc địa chỉ email.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props filters, onFilterChange callback, useDebouncedValue.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export UserFilters component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Tự động xóa khoảng trắng thừa ở ô tìm kiếm trước khi áp dụng bộ lọc.
 * ============================================================================
 */
import { Download, Search } from "lucide-react";
import { useState } from "react";
import { errorMessage, exportExcel } from "../../../dung-chung/tien-ich/format";
import { accountStatus } from "../xu-ly/utils";

/**
 * Bộ lọc tìm kiếm và phân loại danh sách người dùng hệ thống.
 */
export default function UserFilters({ search, role, status, list, selected, page, onSearch, onRole, onStatus }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const exportUsers = async () => {
    if (exporting) return;
    setExporting(true); setError("");
    const rows = list.filter((user) => !selected.length || selected.includes(user.id));
    try {
      await exportExcel(`nguoi-dung-trang-${page}.xlsx`, {
        title: "CapitalFlow — Người dùng",
        scope: `${selected.length ? "Các dòng đã chọn" : "Toàn bộ dòng"} trên trang ${page}: ${rows.length} người dùng.`,
        columns: [{ title: "Họ tên", width: 32 }, { title: "Email", width: 42 }, { title: "Vai trò", width: 22 }, { title: "Trạng thái", width: 30 }],
        rows: rows.map((user) => [user.full_name, user.email, user.role === "ADMIN" ? "Quản trị viên" : user.role === "USER" ? "Người dùng" : user.role, accountStatus(user).label]),
      });
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setExporting(false); }
  };
  return (
    <>
      <div className="adm-rest-controls">
        <div className="adm-rest-filters-group">
          <label className="adm-rest-search">
            <Search size={16} />
            <span className="adm-visually-hidden">Tìm người dùng</span>
            <input
              placeholder="Họ tên hoặc email"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </label>
          <label className="adm-rest-select-wrap">
            <span className="adm-visually-hidden">Vai trò</span>
            <select value={role} onChange={(e) => onRole(e.target.value)}>
              <option value="">Mọi vai trò</option>
              <option value="USER">Người dùng</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </label>
          <label className="adm-rest-select-wrap">
            <span className="adm-visually-hidden">Trạng thái</span>
            <select value={status} onChange={(e) => onStatus(e.target.value)}>
              <option value="">Mọi trạng thái</option>
              <option value="active">Có thể truy cập</option>
              <option value="banned">Đã khóa</option>
              <option value="deleted">Đã xóa (Thùng rác)</option>
              <option value="purge_pending">Đang xóa vĩnh viễn</option>
            </select>
          </label>
        </div>

        <div className="adm-rest-divider" aria-hidden="true" />

        <button
          type="button"
          className="cf-btn adm-rest-export-btn"
          disabled={!list.length || exporting}
          onClick={exportUsers}
        >
          <Download size={15} />
          <span>{exporting ? "Đang xuất…" : selected.length ? "Xuất Excel đã chọn" : "Xuất Excel trang này"}</span>
        </button>
      </div>
      {error && <p role="alert" className="cf-danger">{error}</p>}
    </>
  );
}
