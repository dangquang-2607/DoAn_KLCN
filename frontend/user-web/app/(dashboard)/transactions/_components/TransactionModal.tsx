/**
 * ============================================================================
 * TÊN FILE: TransactionModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Giao dịch
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp biểu mẫu tạo hoặc sửa giao dịch thu chi.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất TransactionModal để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Validate tài khoản, tiền tệ và số tiền; mọi ghi/xóa phải làm mới các cache tài chính liên quan.
 * ============================================================================
 */
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Alert, Field, Modal } from "@/components/ui/ui";
import { money, type Account, type Category, type Transaction } from "@/lib/finance";

export type TransactionForm = { account_id: string; category_id: string; type: string; amount: string; transaction_date: string; description: string; note: string; to_account_id: string };
export type CategorySuggestion = { category_id: string | null; category_name: string | null; confidence: number; source: string; auto_apply: boolean; reason: string };

/** Form tạo/sửa giao dịch thu chi, gồm gợi ý danh mục từ backend. */
export default function TransactionModal({ editing, accounts, categories, form, setForm, suggestion, setSuggestion, setCategoryTouched, error, busy, dependencyError, onSubmit, onClose, onClearError }: { editing: Transaction | null; accounts: Account[]; categories: Category[]; form: TransactionForm; setForm: Dispatch<SetStateAction<TransactionForm>>; suggestion: CategorySuggestion | null; setSuggestion: (value: CategorySuggestion | null) => void; setCategoryTouched: (value: boolean) => void; error: string; busy: boolean; dependencyError: boolean; onSubmit: (event: FormEvent) => void; onClose: () => void; onClearError: () => void }) {
  const account = accounts.find((item) => item.id === form.account_id);
  return <Modal title={editing ? "Chỉnh sửa giao dịch" : "Thêm giao dịch"} onClose={onClose} busy={busy}><form className="cf-form" onSubmit={onSubmit}>
    {error && <Alert onDismiss={onClearError}>{error}</Alert>}{dependencyError ? <Alert persistent>Không thể tải tài khoản hoặc danh mục. Đóng biểu mẫu và thử lại.</Alert> : !accounts.length ? <Alert kind="info">Bạn cần tạo tài khoản ở mục Ví & tài khoản trước khi ghi nhận giao dịch.</Alert> : null}
    <Field label="Loại giao dịch"><select className="cf-input" value={form.type} onChange={(event) => { setForm({ ...form, type: event.target.value, category_id: "" }); setCategoryTouched(false); }}><option value="EXPENSE">Chi tiêu</option><option value="INCOME">Thu nhập</option></select></Field>
    <Field label="Tài khoản"><select required className="cf-input" value={form.account_id} onChange={(event) => setForm({ ...form, account_id: event.target.value })}><option value="">Chọn tài khoản</option>{accounts.map((item) => <option value={item.id} key={item.id}>{item.name} · {money(item.balance, item.currency)}</option>)}</select></Field>
    <Field label="Danh mục"><select className="cf-input" value={form.category_id} onChange={(event) => { setForm({ ...form, category_id: event.target.value }); setCategoryTouched(true); setSuggestion(null); }}><option value="">Chưa phân loại</option>{categories.filter((item) => item.type === form.type).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{suggestion && <div className="cf-category-suggestion" role="status"><div><strong>Gợi ý: {suggestion.category_name}</strong><span>{Math.round(suggestion.confidence * 100)}% · {suggestion.reason}</span></div><button type="button" className="cf-btn cf-btn-sm" onClick={() => { setForm({ ...form, category_id: suggestion.category_id || "" }); setCategoryTouched(true); setSuggestion(null); }}>Chọn danh mục</button></div>}</Field>
    <div className="cf-form-grid"><Field label={`Số tiền (${account?.currency || "VND"})`}><input className="cf-input" required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field><Field label="Ngày giao dịch"><input className="cf-input" required type="date" value={form.transaction_date} onChange={(event) => setForm({ ...form, transaction_date: event.target.value })} /></Field></div>
    <Field label="Mô tả"><input className="cf-input" required maxLength={255} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
    <Field label="Ghi chú (tùy chọn)"><textarea className="cf-input" rows={2} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></Field>
    <div className="cf-form-actions"><button type="button" disabled={busy} className="cf-btn" onClick={onClose}>Hủy</button><button className="cf-btn cf-btn-primary" disabled={busy || !accounts.length || dependencyError}>{busy ? "Đang xử lý…" : "Lưu giao dịch"}</button></div>
  </form></Modal>;
}
