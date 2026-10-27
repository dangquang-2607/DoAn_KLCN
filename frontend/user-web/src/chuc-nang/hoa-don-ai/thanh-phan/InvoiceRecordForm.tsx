/**
 * ============================================================================
 * TÊN FILE: InvoiceDetailForm.tsx
 * MÀN HÌNH / PHÂN HỆ: Hóa đơn AI / OCR
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
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
import Link from "next/link";
import { useState, useEffect, type FormEvent } from "react";
import { Plus, Check, Save, Trash2, FileText, Store, Receipt, CreditCard, Tag } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/dung-chung/connect-api/api";
import DateInput from "@/dung-chung/UI-chung/DateInput";
import { Field, Alert, Empty } from "@/dung-chung/UI-chung/ui";
import CategoryRestoreModal from "@/dung-chung/nghiep-vu/danh-muc/CategoryRestoreModal";
import { archivedCategoryFromError, categoryErrorMessage, type ArchivedCategory } from "@/dung-chung/nghiep-vu/danh-muc/categories";
import { money, errorMessage } from "@/dung-chung/tien-ich/finance";
import { type Category } from "@/dung-chung/nghiep-vu/finance";
import type { Invoice, DuplicateCheck } from "../xu-ly/InvoiceTypes";
import { invoiceError, invoiceMutation } from "../xu-ly/invoiceApi";
import InvoiceDuplicateReview from "./InvoiceDuplicateReview";
import useAutomaticDuplicateCheck from "../xu-ly/useAutomaticDuplicateCheck";
function cleanMoneyNumber(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  const s = String(val).trim();
  if (s.endsWith(".00")) return s.slice(0, -3);
  if (s.endsWith(".0")) return s.slice(0, -2);
  return s;
}

export default function InvoiceDetailForm({
  invoice,
  busy,
  onConfirm,
  onOpen,
}: {
  invoice: Invoice;
  busy: boolean;
  onConfirm: (payload: Record<string, unknown>) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const cache = useQueryClient();
  const [acceptSeparate, setAcceptSeparate] = useState(false);
  const categories = useQuery<Category[]>({
    queryKey: ["categories", "all"],
    queryFn: async () => (await api.get("/categories", { params: { status: "all" } })).data,
  });
  const [form, setForm] = useState({
    merchant_name: invoice.merchant_name || "",
    merchant_address: invoice.merchant_address || "",
    invoice_date: invoice.invoice_date || "",
    invoice_time: invoice.invoice_time || "",
    invoice_number: invoice.invoice_number || "",
    invoice_symbol: invoice.invoice_symbol || "",
    merchant_tax_code: invoice.merchant_tax_code || "",
    payment_method: invoice.payment_method || "",
    subtotal_amount: cleanMoneyNumber(invoice.subtotal_amount),
    total_amount: cleanMoneyNumber(invoice.total_amount),
    tax_amount: cleanMoneyNumber(invoice.tax_amount ?? 0),
    category_id: invoice.category_id || "",
    note: invoice.note || "",
  });
  const [tab, setTab] = useState("form"),
    [duplicateAccepted, setDuplicateAccepted] = useState(false),
    [newCategory, setNewCategory] = useState(""),
    [adding, setAdding] = useState(false),
    [categoryBusy, setCategoryBusy] = useState(false),
    [restoreCategory, setRestoreCategory] = useState<ArchivedCategory | null>(null),
    [itemDrafts, setItemDrafts] = useState(() =>
      (invoice.items || []).map((item) => ({
        name: item.name || "",
        sku: item.sku || "",
        unit: item.unit || "",
        quantity: cleanMoneyNumber(item.quantity),
        unit_price: cleanMoneyNumber(item.unit_price),
        discount_amount: cleanMoneyNumber(item.discount_amount),
        tax_amount: cleanMoneyNumber(item.tax_amount),
        line_total: cleanMoneyNumber(item.line_total),
      })),
    ),
    [itemsBusy, setItemsBusy] = useState(false),
    [itemsNotice, setItemsNotice] = useState(""),
    [categorySuggestion, setCategorySuggestion] = useState<{ category_id: string; category_name: string; confidence: number; reason: string } | null>(null),
    [categoryTouched, setCategoryTouched] = useState(false),
    [error, setError] = useState("");
  const [review, setReview] = useState<DuplicateCheck | null>(invoice.duplicate_check || null);
  const [checking, setChecking] = useState(false);
  const [revision, setRevision] = useState(invoice.revision);
  const [versionConflict, setVersionConflict] = useState(false);
  const locked = !!invoice.deleted_at || invoice.status === "CONFIRMED" || invoice.status === "PROCESSING" || busy || checking;
  const field = (key: string, value: string) => {
    setReview(null); setDuplicateAccepted(false);
    setForm((f) => ({ ...f, [key]: value }));
  };
  const identityFields = () => ({
    merchant_name: form.merchant_name, merchant_address: form.merchant_address,
    merchant_tax_code: form.merchant_tax_code || null, invoice_number: form.invoice_number || null,
    invoice_symbol: form.invoice_symbol || null, invoice_date: form.invoice_date || null,
    invoice_time: form.invoice_time || null, total_amount: form.total_amount || null,
    items: itemDrafts.map(item => ({
      name: item.name.trim(), sku: item.sku.trim() || null, unit: item.unit.trim() || null,
      quantity: item.quantity === "" ? null : Number(item.quantity),
      unit_price: item.unit_price === "" ? null : Number(item.unit_price),
      discount_amount: item.discount_amount === "" ? null : Number(item.discount_amount),
      tax_amount: item.tax_amount === "" ? null : Number(item.tax_amount),
      line_total: item.line_total === "" ? null : Number(item.line_total),
    })),
  });
  const inspect = async () => {
    const { data } = await api.post<DuplicateCheck>(`/invoices/${invoice.id}/duplicate-check`, identityFields());
    return data;
  };
  const hasDuplicateData = Boolean((form.merchant_name.trim() || form.merchant_address.trim()) && (form.invoice_date || form.invoice_number.trim()));
  const automaticCheckError = useAutomaticDuplicateCheck({
    invoiceId: invoice.id, payload: JSON.stringify(identityFields()),
    enabled: hasDuplicateData && !locked && !versionConflict,
    onResult: setReview, onAccept: setDuplicateAccepted,
  });
  const sameInvoice = async (id: string) => {
    setChecking(true); setError("");
    try {
      await invoiceMutation(invoice.id, "duplicate-resolution", { expected_revision: revision, action: "SAME_INVOICE", matched_invoice_id: id });
      await cache.invalidateQueries({ queryKey: ["invoices"] });
      onOpen(id);
    } catch (e) { setError(invoiceError(e).message); } finally { setChecking(false); }
  };
  const reloadRevision = async () => {
    setChecking(true);
    try {
      const { data } = await api.get<Invoice>(`/invoices/${invoice.id}`);
      cache.setQueryData(["invoice", invoice.id], data);
      setRevision(data.revision); setReview(null); setDuplicateAccepted(false); setVersionConflict(false); setError("");
    } catch (e) { setError(invoiceError(e).message); } finally { setChecking(false); }
  };
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
    if (itemDrafts.some((item) => !item.name.trim())) {
      setError("Tên mặt hàng không được để trống.");
      return;
    }
    const numeric = (value: string) => (value === "" ? null : Number(value));
    if (locked || versionConflict) return;
    setChecking(true);
    try {
    const current = await inspect();
    setReview(current);
    if (current.level === "EXACT" || (current.level === "SUSPECTED" && (!duplicateAccepted || review?.review_token !== current.review_token))) {
      setDuplicateAccepted(false); setError("Hãy đối chiếu thông tin dưới đây trước khi ghi nhận."); return;
    }
    await onConfirm({
      ...form,
      ...identityFields(),
      expected_revision: revision,
      accept_separate_record: acceptSeparate,
      accept_distinct: current.level === "SUSPECTED" && duplicateAccepted,
      duplicate_review_token: current.level === "SUSPECTED" ? current.review_token : null,
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
    } catch (e) {
      const problem = invoiceError(e); setError(problem.message);
      if (problem.duplicate_check) setReview(problem.duplicate_check);
      if (problem.code === "INVOICE_VERSION_CONFLICT") setVersionConflict(true);
      if (problem.code !== "INVOICE_RETRY_REQUIRED") setDuplicateAccepted(false);
    } finally { setChecking(false); }
  };
  const updateItem = (index: number, key: string, value: string) => {
    setReview(null); setDuplicateAccepted(false);
    setItemDrafts((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  };
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
      const { data: latest } = await api.get<Invoice>(`/invoices/${invoice.id}`);
      setRevision(latest.revision); setReview(null); setDuplicateAccepted(false);
      setItemsNotice("Đã lưu các mặt hàng đã hiệu chỉnh.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setItemsBusy(false);
    }
  };
  const addCategory = async () => {
    if (locked || categoryBusy || !newCategory.trim()) return;
    setCategoryBusy(true);
    setError("");
    try {
      const { data } = await api.post("/categories", {
        name: newCategory.trim(),
        type: "EXPENSE",
      });
      await cache.invalidateQueries({ queryKey: ["categories"] });
      field("category_id", data.id);
      setCategoryTouched(true);
      setCategorySuggestion(null);
      setAdding(false);
      setNewCategory("");
    } catch (e) {
      const category = archivedCategoryFromError(e);
      if (category) setRestoreCategory(category);
      else setError(categoryErrorMessage(e));
    } finally {
      setCategoryBusy(false);
    }
  };
  const restore = async () => {
    if (!restoreCategory || locked || categoryBusy) return;
    setCategoryBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/categories/${restoreCategory.id}/restore`, {});
      await cache.invalidateQueries({ queryKey: ["categories"] });
      field("category_id", data.id);
      setCategoryTouched(true);
      setCategorySuggestion(null);
      setRestoreCategory(null);
      setAdding(false);
      setNewCategory("");
    } catch (e) {
      setError(categoryErrorMessage(e));
    } finally {
      setCategoryBusy(false);
    }
  };
  return (
    <div className="cf-panel-body cf-stack" style={{ gap: 18 }}>
      {!locked && error.includes("Có khoản thanh toán") && <label><input type="checkbox" checked={acceptSeparate} onChange={e => setAcceptSeparate(e.target.checked)} />Tôi đã đối chiếu và xác nhận đây là khoản khác với khoản thanh toán ví.</label>}
      {!invoice.deleted_at && invoice.status !== "CONFIRMED" && <>
        {invoice.duplicate_of_invoice_id && <div className="cf-row">
          <button type="button" className="cf-btn" onClick={() => onOpen(invoice.duplicate_of_invoice_id!)}>Mở bản gốc đã liên kết</button>
          <button type="button" className="cf-btn" disabled={locked} onClick={async () => {
            setChecking(true);
            try { const result = await invoiceMutation<{ revision: number }>(invoice.id, "duplicate-resolution", { expected_revision: revision, action: "CLEAR" }); setRevision(result.revision); await cache.invalidateQueries({ queryKey: ["invoice", invoice.id] }); setReview(null); setDuplicateAccepted(false); }
            catch (e) { setError(invoiceError(e).message); } finally { setChecking(false); }
          }}>Bỏ liên kết trùng để kiểm tra lại</button>
        </div>}
        {automaticCheckError && <Alert persistent kind="info">{automaticCheckError}</Alert>}
        {!hasDuplicateData && <p className="cf-muted">Chưa đủ thông tin để đối chiếu. Hệ thống sẽ tự kiểm tra trùng sau khi quét hoặc nhập thông tin hóa đơn.</p>}
        {hasDuplicateData && invoice.status !== "PROCESSING" && <InvoiceDuplicateReview check={review} busy={locked} accepted={duplicateAccepted} onAccept={setDuplicateAccepted} onOpen={onOpen} onSame={sameInvoice} />}
      </>}
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
      {invoice.status === "CONFIRMED" && (
        <Alert persistent kind="success">
          Hóa đơn đã được ghi nhận. <Link className="cf-inline-link" href={`/transactions?invoice_id=${invoice.id}`}>Xem giao dịch liên quan</Link>. Nếu cần sửa hóa đơn, hãy xóa giao dịch trước để hoàn tiền về ví và mở lại bước kiểm tra.
        </Alert>
      )}
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
          {versionConflict && <button type="button" className="cf-btn" disabled={checking} onClick={reloadRevision}>Tải phiên bản mới, giữ nội dung đang sửa</button>}

          <fieldset
            disabled={locked}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            <div className="cf-form cf-invoice-fields">
              {/* Nhóm 1: Thông tin người bán */}
              <div className="cf-invoice-section">
                <div className="cf-invoice-section-title">
                  <Store size={14} aria-hidden="true" />
                  <span>Thông tin người bán</span>
                </div>
                <Field label="Đơn vị bán hàng">
                  <input
                    className="cf-input"
                    required
                    maxLength={255}
                    value={form.merchant_name}
                    placeholder="Tên công ty, cửa hàng..."
                    onChange={(e) => field("merchant_name", e.target.value)}
                  />
                </Field>
                <Field label="Địa chỉ đơn vị bán hàng">
                  <input
                    className="cf-input"
                    maxLength={500}
                    value={form.merchant_address}
                    placeholder="Địa chỉ kinh doanh..."
                    onChange={(e) => field("merchant_address", e.target.value)}
                  />
                </Field>
                <Field label="Mã số thuế người bán">
                  <input
                    className="cf-input"
                    maxLength={100}
                    value={form.merchant_tax_code}
                    placeholder="Mã số thuế..."
                    onChange={(e) => field("merchant_tax_code", e.target.value)}
                  />
                </Field>
              </div>

              {/* Nhóm 2: Chứng từ & Thời gian */}
              <div className="cf-invoice-section">
                <div className="cf-invoice-section-title">
                  <Receipt size={14} aria-hidden="true" />
                  <span>Chứng từ & Thời gian</span>
                </div>
                <div className="cf-invoice-two-columns">
                  <Field label="Số hóa đơn">
                    <input
                      className="cf-input"
                      maxLength={100}
                      value={form.invoice_number}
                      placeholder="Số HĐ..."
                      onChange={(e) => field("invoice_number", e.target.value)}
                    />
                  </Field>
                  <Field label="Ký hiệu hóa đơn">
                    <input
                      className="cf-input"
                      maxLength={100}
                      value={form.invoice_symbol}
                      placeholder="Ký hiệu mẫu..."
                      onChange={(e) => field("invoice_symbol", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="cf-invoice-two-columns">
                  <Field label="Ngày lập hóa đơn">
                    <DateInput required value={form.invoice_date} onChange={(value) => field("invoice_date", value)} />
                  </Field>
                  <Field label="Giờ lập (nếu có)">
                    <input
                      className="cf-input"
                      type="time"
                      step="1"
                      value={form.invoice_time}
                      onChange={(e) => field("invoice_time", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="cf-invoice-two-columns">
                  <Field label="Hình thức thanh toán" hint="TM, CK, TM/CK, thẻ…">
                    <input
                      className="cf-input"
                      maxLength={50}
                      value={form.payment_method}
                      placeholder="TM, CK, thẻ..."
                      onChange={(e) => field("payment_method", e.target.value)}
                    />
                  </Field>
                  <Field label="File nguồn">
                    <div className="cf-readonly-value">
                      <FileText size={15} aria-hidden="true" />
                      <span className="cf-file-name">{invoice.original_filename || "Không xác định"}</span>
                    </div>
                  </Field>
                </div>
              </div>

              {/* Nhóm 3: Chi phí & Thanh toán */}
              <div className="cf-invoice-section cf-invoice-financials">
                <div className="cf-invoice-section-title">
                  <CreditCard size={14} aria-hidden="true" />
                  <span>Chi phí & Thanh toán</span>
                </div>
                <div className="cf-invoice-two-columns">
                  <Field label="Doanh số chưa thuế">
                    <div className="cf-amount-input-box">
                      <input
                        className="cf-amount-input-control cf-number"
                        type="number"
                        min="0"
                        step="1"
                        value={form.subtotal_amount}
                        placeholder="0"
                        onChange={(e) => field("subtotal_amount", e.target.value)}
                      />
                      <span className="cf-amount-currency-suffix">đ</span>
                    </div>
                  </Field>
                  <Field label="Tiền thuế GTGT">
                    <div className="cf-amount-input-box">
                      <input
                        className="cf-amount-input-control cf-number"
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={form.tax_amount}
                        placeholder="0"
                        onChange={(e) => field("tax_amount", e.target.value)}
                      />
                      <span className="cf-amount-currency-suffix">đ</span>
                    </div>
                  </Field>
                </div>
                <div className="cf-invoice-total-field">
                  <Field
                    label="Tổng thanh toán"
                    hint="Tổng tiền đã bao gồm thuế. Đây là số tiền ghi nhận vào khoản chi."
                  >
                    <div className="cf-amount-input-box is-total">
                      <input
                        className="cf-amount-input-control cf-number"
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={form.total_amount}
                        placeholder="0"
                        onChange={(e) => field("total_amount", e.target.value)}
                      />
                      <span className="cf-amount-currency-suffix">đ</span>
                    </div>
                  </Field>
                </div>
              </div>

              {/* Nhóm 4: Phân loại & Ghi chú */}
              <div className="cf-invoice-section">
                <div className="cf-invoice-section-title">
                  <Tag size={14} aria-hidden="true" />
                  <span>Phân loại & Ghi chú</span>
                </div>
                <Field label="Danh mục chi tiêu">
                  <select
                    className="cf-input"
                    value={form.category_id}
                    onChange={(e) => { field("category_id", e.target.value); setCategoryTouched(true); setCategorySuggestion(null); }}
                  >
                    <option value="">Chưa phân loại</option>
                    {categories.data
                      ?.filter((c) => c.type === "EXPENSE" && (c.is_active || c.id === form.category_id))
                      .map((c) => (
                        <option key={c.id} value={c.id} disabled={!c.is_active}>
                          {c.name}{!c.is_active ? " (đã ẩn)" : ""}
                        </option>
                      ))}
                  </select>
                </Field>
                {categorySuggestion && (
                  <div className="cf-category-suggestion" role="status">
                    <div><strong>Gợi ý: {categorySuggestion.category_name}</strong><span>{Math.round(categorySuggestion.confidence * 100)}% · {categorySuggestion.reason}</span></div>
                    <button type="button" className="cf-btn cf-btn-sm" onClick={() => { field("category_id", categorySuggestion.category_id); setCategoryTouched(true); setCategorySuggestion(null); }}>Chọn danh mục</button>
                  </div>
                )}
                {adding ? (
                  <div className="cf-row" style={{ gap: 8 }}>
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
                      className="cf-btn cf-btn-primary cf-btn-sm"
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
                      style={{ alignSelf: "flex-start", marginTop: -4 }}
                      onClick={() => setAdding(true)}
                    >
                      <Plus size={14} aria-hidden="true" />
                      Thêm danh mục
                    </button>
                  )
                )}
                <Field label="Ghi chú">
                  <textarea
                    className="cf-input"
                    rows={2}
                    value={form.note}
                    placeholder="Ghi chú thêm về khoản chi..."
                    onChange={(e) => field("note", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </fieldset>
          {!invoice.deleted_at && invoice.status !== "CONFIRMED" && (
            <button
              className="cf-btn cf-btn-primary cf-invoice-submit-btn"
              disabled={
                locked ||
                categoryBusy || versionConflict
              }
            >
              <Check size={16} aria-hidden="true" />
              {busy ? "Đang lưu…" : "Xác nhận & ghi nhận khoản chi"}
            </button>
          )}
        </form>
      )}
      {restoreCategory && <CategoryRestoreModal category={restoreCategory} error={error} busy={categoryBusy} onConfirm={restore} onClose={() => { setRestoreCategory(null); setError(""); }} />}
    </div>
  );
}
