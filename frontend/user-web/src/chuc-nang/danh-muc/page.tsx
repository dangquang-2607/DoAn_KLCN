/**
 * ============================================================================
 * TÊN FILE: page.tsx
 * MÀN HÌNH / PHÂN HỆ: Danh mục
 * NHÓM VỆ TINH: page.tsx (Điều phối)
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối dữ liệu, trạng thái và hành vi của màn hình tương ứng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   TanStack Query, API client, state React và các component vệ tinh của phân hệ.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất page để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ danh mục cá nhân được sửa/ẩn; lịch sử giao dịch và ngân sách phải được giữ nguyên.
 * ============================================================================
 */
"use client";

/** Điều phối CRUD, tìm kiếm và phân loại danh mục; UI chi tiết nằm trong `thanh-phan`. */
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, ErrorState, Loading, PageHead } from "@/dung-chung/UI-chung/ui";
import { type Category } from "@/dung-chung/nghiep-vu/finance";
import { archivedCategoryFromError, categoryErrorMessage, type ArchivedCategory } from "@/dung-chung/nghiep-vu/danh-muc/categories";
import CategoryRestoreModal from "@/dung-chung/nghiep-vu/danh-muc/CategoryRestoreModal";
import CategoryDeleteModal from "./thanh-phan/CategoryDeleteModal";
import CategoryModal, { type CategoryForm } from "./thanh-phan/CategoryModal";
import CategoryTable from "./thanh-phan/CategoryTable";

const emptyForm = (type = "EXPENSE"): CategoryForm => ({ name: "", type, icon: "package", color: "cobalt", keywords: "" });

export default function Categories() {
  const cache = useQueryClient();
  const query = useQuery<Category[]>({ queryKey: ["categories"], queryFn: async () => (await api.get("/categories")).data });
  const archived = useQuery<Category[]>({ queryKey: ["categories", "archived"], queryFn: async () => (await api.get("/categories", { params: { status: "archived" } })).data });
  const [type, setType] = useState("EXPENSE");
  const [status, setStatus] = useState("active");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [restoring, setRestoring] = useState<{ category: ArchivedCategory; draft: CategoryForm | null } | null>(null);
  const [form, setForm] = useState<CategoryForm>(() => emptyForm());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  // Nạp dữ liệu danh mục đang sửa hoặc tạo form rỗng theo tab thu/chi hiện tại.
  const open = (category?: Category) => { setRestoring(null); setEditing(category || null); setForm(category ? { name: category.name, type: category.type, icon: category.icon || "package", color: category.color || "cobalt", keywords: category.keywords || "" } : emptyForm(type)); setError(""); setShow(true); };
  const refresh = () => Promise.all(["categories", "transactions", "budgets", "analytics", "dashboard", "invoice"].map(key => cache.invalidateQueries({ queryKey: [key] })));
  // Chuẩn hóa tên/từ khóa trước khi tạo hoặc cập nhật danh mục cá nhân.
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    const payload = { ...form, name: form.name.trim(), keywords: form.keywords.trim() || null };
    try { if (editing) await api.patch("/categories/" + editing.id, payload); else await api.post("/categories", payload); await refresh(); setShow(false); setStatus("active"); setType(form.type); setNotice(editing ? "Đã cập nhật danh mục." : "Đã tạo danh mục cá nhân."); }
    catch (caught) {
      const category = !editing ? archivedCategoryFromError(caught) : null;
      if (category) setRestoring({ category, draft: { ...form } });
      else setError(categoryErrorMessage(caught));
    } finally { setBusy(false); }
  };
  // Ẩn danh mục khỏi lựa chọn mới; không xóa liên kết lịch sử ở giao dịch/ngân sách.
  const remove = async () => {
    if (!deleting) return; setBusy(true); setError("");
    try { await api.delete("/categories/" + deleting.id); await refresh(); setDeleting(null); setNotice("Đã ẩn danh mục. Bạn có thể sử dụng lại tại mục Đã ẩn."); }
    catch (caught) { setError(categoryErrorMessage(caught)); } finally { setBusy(false); }
  };
  const restore = async () => {
    if (!restoring) return;
    setBusy(true); setError("");
    const { category, draft } = restoring;
    try {
      await api.post(`/categories/${category.id}/restore`, draft
        ? { icon: draft.icon, color: draft.color, keywords: draft.keywords.trim() || null } : {});
      await refresh();
      setRestoring(null); setShow(false); setStatus("active"); setType(category.type); setSearch("");
      setNotice(`Đã khôi phục danh mục “${category.name}”.`);
    } catch (caught) { setError(categoryErrorMessage(caught)); } finally { setBusy(false); }
  };
  const current = status === "archived" ? archived : query;
  const list = (current.data || []).filter((category) => category.type === type && category.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <div className="cf-stack">
    <PageHead eyebrow="TỔ CHỨC DỮ LIỆU" title="Danh mục" description="Phân loại khoản thu và chi bằng danh mục hệ thống hoặc danh mục riêng." actions={<button className="cf-btn cf-btn-primary" onClick={() => open()}><Plus />Tạo danh mục</button>} />
    {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
    <div className="cf-tabs" role="tablist" aria-label="Trạng thái danh mục">
      {[["active", "Đang dùng"], ["archived", "Đã ẩn"]].map(([value, label]) => <button key={value} role="tab" aria-selected={status === value} onClick={() => setStatus(value)}>{label}{value === "archived" && archived.data ? ` (${archived.data.length})` : ""}</button>)}
    </div>
    <div className="cf-row cf-between"><div className="cf-tabs" role="tablist" aria-label="Loại danh mục">{[["EXPENSE", "Chi tiêu"], ["INCOME", "Thu nhập"]].map(([value, label]) => <button key={value} role="tab" aria-selected={type === value} onClick={() => setType(value)}>{label}</button>)}</div><div className="cf-search"><Search /><input className="cf-input" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Tìm danh mục" placeholder="Tìm danh mục…" /></div></div>
    {current.isPending ? <Loading /> : current.isError ? <ErrorState retry={() => current.refetch()} /> : <CategoryTable key={`${status}:${type}`} categories={list} archived={status === "archived"} onEdit={open} onDelete={(category) => { setDeleting(category); setError(""); }} onRestore={(category) => { setRestoring({ category, draft: null }); setError(""); }} />}
    {show && !restoring && <CategoryModal editing={editing} form={form} error={error} busy={busy} onChange={setForm} onSubmit={save} onClose={() => setShow(false)} onClearError={() => setError("")} />}
    {deleting && <CategoryDeleteModal category={deleting} error={error} busy={busy} onConfirm={remove} onClose={() => setDeleting(null)} onClearError={() => setError("")} />}
    {restoring && <CategoryRestoreModal category={restoring.category} updateMetadata={!!restoring.draft} error={error} busy={busy} onConfirm={restore} onClose={() => { setRestoring(null); setError(""); }} />}
  </div>;
}
