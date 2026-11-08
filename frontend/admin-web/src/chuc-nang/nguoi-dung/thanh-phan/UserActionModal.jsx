import density from "../../../dung-chung/CSS/management.module.css";
import { Modal, Alert, Field } from "../../../dung-chung/UI-chung/ui";
import { actionTitles } from "../xu-ly/utils";

export default function UserActionModal({
  action,
  target,
  selectedCount,
  form,
  busy,
  error,
  onClose,
  onSubmit,
  onChange,
}) {
  if (!actionTitles[action]) return null;

  return (
    <Modal className={density.dialog} title={actionTitles[action]} busy={busy} onClose={onClose}>
      <form className={density.form} onSubmit={onSubmit} aria-busy={busy}>
        <div className={density.fields}>
          {error && <Alert persistent onDismiss={() => onChange({ _clearError: true })}>{error}</Alert>}
          <p>
            {action.startsWith("bulk-")
              ? `Thao tác áp dụng cho ${selectedCount} tài khoản đã chọn.`
              : target
              ? `Thao tác áp dụng cho: ${target.full_name || target.email}`
              : null}
          </p>
          {action === "role" && (
            <Field label="Vai trò mới">
              <select
                className="cf-input"
                disabled={busy}
                value={form.role}
                onChange={(e) => onChange({ role: e.target.value })}
              >
                <option value="USER">Người dùng</option>
                <option value="SUPPORT">Admin hỗ trợ</option>
                <option value="ADMIN">Quản trị viên</option>
              </select>
            </Field>
          )}
          {action === "role" && form.role === "SUPPORT" && (
            <Alert kind="info">Tài khoản chỉ vào được Hỗ trợ tài khoản và cài đặt bảo mật của chính mình.</Alert>
          )}
          {action === "bulk-ban" && <Field label="Lý do khóa" hint="Để trống để dùng lý do mặc định của hệ thống."><textarea className="cf-input" maxLength={500} disabled={busy} value={form.reason} onChange={(event) => onChange({ reason: event.target.value })} /></Field>}
          {action === "ban" && (
            <Alert kind="info">
              Tài khoản sẽ bị khóa cho đến khi quản trị viên mở lại. Người
              dùng được gửi email thông báo.
            </Alert>
          )}
        </div>
        <div className={density.footer}>
          <button
            className="cf-btn"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            className={`cf-btn ${
              ["ban", "bulk-ban", "reset-password"].includes(action)
                ? "cf-btn-danger"
                : "cf-btn-primary"
            }`}
            disabled={busy}
          >
            {busy ? "Đang xử lý..." : "Xác nhận"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
