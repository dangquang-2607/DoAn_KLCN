/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: Giao dịch
 * NHÓM VỆ TINH: page.tsx (Điều phối)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối dữ liệu, trạng thái và hành vi của màn hình tương ứng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   TanStack Query, API client, state React và các component vệ tinh của phân hệ.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất page để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Validate tài khoản, tiền tệ và số tiền; mọi ghi/xóa phải làm mới các cache tài chính liên quan.
 * ============================================================================
 */
"use client";

/** Điều phối query, cache và nghiệp vụ sổ giao dịch; UI form/bảng nằm trong `_components`. */
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Plus } from "lucide-react";
import api from "@/lib/api";
import { Alert, PageHead, Panel } from "@/components/ui/ui";
import { TransferFlow } from "@/components/ui/Motion";
import { errorMessage, localDate, money, type Account, type Category, type Transaction } from "@/lib/finance";
import TransactionDeleteModal from "./_components/TransactionDeleteModal";
import TransactionFilters from "./_components/TransactionFilters";
import TransactionModal, { type CategorySuggestion, type TransactionForm } from "./_components/TransactionModal";
import TransactionTable from "./_components/TransactionTable";
import TransferModal from "./_components/TransferModal";

const fresh = (): TransactionForm => ({ account_id: "", category_id: "", type: "EXPENSE", amount: "", transaction_date: localDate(), description: "", note: "", to_account_id: "" });

