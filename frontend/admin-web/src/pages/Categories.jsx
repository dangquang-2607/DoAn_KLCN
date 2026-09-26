/**
 * ============================================================================
 * TÊN FILE: Categories.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Danh mục hệ thống
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối truy vấn, bộ lọc và mutation tạo/sửa/bật-tắt/sắp xếp danh mục.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React Query, admin API client và các component trong components/categories.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất route Categories với thông báo thành công và lỗi nghiệp vụ.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không có thao tác xóa; ngừng sử dụng được thực hiện bằng is_active.
 * ============================================================================
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import CategoryFilters from "../components/categories/CategoryFilters";
import CategoryList from "../components/categories/CategoryList";
import CategoryModal from "../components/categories/CategoryModal";
import { Alert, ErrorState, Loading, PageHead } from "../components/design";
import api from "../services/api";

function message(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(". ");
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

export default function Categories() {
  const cache = useQueryClient();
  const [type, setType] = useState("EXPENSE");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("package");
  const [color, setColor] = useState("cobalt");
  const [keywords, setKeywords] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: ["admin-categories"], queryFn: async () => (await api.get("/admin/categories", { params: { include_inactive: true } })).data });
  const allForType = (query.data || []).filter((category) => category.type === type).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "vi"));
  const list = allForType.filter((category) => (status === "ALL" || (status === "ACTIVE") === category.is_active) && category.name.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")));

  const openCreate = () => {
    setEditing(null); setName(""); setIcon("package"); setColor("cobalt"); setKeywords(""); setIsActive(true); setError(""); setShow(true);
  };
  const openEdit = (category) => {
    setEditing(category); setName(category.name); setIcon(category.icon || "package"); setColor(category.color || "cobalt"); setKeywords(category.keywords || ""); setIsActive(category.is_active); setError(""); setShow(true);
  };

  // Tạo hoặc cập nhật nhưng giữ cùng payload và endpoint như trước khi tách file.
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    const payload = { name: name.trim(), type, icon, color, keywords: keywords.trim() || null, is_active: isActive };
    try {
      if (editing) await api.patch(`/admin/categories/${editing.id}`, payload);
      else await api.post("/admin/categories", payload);
      await cache.invalidateQueries({ queryKey: ["admin-categories"] });
      setShow(false); setNotice(editing ? "Đã cập nhật danh mục hệ thống." : "Đã tạo danh mục hệ thống.");
    } catch (caught) { setError(message(caught)); } finally { setBusy(false); }
  };

  // Bật/tắt thay cho xóa để không phá liên kết của giao dịch hiện có.
  const toggle = async (category) => {
    setBusy(true); setError("");
    try {
      await api.patch(`/admin/categories/${category.id}`, { is_active: !category.is_active });
      await cache.invalidateQueries({ queryKey: ["admin-categories"] });
      setNotice(category.is_active ? "Đã ngừng sử dụng danh mục." : "Đã kích hoạt lại danh mục.");
    } catch (caught) { setError(message(caught)); } finally { setBusy(false); }
  };

  // Backend nhận toàn bộ ordered_ids, vì vậy phải hoán đổi cục bộ rồi gửi danh sách hoàn chỉnh.
  const move = async (category, delta) => {
    const index = allForType.findIndex((item) => item.id === category.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= allForType.length) return;
    const next = [...allForType];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true); setError("");
    try {
      await api.put("/admin/categories/reorder", { type, ordered_ids: next.map((item) => item.id) });
      await cache.invalidateQueries({ queryKey: ["admin-categories"] });
      setNotice("Đã cập nhật thứ tự danh mục.");
    } catch (caught) { setError(message(caught)); } finally { setBusy(false); }
  };

  return (
    <div className="cf-stack">
      <PageHead eyebrow="DANH MỤC DÙNG CHUNG" title="Danh mục hệ thống" description="Tạo và chuẩn hóa danh mục mặc định dùng chung cho mọi người dùng." actions={<button className="cf-btn cf-btn-primary" onClick={openCreate}><Plus />Thêm danh mục</button>} />
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      {error && !show && <Alert onDismiss={() => setError("")}>{error}</Alert>}
      <CategoryFilters type={type} status={status} search={search} onTypeChange={setType} onStatusChange={setStatus} onSearchChange={setSearch} />
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : <CategoryList list={list} allForType={allForType} busy={busy} onCreate={openCreate} onEdit={openEdit} onToggle={toggle} onMove={move} />}
      {show && <CategoryModal editing={editing} type={type} name={name} icon={icon} color={color} keywords={keywords} isActive={isActive} busy={busy} error={error} onTypeChange={setType} onNameChange={setName} onIconChange={setIcon} onColorChange={setColor} onKeywordsChange={setKeywords} onActiveChange={setIsActive} onDismissError={() => setError("")} onClose={() => setShow(false)} onSubmit={save} />}
    </div>
  );
}
