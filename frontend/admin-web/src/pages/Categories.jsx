import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, PauseCircle, Pencil, PlayCircle, Plus, Search } from "lucide-react";
import api from "../services/api";
import { Alert, Empty, ErrorState, Field, Loading, Modal, PageHead, Panel } from "../components/design";
import { CategoryColorPicker, CategoryIcon, CategoryIconPicker } from "../components/CategoryIcon";

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
  const query = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await api.get("/admin/categories", { params: { include_inactive: true } })).data,
  });
  const allForType = (query.data || []).filter((category) => category.type === type)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "vi"));
  const list = allForType.filter((category) =>
    (status === "ALL" || (status === "ACTIVE") === category.is_active) &&
    category.name.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")),
  );
  const openCreate = () => {
    setEditing(null); setName(""); setIcon("package"); setColor("cobalt"); setKeywords("");
    setIsActive(true); setError(""); setShow(true);
  };
  const openEdit = (category) => {
    setEditing(category); setName(category.name); setIcon(category.icon || "package");
    setColor(category.color || "cobalt"); setKeywords(category.keywords || ""); setIsActive(category.is_active); setError(""); setShow(true);
  };
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    const payload = { name: name.trim(), type, icon, color, keywords: keywords.trim() || null, is_active: isActive };
    try {
      if (editing) await api.patch(`/admin/categories/${editing.id}`, payload);
      else await api.post("/admin/categories", payload);
      await cache.invalidateQueries({ queryKey: ["admin-categories"] });
      setShow(false);
      setNotice(editing ? "Đã cập nhật danh mục hệ thống." : "Đã tạo danh mục hệ thống.");
    } catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  };
  const toggle = async (category) => {
    setBusy(true); setError("");
    try {
      await api.patch(`/admin/categories/${category.id}`, { is_active: !category.is_active });
      await cache.invalidateQueries({ queryKey: ["admin-categories"] });
      setNotice(category.is_active ? "Đã ngừng sử dụng danh mục." : "Đã kích hoạt lại danh mục.");
    } catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  };
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
    } catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  };
  return (
    <div className="cf-stack">
      <PageHead eyebrow="DANH MỤC DÙNG CHUNG" title="Danh mục hệ thống" description="Tạo và chuẩn hóa danh mục mặc định dùng chung cho mọi người dùng." actions={<button className="cf-btn cf-btn-primary" onClick={openCreate}><Plus />Thêm danh mục</button>} />
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      {error && !show && <Alert onDismiss={() => setError("")}>{error}</Alert>}
      <div className="cf-row cf-between">
        <div className="cf-row">
          <div className="cf-tabs" role="tablist" aria-label="Loại danh mục">
            {[["EXPENSE", "Chi tiêu"], ["INCOME", "Thu nhập"]].map(([value, label]) => <button key={value} role="tab" aria-selected={type === value} onClick={() => setType(value)}>{label}</button>)}
          </div>
          <select className="cf-input cf-compact-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Lọc trạng thái">
            <option value="ALL">Mọi trạng thái</option><option value="ACTIVE">Đang dùng</option><option value="INACTIVE">Ngừng dùng</option>
          </select>
        </div>
        <div className="cf-search"><Search /><input className="cf-input" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Tìm danh mục" placeholder="Tìm danh mục…" /></div>
      </div>
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !list.length ?
        <Panel><Empty title="Không có danh mục phù hợp" action={<button className="cf-btn" onClick={openCreate}>Tạo danh mục đầu tiên</button>} /></Panel> :
        <div className="cf-category-admin-list">
          {list.map((category) => {
            const orderIndex = allForType.findIndex((item) => item.id === category.id);
            return <Panel key={category.id} className={category.is_active ? "" : "cf-category-inactive"}>
              <div className="cf-panel-body cf-row cf-category-admin-row">
                <CategoryIcon icon={category.icon} color={category.color} />
                <div className="cf-category-copy"><h2>{category.name}</h2><p className="cf-muted">Thứ tự {orderIndex + 1} · {category.is_active ? "Đang dùng" : "Ngừng dùng"}</p></div>
                <span className={`cf-badge ${category.is_active ? "success" : ""}`}>{category.is_active ? "Hoạt động" : "Đã ẩn"}</span>
                <div className="cf-row cf-category-actions">
                  <button className="cf-icon-btn" disabled={busy || orderIndex === 0} onClick={() => move(category, -1)} aria-label={`Đưa ${category.name} lên`}><ArrowUp size={16} /></button>
                  <button className="cf-icon-btn" disabled={busy || orderIndex === allForType.length - 1} onClick={() => move(category, 1)} aria-label={`Đưa ${category.name} xuống`}><ArrowDown size={16} /></button>
                  <button className="cf-icon-btn" onClick={() => openEdit(category)} aria-label={`Sửa ${category.name}`}><Pencil size={16} /></button>
                  <button className="cf-icon-btn" disabled={busy} onClick={() => toggle(category)} aria-label={category.is_active ? `Ngừng dùng ${category.name}` : `Kích hoạt ${category.name}`}>{category.is_active ? <PauseCircle size={16} /> : <PlayCircle size={16} />}</button>
                </div>
              </div>
            </Panel>;
          })}
        </div>}
      {show && <Modal title={editing ? "Sửa danh mục hệ thống" : "Thêm danh mục hệ thống"} busy={busy} onClose={() => setShow(false)}>
        <form className="cf-form" onSubmit={save}>
          {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
          <Field label="Tên danh mục"><input className="cf-input" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Loại danh mục"><select className="cf-input" value={type} disabled={Boolean(editing)} onChange={(event) => setType(event.target.value)}><option value="EXPENSE">Chi tiêu</option><option value="INCOME">Thu nhập</option></select></Field>
          <Field label="Biểu tượng"><CategoryIconPicker value={icon} onChange={setIcon} /></Field>
          <Field label="Màu nhận diện"><CategoryColorPicker value={color} onChange={setColor} /></Field>
          <Field label="Từ khóa tự động phân loại" hint="Phân cách bằng dấu phẩy, ví dụ: nhà hàng, cơm, cà phê">
            <textarea className="cf-input" rows={3} maxLength={1000} value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="Nhập từ khóa hoặc tên người bán…" />
          </Field>
          <label className="cf-check"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Cho phép người dùng chọn danh mục này</label>
          <div className="cf-form-actions"><button type="button" className="cf-btn" disabled={busy} onClick={() => setShow(false)}>Hủy</button><button className="cf-btn cf-btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu danh mục"}</button></div>
        </form>
      </Modal>}
    </div>
  );
}
