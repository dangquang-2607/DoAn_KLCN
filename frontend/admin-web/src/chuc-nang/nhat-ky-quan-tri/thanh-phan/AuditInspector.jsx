import { Globe2, Network, ShieldCheck, UserRound } from "lucide-react";
import Inspector from "../../../dung-chung/UI-chung/Inspector";
import { ErrorState, Loading } from "../../../dung-chung/UI-chung/design";
import { actionLabel, auditResult } from "../../../dung-chung/nghiep-vu/auditPresentation";
import { timestamp } from "../../../dung-chung/tien-ich/adminPresentation";

function Context({ title, icon: Icon, rows }) {
  return <section className="adm-audit-context"><h3><Icon size={15} />{title}</h3><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "Chưa ghi nhận"}</dd></div>)}</dl></section>;
}

export default function AuditInspector({ selectedId, query, onClose }) {
  const log = query.data;
  return <Inspector selectedId={selectedId} ready={!query.isPending} title={log ? actionLabel(log.action) : "Bản ghi chi tiết"} eyebrow="BẢN GHI CHI TIẾT" className="adm-audit-detail" icon={ShieldCheck} onClose={onClose}>
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : log && <>
      <p className="adm-rest-detail-sub">Hoạt động trên {log.target_type || "đối tượng chưa được ghi nhận"} · Bản ghi #{log.id}</p><span className={`cf-label cf-tone-${auditResult(log.status_code).tone}`}>{auditResult(log.status_code).label}</span>
      <Context title="Yêu cầu" icon={Network} rows={[["Endpoint", log.route ? <span key="endpoint"><span className="adm-http-method">{log.http_method || "—"}</span><code key="value">{log.route}</code></span> : null], ["Mã yêu cầu", log.request_id ? <code key="value">{log.request_id}</code> : null], ["Thời gian (Việt Nam)", timestamp(log.created_at)]]} />
      <Context title="Tác nhân & đối tượng" icon={UserRound} rows={[["Người thực hiện", log.actor_name || "Hệ thống / đã ẩn danh"], ["Email", log.actor_email || null], ["Mã người thực hiện", log.admin_id ? <code key="value">{log.admin_id}</code> : null], ["Loại đối tượng", log.target_type], ["Mã đối tượng", log.target_id ? <code key="value">{log.target_id}</code> : null]]} />
      <Context title="Nguồn truy cập" icon={Globe2} rows={[["Địa chỉ IP", log.ip_address || null], ["Thiết bị / trình duyệt", log.user_agent || null], ["Mã hành động", <code key="value">{log.action}</code>]]} />
      <div className="adm-audit-change"><span>PHẠM VI THAY ĐỔI</span><p>{log.before || log.after ? "Có dữ liệu trước / sau thay đổi. Mở các mục bên dưới để đối soát." : "Bản ghi này không lưu dữ liệu trước / sau thay đổi; không suy diễn nội dung đã thay đổi."}</p></div>
      {[["Trước thay đổi", log.before], ["Sau thay đổi", log.after], ["Thông tin bổ sung", log.metadata]].map(([label, value]) => <details className="cf-json-detail" key={label}><summary>{label}</summary>{value ? <pre>{JSON.stringify(value, null, 2)}</pre> : <p>Không có dữ liệu được ghi nhận.</p>}</details>)}
      <p className="cf-data-note" style={{ marginTop: 14 }}>Mã HTTP trống không đồng nghĩa với thành công. Dữ liệu xác thực và nội dung văn bản trong payload được che ở backend.</p>
    </>}
  </Inspector>;
}
