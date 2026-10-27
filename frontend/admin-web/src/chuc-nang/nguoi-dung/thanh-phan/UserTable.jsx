/**
 * ============================================================================
 * TÊN FILE: UserTable.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Quản lý Người dùng
 * MỤC ĐÍCH CỤ THỂ:
 *   Bảng kết xuất danh sách người dùng hệ thống: họ tên, email, vai trò,
 *   trạng thái tài khoản, ngày tham gia, và menu thao tác tương ứng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props users, selectedUserId, onSelectUser, UserRowActions component.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export UserTable component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Ngăn chặn quản trị viên tự khóa tài khoản của chính mình.
 * ============================================================================
 */
import { Eye } from "lucide-react";
import { Loading, ErrorState, Empty, Pagination } from "../../../dung-chung/UI-chung/design";
import { accountStatus, userInitials } from "../xu-ly/utils";

/**
 * Bảng quản trị danh sách người dùng có hỗ trợ chọn dòng và phân trang.
 */
export default function UserTable({ query, list, selected, selectable, meId, page, activeId, onPageChange, onSelectAll, onSelectOne, onDetail }) {
  const selectableIds = new Set(selectable.map((user) => user.id));
  return <>
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !list.length ? <Empty title="Không tìm thấy người dùng" description="Thử thay đổi tên, email hoặc bộ lọc." /> : <>
      <label className="adm-live-select-all"><input type="checkbox" aria-label="Chọn tất cả tài khoản có thể thao tác trong trang" checked={selectable.length > 0 && selectable.every((u) => selected.includes(u.id))} onChange={(e) => onSelectAll(e.target.checked)} />Chọn tài khoản có thể thao tác trong trang</label>
      <div aria-label="Danh sách người dùng">{list.map((user) => { const status = accountStatus(user); return <div key={user.id} className={`adm-rest-person${activeId === user.id ? " is-selected" : ""}`}>
        <input type="checkbox" aria-label={`Chọn ${user.email}`} disabled={!selectableIds.has(user.id)} checked={selected.includes(user.id)} onChange={(e) => onSelectOne(user.id, e.target.checked)} />
        <span className="adm-rest-avatar">{userInitials(user)}</span>
        <span className="adm-rest-person-main"><button className="adm-live-person-open" onClick={() => onDetail(user.id)} aria-pressed={activeId === user.id}><strong>{user.full_name || "Chưa đặt tên"}{user.id === meId ? " (Bạn)" : ""}</strong><small>{user.email}</small></button></span>
        <span className="adm-rest-person-meta"><span className={`cf-badge ${status.tone}`}>{status.label}</span><small>{user.role?.toUpperCase() === "ADMIN" ? "Quản trị viên" : "Người dùng"}</small></span>
        <span className="adm-live-person-actions"><button className="cf-icon-btn" aria-label={`Xem ${user.email}`} title="Xem chi tiết" onClick={() => onDetail(user.id)}><Eye size={17} /></button></span>
      </div>; })}</div></>}
    <Pagination page={page} pageSize={15} total={query.data?.total || 0} onChange={onPageChange} />
  </>;
}
