import { Eye, Shield, KeyRound, Lock, Unlock, ShieldCheck, UserRound } from "lucide-react";
import { Loading, ErrorState, Empty, Pagination } from "../../../dung-chung/UI-chung/ui";
import { accountStatus, userInitials, rowActionKeys } from "../xu-ly/utils";
import density from "../../../dung-chung/CSS/management.module.css";
import ActionMenu from "../../../dung-chung/UI-chung/ActionMenu";
import Inspector from "../../../dung-chung/UI-chung/Inspector";
import { number, timestamp } from "../../../dung-chung/tien-ich/format";

/**
 * Bảng quản trị danh sách người dùng có hỗ trợ chọn dòng và phân trang.
 */
export function UserTable({ query, list, selected, selectable, meId, page, activeId, onPageChange, onSelectAll, onSelectOne, onDetail }) {
  const selectableIds = new Set(selectable.map((user) => user.id));
  return <>
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !list.length ? <Empty title="Không tìm thấy người dùng" description="Thử thay đổi tên, email hoặc bộ lọc." /> : <>
      <label className="adm-live-select-all"><input type="checkbox" aria-label="Chọn tất cả tài khoản có thể thao tác trong trang" checked={selectable.length > 0 && selectable.every((u) => selected.includes(u.id))} onChange={(e) => onSelectAll(e.target.checked)} />Chọn tài khoản có thể thao tác trong trang</label>
      <div aria-label="Danh sách người dùng">{list.map((user) => { const status = accountStatus(user); return <div key={user.id} className={`adm-rest-person${activeId === user.id ? " is-selected" : ""}`}>
        <input type="checkbox" aria-label={`Chọn ${user.email}`} disabled={!selectableIds.has(user.id)} checked={selected.includes(user.id)} onChange={(e) => onSelectOne(user.id, e.target.checked)} />
        <span className="adm-rest-avatar">{userInitials(user)}</span>
        <span className="adm-rest-person-main"><button className="adm-live-person-open" onClick={() => onDetail(user.id)} aria-pressed={activeId === user.id}><strong>{user.full_name || "Chưa đặt tên"}{user.id === meId ? " (Bạn)" : ""}</strong><small>{user.email}</small></button></span>
        <span className="adm-rest-person-meta"><span className={`cf-badge ${status.tone}`}>{status.label}</span><small>{user.role?.toUpperCase() === "ADMIN" ? "Quản trị viên" : `Người dùng · ${user.plan === "PREMIUM" ? "Premium" : "Free"}`}</small></span>
        <span className="adm-live-person-actions"><button className="cf-icon-btn" aria-label={`Xem ${user.email}`} title="Xem chi tiết" onClick={() => onDetail(user.id)}><Eye size={17} /></button></span>
      </div>; })}</div></>}
    <Pagination page={page} pageSize={15} total={query.data?.total || 0} onChange={onPageChange} />
  </>;
}

const descriptions = {
  role: { label: "Thay đổi vai trò", Icon: Shield },
  "reset-password": { label: "Cấp lại mật khẩu", Icon: KeyRound },
  ban: { label: "Khóa tài khoản", Icon: Lock },
  unban: { label: "Mở khóa tài khoản", Icon: Unlock },
};

/**
 * Menu ngữ cảnh các thao tác quản trị trên từng tài khoản người dùng.
 */
function UserRowActions({ user, meId, canManageRoles, onDetail, onAction, hideDetail = false }) {
  const actions = rowActionKeys(user, meId, canManageRoles).map((key) => ({
    key, ...descriptions[key],
    onClick: () => onAction(key, user),
  }));
  return <div className="cf-user-actions">{!hideDetail && <button className="cf-icon-btn" aria-label={`Xem ${user.email}`} title="Xem chi tiết" onClick={() => onDetail(user.id)}><Eye size={17} /></button>}<ActionMenu className={density.menu} label={`Thao tác với ${user.email}`} actions={actions} /></div>;
}

/**
 * Ngăn kéo hiển thị thông tin chi tiết và lịch sử hoạt động của người dùng.
 */
export function UserInspector({ userId, query, onClose, meId, canManageRoles, onAction }) {
  const user = query.data;
  return <Inspector selectedId={userId} ready={!query.isPending} title={user?.full_name || "Hồ sơ tài khoản"} eyebrow="HỒ SƠ ĐANG XEM" className="adm-rest-detail" icon={UserRound} header={user && <span className="adm-rest-avatar adm-rest-avatar--large">{userInitials(user)}</span>} onClose={onClose}>
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : user && <>
      <p className="adm-rest-detail-sub">{user.email}{user.support_only ? " · Admin hỗ trợ" : ""}</p><span className={`cf-badge ${accountStatus(user).tone}`}>{accountStatus(user).label}</span>
      <dl className="adm-rest-dl"><div><dt>Mã tài khoản</dt><dd>{user.id}</dd></div><div><dt>Vai trò</dt><dd>{user.role === "ADMIN" ? "Quản trị viên" : "Người dùng"}</dd></div><div><dt>Ngày tham gia</dt><dd>{timestamp(user.created_at)}</dd></div><div><dt>Hoạt động gần nhất</dt><dd>{timestamp(user.last_active_at)}</dd></div><div><dt>Tài khoản hệ thống</dt><dd>{user.is_system_account ? "Được bảo vệ" : "Không"}</dd></div></dl>
      {user.role !== "ADMIN" && <dl className="adm-rest-dl"><div><dt>Gói sử dụng</dt><dd>{user.plan === "PREMIUM" ? "Premium" : "Free"}</dd></div><div><dt>Premium đến</dt><dd>{user.premium_until ? timestamp(user.premium_until) : "Chưa nâng cấp"}</dd></div></dl>}
      <div className="adm-rest-mini-grid"><div><span>Giao dịch</span><strong>{user.stats?.transactions_count == null ? "—" : number.format(user.stats.transactions_count)}</strong></div><div><span>Hóa đơn</span><strong>{user.stats?.invoices_count == null ? "—" : number.format(user.stats.invoices_count)}</strong></div></div>
      <div className="adm-rest-guidance"><ShieldCheck size={17} /><span>Chỉ xem số lượng tổng hợp, không hiển thị nội dung tài chính cá nhân. Tài khoản hệ thống và chính bạn được bảo vệ khỏi thao tác nguy hiểm.</span></div>
      <div className="cf-row" style={{ marginTop: 16 }}><span className="cf-data-note">Thao tác tài khoản</span><UserRowActions user={user} meId={meId} canManageRoles={canManageRoles} onDetail={() => {}} onAction={onAction} hideDetail /></div>
    </>}
  </Inspector>;
}
