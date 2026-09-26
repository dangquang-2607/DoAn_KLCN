/**
 * ============================================================================
 * TÊN FILE: UserBulkBar.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Quản lý người dùng
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị thao tác khóa, mở khóa và xóa mềm cho các tài khoản đã chọn.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Số lượng selection và callback mở nghiệp vụ từ Users.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất toolbar hàng loạt hoặc null khi chưa chọn tài khoản.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Page đã lọc tài khoản được bảo vệ trước khi cho phép chọn.
 * ============================================================================
 */
import { Lock, Unlock, Trash2 } from "lucide-react";
export default function UserBulkBar({ count, onBan, onUnban, onDelete, onClear }) {
  if (!count) return null;
  return (
    <div className="cf-toolbar">
      <strong style={{ fontSize: 14 }}>Đã chọn {count} tài khoản</strong>
      <button className="cf-btn cf-btn-sm" onClick={onBan}>
        <Lock />
        Khóa
      </button>
      <button className="cf-btn cf-btn-sm" onClick={onUnban}>
        <Unlock />
        Mở khóa
      </button>
      <button className="cf-btn cf-btn-danger cf-btn-sm" onClick={onDelete}>
        <Trash2 />
        Xóa mềm
      </button>
      <button className="cf-btn cf-btn-ghost cf-btn-sm" onClick={onClear}>
        Bỏ chọn
      </button>
    </div>
  );
}
