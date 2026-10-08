/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: Ngân sách
 * NHÓM VỆ TINH: page.tsx (Điều phối)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối dữ liệu, trạng thái và hành vi của màn hình tương ứng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   TanStack Query, API client, state React và các component vệ tinh của phân hệ.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất page để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Validate khoảng ngày và hạn mức; xóa ngân sách không được xóa giao dịch chi tiêu.
 * ============================================================================
 */
"use client";

/** Điều phối CRUD ngân sách; phần thẻ và modal nằm trong `thanh-phan`. */
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, Empty, ErrorState, Loading, PageHead, Panel, Stat } from "@/dung-chung/UI-chung/ui";
import { errorMessage, localDate } from "@/dung-chung/tien-ich/finance";
import { type Budget, type Category } from "@/dung-chung/nghiep-vu/finance";
import { filterBudgetHistoryByMonth } from "@/chuc-nang/ngan-sach/xu-ly/budget-history";
import BudgetWorkspace from "./thanh-phan/BudgetWorkspace";
import BudgetDeleteModal from "./thanh-phan/BudgetDeleteModal";
import BudgetModal, { type BudgetForm } from "./thanh-phan/BudgetModal";
import styles from "./CSS/budget-history.module.css";

const fresh = (): BudgetForm => ({ name: "", category_id: "", amount_limit: "", currency: "VND", period_type: "MONTHLY", start_date: localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), end_date: localDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)), recurrence_end_date: "", warning_percent: "80", effective_from: "NEXT" });

