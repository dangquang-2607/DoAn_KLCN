import { CategoryIcon } from "../../../dung-chung/UI-chung/CategoryIcon";
import { Empty } from "../../../dung-chung/UI-chung/design";
import { ChevronRight } from "lucide-react";

export default function CategoryList({ list, onCreate, selectedId, onSelect }) {
  if (!list.length) return <Empty title="Không có danh mục phù hợp" action={<button className="cf-btn" onClick={onCreate}>Thêm danh mục</button>} />;
  return <ul className="adm-category-list" aria-label="Danh sách danh mục hệ thống">{list.map((category) => <li key={category.id}>
    <button type="button" className={`adm-category-row${selectedId === category.id ? " is-selected" : ""}${category.is_active ? "" : " is-inactive"}`} aria-pressed={selectedId === category.id} onClick={() => onSelect(category.id)}>
      <CategoryIcon icon={category.icon} color={category.color} size={38} />
      <span className="adm-category-row-name"><strong>{category.name}</strong><small>{category.type === "INCOME" ? "Khoản thu" : "Khoản chi"}</small></span>
      <span className={`adm-rest-pill adm-rest-pill--${category.is_active ? "active" : "banned"}`}>{category.is_active ? "Đang dùng" : "Ngừng dùng"}</span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  </li>)}</ul>;
}
