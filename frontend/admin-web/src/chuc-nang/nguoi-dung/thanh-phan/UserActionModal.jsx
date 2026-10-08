/**
 * ============================================================================
 * TÊN FILE: UserActionModal.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Quản lý người dùng
 * MỤC ĐÍCH CỤ THỂ:
 *   Thu thập dữ liệu và xác nhận cho các thao tác quản trị tài khoản.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   action, target, form và callback submit/change từ Users.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất modal động cho tạo, khóa, quyền, xóa, khôi phục và cấp lại mật khẩu.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Xóa vĩnh viễn yêu cầu xác nhận rõ ràng; modal không tự gọi API.
 * ============================================================================
 */
import { ShieldAlert } from "lucide-react";
import { Modal, Alert, Field } from "../../../dung-chung/UI-chung/design";
import { actionTitles } from "../xu-ly/utils";

export default function UserActionModal({
  action,
  target,
  form,
  busy,
  error,
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
            <Field label="Họ và tên">
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
              Hệ thống tao mật khẩu tạm thời va gửi thông tin kích hoạt qua
              email. Người dùng cần đổi mật khẩu khi đăng nhập.
            </Alert>
          </>
        ) : (
          <p>
            {action.startsWith("bulk-")
              ? `Thao tác áp dụng cho ${form._selectedCount ?? 0} tài khoản đã chọn.`
              : target
              ? `Thao tác áp dụng cho: ${target.full_name || target.email}`
              : null}
          </p>
        )}
        {action === "role" && (
          <Field label="Vai trò mới">
            <select
              className="cf-input"
              value={form.role}
              onChange={(e) => onChange({ role: e.target.value })}
            >
              <option value="USER">Người dùng</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </Field>
        )}
        {action === "delete" && (
          <>
            {!target?.is_deleted && (
              <Field label="Phương thức xóa">
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
                      <strong>Xóa mềm</strong>
                      <small>
                        Thu hồi quyền truy cập, giữ dữ liệu và cho phép khôi phục.
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
                      <strong>Xóa vĩnh viễn</strong>
                      <small>
                        Worker xóa dữ liệu nghiệp vụ và file hóa đơn theo
                        checkpoint; không thể khôi phục.
                      </small>
                    </span>
                  </label>
                </div>
              </Field>
            )}
            <Field label="Lý do xóa">
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
                <span>Giải phóng email để có thể đăng ký tài khoản mới</span>
              </label>
            ) : (
              <>
                <Alert persistent>
                  <span className="cf-row">
                    <ShieldAlert size={18} />
                    Dữ liệu tài chính và file hóa đơn sẽ bị xóa vĩnh viễn.
                    Hệ thống ghi nhận tiến độ để có thể retry an toàn khi lỗi.
                  </span>
                </Alert>
                <Field
                  label={`Nhập ${target?.email || "email người dùng"} hoặc "XÓA VĨNH VIỄN"`}
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
          <Field label="Lý do xóa">
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
              Email cũ sẽ được khôi phục nếu chưa có tài khoản mới sử dụng.
              Trạng thái khóa trước khi xóa được giữ nguyên.
            </Alert>
            <Field label="Lý do khôi phục">
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
            Worker sẽ tiếp tục từ checkpoint{" "}
            <strong>{target?.deletion?.checkpoint || "REQUESTED"}</strong>.
            Các bước đã hoàn tất được nhận diện qua trạng thái bền vững.
          </Alert>
        )}
        {action === "ban" && (
          <Alert kind="info">
            Tài khoản sẽ bị khóa cho đến khi quản trị viên mở lại. Người
            dùng được gửi email thông báo.
          </Alert>
        )}
        <div className="cf-form-actions">
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
            {busy ? "Đang xử lý..." : "Xác nhận"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
