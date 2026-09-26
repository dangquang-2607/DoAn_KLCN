/**
 * ============================================================================
 * TÊN FILE: CategoryOrderControls.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Danh mục hệ thống
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp nút đổi thứ tự một danh mục trong danh sách cùng loại.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Tên, vị trí, tổng số phần tử, trạng thái bận và callback di chuyển.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất hai nút lên/xuống có nhãn truy cập và điều kiện vô hiệu hóa.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Component chỉ phát delta -1/+1; page chịu trách nhiệm kiểm tra biên và gọi API.
 * ============================================================================
 */
import { ArrowDown, ArrowUp } from "lucide-react";

export default function CategoryOrderControls({ name, index, total, busy, onMove }) {
  return <><button className="cf-icon-btn" disabled={busy || index === 0} onClick={() => onMove(-1)} aria-label={`Đưa ${name} lên`}><ArrowUp size={16} /></button><button className="cf-icon-btn" disabled={busy || index === total - 1} onClick={() => onMove(1)} aria-label={`Đưa ${name} xuống`}><ArrowDown size={16} /></button></>;
}
