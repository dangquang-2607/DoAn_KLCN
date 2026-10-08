/**
 * ============================================================================
 * TÊN FILE: AccountDeleteModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Ví & tài khoản
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Xác nhận xóa vĩnh viễn ví và hiển thị số dữ liệu liên quan.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất AccountDeleteModal để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Người dùng phải thấy rõ giao dịch và hóa đơn sẽ bị xóa trước khi xác nhận.
 * ============================================================================
 */
import { Alert, Modal } from "@/dung-chung/UI-chung/ui";
import { money } from "@/dung-chung/tien-ich/finance";
import { type Account } from "@/dung-chung/nghiep-vu/finance";

export interface AccountDeletionPreview {
  transaction_count: number;
  transfer_count: number;
  adjustment_count: number;
  invoice_count: number;
}

/** Hiển thị tác động của thao tác xóa trước khi người dùng xác nhận. */
export default function AccountDeleteModal({ account, preview, previewLoading, previewError, error, busy, onConfirm, onClose, onClearError }: {
  account: Account;
  preview?: AccountDeletionPreview;
  previewLoading: boolean;
  previewError: boolean;
  error: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onClearError: () => void;
}) {
  return (
    <Modal title="Xóa ví" onClose={onClose} busy={busy}>
      <div className="cf-form">
        {error && <Alert onDismiss={onClearError}>{error}</Alert>}
        <p>Xóa ví <strong>{account.name}</strong>?</p>
        {previewLoading && <p>Đang kiểm tra dữ liệu liên quan…</p>}
        {previewError && <Alert>Không thể kiểm tra dữ liệu của ví. Vui lòng đóng và thử lại.</Alert>}
        {preview && <Alert kind="info">
          Ví hiện có {money(account.balance, account.currency)}. Thao tác này sẽ xóa {preview.transaction_count} giao dịch thu/chi,
          {" "}{preview.transfer_count} lần chuyển tiền, {preview.adjustment_count} lần điều chỉnh số dư
          và {" "}{preview.invoice_count} hóa đơn liên quan. Số dư ví đối ứng, ngân sách và báo cáo sẽ được tính lại.
          Hành động này không thể hoàn tác.
        </Alert>}
        <div className="cf-form-actions">
          <button className="cf-btn" onClick={onClose} disabled={busy}>Hủy</button>
          <button className="cf-btn cf-btn-danger" onClick={onConfirm} disabled={busy || !preview}>
            {busy ? "Đang xóa…" : "Xóa"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
