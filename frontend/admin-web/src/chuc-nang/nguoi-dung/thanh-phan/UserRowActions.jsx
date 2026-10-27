/**
 * ============================================================================
 * TÊN FILE: UserRowActions.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Quản lý Người dùng
 * MỤC ĐÍCH CỤ THỂ:
 *   Menu hành động nhanh trên từng dòng người dùng: khóa tài khoản (Ban), mở khóa (Unban),
 *   buộc đăng xuất (Revoke Sessions), và xem chi tiết hồ sơ.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props user, onAction callback, ActionMenu UI primitive.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export UserRowActions component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Yêu cầu xác nhận trước khi thực hiện hành động khóa tài khoản người dùng.
 * ============================================================================
 */
import { Eye, Shield, KeyRound, Lock, Unlock, Trash2, RotateCcw, RefreshCw } from "lucide-react";
import ActionMenu from "../../../dung-chung/UI-chung/ActionMenu";
import { rowActionKeys } from "../xu-ly/utils";

const descriptions = {
  role: { label: "Thay đổi vai trò", Icon: Shield },
  "reset-password": { label: "Cấp lại mật khẩu", Icon: KeyRound },
  ban: { label: "Khóa tài khoản", Icon: Lock },
  unban: { label: "Mở khóa tài khoản", Icon: Unlock },
  delete: { label: "Xóa tài khoản…", Icon: Trash2, danger: true },
  restore: { label: "Khôi phục tài khoản", Icon: RotateCcw },
  "retry-delete": { label: "Thử lại tác vụ xóa", Icon: RefreshCw },
};

/**
 * Menu ngữ cảnh các thao tác quản trị trên từng tài khoản người dùng.
 */
export default function UserRowActions({ user, meId, onDetail, onAction, hideDetail = false }) {
  const actions = rowActionKeys(user, meId).map((key) => ({
    key, ...descriptions[key],
    ...(key === "delete" && user.is_deleted ? { label: "Xóa vĩnh viễn…" } : {}),
    onClick: () => onAction(key, user),
  }));
  return <div className="cf-user-actions">{!hideDetail && <button className="cf-icon-btn" aria-label={`Xem ${user.email}`} title="Xem chi tiết" onClick={() => onDetail(user.id)}><Eye size={17} /></button>}<ActionMenu label={`Thao tác với ${user.email}`} actions={actions} /></div>;
}
