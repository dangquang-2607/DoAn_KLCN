import density from "../../../dung-chung/CSS/management.module.css";
import { CategoryColorPicker, CategoryIconPicker } from "../../../dung-chung/UI-chung/CategoryIcon";
import { Alert, Field, Modal } from "../../../dung-chung/UI-chung/ui";

export default function CategoryModal({ editing, type, name, icon, color, keywords, isActive, busy, error, onTypeChange, onNameChange, onIconChange, onColorChange, onKeywordsChange, onActiveChange, onDismissError, onClose, onSubmit }) {
  return (
    <Modal className={density.dialog} title={editing ? "Sửa danh mục hệ thống" : "Thêm danh mục hệ thống"} busy={busy} onClose={onClose}>
      <form className={density.form} onSubmit={onSubmit} aria-busy={busy}>
        <fieldset className={`${density.fields} ${density.fieldset}`} disabled={busy}>
          {error && <Alert persistent onDismiss={onDismissError}>{error}</Alert>}
          <Field label="Tên danh mục"><input className="cf-input" required maxLength={100} value={name} onChange={(event) => onNameChange(event.target.value)} /></Field>
          <Field label="Loại danh mục"><select className="cf-input" value={type} disabled={Boolean(editing)} onChange={(event) => onTypeChange(event.target.value)}><option value="EXPENSE">Chi tiêu</option><option value="INCOME">Thu nhập</option></select></Field>
          <Field label="Biểu tượng"><CategoryIconPicker value={icon} onChange={onIconChange} /></Field>
          <Field label="Màu nhận diện"><CategoryColorPicker value={color} onChange={onColorChange} /></Field>
          <Field label="Từ khóa tự động phân loại" hint="Phân cách bằng dấu phẩy, ví dụ: nhà hàng, cơm, cà phê"><textarea className="cf-input" rows={3} maxLength={1000} value={keywords} onChange={(event) => onKeywordsChange(event.target.value)} placeholder="Nhập từ khóa hoặc tên người bán…" /></Field>
          <label className="cf-check"><input type="checkbox" checked={isActive} onChange={(event) => onActiveChange(event.target.checked)} /> Cho phép người dùng chọn danh mục này</label>
        </fieldset>
        <div className={density.footer}><button type="button" className="cf-btn" disabled={busy} onClick={onClose}>Hủy</button><button className="cf-btn cf-btn-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu danh mục"}</button></div>
      </form>
    </Modal>
  );
}
