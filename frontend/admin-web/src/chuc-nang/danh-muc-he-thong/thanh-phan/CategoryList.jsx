/**
 * ============================================================================
 * TÊN FILE: CategoryList.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Quản lý Danh mục hệ thống
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị danh sách danh mục thu - chi mặc định của toàn hệ thống,
 *   cho phép quản trị viên xem, phân loại, tìm kiếm và quản lý biểu tượng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props categories, onSelect callback, các hàm tiện ích phân loại danh mục.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export CategoryList component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Danh mục hệ thống là dùng chung cho mọi người dùng mới tạo tài khoản.
 * ============================================================================
 */
import { CategoryIcon } from "../../../dung-chung/UI-chung/CategoryIcon";
import { Empty } from "../../../dung-chung/UI-chung/design";
import { ChevronRight } from "lucide-react";

/**
 * Danh sách bảng hiển thị danh mục thu chi chuẩn của hệ thống.
 */
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
