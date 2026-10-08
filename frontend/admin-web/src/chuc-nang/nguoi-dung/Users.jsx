/**
 * ============================================================================
 * TÊN FILE: Users.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Quản lý người dùng
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối danh sách, chi tiết và toàn bộ mutation quản trị tài khoản.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React Query, URL search params, admin API và components/users.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất route Users với lọc, phân trang, thao tác đơn lẻ và hàng loạt.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không cho thao tác nguy hiểm trên tài khoản hệ thống và giữ xác nhận xóa vĩnh viễn.
 * ============================================================================
 */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, RefreshCw, UsersRound } from "lucide-react";
import api from "../../dung-chung/connect-api/api";
import { Alert } from "../../dung-chung/UI-chung/design";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import { errorMessage } from "../../dung-chung/tien-ich/format";
import useDebouncedValue from "../../dung-chung/tien-ich/useDebouncedValue";
import UserInspector from "./thanh-phan/UserInspector";
import {
  UserFilters,
  UserBulkBar,
  UserTable,
  UserActionModal,
  protectedAccount,
} from "./thanh-phan/index";

export default function Users() {
  const [params] = useSearchParams();
  const initialSearch = params.get("search") || "";
  const initialStatus = ["active", "banned", "deleted", "purge_pending"].includes(params.get("status")) ? params.get("status") : "";
  return <UsersContent key={`${initialSearch}-${initialStatus}`} initialSearch={initialSearch} initialStatus={initialStatus} />;
}

