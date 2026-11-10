import { useId, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { ArrowRight, BellRing, CalendarDays, Check, Clock3, LockKeyhole, Zap } from "lucide-react";
import { Alert, Field, Modal } from "@/dung-chung/UI-chung/ui";
import MoneyInput from "@/dung-chung/UI-chung/MoneyInput";
import DateInput from "@/dung-chung/UI-chung/DateInput";
import { dateLabel, localDate, money, percent } from "@/dung-chung/tien-ich/finance";
import { canonicalDecimal } from "@/dung-chung/tien-ich/decimal";
import type { Budget, Category } from "@/dung-chung/nghiep-vu/finance";
import type { BudgetForm } from "./BudgetModal";
import styles from "../CSS/BudgetEditForm.module.css";
import density from "../CSS/budget-density.module.css";

type Props = {
  editing: Budget; categories: Category[]; form: BudgetForm;
  setForm: Dispatch<SetStateAction<BudgetForm>>;
  error: string; busy: boolean; onSubmit: (event: FormEvent) => void;
  onClose: () => void; onClearError: () => void;
};
const periods: Record<string, string> = { WEEKLY: "Hàng tuần", MONTHLY: "Hàng tháng", YEARLY: "Hàng năm", CUSTOM: "Một lần" };

export default function BudgetEditForm({ editing, categories, form, setForm, error, busy, onSubmit, onClose, onClearError }: Props) {
  const id = useId();
  const update = <K extends keyof BudgetForm>(key: K, value: BudgetForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const withTiming = (draft: BudgetForm, timing: BudgetForm["effective_from"]): BudgetForm => {
    if (draft.effective_from === timing) return draft;
    const previousNext = draft.effective_from === "NEXT";
    const next = timing === "NEXT";
    return {
      ...draft,
      name: draft.name === (previousNext ? editing.configured_name : editing.budget_name)
        ? (next ? editing.configured_name : editing.budget_name) : draft.name,
      amount_limit: canonicalDecimal(draft.amount_limit) === canonicalDecimal(previousNext ? editing.configured_amount_limit : editing.amount_limit)
        ? String(next ? editing.configured_amount_limit : editing.amount_limit) : draft.amount_limit,
      warning_percent: canonicalDecimal(draft.warning_percent) === canonicalDecimal(previousNext ? editing.configured_warning_percent : editing.warning_percent)
        ? String(next ? editing.configured_warning_percent : editing.warning_percent) : draft.warning_percent,
      effective_from: timing,
    };
  };
  const next = editing.is_recurring && form.effective_from === "NEXT";
  const dateRangeChanged = !editing.is_recurring && (form.start_date !== editing.start_date || form.end_date !== editing.end_date);
  const nextDate = new Date(`${editing.end_date}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const nextStart = localDate(nextDate);
  const nextUnavailable = !form.auto_renew || editing.end_date === "9999-12-31";
  const limit = Number(next ? editing.amount_limit : form.amount_limit);
  const warning = Number(next ? editing.warning_percent : form.warning_percent);
  const spent = Number(editing.spent_amount);
  const valid = Number.isFinite(limit) && limit > 0 && Number.isFinite(warning) && warning > 0 && warning <= 100;
  const usage = valid ? spent / limit * 100 : 0;
  const reached = valid && usage >= warning;
  const exceeded = valid && usage > 100;
  const current = editing.period_state === "CURRENT";
  const draftValid = Number(form.amount_limit) > 0 && Number(form.warning_percent) > 0 && Number(form.warning_percent) <= 100;
  const category = categories.find((item) => item.id === editing.category_id)?.name || "Tất cả danh mục";

  return (
    <Modal title="Chỉnh sửa ngân sách" onClose={onClose} busy={busy} className={`${styles.editDialog} ${density.dialog}`}>
      <form onSubmit={onSubmit} className={density.form}>
        <div className={density.fields}>
          {error && <Alert persistent onDismiss={onClearError}>{error}</Alert>}
          <div className={styles.identity}>
          <div className={styles.context}>
            <span><LockKeyhole size={14} aria-hidden="true" />{category}</span>
            <span><CalendarDays size={14} aria-hidden="true" />{periods[editing.period_type]}</span>
            <span>Từ {dateLabel(editing.applies_from)}</span>
          </div>
          <Field label="Tên ngân sách">
            <input className="cf-input" value={form.name} maxLength={150} disabled={busy}
              placeholder={editing.budget_name} onChange={(event) => update("name", event.target.value)} />
          </Field>
          </div>

          {editing.is_recurring && <>
            <label className={styles.renewal} htmlFor={`${id}-renewal`}>
              <span><strong>Tự chuyển kỳ</strong><span id={`${id}-renewal-hint`}>
                {form.auto_renew ? "Tiếp tục ngân sách khi sang kỳ mới." : `Kết thúc sau ngày ${dateLabel(editing.end_date)}.`}
              </span></span>
              <input id={`${id}-renewal`} className="cf-switch-input" type="checkbox" role="switch"
                aria-label="Tự chuyển kỳ" aria-describedby={`${id}-renewal-hint`} checked={form.auto_renew} disabled={busy}
                onChange={(event) => {
                  const enabled = event.currentTarget.checked;
                  setForm((draft) => ({ ...(enabled ? draft : withTiming(draft, "CURRENT")), auto_renew: enabled }));
                }} />
            </label>
            <fieldset className={styles.timing} disabled={busy}>
              <legend>Áp dụng thay đổi khi nào?</legend>
              <div className={styles.choices}>
                {([
                  ["CURRENT", "Áp dụng ngay", "Tính lại kỳ đang xem", Zap],
                  ["NEXT", "Từ kỳ tiếp theo", nextUnavailable ? "Không còn kỳ tiếp theo" : `Bắt đầu ${dateLabel(nextStart)}`, Clock3],
                ] as const).map(([value, title, subtitle, Icon]) => (
                  <label key={value} className={`${styles.choice} ${form.effective_from === value ? styles.selected : ""}`}>
                    <input type="radio" name={`${id}-timing`} value={value} checked={form.effective_from === value} disabled={value === "NEXT" && nextUnavailable}
                      onChange={() => setForm((draft) => withTiming(draft, value))} />
                    <Icon size={20} aria-hidden="true" />
                    <span><strong>{title}</strong><span>{subtitle}</span></span>
                    {form.effective_from === value && <Check size={17} aria-hidden="true" className={styles.check} />}
                  </label>
                ))}
              </div>
            </fieldset>
          </>}

          <div className={styles.editor}>
          <div className={styles.controls}>
          <div className={styles.settings}>
            <Field label="Hạn mức mỗi kỳ">
              <MoneyInput className={`cf-input ${density.moneyInput}`} required min={0.01} disabled={busy} value={form.amount_limit} currency={form.currency}
                onValueChange={(value) => update("amount_limit", value)} />
            </Field>
            <Field label="Cảnh báo khi chi đến (%)">
              <input className="cf-input" type="number" min="0.01" max="100" step="0.01" required
                disabled={busy} value={form.warning_percent} onChange={(event) => update("warning_percent", event.target.value)} />
            </Field>
          </div>
          <div className={styles.threshold}>
            <input type="range" min="1" max="100" step="1" aria-label="Điều chỉnh ngưỡng cảnh báo"
              disabled={busy} value={Math.min(100, Math.max(1, Number(form.warning_percent) || 1))}
              onChange={(event) => update("warning_percent", event.target.value)} />
            <div className={styles.thresholdBottom}>
              <span><BellRing size={16} aria-hidden="true" />{draftValid ? `Cảnh báo từ ${money(Number(form.amount_limit) * Number(form.warning_percent) / 100, form.currency)}` : "Nhập hạn mức và ngưỡng cảnh báo"}</span>
              <div className={styles.presets} aria-label="Ngưỡng gợi ý">
                {[50, 80, 90].map((value) => <button key={value} type="button" disabled={busy}
                  aria-pressed={Number(form.warning_percent) === value} onClick={() => update("warning_percent", String(value))}>{value}%</button>)}
              </div>
            </div>
          </div>
          </div>
          {dateRangeChanged ? (
            <section className={styles.preview} aria-label="Xem trước ngân sách sau khi lưu">
              <CalendarDays size={24} aria-hidden="true" />
              <strong>Khoảng ngày đã thay đổi</strong>
              <span>{dateLabel(form.start_date)} – {dateLabel(form.end_date)}</span>
              <span>Chi tiêu và cảnh báo sẽ được tính lại theo khoảng ngày mới khi lưu.</span>
            </section>
          ) : <section className={`${styles.preview} ${reached ? exceeded ? styles.dangerNotice : styles.warning : ""}`} aria-label="Xem trước ngân sách sau khi lưu">
            <div className={styles.previewHead}>
              <strong>{next ? "Kỳ này giữ nguyên" : "Kỳ đang xem sau khi lưu"}</strong>
              <span className={styles.status}>{!valid ? "Chưa đủ thông tin" : exceeded ? "Vượt hạn mức" : reached ? "Đạt ngưỡng cảnh báo" : "Dưới ngưỡng cảnh báo"}</span>
            </div>
            <div className={styles.amount}><strong>{money(spent, editing.currency)}</strong><span>/ {valid ? money(limit, form.currency) : "—"}</span></div>
            <div className={styles.trackWrap}>
              <div className={styles.track} role="progressbar" aria-label="Tỷ lệ chi tiêu"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, usage))}
                aria-valuetext={valid ? `Đã dùng ${percent(usage)}%, ngưỡng cảnh báo ${percent(warning, 2)}%` : "Chưa đủ thông tin"}>
                <span className={styles.fill} style={{ width: `${Math.min(100, Math.max(0, usage))}%` }} />
              </div>
              {valid && <span className={styles.marker} style={{ left: `${percent(warning, 2)}%` }} title={`Ngưỡng cảnh báo ${percent(warning, 2)}%`} />}
            </div>
            <div className={styles.legend}><span>Đã dùng <strong>{valid ? `${percent(usage)}%` : "—"}</strong></span><span><i />Vạch cảnh báo <strong>{valid ? `${percent(warning, 2)}%` : "—"}</strong></span></div>
            {next ? (
              <div className={styles.outcome}><Clock3 size={18} aria-hidden="true" /><div>
                <strong>Từ {dateLabel(nextStart)}</strong>
                <span>{draftValid ? `${money(form.amount_limit, form.currency)} / kỳ · Cảnh báo ${percent(form.warning_percent, 2)}%` : "Nhập cấu hình cho kỳ tiếp theo."}</span>
              </div></div>
            ) : (
              <div className={styles.outcome}><BellRing size={18} aria-hidden="true" /><div>
                <strong>{!current ? "Ngân sách chưa hoạt động hoặc đã kết thúc" : !valid ? "Nhập cấu hình để xem trước" : reached ? "Chi tiêu đã đạt ngưỡng mới" : "Chưa cần cảnh báo"}</strong>
                <span>{!current ? "Chỉ ngân sách đang hoạt động mới phát thông báo." : reached ? "Lưu để áp dụng cảnh báo. Mỗi ngưỡng chỉ thông báo một lần trong kỳ." : valid ? `Còn ${money(Math.max(0, limit * warning / 100 - spent), form.currency)} đến ngưỡng cảnh báo.` : ""}</span>
              </div></div>
            )}
          </section>}
          </div>

          {!editing.is_recurring && <details className={styles.dates} open>
            <summary><CalendarDays size={17} aria-hidden="true" />Khoảng thời gian<span>{dateLabel(form.start_date)} – {dateLabel(form.end_date)}</span></summary>
            <div className={styles.dateFields}>
                <Field label="Từ ngày"><DateInput required disabled={busy} value={form.start_date} onChange={(value) => update("start_date", value)} /></Field>
                <Field label="Đến ngày"><DateInput required disabled={busy} min={form.start_date} value={form.end_date} onChange={(value) => update("end_date", value)} /></Field>
            </div>
          </details>}
        </div>
        <div className={density.footer}>
          <button type="button" className="cf-btn" disabled={busy} onClick={onClose}>Hủy</button>
          <button type="submit" className="cf-btn cf-btn-primary" disabled={busy}>
            {busy ? "Đang lưu…" : next ? "Lưu cho kỳ tiếp theo" : "Lưu và áp dụng ngay"}<ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </form>
    </Modal>
  );
}
