/**
 * ============================================================================
 * TÊN FILE: OcrRetryButton.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Giám sát hóa đơn OCR
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị nút gửi lại một tác vụ OCR thất bại.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Mã job, mã job đang retry và callback do OcrMonitor cung cấp.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất nút có trạng thái loading và khóa thao tác đồng thời.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Nút chỉ phát sự kiện; mutation và xử lý lỗi vẫn nằm ở page.
 * ============================================================================
 */
import { RotateCw } from "lucide-react";

export default function OcrRetryButton({ jobId, retrying, onRetry }) {
  return <button className="cf-btn cf-btn-sm" disabled={Boolean(retrying)} onClick={() => onRetry(jobId)}><RotateCw size={15} />{retrying === jobId ? "Đang gửi…" : "Thử lại"}</button>;
}
