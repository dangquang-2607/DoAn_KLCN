import { ArrowRight, CheckCheck, CircleDot } from "lucide-react";
import { Link } from "react-router-dom";
import { Empty, ErrorState, Loading } from "../../../dung-chung/UI-chung/design";
import { actionLabel, auditResult } from "../../../dung-chung/nghiep-vu/auditPresentation";
import { timestamp } from "../../../dung-chung/tien-ich/adminPresentation";

export default function RecentAdminActivity({ query }) {
  return <section className="adm-card"><div className="adm-card-head"><div><p className="adm-eyebrow">NHẬT KÝ</p><h2>Hoạt động gần đây</h2><p>Diễn giải dễ đọc, mã gốc vẫn có thể tra cứu</p></div><Link className="adm-section-link" to="/audit-logs">Xem nhật ký <ArrowRight size={15} /></Link></div>
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !query.data?.items?.length ? <Empty title="Chưa có hoạt động quản trị" /> : <ol className="adm-activity-list">{query.data.items.map((log) => <li key={log.id}><span className={`adm-activity-icon${log.target_type === "CATEGORIES" ? " adm-activity-icon--categories" : ""}`}>{log.target_type === "AUTH" ? <CircleDot size={16} /> : <CheckCheck size={16} />}</span><div><strong>{actionLabel(log.action)}</strong><span>{log.actor_name || "Hệ thống / đã ẩn danh"} · {log.target_type || "—"} · <code>{log.action}</code></span></div><span className={`cf-label cf-tone-${auditResult(log.status_code).tone}`}>{auditResult(log.status_code).label}</span><time>{timestamp(log.created_at)}</time></li>)}</ol>}
  </section>;
}
