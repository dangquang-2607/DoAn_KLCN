"use client";

/** Điều phối query, cache và nghiệp vụ sổ giao dịch; UI form/bảng nằm trong `thanh-phan`. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, PageHead, Panel } from "@/dung-chung/UI-chung/ui";
import { errorMessage, exportFinanceExcel, formatDateForDisplay, localDate, parseDateForApi } from "@/dung-chung/tien-ich/finance";
import { useCategories } from "@/dung-chung/nghiep-vu/danh-muc/categories";
import { type Account, type Transaction } from "@/dung-chung/nghiep-vu/finance";
import TransactionDeleteModal from "./thanh-phan/TransactionDeleteModal";
import TransactionFilters from "./thanh-phan/TransactionFilters";
import TransactionModal, { type CategorySuggestion, type TransactionForm } from "./thanh-phan/TransactionModal";
import TransactionTable from "./thanh-phan/TransactionTable";
import styles from "./CSS/Transactions.module.css";

const fresh = (): TransactionForm => ({ account_id: "", category_id: "", type: "EXPENSE", amount: "", transaction_date: localDate(), description: "", note: "", to_account_id: "" });
const emptyFilters = () => ({ type: "", account_id: "", category_id: "", start_date: "", end_date: "", origin: "", included: "" });
const reportFilterKeys = ["type", "category_id", "start_date", "end_date", "included"];
type LedgerRow = Transaction & { account_name: string; currency: string };

export default function Transactions() {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(emptyFilters);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [linkedInvoiceId, setLinkedInvoiceId] = useState("");
  const [urlReady, setUrlReady] = useState(false);
  const [mode, setMode] = useState<"" | "create" | "edit">("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction[] | null>(null);
  const [selection, setSelection] = useState<Record<string, LedgerRow>>({});
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
    if (params.get("type") === "EXPENSE" && params.get("included") === "true") {
      const start = parseDateForApi(formatDateForDisplay(params.get("start_date")));
      const end = parseDateForApi(formatDateForDisplay(params.get("end_date")));
      const categoryId = params.get("category_id") || "";
      const validCategory = !categoryId || categoryId === "uncategorized" || /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(categoryId);
      if (start && end && start <= end && validCategory) {
        setFilters({ ...emptyFilters(), type: "EXPENSE", category_id: categoryId, start_date: start, end_date: end, included: "true" });
      }
    }
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
  const categories = useCategories("all");
  const filterParams = { ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), search: debouncedSearch || undefined, invoice_id: linkedInvoiceId || undefined };
  const query = useQuery<{ items: LedgerRow[]; total: number }>({
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
  const selectRows = (rows: LedgerRow[], checked: boolean) => {
    if (selectionDisabled) return;
    setSelection((current) => {
      const next = { ...current };
      rows.forEach((row) => { if (checked) next[row.id] = row; else delete next[row.id]; });
      return next;
    });
  };
  const fetchFiltered = async () => (await api.get<LedgerRow[]>("/bookkeeping/export-data", { params: filterParams })).data;
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
          category_name: category(transaction.category_id)?.name || "Không phân loại",
        })),
      });
    } catch (caught) { setExportError(errorMessage(caught)); }
    finally { setExporting(false); }
  };

  // Chuẩn bị form riêng cho tạo mới, chỉnh sửa hoặc chuyển tiền trước khi mở modal.
  const open = (kind: "create" | "edit", transaction?: Transaction) => {
    setMode(kind); setEditing(transaction || null); setError(""); setSuggestion(null); setCategoryTouched(false);
    setForm(transaction ? { ...fresh(), include_in_reports: transaction.include_in_reports !== false, account_id: transaction.account_id || "", category_id: transaction.category_id || "", type: transaction.type, amount: String(transaction.amount).replace(/^-/, ""), transaction_date: transaction.transaction_date, description: transaction.description || "", note: transaction.note || "" } : { ...fresh(), account_id: accounts.data?.find(item => !item.bank_read_only)?.id || "" });
  };

  // Validate hai ví và loại tiền khi chuyển; các luồng còn lại tạo hoặc cập nhật giao dịch thu/chi.
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const payload = editing?.wallet_entry_id ? { category_id: form.category_id || null, include_in_reports: form.include_in_reports !== false } : { category_id: form.category_id || null, type: form.type, amount: form.amount, transaction_date: form.transaction_date, description: form.description.trim(), note: form.note || null,
        ...(!editing ? { auto_categorize: form.auto_categorize !== false && !categoryTouched, wallet_entry_id: form.wallet_entry_id || null, accept_separate_record: !!form.accept_separate_record } : {}) };
      if (editing) await api.patch("/bookkeeping/" + editing.id, payload); else await api.post("/bookkeeping", payload);
      await invalidate();
      setMode("");
      setNotice(editing?.wallet_entry_id ? "Đã cập nhật danh mục và lựa chọn tính vào thu chi." : form.wallet_entry_id ? "Đã cập nhật khoản thanh toán có sẵn, không ghi chi lần hai." : "Đã ghi sổ thu chi. Số dư ví không thay đổi.");
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
        const response = await api.post<{ deleted_count: number }>("/bookkeeping/batch-delete", { transaction_ids: deleting.map((transaction) => transaction.id), });
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
  const clearLinkedFilters = (resetReport = false) => {
    setLinkedInvoiceId("");
    setPage(1);
    clearSelection();
    const url = new URL(window.location.href);
    url.searchParams.delete("invoice_id");
    if (resetReport) reportFilterKeys.forEach(key => url.searchParams.delete(key));
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  };
  const dependencyError = accounts.isError || categories.isError;
  const resetFilters = () => {
    setFilters(emptyFilters());
    setFilterResetKey((key) => key + 1);
    setSearch("");
    setDebouncedSearch("");
    clearLinkedFilters(true);
  };

  return (
    <div className={`cf-stack ${styles.workspace}`}>
      <PageHead
        eyebrow="SỔ THU CHI"
        title="Lịch sử giao dịch"
        description="Theo dõi nạp, rút, chuyển tiền, thanh toán ví, quét hóa đơn và nhập thủ công."
        actions={<button className="cf-btn cf-btn-primary" onClick={() => open("create")}><Plus /> Thêm giao dịch</button>}
      />
      <div className={styles.content}>
        {notice && ( <Alert kind="success" onDismiss={() => setNotice("")}> {notice} </Alert> )}
        {linkedInvoiceId && (
          <Alert kind="info"> Đang xem giao dịch của hóa đơn đã chọn.{" "}
            <button type="button" className="cf-btn cf-btn-sm" onClick={() => clearLinkedFilters()} > Hiện tất cả giao dịch </button>
          </Alert>
        )}
        {filters.included === "true" && (
          <Alert kind="info">Đang lọc các giao dịch được tính vào báo cáo.{" "}
            <button type="button" className="cf-btn cf-btn-sm" onClick={resetFilters}>Đặt lại bộ lọc</button>
          </Alert>
        )}
        <Panel className={styles.panel}>
          <TransactionFilters
            independent
            filters={filters}
            search={search}
            selectedCount={selected.length}
            exporting={exporting}
            exportDisabled={ !selected.length || selectionDisabled || query.isError || accounts.isPending || categories.isPending || dependencyError }
            onExport={exportTransactions}
            accounts={accounts.data || []}
            categories={categories.data || []}
            onFilter={filter}
            onReset={resetFilters}
            resetKey={filterResetKey}
            onSearch={(value) => { setSearch(value); setPage(1); clearSelection(); }}
          />
          {exportError && ( <Alert onDismiss={() => setExportError("")}>{exportError}</Alert> )}
          <div className="cf-transaction-selection" role="group" aria-label="Thao tác với giao dịch đã chọn" aria-busy={selecting} >
            <div className="cf-transaction-selection-status" role="status" aria-live="polite" >
              <strong> {selecting ? "Đang chọn…" : selected.length ? `Đã chọn ${selected.length} giao dịch` : "Chưa chọn giao dịch"} </strong>
              <span id="transaction-selection-hint"> {selected.length > 100 ? "Chọn tối đa 100 giao dịch để xóa" : "Lựa chọn được giữ khi đổi trang"} </span>
            </div>
            <div className="cf-transaction-selection-actions">
              <button
                type="button"
                className="cf-btn cf-btn-ghost cf-btn-sm"
                disabled={!selecting && !selected.length}
                onClick={clearSelection}
              >
                {selecting ? "Hủy chọn" : "Bỏ chọn"}
              </button>
              <button
                type="button"
                className="cf-btn cf-btn-danger cf-btn-sm"
                disabled={
                  !selected.length ||
                  selecting ||
                  selected.length > 100 ||
                  selectedRows.some( (t) => !!t.wallet_entry_id || account(t.account_id)?.bank_read_only, )
                }
                aria-describedby="transaction-selection-hint"
                title={ selected.length > 100 ? "API hiện cho phép xóa tối đa 100 giao dịch mỗi lần" : "Xóa các giao dịch đã chọn" }
                onClick={() => { setDeleting(selectedRows); setError(""); }} > <Trash2 size={16} /> Xóa
              </button>
            </div>
          </div>
          <TransactionTable
            independent
            query={query}
            list={list}
            page={page}
            total={query.data?.total || 0}
            selected={selected}
            selectionDisabled={selectionDisabled}
            getAccount={account}
            getCategory={category}
            onSelectAll={(checked) => { if (checked) void selectAllResults(); else clearSelection(); }}
            onSelectOne={(id, checked) => selectRows( list.filter((row) => row.id === id), checked, ) }
            onEdit={(transaction) => open("edit", transaction)}
            onDelete={(transaction) => { setDeleting([transaction]); setError(""); }}
            onPageChange={setPage}
          />
        </Panel>
      </div>
      {(mode === "create" || mode === "edit") && (
        <TransactionModal
          independent
          editing={editing}
          accounts={accounts.data || []}
          categories={categories.data || []}
          form={form}
          setForm={setForm}
          suggestion={suggestion}
          setSuggestion={setSuggestion}
          setCategoryTouched={setCategoryTouched}
          error={error}
          busy={busy}
          dependencyError={dependencyError}
          onSubmit={submit}
          onClose={() => setMode("")}
          onClearError={() => setError("")}
        />
      )}
      {deleting && (
        <TransactionDeleteModal
          independent
          transactions={deleting}
          getAccount={account}
          error={error}
          busy={busy}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
          onClearError={() => setError("")}
        />
      )}
    </div>
  );
}
