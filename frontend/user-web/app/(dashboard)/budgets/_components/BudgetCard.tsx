/**
 * ============================================================================
 * TÊN FILE: BudgetCard.tsx
 * MÀN HÌNH / PHÂN HỆ: Ngân sách
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị hạn mức, tiến độ và trạng thái cảnh báo ngân sách.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất BudgetCard để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Validate khoảng ngày và hạn mức; xóa ngân sách không được xóa giao dịch chi tiêu.
 * ============================================================================
 */
import { Pencil, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { Panel } from "@/components/ui/ui";
import { dateLabel, money, type Budget, type Category } from "@/lib/finance";
import { budgetStyles } from "../_styles/budgets.styles";

/** Thẻ tiến độ ngân sách và cảnh báo theo ngưỡng backend đã tính. */
export default function BudgetCard({ budget, category, onEdit, onDelete }: { budget: Budget; category?: Category; onEdit: () => void; onDelete: () => void }) {
  const status = budget.progress_status;
  return <Panel><div className="cf-panel-body cf-stack" style={{ gap: budgetStyles.cardGap }}>
    <div className="cf-row cf-between"><h2>{budget.budget_name}</h2><span className={`cf-badge ${status === "EXCEEDED" ? "danger" : status === "WARNING" ? "warning" : "success"}`}>{status === "EXCEEDED" ? "Vượt hạn mức" : status === "WARNING" ? "Gần hạn mức" : "Trong hạn mức"}</span></div>
    <div className="cf-row" style={{ gap: 8 }}>{category && <CategoryIcon icon={category.icon} color={category.color} size={28} />}<p className="cf-muted" style={{ fontSize: 13, margin: 0 }}>{category?.name || "Tất cả danh mục"} · {dateLabel(budget.start_date)} – {dateLabel(budget.end_date)}</p></div>
    <div className="cf-row cf-between"><strong className="cf-number" style={{ fontSize: 27 }}>{money(budget.spent_amount, budget.currency)}</strong><span className="cf-muted" style={{ fontSize: 14 }}>/ {money(budget.amount_limit, budget.currency)}</span></div>
    <div className="cf-progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(budget.usage_percent)))}%`, background: status === "EXCEEDED" ? "var(--cf-danger)" : status === "WARNING" ? "#b48215" : undefined }} /></div>
    <div className="cf-row cf-between" style={{ fontSize: 13 }}><span className="cf-muted">Đã dùng {Number(budget.usage_percent).toFixed(0)}%</span><span>Còn lại {money(budget.remaining_amount, budget.currency)}</span></div>
    <div className="cf-row cf-between"><span className="cf-muted" style={{ fontSize: 12 }}>Cảnh báo tại {Number(budget.warning_percent)}%</span><div className="cf-row"><button className="cf-btn cf-btn-sm" onClick={onEdit}><Pencil />Sửa</button><button className="cf-icon-btn" aria-label={`Xóa ${budget.budget_name}`} onClick={onDelete}><Trash2 size={16} /></button></div></div>
  </div></Panel>;
}
