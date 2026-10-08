import { ArrowRight, CircleAlert, Mail } from "lucide-react";
import { Empty, ErrorState, Loading, Pagination } from "../../../dung-chung/UI-chung/design";
import { emailStatus } from "../xu-ly/emailStatus";
import { timestamp } from "../../../dung-chung/tien-ich/adminPresentation";

export default function EmailLogTable({ query, list, page, onPageChange, onDetail, selectedId }) {
  return <>
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !list.length ? <Empty title="Chưa có email phù hợp" description="Các lần gửi thư sẽ được ghi nhận tại đây." /> : <div aria-label="Nhật ký gửi thư">{list.map((log) => <button type="button" key={log.id} className={`adm-email-row${selectedId === log.id ? " is-selected" : ""}`} onClick={() => onDetail(log)} aria-pressed={selectedId === log.id}><span className={`adm-email-state adm-email-state--${log.status.toLowerCase()}`}>{log.status === "FAILED" ? <CircleAlert size={19} /> : <Mail size={19} />}</span><span className="adm-email-row-main"><strong>{log.subject}</strong><small>{log.recipient}</small></span><span className="adm-email-row-meta"><span className={`cf-label cf-tone-${emailStatus(log.status).tone}`}>{emailStatus(log.status).label}</span><small>{timestamp(log.created_at)}</small></span><ArrowRight size={16} /></button>)}</div>}
    <Pagination page={page} pageSize={15} total={query.data?.total || 0} onChange={onPageChange} />
  </>;
}