function UsersContent({ initialSearch, initialStatus }) {
  const cache = useQueryClient();
  const [search, setSearch] = useState(initialSearch),
    [role, setRole] = useState(""),
    [status, setStatus] = useState(initialStatus),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState([]),
    [action, setAction] = useState(null),
    [target, setTarget] = useState(null),
    [detail, setDetail] = useState(undefined),
    [form, setForm] = useState({
      full_name: "",
      email: "",
      role: "USER",
      reason: "",
      deletion_mode: "soft",
      release_email: true,
      confirmation: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");

  const debouncedSearch = useDebouncedValue(search);
  // Queries keep list and inspector independent; cancelled searches release requests.
  const me = useQuery({
    queryKey: ["admin-me"],
    queryFn: async () => (await api.get("/auth/me")).data,
  });
  const query = useQuery({
    queryKey: ["admin-users", page, debouncedSearch, role, status],
    queryFn: async ({ signal }) =>
      (
        await api.get("/admin/users", {
          params: {
            page,
            page_size: 15,
            search: debouncedSearch || undefined,
            role: role || undefined,
            status: status || undefined,
          }, signal,
        })
      ).data,
    refetchInterval: 30000,
  });
  const list = query.data?.items || [];
  const activeId = detail === undefined ? list[0]?.id : detail;
  const userDetail = useQuery({
    queryKey: ["admin-user", activeId],
    queryFn: async () => (await api.get("/admin/users/" + activeId)).data,
    enabled: !!activeId,
  });
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: async () => (await api.get("/admin/overview")).data });
  const selectable = list.filter(
    (u) =>
      u.id !== me.data?.id &&
      !protectedAccount(u) &&
      !u.is_deleted &&
      u.role?.toUpperCase() !== "ADMIN",
  );

  // Chuẩn hóa việc mở/đóng modal và reset form giữa các nghiệp vụ.
  const filter = (fn, value) => {
    fn(value);
    setPage(1);
    setSelected([]);
    setDetail(undefined);
  };

  const open = (kind, user = null) => {
    setAction(kind);
    setTarget(user);
    setError("");
    setForm({
      full_name: "",
      email: "",
      role: user?.role?.toUpperCase() === "ADMIN" ? "USER" : "ADMIN",
      reason: kind === "restore" ? "Khôi phục bởi Quản trị viên" : "",
      deletion_mode: user?.is_deleted ? "hard" : "soft",
      release_email: true,
      confirmation: "",
      _selectedCount: selected.length,
    });
    if (kind === "create")
      setForm({ full_name: "", email: "", role: "USER", reason: "", deletion_mode: "soft", release_email: true, confirmation: "" });
  };

  const refresh = () =>
    Promise.all(
      ["admin-users", "admin-overview", "audit-logs", "email-logs", "admin-user"].map(
        (key) => cache.invalidateQueries({ queryKey: [key] }),
      ),
    );

  // Điều phối endpoint theo action; mọi mutation đều làm mới cache liên quan.
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
        message = "Đã tạo tài khoản. Yêu cầu gửi thông tin kích hoạt đã được ghi nhận.";
      } else if (action === "delete") {
        const { data } = await api.delete("/admin/users/" + target.id, {
          data: {
            mode: form.deletion_mode,
            reason: form.reason.trim(),
            release_email: form.release_email,
            confirmation: form.deletion_mode === "hard" ? form.confirmation.trim() : undefined,
          },
        });
        message =
          form.deletion_mode === "hard"
            ? `Đã khóa tài khoản. Yêu cầu xóa ${data.deletion?.id || ""} đang được worker xử lý.`
            : "Đã xóa mềm tài khoản và thu hồi toàn bộ phiên đăng nhập.";
      } else if (action === "restore") {
        await api.post("/admin/users/" + target.id + "/restore", {
          reason: form.reason.trim(),
        });
        message = "Đã khôi phục tài khoản. Người dùng cần đăng nhập lại.";
      } else if (action === "retry-delete") {
        const filePhase = target.deletion?.checkpoint === "DB_PURGED";
        await api.post(
          `/admin/user-deletions/${target.deletion.id}/${filePhase ? "retry-files" : "retry-purge"}`,
        );
        message = "Đã xếp lại tác vụ xóa để worker tiếp tục xử lý.";
      } else if (action === "role")
        await api.patch("/admin/users/" + target.id + "/role", { role: form.role });
      else if (action === "reset-password") {
        await api.post("/admin/users/" + target.id + "/reset-password");
        message = "Đã cấp mật khẩu tạm thời mới. Kiểm tra nhật ký email để xem trạng thái gửi.";
      } else if (action === "bulk-delete") {
        const { data } = await api.post("/admin/users/bulk-delete", {
          user_ids: selected,
          reason: form.reason.trim(),
          release_email: true,
        });
        message = `Đã xóa mềm ${data.deleted_count ?? 0} / ${selected.length} tài khoản.`;
      } else if (action?.startsWith("bulk-")) {
        const { data } = await api.post("/admin/users/" + action, {
          user_ids: selected,
          ...(action === "bulk-ban"
            ? { reason: form.reason.trim() || "Tài khoản bị tạm ngưng bởi quản trị viên" }
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

  // Các giá trị dẫn xuất quyết định khả năng chọn và xác nhận thao tác nguy hiểm.
  const hardDelete = action === "delete" && form.deletion_mode === "hard";
  const hardConfirmed =
    !hardDelete ||
    [target?.email, "XOA VINH VIEN", "XÓA VĨNH VIỄN"].some(
      (value) =>
        value &&
        value.toLocaleLowerCase("vi") === form.confirmation.trim().toLocaleLowerCase("vi"),
    );
  const deletionReasonRequired = ["delete", "bulk-delete"].includes(action);

  // Page chỉ ghép các component feature và truyền callback nghiệp vụ xuống.
  return (
    <div className="adm-surface adm-live adm-rest adm-users-demo">
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
            <button className="cf-btn cf-btn-primary" onClick={() => open("create")}>
              <UserPlus />
              Tạo người dùng
            </button>
          </>
        }
      />
      {notice && (
        <Alert kind="success" onDismiss={() => setNotice("")}>
          {notice}
        </Alert>
      )}
      {overview.data && !overview.isError && <div className="adm-rest-signal adm-rest-signal--users"><UsersRound size={20} /><div><strong>{overview.data.users.total} tài khoản hiện có</strong><span>{overview.data.users.active} có thể truy cập · {overview.data.users.banned} bị khóa · không bao gồm tài khoản đã xóa.</span></div><span className="adm-rest-signal-number">{overview.data.users.banned}<small>đã khóa</small></span></div>}
      <div className="adm-rest-heading"><div><p className="adm-eyebrow">DANH SÁCH TÀI KHOẢN</p><h2>Hồ sơ & quyền truy cập</h2><span>{list.length} / {query.data?.total ?? "—"} người dùng khớp bộ lọc</span></div>
        <UserFilters
          search={search}
          role={role}
          status={status}
          list={list}
          selected={selected}
          page={page}
          onSearch={(v) => filter(setSearch, v)}
          onRole={(v) => filter(setRole, v)}
          onStatus={(v) => filter(setStatus, v)}
        />
      </div>
      <div className="adm-rest-split"><section className="adm-card adm-rest-list">
        <UserBulkBar
          count={selected.length}
          onBan={() => open("bulk-ban")}
          onUnban={() => open("bulk-unban")}
          onDelete={() => open("bulk-delete")}
          onClear={() => setSelected([])}
        />
        <UserTable
          query={query}
          list={list}
          selected={selected}
          selectable={selectable}
          meId={me.data?.id}
          page={page}
          activeId={activeId}
          onPageChange={(p) => { setPage(p); setSelected([]); setDetail(undefined); }}
          onSelectAll={(checked) =>
            setSelected(checked ? selectable.map((u) => u.id) : [])
          }
          onSelectOne={(id, checked) =>
            setSelected((ids) =>
              checked ? [...ids, id] : ids.filter((i) => i !== id),
            )
          }
          onDetail={setDetail}
        />
      </section><UserInspector userId={activeId} query={userDetail} meId={me.data?.id} onAction={open} onClose={() => setDetail(null)} /></div>

      <UserActionModal
        action={action}
        target={target}
        form={form}
        busy={busy}
        error={error}
        hardConfirmed={hardConfirmed}
        deletionReasonRequired={deletionReasonRequired}
        onClose={() => setAction(null)}
        onSubmit={submit}
        onChange={(patch) => {
          if (patch._clearError) { setError(""); return; }
          setForm((f) => ({ ...f, ...patch }));
        }}
      />
    </div>
  );
}
