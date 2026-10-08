/**
 * ============================================================================
 * TÊN FILE: BudgetModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Ngân sách
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
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
import { Alert, Field, Modal } from "@/dung-chung/UI-chung/ui";
import DateInput from "@/dung-chung/UI-chung/DateInput";
import { localDate } from "@/dung-chung/tien-ich/finance";
import { type Budget, type Category } from "@/dung-chung/nghiep-vu/finance";

export type BudgetForm = { name: string; category_id: string; amount_limit: string; currency: string; period_type: string; start_date: string; end_date: string; recurrence_end_date: string; warning_percent: string; effective_from: "NEXT" | "CURRENT" };

/** Biểu mẫu tạo/chỉnh sửa hạn mức; danh mục bị khóa sau khi ngân sách được tạo. */
export default function BudgetModal({ editing, categories, form, setForm, error, busy, onSubmit, onClose, onClearError }: { editing: Budget | null; categories: Category[]; form: BudgetForm; setForm: Dispatch<SetStateAction<BudgetForm>>; error: string; busy: boolean; onSubmit: (event: FormEvent) => void; onClose: () => void; onClearError: () => void }) {
  const update = (key: keyof BudgetForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <Modal title={editing ? "Điều chỉnh ngân sách" : "Tạo ngân sách"} onClose={onClose} busy={busy}><form className="cf-form" onSubmit={onSubmit}>
    {error && <Alert onDismiss={onClearError}>{error}</Alert>}
    <Field label="Tên ngân sách (tùy chọn)" hint="Để trống, hệ thống sẽ đặt tên theo danh mục và kỳ."><input className="cf-input" maxLength={150} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ví dụ: Ăn uống gia đình" /></Field>
    <Field label="Danh mục" hint={editing ? "Danh mục được giữ nguyên sau khi tạo." : undefined}><select className="cf-input" disabled={!!editing} value={form.category_id} onChange={(e) => update("category_id", e.target.value)}><option value="">Tất cả danh mục</option>{categories.filter((c) => c.type === "EXPENSE" && (c.is_active || (editing && c.id === form.category_id))).map((c) => <option key={c.id} value={c.id}>{c.name}{!c.is_active ? " (đã ẩn)" : ""}</option>)}</select></Field>
    <div className="cf-form-grid">
      <Field label="Hạn mức"><input className="cf-input" required type="number" min="0.01" step="0.01" value={form.amount_limit} onChange={(e) => update("amount_limit", e.target.value)} /></Field>
      <Field label="Tiền tệ"><select className="cf-input" value={form.currency} onChange={(e) => update("currency", e.target.value)}><option>VND</option></select></Field>
      <Field label={form.period_type === "CUSTOM" || (editing && !editing.is_recurring) ? "Từ ngày" : "Ngày bắt đầu áp dụng"} hint={!editing && form.period_type !== "CUSTOM" ? "Kỳ đầu tính từ ngày này; các kỳ sau tự theo lịch." : undefined}><DateInput required disabled={!!editing?.is_recurring} value={form.start_date} onChange={(value) => update("start_date", value)} /></Field>
      {(form.period_type === "CUSTOM" || (editing && !editing.is_recurring)) ? <Field label="Đến ngày"><DateInput required min={form.start_date} value={form.end_date} onChange={(value) => update("end_date", value)} /></Field> : <Field label="Ngày kết thúc áp dụng (tùy chọn)" hint="Để trống để tiếp tục cho đến khi bạn kết thúc ngân sách."><DateInput min={editing?.is_recurring ? localDate(new Date()) : form.start_date} value={form.recurrence_end_date} onChange={(value) => update("recurrence_end_date", value)} /></Field>}
      <Field label="Kỳ ngân sách" hint="Tuần: thứ Hai–Chủ nhật; tháng/năm theo lịch. Tùy chỉnh chỉ chạy một lần."><select className="cf-input" disabled={!!editing} value={form.period_type} onChange={(e) => update("period_type", e.target.value)}><option value="MONTHLY">Hàng tháng</option><option value="WEEKLY">Hàng tuần</option><option value="YEARLY">Hàng năm</option><option value="CUSTOM">Tùy chỉnh</option></select></Field>
      <Field label="Ngưỡng cảnh báo (%)"><input className="cf-input" type="number" min="1" max="100" required value={form.warning_percent} onChange={(e) => update("warning_percent", e.target.value)} /></Field>
    </div>
    {editing?.is_recurring && <Field label="Áp dụng thay đổi tên, hạn mức và cảnh báo"><select className="cf-input" value={form.effective_from} onChange={(e) => update("effective_from", e.target.value as "NEXT" | "CURRENT")}><option value="NEXT">Từ kỳ tiếp theo (giữ nguyên kỳ hiện tại)</option><option value="CURRENT">Ngay trong kỳ hiện tại</option></select></Field>}
    {editing?.is_recurring && <p className="cf-muted" style={{ fontSize: 13, margin: 0 }}>Danh mục, kỳ và ngày bắt đầu áp dụng được giữ nguyên để lịch sử không bị thay đổi.</p>}
    <div className="cf-form-actions"><button type="button" className="cf-btn" disabled={busy} onClick={onClose}>Hủy</button><button className="cf-btn cf-btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu ngân sách"}</button></div>
  </form></Modal>;
}
