import { BadgeCheck, CircleAlert, Clock3, FileClock, ScanLine, UserRoundCheck } from "lucide-react";
import OcrStatusDonut from "./OcrStatusDonut";
import { decimal, number } from "../../../dung-chung/tien-ich/adminPresentation";
import OcrFailureTable from "./OcrFailureTable";

const stages = [
  { key: "uploaded", field: "uploaded", label: "Chưa quét", hint: "Đang chờ vào hàng đợi OCR", color: "slate", Icon: FileClock },
  { key: "processing", field: "processing", label: "Đang xử lý", hint: "OCR đang đọc hóa đơn", color: "blue", Icon: ScanLine },
  { key: "reviewRequired", field: "review_required", label: "Chờ xác nhận", hint: "Người dùng kiểm tra kết quả", color: "amber", Icon: UserRoundCheck },
  { key: "confirmed", field: "completed", label: "Đã xác nhận", hint: "Đã ghi nhận giao dịch", color: "teal", Icon: BadgeCheck },
  { key: "failed", field: "failed", label: "Thất bại", hint: "Cần kiểm tra và xử lý lại", color: "coral", Icon: CircleAlert },
];

export default function OcrWorkspace({ data, retrying, onRetry }) {
  const { invoices, ocr_jobs: jobs, recent_failures: failures } = data;
  return <>
    <div className={`adm-ocr-signal${invoices.failed ? " is-alert" : ""}`}><span className="adm-ocr-signal-icon">{invoices.failed ? <CircleAlert size={24} /> : <BadgeCheck size={24} />}</span><div><p>TÌNH HÌNH HIỆN TẠI</p><h2>{invoices.failed ? `${number.format(invoices.failed)} hóa đơn cần kiểm tra` : "Không ghi nhận hóa đơn thất bại"}</h2><span>{number.format(invoices.uploaded)} hóa đơn chưa quét · {number.format(invoices.review_required)} hóa đơn chờ người dùng xác nhận.</span></div><span className="adm-ocr-signal-badge">{number.format(jobs.failed)} lượt OCR lỗi / {number.format(jobs.total)} lượt</span></div>
    <section className="adm-card adm-ocr-flow-card"><div className="adm-card-head"><div><p className="adm-eyebrow">LUỒNG XỬ LÝ</p><h2>Hóa đơn đang ở đâu?</h2><p>Tỷ trọng trực quan bên trái, chi tiết từng giai đoạn bên phải.</p></div><ScanLine size={21} /></div>
      <div className="adm-ocr-flow-layout"><div className="adm-ocr-chart adm-ocr-chart--orbit"><OcrStatusDonut segments={stages.map(({ key, field, label, color }) => ({ key, label, color, value: invoices[field] }))} centerLabel="hóa đơn" /></div>
        <div className="adm-ocr-stage-panel"><header className="adm-ocr-stage-panel-head"><div><span>CHI TIẾT TRẠNG THÁI</span><strong>5 giai đoạn xử lý</strong></div><small>{number.format(invoices.total)} hóa đơn</small></header><ol className="adm-ocr-stage-list">{stages.map(({ key, field, label, hint, color, Icon }, index) => <li key={key} className={`adm-ocr-stage-row adm-ocr-stage-row--${color}${invoices[field] === 0 ? " is-zero" : ""}`}><span className="adm-ocr-stage-number">{String(index + 1).padStart(2, "0")}</span><span className="adm-ocr-stage-icon"><Icon size={19} /></span><div><strong>{label}</strong><small>{hint}</small></div><b>{number.format(invoices[field])}</b></li>)}</ol></div>
      </div>
    </section>
    <div className="adm-ocr-secondary-grid"><section className="adm-card adm-ocr-performance"><div className="adm-card-head"><div><p className="adm-eyebrow">HIỆU SUẤT</p><h2>Chất lượng xử lý</h2><p>Đo trên lượt OCR, khác với số lượng hóa đơn</p></div><Clock3 size={21} /></div><div className="adm-ocr-performance-stats"><div><span>Lượt OCR</span><strong>{number.format(jobs.total)}</strong><small>Toàn bộ lượt đã ghi nhận</small></div><div><span>Tỷ lệ lỗi</span><strong>{jobs.total ? `${decimal.format(jobs.error_rate_pct)}%` : "—"}</strong><small>{number.format(jobs.failed)} / {number.format(jobs.total)} lượt</small></div><div><span>Thời gian TB</span><strong>{jobs.average_processing_ms == null ? "—" : decimal.format(jobs.average_processing_ms / 1000)}<em>{jobs.average_processing_ms != null ? "giây" : ""}</em></strong><small>{jobs.measured == null ? "Trên lượt có thời gian đo" : `${number.format(jobs.measured)} lượt có đo thời gian`}</small></div></div></section><OcrFailureTable failures={failures} retrying={retrying} onRetry={onRetry} /></div>
  </>;
}
