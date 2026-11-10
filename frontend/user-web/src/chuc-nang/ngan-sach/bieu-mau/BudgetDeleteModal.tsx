import density from "../CSS/budget-density.module.css";
import { Alert, Modal } from "@/dung-chung/UI-chung/ui";
import type { Budget } from "@/dung-chung/nghiep-vu/finance";

/** Xác nhận chỉ xóa cấu hình ngân sách, không xóa giao dịch chi tiêu. */
export default function BudgetDeleteModal({ budget, error, busy, onConfirm, onClose, onClearError }: { budget: Budget; error: string; busy: boolean; onConfirm: () => void; onClose: () => void; onClearError: () => void }) {
  return (
    <Modal
      className={`${density.dialog} ${density.compact}`}
      title="Xóa ngân sách"
      onClose={onClose}
      busy={busy}
    >
      <div className={density.form}>
        <div className={density.fields}>
          {error && <Alert persistent onDismiss={onClearError}>{error}</Alert>}
          <p>
            {`Xóa “${budget.budget_name}”? Lịch sử ngân sách này sẽ không còn hiển thị; các giao dịch chi tiêu vẫn được giữ lại.`}
          </p>
        </div>
        <div className={density.footer}>
          <button className="cf-btn" disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button
            className="cf-btn cf-btn-danger"
            disabled={busy}
            onClick={onConfirm}
          >
            Xóa ngân sách
          </button>
        </div>
      </div>
    </Modal>
  );
}
