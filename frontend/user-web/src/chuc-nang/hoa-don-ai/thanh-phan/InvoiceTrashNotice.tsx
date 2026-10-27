/**
 * ============================================================================
 * TÊN FILE: InvoiceTrashNotice.tsx
 * MÀN HÌNH / PHÂN HỆ: Nhận diện hóa đơn AI (OCR)
 * NHÓM VỆ TINH: thanh-phan (Thành phần giao diện con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị banner thông báo cảnh báo khi hóa đơn đang nằm trong Thùng rác,
 *   thời hạn hết hạn khôi phục (30 ngày) và nút khôi phục hóa đơn về danh sách hoạt động.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Thông tin hóa đơn Invoice (chứa deleted_at, trash_expires_at, can_restore).
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export InvoiceTrashNotice component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Khóa nút khôi phục nếu hóa đơn đã vượt quá thời hạn cho phép trong Thùng rác.
 * ============================================================================
 */
import { RotateCcw, Trash2 } from "lucide-react";
import type { Invoice } from "../xu-ly/InvoiceTypes";

/**
 * Banner cảnh báo hóa đơn đã bị xóa mềm và cung cấp tùy chọn khôi phục.
 */
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
