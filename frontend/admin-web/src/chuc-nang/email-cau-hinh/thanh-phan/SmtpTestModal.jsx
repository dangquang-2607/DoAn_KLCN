import { Mail } from "lucide-react";
import { Alert, Field, Modal } from "../../../dung-chung/UI-chung/ui";
import density from "../../../dung-chung/CSS/management.module.css";

export default function SmtpTestModal({ open, recipient, busy, error, onRecipientChange, onDismissError, onClose, onSubmit }) {
  if (!open) return null;
  return (
    <Modal className={density.dialog} title="Gửi email thử" onClose={onClose} busy={busy}>
      <form className={density.form} onSubmit={onSubmit} aria-busy={busy}>
        <div className={density.fields}>
          {error && <Alert persistent onDismiss={onDismissError}>{error}</Alert>}
          <p className="cf-muted">Gửi một email kiểm tra bằng cấu hình hiện tại.</p>
          <Field label="Email người nhận">
            <input className="cf-input" type="email" required disabled={busy} value={recipient} onChange={(event) => onRecipientChange(event.target.value)} />
          </Field>
        </div>
        <div className={density.footer}>
          <button type="button" className="cf-btn" disabled={busy} onClick={onClose}>Hủy</button>
          <button className="cf-btn cf-btn-primary" disabled={busy}><Mail size={18} />{busy ? "Đang gửi…" : "Gửi email thử"}</button>
        </div>
      </form>
    </Modal>
  );
}
