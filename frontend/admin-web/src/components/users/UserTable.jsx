import {
  Eye, Shield, KeyRound, Lock, Unlock,
  Trash2, RotateCcw, RefreshCw,
} from "lucide-react";
import { Loading, ErrorState, Empty, Pagination } from "../design";
import { accountStatus, protectedAccount } from "./utils";

/**
 * UserTable - Bang danh sach nguoi dung voi actions tung dong.
 */
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
          title="Khong tim thay nguoi dung"
          description="Thu thay doi ten, email hoac bo loc."
        />
      ) : (
        <div className="cf-table-wrap">
          <table className="cf-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Chon tat ca tai khoan co the thao tac trong trang"
                    checked={
                      selectable.length > 0 &&
                      selectable.every((u) => selected.includes(u.id))
                    }
                    onChange={(e) => onSelectAll(e.target.checked)}
                  />
                </th>
                <th>Nguoi dung</th>
                <th>Vai tro</th>
                <th>Trang thai</th>
                <th>Hoat dong gan nhat</th>
                <th>Thao tac</th>
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
                        aria-label={`Chon ${u.email}`}
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
                            {u.full_name || "Chua dat ten"}
                            {isSelf ? " (Ban)" : ""}
                          </strong>
                          <div className="cf-sub">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`cf-badge ${isAdmin ? "info" : ""}`}>
                        {isAdmin ? "Quan tri vien" : "Nguoi dung"}
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
                        : "Chua ghi nhan"}
                    </td>
                    <td>
                      <div className="cf-row" style={{ gap: 6 }}>
                        <button
                          className="cf-icon-btn"
                          aria-label={`Xem ${u.email}`}
                          title="Xem chi tiet"
                          onClick={() => onDetail(u.id)}
                        >
                          <Eye size={16} />
                        </button>
                        {!isSelf && !protectedAccount(u) && !u.is_deleted && (
                          <>
                            <button
                              className="cf-icon-btn"
                              aria-label={`Doi vai tro ${u.email}`}
                              title="Doi vai tro"
                              onClick={() => onAction("role", u)}
                            >
                              <Shield size={16} />
                            </button>
                            <button
                              className="cf-icon-btn"
                              aria-label={`Cap lai mat khau ${u.email}`}
                              title="Cap lai mat khau"
                              onClick={() => onAction("reset-password", u)}
                            >
                              <KeyRound size={16} />
                            </button>
                            {(!isAdmin || !u.is_active) && (
                              <button
                                className="cf-icon-btn"
                                aria-label={`${u.is_active ? "Khoa" : "Mo khoa"} ${u.email}`}
                                title={u.is_active ? "Khoa tai khoan" : "Mo khoa tai khoan"}
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
                              aria-label={`Xoa ${u.email}`}
                              title="Xoa tai khoan"
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
                                aria-label={`Khoi phuc ${u.email}`}
                                title="Khoi phuc tai khoan"
                                onClick={() => onAction("restore", u)}
                              >
                                <RotateCcw size={16} />
                              </button>
                              <button
                                className="cf-icon-btn cf-danger"
                                aria-label={`Xoa vinh vien ${u.email}`}
                                title="Xoa vinh vien"
                                onClick={() => onAction("delete", u)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        {u.deletion?.status === "FAILED" && (
                          <button
                            className="cf-icon-btn"
                            aria-label={`Thu lai xoa ${u.email}`}
                            title="Thu lai tac vu xoa"
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