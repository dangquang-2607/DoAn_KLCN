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
import { Plus, Tags, Search, Pencil, PauseCircle, PlayCircle } from "lucide-react";
import { useState } from "react";
import CategoryOrderControls from "./thanh-phan/CategoryOrderControls";
import CategoryList from "./thanh-phan/CategoryList";
import CategoryModal from "./thanh-phan/CategoryModal";
import { Alert, ErrorState, Loading } from "../../dung-chung/UI-chung/design";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import api from "../../dung-chung/connect-api/api";
import Inspector from "../../dung-chung/UI-chung/Inspector";
import { CategoryIcon } from "../../dung-chung/UI-chung/CategoryIcon";

function message(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(". ");
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}

export default function Categories() {
  const cache = useQueryClient();
  const [type, setType] = useState("EXPENSE");
  const [selectedId, setSelectedId] = useState(undefined);
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
  const selectedCategory = selectedId === undefined ? list[0] : list.find((item) => item.id === selectedId);
  const position = allForType.findIndex((item) => item.id === selectedCategory?.id);

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
    <div className="adm-surface adm-live adm-rest adm-categories-demo">
      <PageHead eyebrow="DANH MỤC DÙNG CHUNG" title="Danh mục hệ thống" description="Chuẩn hóa tên, biểu tượng, từ khóa và thứ tự trước khi phân phối cho người dùng." />
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      {error && !show && <Alert onDismiss={() => setError("")}>{error}</Alert>}
      <div className="adm-category-top"><div><p className="adm-eyebrow">THƯ VIỆN DANH MỤC</p><h2>Quản lý theo loại giao dịch</h2><p>Ngừng sử dụng vẫn giữ liên kết của giao dịch cũ.</p></div><div className="adm-category-top-actions"><div className="adm-category-switch" role="group" aria-label="Loại danh mục">{[["EXPENSE", "Chi tiêu"], ["INCOME", "Thu nhập"]].map(([value, label]) => <button type="button" key={value} className={type === value ? "is-active" : ""} aria-pressed={type === value} onClick={() => { setType(value); setSelectedId(undefined); }}>{label}<span>{query.data?.filter((item) => item.type === value).length ?? "—"}</span></button>)}</div><button type="button" className="adm-rest-dark-button" onClick={openCreate}><Plus size={16} />Thêm danh mục</button></div></div>
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : <>
        <div className="adm-category-layout"><section className="adm-card adm-category-library"><div className="adm-category-filters"><label className="adm-rest-search"><Search size={17} /><span className="adm-visually-hidden">Tìm danh mục</span><input placeholder="Tìm danh mục" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedId(undefined); }} /></label><label><span className="adm-visually-hidden">Lọc trạng thái</span><select value={status} onChange={(event) => { setStatus(event.target.value); setSelectedId(undefined); }}><option value="ALL">Mọi trạng thái</option><option value="ACTIVE">Đang dùng</option><option value="INACTIVE">Ngừng dùng</option></select></label></div><div className="adm-category-count">{list.length} danh mục đang hiển thị<span>· Chọn dòng để xem cấu hình</span></div><CategoryList list={list} onCreate={openCreate} selectedId={selectedCategory?.id} onSelect={setSelectedId} /></section>
        <Inspector selectedId={selectedCategory?.id} title={selectedCategory?.name || "Chọn danh mục"} eyebrow="CẤU HÌNH DANH MỤC" className="adm-category-inspector" icon={Tags} header={selectedCategory && <CategoryIcon icon={selectedCategory.icon} color={selectedCategory.color} size={54} />} onClose={() => setSelectedId(null)}>{selectedCategory && <><span className={`adm-rest-pill adm-rest-pill--${selectedCategory.is_active ? "active" : "banned"}`}>{selectedCategory.is_active ? "Đang dùng" : "Ngừng dùng"}</span><dl className="adm-rest-dl"><div><dt>Loại giao dịch</dt><dd>{selectedCategory.type === "INCOME" ? "Thu nhập" : "Chi tiêu"}</dd></div><div><dt>Thứ tự hiển thị</dt><dd>{position + 1} / {allForType.length}</dd></div><div><dt>Mã danh mục</dt><dd>{selectedCategory.id}</dd></div></dl><div className="adm-category-keywords"><span>TỪ KHÓA NHẬN DIỆN</span><p>{selectedCategory.keywords ? selectedCategory.keywords.split(",").map((word, index) => <small key={index}>{word.trim()}</small>) : <small>Chưa thiết lập</small>}</p></div><div className="adm-category-order"><span>THỨ TỰ HIỂN THỊ</span><CategoryOrderControls name={selectedCategory.name} index={position} total={allForType.length} busy={busy} onMove={(delta) => move(selectedCategory, delta)} /></div><div className="adm-live-category-actions"><button className="adm-rest-outline-button" disabled={busy} onClick={() => openEdit(selectedCategory)}><Pencil size={16} />Chỉnh sửa danh mục</button><button className="cf-btn" disabled={busy} onClick={() => toggle(selectedCategory)}>{selectedCategory.is_active ? <PauseCircle size={16} /> : <PlayCircle size={16} />}{selectedCategory.is_active ? "Ngừng sử dụng" : "Kích hoạt lại"}</button></div><div className="adm-rest-guidance"><PauseCircle size={17} />Ngừng sử dụng thay cho xóa vĩnh viễn để giữ liên kết giao dịch.</div></>}</Inspector></div>
      </>}
      {show && <CategoryModal editing={editing} type={type} name={name} icon={icon} color={color} keywords={keywords} isActive={isActive} busy={busy} error={error} onTypeChange={setType} onNameChange={setName} onIconChange={setIcon} onColorChange={setColor} onKeywordsChange={setKeywords} onActiveChange={setIsActive} onDismissError={() => setError("")} onClose={() => setShow(false)} onSubmit={save} />}
    </div>
  );
}
