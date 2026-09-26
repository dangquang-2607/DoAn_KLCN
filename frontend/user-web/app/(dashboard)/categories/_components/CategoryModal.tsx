/**
 * ============================================================================
 * TÊN FILE: CategoryModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Danh mục
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp biểu mẫu danh mục, biểu tượng, màu và từ khóa.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất CategoryModal để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Chỉ danh mục cá nhân được sửa/ẩn; lịch sử giao dịch và ngân sách phải được giữ nguyên.
 * ============================================================================
 */
import { Alert, Field, Modal } from "@/components/ui/ui";
import { CategoryColorPicker, CategoryIconPicker } from "@/components/ui/CategoryIcon";
import type { FormEvent } from "react";
import type { Category } from "@/lib/finance";

export type CategoryForm = { name: string; type: string; icon: string; color: string; keywords: string };

/** Form tạo/sửa danh mục cá nhân và metadata phục vụ phân loại tự động. */
export default function CategoryModal({ editing, form, error, busy, onChange, onSubmit, onClose, onClearError }: { editing: Category | null; form: CategoryForm; error: string; busy: boolean; onChange: (next: CategoryForm) => void; onSubmit: (event: FormEvent) => void; onClose: () => void; onClearError: () => void }) {
  return <Modal title={editing ? "Sửa danh mục cá nhân" : "Tạo danh mục cá nhân"} busy={busy} onClose={onClose}><form className="cf-form" onSubmit={onSubmit}>
    {error && <Alert onDismiss={onClearError}>{error}</Alert>}
    <Field label="Tên danh mục"><input className="cf-input" required maxLength={100} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} /></Field>
    <Field label="Loại danh mục"><select className="cf-input" value={form.type} onChange={(e) => onChange({ ...form, type: e.target.value })}><option value="EXPENSE">Chi tiêu</option><option value="INCOME">Thu nhập</option></select></Field>
    <Field label="Biểu tượng"><CategoryIconPicker value={form.icon} onChange={(icon) => onChange({ ...form, icon })} /></Field>
    <Field label="Màu nhận diện"><CategoryColorPicker value={form.color} onChange={(color) => onChange({ ...form, color })} /></Field>
    <Field label="Từ khóa tự động phân loại" hint="Phân cách bằng dấu phẩy; hệ thống sẽ dùng cho giao dịch tương lai."><textarea className="cf-input" rows={3} maxLength={1000} value={form.keywords} onChange={(e) => onChange({ ...form, keywords: e.target.value })} placeholder="Ví dụ: cửa hàng A, cà phê, bữa trưa" /></Field>
    <div className="cf-form-actions"><button type="button" className="cf-btn" onClick={onClose} disabled={busy}>Hủy</button><button className="cf-btn cf-btn-primary" disabled={busy}>{busy ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo danh mục"}</button></div>
  </form></Modal>;
}
