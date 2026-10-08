/**
 * ============================================================================
 * TÊN FILE: InvoiceStatusBadge.tsx
 * MÀN HÌNH / PHÂN HỆ: Hóa đơn AI / OCR
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Chuẩn hóa nhãn hiển thị trạng thái xử lý hóa đơn.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất InvoiceStatusBadge để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Giới hạn định dạng/kích thước/số lượng tệp; chỉ tạo khoản chi sau bước người dùng xác nhận.
 * ============================================================================
 */
import { STATUSES } from "../xu-ly/InvoiceTypes";

interface InvoiceStatusBadgeProps {
  value: string;
}

// Dùng một nguồn nhãn trạng thái duy nhất để danh sách và màn chi tiết hiển thị nhất quán.
export default function InvoiceStatusBadge({ value }: InvoiceStatusBadgeProps) {
  const tone =
    value === "CONFIRMED"
      ? "success"
      : value === "FAILED"
      ? "danger"
      : value === "REVIEW_REQUIRED"
      ? "warning"
      : "info";
  return <span className={`cf-badge ${tone}`}>{STATUSES[value] || value}</span>;
}
