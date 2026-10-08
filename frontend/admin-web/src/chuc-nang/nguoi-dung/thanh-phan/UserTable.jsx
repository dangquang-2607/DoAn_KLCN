import { Eye } from "lucide-react";
import { Loading, ErrorState, Empty, Pagination } from "../../../dung-chung/UI-chung/design";
import { accountStatus } from "../xu-ly/utils";

export default function UserTable({ query, list, selected, selectable, meId, page, activeId, onPageChange, onSelectAll, onSelectOne, onDetail }) {
  const selectableIds = new Set(selectable.map((user) => user.id));
  return <>
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !list.length ? <Empty title="Không tìm thấy người dùng" description="Thử thay đổi tên, email hoặc bộ lọc." /> : <>
      <label className="adm-live-select-all"><input type="checkbox" aria-label="Chọn tất cả tài khoản có thể thao tác trong trang" checked={selectable.length > 0 && selectable.every((u) => selected.includes(u.id))} onChange={(e) => onSelectAll(e.target.checked)} />Chọn tài khoản có thể thao tác trong trang</label>
      <div aria-label="Danh sách người dùng">{list.map((user) => { const status = accountStatus(user); return <div key={user.id} className={`adm-rest-person${activeId === user.id ? " is-selected" : ""}`}>
        <input type="checkbox" aria-label={`Chọn ${user.email}`} disabled={!selectableIds.has(user.id)} checked={selected.includes(user.id)} onChange={(e) => onSelectOne(user.id, e.target.checked)} />
        <span className="adm-rest-avatar">{(user.full_name || user.email).split(" ").slice(-2).map((part) => part[0]).join("").toUpperCase()}</span>
        <span className="adm-rest-person-main"><button className="adm-live-person-open" onClick={() => onDetail(user.id)} aria-pressed={activeId === user.id}><strong>{user.full_name || "Chưa đặt tên"}{user.id === meId ? " (Bạn)" : ""}</strong><small>{user.email}</small></button></span>
        <span className="adm-rest-person-meta"><span className={`cf-badge ${status.tone}`}>{status.label}</span><small>{user.role?.toUpperCase() === "ADMIN" ? "Quản trị viên" : "Người dùng"}</small></span>
        <span className="adm-live-person-actions"><button className="cf-icon-btn" aria-label={`Xem ${user.email}`} title="Xem chi tiết" onClick={() => onDetail(user.id)}><Eye size={17} /></button></span>
      </div>; })}</div></>}
    <Pagination page={page} pageSize={15} total={query.data?.total || 0} onChange={onPageChange} />
  </>;
}
