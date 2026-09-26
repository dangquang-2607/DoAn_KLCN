/**
 * ============================================================================
 * TÊN FILE: CategoryList.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Danh mục hệ thống
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị danh mục dạng thẻ cùng các thao tác sắp xếp, sửa và bật/tắt.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Danh sách đã lọc, danh sách đầy đủ cùng loại và callback từ Categories.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất danh sách hoặc empty state; không trực tiếp gọi API.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không cung cấp thao tác xóa vì nghiệp vụ hiện tại chỉ hỗ trợ ngừng sử dụng.
 * ============================================================================
 */
import { PauseCircle, Pencil, PlayCircle } from "lucide-react";
import { CategoryIcon } from "../CategoryIcon";
import { Empty, Panel } from "../design";
import CategoryOrderControls from "./CategoryOrderControls";

export default function CategoryList({ list, allForType, busy, onCreate, onEdit, onToggle, onMove }) {
  if (!list.length) return <Panel><Empty title="Không có danh mục phù hợp" action={<button className="cf-btn" onClick={onCreate}>Tạo danh mục đầu tiên</button>} /></Panel>;
  return (
    <div className="cf-category-admin-list">
      {list.map((category) => {
        const orderIndex = allForType.findIndex((item) => item.id === category.id);
        return <Panel key={category.id} className={category.is_active ? "" : "cf-category-inactive"}><div className="cf-panel-body cf-row cf-category-admin-row"><CategoryIcon icon={category.icon} color={category.color} /><div className="cf-category-copy"><h2>{category.name}</h2><p className="cf-muted">Thứ tự {orderIndex + 1} · {category.is_active ? "Đang dùng" : "Ngừng dùng"}</p></div><span className={`cf-badge ${category.is_active ? "success" : ""}`}>{category.is_active ? "Hoạt động" : "Đã ẩn"}</span><div className="cf-row cf-category-actions"><CategoryOrderControls name={category.name} index={orderIndex} total={allForType.length} busy={busy} onMove={(delta) => onMove(category, delta)} /><button className="cf-icon-btn" onClick={() => onEdit(category)} aria-label={`Sửa ${category.name}`}><Pencil size={16} /></button><button className="cf-icon-btn" disabled={busy} onClick={() => onToggle(category)} aria-label={category.is_active ? `Ngừng dùng ${category.name}` : `Kích hoạt ${category.name}`}>{category.is_active ? <PauseCircle size={16} /> : <PlayCircle size={16} />}</button></div></div></Panel>;
      })}
    </div>
  );
}
