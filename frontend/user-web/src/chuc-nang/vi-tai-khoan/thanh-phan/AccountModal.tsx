/**
 * ============================================================================
 * TÊN FILE: AccountModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Ví & tài khoản
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp biểu mẫu tạo mới hoặc chỉnh sửa tài khoản.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất AccountModal để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Bảo toàn số dư và lịch sử; không cho ngừng tài khoản khi số dư khác 0.
 * ============================================================================
 */
import { type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Alert, Field, Modal } from "@/dung-chung/UI-chung/ui";
import DateInput from "@/dung-chung/UI-chung/DateInput";
import { formatDateForDisplay, parseDateForApi } from "@/dung-chung/tien-ich/finance";
import { type Account } from "@/dung-chung/nghiep-vu/finance";

export type AccountForm = {
  name: string;
  account_type: string;
  institution_name: string;
  balance: string;
  currency: string;
  account_number_masked: string;
  target_amount: string;
  target_date: string;
  exclude_from_total: boolean;
  is_notification_enabled: boolean;
};

/** Biểu mẫu dùng chung cho cả tạo mới và chỉnh sửa tài khoản. */
export default function AccountModal({ editing, form, setForm, error, busy, onSubmit, onClose, onClearError }: {
  editing: Account | null;
  form: AccountForm;
  setForm: Dispatch<SetStateAction<AccountForm>>;
  error: string;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  onClearError: () => void;
}) {
  return (
    <Modal title={editing ? "Chỉnh sửa tài khoản" : "Thêm tài khoản"} onClose={onClose} busy={busy}>
      <form className="cf-form" onSubmit={onSubmit}>
        {error && <Alert onDismiss={onClearError}>{error}</Alert>}
        {editing && !["BASIC", "LINKED", "SAVINGS"].includes(editing.account_type) &&
          <p className="cf-muted">Ví cũ ({editing.account_type}) được hiển thị theo nhóm tương ứng. Giữ nguyên lựa chọn sẽ bảo toàn loại ví cũ; chọn nhóm khác mới chuyển loại ví.</p>}
        <Field label="Tên tài khoản">
          <input className="cf-input" required maxLength={150} value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Ví tiền mặt, tài khoản lương…" />
        </Field>
        <div className="cf-form-grid">
          <Field label="Loại tài khoản">
            <select className="cf-input" disabled={editing?.bank_managed} value={form.account_type}
              onChange={(event) => setForm((current) => ({ ...current, account_type: event.target.value }))}>
              {Object.entries({ BASIC: "Ví cơ bản", LINKED: "Ví liên kết", SAVINGS: "Ví tiết kiệm" }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Tiền tệ">
            <select className="cf-input" value={form.currency}
              onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}>
              <option>VND</option>
            </select>
          </Field>
        </div>
        {form.account_type === "LINKED" ? <>
          <Field label="Ngân hàng / Ví điện tử">
            <select className="cf-input" disabled={editing?.bank_managed} required value={form.institution_name}
              onChange={e => setForm(f => ({ ...f, institution_name: e.target.value }))}>
              <option value="">Chọn ngân hàng</option>
              {form.institution_name && !["VCB", "ACB", "MB", "TCB", "MOMO"].includes(form.institution_name) &&
                <option value={form.institution_name}>{form.institution_name} (đang lưu)</option>}
              {Object.entries({ VCB: "Vietcombank", ACB: "ACB", MB: "MB Bank", TCB: "Techcombank", MOMO: "MoMo" }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </Field>
          <Field label="Số tài khoản che (tùy chọn)" hint="Chỉ nhập **** và bốn số cuối, ví dụ ****5678">
            <input className="cf-input" disabled={editing?.bank_managed} pattern="[*]{4}[0-9]{4}" maxLength={8} value={form.account_number_masked}
              onChange={e => setForm(f => ({ ...f, account_number_masked: e.target.value }))} />
          </Field>
          <p className="cf-muted">Lưu ví trước, sau đó mở “Xem chi tiết” để kết nối ngân hàng demo. Không sử dụng thông tin ngân hàng thật.</p>
        </> : form.account_type === "SAVINGS" ? <>
          <Field label="Số tiền mục tiêu">
            <input className="cf-input" required type="number" min="1" step="1" value={form.target_amount}
              onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} />
          </Field>
          <Field label="Hạn hoàn thành mục tiêu">
            <DateInput required disabled={busy} value={parseDateForApi(form.target_date) || ""}
              onChange={iso => setForm(f => ({ ...f, target_date: formatDateForDisplay(iso) }))} />
          </Field>
          <label className="cf-switch-row"><input className="cf-switch-input" type="checkbox" role="switch" checked={form.is_notification_enabled}
            onChange={e => setForm(f => ({ ...f, is_notification_enabled: e.target.checked }))} /> Thông báo biến động / đạt mục tiêu</label>
        </> : null}
        <Field label={editing ? "Số dư điều chỉnh" : form.account_type === "SAVINGS" ? "Số tiền đã tích lũy" : "Số dư ban đầu"}
          hint={editing ? "Thay đổi số dư sẽ tạo bản ghi điều chỉnh, lưu số dư trước/sau và không tính vào thu/chi." : undefined}>
          <input className="cf-input" readOnly={editing?.bank_managed} required type="number" step="0.01" value={form.balance}
            onChange={(event) => setForm((current) => ({ ...current, balance: event.target.value }))} />
        </Field>
        <label className="cf-switch-row"><input className="cf-switch-input" type="checkbox" role="switch" checked={form.exclude_from_total}
          onChange={e => setForm(f => ({ ...f, exclude_from_total: e.target.checked }))} /> Không tính vào Tổng tài sản</label>
        <p className="cf-muted">Giao dịch vẫn được giữ trong lịch sử và báo cáo thu/chi.</p>
        <div className="cf-form-actions">
          <button type="button" className="cf-btn" onClick={onClose} disabled={busy}>Hủy</button>
          <button className="cf-btn cf-btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu tài khoản"}</button>
        </div>
      </form>
    </Modal>
  );
}
