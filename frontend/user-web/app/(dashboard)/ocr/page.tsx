"use client";
import { OcrSteps } from "@/components/Motion";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  ScanLine,
  Trash2,
  RefreshCw,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Check,
  Plus,
  ExternalLink,
  Save,
} from "lucide-react";
import api from "@/lib/api";
import {
  PageHead,
  Panel,
  Field,
  Modal,
  Alert,
  Loading,
  ErrorState,
  Empty,
  Pagination,
} from "@/components/ui";
import {
  money,
  localDate,
  errorMessage,
  type Account,
  type Category,
  type Money,
} from "@/lib/finance";
interface InvoiceItem {
  id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  quantity: Money | null;
  unit_price: Money | null;
  discount_amount?: Money | null;
  tax_amount?: Money | null;
  line_total: Money | null;
}
interface Invoice {
  id: string;
  merchant_name: string | null;
  merchant_address: string | null;
  merchant_tax_code: string | null;
  invoice_number: string | null;
  invoice_symbol: string | null;
  invoice_date: string | null;
  vat_rate: string | null;
  payment_method: string | null;
  subtotal_amount: Money | null;
  total_amount: Money | null;
  tax_amount: Money | null;
  currency: string;
  original_filename: string;
  mime_type: string;
  status: string;
  account_id?: string;
  category_id?: string;
  note?: string;
  is_duplicate?: boolean;
  duplicate_reason?: string;
  items?: InvoiceItem[];
}
const statuses: Record<string, string> = {
  UPLOADED: "Chưa quét",
  PROCESSING: "Đang xử lý",
  REVIEW_REQUIRED: "Chờ kiểm tra",
  CONFIRMED: "Đã xác nhận",
  FAILED: "Thất bại",
};
function Status({ value }: { value: string }) {
  return (
    <span
      className={`cf-badge ${value === "CONFIRMED" ? "success" : value === "FAILED" ? "danger" : value === "REVIEW_REQUIRED" ? "warning" : "info"}`}
    >
      {statuses[value] || value}
    </span>
  );
}
function InvoiceForm({
  invoice,
  busy,
  onConfirm,
}: {
  invoice: Invoice;
  busy: boolean;
  onConfirm: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const cache = useQueryClient();
  const accounts = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get("/accounts")).data,
  });
  const categories = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });
  const [form, setForm] = useState({
    merchant_name: invoice.merchant_name || "",
    merchant_address: invoice.merchant_address || "",
    merchant_tax_code: invoice.merchant_tax_code || "",
    invoice_number: invoice.invoice_number || "",
    invoice_symbol: invoice.invoice_symbol || "",
    invoice_date: invoice.invoice_date || localDate(),
    vat_rate: invoice.vat_rate || "",
    payment_method: invoice.payment_method || "",
    subtotal_amount: String(invoice.subtotal_amount ?? ""),
    total_amount: String(invoice.total_amount ?? ""),
    tax_amount: String(invoice.tax_amount ?? 0),
    account_id: invoice.account_id || "",
    category_id: invoice.category_id || "",
    note: invoice.note || "",
  });
  const [tab, setTab] = useState("form"),
    [duplicateAccepted, setDuplicateAccepted] = useState(false),
    [newCategory, setNewCategory] = useState(""),
    [adding, setAdding] = useState(false),
    [categoryBusy, setCategoryBusy] = useState(false),
    [itemDrafts, setItemDrafts] = useState(() =>
      (invoice.items || []).map((item) => ({
        name: item.name || "",
        sku: item.sku || "",
        unit: item.unit || "",
        quantity: String(item.quantity ?? ""),
        unit_price: String(item.unit_price ?? ""),
        discount_amount: String(item.discount_amount ?? ""),
        tax_amount: String(item.tax_amount ?? ""),
        line_total: String(item.line_total ?? ""),
      })),
    ),
    [itemsBusy, setItemsBusy] = useState(false),
    [itemsNotice, setItemsNotice] = useState(""),
    [categorySuggestion, setCategorySuggestion] = useState<{ category_id: string; category_name: string; confidence: number; reason: string } | null>(null),
    [categoryTouched, setCategoryTouched] = useState(false),
    [error, setError] = useState("");
  const locked =
    invoice.status === "CONFIRMED" || invoice.status === "PROCESSING" || busy;
  const field = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  useEffect(() => {
    if (locked || categoryTouched || form.category_id || !form.merchant_name.trim()) {
      setCategorySuggestion(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await api.post("/categories/suggest", {
          type: "EXPENSE",
          description: form.merchant_name.trim(),
          note: form.note || null,
          item_names: itemDrafts.map((item) => item.name).filter(Boolean),
        });
        if (active) setCategorySuggestion(data.category_id ? data : null);
      } catch {
        if (active) setCategorySuggestion(null);
      }
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [locked, categoryTouched, form.category_id, form.merchant_name, form.note, itemDrafts]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (Number(form.total_amount) <= 0) {
      setError("Tổng thanh toán phải lớn hơn 0.");
      return;
    }
    if (invoice.is_duplicate && !duplicateAccepted) {
      setError("Xác nhận đã kiểm tra cảnh báo trùng lặp trước khi lưu.");
      return;
    }
    const account = accounts.data?.find((a) => a.id === form.account_id);
    if (account && account.currency !== (invoice.currency || "VND")) {
      setError("Chọn tài khoản cùng loại tiền với hóa đơn.");
      return;
    }
    if (itemDrafts.some((item) => !item.name.trim())) {
      setError("Tên mặt hàng không được để trống.");
      return;
    }
    const numeric = (value: string) => (value === "" ? null : Number(value));
    await onConfirm({
      ...form,
      total_amount: Number(form.total_amount),
      tax_amount: Number(form.tax_amount),
      subtotal_amount: form.subtotal_amount ? Number(form.subtotal_amount) : null,
      category_id: form.category_id || null,
      items: itemDrafts.map((item) => ({
        name: item.name.trim(),
        sku: item.sku.trim() || null,
        unit: item.unit.trim() || null,
        quantity: numeric(item.quantity),
        unit_price: numeric(item.unit_price),
        discount_amount: numeric(item.discount_amount),
        tax_amount: numeric(item.tax_amount),
        line_total: numeric(item.line_total),
      })),
    });
  };
  const updateItem = (index: number, key: string, value: string) =>
    setItemDrafts((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  const saveItems = async () => {
    setError("");
    setItemsNotice("");
    if (itemDrafts.some((item) => !item.name.trim())) {
      setError("Tên mặt hàng không được để trống.");
      return;
    }
    setItemsBusy(true);
    try {
      const numeric = (value: string) => (value === "" ? null : Number(value));
      await api.put(`/invoices/${invoice.id}/items`, {
        items: itemDrafts.map((item) => ({
          name: item.name.trim(),
          sku: item.sku.trim() || null,
          unit: item.unit.trim() || null,
          quantity: numeric(item.quantity),
          unit_price: numeric(item.unit_price),
          discount_amount: numeric(item.discount_amount),
          tax_amount: numeric(item.tax_amount),
          line_total: numeric(item.line_total),
        })),
      });
      await cache.invalidateQueries({ queryKey: ["invoice", invoice.id] });
      setItemsNotice("Đã lưu các mặt hàng đã hiệu chỉnh.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setItemsBusy(false);
    }
  };
  const addCategory = async () => {
    if (!newCategory.trim()) return;
    setCategoryBusy(true);
    setError("");
    try {
      const { data } = await api.post("/categories", {
        name: newCategory.trim(),
        type: "EXPENSE",
      });
      await cache.invalidateQueries({ queryKey: ["categories"] });
      field("category_id", data.id);
      setAdding(false);
      setNewCategory("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCategoryBusy(false);
    }
  };
  return (
    <div className="cf-panel-body cf-stack" style={{ gap: 18 }}>
      <div className="cf-tabs" role="tablist" aria-label="Thông tin hóa đơn">
        <button
          role="tab"
          aria-selected={tab === "form"}
          onClick={() => setTab("form")}
        >
          Thông tin
        </button>
        <button
          role="tab"
          aria-selected={tab === "items"}
          onClick={() => setTab("items")}
        >
          Mặt hàng ({itemDrafts.length})
        </button>
      </div>
      {tab === "items" ? (
        <>
          {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
          {itemsNotice && (
            <Alert kind="success" onDismiss={() => setItemsNotice("")}>
              {itemsNotice}
            </Alert>
          )}
          {!itemDrafts.length ? (
            <Empty
              title="Chưa có mặt hàng được nhận diện"
              description={locked ? undefined : "Bạn có thể thêm dòng mặt hàng để hoàn thiện hóa đơn."}
            />
          ) : (
            <div className="cf-table-wrap cf-item-editor-wrap">
              <table className="cf-table cf-item-editor">
                <thead>
                  <tr>
                    <th>Mặt hàng</th>
                    <th>ĐVT</th>
                    <th>SL</th>
                    <th>Đơn giá</th>
                    <th className="right">Thành tiền</th>
                    {!locked && <th aria-label="Thao tác" />}
                  </tr>
                </thead>
                <tbody>
                  {itemDrafts.map((item, index) => (
                    <tr key={index}>
                      <td className="cf-item-name-cell">
                        {locked ? (
                          <strong>{item.name}{item.unit ? ` - (${item.unit})` : ""}</strong>
                        ) : (
                          <>
                            <input
                              className="cf-input cf-item-input"
                              aria-label={`Tên mặt hàng ${index + 1}`}
                              maxLength={500}
                              value={item.name}
                              onChange={(e) => updateItem(index, "name", e.target.value)}
                            />
                            <span className="cf-sub">
                              Hiển thị: {item.name || "Mặt hàng"}{item.unit ? ` - (${item.unit})` : ""}
                            </span>
                          </>
                        )}
                      </td>
                      <td>
                        {locked ? item.unit || "—" : (
                          <input className="cf-input cf-item-input cf-item-unit" aria-label={`Đơn vị tính ${index + 1}`} maxLength={50} value={item.unit} onChange={(e) => updateItem(index, "unit", e.target.value)} />
                        )}
                      </td>
                      <td>
                        {locked ? Number(item.quantity || 0) : (
                          <input className="cf-input cf-item-input cf-item-number" aria-label={`Số lượng ${index + 1}`} type="number" min="0" step="0.0001" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} />
                        )}
                      </td>
                      <td>
                        {locked ? money(item.unit_price || 0, invoice.currency) : (
                          <input className="cf-input cf-item-input cf-item-money" aria-label={`Đơn giá ${index + 1}`} type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItem(index, "unit_price", e.target.value)} />
                        )}
                      </td>
                      <td className="right cf-number">
                        {locked ? money(item.line_total || 0, invoice.currency) : (
                          <input className="cf-input cf-item-input cf-item-money" aria-label={`Thành tiền ${index + 1}`} type="number" min="0" step="0.01" value={item.line_total} onChange={(e) => updateItem(index, "line_total", e.target.value)} />
                        )}
                      </td>
                      {!locked && (
                        <td>
                          <button type="button" className="cf-icon-btn" aria-label={`Xóa mặt hàng ${index + 1}`} onClick={() => setItemDrafts((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>
                            <Trash2 />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!locked && (
            <div className="cf-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <button type="button" className="cf-btn cf-btn-ghost cf-btn-sm" disabled={itemsBusy || itemDrafts.length >= 200} onClick={() => setItemDrafts((rows) => [...rows, { name: "", sku: "", unit: "", quantity: "1", unit_price: "", discount_amount: "", tax_amount: "", line_total: "" }])}>
                <Plus /> Thêm mặt hàng
              </button>
              <button type="button" className="cf-btn cf-btn-primary cf-btn-sm" disabled={itemsBusy || busy} onClick={saveItems}>
                <Save /> {itemsBusy ? "Đang lưu…" : "Lưu chỉnh sửa mặt hàng"}
              </button>
            </div>
          )}
          <p className="cf-muted" style={{ fontSize: 12 }}>Tên hiển thị được ghép từ tên hàng và đơn vị tính, ví dụ “Giò lụa lợn quế - (Kg)”. Kiểm tra tổng thanh toán tại tab Thông tin trước khi xác nhận.</p>
        </>
      ) : (
        <form className="cf-form" onSubmit={submit}>
          {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
          {invoice.is_duplicate && invoice.status !== "CONFIRMED" && (
            <Alert kind="info">
              <strong>Hóa đơn có thể bị trùng.</strong>
              <br />
              {invoice.duplicate_reason}
              <label className="cf-row" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={duplicateAccepted}
                  onChange={(e) => setDuplicateAccepted(e.target.checked)}
                  required
                />
                Tôi đã kiểm tra và vẫn muốn ghi nhận.
              </label>
            </Alert>
          )}
          <fieldset
            disabled={locked}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            <div className="cf-form">
              <Field label="Đơn vị bán hàng">
                <input
                  className="cf-input"
                  required
                  maxLength={255}
                  value={form.merchant_name}
                  onChange={(e) => field("merchant_name", e.target.value)}
                />
              </Field>
              <Field label="Địa chỉ đơn vị bán hàng">
                <input className="cf-input" maxLength={500} value={form.merchant_address} onChange={(e) => field("merchant_address", e.target.value)} />
              </Field>
              <div className="cf-form-grid">
                <Field label="Ký hiệu mẫu số / hóa đơn" hint="Ví dụ: 1C26MAB">
                  <input
                    className="cf-input"
                    maxLength={100}
                    value={form.invoice_symbol}
                    onChange={(e) => field("invoice_symbol", e.target.value)}
                  />
                </Field>
                <Field label="Số hóa đơn">
                  <input
                    className="cf-input"
                    value={form.invoice_number}
                    onChange={(e) => field("invoice_number", e.target.value)}
                  />
                </Field>
                <Field label="Ngày lập hóa đơn" hint={form.invoice_date ? `Ngày chuẩn: ${form.invoice_date.split("-").reverse().join("-")}` : "Định dạng DD-MM-YYYY"}>
                  <input
                    className="cf-input"
                    type="date"
                    required
                    value={form.invoice_date}
                    onChange={(e) => field("invoice_date", e.target.value)}
                  />
                </Field>
                <Field label="Mã số thuế đối tác">
                  <input className="cf-input" maxLength={100} value={form.merchant_tax_code} onChange={(e) => field("merchant_tax_code", e.target.value)} />
                </Field>
              </div>
              <div className="cf-form-grid">
                <Field label={`Doanh số chưa thuế (${invoice.currency || "VND"})`}>
                  <input className="cf-input cf-number" type="number" min="0" step="0.01" value={form.subtotal_amount} onChange={(e) => field("subtotal_amount", e.target.value)} />
                </Field>
                <Field label="Thuế suất GTGT" hint="8%, 10%, 0%, KCT…">
                  <input className="cf-input" maxLength={50} value={form.vat_rate} onChange={(e) => field("vat_rate", e.target.value)} />
                </Field>
                <Field label={`Tiền thuế GTGT (${invoice.currency || "VND"})`}>
                  <input
                    className="cf-input"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.tax_amount}
                    onChange={(e) => field("tax_amount", e.target.value)}
                  />
                </Field>
              </div>
              <Field
                label={`Tổng thanh toán (${invoice.currency || "VND"})`}
                hint="Tổng tiền đã bao gồm thuế. Đây là số tiền ghi nhận vào khoản chi."
              >
                <input
                  className="cf-input cf-number"
                  style={{ fontSize: 22, fontWeight: 600 }}
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.total_amount}
                  onChange={(e) => field("total_amount", e.target.value)}
                />
              </Field>
              <Field label="Hình thức thanh toán" hint="TM, CK, TM/CK, thẻ…">
                <input className="cf-input" maxLength={50} value={form.payment_method} onChange={(e) => field("payment_method", e.target.value)} />
              </Field>
              <Field label="File nguồn">
                <div className="cf-readonly-value"><FileText size={16} /> <span>{invoice.original_filename || "Không xác định"}</span></div>
              </Field>
              <Field label="Tài khoản thanh toán">
                <select
                  className="cf-input"
                  required
                  value={form.account_id}
                  onChange={(e) => field("account_id", e.target.value)}
                >
                  <option value="">Chọn tài khoản</option>
                  {accounts.data?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {money(a.balance, a.currency)}
                    </option>
                  ))}
                </select>
              </Field>
              {accounts.isError ? (
                <Alert persistent>Không thể tải tài khoản. Vui lòng thử lại.</Alert>
              ) : (
                accounts.isSuccess &&
                !accounts.data?.length && (
                  <Link className="cf-inline-link" href="/accounts">
                    Tạo tài khoản trước khi ghi nhận →
                  </Link>
                )
              )}
              <Field label="Danh mục chi tiêu">
                <select
                  className="cf-input"
                  value={form.category_id}
                  onChange={(e) => { field("category_id", e.target.value); setCategoryTouched(true); setCategorySuggestion(null); }}
                >
                  <option value="">Chưa phân loại</option>
                  {categories.data
                    ?.filter((c) => c.type === "EXPENSE")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                {categorySuggestion && (
                  <div className="cf-category-suggestion" role="status">
                    <div><strong>Gợi ý: {categorySuggestion.category_name}</strong><span>{Math.round(categorySuggestion.confidence * 100)}% · {categorySuggestion.reason}</span></div>
                    <button type="button" className="cf-btn cf-btn-sm" onClick={() => { field("category_id", categorySuggestion.category_id); setCategoryTouched(true); setCategorySuggestion(null); }}>Chọn danh mục</button>
                  </div>
                )}
              </Field>
              {adding ? (
                <div className="cf-row">
                  <input
                    className="cf-input"
                    aria-label="Tên danh mục mới"
                    style={{ flex: 1 }}
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Tên danh mục mới"
                  />
                  <button
                    type="button"
                    className="cf-btn cf-btn-sm"
                    disabled={categoryBusy || !newCategory.trim()}
                    onClick={addCategory}
                  >
                    Tạo
                  </button>
                  <button
                    type="button"
                    className="cf-btn cf-btn-ghost cf-btn-sm"
                    onClick={() => setAdding(false)}
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                !locked && (
                  <button
                    type="button"
                    className="cf-btn cf-btn-ghost cf-btn-sm"
                    style={{ alignSelf: "flex-start" }}
                    onClick={() => setAdding(true)}
                  >
                    <Plus />
                    Thêm danh mục
                  </button>
                )
              )}
              <Field label="Ghi chú">
                <textarea
                  className="cf-input"
                  rows={2}
                  value={form.note}
                  onChange={(e) => field("note", e.target.value)}
                />
              </Field>
            </div>
          </fieldset>
          {invoice.status === "CONFIRMED" ? (
            <Alert persistent kind="success">
              Hóa đơn đã được ghi nhận. Xem khoản chi tại trang Giao dịch.
            </Alert>
          ) : (
            <button
              className="cf-btn cf-btn-primary"
              disabled={
                locked ||
                accounts.isError ||
                !accounts.data?.length ||
                categoryBusy
              }
            >
              <Check />
              {busy ? "Đang lưu…" : "Xác nhận & ghi nhận khoản chi"}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
export default function Ocr() {
  const cache = useQueryClient(),
    uploadInput = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [checked, setChecked] = useState<string[]>([]),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [deleting, setDeleting] = useState<string[] | null>(null),
    [version, setVersion] = useState(0),
    [blob, setBlob] = useState(""),
    [previewBusy, setPreviewBusy] = useState(false),
    [previewError, setPreviewError] = useState(false),
    [previewVersion, setPreviewVersion] = useState(0),
    [zoom, setZoom] = useState(1),
    [rotation, setRotation] = useState(0);
  const query = useQuery<{ items: Invoice[]; total: number }>({
    queryKey: ["invoices", page, status],
    queryFn: async () =>
      (
        await api.get("/invoices", {
          params: { page, page_size: 15, status: status || undefined },
        })
      ).data,
    refetchInterval: (q) =>
      q.state.data?.items.some((i) => i.status === "PROCESSING") ? 4000 : false,
  });
  const detail = useQuery<Invoice>({
    queryKey: ["invoice", selectedId],
    queryFn: async () => (await api.get("/invoices/" + selectedId)).data,
    enabled: !!selectedId,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => q.state.data?.status === "PROCESSING" ? 4000 : false,
  });
  const list = query.data?.items || [];
  useEffect(() => {
    if (!selectedId && list.length) setSelectedId(list[0].id);
  }, [list, selectedId]);
  useEffect(() => {
    let active = true,
      url = "";
    setBlob("");
    setPreviewError(false);
    setZoom(1);
    setRotation(0);
    if (!selectedId) return;
    setPreviewBusy(true);
    api
      .get("/invoices/" + selectedId + "/file", { responseType: "blob" })
      .then((res) => {
        if (active) {
          url = URL.createObjectURL(res.data);
          setBlob(url);
        }
      })
      .catch(() => {
        if (active) setPreviewError(true);
      })
      .finally(() => {
        if (active) setPreviewBusy(false);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selectedId, previewVersion]);
  const invalidate = async () => {
    await Promise.all(
      [
        "invoices",
        "invoice",
        "accounts",
        "transactions",
        "dashboard",
        "budgets",
        "analytics",
      ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
    );
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    const valid = Array.from(files);
    const unsupported = valid.find(
      (f) =>
        f.size > 10 * 1024 * 1024 || !/\.(jpe?g|png|webp|pdf|xml)$/i.test(f.name),
    );
    if (unsupported) {
      setError(
        `Tệp “${unsupported.name}” không hợp lệ. Chỉ nhận JPG, PNG, WEBP, PDF, XML tối đa 10 MB/tệp.`,
      );
      return;
    }
    setBusy("upload");
    setError("");
    setNotice("");
    let count = 0;
    try {
      for (const file of valid) {
        const data = new FormData();
        data.append("file", file);
        const res = await api.post("/invoices", data);
        count++;
        setSelectedId(res.data.id);
      }
      setStatus("");
      setPage(1);
      setChecked([]);
      setNotice(`Đã tải ${count} hóa đơn. XML được đọc trực tiếp; ảnh và PDF có thể Quét AI.`);
    } catch (e) {
      setError(`Đã tải ${count}/${valid.length} tệp. ${errorMessage(e)}`);
    } finally {
      await cache.invalidateQueries({ queryKey: ["invoices"] });
      setBusy("");
      if (uploadInput.current) uploadInput.current.value = "";
    }
  };
  const scan = async (ids: string[]) => {
    if (!ids.length) return;
    if (ids.length > 5) {
      setError("Mỗi lần quét tối đa 5 hóa đơn.");
      return;
    }
    setBusy("scan");
    setError("");
    setNotice("");
    try {
      if (ids.length === 1) {
        await api.post("/invoices/" + ids[0] + "/ocr");
        setNotice(
          "Đã xếp hàng nhận diện. Kết quả sẽ tự cập nhật khi xử lý xong.",
        );
      } else {
        const { data } = await api.post("/invoices/batch-ocr", {
          invoice_ids: ids,
        });
        const failed = data.results.filter(
          (r: { success: boolean }) => !r.success,
        );
        setNotice(
          `Đã xếp hàng ${data.results.length - failed.length}/${data.results.length} hóa đơn.`,
        );
        if (failed.length)
          setError(failed.map((r: { error: string }) => r.error).join("; "));
      }
      await invalidate();
      setVersion((v) => v + 1);
      setChecked([]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  };
  const confirm = async (payload: Record<string, unknown>) => {
    if (!selectedId) return;
    setBusy("confirm");
    setError("");
    setNotice("");
    try {
      await api.post("/invoices/" + selectedId + "/confirm", payload);
      await invalidate();
      setVersion((v) => v + 1);
      setNotice("Đã xác nhận hóa đơn và cập nhật khoản chi trong tài khoản.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy("delete");
    setError("");
    try {
      const { data } = await api.post("/invoices/batch-delete", {
        invoice_ids: deleting,
      });
      const removedCurrent = deleting.includes(selectedId || "");
      setChecked([]);
      setDeleting(null);
      await invalidate();
      if (removedCurrent) setSelectedId(null);
      setNotice(
        `Đã xóa ${data.deleted} hóa đơn. Các giao dịch đã ghi nhận vẫn được giữ lại.`,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  };
  const eligible = checked.filter((id) =>
    list.some(
      (i) => i.id === id && i.mime_type !== "application/xml" && !["CONFIRMED", "PROCESSING"].includes(i.status),
    ),
  );
  const inv = detail.data;
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="HÓA ĐƠN AI"
        title="Từ hóa đơn đến khoản chi"
        description="01 Tải lên · 02 Quét và kiểm tra · 03 Xác nhận giao dịch"
        actions={
          <>
            <button
              className="cf-btn"
              onClick={() => query.refetch()}
              disabled={!!busy}
            >
              <RefreshCw />
              Làm mới
            </button>
            <button
              className="cf-btn cf-btn-primary"
              onClick={() => uploadInput.current?.click()}
              disabled={!!busy}
            >
              <Upload />
              {busy === "upload" ? "Đang tải…" : "Tải hóa đơn"}
            </button>
            <input
              type="file"
              ref={uploadInput}
              accept=".jpg,.jpeg,.png,.webp,.pdf,.xml"
              multiple
              hidden
              onChange={(e) => upload(e.target.files)}
            />
          </>
        }
      />
      {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      <div
        className="cf-ocr-drop"
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("is-dragging"); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.classList.remove("is-dragging"); }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("is-dragging");
          upload(e.dataTransfer.files);
        }}
      >
        <Upload size={20} />
        <span>Kéo thả hóa đơn vào đây, hoặc</span>
        <button
          className="cf-btn cf-btn-sm"
          disabled={!!busy}
          onClick={() => uploadInput.current?.click()}
        >
          Chọn tệp
        </button>
        <span className="cf-muted">JPG, PNG, WEBP, PDF · Tối đa 10 MB</span>
      </div>
      <div className="cf-ocr-grid">
        <Panel className="cf-ocr-list" title="Tài liệu">
          <div className="cf-panel-body" style={{ padding: 16 }}>
            <Field label="Trạng thái">
              <select
                className="cf-input"
                value={status}
                disabled={!!busy}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                  setSelectedId(null);
                  setChecked([]);
                }}
              >
                <option value="">Tất cả hóa đơn</option>
                {Object.entries(statuses).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {checked.length > 0 && (
            <div
              className="cf-panel-body"
              style={{ padding: 12, borderTop: "1px solid var(--cf-line)" }}
            >
              <div className="cf-row">
                <strong style={{ fontSize: 13 }}>
                  {checked.length} đã chọn
                </strong>
                <button
                  className="cf-btn cf-btn-sm"
                  disabled={!!busy || !eligible.length || eligible.length > 5}
                  onClick={() => scan(eligible)}
                >
                  <ScanLine />
                  Quét {eligible.length}/5
                </button>
                <button
                  className="cf-icon-btn"
                  disabled={!!busy}
                  aria-label="Xóa các hóa đơn đã chọn"
                  onClick={() => setDeleting(checked)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )}
          {query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorState retry={() => query.refetch()} />
          ) : !list.length ? (
            <Empty
              title="Chưa có hóa đơn"
              description="Tải ảnh hoặc PDF, tối đa 10 MB mỗi tệp."
            />
          ) : (
            <div className="cf-ocr-documents">
              {list.map((i) => (
                <div
                  key={i.id}
                  className={`cf-ocr-document ${selectedId === i.id ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${i.original_filename}`}
                    disabled={!!busy || i.status === "PROCESSING"}
                    checked={checked.includes(i.id)}
                    onChange={(e) =>
                      setChecked((ids) =>
                        e.target.checked
                          ? [...ids, i.id]
                          : ids.filter((id) => id !== i.id),
                      )
                    }
                  />
                  <button
                    className="cf-ocr-document-button"
                    disabled={!!busy}
                    onClick={() => setSelectedId(i.id)}
                  >
                    <span
                      style={{ display: "flex", gap: 10, alignItems: "center" }}
                    >
                      <FileText size={20} />
                      <strong>{i.merchant_name || i.original_filename}</strong>
                    </span>
                    <span
                      className="cf-row cf-between"
                      style={{ marginTop: 12 }}
                    >
                      <Status value={i.status} />
                      <span className="cf-number">
                        {i.total_amount
                          ? money(i.total_amount, i.currency)
                          : "—"}
                      </span>
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
          <Pagination
            page={page}
            pageSize={15}
            total={query.data?.total || 0}
            onChange={(p) => {
              if (busy) return;
              setPage(p);
              setSelectedId(null);
              setChecked([]);
            }}
          />
        </Panel>
        <Panel
          title="Kiểm tra thông tin"
          action={inv && <Status value={inv.status} />}
        >
          {!selectedId ? (
            <Empty
              title="Chọn một hóa đơn"
              description="Thông tin nhận diện sẽ xuất hiện ở đây."
            />
          ) : detail.isPending ? (
            <Loading />
          ) : detail.isError ? (
            <ErrorState retry={() => detail.refetch()} />
          ) : (
            inv && (
              <>
                <div
                  className="cf-panel-body cf-row cf-between"
                  style={{ paddingBottom: 0 }}
                >
                  {!["CONFIRMED", "PROCESSING"].includes(inv.status) && inv.mime_type !== "application/xml" && (
                    <button
                      className="cf-btn cf-btn-primary cf-btn-sm"
                      disabled={!!busy}
                      onClick={() => scan([inv.id])}
                    >
                      <ScanLine />
                      {busy === "scan"
                        ? "Đang nhận diện…"
                        : inv.status === "REVIEW_REQUIRED"
                          ? "Quét lại"
                          : "Quét AI"}
                    </button>
                  )}
                  <button
                    className="cf-btn cf-btn-ghost cf-btn-sm"
                    disabled={!!busy || inv.status === "PROCESSING"}
                    onClick={() => setDeleting([inv.id])}
                  >
                    <Trash2 />
                    Xóa hóa đơn
                  </button>
                </div>
                <InvoiceForm
                  key={inv.id + ":" + inv.status + ":" + version}
                  invoice={inv}
                  busy={!!busy}
                  onConfirm={confirm}
                />
              </>
            )
          )}
        </Panel>
        <Panel
          title="Bản gốc"
          className="cf-ocr-preview"
          action={
            <div className="cf-row" style={{ gap: 4 }}>
              <button
                className="cf-icon-btn"
                disabled={!blob || inv?.mime_type === "application/pdf" || inv?.mime_type === "application/xml"}
                aria-label="Thu nhỏ"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              >
                <ZoomOut size={16} />
              </button>
              <button
                className="cf-icon-btn"
                disabled={!blob || inv?.mime_type === "application/pdf" || inv?.mime_type === "application/xml"}
                aria-label="Phóng to"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              >
                <ZoomIn size={16} />
              </button>
              <button
                className="cf-icon-btn"
                disabled={!blob || inv?.mime_type === "application/pdf" || inv?.mime_type === "application/xml"}
                aria-label="Xoay ảnh"
                onClick={() => setRotation((r) => r + 90)}
              >
                <RotateCw size={16} />
              </button>
            </div>
          }
        >
          {inv && <OcrSteps status={inv.status} />}
          <div className={`cf-ocr-preview-body ${inv?.status === "PROCESSING" ? "is-processing" : ""}`}>
            {!selectedId ? (
              <Empty title="Chưa chọn tài liệu" />
            ) : previewBusy ? (
              <Loading />
            ) : previewError ? (
              <ErrorState retry={() => setPreviewVersion((v) => v + 1)} />
            ) : blob ? (
              inv?.mime_type === "application/pdf" ? (
                <object
                  data={blob}
                  type="application/pdf"
                  className="cf-pdf"
                  aria-label="Bản gốc hóa đơn PDF"
                >
                  <a
                    className="cf-btn"
                    href={blob}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Mở PDF
                  </a>
                </object>
              ) : inv?.mime_type === "application/xml" ? (
                <object data={blob} type="application/xml" className="cf-pdf" aria-label="Bản gốc hóa đơn XML">
                  <a className="cf-btn" href={blob} target="_blank" rel="noreferrer">Mở XML</a>
                </object>
              ) : (
                <div className="cf-image-scroll">
                  <img
                    src={blob}
                    alt={inv?.original_filename || "Bản gốc hóa đơn"}
                    style={{
                      width: `${zoom * 100}%`,
                      maxWidth: "none",
                      transform: `rotate(${rotation}deg)`,
                      transformOrigin: "center",
                    }}
                  />
                </div>
              )
            ) : null}
          </div>
          {blob && (
            <div className="cf-panel-body">
              <a
                className="cf-btn cf-btn-sm"
                href={blob}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} />
                Mở bản gốc
              </a>
            </div>
          )}
        </Panel>
      </div>
      <p className="cf-muted" style={{ fontSize: 12 }}>
        Nhận JPG, PNG, WEBP và PDF tối đa 10 MB/tệp. Mỗi lần quét hàng loạt tối
        đa 5 hóa đơn.
      </p>
      {deleting && (
        <Modal
          title="Xóa hóa đơn"
          onClose={() => setDeleting(null)}
          busy={!!busy}
        >
          <div className="cf-form">
            {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
            <p>
              Xóa vĩnh viễn {deleting.length} hóa đơn và tệp gốc? Các khoản chi
              đã được ghi nhận vẫn được giữ lại trong sổ giao dịch.
            </p>
            <div className="cf-form-actions">
              <button
                className="cf-btn"
                disabled={!!busy}
                onClick={() => setDeleting(null)}
              >
                Hủy
              </button>
              <button
                className="cf-btn cf-btn-danger"
                disabled={!!busy}
                onClick={remove}
              >
                {busy ? "Đang xóa…" : "Xóa hóa đơn"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
