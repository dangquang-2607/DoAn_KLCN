import { Empty, ErrorState, Loading, Pagination } from "../../../dung-chung/UI-chung/design";
import { ArrowRight } from "lucide-react";
import { actionLabel, auditResult } from "../../../dung-chung/nghiep-vu/auditPresentation";
import { timestamp } from "../../../dung-chung/tien-ich/adminPresentation";

export default function AuditLogTable({ query, page, onPageChange, onSelect, selectedId }) {
  const list = query.data?.items || [];
  const label = (log) => <><span className={`adm-audit-action${log.target_type === "CATEGORIES" ? " adm-audit-action--categories" : ""}`}>{actionLabel(log.action)}</span><code>{log.action}</code></>;
  return <section className="adm-card">
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !list.length ? <Empty title="Không có nhật ký phù hợp" description="Thử bỏ bớt bộ lọc hoặc tìm từ khóa khác." /> : <>
      <div className="adm-audit-table-wrap"><table className="adm-audit-table"><thead><tr><th>Thời gian</th><th>Hoạt động</th><th>Người thực hiện</th><th>Đối tượng</th><th aria-label="Chi tiết" /></tr></thead><tbody>{list.map((log) => <tr key={log.id} className={selectedId === log.id ? "is-selected" : ""}><td><time>{timestamp(log.created_at)}</time></td><td>{label(log)}</td><td title={log.admin_id || undefined}>{log.actor_name || "Hệ thống / đã ẩn danh"}<code>{log.actor_email}</code></td><td className="adm-audit-target">{log.target_type || "—"}<div><span className={`cf-label cf-tone-${auditResult(log.status_code).tone}`}>{auditResult(log.status_code).label}</span></div></td><td><button aria-label={`Chi tiết hoạt động ${log.id}`} aria-pressed={selectedId === log.id} onClick={() => onSelect(log)}><ArrowRight size={16} /></button></td></tr>)}</tbody></table></div>
      <div className="adm-audit-mobile-list">{list.map((log) => <button key={log.id} type="button" className={selectedId === log.id ? "is-selected" : ""} aria-pressed={selectedId === log.id} aria-label={`Chi tiết hoạt động ${log.id}`} onClick={() => onSelect(log)}><span className="adm-audit-action">{actionLabel(log.action)}</span><small>{timestamp(log.created_at)} · {log.actor_name || "Hệ thống / đã ẩn danh"}</small><small>{log.target_type || "—"} · {auditResult(log.status_code).label}</small><ArrowRight size={16} /></button>)}</div>
    </>}
    <Pagination page={page} pageSize={20} total={query.data?.total || 0} onChange={onPageChange} />
  </section>;
}
