import api from "../../../dung-chung/connect-api/api";
import { errorMessage } from "../../../dung-chung/tien-ich/format";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Laptop } from "lucide-react";
import { Alert, Empty, ErrorState, Loading } from "../../../dung-chung/UI-chung/ui";
import { sessionDeviceName, sessionPage, sessionTimestamp } from "../xu-ly/sessionPresentation";

/**
 * Bảng quản lý và giám sát các phiên làm việc của quản trị viên.
 */
export default function LoginSessions({ query }) {
  const pending = useRef(false);
  const [requestedPage, setPage] = useState(1);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const revoke = async id => {
    if (pending.current) return;
    if (id === "others" ? !query.data?.some(s => s.is_current) : !query.data?.some(s => s.id === id && !s.is_current)) return;
    pending.current = true;
    setBusy(true); setError(""); setNotice("");
    try { await api.delete(`/auth/sessions/${id}`); await query.refetch(); setNotice("Đã thu hồi phiên đăng nhập."); }
    catch (e) { setError(errorMessage(e)); } finally { pending.current = false; setBusy(false); }
  };
  const { page, pages, items, start, end, total } = sessionPage(query.data || [], requestedPage);
  return <section className="adm-card adm-settings-sessions" aria-label="Phiên đăng nhập">
    <div className="adm-card-head"><div><p className="adm-eyebrow">PHIÊN ĐĂNG NHẬP</p><h2>Phiên còn hiệu lực</h2><p>{query.isPending ? "Đang kiểm tra các phiên…" : query.isError ? "Chưa tải được thông tin phiên" : `${total} phiên của tài khoản hiện tại`}</p></div><Laptop size={20} aria-hidden="true" /></div>
    {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
    {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
    <button type="button" className="cf-btn cf-btn-sm" disabled={busy || !query.data?.some(s => !s.is_current) || !query.data?.some(s => s.is_current)} onClick={() => revoke("others")}>Thu hồi các phiên khác</button>
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !total ? <Empty title="Chưa có phiên đăng nhập" /> : <>
      <ul className="adm-settings-session-list" key={page}>{items.map((session) => <li className="adm-settings-session" key={session.id}>
        <span className="adm-settings-session-icon"><Laptop size={18} aria-hidden="true" /></span>
        <div><div className="adm-settings-session-head"><strong>{sessionDeviceName(session.device_name)}</strong><span className="adm-settings-session-address">{session.ip_address || "Chưa ghi nhận IP"}</span></div>
          {session.is_current ? <span className="cf-label">Phiên hiện tại</span> : <button type="button" className="cf-btn cf-btn-sm" disabled={busy} onClick={() => revoke(session.id)}>Thu hồi phiên</button>}
          <small>Hoạt động gần nhất {sessionTimestamp(session.last_used_at)}</small>
          <small>Bắt đầu {sessionTimestamp(session.created_at)}</small>
          <details><summary>Thông tin phiên</summary><dl>
            <div><dt>Thiết bị ghi nhận</dt><dd>{session.device_name || "Chưa ghi nhận"}</dd></div>
            <div><dt>Hết hạn</dt><dd>{sessionTimestamp(session.expires_at)}</dd></div>
            <div><dt>Làm mới gần nhất</dt><dd>{sessionTimestamp(session.last_used_at)}</dd></div>
          </dl></details>
        </div>
      </li>)}</ul>
      <footer className="adm-settings-session-footer"><span aria-live="polite">{start}–{end} / {total} phiên</span>{pages > 1 && <nav aria-label="Phân trang phiên đăng nhập"><button type="button" className="cf-icon-btn" aria-label="Các phiên trước" title="Các phiên trước" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button><span>{page} / {pages}</span><button type="button" className="cf-icon-btn" aria-label="Các phiên tiếp theo" title="Các phiên tiếp theo" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button></nav>}</footer>
    </>}
  </section>;
}
