/**
 * ============================================================================
 * TÊN FILE: AccountModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Ví & tài khoản
 * NHÓM VỆ TINH: _components (Chức năng con)
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
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Alert, Field, Modal } from "@/components/ui/ui";
import { accountTypes, type Account } from "@/lib/finance";

export type AccountForm = {
  name: string;
  account_type: string;
  institution_name: string;
  balance: string;
  currency: string;
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
        <Field label="Tên tài khoản">
          <input className="cf-input" required maxLength={150} value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Ví tiền mặt, tài khoản lương…" />
        </Field>
        <div className="cf-form-grid">
          <Field label="Loại tài khoản">
            <select className="cf-input" value={form.account_type}
              onChange={(event) => setForm((current) => ({ ...current, account_type: event.target.value }))}>
              {Object.entries(accountTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Tiền tệ">
            <select className="cf-input" value={form.currency}
              onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}>
              <option>VND</option>
            </select>
          </Field>
        </div>
        <Field label="Tổ chức / ngân hàng (tùy chọn)">
          <input className="cf-input" maxLength={150} value={form.institution_name}
            onChange={(event) => setForm((current) => ({ ...current, institution_name: event.target.value }))} />
        </Field>
        <Field label={editing ? "Số dư điều chỉnh" : "Số dư ban đầu"}
          hint={editing ? "Thay đổi số dư sẽ tạo bản ghi điều chỉnh, lưu số dư trước/sau và không tính vào thu/chi." : undefined}>
          <input className="cf-input" required type="number" step="0.01" value={form.balance}
            onChange={(event) => setForm((current) => ({ ...current, balance: event.target.value }))} />
        </Field>
        <div className="cf-form-actions">
          <button type="button" className="cf-btn" onClick={onClose} disabled={busy}>Hủy</button>
          <button className="cf-btn cf-btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu tài khoản"}</button>
        </div>
      </form>
    </Modal>
  );
}
