import { Search, ArrowRight, CircleAlert, Mail, Eye } from "lucide-react";
import { Empty, ErrorState, Loading, Pagination, Alert } from "../../../dung-chung/UI-chung/ui";
import { timestamp, errorMessage } from "../../../dung-chung/tien-ich/format";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../../dung-chung/connect-api/api";
import Inspector from "../../../dung-chung/UI-chung/Inspector";

/**
 * Thanh lọc nhật ký email theo trạng thái, loại email và từ khóa người nhận.
 */
export function EmailLogFilters({ search, type, status, types, onSearchChange, onTypeChange, onStatusChange }) {
  return <div className="adm-rest-controls"><label className="adm-rest-search"><Search size={17} /><span className="adm-visually-hidden">Người nhận</span><input placeholder="Tìm email người nhận" value={search} onChange={(event) => onSearchChange(event.target.value)} /></label><label><span className="adm-visually-hidden">Loại email</span><select value={type} onChange={(event) => onTypeChange(event.target.value)}><option value="">Mọi loại email</option>{Object.entries(types).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span className="adm-visually-hidden">Trạng thái email</span><select value={status} onChange={(event) => onStatusChange(event.target.value)}><option value="">Mọi trạng thái</option><option value="SENDING">Đang xử lý</option><option value="SENT">Đã gửi</option><option value="LOGGED_DEV">Lưu xem trước</option><option value="FAILED">Thất bại</option><option value="UNKNOWN">Cần kiểm tra</option></select></label></div>;
}

/**
 * Bảng dữ liệu nhật ký gửi thư điện tử kèm phân trang và chọn dòng.
 */
export function EmailLogTable({ query, list, page, onPageChange, onDetail, selectedId }) {
  return <>
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !list.length ? <Empty title="Chưa có email phù hợp" description="Các lần gửi thư sẽ được ghi nhận tại đây." /> : <div aria-label="Nhật ký gửi thư">{list.map((log) => <button type="button" key={log.id} className={`adm-email-row${selectedId === log.id ? " is-selected" : ""}`} onClick={() => onDetail(log)} aria-pressed={selectedId === log.id}><span className={`adm-email-state adm-email-state--${log.status.toLowerCase()}`}>{log.status === "FAILED" ? <CircleAlert size={19} /> : <Mail size={19} />}</span><span className="adm-email-row-main"><strong>{log.subject}</strong><small>{log.recipient}</small></span><span className="adm-email-row-meta"><span className={`cf-label cf-tone-${emailStatus(log.status).tone}`}>{emailStatus(log.status).label}</span><small>{timestamp(log.created_at)}</small></span><ArrowRight size={16} /></button>)}</div>}
    <Pagination page={page} pageSize={15} total={query.data?.total || 0} onChange={onPageChange} />
  </>;
}

/**
 * Bảng thanh tra chi tiết thông tin và kết quả gửi của một email hệ thống.
 */
export function EmailInspector({ detail, types, onClose }) {
  const [previewId, setPreviewId] = useState(null);
  const preview = useQuery({
    queryKey: ["email-preview", detail?.id],
    queryFn: async ({ signal }) => (await api.get(`/admin/email/logs/${detail.id}/preview`, { responseType: "text", signal })).data,
    enabled: !!detail?.preview_available && previewId === detail.id,
    retry: false, gcTime: 0, staleTime: 0,
  });
  const status = emailStatus(detail?.status);
  return <Inspector selectedId={detail?.id} title={detail?.subject || "Chi tiết chuyển phát"} eyebrow="LẦN GỬI ĐANG XEM" className="adm-email-inspector" icon={Mail} onClose={onClose}>{detail && <>
    <span className={`cf-label cf-tone-${status.tone}`}>{status.label}</span>
    <dl className="adm-rest-dl"><div><dt>Người nhận</dt><dd>{detail.recipient}</dd></div><div><dt>Loại email</dt><dd>{types[detail.email_type] || detail.email_type}</dd></div><div><dt>Thời gian</dt><dd>{timestamp(detail.created_at)}</dd></div><div><dt>Mã bản ghi</dt><dd>{detail.id}</dd></div></dl>
    {detail.error_message && <Alert persistent>{detail.status === "UNKNOWN" ? "Chưa xác định máy chủ đã nhận thư hay chưa. Hệ thống đã dừng tự gửi lại để tránh trùng thư." : detail.error_message}</Alert>}
    {detail.preview_available && <div className="cf-stack">
      <button type="button" className="cf-btn cf-btn-sm" disabled={preview.isFetching} onClick={() => previewId === detail.id ? preview.refetch() : setPreviewId(detail.id)}>{preview.isFetching ? "Đang tải…" : "Xem trước email thử"}</button>
      {previewId === detail.id && preview.isError && <Alert>{errorMessage(preview.error)}</Alert>}
      {previewId === detail.id && preview.data && <iframe title="Bản xem trước email thử" sandbox="" referrerPolicy="no-referrer" style={{ width: "100%", height: 520, border: 0 }} srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">${preview.data}`} />}
    </div>}
    <div className="adm-rest-guidance"><Eye size={17} /><span>{detail.status === "LOGGED_DEV" ? "Chỉ lưu xem trước, chưa gửi đến hộp thư." : detail.status === "SENT" ? "Máy chủ đã chấp nhận gửi; không đồng nghĩa người nhận đã đọc." : detail.status === "UNKNOWN" ? "Kiểm tra hộp thư trước khi thực hiện lại thao tác có gửi email." : detail.status === "SENDING" ? "Hệ thống đang xử lý yêu cầu, chưa có kết quả gửi cuối cùng." : "Kiểm tra chi tiết lỗi trước khi điều chỉnh SMTP."} Chỉ hỗ trợ xem trước email thử; không hiển thị nội dung thư nghiệp vụ hoặc mật khẩu tạm thời.</span></div>
  </>}</Inspector>;
}

function emailStatus(status) {
  return ({ SENT: { label: "Đã gửi", tone: "teal" }, LOGGED_DEV: { label: "Lưu xem trước", tone: "violet" },
    FAILED: { label: "Thất bại", tone: "coral" }, SENDING: { label: "Đang xử lý", tone: "amber" },
    UNKNOWN: { label: "Cần kiểm tra", tone: "amber" }, QUEUED: { label: "Đang chờ", tone: "amber" },
    PENDING: { label: "Đang chờ", tone: "amber" } })[status] || { label: status || "Chưa ghi nhận", tone: "slate" };
}
