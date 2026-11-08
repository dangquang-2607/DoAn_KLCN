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
