/**
 * ============================================================================
 * TÊN FILE: TransactionDeleteModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Giao dịch
 * NHÓM VỆ TINH: _components (Chức năng con)
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
import { Alert, Modal } from "@/components/ui/ui";
import { money, type Transaction } from "@/lib/finance";

/** Xác nhận xóa giao dịch và cảnh báo việc hoàn lại số dư tài khoản. */
export default function TransactionDeleteModal({ transaction, currency, error, busy, onConfirm, onClose, onClearError }: { transaction: Transaction; currency?: string; error: string; busy: boolean; onConfirm: () => void; onClose: () => void; onClearError: () => void }) {
  return <Modal title="Xóa giao dịch" onClose={onClose} busy={busy}><div className="cf-form">{error && <Alert onDismiss={onClearError}>{error}</Alert>}<p>Xóa “{transaction.description}” với số tiền {money(transaction.amount, currency)}? Số dư tài khoản sẽ được hoàn lại.</p><div className="cf-form-actions"><button className="cf-btn" onClick={onClose} disabled={busy}>Hủy</button><button className="cf-btn cf-btn-danger" onClick={onConfirm} disabled={busy}>{busy ? "Đang xóa…" : "Xóa giao dịch"}</button></div></div></Modal>;
}
