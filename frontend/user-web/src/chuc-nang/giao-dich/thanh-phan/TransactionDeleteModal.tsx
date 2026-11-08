import { Alert, Modal } from "@/dung-chung/UI-chung/ui";
import { money } from "@/dung-chung/tien-ich/finance";
import { type Account, type Transaction } from "@/dung-chung/nghiep-vu/finance";
import styles from "../CSS/Transactions.module.css";

/** Giải thích tác động trước khi xóa một hoặc nhiều giao dịch. */
export default function TransactionDeleteModal({
  independent = false,
  transactions,
  getAccount,
  error,
  busy,
  onConfirm,
  onClose,
  onClearError,
}: {
  independent?: boolean;
  transactions: Transaction[];
  getAccount: (id: string | null) => Account | undefined;
  error: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onClearError: () => void;
}) {
  const single = transactions.length === 1 ? transactions[0] : null;
  const hasTransfer = transactions.some(
    (transaction) => transaction.kind === "TRANSFER",
  );
  const hasBank = transactions.some(
    (transaction) =>
      transaction.bank_reference ||
      getAccount(transaction.account_id)?.bank_managed,
  );
  const hasSelfManaged = transactions.some(
    (transaction) =>
      !transaction.bank_reference &&
      !getAccount(transaction.account_id)?.bank_managed,
  );
  const hasInvoice = transactions.some(
    (transaction) => transaction.invoice_id || transaction.source === "OCR",
  );
  return (
    <Modal className={`${styles.dialog} ${styles.compact}`} title={single ? "Xóa giao dịch" : "Xóa các giao dịch đã chọn"} onClose={onClose} busy={busy} >
      <div className={styles.form}>
        <div className={styles.fields}>
          {error && <Alert persistent onDismiss={onClearError}>{error}</Alert>}
          <p>
            {single ? (
              <> Xóa “{single.description || "Giao dịch"}” với số tiền{" "} {money(single.amount, getAccount(single.account_id)?.currency)}? </>
            ) : (
              <> Xóa {transactions.length} giao dịch đã chọn, bao gồm lựa chọn ở các trang khác? </>
            )}
          </p>
          {!independent && hasTransfer && (
            <p> Giao dịch chuyển tiền sẽ được xóa cả hai vế; số dư hai ví được điều chỉnh cùng lúc. </p>
          )}
          {!independent && hasBank && (
            <p> Giao dịch ngân hàng được gỡ khỏi sổ theo dõi. Số dư từ ngân hàng và dữ liệu nguồn vẫn giữ nguyên. </p>
          )}
          {independent && (
            <p>Chỉ xóa khỏi sổ thu chi; số dư ví không thay đổi.</p>
          )}
          {hasInvoice && (
            <p> Hóa đơn gốc được giữ lại và chuyển về trạng thái chờ kiểm duyệt để bạn có thể ghi nhận lại khi cần. </p>
          )}
          {!independent && hasSelfManaged && (
            <p> Với ví tự quản, số dư sẽ được tính lại theo các giao dịch đã xóa. </p>
          )}
        </div>
        <div className={styles.actions}>
          <button type="button" className="cf-btn" onClick={onClose} disabled={busy} > Hủy </button>
          <button type="button" className="cf-btn cf-btn-danger" onClick={onConfirm} disabled={busy} >
            {busy
              ? "Đang xóa…"
              : single
                ? "Xóa giao dịch"
                : `Xóa ${transactions.length} giao dịch`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
