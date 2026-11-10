import { CheckCircle2, RotateCw } from "lucide-react";
import { timestamp } from "../../../dung-chung/tien-ich/format";

const invoiceStatuses = {
  UPLOADED: "Chưa quét", PROCESSING: "Đang xử lý", REVIEW_REQUIRED: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận", FAILED: "Thất bại",
};
const errorLabels = {
  UnsupportedInvoiceCurrency: "Hóa đơn dùng ngoại tệ. Hiện chỉ hỗ trợ VND; không tự quy đổi tiền.",
  UnknownInvoiceCurrency: "Chưa xác định được tiền tệ. Cần chứng từ thể hiện rõ đơn vị VND.",
  TimeoutError: "Quá thời gian chờ xử lý OCR.",
  FileNotFoundError: "Không tìm thấy tệp hóa đơn khi xử lý.",
  PermissionError: "Không đủ quyền truy cập tài nguyên khi xử lý.",
};

function OcrRetryButton({ failure, retrying, onRetry }) {
  return (
    <button className="cf-btn cf-btn-sm" disabled={!failure.can_retry || Boolean(retrying)}
      aria-label={`Thử lại lượt OCR ${failure.job_id.slice(0, 8)}`}
      aria-describedby={`ocr-retry-reason-${failure.job_id}`} onClick={() => onRetry(failure.job_id)}>
      <RotateCw size={15} />
      {retrying === failure.job_id ? "Đang gửi…" : "Thử lại"}
    </button>
  );
}

export default function OcrFailureTable({ failures, retrying, onRetry }) {
  return (
    <section className="adm-card adm-ocr-failures">
      <div className="adm-card-head"><div><p className="adm-eyebrow">LỊCH SỬ LỖI</p><h2>Các lần xử lý lỗi gần đây</h2><p>10 lượt thất bại gần nhất · trạng thái hóa đơn được cập nhật theo hiện tại</p></div>{!failures.length && <span className="adm-quiet-badge">Không có lỗi</span>}</div>
      {!failures.length ? <div className="adm-ocr-empty"><CheckCircle2 size={24} /><strong>Chưa ghi nhận lượt OCR lỗi</strong><span>Lịch sử lỗi và tình trạng xử lý hiện tại sẽ xuất hiện tại đây.</span></div> : (
        <div className="cf-table-wrap"><table className="cf-table"><thead><tr><th>Hóa đơn / lượt lỗi</th><th>Thông tin lỗi</th><th>Xử lý hiện tại</th></tr></thead><tbody>{failures.map((failure) => (
          <tr key={failure.job_id}>
            <td>
              <strong title={failure.invoice_id || undefined}>{failure.invoice_id ? `Hóa đơn ${failure.invoice_id.slice(0, 8)}` : "Không có mã hóa đơn"}</strong>
              <small title={failure.job_id}>Lượt lỗi: {failure.job_id.slice(0, 8)}</small>
              <small>{timestamp(failure.created_at)}</small>
              {failure.invoice_status && <small>Hóa đơn: {invoiceStatuses[failure.invoice_status] || failure.invoice_status}</small>}
            </td>
            <td>
              <span>{failure.error?.trim() || errorLabels[failure.error_code] || (failure.error_code ? "Lượt OCR thất bại; hệ thống chỉ ghi nhận mã lỗi." : "Không ghi nhận nguyên nhân lỗi cho lượt này.")}</span>
              {failure.error_code && <code>{failure.error_code}</code>}
            </td>
            <td>
              <span className={`cf-label cf-tone-${failure.can_retry ? "coral" : failure.resolution === "RESOLVED" ? "teal" : "slate"}`}>{failure.resolution_label || "Chưa xác định"}</span>
              <p id={`ocr-retry-reason-${failure.job_id}`}>{failure.retry_reason || "Cần tải lại trạng thái hóa đơn trước khi thử lại."}</p>
              {failure.latest_job_id && failure.latest_job_id !== failure.job_id && <small title={failure.latest_job_id}>Lượt mới nhất: {failure.latest_job_id.slice(0, 8)}</small>}
              <OcrRetryButton failure={failure} retrying={retrying} onRetry={onRetry} />
            </td>
          </tr>
        ))}</tbody></table></div>
      )}
    </section>
  );
}
