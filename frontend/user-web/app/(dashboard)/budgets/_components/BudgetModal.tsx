/**
 * ============================================================================
 * TÊN FILE: BudgetModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Ngân sách
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp biểu mẫu tạo hoặc điều chỉnh ngân sách.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất BudgetModal để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Validate khoảng ngày và hạn mức; xóa ngân sách không được xóa giao dịch chi tiêu.
 * ============================================================================
 */
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Alert, Field, Modal } from "@/components/ui/ui";
import type { Budget, Category } from "@/lib/finance";

export type BudgetForm = { name: string; category_id: string; amount_limit: string; currency: string; period_type: string; start_date: string; end_date: string; warning_percent: string };

/** Biểu mẫu tạo/chỉnh sửa hạn mức; danh mục bị khóa sau khi ngân sách được tạo. */
export default function BudgetModal({ editing, categories, form, setForm, error, busy, onSubmit, onClose, onClearError }: { editing: Budget | null; categories: Category[]; form: BudgetForm; setForm: Dispatch<SetStateAction<BudgetForm>>; error: string; busy: boolean; onSubmit: (event: FormEvent) => void; onClose: () => void; onClearError: () => void }) {
  const update = (key: keyof BudgetForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <Modal title={editing ? "Điều chỉnh ngân sách" : "Tạo ngân sách"} onClose={onClose} busy={busy}><form className="cf-form" onSubmit={onSubmit}>
    {error && <Alert onDismiss={onClearError}>{error}</Alert>}
    <Field label="Tên ngân sách"><input className="cf-input" required maxLength={150} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Chi tiêu tháng này…" /></Field>
    <Field label="Danh mục" hint={editing ? "Danh mục được giữ nguyên sau khi tạo." : undefined}><select className="cf-input" disabled={!!editing} value={form.category_id} onChange={(e) => update("category_id", e.target.value)}><option value="">Tất cả danh mục</option>{categories.filter((c) => c.type === "EXPENSE").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
    <div className="cf-form-grid">
      <Field label="Hạn mức"><input className="cf-input" required type="number" min="0.01" step="0.01" value={form.amount_limit} onChange={(e) => update("amount_limit", e.target.value)} /></Field>
      <Field label="Tiền tệ"><select className="cf-input" value={form.currency} onChange={(e) => update("currency", e.target.value)}><option>VND</option></select></Field>
      <Field label="Từ ngày"><input className="cf-input" required type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} /></Field>
      <Field label="Đến ngày"><input className="cf-input" required type="date" min={form.start_date} value={form.end_date} onChange={(e) => update("end_date", e.target.value)} /></Field>
      <Field label="Kỳ ngân sách"><select className="cf-input" value={form.period_type} onChange={(e) => update("period_type", e.target.value)}><option value="MONTHLY">Hàng tháng</option><option value="WEEKLY">Hàng tuần</option><option value="YEARLY">Hàng năm</option><option value="CUSTOM">Tùy chỉnh</option></select></Field>
      <Field label="Ngưỡng cảnh báo (%)"><input className="cf-input" type="number" min="1" max="100" required value={form.warning_percent} onChange={(e) => update("warning_percent", e.target.value)} /></Field>
    </div>
    <div className="cf-form-actions"><button type="button" className="cf-btn" disabled={busy} onClick={onClose}>Hủy</button><button className="cf-btn cf-btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu ngân sách"}</button></div>
  </form></Modal>;
}
