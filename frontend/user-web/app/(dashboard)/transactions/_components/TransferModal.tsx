/**
 * ============================================================================
 * TÊN FILE: TransferModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Giao dịch
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp biểu mẫu chuyển tiền nội bộ giữa hai tài khoản.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất TransferModal để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Validate tài khoản, tiền tệ và số tiền; mọi ghi/xóa phải làm mới các cache tài chính liên quan.
 * ============================================================================
 */
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Alert, Field, Modal } from "@/components/ui/ui";
import { TransferFlow } from "@/components/ui/Motion";
import { money, type Account } from "@/lib/finance";
import type { TransactionForm } from "./TransactionModal";

/** Form chuyển tiền nội bộ; chỉ cho chọn tài khoản nhận có cùng loại tiền. */
export default function TransferModal({ accounts, form, setForm, error, busy, dependencyError, onSubmit, onClose, onClearError }: { accounts: Account[]; form: TransactionForm; setForm: Dispatch<SetStateAction<TransactionForm>>; error: string; busy: boolean; dependencyError: boolean; onSubmit: (event: FormEvent) => void; onClose: () => void; onClearError: () => void }) {
  const from = accounts.find((item) => item.id === form.account_id);
  const to = accounts.find((item) => item.id === form.to_account_id);
  return <Modal title="Chuyển tiền giữa tài khoản" onClose={onClose} busy={busy}><form className="cf-form" onSubmit={onSubmit}>
    {error && <Alert onDismiss={onClearError}>{error}</Alert>}{dependencyError && <Alert persistent>Không thể tải tài khoản. Đóng biểu mẫu và thử lại.</Alert>}
    <TransferFlow from={from?.name || ""} to={to?.name || ""} />
    <Field label="Tài khoản chuyển đi"><select required className="cf-input" value={form.account_id} onChange={(event) => setForm({ ...form, account_id: event.target.value })}><option value="">Chọn tài khoản</option>{accounts.map((item) => <option value={item.id} key={item.id}>{item.name} · {money(item.balance, item.currency)}</option>)}</select></Field>
    <Field label="Tài khoản nhận"><select className="cf-input" required value={form.to_account_id} onChange={(event) => setForm({ ...form, to_account_id: event.target.value })}><option value="">Chọn tài khoản nhận</option>{accounts.filter((item) => item.id !== form.account_id && item.currency === from?.currency).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
    <div className="cf-form-grid"><Field label={`Số tiền (${from?.currency || "VND"})`}><input className="cf-input" required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field><Field label="Ngày giao dịch"><input className="cf-input" required type="date" value={form.transaction_date} onChange={(event) => setForm({ ...form, transaction_date: event.target.value })} /></Field></div>
    <Field label="Ghi chú (tùy chọn)"><textarea className="cf-input" rows={2} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field>
    <div className="cf-form-actions"><button type="button" disabled={busy} className="cf-btn" onClick={onClose}>Hủy</button><button className="cf-btn cf-btn-primary" disabled={busy || !accounts.length || dependencyError}>{busy ? "Đang xử lý…" : "Xác nhận chuyển tiền"}</button></div>
  </form></Modal>;
}
