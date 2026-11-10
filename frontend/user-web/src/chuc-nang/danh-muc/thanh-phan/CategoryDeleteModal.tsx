import density from "@/dung-chung/CSS/workspace-density.module.css";
import { Alert, Modal } from "@/dung-chung/UI-chung/ui";
import type { Category } from "@/dung-chung/nghiep-vu/finance";

/** Xác nhận ẩn hoặc xóa vĩnh viễn danh mục cá nhân. */
export default function CategoryDeleteModal({
  category,
  permanent = false,
  error,
  busy,
  onConfirm,
  onClose,
  onClearError,
}: {
  category: Category;
  permanent?: boolean;
  error: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onClearError: () => void;
}) {
  return (
    <Modal className={`${density.dialog} ${density.compact}`} title={permanent ? "Xóa vĩnh viễn danh mục" : "Ẩn danh mục"} busy={busy} onClose={onClose}>
      <div className={density.form}>
        <div className={density.fields}>
          {error && <Alert persistent onDismiss={onClearError}>{error}</Alert>}
          <p>
            {permanent ? <>Xóa vĩnh viễn danh mục “{category.name}”? Số danh mục cá nhân sẽ giảm một. Bạn không thể hoàn tác thao tác này.</> : <>Ẩn danh mục “{category.name}” khỏi các lựa chọn mới? Giao dịch, ngân
            sách và hóa đơn đã dùng danh mục này vẫn được giữ nguyên. Bạn có thể
            khôi phục tại mục “Đã ẩn”.</>}
          </p>
        </div>
        <div className={density.footer}>
          <button className="cf-btn" disabled={busy} onClick={onClose}> Hủy </button>
          <button
            className="cf-btn cf-btn-danger"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Đang xử lý…" : permanent ? "Xóa vĩnh viễn" : "Ẩn danh mục"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
