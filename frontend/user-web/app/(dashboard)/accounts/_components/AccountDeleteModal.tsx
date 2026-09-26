/**
 * ============================================================================
 * TÊN FILE: AccountDeleteModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Ví & tài khoản
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Xác nhận ngừng sử dụng tài khoản và bảo vệ tài khoản còn số dư.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất AccountDeleteModal để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Bảo toàn số dư và lịch sử; không cho ngừng tài khoản khi số dư khác 0.
 * ============================================================================
 */
import { Alert, Modal } from "@/components/ui/ui";
import { money, type Account } from "@/lib/finance";

/** Xác nhận ngừng sử dụng tài khoản; chặn xóa khi số dư chưa về 0. */
export default function AccountDeleteModal({ account, error, busy, onConfirm, onClose, onClearError }: {
  account: Account;
  error: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onClearError: () => void;
}) {
  const hasBalance = Number(account.balance) !== 0;
  return (
    <Modal title="Ngừng sử dụng tài khoản" onClose={onClose} busy={busy}>
      <div className="cf-form">
        {error && <Alert onDismiss={onClearError}>{error}</Alert>}
        <p>Ngừng sử dụng <strong>{account.name}</strong>? Lịch sử giao dịch vẫn được giữ lại.</p>
        {hasBalance && <Alert kind="info">Ví còn {money(account.balance, account.currency)}. Chuyển hoặc điều chỉnh số dư về 0 trước khi tiếp tục.</Alert>}
        <div className="cf-form-actions">
          <button className="cf-btn" onClick={onClose} disabled={busy}>Hủy</button>
          <button className="cf-btn cf-btn-danger" onClick={onConfirm} disabled={busy || hasBalance}>
            {busy ? "Đang xử lý…" : "Ngừng sử dụng"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
