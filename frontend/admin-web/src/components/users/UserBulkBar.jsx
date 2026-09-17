import { Lock, Unlock, Trash2 } from "lucide-react";

/**
 * UserBulkBar - Thanh thao tac hang loat khi co items duoc chon.
 */
export default function UserBulkBar({ count, onBan, onUnban, onDelete, onClear }) {
  if (!count) return null;
  return (
    <div className="cf-toolbar">
      <strong style={{ fontSize: 14 }}>Da chon {count} tai khoan</strong>
      <button className="cf-btn cf-btn-sm" onClick={onBan}>
        <Lock />
        Khoa
      </button>
      <button className="cf-btn cf-btn-sm" onClick={onUnban}>
        <Unlock />
        Mo khoa
      </button>
      <button className="cf-btn cf-btn-danger cf-btn-sm" onClick={onDelete}>
        <Trash2 />
        Xoa mem
      </button>
      <button className="cf-btn cf-btn-ghost cf-btn-sm" onClick={onClear}>
        Bo chon
      </button>
    </div>
  );
}