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

/** Điều phối CRUD ngân sách; phần thẻ và modal nằm trong `_components`. */
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import api from "@/lib/api";
import { Alert, Empty, ErrorState, Loading, PageHead, Panel, Stat } from "@/components/ui/ui";
import { errorMessage, localDate, type Budget, type Category } from "@/lib/finance";
import BudgetCard from "./_components/BudgetCard";
import BudgetDeleteModal from "./_components/BudgetDeleteModal";
import BudgetModal, { type BudgetForm } from "./_components/BudgetModal";

const fresh = (): BudgetForm => ({ name: "", category_id: "", amount_limit: "", currency: "VND", period_type: "MONTHLY", start_date: localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), end_date: localDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)), warning_percent: "80" });

export default function Budgets() {
  const cache = useQueryClient();
  const query = useQuery<Budget[]>({ queryKey: ["budgets"], queryFn: async () => (await api.get("/budgets")).data });
  const categories = useQuery<Category[]>({ queryKey: ["categories"], queryFn: async () => (await api.get("/categories")).data });
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const [form, setForm] = useState<BudgetForm>(fresh);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  // Khởi tạo khoảng thời gian theo tháng hiện tại hoặc nạp ngân sách cần chỉnh sửa.
  const open = (budget?: Budget) => {
    setEditing(budget || null); setError("");
    setForm(budget ? { name: budget.budget_name, category_id: budget.category_id || "", amount_limit: String(budget.amount_limit), currency: budget.currency, period_type: budget.period_type, start_date: budget.start_date, end_date: budget.end_date, warning_percent: String(budget.warning_percent) } : fresh());
    setShow(true);
  };
  // Làm mới duy nhất cache ngân sách sau khi backend hoàn tất thao tác ghi.
  const refresh = () => cache.invalidateQueries({ queryKey: ["budgets"] });
  // Chặn khoảng ngày ngược; khi sửa không cho đổi danh mục đã gắn từ lúc tạo.
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (form.end_date < form.start_date) return setError("Ngày kết thúc phải từ ngày bắt đầu trở đi.");
    setBusy(true); setError("");
    try {
      const payload = { ...form, name: form.name.trim(), category_id: form.category_id || null };
      if (editing) await api.patch("/budgets/" + editing.budget_id, Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "category_id")));
      else await api.post("/budgets", payload);
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
  const list = query.data || [];
  const active = list.filter((budget) => budget.is_active);
  const alerts = active.filter((budget) => budget.progress_status !== "SAFE");
  return <div className="cf-stack">
    <PageHead eyebrow="KẾ HOẠCH CHI TIÊU" title="Ngân sách" description="Đặt hạn mức, theo dõi tiến độ và điều chỉnh kế hoạch của bạn." actions={<button className="cf-btn cf-btn-primary" onClick={() => open()}><Plus />Tạo ngân sách</button>} />
    {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
    {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : <>
      <div className="cf-grid"><Stat label="Ngân sách đang bật" value={active.length} note="Theo tất cả các kỳ đã thiết lập" /><Stat label="Cần chú ý" value={alerts.length} note="Gần hoặc đã vượt hạn mức" /><Stat label="Trong hạn mức" value={active.filter((budget) => budget.progress_status === "SAFE").length} note="Chi tiêu dưới ngưỡng cảnh báo" /></div>
      {!list.length ? <Panel><Empty title="Chủ động cho từng khoản chi" description="Tạo ngân sách đầu tiên và chọn thời gian bạn muốn theo dõi." action={<button className="cf-btn cf-btn-primary" onClick={() => open()}>Thiết lập ngân sách</button>} /></Panel> : <div className="cf-grid-2">{list.map((budget) => <BudgetCard key={budget.budget_id} budget={budget} category={categories.data?.find((category) => category.id === budget.category_id)} onEdit={() => open(budget)} onDelete={() => { setDeleting(budget); setError(""); }} />)}</div>}
    </>}
    {show && <BudgetModal editing={editing} categories={categories.data || []} form={form} setForm={setForm} error={error} busy={busy} onSubmit={save} onClose={() => setShow(false)} onClearError={() => setError("")} />}
    {deleting && <BudgetDeleteModal budget={deleting} error={error} busy={busy} onConfirm={remove} onClose={() => setDeleting(null)} onClearError={() => setError("")} />}
  </div>;
}
