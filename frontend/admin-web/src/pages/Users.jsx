import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Download,
  Eye,
  Shield,
  Lock,
  Unlock,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import api from "../services/api";
import {
  PageHead,
  Panel,
  Field,
  Modal,
  Alert,
  Loading,
  ErrorState,
  Empty,
  Pagination,
} from "../components/design";
import { errorMessage, exportCsv } from "../services/format";
const protectedAccount = (u) =>
  ["admin@capitalflow.vn", "admin@cashflow.vn"].includes(
    u.email?.toLowerCase(),
  );
export default function Users() {
  const [params] = useSearchParams();
  const initialSearch = params.get("search") || "";
  return <UsersContent key={initialSearch} initialSearch={initialSearch} />;
}
function UsersContent({ initialSearch }) {
  const cache = useQueryClient();
  const [search, setSearch] = useState(initialSearch),
    [role, setRole] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState([]),
    [action, setAction] = useState(null),
    [target, setTarget] = useState(null),
    [detail, setDetail] = useState(null),
    [form, setForm] = useState({
      full_name: "",
      email: "",
      role: "USER",
      reason: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const me = useQuery({
    queryKey: ["admin-me"],
    queryFn: async () => (await api.get("/auth/me")).data,
  });
  const query = useQuery({
    queryKey: ["admin-users", page, search, role, status],
    queryFn: async () =>
      (
        await api.get("/admin/users", {
          params: {
            page,
            page_size: 15,
            search: search || undefined,
            role: role || undefined,
            status: status || undefined,
          },
        })
      ).data,
    refetchInterval: 30000,
  });
  const userDetail = useQuery({
    queryKey: ["admin-user", detail],
    queryFn: async () => (await api.get("/admin/users/" + detail)).data,
    enabled: !!detail,
  });
  const list = query.data?.items || [];
  const selectable = list.filter(
    (u) =>
      u.id !== me.data?.id &&
      !protectedAccount(u) &&
      u.role?.toUpperCase() !== "ADMIN",
  );
  const filter = (fn, value) => {
    fn(value);
    setPage(1);
    setSelected([]);
  };
  const open = (kind, user = null) => {
    setAction(kind);
    setTarget(user);
    setError("");
    setForm({
      full_name: "",
      email: "",
      role: user?.role?.toUpperCase() === "ADMIN" ? "USER" : "ADMIN",
      reason: "",
    });
    if (kind === "create")
      setForm({ full_name: "", email: "", role: "USER", reason: "" });
  };
  const refresh = () =>
    Promise.all(
      [
        "admin-users",
        "admin-overview",
        "audit-logs",
        "email-logs",
        "admin-user",
      ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
    );
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      let message = "Đã cập nhật tài khoản.";
      if (action === "create") {
        await api.post("/admin/users", {
          full_name: form.full_name.trim(),
          email: form.email,
          role: form.role,
        });
        message =
          "Đã tạo tài khoản. Yêu cầu gửi thông tin kích hoạt đã được ghi nhận.";
      } else if (action === "role")
        await api.patch("/admin/users/" + target.id + "/role", {
          role: form.role,
        });
      else if (action === "reset-password") {
        await api.post("/admin/users/" + target.id + "/reset-password");
        message =
          "Đã cấp mật khẩu tạm thời mới. Kiểm tra nhật ký email để xem trạng thái gửi.";
      } else if (action?.startsWith("bulk-")) {
        const { data } = await api.post("/admin/users/" + action, {
          user_ids: selected,
          ...(action === "bulk-ban"
            ? {
                reason:
                  form.reason.trim() ||
                  "Tài khoản bị tạm ngưng bởi quản trị viên",
              }
            : {}),
        });
        message = `Đã xử lý ${data.banned_count ?? data.unbanned_count ?? 0} / ${selected.length} tài khoản.`;
      } else await api.patch("/admin/users/" + target.id + "/" + action);
      await refresh();
      setAction(null);
      setSelected([]);
      setNotice(message);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const titles = {
    create: "Tạo người dùng",
    role: "Thay đổi vai trò",
    ban: "Khóa tài khoản",
    unban: "Mở khóa tài khoản",
    "reset-password": "Cấp lại mật khẩu",
    "bulk-ban": "Khóa tài khoản đã chọn",
    "bulk-unban": "Mở khóa tài khoản đã chọn",
  };
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="QUẢN TRỊ TÀI KHOẢN"
        title="Người dùng"
        description="Tra cứu tài khoản, quản lý quyền truy cập và trạng thái hoạt động."
        actions={
          <>
            <button
              className="cf-btn"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw />
              Làm mới
            </button>
            <button
              className="cf-btn cf-btn-primary"
              onClick={() => open("create")}
            >
              <UserPlus />
              Tạo người dùng
            </button>
          </>
        }
      />
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      <Panel>
        <div className="cf-toolbar">
          <Field label="Tìm người dùng">
            <input
              className="cf-input"
              placeholder="Họ tên hoặc email…"
              value={search}
              onChange={(e) => filter(setSearch, e.target.value)}
            />
          </Field>
          <Field label="Vai trò">
            <select
              className="cf-input"
              value={role}
              onChange={(e) => filter(setRole, e.target.value)}
            >
              <option value="">Tất cả vai trò</option>
              <option value="USER">Người dùng</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </Field>
          <Field label="Trạng thái">
            <select
              className="cf-input"
              value={status}
              onChange={(e) => filter(setStatus, e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="banned">Đã khóa</option>
            </select>
          </Field>
          <button
            className="cf-btn"
            disabled={!list.length}
            onClick={() =>
              exportCsv("nguoi-dung-trang-" + page + ".csv", [
                ["Họ tên", "Email", "Vai trò", "Trạng thái"],
                ...list
                  .filter((u) => !selected.length || selected.includes(u.id))
                  .map((u) => [
                    u.full_name,
                    u.email,
                    u.role,
                    u.is_active ? "Hoạt động" : "Đã khóa",
                  ]),
              ])
            }
          >
            <Download />
            {selected.length ? "Xuất đã chọn" : "Xuất trang này"}
          </button>
        </div>
        {selected.length > 0 && (
          <div className="cf-toolbar">
            <strong style={{ fontSize: 14 }}>
              Đã chọn {selected.length} tài khoản
            </strong>
            <button
              className="cf-btn cf-btn-sm"
              onClick={() => open("bulk-ban")}
            >
              <Lock />
              Khóa
            </button>
            <button
              className="cf-btn cf-btn-sm"
              onClick={() => open("bulk-unban")}
            >
              <Unlock />
              Mở khóa
            </button>
            <button
              className="cf-btn cf-btn-ghost cf-btn-sm"
              onClick={() => setSelected([])}
            >
              Bỏ chọn
            </button>
          </div>
        )}
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
                      aria-label="Chọn tất cả tài khoản có thể thao tác trong trang"
                      checked={
                        selectable.length > 0 &&
                        selectable.every((u) => selected.includes(u.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? selectable.map((u) => u.id) : [],
                        )
                      }
                    />
                  </th>
                  <th>Người dùng</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Hoạt động gần nhất</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => {
                  const isSelf = u.id === me.data?.id;
                  const isAdmin = u.role?.toUpperCase() === "ADMIN";
                  return (
                    <tr key={u.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${u.email}`}
                          disabled={!selectable.some((s) => s.id === u.id)}
                          checked={selected.includes(u.id)}
                          onChange={(e) =>
                            setSelected((ids) =>
                              e.target.checked
                                ? [...ids, u.id]
                                : ids.filter((id) => id !== u.id),
                            )
                          }
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
                        <span
                          className={`cf-badge ${u.is_active ? "success" : "danger"}`}
                        >
                          {u.is_active ? "Hoạt động" : "Đã khóa"}
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
                            onClick={() => setDetail(u.id)}
                          >
                            <Eye size={16} />
                          </button>
                          {!isSelf && !protectedAccount(u) && (
                            <>
                              <button
                                className="cf-icon-btn"
                                aria-label={`Đổi vai trò ${u.email}`}
                                title="Đổi vai trò"
                                onClick={() => open("role", u)}
                              >
                                <Shield size={16} />
                              </button>
                              <button
                                className="cf-icon-btn"
                                aria-label={`Cấp lại mật khẩu ${u.email}`}
                                title="Cấp lại mật khẩu"
                                onClick={() => open("reset-password", u)}
                              >
                                <KeyRound size={16} />
                              </button>
                              {(!isAdmin || !u.is_active) && (
                                <button
                                  className="cf-icon-btn"
                                  aria-label={`${u.is_active ? "Khóa" : "Mở khóa"} ${u.email}`}
                                  title={
                                    u.is_active
                                      ? "Khóa tài khoản"
                                      : "Mở khóa tài khoản"
                                  }
                                  onClick={() =>
                                    open(u.is_active ? "ban" : "unban", u)
                                  }
                                >
                                  {u.is_active ? (
                                    <Lock size={16} />
                                  ) : (
                                    <Unlock size={16} />
                                  )}
                                </button>
                              )}
                            </>
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
          onChange={(p) => {
            setPage(p);
            setSelected([]);
          }}
        />
      </Panel>
      {action && (
        <Modal
          title={titles[action]}
          busy={busy}
          onClose={() => setAction(null)}
        >
          <form className="cf-form" onSubmit={submit}>
            {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
            {action === "create" ? (
              <>
                <Field label="Họ và tên">
                  <input
                    className="cf-input"
                    required
                    maxLength={150}
                    value={form.full_name}
                    onChange={(e) =>
                      setForm({ ...form, full_name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Email">
                  <input
                    className="cf-input"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </Field>
                <Alert kind="info">
                  Hệ thống tạo mật khẩu tạm thời và gửi thông tin kích hoạt qua
                  email. Người dùng cần đổi mật khẩu khi đăng nhập.
                </Alert>
              </>
            ) : (
              <p>
                {action.startsWith("bulk-")
                  ? `Thao tác áp dụng cho ${selected.length} tài khoản đã chọn.`
                  : `Tài khoản: ${target?.full_name || target?.email} (${target?.email}).`}
              </p>
            )}
            {["create", "role"].includes(action) && (
              <Field label="Vai trò">
                <select
                  className="cf-input"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="USER">Người dùng</option>
                  <option value="ADMIN">Quản trị viên</option>
                </select>
              </Field>
            )}
            {action === "role" && (
              <Alert kind="info">
                Quyền truy cập của tài khoản sẽ thay đổi sau khi xác nhận. Hệ
                thống gửi email thông báo.
              </Alert>
            )}
            {action === "reset-password" && (
              <Alert kind="info">
                Mật khẩu hiện tại sẽ được thay bằng mật khẩu tạm thời và gửi đến
                email của người dùng.
              </Alert>
            )}
            {action === "bulk-ban" && (
              <Field label="Lý do khóa">
                <textarea
                  className="cf-input"
                  rows={3}
                  required
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </Field>
            )}
            {action === "ban" && (
              <Alert kind="info">
                Tài khoản sẽ bị khóa cho đến khi quản trị viên mở lại. Người
                dùng được gửi email thông báo.
              </Alert>
            )}
            <div className="cf-form-actions">
              <button
                className="cf-btn"
                type="button"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Hủy
              </button>
              <button
                className={`cf-btn ${["ban", "bulk-ban", "reset-password"].includes(action) ? "cf-btn-danger" : "cf-btn-primary"}`}
                disabled={busy}
              >
                {busy ? "Đang xử lý…" : "Xác nhận"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal title="Chi tiết người dùng" onClose={() => setDetail(null)}>
          {userDetail.isPending ? (
            <Loading />
          ) : userDetail.isError ? (
            <ErrorState retry={() => userDetail.refetch()} />
          ) : (
            <div className="cf-form">
              <div>
                <h3>{userDetail.data.full_name}</h3>
                <p className="cf-muted">{userDetail.data.email}</p>
              </div>
              <div className="cf-form-grid">
                <div>
                  <div className="cf-eyebrow">Giao dịch</div>
                  {userDetail.data.stats?.transactions_count ?? 0}
                </div>
                <div>
                  <div className="cf-eyebrow">Hóa đơn</div>
                  {userDetail.data.stats?.invoices_count ?? 0}
                </div>
              </div>
              <div>
                <div className="cf-eyebrow">Ngày tạo</div>
                {new Date(userDetail.data.created_at).toLocaleString("vi-VN")}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
