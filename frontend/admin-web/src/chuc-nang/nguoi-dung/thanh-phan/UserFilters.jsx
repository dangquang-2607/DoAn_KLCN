import { Download, Search } from "lucide-react";
import { exportCsv } from "../../../dung-chung/tien-ich/format";
import { accountStatus } from "../xu-ly/utils";

export default function UserFilters({ search, role, status, list, selected, page, onSearch, onRole, onStatus }) {
  return <div className="adm-rest-controls">
    <label className="adm-rest-search"><Search size={17} /><span className="adm-visually-hidden">Tìm người dùng</span><input placeholder="Họ tên hoặc email" value={search} onChange={(e) => onSearch(e.target.value)} /></label>
    <label><span className="adm-visually-hidden">Vai trò</span><select value={role} onChange={(e) => onRole(e.target.value)}><option value="">Mọi vai trò</option><option value="USER">Người dùng</option><option value="ADMIN">Quản trị viên</option></select></label>
    <label><span className="adm-visually-hidden">Trạng thái</span><select value={status} onChange={(e) => onStatus(e.target.value)}><option value="">Mọi trạng thái</option><option value="active">Có thể truy cập</option><option value="banned">Đã khóa</option><option value="deleted">Đã xóa (Thùng rác)</option><option value="purge_pending">Đang xóa vĩnh viễn</option></select></label>
    <button className="cf-icon-btn" title={selected.length ? "Xuất đã chọn" : "Xuất trang này"} aria-label={selected.length ? "Xuất đã chọn" : "Xuất trang này"} disabled={!list.length} onClick={() => exportCsv("nguoi-dung-trang-" + page + ".csv", [["Họ tên", "Email", "Vai trò", "Trạng thái"], ...list.filter((u) => !selected.length || selected.includes(u.id)).map((u) => [u.full_name, u.email, u.role, accountStatus(u).label])])}><Download size={18} /></button>
  </div>;
}
