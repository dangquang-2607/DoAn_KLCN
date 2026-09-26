/**
 * ============================================================================
 * TÊN FILE: UserTable.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Quản lý người dùng
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị danh sách, trạng thái, chọn dòng, phân trang và thao tác từng tài khoản.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Query/list, trạng thái selection và callback do Users cung cấp.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất bảng người dùng không tự gọi API.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Ẩn hoặc khóa thao tác không hợp lệ với chính admin và tài khoản hệ thống.
 * ============================================================================
 */
import {
  Eye, Shield, KeyRound, Lock, Unlock,
  Trash2, RotateCcw, RefreshCw,
} from "lucide-react";
import { Loading, ErrorState, Empty, Pagination } from "../design";
import { accountStatus, protectedAccount } from "./utils";

export default function UserTable({
  query,
  list,
  selected,
  selectable,
  meId,
  page,
  onPageChange,
  onSelectAll,
  onSelectOne,
  onDetail,
  onAction,
}) {
  return (
    <>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : !list.length ? (
        <Empty
          title="Không tìm thấy người dùng"
          description="Thử thay đổi tên, email hoặc bộ lọc."
        />
      ) : (
        <div className="cf-table-wrap">
          <table className="cf-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Chọn tat ca tài khoản co the thao tac trong trang"
                    checked={
                      selectable.length > 0 &&
                      selectable.every((u) => selected.includes(u.id))
                    }
                    onChange={(e) => onSelectAll(e.target.checked)}
                  />
                </th>
                <th>Người dùng</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Hoạt động gan nhat</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const isSelf = u.id === meId;
                const isAdmin = u.role?.toUpperCase() === "ADMIN";
                const currentStatus = accountStatus(u);
                return (
                  <tr key={u.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${u.email}`}
                        disabled={!selectable.some((s) => s.id === u.id)}
                        checked={selected.includes(u.id)}
                        onChange={(e) => onSelectOne(u.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      <div className="cf-row">
                        <span className="cf-avatar">
                          {(u.full_name || u.email).slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <strong>
                            {u.full_name || "Chưa đặt tên"}
                            {isSelf ? " (Bạn)" : ""}
                          </strong>
                          <div className="cf-sub">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`cf-badge ${isAdmin ? "info" : ""}`}>
                        {isAdmin ? "Quản trị viên" : "Người dùng"}
                      </span>
                    </td>
                    <td>
                      <span className={`cf-badge ${currentStatus.tone}`}>
                        {currentStatus.label}
                      </span>
                    </td>
                    <td className="cf-muted">
                      {u.last_active_at
                        ? new Date(u.last_active_at).toLocaleString("vi-VN")
                        : "Chưa ghi nhận"}
                    </td>
                    <td>
                      <div className="cf-row" style={{ gap: 6 }}>
                        <button
                          className="cf-icon-btn"
                          aria-label={`Xem ${u.email}`}
                          title="Xem chi tiết"
                          onClick={() => onDetail(u.id)}
                        >
                          <Eye size={16} />
                        </button>
                        {!isSelf && !protectedAccount(u) && !u.is_deleted && (
                          <>
                            <button
                              className="cf-icon-btn"
                              aria-label={`Đổi vai trò ${u.email}`}
                              title="Đổi vai trò"
                              onClick={() => onAction("role", u)}
                            >
                              <Shield size={16} />
                            </button>
                            <button
                              className="cf-icon-btn"
                              aria-label={`Cấp lại mật khẩu ${u.email}`}
                              title="Cấp lại mật khẩu"
                              onClick={() => onAction("reset-password", u)}
                            >
                              <KeyRound size={16} />
                            </button>
                            {(!isAdmin || !u.is_active) && (
                              <button
                                className="cf-icon-btn"
                                aria-label={`${u.is_active ? "Khóa" : "Mở khóa"} ${u.email}`}
                                title={u.is_active ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                                onClick={() =>
                                  onAction(u.is_active ? "ban" : "unban", u)
                                }
                              >
                                {u.is_active ? (
                                  <Lock size={16} />
                                ) : (
                                  <Unlock size={16} />
                                )}
                              </button>
                            )}
                            <button
                              className="cf-icon-btn cf-danger"
                              aria-label={`Xóa ${u.email}`}
                              title="Xóa tài khoản"
                              onClick={() => onAction("delete", u)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        {!isSelf &&
                          !protectedAccount(u) &&
                          !isAdmin &&
                          u.is_deleted &&
                          u.deletion_status !== "PURGE_PENDING" && (
                            <>
                              <button
                                className="cf-icon-btn"
                                aria-label={`Khôi phục ${u.email}`}
                                title="Khôi phục tài khoản"
                                onClick={() => onAction("restore", u)}
                              >
                                <RotateCcw size={16} />
                              </button>
                              <button
                                className="cf-icon-btn cf-danger"
                                aria-label={`Xóa vĩnh viễn ${u.email}`}
                                title="Xóa vĩnh viễn"
                                onClick={() => onAction("delete", u)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        {u.deletion?.status === "FAILED" && (
                          <button
                            className="cf-icon-btn"
                            aria-label={`Thử lại xóa ${u.email}`}
                            title="Thử lại tác vụ xóa"
                            onClick={() => onAction("retry-delete", u)}
                          >
                            <RefreshCw size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={page}
        pageSize={15}
        total={query.data?.total || 0}
        onChange={onPageChange}
      />
    </>
  );
}
