/**
 * ============================================================================
 * TÊN FILE: CategoryModal.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Danh mục hệ thống
 * MỤC ĐÍCH CỤ THỂ:
 *   Thu thập thông tin tạo mới hoặc cập nhật một danh mục hệ thống.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   State form và callback do trang Categories sở hữu.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất form modal; submit được chuyển lại page để gọi API.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không cho đổi loại khi sửa và giữ nguyên giới hạn độ dài hiện hành.
 * ============================================================================
 */
import { CategoryColorPicker, CategoryIconPicker } from "../CategoryIcon";
import { Alert, Field, Modal } from "../design";

export default function CategoryModal({ editing, type, name, icon, color, keywords, isActive, busy, error, onTypeChange, onNameChange, onIconChange, onColorChange, onKeywordsChange, onActiveChange, onDismissError, onClose, onSubmit }) {
  return (
    <Modal title={editing ? "Sửa danh mục hệ thống" : "Thêm danh mục hệ thống"} busy={busy} onClose={onClose}>
      <form className="cf-form" onSubmit={onSubmit}>
        {error && <Alert onDismiss={onDismissError}>{error}</Alert>}
        <Field label="Tên danh mục"><input className="cf-input" required maxLength={100} value={name} onChange={(event) => onNameChange(event.target.value)} /></Field>
        <Field label="Loại danh mục"><select className="cf-input" value={type} disabled={Boolean(editing)} onChange={(event) => onTypeChange(event.target.value)}><option value="EXPENSE">Chi tiêu</option><option value="INCOME">Thu nhập</option></select></Field>
        <Field label="Biểu tượng"><CategoryIconPicker value={icon} onChange={onIconChange} /></Field>
        <Field label="Màu nhận diện"><CategoryColorPicker value={color} onChange={onColorChange} /></Field>
        <Field label="Từ khóa tự động phân loại" hint="Phân cách bằng dấu phẩy, ví dụ: nhà hàng, cơm, cà phê"><textarea className="cf-input" rows={3} maxLength={1000} value={keywords} onChange={(event) => onKeywordsChange(event.target.value)} placeholder="Nhập từ khóa hoặc tên người bán…" /></Field>
        <label className="cf-check"><input type="checkbox" checked={isActive} onChange={(event) => onActiveChange(event.target.checked)} /> Cho phép người dùng chọn danh mục này</label>
        <div className="cf-form-actions"><button type="button" className="cf-btn" disabled={busy} onClick={onClose}>Hủy</button><button className="cf-btn cf-btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu danh mục"}</button></div>
      </form>
    </Modal>
  );
}
