/**
 * ============================================================================
 * TÊN FILE: InvoiceDetailForm.tsx
 * MÀN HÌNH / PHÂN HỆ: Hóa đơn AI / OCR
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Kiểm duyệt và chỉnh sửa dữ liệu OCR trước khi tạo khoản chi.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất InvoiceDetailForm để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Giới hạn định dạng/kích thước/số lượng tệp; chỉ tạo khoản chi sau bước người dùng xác nhận.
 * ============================================================================
 */
"use client";
import { useState, useEffect, type FormEvent } from "react";
import { Plus, Check, Save, Trash2, FileText } from "lucide-react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Field, Alert, Empty } from "@/components/ui/ui";
import { money, localDate, errorMessage, type Account, type Category } from "@/lib/finance";
import type { Invoice } from "./InvoiceTypes";
export default function InvoiceDetailForm({
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
  // Validate dữ liệu người bán, tổng tiền và từng dòng hàng trước khi xác nhận khoản chi.
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
