/**
 * ============================================================================
 * TÊN FILE: TransactionDeleteModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Giao dịch
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Xác nhận xóa giao dịch và thông báo tác động đến số dư.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất TransactionDeleteModal để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Validate tài khoản, tiền tệ và số tiền; mọi ghi/xóa phải làm mới các cache tài chính liên quan.
 * ============================================================================
 */
import { Alert, Modal } from "@/dung-chung/UI-chung/ui";
import { money } from "@/dung-chung/tien-ich/finance";
import { type Account, type Transaction } from "@/dung-chung/nghiep-vu/finance";

/** Giải thích tác động trước khi xóa một hoặc nhiều giao dịch. */
export default function TransactionDeleteModal({ transactions, getAccount, error, busy, onConfirm, onClose, onClearError }: { transactions: Transaction[]; getAccount: (id: string) => Account | undefined; error: string; busy: boolean; onConfirm: () => void; onClose: () => void; onClearError: () => void }) {
  const single = transactions.length === 1 ? transactions[0] : null;
  const hasTransfer = transactions.some((transaction) => transaction.kind === "TRANSFER");
  const hasBank = transactions.some((transaction) => transaction.bank_reference || getAccount(transaction.account_id)?.bank_managed);
  const hasSelfManaged = transactions.some((transaction) => !transaction.bank_reference && !getAccount(transaction.account_id)?.bank_managed);
  const hasInvoice = transactions.some((transaction) => transaction.invoice_id || transaction.source === "OCR");
  return <Modal title={single ? "Xóa giao dịch" : "Xóa các giao dịch đã chọn"} onClose={onClose} busy={busy}><div className="cf-form">
    {error && <Alert onDismiss={onClearError}>{error}</Alert>}
    <p>{single ? <>Xóa “{single.description || "Giao dịch"}” với số tiền {money(single.amount, getAccount(single.account_id)?.currency)}?</> : <>Xóa {transactions.length} giao dịch đã chọn trên trang này?</>}</p>
    {hasTransfer && <p>Giao dịch chuyển tiền sẽ được xóa cả hai vế; số dư hai ví được điều chỉnh cùng lúc.</p>}
    {hasBank && <p>Giao dịch ngân hàng mô phỏng được gỡ khỏi sổ theo dõi. Số dư từ ngân hàng và dữ liệu nguồn vẫn giữ nguyên.</p>}
    {hasInvoice && <p>Hóa đơn gốc được giữ lại và chuyển về trạng thái chờ kiểm duyệt để bạn có thể ghi nhận lại khi cần.</p>}
    {hasSelfManaged && <p>Với ví tự quản, số dư sẽ được tính lại theo các giao dịch đã xóa.</p>}
    <div className="cf-form-actions"><button type="button" className="cf-btn" onClick={onClose} disabled={busy}>Hủy</button><button type="button" className="cf-btn cf-btn-danger" onClick={onConfirm} disabled={busy}>{busy ? "Đang xóa…" : single ? "Xóa giao dịch" : `Xóa ${transactions.length} giao dịch`}</button></div>
  </div></Modal>;
}