export default function Budgets() {
  const cache = useQueryClient();
  const query = useQuery<Budget[]>({ queryKey: ["budgets"], queryFn: async () => (await api.get("/budgets")).data, refetchInterval: 60_000 });
  const categories = useQuery<Category[]>({ queryKey: ["categories", "all"], queryFn: async () => (await api.get("/categories", { params: { status: "all" } })).data });
  const [section, setSection] = useState<"current" | "history">("current");
  const [historyYear, setHistoryYear] = useState(() => Number(localDate().slice(0, 4)));
  const [historyMonth, setHistoryMonth] = useState(0);
  const history = useQuery<Budget[]>({ queryKey: ["budgets", "history", historyYear], queryFn: async () => (await api.get("/budgets/history", { params: { year: historyYear } })).data, enabled: section === "history" });
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [ending, setEnding] = useState<Budget | null>(null);
  const [form, setForm] = useState<BudgetForm>(fresh);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  // Khởi tạo khoảng thời gian theo tháng hiện tại hoặc nạp ngân sách cần chỉnh sửa.
  const open = (budget?: Budget) => {
    setEditing(budget || null); setError("");
    setForm(budget ? { name: budget.configured_name, category_id: budget.category_id || "", amount_limit: String(budget.configured_amount_limit), currency: budget.currency, period_type: budget.period_type, start_date: budget.applies_from, end_date: budget.end_date, recurrence_end_date: budget.recurrence_end_date || "", warning_percent: String(budget.configured_warning_percent), effective_from: "NEXT" } : fresh());
    setShow(true);
  };
  const reuse = (budget: Budget) => {
    const category = categories.data?.find((item) => item.id === budget.category_id && item.is_active);
    const defaults = fresh();
    let startDate = defaults.start_date;
    if (budget.is_recurring && budget.recurrence_end_date && budget.recurrence_end_date >= startDate) {
      const afterEnd = new Date(`${budget.recurrence_end_date}T12:00:00`);
      afterEnd.setDate(afterEnd.getDate() + 1);
      startDate = localDate(afterEnd);
    }
    setEditing(null); setError("");
    setForm({ ...defaults, start_date: startDate, name: budget.budget_name, category_id: category?.id || "",
      amount_limit: String(budget.amount_limit), warning_percent: String(budget.warning_percent),
      period_type: budget.period_type });
    setShow(true);
  };
  // Làm mới duy nhất cache ngân sách sau khi backend hoàn tất thao tác ghi.
  const refresh = () => cache.invalidateQueries({ queryKey: ["budgets"] });
  // Chặn khoảng ngày ngược; khi sửa không cho đổi danh mục đã gắn từ lúc tạo.
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (((editing && !editing.is_recurring) || (!editing && form.period_type === "CUSTOM")) && form.end_date < form.start_date || (form.recurrence_end_date && form.recurrence_end_date < form.start_date)) return setError("Ngày kết thúc phải từ ngày bắt đầu trở đi.");
    setBusy(true); setError("");
    try {
      if (editing?.is_recurring) await api.patch("/budgets/" + editing.budget_id, {
        ...(form.name.trim() && form.name.trim() !== (form.effective_from === "CURRENT" ? editing.budget_name : editing.configured_name) ? { name: form.name.trim() } : {}),
        ...(Number(form.amount_limit) !== Number(form.effective_from === "CURRENT" ? editing.amount_limit : editing.configured_amount_limit) ? { amount_limit: form.amount_limit } : {}),
        ...(Number(form.warning_percent) !== Number(form.effective_from === "CURRENT" ? editing.warning_percent : editing.configured_warning_percent) ? { warning_percent: form.warning_percent } : {}),
        recurrence_end_date: form.recurrence_end_date || null, effective_from: form.effective_from,
      });
      else if (editing) await api.patch("/budgets/" + editing.budget_id, {
        name: form.name.trim() || editing.budget_name, amount_limit: form.amount_limit,
        currency: form.currency, period_type: form.period_type, start_date: form.start_date,
        end_date: form.end_date, warning_percent: form.warning_percent,
      });
      else await api.post("/budgets", {
        name: form.name.trim() || null, category_id: form.category_id || null,
        amount_limit: form.amount_limit, currency: form.currency, period_type: form.period_type,
        start_date: form.start_date, end_date: form.period_type === "CUSTOM" ? form.end_date : null,
        is_recurring: form.period_type !== "CUSTOM",
        recurrence_end_date: form.period_type === "CUSTOM" ? null : form.recurrence_end_date || null,
        warning_percent: form.warning_percent,
      });
      await refresh(); setShow(false); setNotice("Đã lưu ngân sách.");
    } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  // Xóa cấu hình theo dõi ngân sách nhưng giữ nguyên mọi giao dịch chi tiêu.
  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setError("");
    try { await api.delete("/budgets/" + deleting.budget_id); await refresh(); setDeleting(null); setNotice("Đã xóa ngân sách. Giao dịch chi tiêu được giữ lại."); }
    catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  const end = async () => {
    if (!ending) return;
    setBusy(true); setError("");
    try {
      await api.patch("/budgets/" + ending.budget_id, { recurrence_end_date: localDate(new Date()), is_active: false });
      await refresh(); setEnding(null); setNotice("Ngân sách kết thúc sau hôm nay. Kỳ hiện tại và các kỳ cũ có trong lịch sử.");
    } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  const toggle = async (budget: Budget) => {
    const nextState = !budget.configured_is_active;
    try { await api.patch("/budgets/" + budget.budget_id, { is_active: nextState }); await refresh(); setNotice(budget.next_state_date ? "Đã hủy lịch đổi trạng thái ngân sách." : nextState ? "Ngân sách sẽ tiếp tục từ ngày mai." : "Ngân sách sẽ tạm dừng từ ngày mai."); }
    catch (caught) { setError(errorMessage(caught)); }
  };
  const list = query.data || [];
  const active = list.filter((budget) => budget.period_state === "CURRENT");
  const alerts = active.filter((budget) => budget.progress_status !== "SAFE");
  const historyItems = filterBudgetHistoryByMonth(history.data || [], historyMonth);
  const currentYear = Number(localDate().slice(0, 4));
  return <div className="cf-stack">
    <PageHead eyebrow="KẾ HOẠCH CHI TIÊU" title="Ngân sách" description="Đặt hạn mức, theo dõi tiến độ và điều chỉnh kế hoạch của bạn." actions={<button className="cf-btn cf-btn-primary" onClick={() => open()}><Plus />Tạo ngân sách</button>} />
    {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
    {error && !show && !deleting && !ending && <Alert onDismiss={() => setError("")}>{error}</Alert>}
    <div className="cf-row" style={{ gap: 8 }}><button className={`cf-btn ${section === "current" ? "cf-btn-primary" : ""}`} onClick={() => setSection("current")}>Kỳ hiện tại</button><button className={`cf-btn ${section === "history" ? "cf-btn-primary" : ""}`} onClick={() => setSection("history")}>Lịch sử ngân sách</button></div>
    {section === "current" ? <>
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : <>
      <div className="cf-grid"><Stat label="Ngân sách đang bật" value={active.length} note="Trong kỳ hiện tại" /><Stat label="Cần chú ý" value={alerts.length} note="Gần hoặc đã vượt hạn mức" /><Stat label="Trong hạn mức" value={active.filter((budget) => budget.progress_status === "SAFE").length} note="Chi tiêu dưới ngưỡng cảnh báo" /></div>
      {!list.length ? <Panel><Empty title="Chủ động cho từng khoản chi" description="Tạo ngân sách theo nhu cầu; kỳ tiếp theo sẽ được tính tự động." action={<button className="cf-btn cf-btn-primary" onClick={() => open()}>Thiết lập ngân sách</button>} /></Panel> : <BudgetWorkspace key="current" budgets={list} categories={categories.data || []} onEdit={open} onToggle={toggle} onEnd={(budget) => { setEnding(budget); setError(""); }} onDelete={(budget) => { setDeleting(budget); setError(""); }} />}
    </>}
    </> : <>
      <div className={styles.toolbar} role="group" aria-label="Lọc lịch sử ngân sách theo năm và tháng">
        <div className={styles.yearNav}>
          <button type="button" className={styles.iconButton} title="Năm trước" aria-label="Năm trước" disabled={historyYear <= 1900} onClick={() => setHistoryYear((year) => year - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <strong aria-label={`Năm ${historyYear}`}>{historyYear}</strong>
          <button type="button" className={styles.iconButton} title="Năm sau" aria-label="Năm sau" disabled={historyYear >= currentYear} onClick={() => setHistoryYear((year) => year + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
        <span className={styles.divider} aria-hidden="true" />
        <label className={styles.monthField} htmlFor="budget-history-month">
          <CalendarDays size={17} aria-hidden="true" />
          <span className={styles.visuallyHidden}>Tháng trong năm</span>
          <select id="budget-history-month" value={historyMonth} onChange={(event) => setHistoryMonth(Number(event.target.value))}><option value={0}>Tất cả tháng</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}</select>
          <ChevronDown size={15} aria-hidden="true" />
        </label>
      </div>
      {!history.isPending && !history.isError && <p className={styles.resultNote} aria-live="polite">{historyMonth === 0 ? `Năm ${historyYear}` : `Tháng ${historyMonth}/${historyYear}`} · {historyItems.length} kỳ đã kết thúc</p>}
      {history.isPending ? <Loading /> : history.isError ? <ErrorState retry={() => history.refetch()} /> : !historyItems.length ? <Panel><Empty title={historyMonth === 0 ? "Chưa có kỳ ngân sách đã kết thúc" : `Chưa có kỳ ngân sách trong tháng ${historyMonth}/${historyYear}`} description={historyMonth === 0 ? "Các kỳ cũ sẽ xuất hiện ở đây khi bước sang kỳ mới." : "Hãy chọn tháng khác hoặc xem tất cả tháng trong năm."} /></Panel> : <BudgetWorkspace key={`history:${historyYear}:${historyMonth}`} budgets={historyItems} categories={categories.data || []} onReuse={reuse} history />}
    </>}
    {show && <BudgetModal editing={editing} categories={categories.data || []} form={form} setForm={setForm} error={error} busy={busy} onSubmit={save} onClose={() => setShow(false)} onClearError={() => setError("")} />}
    {deleting && <BudgetDeleteModal budget={deleting} error={error} busy={busy} onConfirm={remove} onClose={() => setDeleting(null)} onClearError={() => setError("")} />}
    {ending && <BudgetDeleteModal budget={ending} mode="end" error={error} busy={busy} onConfirm={end} onClose={() => setEnding(null)} onClearError={() => setError("")} />}
  </div>;
}
