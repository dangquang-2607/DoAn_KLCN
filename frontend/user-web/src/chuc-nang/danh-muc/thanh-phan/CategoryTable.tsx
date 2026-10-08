/**
 * ============================================================================
 * TÊN FILE: CategoryTable.tsx
 * MÀN HÌNH / PHÂN HỆ: Danh mục
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
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
import { useState } from "react";
import { Pencil, Trash2, RotateCcw } from "lucide-react";
import { CategoryIcon } from "@/dung-chung/UI-chung/CategoryIcon";
import { Empty, Panel } from "@/dung-chung/UI-chung/ui";
import type { Category } from "@/dung-chung/nghiep-vu/finance";
import ListDetailLayout, { RecordRow } from "@/dung-chung/UI-chung/ListDetailLayout";
import styles from "../CSS/categories.module.css";

/** Danh sách danh mục theo loại, bao gồm quyền sửa/xóa chỉ dành cho danh mục cá nhân. */
export default function CategoryTable({ categories, archived = false, onEdit, onDelete, onRestore }: { categories: Category[]; archived?: boolean; onEdit: (category: Category) => void; onDelete: (category: Category) => void; onRestore: (category: Category) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>();
  const selected = selectedId === null ? undefined : categories.find((category) => category.id === selectedId) || categories[0];
  const keywords = [...new Set((selected?.keywords || "").split(",").map((word) => word.trim()).filter(Boolean))];
  if (!categories.length) return <Panel><Empty title={archived ? "Không có danh mục đã ẩn phù hợp" : "Chưa có danh mục phù hợp"} description={archived ? "Danh mục cá nhân đã ẩn sẽ xuất hiện ở đây để bạn khôi phục khi cần." : "Tạo danh mục riêng để phân loại các giao dịch của bạn."} /></Panel>;
  return <ListDetailLayout listTitle={archived ? "Danh mục đã ẩn" : "Danh sách danh mục"} count={categories.length}
    selectedKey={selected?.id} title={selected?.name || "Chi tiết danh mục"} eyebrow="THÔNG TIN DANH MỤC"
    header={selected && <CategoryIcon icon={selected.icon} color={selected.color} size={50} />}
    onClose={() => setSelectedId(null)}
    list={<ul className={styles.list}>{categories.map((category) => <li key={category.id}>
      <RecordRow recordKey={category.id} selected={selected?.id === category.id} onSelect={() => setSelectedId(category.id)}
        leading={<CategoryIcon icon={category.icon} color={category.color} size={38} />} title={category.name}
        description={category.type === "EXPENSE" ? "Khoản chi" : "Khoản thu"}
        trailing={<span className={`cf-badge ${category.owner_user_id ? "info" : ""}`}>{category.owner_user_id ? "Cá nhân" : "Hệ thống"}</span>} />
    </li>)}</ul>}>
    {selected && <div className={styles.details}>
      <div className="cf-row"><span className={`cf-badge ${archived ? "warning" : "success"}`}>{archived ? "Đã ẩn" : "Đang dùng"}</span><span className={`cf-badge ${selected.owner_user_id ? "info" : ""}`}>{selected.owner_user_id ? "Danh mục cá nhân" : "Danh mục hệ thống"}</span></div>
      <dl className={styles.facts}>
        <div><dt>Loại giao dịch</dt><dd>{selected.type === "EXPENSE" ? "Khoản chi" : "Khoản thu"}</dd></div>
        <div><dt>Quyền quản lý</dt><dd>{selected.owner_user_id ? "Bạn quản lý" : "Quản trị viên quản lý"}</dd></div>
      </dl>
      <section className={styles.keywords} aria-label="Từ khóa nhận diện"><h3>Từ khóa nhận diện</h3>{keywords.length ? <div className={styles.tags}>{keywords.map((word) => <span key={word}>{word}</span>)}</div> : <p>Chưa có từ khóa nhận diện.</p>}</section>
      {selected.owner_user_id ? <>
        <div className={styles.actions}>{archived
          ? <button type="button" className="cf-btn cf-btn-primary" onClick={() => onRestore(selected)}><RotateCcw size={16} />Khôi phục danh mục</button>
          : <><button type="button" className="cf-btn cf-btn-primary" onClick={() => onEdit(selected)}><Pencil size={16} />Sửa danh mục</button><button type="button" className="cf-btn" onClick={() => onDelete(selected)}><Trash2 size={16} />Ẩn danh mục</button></>}
        </div>
        <p className={styles.notice}>{archived ? "Khôi phục để tiếp tục sử dụng danh mục này. Lịch sử giao dịch và ngân sách được giữ nguyên." : "Ẩn danh mục sẽ ngừng hiển thị khi tạo mới. Lịch sử giao dịch và ngân sách được giữ nguyên."}</p>
      </> : <p className={styles.notice}>Danh mục hệ thống được quản trị viên quản lý. Bạn có thể tạo danh mục cá nhân để tùy chỉnh theo nhu cầu.</p>}
    </div>}
  </ListDetailLayout>;
}
