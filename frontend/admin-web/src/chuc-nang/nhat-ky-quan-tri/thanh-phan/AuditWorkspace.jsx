import { Download, ArrowRight, Globe2, Network, ShieldCheck, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { errorMessage, exportExcel, actionLabel, auditResult, auditSections, timestamp } from "../../../dung-chung/tien-ich/format";
import { Empty, ErrorState, Loading, Pagination } from "../../../dung-chung/UI-chung/ui";
import Inspector from "../../../dung-chung/UI-chung/Inspector";

export function AuditLogActions({ page, list, fetching }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const exportCurrentPage = async () => {
    if (pending.current || fetching || !list.length) return;
    pending.current = true;
    setExporting(true); setError("");
    try {
      await exportExcel(`nhat-ky-trang-${page}.xlsx`, {
        title: "CapitalFlow — Nhật ký quản trị",
        scope: `Trang ${page}: ${list.length} bản ghi theo bộ lọc hiện tại. Thời gian UTC.`,
        columns: [
          { title: "Thời gian UTC", width: 25, type: "datetime" },
          { title: "Người thực hiện", width: 30 }, { title: "Mã người thực hiện", width: 40 },
          { title: "Hành động", width: 32 }, { title: "Đối tượng", width: 24 },
          { title: "Mã đối tượng", width: 40 }, { title: "Mã HTTP", width: 14, type: "number" },
        ],
        rows: list.map((log) => [log.created_at, log.actor_name, log.admin_id, log.action, log.target_type, log.target_id, log.status_code]),
      });
    } catch (caught) { setError(errorMessage(caught)); }
    finally { pending.current = false; setExporting(false); }
  };
  return <><button className="cf-btn" disabled={!list.length || exporting || fetching} onClick={exportCurrentPage}><Download />{exporting ? "Đang xuất…" : "Xuất Excel trang này"}</button>{error && <span role="alert" className="cf-danger">{error}</span>}</>;
}

/**
 * Bảng kết xuất dòng thời gian các sự kiện kiểm toán toàn hệ thống.
 */
export function AuditLogTable({ query, page, onPageChange, onSelect, selectedId }) {
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

function Context({ title, icon: Icon, rows }) {
  return <section className="adm-audit-context"><h3><Icon size={15} />{title}</h3><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "Chưa ghi nhận"}</dd></div>)}</dl></section>;
}

/**
 * Bảng thanh tra chi tiết sự kiện nhật ký kiểm toán quản trị viên.
 */
export function AuditInspector({ selectedId, query, onClose }) {
  const log = query.data;
  const sections = auditSections(log);
  return <Inspector selectedId={selectedId} ready={!query.isPending} title={log ? actionLabel(log.action) : "Bản ghi chi tiết"} eyebrow="BẢN GHI CHI TIẾT" className="adm-audit-detail" icon={ShieldCheck} onClose={onClose}>
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : log && <>
      <p className="adm-rest-detail-sub">Hoạt động trên {log.target_type || "đối tượng chưa được ghi nhận"} · Bản ghi #{log.id}</p><span className={`cf-label cf-tone-${auditResult(log.status_code).tone}`}>{auditResult(log.status_code).label}</span>
      <Context title="Yêu cầu" icon={Network} rows={[["Endpoint", log.route ? <span key="endpoint"><span className="adm-http-method">{log.http_method || "—"}</span><code key="value">{log.route}</code></span> : null], ["Mã yêu cầu", log.request_id ? <code key="value">{log.request_id}</code> : null], ["Thời gian (Việt Nam)", timestamp(log.created_at)]]} />
      <Context title="Tác nhân & đối tượng" icon={UserRound} rows={[["Người thực hiện", log.actor_name || "Hệ thống / đã ẩn danh"], ["Email", log.actor_email || null], ["Mã người thực hiện", log.admin_id ? <code key="value">{log.admin_id}</code> : null], ["Loại đối tượng", log.target_type], ["Mã đối tượng", log.target_id ? <code key="value">{log.target_id}</code> : null]]} />
      <Context title="Nguồn truy cập" icon={Globe2} rows={[["Địa chỉ IP", log.ip_address || null], ["Thiết bị / trình duyệt", log.user_agent || null], ["Mã hành động", <code key="value">{log.action}</code>]]} />
      <div className="adm-audit-change"><span>NỘI DUNG GHI NHẬN</span><p>{sections.some(section => section.label !== "Thông tin bổ sung") ? "Các mục dưới đây thể hiện dữ liệu được ghi nhận cho thao tác này." : "Nhật ký này chỉ ghi nhận thao tác và kết quả; không lưu chi tiết trước/sau thay đổi."}</p></div>
      {sections.map(({ label, rows }) => <details className="cf-json-detail" key={label} open={label !== "Thông tin bổ sung"}><summary>{label}</summary><dl className="adm-rest-dl">{rows.map(([field, value]) => <div key={field}><dt>{field}</dt><dd>{value}</dd></div>)}</dl></details>)}
      <p className="cf-data-note" style={{ marginTop: 14 }}>Mã HTTP trống không đồng nghĩa với thành công. Dữ liệu xác thực và nội dung văn bản trong payload được che ở backend.</p>
    </>}
  </Inspector>;
}
