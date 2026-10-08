import { ShieldCheck, UserRound } from "lucide-react";
import Inspector from "../../../dung-chung/UI-chung/Inspector";
import { ErrorState, Loading } from "../../../dung-chung/UI-chung/design";
import { number, timestamp } from "../../../dung-chung/tien-ich/adminPresentation";
import { accountStatus } from "../xu-ly/utils";
import UserRowActions from "./UserRowActions";

export default function UserInspector({ userId, query, onClose, meId, onAction }) {
  const user = query.data;
  return <Inspector selectedId={userId} ready={!query.isPending} title={user?.full_name || "Hồ sơ tài khoản"} eyebrow="HỒ SƠ ĐANG XEM" className="adm-rest-detail" icon={UserRound} header={user && <span className="adm-rest-avatar adm-rest-avatar--large">{(user.full_name || user.email).split(" ").slice(-2).map((part) => part[0]).join("").toUpperCase()}</span>} onClose={onClose}>
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : user && <>
      <p className="adm-rest-detail-sub">{user.email}</p><span className={`cf-badge ${accountStatus(user).tone}`}>{accountStatus(user).label}</span>
      <dl className="adm-rest-dl"><div><dt>Mã tài khoản</dt><dd>{user.id}</dd></div><div><dt>Vai trò</dt><dd>{user.role === "ADMIN" ? "Quản trị viên" : "Người dùng"}</dd></div><div><dt>Ngày tham gia</dt><dd>{timestamp(user.created_at)}</dd></div><div><dt>Hoạt động gần nhất</dt><dd>{timestamp(user.last_active_at)}</dd></div><div><dt>Tài khoản hệ thống</dt><dd>{user.is_system_account ? "Được bảo vệ" : "Không"}</dd></div></dl>
      <div className="adm-rest-mini-grid"><div><span>Giao dịch</span><strong>{user.stats?.transactions_count == null ? "—" : number.format(user.stats.transactions_count)}</strong></div><div><span>Hóa đơn</span><strong>{user.stats?.invoices_count == null ? "—" : number.format(user.stats.invoices_count)}</strong></div></div>
      <div className="adm-rest-guidance"><ShieldCheck size={17} /><span>Chỉ xem số lượng tổng hợp, không hiển thị nội dung tài chính cá nhân. Tài khoản hệ thống và chính bạn được bảo vệ khỏi thao tác nguy hiểm.</span></div>
      <div className="cf-row" style={{ marginTop: 16 }}><span className="cf-data-note">Thao tác tài khoản</span><UserRowActions user={user} meId={meId} onDetail={() => {}} onAction={onAction} hideDetail /></div>
    </>}
  </Inspector>;
}
