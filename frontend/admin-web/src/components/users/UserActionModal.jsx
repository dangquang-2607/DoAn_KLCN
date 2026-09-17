import { ShieldAlert } from "lucide-react";
import { Modal, Alert, Field } from "../design";
import { actionTitles } from "./utils";

/**
 * UserActionModal - Modal xu ly cac action tren nguoi dung:
 * create, ban, unban, role, delete, restore, reset-password, bulk ops, retry-delete.
 */
export default function UserActionModal({
  action,
  target,
  form,
  busy,
  error,
  hardDelete,
  hardConfirmed,
  deletionReasonRequired,
  onClose,
  onSubmit,
  onChange,
}) {
  if (!action) return null;

  return (
    <Modal title={actionTitles[action]} busy={busy} onClose={onClose}>
      <form className="cf-form" onSubmit={onSubmit}>
        {error && <Alert onDismiss={() => onChange({ _clearError: true })}>{error}</Alert>}
        {action === "create" ? (
          <>
            <Field label="Ho va ten">
              <input
                className="cf-input"
                required
                maxLength={150}
                value={form.full_name}
                onChange={(e) => onChange({ full_name: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                className="cf-input"
                type="email"
                required
                value={form.email}
                onChange={(e) => onChange({ email: e.target.value })}
              />
            </Field>
            <Alert kind="info">
              He thong tao mat khau tam thoi va gui thong tin kich hoat qua
              email. Nguoi dung can doi mat khau khi dang nhap.
            </Alert>
          </>
        ) : (
          <p>
            {action.startsWith("bulk-")
              ? `Thao tac ap dung cho ${form._selectedCount ?? 0} tai khoan da chon.`
              : target
              ? `Thao tac ap dung cho: ${target.full_name || target.email}`
              : null}
          </p>
        )}
        {action === "role" && (
          <Field label="Vai tro moi">
            <select
              className="cf-input"
              value={form.role}
              onChange={(e) => onChange({ role: e.target.value })}
            >
              <option value="USER">Nguoi dung</option>
              <option value="ADMIN">Quan tri vien</option>
            </select>
          </Field>
        )}
        {action === "delete" && (
          <>
            {!target?.is_deleted && (
              <Field label="Phuong thuc xoa">
                <div className="cf-delete-options">
                  <label
                    className={`cf-delete-option ${form.deletion_mode === "soft" ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="deletion-mode"
                      value="soft"
                      checked={form.deletion_mode === "soft"}
                      onChange={(e) =>
                        onChange({ deletion_mode: e.target.value, confirmation: "" })
                      }
                    />
                    <span>
                      <strong>Xoa mem</strong>
                      <small>
                        Thu hoi quyen truy cap, giu du lieu va cho phep khoi phuc.
                      </small>
                    </span>
                  </label>
                  <label
                    className={`cf-delete-option danger ${form.deletion_mode === "hard" ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="deletion-mode"
                      value="hard"
                      checked={form.deletion_mode === "hard"}
                      onChange={(e) => onChange({ deletion_mode: e.target.value })}
                    />
                    <span>
                      <strong>Xoa vinh vien</strong>
                      <small>
                        Worker xoa du lieu nghiep vu va file hoa don theo
                        checkpoint; khong the khoi phuc.
                      </small>
                    </span>
                  </label>
                </div>
              </Field>
            )}
            <Field label="Ly do xoa">
              <textarea
                className="cf-input"
                rows={3}
                required
                minLength={3}
                maxLength={500}
                value={form.reason}
                onChange={(e) => onChange({ reason: e.target.value })}
              />
            </Field>
            {form.deletion_mode === "soft" ? (
              <label className="cf-check-row">
                <input
                  type="checkbox"
                  checked={form.release_email}
                  onChange={(e) => onChange({ release_email: e.target.checked })}
                />
                <span>Giai phong email de co the dang ky tai khoan moi</span>
              </label>
            ) : (
              <>
                <Alert persistent>
                  <span className="cf-row">
                    <ShieldAlert size={18} />
                    Du lieu tai chinh va file hoa don se bi xoa vinh vien.
                    He thong ghi nhan tien do de co the retry an toan khi loi.
                  </span>
                </Alert>
                <Field
                  label={`Nhap ${target?.email || "email nguoi dung"} hoac "XOA VINH VIEN"`}
                >
                  <input
                    className="cf-input"
                    autoComplete="off"
                    required
                    value={form.confirmation}
                    onChange={(e) => onChange({ confirmation: e.target.value })}
                  />
                </Field>
              </>
            )}
          </>
        )}
        {action === "bulk-delete" && (
          <Field label="Ly do xoa">
            <textarea
              className="cf-input"
              rows={3}
              required
              minLength={3}
              maxLength={500}
              value={form.reason}
              onChange={(e) => onChange({ reason: e.target.value })}
            />
          </Field>
        )}
        {action === "restore" && (
          <>
            <Alert kind="info">
              Email cu se duoc khoi phuc neu chua co tai khoan moi su dung.
              Trang thai khoa truoc khi xoa duoc giu nguyen.
            </Alert>
            <Field label="Ly do khoi phuc">
              <textarea
                className="cf-input"
                rows={2}
                minLength={3}
                maxLength={500}
                value={form.reason}
                onChange={(e) => onChange({ reason: e.target.value })}
              />
            </Field>
          </>
        )}
        {action === "retry-delete" && (
          <Alert kind="info">
            Worker se tiep tuc tu checkpoint{" "}
            <strong>{target?.deletion?.checkpoint || "REQUESTED"}</strong>.
            Cac buoc da hoan tat duoc nhan dien qua trang thai ben vung.
          </Alert>
        )}
        {action === "ban" && (
          <Alert kind="info">
            Tai khoan se bi khoa cho den khi quan tri vien mo lai. Nguoi
            dung duoc gui email thong bao.
          </Alert>
        )}
        <div className="cf-form-actions">
          <button
            className="cf-btn"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Huy
          </button>
          <button
            className={`cf-btn ${
              ["ban", "bulk-ban", "bulk-delete", "delete", "reset-password"].includes(action)
                ? "cf-btn-danger"
                : "cf-btn-primary"
            }`}
            disabled={
              busy ||
              !hardConfirmed ||
              (deletionReasonRequired && form.reason.trim().length < 3)
            }
          >
            {busy ? "Dang xu ly..." : "Xac nhan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}