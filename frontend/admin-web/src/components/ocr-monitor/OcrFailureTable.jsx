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
import { Empty, Panel } from "../design";
import OcrRetryButton from "./OcrRetryButton";

export default function OcrFailureTable({ failures, retrying, onRetry }) {
  return (
    <Panel title="Các lần xử lý lỗi gần đây" description="10 lần thất bại gần nhất">
      {!failures.length ? <Empty title="Chưa ghi nhận lỗi xử lý" description="Các lỗi phát sinh sẽ xuất hiện tại đây." /> : (
        <div className="cf-table-wrap"><table className="cf-table"><thead><tr><th>Mã xử lý</th><th>Nội dung lỗi</th><th>Thời gian</th><th aria-label="Thao tác" /></tr></thead><tbody>{failures.map((failure) => <tr key={failure.job_id}><td title={failure.job_id}>{failure.job_id.slice(0, 8)}</td><td style={{ whiteSpace: "normal", maxWidth: 650 }}>{failure.error || "Không có chi tiết lỗi"}</td><td>{new Date(failure.created_at).toLocaleString("vi-VN")}</td><td className="right"><OcrRetryButton jobId={failure.job_id} retrying={retrying} onRetry={onRetry} /></td></tr>)}</tbody></table></div>
      )}
    </Panel>
  );
}
