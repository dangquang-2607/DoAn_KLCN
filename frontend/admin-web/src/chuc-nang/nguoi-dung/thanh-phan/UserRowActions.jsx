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

export default function UserRowActions({ user, meId, onDetail, onAction, hideDetail = false }) {
  const actions = rowActionKeys(user, meId).map((key) => ({
    key, ...descriptions[key],
    ...(key === "delete" && user.is_deleted ? { label: "Xóa vĩnh viễn…" } : {}),
    onClick: () => onAction(key, user),
  }));
  return <div className="cf-user-actions">{!hideDetail && <button className="cf-icon-btn" aria-label={`Xem ${user.email}`} title="Xem chi tiết" onClick={() => onDetail(user.id)}><Eye size={17} /></button>}<ActionMenu label={`Thao tác với ${user.email}`} actions={actions} /></div>;
}
