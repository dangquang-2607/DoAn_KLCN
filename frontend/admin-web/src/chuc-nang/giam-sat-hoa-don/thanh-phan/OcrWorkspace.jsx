import { BadgeCheck, CircleAlert, Clock3, ScanLine, UserRoundCheck } from "lucide-react";
import OcrStatusDonut from "./OcrStatusDonut";
import { decimal, number } from "../../../dung-chung/tien-ich/format";
import OcrFailureTable from "./OcrFailureTable";

const stages = [
  { key: "processing", field: "processing", label: "Đang xử lý", hint: "Đã có hóa đơn, đang chờ hoặc chạy OCR", color: "blue", Icon: ScanLine },
  { key: "reviewRequired", field: "review_required", label: "Chờ xác nhận", hint: "Người dùng kiểm tra kết quả", color: "amber", Icon: UserRoundCheck },
  { key: "confirmed", field: "completed", label: "Đã xác nhận", hint: "Đã ghi nhận giao dịch", color: "teal", Icon: BadgeCheck },
  { key: "failed", field: "failed", label: "Thất bại", hint: "Cần kiểm tra và xử lý lại", color: "coral", Icon: CircleAlert },
];

/**
 * Không gian làm việc giám sát quy trình nhận diện hóa đơn AI toàn hệ thống.
 */
export default function OcrWorkspace({ data, retrying, onRetry }) {
  const invoices = data?.invoices || {};
  const jobs = data?.ocr_jobs || {};
  const failures = data?.recent_failures || [];
  const segments = stages.map(({ key, field, label, color }) => ({
    key, label, color, value: invoices[field] ?? 0,
  }));
  const trackedInvoices = segments.reduce((total, segment) => total + segment.value, 0);
  const activeJobs = jobs.processing == null ? "—" : number.format(jobs.processing);
  const queuedJobs = jobs.queued == null ? "—" : number.format(jobs.queued);
  return <>
    <div className={`adm-ocr-signal${invoices.failed ? " is-alert" : ""}`}>
      <span className="adm-ocr-signal-icon"><ScanLine size={24} aria-hidden="true" /></span>
      <div>
        <p>TÌNH HÌNH HIỆN TẠI</p>
        <h2>{activeJobs} lượt OCR đang chạy</h2>
        <span>{queuedJobs} lượt chờ quét lại · Tính cả ảnh đang được đọc trước khi tạo hóa đơn.</span>
      </div>
      <span className="adm-ocr-signal-badge">{number.format(jobs.failed || 0)} lượt OCR lỗi / {number.format(jobs.total || 0)} lượt</span>
    </div>
    <section className="adm-card adm-ocr-flow-card"><div className="adm-card-head"><div><p className="adm-eyebrow">LUỒNG XỬ LÝ</p><h2>Hóa đơn đang ở đâu?</h2><p>Thống kê các hóa đơn đã tạo và còn hiển thị.</p></div><ScanLine size={21} /></div>
      <div className="adm-ocr-flow-layout"><div className="adm-ocr-chart adm-ocr-chart--orbit"><OcrStatusDonut segments={segments} centerLabel="hóa đơn" /></div>
        <div className="adm-ocr-stage-panel"><header className="adm-ocr-stage-panel-head"><div><span>CHI TIẾT TRẠNG THÁI</span><strong>{stages.length} trạng thái theo dõi</strong></div><small>{number.format(trackedInvoices)} hóa đơn</small></header><ol className="adm-ocr-stage-list">{stages.map(({ key, field, label, hint, color, Icon }, index) => <li key={key} className={`adm-ocr-stage-row adm-ocr-stage-row--${color}${!invoices[field] ? " is-zero" : ""}`}><span className="adm-ocr-stage-number">{String(index + 1).padStart(2, "0")}</span><span className="adm-ocr-stage-icon"><Icon size={19} aria-hidden="true" /></span><div><strong>{label}</strong><small>{hint}</small></div><b>{number.format(invoices[field] ?? 0)}</b></li>)}</ol>
          {invoices.uploaded > 0 && <small className="cf-muted">{number.format(invoices.uploaded)} hóa đơn từ luồng cũ nằm ngoài biểu đồ.</small>}
        </div>
      </div>
    </section>
    <div className="adm-ocr-secondary-grid"><section className="adm-card adm-ocr-performance"><div className="adm-card-head"><div><p className="adm-eyebrow">HIỆU SUẤT</p><h2>Chất lượng xử lý</h2><p>Tính mỗi ảnh thực sự chạy OCR khi tải lên hoặc quét lại</p></div><Clock3 size={21} /></div><div className="adm-ocr-performance-stats"><div><span>Lượt OCR</span><strong>{number.format(jobs.total)}</strong><small>Toàn bộ lượt đã ghi nhận</small></div><div><span>Tỷ lệ lỗi</span><strong>{jobs.total ? `${decimal.format(jobs.error_rate_pct)}%` : "—"}</strong><small>{number.format(jobs.failed)} / {number.format(jobs.total)} lượt</small></div><div><span>Thời gian TB</span><strong>{jobs.average_processing_ms == null ? "—" : decimal.format(jobs.average_processing_ms / 1000)}<em>{jobs.average_processing_ms != null ? "giây" : ""}</em></strong><small>{jobs.measured == null ? "Trên lượt có thời gian đo" : `${number.format(jobs.measured)} lượt có đo thời gian`}</small></div></div></section><OcrFailureTable failures={failures} retrying={retrying} onRetry={onRetry} /></div>
  </>;
}
