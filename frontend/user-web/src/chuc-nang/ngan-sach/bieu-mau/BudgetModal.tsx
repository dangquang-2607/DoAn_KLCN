import density from "../CSS/budget-density.module.css";
import MoneyInput from "@/dung-chung/UI-chung/MoneyInput";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Alert, Field, Modal } from "@/dung-chung/UI-chung/ui";
import DateInput from "@/dung-chung/UI-chung/DateInput";
import { type Budget, type Category } from "@/dung-chung/nghiep-vu/finance";
import BudgetEditForm from "./BudgetEditForm";

export type BudgetForm = { name: string; category_id: string; amount_limit: string; currency: string; period_type: string; start_date: string; end_date: string; warning_percent: string; effective_from: "NEXT" | "CURRENT"; auto_renew: boolean };

/** Biểu mẫu tạo/chỉnh sửa hạn mức; danh mục bị khóa sau khi ngân sách được tạo. */
export default function BudgetModal({ editing, categories, form, setForm, error, busy, onSubmit, onClose, onClearError }: { editing: Budget | null; categories: Category[]; form: BudgetForm; setForm: Dispatch<SetStateAction<BudgetForm>>; error: string; busy: boolean; onSubmit: (event: FormEvent) => void; onClose: () => void; onClearError: () => void }) {
  const update = <K extends keyof BudgetForm>(key: K, value: BudgetForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  if (editing) return <BudgetEditForm {...{ editing, categories, form, setForm, error, busy, onSubmit, onClose, onClearError }} />;
  return (
    <Modal
      className={density.dialog}
      title="Tạo ngân sách"
      onClose={onClose}
      busy={busy}
    >
      <form className={density.form} onSubmit={onSubmit}>
        <div className={density.fields}>
          {error && <Alert persistent onDismiss={onClearError}>{error}</Alert>}
          <Field
            label="Tên ngân sách (tùy chọn)"
            hint="Để trống, hệ thống sẽ đặt tên theo danh mục và kỳ."
          >
            <input
              className="cf-input"
              maxLength={150}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Ví dụ: Ăn uống gia đình"
            />
          </Field>
          <Field
            label="Danh mục"
          >
            <select
              className="cf-input"
              value={form.category_id}
              onChange={(e) => update("category_id", e.target.value)}
            >
              <option value="">Tất cả danh mục</option>
              {categories
                .filter(
                  (c) =>
                    c.type === "EXPENSE" &&
                    c.is_active,
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!c.is_active ? " (đã ẩn)" : ""}
                  </option>
                ))}
            </select>
          </Field>
          <div className="cf-form-grid">
            <Field label="Hạn mức">
              <MoneyInput
                required
                min={0.01}
                currency={form.currency}
                value={form.amount_limit}
                onValueChange={(value) => update("amount_limit", value)}
              />
            </Field>
            <Field label="Tiền tệ">
              <select
                className="cf-input"
                value={form.currency}
                onChange={(e) => update("currency", e.target.value)}
              >
                <option value="VND">Đồng Việt Nam</option>
              </select>
            </Field>
            <Field
              label={
                form.period_type === "CUSTOM"
                  ? "Từ ngày"
                  : "Ngày bắt đầu áp dụng"
              }
              hint={
                form.period_type !== "CUSTOM"
                  ? "Kỳ đầu tính từ ngày này; các kỳ sau tự theo lịch."
                  : undefined
              }
            >
              <DateInput
                required
                value={form.start_date}
                onChange={(value) => update("start_date", value)}
              />
            </Field>
            {form.period_type === "CUSTOM" && (
              <Field label="Đến ngày">
                <DateInput
                  required
                  min={form.start_date}
                  value={form.end_date}
                  onChange={(value) => update("end_date", value)}
                />
              </Field>
            )}
            <Field
              label="Kỳ ngân sách"
              hint="Tuần: thứ Hai–Chủ nhật; tháng/năm theo lịch. Tùy chỉnh chỉ chạy một lần."
            >
              <select
                className="cf-input"
                value={form.period_type}
                onChange={(e) => update("period_type", e.target.value)}
              >
                <option value="MONTHLY">Hàng tháng</option>
                <option value="WEEKLY">Hàng tuần</option>
                <option value="YEARLY">Hàng năm</option>
                <option value="CUSTOM">Tùy chỉnh</option>
              </select>
            </Field>
            <Field label="Ngưỡng cảnh báo (%)">
              <input
                className="cf-input"
                type="number"
                min="1"
                max="100"
                required
                value={form.warning_percent}
                onChange={(e) => update("warning_percent", e.target.value)}
              />
            </Field>
          </div>
        </div>
        <div className={density.footer}>
          <button type="button" className="cf-btn" disabled={busy} onClick={onClose} > Hủy </button>
          <button className="cf-btn cf-btn-primary" disabled={busy}> {busy ? "Đang lưu…" : "Lưu ngân sách"} </button>
        </div>
      </form>
    </Modal>
  );
}
