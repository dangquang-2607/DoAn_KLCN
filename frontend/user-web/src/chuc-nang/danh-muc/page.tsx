"use client";

/** Điều phối CRUD, tìm kiếm và phân loại danh mục; UI chi tiết nằm trong `thanh-phan`. */
import density from "@/dung-chung/CSS/workspace-density.module.css";
import styles from "./CSS/categories.module.css";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, ErrorState, Loading, PageHead } from "@/dung-chung/UI-chung/ui";
import { type Category } from "@/dung-chung/nghiep-vu/finance";
import { useCategories, archivedCategoryFromError, categoryErrorMessage, type ArchivedCategory } from "@/dung-chung/nghiep-vu/danh-muc/categories";
import CategoryRestoreModal from "@/dung-chung/nghiep-vu/danh-muc/CategoryRestoreModal";
import CategoryDeleteModal from "./thanh-phan/CategoryDeleteModal";
import CategoryModal, { type CategoryForm } from "./thanh-phan/CategoryModal";
import CategoryTable from "./thanh-phan/CategoryTable";

const emptyForm = (type = "EXPENSE"): CategoryForm => ({ name: "", type, icon: "package", color: "cobalt", keywords: "" });

export default function Categories() {
  const cache = useQueryClient();
  const query = useCategories();
  const archived = useCategories("archived");
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
  const open = (category?: Category) => {
    setRestoring(null);
    setEditing(category || null);
    setForm(
      category
        ? {
            name: category.name,
            type: category.type,
            icon: category.icon || "package",
            color: category.color || "cobalt",
            keywords: category.keywords || "",
          }
        : emptyForm(type),
    );
    setError("");
    setShow(true);
  };
  const refresh = () => Promise.all(["categories", "transactions", "budgets", "analytics", "dashboard", "invoice"].map(key => cache.invalidateQueries({ queryKey: [key] })));
  // Chuẩn hóa tên/từ khóa trước khi tạo hoặc cập nhật danh mục cá nhân.
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    const payload = { ...form, name: form.name.trim(), keywords: form.keywords.trim() || null };
    try {
      if (editing) await api.patch("/categories/" + editing.id, payload);
      else await api.post("/categories", payload);
      await refresh();
      setShow(false);
      setStatus("active");
      setType(form.type);
      setNotice(editing ? "Đã cập nhật danh mục." : "Đã tạo danh mục cá nhân.");
    } catch (caught) {
      const category = !editing ? archivedCategoryFromError(caught) : null;
      if (category) setRestoring({ category, draft: { ...form } });
      else setError(categoryErrorMessage(caught));
    } finally {
      setBusy(false);
    }
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
  const list = (current.data || []).filter((category) => category.type === type && category.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return (
    <div className={`cf-stack ${density.workspace}`}>
      <PageHead
        eyebrow="TỔ CHỨC DỮ LIỆU"
        title="Danh mục"
        description="Phân loại khoản thu và chi bằng danh mục hệ thống hoặc danh mục riêng."
        actions={
          <button className="cf-btn cf-btn-primary" onClick={() => open()}>
            <Plus />
            Tạo danh mục
          </button>
        }
      />
      <div className={density.content}>
        {notice && (
          <Alert kind="success" onDismiss={() => setNotice("")}>
            {notice}
          </Alert>
        )}
        <div
          className="cf-row cf-between"
          style={{ flexWrap: "wrap", gap: "12px", alignItems: "center" }}
        >
          <div
            className="cf-row"
            style={{ gap: "12px", alignItems: "center", flexWrap: "wrap" }}
          >
            {/* Nhóm tab Loại danh mục */}
            <div className="cf-tabs" role="tablist" aria-label="Loại danh mục">
              {[
                ["EXPENSE", "Chi tiêu"],
                ["INCOME", "Thu nhập"],
              ].map(([value, label]) => (
                <button key={value} role="tab" aria-selected={type === value} onClick={() => setType(value)} > {label} </button>
              ))}
            </div>

            <div style={{ width: "1px", height: "22px", background: "var(--cf-line, #e2e8f0)", }} />

            {/* Nhóm tab Trạng thái danh mục */}
            <div
              className="cf-tabs"
              role="tablist"
              aria-label="Trạng thái danh mục"
            >
              {[
                ["active", "Đang dùng"],
                ["archived", "Đã ẩn"],
              ].map(([value, label]) => (
                <button key={value} role="tab" aria-selected={status === value} onClick={() => setStatus(value)} > {label} {value === "archived" && archived.data ? ` (${archived.data.length})` : ""} </button>
              ))}
            </div>
          </div>

          {/* Ô tìm kiếm danh mục */}
          <div className={`cf-search ${styles.search}`}>
            <Search />
            <input
              className="cf-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Tìm danh mục"
              placeholder="Tìm danh mục…"
            />
          </div>
        </div>
        {current.isPending ? (
          <Loading />
        ) : current.isError ? (
          <ErrorState retry={() => current.refetch()} />
        ) : (
          <CategoryTable
            key={`${status}:${type}`}
            categories={list}
            filtered={!!search.trim()}
            onClearFilter={() => setSearch("")}
            archived={status === "archived"}
            onEdit={open}
            onDelete={(category) => {
              setDeleting(category);
              setError("");
            }}
            onRestore={(category) => {
              setRestoring({ category, draft: null });
              setError("");
            }}
          />
        )}
      </div>
      {show && !restoring && (
        <CategoryModal
          editing={editing}
          form={form}
          error={error}
          busy={busy}
          onChange={setForm}
          onSubmit={save}
          onClose={() => setShow(false)}
          onClearError={() => setError("")}
        />
      )}
      {deleting && (
        <CategoryDeleteModal
          category={deleting}
          error={error}
          busy={busy}
          onConfirm={remove}
          onClose={() => setDeleting(null)}
          onClearError={() => setError("")}
        />
      )}
      {restoring && (
        <CategoryRestoreModal
          layout={{ dialog: `${density.dialog} ${density.compact}`, form: density.form, fields: density.fields, footer: density.footer }}
          category={restoring.category}
          updateMetadata={!!restoring.draft}
          error={error}
          busy={busy}
          onConfirm={restore}
          onClose={() => {
            setRestoring(null);
            setError("");
          }}
        />
      )}
    </div>
  );
}
