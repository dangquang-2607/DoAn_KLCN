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

/** Điều phối query, cache và nghiệp vụ sổ giao dịch; UI form/bảng nằm trong `thanh-phan`. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, PageHead, Panel } from "@/dung-chung/UI-chung/ui";
import { errorMessage, exportFinanceExcel, localDate } from "@/dung-chung/tien-ich/finance";
import { type Account, type Category, type Transaction } from "@/dung-chung/nghiep-vu/finance";
import TransactionDeleteModal from "./thanh-phan/TransactionDeleteModal";
import TransactionFilters from "./thanh-phan/TransactionFilters";
import TransactionModal, { type CategorySuggestion, type TransactionForm } from "./thanh-phan/TransactionModal";
import TransactionTable from "./thanh-phan/TransactionTable";

const fresh = (): TransactionForm => ({ account_id: "", category_id: "", type: "EXPENSE", amount: "", transaction_date: localDate(), description: "", note: "", to_account_id: "" });

export default function Transactions() {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ type: "", account_id: "", category_id: "", start_date: "", end_date: "", origin: "", included: "" });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [linkedInvoiceId, setLinkedInvoiceId] = useState("");
  const [urlReady, setUrlReady] = useState(false);
  const [mode, setMode] = useState<"" | "create" | "edit">("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction[] | null>(null);
  const [selection, setSelection] = useState<Record<string, Transaction>>({});
  const selectionVersion = useRef(0);
  const [selecting, setSelecting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
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
    setLinkedInvoiceId(params.get("invoice_id") || "");
    setUrlReady(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

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

  const accounts = { data: [] as Account[], isPending: false, isError: false };
  const categories = useQuery<Category[]>({ queryKey: ["categories", "all"], queryFn: async () => (await api.get("/categories", { params: { status: "all" } })).data });
  const filterParams = { ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), search: debouncedSearch || undefined, invoice_id: linkedInvoiceId || undefined };
  const query = useQuery<{ items: Transaction[]; total: number }>({
    queryKey: ["transactions", page, filters, debouncedSearch, linkedInvoiceId],
    queryFn: async () => (await api.get("/bookkeeping", { params: { page, page_size: 15, ...filterParams } })).data,
    enabled: urlReady,
  });
  const list = query.data?.items || [];
  const selectedRows = Object.values(selection);
  const selected = Object.keys(selection);
  const waitingForSearch = search.trim() !== debouncedSearch;
  const selectionDisabled = selecting || waitingForSearch || query.isFetching;
  const account = (id: string | null) => accounts.data?.find((item) => item.id === id);
  const category = (id: string | null) => categories.data?.find((item) => item.id === id);
  // Một thay đổi giao dịch tác động số dư, dashboard, ngân sách và báo cáo nên phải làm mới toàn bộ cache liên quan.
  const clearSelection = () => {
    selectionVersion.current += 1;
    setSelection({});
    setSelecting(false);
    setExportError("");
  };
  const invalidate = () => {
    clearSelection();
    return Promise.all(["transactions", "wallets", "accounts", "dashboard", "budgets", "analytics", "invoices", "invoice", "notifications", "payment-records", "wallet-history"].map((key) => cache.invalidateQueries({ queryKey: [key] })));
  };
  const selectRows = (rows: Transaction[], checked: boolean) => {
    if (selectionDisabled) return;
    setSelection((current) => {
      const next = { ...current };
      rows.forEach((row) => { if (checked) next[row.id] = row; else delete next[row.id]; });
      return next;
    });
  };
  const fetchFiltered = async () => (await api.get<Transaction[]>("/bookkeeping/export-data", { params: filterParams })).data;
  const selectAllResults = async () => {
    if (selectionDisabled || query.isError || !query.data?.total) return;
    const version = ++selectionVersion.current;
    setSelecting(true); setExportError("");
    try {
      const rows = await fetchFiltered();
      if (version !== selectionVersion.current) return;
      setSelection(Object.fromEntries(rows.map((row) => [row.id, row])));
    } catch (caught) {
      if (version === selectionVersion.current) setExportError(errorMessage(caught));
    } finally {
      if (version === selectionVersion.current) setSelecting(false);
    }
  };
  const exportTransactions = async () => {
    if (!selectedRows.length || exporting || selectionDisabled || accounts.isPending || categories.isPending || accounts.isError || categories.isError) return;
    setExporting(true); setExportError("");
    // Chỉ xuất bản chụp các dòng đã tick tại thời điểm nhấn nút, kể cả lựa chọn ở trang khác.
    const filterLabel = [
      filters.type && (filters.type === "INCOME" ? "Thu nhập" : "Chi tiêu"),
      filters.account_id && `Tài khoản: ${account(filters.account_id)?.name || filters.account_id}`,
      filters.category_id && `Danh mục: ${category(filters.category_id)?.name || filters.category_id}`,
      filters.start_date && `Từ ${filters.start_date}`, filters.end_date && `Đến ${filters.end_date}`,
      debouncedSearch && `Tìm: ${debouncedSearch}`, linkedInvoiceId && `Hóa đơn: ${linkedInvoiceId}`,
    ].filter(Boolean).join("; ") || "Không áp dụng bộ lọc";
    try {
      await exportFinanceExcel("giao-dich-da-chon.xlsx", {
        title: "CapitalFlow — Sổ giao dịch",
        scope: `Các giao dịch đã chọn: ${selectedRows.length} giao dịch. ${filterLabel}.`,
        transactions: selectedRows.map((transaction) => ({
          ...transaction,
          account_name: "Sổ thu chi",
          category_name: category(transaction.category_id)?.name || "Không phân loại",
          currency: "VND",
        })),
      });
    } catch (caught) { setExportError(errorMessage(caught)); }
    finally { setExporting(false); }
  };

  // Chuẩn bị form riêng cho tạo mới, chỉnh sửa hoặc chuyển tiền trước khi mở modal.
  const open = (kind: "create" | "edit", transaction?: Transaction) => {
    setMode(kind); setEditing(transaction || null); setError(""); setSuggestion(null); setCategoryTouched(false);
    setForm(transaction ? { ...fresh(), include_in_reports: transaction.include_in_reports !== false, account_id: transaction.account_id || "", category_id: transaction.category_id || "", type: transaction.type, amount: String(Math.abs(Number(transaction.amount))), transaction_date: transaction.transaction_date, description: transaction.description || "", note: transaction.note || "" } : { ...fresh(), account_id: accounts.data?.find(item => !item.bank_read_only)?.id || "" });
  };

  // Validate hai ví và loại tiền khi chuyển; các luồng còn lại tạo hoặc cập nhật giao dịch thu/chi.
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const payload = { category_id: form.category_id || null, type: form.type, amount: form.amount, transaction_date: form.transaction_date, description: form.description.trim(), note: form.note || null, ...(editing?.wallet_entry_id ? { include_in_reports: form.include_in_reports !== false } : {}),
        ...(!editing ? { wallet_entry_id: form.wallet_entry_id || null, accept_separate_record: !!form.accept_separate_record } : {}) };
      if (editing) await api.patch("/bookkeeping/" + editing.id, payload); else await api.post("/bookkeeping", payload);
      await invalidate();
      setMode("");
      setNotice(form.wallet_entry_id ? "Đã cập nhật khoản thanh toán có sẵn, không ghi chi lần hai." : "Đã ghi sổ thu chi. Số dư ví không thay đổi.");
    } catch (caught) { setError(caught instanceof Error && !("response" in caught) ? caught.message : errorMessage(caught)); } finally { setBusy(false); }
  };

  // Backend xóa nguyên tử các dòng đã chọn và cả hai vế của mọi chuyển tiền liên quan.
  const remove = async () => {
    if (!deleting?.length || deleting.length > 100) return;
    setBusy(true); setError("");
    try {
      let count: number;
      if (deleting.length === 1) {
        await api.delete("/bookkeeping/" + deleting[0].id);
        count = deleting[0].kind === "TRANSFER" ? 2 : 1;
      } else {
        const response = await api.post<{ deleted_count: number }>("/bookkeeping/batch-delete", {
          transaction_ids: deleting.map((transaction) => transaction.id),
        });
        count = response.data.deleted_count;
      }
      await invalidate();
      setDeleting(null); setPage(1);
      setNotice(`Đã xóa ${count} giao dịch${deleting.some((transaction) => transaction.kind === "TRANSFER") ? " (bao gồm cả hai vế chuyển tiền)" : ""}.`);
    }
    catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  // Lựa chọn chỉ tồn tại trong cùng bộ lọc; đổi trang không làm mất lựa chọn.
  const filter = (key: string, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); clearSelection(); };
  const clearInvoiceFilter = () => {
    setLinkedInvoiceId("");
    setPage(1);
    clearSelection();
    const url = new URL(window.location.href);
    url.searchParams.delete("invoice_id");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  };
  const dependencyError = accounts.isError || categories.isError;

  return <div className="cf-stack">
    <PageHead eyebrow="SỔ THU CHI" title="Giao dịch" description="Ghi nhận từ thanh toán ví, OCR hoặc nhập tay. Khoản thanh toán ví tắt Tính vào chi tiêu chỉ còn trong lịch sử ví." actions={<><button className="cf-btn cf-btn-primary" onClick={() => open("create")}><Plus />Thêm giao dịch</button></>} />
    {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
    {linkedInvoiceId && <Alert kind="info">Đang xem giao dịch của hóa đơn đã chọn. <button type="button" className="cf-btn cf-btn-sm" onClick={clearInvoiceFilter}>Hiện tất cả giao dịch</button></Alert>}
    <Panel>
      <TransactionFilters independent filters={filters} search={search} selectedCount={selected.length} exporting={exporting} exportDisabled={!selected.length || selectionDisabled || query.isError || accounts.isPending || categories.isPending || dependencyError} onExport={exportTransactions} accounts={accounts.data || []} categories={categories.data || []} onFilter={filter} onSearch={(value) => { setSearch(value); setPage(1); clearSelection(); }} />
      {exportError && <Alert onDismiss={() => setExportError("")}>{exportError}</Alert>}
      <div className="cf-transaction-selection" role="group" aria-label="Thao tác với giao dịch đã chọn" aria-busy={selecting}>
        <div className="cf-transaction-selection-status" role="status" aria-live="polite">
          <strong>{selecting ? "Đang chọn…" : selected.length ? `Đã chọn ${selected.length} giao dịch` : "Chưa chọn giao dịch"}</strong>
          <span id="transaction-selection-hint">{selected.length > 100 ? "Chọn tối đa 100 giao dịch để xóa" : "Lựa chọn được giữ khi đổi trang"}</span>
        </div>
        <div className="cf-transaction-selection-actions">
          <button type="button" className="cf-btn cf-btn-ghost cf-btn-sm" disabled={!selecting && !selected.length} onClick={clearSelection}>{selecting ? "Hủy chọn" : "Bỏ chọn"}</button>
          <button type="button" className="cf-btn cf-btn-danger cf-btn-sm" disabled={!selected.length || selecting || selected.length > 100 || selectedRows.some(t => !!t.wallet_entry_id || account(t.account_id)?.bank_read_only)} aria-describedby="transaction-selection-hint" title={selected.length > 100 ? "API hiện cho phép xóa tối đa 100 giao dịch mỗi lần" : "Xóa các giao dịch đã chọn"} onClick={() => { setDeleting(selectedRows); setError(""); }}><Trash2 size={16} />Xóa</button>
        </div>
      </div>
      <TransactionTable independent query={query} list={list} page={page} total={query.data?.total || 0} selected={selected} selectionDisabled={selectionDisabled} getAccount={account} getCategory={category} onSelectAll={(checked) => { if (checked) void selectAllResults(); else clearSelection(); }} onSelectOne={(id, checked) => selectRows(list.filter((row) => row.id === id), checked)} onEdit={(transaction) => open("edit", transaction)} onDelete={(transaction) => { setDeleting([transaction]); setError(""); }} onPageChange={setPage} />
    </Panel>
    {(mode === "create" || mode === "edit") && <TransactionModal independent editing={editing} accounts={accounts.data || []} categories={categories.data || []} form={form} setForm={setForm} suggestion={suggestion} setSuggestion={setSuggestion} setCategoryTouched={setCategoryTouched} error={error} busy={busy} dependencyError={dependencyError} onSubmit={submit} onClose={() => setMode("")} onClearError={() => setError("")} />}
    {deleting && <TransactionDeleteModal independent transactions={deleting} getAccount={account} error={error} busy={busy} onConfirm={remove} onClose={() => setDeleting(null)} onClearError={() => setError("")} />}
  </div>;
}
