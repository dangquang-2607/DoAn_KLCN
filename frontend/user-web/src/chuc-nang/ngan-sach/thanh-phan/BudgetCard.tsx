/**
 * ============================================================================
 * TÊN FILE: BudgetCard.tsx
 * MÀN HÌNH / PHÂN HỆ: Ngân sách
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
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
import { Pencil, Trash2, Pause, Play, CircleStop, Copy } from "lucide-react";
import { CategoryIcon } from "@/dung-chung/UI-chung/CategoryIcon";
import { Panel } from "@/dung-chung/UI-chung/ui";
import { dateLabel, money } from "@/dung-chung/tien-ich/finance";
import { type Budget, type Category } from "@/dung-chung/nghiep-vu/finance";
import { budgetStyles } from "../CSS/budgets.styles";

/** Thẻ tiến độ ngân sách và cảnh báo theo ngưỡng backend đã tính. */
export default function BudgetCard({ budget, category, onEdit, onDelete, onToggle, onEnd, onReuse, history = false, embedded = false }: { budget: Budget; category?: Category; onEdit?: () => void; onDelete?: () => void; onToggle?: () => void; onEnd?: () => void; onReuse?: () => void; history?: boolean; embedded?: boolean }) {
  const status = budget.progress_status;
  const content = <div className={embedded ? "cf-stack" : "cf-panel-body cf-stack"} style={{ gap: budgetStyles.cardGap }}>
    <div className="cf-row cf-between">{!embedded && <h2>{budget.budget_name}</h2>}<span className={`cf-badge ${budget.period_state === "PAUSED" ? "warning" : status === "EXCEEDED" ? "danger" : status === "WARNING" ? "warning" : "success"}`}>{budget.period_state === "UPCOMING" ? "Sắp bắt đầu" : budget.period_state === "PAUSED" && !history ? "Tạm dừng" : status === "EXCEEDED" ? "Vượt hạn mức" : status === "WARNING" ? "Gần hạn mức" : "Trong hạn mức"}</span></div>
    <div className="cf-row" style={{ gap: 8 }}>{category && <CategoryIcon icon={category.icon} color={category.color} size={28} />}<p className="cf-muted" style={{ fontSize: 13, margin: 0 }}>{category?.name || "Tất cả danh mục"} · {dateLabel(budget.start_date)} – {dateLabel(budget.end_date)}</p></div>
    <div className="cf-row cf-between"><strong className="cf-number" style={{ fontSize: 27 }}>{money(budget.spent_amount, budget.currency)}</strong><span className="cf-muted" style={{ fontSize: 14 }}>/ {money(budget.amount_limit, budget.currency)}</span></div>
    <div className="cf-progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(budget.usage_percent)))}%`, background: status === "EXCEEDED" ? "var(--cf-danger)" : status === "WARNING" ? "#b48215" : undefined }} /></div>
    <div className="cf-row cf-between" style={{ fontSize: 13 }}><span className="cf-muted">Đã dùng {Number(budget.usage_percent).toFixed(0)}%</span><span>Còn lại {money(budget.remaining_amount, budget.currency)}</span></div>
    {!history && budget.next_effective_date && <p className="cf-muted" style={{ fontSize: 12, margin: 0 }}>Từ {dateLabel(budget.next_effective_date)}: hạn mức {money(budget.configured_amount_limit, budget.currency)}</p>}
    {!history && budget.next_state_date && <p className="cf-muted" style={{ fontSize: 12, margin: 0 }}>{budget.configured_is_active ? "Tiếp tục" : "Tạm dừng"} từ {dateLabel(budget.next_state_date)}</p>}
    <div className="cf-row cf-between"><span className="cf-muted" style={{ fontSize: 12 }}>{history ? "Kỳ đã kết thúc" : budget.is_recurring ? "Tự chuyển kỳ" : "Một lần"} · Cảnh báo tại {Number(budget.warning_percent)}%</span><div className="cf-row">{onReuse && <button className="cf-btn cf-btn-sm" onClick={onReuse}><Copy />Dùng lại</button>}{!history && <>{onToggle && <button className="cf-btn cf-btn-sm" onClick={onToggle}>{budget.configured_is_active ? <Pause /> : <Play />}{budget.next_state_date ? "Hủy lịch đổi trạng thái" : budget.configured_is_active ? "Tạm dừng từ mai" : "Tiếp tục từ mai"}</button>}{onEnd && <button className="cf-btn cf-btn-sm" onClick={onEnd}><CircleStop />Kết thúc</button>}{onEdit && <button className="cf-btn cf-btn-sm" onClick={onEdit}><Pencil />Sửa</button>}{onDelete && <button className="cf-icon-btn" aria-label={`Xóa ${budget.budget_name}`} onClick={onDelete}><Trash2 size={16} /></button>}</>}</div></div>
  </div>;
  return embedded ? content : <Panel>{content}</Panel>;
}
