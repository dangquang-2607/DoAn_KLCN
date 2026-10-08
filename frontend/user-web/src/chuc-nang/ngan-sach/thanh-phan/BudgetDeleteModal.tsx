/**
 * ============================================================================
 * TÊN FILE: BudgetDeleteModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Ngân sách
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Xác nhận xóa cấu hình ngân sách mà không xóa giao dịch.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất BudgetDeleteModal để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Validate khoảng ngày và hạn mức; xóa ngân sách không được xóa giao dịch chi tiêu.
 * ============================================================================
 */
import { Alert, Modal } from "@/dung-chung/UI-chung/ui";
import type { Budget } from "@/dung-chung/nghiep-vu/finance";

/** Xác nhận chỉ xóa cấu hình ngân sách, không xóa giao dịch chi tiêu. */
export default function BudgetDeleteModal({ budget, mode = "delete", error, busy, onConfirm, onClose, onClearError }: { budget: Budget; mode?: "delete" | "end"; error: string; busy: boolean; onConfirm: () => void; onClose: () => void; onClearError: () => void }) {
  const ending = mode === "end";
  return <Modal title={ending ? "Kết thúc ngân sách" : "Xóa ngân sách"} onClose={onClose} busy={busy}><div className="cf-form">{error && <Alert onDismiss={onClearError}>{error}</Alert>}<p>{ending ? `Kết thúc “${budget.budget_name}” sau hôm nay? Chi tiêu hôm nay và lịch sử các kỳ vẫn được giữ lại.` : `Xóa “${budget.budget_name}”? Lịch sử ngân sách này sẽ không còn hiển thị; các giao dịch chi tiêu vẫn được giữ lại.`}</p><div className="cf-form-actions"><button className="cf-btn" disabled={busy} onClick={onClose}>Hủy</button><button className="cf-btn cf-btn-danger" disabled={busy} onClick={onConfirm}>{ending ? "Kết thúc" : "Xóa ngân sách"}</button></div></div></Modal>;
}
