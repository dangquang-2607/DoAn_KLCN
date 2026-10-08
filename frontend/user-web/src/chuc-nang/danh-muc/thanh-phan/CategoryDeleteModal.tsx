/**
 * ============================================================================
 * TÊN FILE: CategoryDeleteModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Danh mục
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Xác nhận ẩn danh mục cá nhân khỏi lựa chọn mới.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất CategoryDeleteModal để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ danh mục cá nhân được sửa/ẩn; lịch sử giao dịch và ngân sách phải được giữ nguyên.
 * ============================================================================
 */
import { Alert, Modal } from "@/dung-chung/UI-chung/ui";
import type { Category } from "@/dung-chung/nghiep-vu/finance";

/** Xác nhận ẩn danh mục; dữ liệu lịch sử vẫn được backend bảo toàn. */
export default function CategoryDeleteModal({ category, error, busy, onConfirm, onClose, onClearError }: { category: Category; error: string; busy: boolean; onConfirm: () => void; onClose: () => void; onClearError: () => void }) {
  return <Modal title="Ẩn danh mục" busy={busy} onClose={onClose}>{error && <Alert onDismiss={onClearError}>{error}</Alert>}<p>Ẩn danh mục “{category.name}” khỏi các lựa chọn mới? Giao dịch, ngân sách và hóa đơn đã dùng danh mục này vẫn được giữ nguyên. Bạn có thể khôi phục tại mục “Đã ẩn”.</p><div className="cf-form-actions"><button className="cf-btn" disabled={busy} onClick={onClose}>Hủy</button><button className="cf-btn cf-btn-danger" disabled={busy} onClick={onConfirm}>{busy ? "Đang xử lý…" : "Ẩn danh mục"}</button></div></Modal>;
}