export default function Transactions() {
  const cache = useQueryClient();
  const [receipt, setReceipt] = useState<{ from: string; to: string; amount: string } | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ type: "", account_id: "", category_id: "", start_date: "", end_date: "" });
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"" | "create" | "edit" | "transfer">("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [form, setForm] = useState<TransactionForm>(fresh);
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Đồng bộ query string một lần sau mount để hỗ trợ deep-link từ dashboard/tài khoản.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("new")) setMode("create");
    if (params.get("account_id")) setFilters((current) => ({ ...current, account_id: params.get("account_id") || "" }));
  }, []);

  useEffect(() => {
    if (mode !== "create" || editing || categoryTouched || form.category_id || form.description.trim().length < 2) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await api.post<CategorySuggestion>("/categories/suggest", { type: form.type, description: form.description.trim(), note: form.note || null });
        if (active) setSuggestion(data.category_id ? data : null);
      } catch { if (active) setSuggestion(null); }
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [mode, editing, categoryTouched, form.category_id, form.description, form.note, form.type]);

  const accounts = useQuery<Account[]>({ queryKey: ["accounts"], queryFn: async () => (await api.get("/accounts")).data });
  const categories = useQuery<Category[]>({ queryKey: ["categories"], queryFn: async () => (await api.get("/categories")).data });
  const query = useQuery<{ items: Transaction[]; total: number }>({
    queryKey: ["transactions", page, filters],
    queryFn: async () => (await api.get("/transactions", { params: { page, page_size: 15, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) } })).data,
  });
  const list = (query.data?.items || []).filter((transaction) => transaction.description?.toLocaleLowerCase().includes(search.toLocaleLowerCase()) || !search);
  const account = (id: string) => accounts.data?.find((item) => item.id === id);
  const category = (id: string | null) => categories.data?.find((item) => item.id === id);
  // Một thay đổi giao dịch tác động số dư, dashboard, ngân sách và báo cáo nên phải làm mới toàn bộ cache liên quan.
  const invalidate = () => Promise.all(["transactions", "accounts", "dashboard", "budgets", "analytics"].map((key) => cache.invalidateQueries({ queryKey: [key] })));

  // Chuẩn bị form riêng cho tạo mới, chỉnh sửa hoặc chuyển tiền trước khi mở modal.
  const open = (kind: "create" | "edit" | "transfer", transaction?: Transaction) => {
    setMode(kind); setEditing(transaction || null); setError(""); setSuggestion(null); setCategoryTouched(false);
    setForm(transaction ? { ...fresh(), account_id: transaction.account_id, category_id: transaction.category_id || "", type: transaction.type, amount: String(Math.abs(Number(transaction.amount))), transaction_date: transaction.transaction_date, description: transaction.description || "", note: transaction.note || "" } : { ...fresh(), account_id: accounts.data?.[0]?.id || "" });
  };

  // Validate hai ví và loại tiền khi chuyển; các luồng còn lại tạo hoặc cập nhật giao dịch thu/chi.
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true); setReceipt(null);
    try {
      if (mode === "transfer") {
        const from = account(form.account_id); const to = account(form.to_account_id);
        if (!from || !to || from.id === to.id) throw new Error("Chọn hai tài khoản khác nhau.");
        if (from.currency !== to.currency) throw new Error("Chỉ chuyển giữa các tài khoản cùng loại tiền tệ.");
        await api.post("/transactions/transfer", { from_account_id: form.account_id, to_account_id: form.to_account_id, amount: form.amount, transaction_date: form.transaction_date, note: form.note || null });
      } else {
        const payload = { account_id: form.account_id, category_id: form.category_id || null, type: form.type, amount: form.amount, transaction_date: form.transaction_date, description: form.description.trim(), note: form.note || null };
        if (editing) await api.patch("/transactions/" + editing.id, payload); else await api.post("/transactions", payload);
      }
      await invalidate();
      if (mode === "transfer") setReceipt({ from: account(form.account_id)?.name || "Ví nguồn", to: account(form.to_account_id)?.name || "Ví nhận", amount: money(form.amount) });
      setMode("");
      setNotice(mode === "transfer" ? "Đã chuyển tiền giữa hai tài khoản." : "Đã lưu giao dịch và cập nhật số dư.");
    } catch (caught) { setError(caught instanceof Error && !("response" in caught) ? caught.message : errorMessage(caught)); } finally { setBusy(false); }
  };

  // Xóa giao dịch qua backend để sổ cái hoàn số dư rồi đồng bộ lại toàn bộ màn liên quan.
  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setError("");
    try { await api.delete("/transactions/" + deleting.id); await invalidate(); setDeleting(null); setNotice("Đã xóa giao dịch và hoàn lại số dư."); }
    catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  // Đổi bộ lọc luôn đưa người dùng về trang đầu và xóa tìm kiếm cục bộ để tránh kết quả mâu thuẫn.
  const filter = (key: string, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); setSearch(""); };
  const dependencyError = accounts.isError || categories.isError;

  return <div className="cf-stack">
    <PageHead eyebrow="SỔ GIAO DỊCH" title="Giao dịch" description="Ghi nhận thu chi và theo dõi dòng tiền qua từng tài khoản." actions={<><button className="cf-btn" onClick={() => open("transfer")}><ArrowLeftRight />Chuyển tiền</button><button className="cf-btn cf-btn-primary" onClick={() => open("create")}><Plus />Thêm giao dịch</button></>} />
    {receipt && <TransferFlow {...receipt} confirmed onClose={() => setReceipt(null)} />}
    {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
    <Panel>
      <TransactionFilters filters={filters} search={search} page={page} list={list} accounts={accounts.data || []} categories={categories.data || []} onFilter={filter} onSearch={setSearch} getAccount={account} getCategory={category} />
      <TransactionTable query={query} list={list} page={page} total={query.data?.total || 0} getAccount={account} getCategory={category} onEdit={(transaction) => open("edit", transaction)} onDelete={(transaction) => { setDeleting(transaction); setError(""); }} onPageChange={setPage} />
    </Panel>
    {(mode === "create" || mode === "edit") && <TransactionModal editing={editing} accounts={accounts.data || []} categories={categories.data || []} form={form} setForm={setForm} suggestion={suggestion} setSuggestion={setSuggestion} setCategoryTouched={setCategoryTouched} error={error} busy={busy} dependencyError={dependencyError} onSubmit={submit} onClose={() => setMode("")} onClearError={() => setError("")} />}
    {mode === "transfer" && <TransferModal accounts={accounts.data || []} form={form} setForm={setForm} error={error} busy={busy} dependencyError={dependencyError} onSubmit={submit} onClose={() => setMode("")} onClearError={() => setError("")} />}
    {deleting && <TransactionDeleteModal transaction={deleting} currency={account(deleting.account_id)?.currency} error={error} busy={busy} onConfirm={remove} onClose={() => setDeleting(null)} onClearError={() => setError("")} />}
  </div>;
}
