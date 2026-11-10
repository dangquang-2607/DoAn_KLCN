import { Download, Search, Lock, Unlock, SquareCheck, X } from "lucide-react";
import { useState } from "react";
import { errorMessage, exportExcel, timestamp } from "../../../dung-chung/tien-ich/format";
import { accountStatus } from "../xu-ly/utils";
import styles from "../CSS/UserBulkBar.module.css";

/**
 * Bộ lọc tìm kiếm và phân loại danh sách người dùng hệ thống.
 */
export function UserFilters({ search, role, status, list, selected, page, onSearch, onRole, onStatus }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const exportUsers = async () => {
    if (exporting) return;
    setExporting(true); setError("");
    const rows = list.filter((user) => !selected.length || selected.includes(user.id));
    try {
      await exportExcel(`nguoi-dung-trang-${page}.xlsx`, {
        title: "CapitalFlow — Người dùng",
        scope: `${selected.length ? "Các dòng đã chọn" : "Toàn bộ dòng"} trên trang ${page}: ${rows.length} người dùng.`,
        columns: [{ title: "Họ tên", width: 32 }, { title: "Email", width: 42 }, { title: "Vai trò", width: 22 }, { title: "Trạng thái", width: 30 }, { title: "Gói sử dụng", width: 18 }, { title: "Premium đến", width: 24 }],
        rows: rows.map((user) => [user.full_name, user.email, user.role === "ADMIN" ? "Quản trị viên" : user.role === "USER" ? "Người dùng" : user.role, accountStatus(user).label, user.role === "ADMIN" ? "—" : user.plan === "PREMIUM" ? "Premium" : "Free", user.role === "ADMIN" || !user.premium_until ? "—" : timestamp(user.premium_until)]),
      });
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setExporting(false); }
  };
  return (
    <>
      <div className="adm-rest-controls">
        <div className="adm-rest-filters-group">
          <label className="adm-rest-search">
            <Search size={16} />
            <span className="adm-visually-hidden">Tìm người dùng</span>
            <input
              placeholder="Họ tên hoặc email"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </label>
          <label className="adm-rest-select-wrap">
            <span className="adm-visually-hidden">Vai trò</span>
            <select value={role} onChange={(e) => onRole(e.target.value)}>
              <option value="">Mọi vai trò</option>
              <option value="USER">Người dùng</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </label>
          <label className="adm-rest-select-wrap">
            <span className="adm-visually-hidden">Trạng thái</span>
            <select value={status} onChange={(e) => onStatus(e.target.value)}>
              <option value="">Mọi trạng thái</option>
              <option value="active">Có thể truy cập</option>
              <option value="banned">Đã khóa</option>
            </select>
          </label>
        </div>

        <div className="adm-rest-divider" aria-hidden="true" />

        <button
          type="button"
          className="cf-btn adm-rest-export-btn"
          disabled={!list.length || exporting}
          onClick={exportUsers}
        >
          <Download size={15} />
          <span>{exporting ? "Đang xuất…" : selected.length ? "Xuất Excel đã chọn" : "Xuất Excel trang này"}</span>
        </button>
      </div>
      {error && <p role="alert" className="cf-danger">{error}</p>}
    </>
  );
}

export function UserBulkBar({ count, onBan, onUnban, onClear }) {
  const hasSelection = count > 0;
  return (
    <div className={`${styles.bar} ${hasSelection ? styles.selected : ""}`} role="group" aria-label="Thao tác tài khoản đã chọn">
      <div className={styles.summary} role="status" aria-live="polite">
        <SquareCheck size={18} aria-hidden="true" />
        {hasSelection ? <span><strong>{count}</strong> tài khoản đã chọn</span> : <span>Chọn tài khoản để thao tác hàng loạt</span>}
      </div>
      {hasSelection && <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={onBan}>
          <Lock size={16} aria-hidden="true" />
          Khóa
        </button>
        <button type="button" className={styles.action} onClick={onUnban}>
          <Unlock size={16} aria-hidden="true" />
          Mở khóa
        </button>
        <button type="button" className={`${styles.action} ${styles.clear}`} onClick={onClear} aria-label="Bỏ chọn tất cả tài khoản" title="Bỏ chọn tất cả">
          <X size={16} aria-hidden="true" />
        </button>
      </div>}
    </div>
  );
}
