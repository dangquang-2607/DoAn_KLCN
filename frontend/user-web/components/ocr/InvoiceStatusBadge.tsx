import { STATUSES } from "./InvoiceTypes";

interface InvoiceStatusBadgeProps {
  value: string;
}

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