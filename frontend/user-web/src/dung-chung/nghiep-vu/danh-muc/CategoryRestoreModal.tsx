/**
 * ============================================================================
 * TÊN FILE: CategoryRestoreModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Quản lý Danh mục & OCR
 * NHÓM VỆ TINH: dung-chung (Thành phần giao diện dùng chung)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hộp thoại modal xác nhận khôi phục danh mục cũ đã bị ẩn/xóa, dùng chung
 *   cho cả màn hình quản trị danh mục và quy trình tạo nhanh danh mục trong OCR.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   ArchivedCategory, trạng thái busy, thông báo lỗi error, callback onConfirm và onClose.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export CategoryRestoreModal component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Khôi phục đúng ID danh mục gốc để bảo toàn mối quan hệ với các giao dịch cũ.
 * ============================================================================
 */
/** Xác nhận khôi phục ID danh mục cũ, dùng chung cho trang Danh mục và tạo nhanh trong OCR. */
import { RotateCcw } from "lucide-react";
import { Alert, Modal } from "@/dung-chung/UI-chung/ui";
import type { ArchivedCategory } from "@/dung-chung/nghiep-vu/danh-muc/categories";

/**
 * Modal xác nhận khôi phục danh mục thu chi đã bị xóa mềm.
 */
export default function CategoryRestoreModal({ category, updateMetadata = false, error, busy, onConfirm, onClose }: {
  category: ArchivedCategory;
  updateMetadata?: boolean;
  error: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return <Modal title="Khôi phục danh mục" busy={busy} onClose={onClose}>
    <div className="cf-form">
      {error && <Alert persistent>{error}</Alert>}
      <p>Danh mục <strong>“{category.name}”</strong> ({category.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập"}) đang bị ẩn. Bạn có muốn sử dụng lại danh mục này không?</p>
      <p className="cf-muted">Danh mục sẽ xuất hiện trong các lựa chọn mới. Giao dịch, ngân sách và hóa đơn đã gắn với danh mục này được giữ nguyên.</p>
      {updateMetadata && <Alert kind="info">Biểu tượng, màu và từ khóa sẽ được cập nhật theo thông tin bạn vừa nhập.</Alert>}
      <div className="cf-form-actions">
        <button type="button" className="cf-btn" disabled={busy} onClick={onClose}>Hủy</button>
        <button type="button" className="cf-btn cf-btn-primary" disabled={busy} onClick={onConfirm}>
          <RotateCcw size={16} />{busy ? "Đang khôi phục…" : "Khôi phục danh mục"}
        </button>
      </div>
    </div>
  </Modal>;
}
