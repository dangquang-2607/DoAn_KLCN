/**
 * ============================================================================
 * TÊN FILE: OcrStatsGrid.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Giám sát hóa đơn OCR
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị năm chỉ số tổng hợp về hóa đơn và lượt xử lý OCR.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props data từ /admin/system/ocr-monitor và primitive Stat.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất lưới chỉ số thuần trình bày.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Thời gian trung bình chỉ hiển thị khi backend có số liệu đo.
 * ============================================================================
 */
import { Stat } from "../../../dung-chung/UI-chung/design";

export default function OcrStatsGrid({ data }) {
  return <div className="cf-grid-4"><Stat label="Tổng hóa đơn" value={data.invoices.total} note="Toàn hệ thống" /><Stat label="Chờ kiểm tra" value={data.invoices.review_required} note="Đã quét, chờ người dùng xác nhận" /><Stat label="Lượt xử lý lỗi" value={data.ocr_jobs.failed} note={`Trong ${data.ocr_jobs.total} lượt xử lý`} /><Stat label="Tỷ lệ xử lý lỗi" value={`${data.ocr_jobs.error_rate_pct}%`} note="Dựa trên số lượt xử lý" /><Stat label="Thời gian OCR trung bình" value={data.ocr_jobs.average_processing_ms == null ? "Chưa có" : `${(data.ocr_jobs.average_processing_ms / 1000).toFixed(1)} giây`} note="Tính từ các lượt đã đo" /></div>;
}
