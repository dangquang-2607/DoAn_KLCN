/**
 * ============================================================================
 * TÊN FILE: OcrFailureTable.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Giám sát hóa đơn OCR
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị mười lượt xử lý OCR thất bại gần nhất.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Danh sách recent_failures, trạng thái retry và callback retry.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất bảng lỗi hoặc empty state.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ hiển thị thông báo lỗi backend cung cấp; ID đầy đủ nằm trong title.
 * ============================================================================
 */
import { CheckCircle2 } from "lucide-react";
import { timestamp } from "../../../dung-chung/tien-ich/adminPresentation";
import OcrRetryButton from "./OcrRetryButton";

export default function OcrFailureTable({ failures, retrying, onRetry }) {
  return (
    <section className="adm-card adm-ocr-failures">
      <div className="adm-card-head"><div><p className="adm-eyebrow">CẦN CAN THIỆP</p><h2>Các lần xử lý lỗi gần đây</h2><p>10 lượt thất bại gần nhất</p></div>{!failures.length && <span className="adm-quiet-badge">Không có lỗi</span>}</div>
      {!failures.length ? <div className="adm-ocr-empty"><CheckCircle2 size={24} /><strong>Chưa ghi nhận lượt OCR lỗi</strong><span>Các lỗi phát sinh sẽ xuất hiện tại đây để kiểm tra và thử lại.</span></div> : (
        <div className="cf-table-wrap"><table className="cf-table"><thead><tr><th>Mã xử lý</th><th>Nội dung lỗi</th><th>Thời gian</th><th aria-label="Thao tác" /></tr></thead><tbody>{failures.map((failure) => <tr key={failure.job_id}><td title={failure.job_id}>{failure.job_id.slice(0, 8)}</td><td style={{ whiteSpace: "normal", maxWidth: 650 }}>{failure.error || "Không có chi tiết lỗi"}</td><td>{timestamp(failure.created_at)}</td><td className="right"><OcrRetryButton jobId={failure.job_id} retrying={retrying} onRetry={onRetry} /></td></tr>)}</tbody></table></div>
      )}
    </section>
  );
}
