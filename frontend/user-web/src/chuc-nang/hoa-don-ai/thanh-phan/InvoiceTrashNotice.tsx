import { RotateCcw, Trash2 } from "lucide-react";
import type { Invoice } from "../xu-ly/InvoiceTypes";

export default function InvoiceTrashNotice({
  invoice,
  busy,
  onRestore,
}: {
  invoice: Invoice;
  busy: boolean;
  onRestore: () => void;
}) {
  if (!invoice.deleted_at) return null;
  const deadline = invoice.trash_expires_at;
  const expired = invoice.can_restore === false;
  const formatted = deadline
    ? new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(deadline) ? deadline : `${deadline}Z`).toLocaleString("vi-VN")
    : "sau 30 ngày kể từ khi chuyển vào Thùng rác";

  return (
    <div className="cf-invoice-trash-container">
      <div className="cf-invoice-trash-banner" role="status">
        <div className="cf-invoice-trash-icon" aria-hidden="true">
          <Trash2 size={18} />
        </div>
        <div className="cf-invoice-trash-body">
          <p className="cf-invoice-trash-text">
            <strong>Hóa đơn trong Thùng rác.</strong>{" "}
            {expired
              ? "Đã hết hạn khôi phục, đang chờ xóa vĩnh viễn."
              : `Ảnh và thông tin được giữ đến ${formatted}, sau đó xóa vĩnh viễn.`}{" "}
            Khoản chi đã ghi sổ vẫn được giữ lại.
          </p>
        </div>
        <button
          type="button"
          className="cf-btn cf-btn-sm cf-invoice-trash-btn"
          disabled={busy || expired}
          onClick={onRestore}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Khôi phục hóa đơn
        </button>
      </div>
    </div>
  );
}
