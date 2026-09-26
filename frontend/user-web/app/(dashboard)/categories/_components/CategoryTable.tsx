/**
 * ============================================================================
 * TÊN FILE: CategoryTable.tsx
 * MÀN HÌNH / PHÂN HỆ: Danh mục
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị danh mục hệ thống và danh mục cá nhân.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất CategoryTable để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ danh mục cá nhân được sửa/ẩn; lịch sử giao dịch và ngân sách phải được giữ nguyên.
 * ============================================================================
 */
import { Pencil, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Empty, Panel } from "@/components/ui/ui";
import type { Category } from "@/lib/finance";
import { categoryStyles } from "../_styles/categories.styles";

/** Danh sách danh mục theo loại, bao gồm quyền sửa/xóa chỉ dành cho danh mục cá nhân. */
export default function CategoryTable({ categories, onEdit, onDelete }: { categories: Category[]; onEdit: (category: Category) => void; onDelete: (category: Category) => void }) {
  if (!categories.length) return <Panel><Empty title="Chưa có danh mục phù hợp" description="Tạo danh mục riêng để phân loại các giao dịch của bạn." /></Panel>;
  return <div className="cf-grid">{categories.map((category) => <Panel key={category.id}><div className="cf-panel-body cf-row">
    <CategoryIcon icon={category.icon} color={category.color} /><div style={{ flex: 1 }}><h2>{category.name}</h2><p className="cf-muted" style={{ fontSize: categoryStyles.metaSize, margin: "5px 0 0" }}>{category.type === "EXPENSE" ? "Khoản chi" : "Khoản thu"}</p></div>
    <span className={`cf-badge ${category.owner_user_id ? "info" : ""}`}>{category.owner_user_id ? "Cá nhân" : "Hệ thống"}</span>
    {category.owner_user_id && <div className="cf-row"><button className="cf-icon-btn" aria-label={`Sửa ${category.name}`} onClick={() => onEdit(category)}><Pencil size={16} /></button><button className="cf-icon-btn" aria-label={`Ẩn ${category.name}`} onClick={() => onDelete(category)}><Trash2 size={16} /></button></div>}
  </div></Panel>)}</div>;
}
