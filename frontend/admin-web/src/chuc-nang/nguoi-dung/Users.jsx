import density from "../../dung-chung/CSS/management.module.css";
import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../dung-chung/connect-api/api";
import { Alert } from "../../dung-chung/UI-chung/ui";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import { errorMessage } from "../../dung-chung/tien-ich/format";
import { useDebouncedValue } from "../../dung-chung/tien-ich/hooks";
import { UserInspector, UserTable } from "./thanh-phan/UserDirectory";
import { UserFilters, UserBulkBar } from "./thanh-phan/UserToolbar";
import UserActionModal from "./thanh-phan/UserActionModal";
import { rowActionKeys, selectableUsers, validSelection } from "./xu-ly/utils";

export default function Users() {
  const [params] = useSearchParams();
  const initialSearch = params.get("search") || "";
  const initialStatus = ["active", "banned"].includes(params.get("status")) ? params.get("status") : "";
  return <UsersContent key={`${initialSearch}-${initialStatus}`} initialSearch={initialSearch} initialStatus={initialStatus} />;
}

function UsersContent({ initialSearch, initialStatus }) {
  const cache = useQueryClient();
  const pending = useRef(false);
  const [search, setSearch] = useState(initialSearch),
    [role, setRole] = useState(""),
    [status, setStatus] = useState(initialStatus),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState([]),
    [action, setAction] = useState(null),
    [target, setTarget] = useState(null),
    [bulkTargets, setBulkTargets] = useState([]),
    [detail, setDetail] = useState(undefined),
    [form, setForm] = useState({
      role: "USER",
      reason: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");

  const debouncedSearch = useDebouncedValue(search);
  // Các truy vấn giúp duy trì sự độc lập giữa danh sách và trình kiểm tra; các tìm kiếm bị hủy sẽ giải phóng các yêu cầu.
  const me = useQuery({
    queryKey: ["admin-me"],
    queryFn: async () => (await api.get("/auth/me")).data,
  });
  // /auth/me does not expose the system-account flag; use the admin profile.
  const currentAdmin = useQuery({
    queryKey: ["admin-user", me.data?.id],
    queryFn: async ({ signal }) => (await api.get(`/admin/users/${me.data.id}`, { signal })).data,
    enabled: !!me.data?.id,
  });
  const canManageRoles = currentAdmin.isSuccess && currentAdmin.data.is_system_account === true;
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
    queryFn: async ({ signal }) => (await api.get("/admin/users/" + activeId, { signal })).data,
    enabled: !!activeId,
  });
  const selectable = selectableUsers(list, me.data?.id);
  const selectedIds = validSelection(selected, list, me.data?.id);

  // Chuẩn hóa việc mở/đóng modal và reset form giữa các nghiệp vụ.
  const filter = (fn, value) => {
    fn(value);
    setPage(1);
    setSelected([]);
    setDetail(undefined);
  };

  const open = (kind, user = null) => {
    if (pending.current) return;
    if (user && !rowActionKeys(user, me.data?.id, canManageRoles).includes(kind)) return;
    if (kind.startsWith("bulk-") && !selectedIds.length) return;
    setAction(kind);
    setTarget(user);
    setBulkTargets(kind.startsWith("bulk-") ? selectedIds : []);
    setError("");
    setForm({
      role: user?.role?.toUpperCase() === "ADMIN" ? "USER" : "SUPPORT",
      reason: "",
    });
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
    if (pending.current) return;
    const isBulk = action?.startsWith("bulk-");
    const targetStillAllowed = isBulk
      ? bulkTargets.length > 0 && bulkTargets.every((id) => selectedIds.includes(id))
      : rowActionKeys(target, me.data?.id, canManageRoles).includes(action);
    if (!targetStillAllowed) {
      setError("Tài khoản đã chọn không còn đủ điều kiện. Đóng cửa sổ và chọn lại.");
      return;
    }
    pending.current = true;
    setError("");
    setBusy(true);
    try {
      let message = "Đã cập nhật tài khoản.";
      if (action === "role")
        await api.patch("/admin/users/" + target.id + "/role", {
          role: form.role === "SUPPORT" ? "ADMIN" : form.role,
          support_only: form.role === "SUPPORT",
        });
      else if (action === "reset-password") {
        await api.post("/admin/users/" + target.id + "/reset-password");
        message = "Đã cấp mật khẩu tạm thời mới. Kiểm tra nhật ký email để xem trạng thái gửi.";
      } else if (isBulk) {
        const { data } = await api.post("/admin/users/" + action, {
          user_ids: bulkTargets,
          ...(action === "bulk-ban"
            ? { reason: form.reason.trim() || "Tài khoản bị tạm ngưng bởi quản trị viên" }
            : {}),
        });
        message = `Đã xử lý ${data.banned_count ?? data.unbanned_count ?? 0} / ${bulkTargets.length} tài khoản.`;
        if (data.skipped_count) message += ` Bỏ qua ${data.skipped_count} tài khoản.`;
      } else if (["ban", "unban"].includes(action)) {
        await api.patch("/admin/users/" + target.id + "/" + action);
      } else {
        throw new Error("Thao tác tài khoản không hợp lệ.");
      }
      await refresh();
      setAction(null);
      setSelected([]);
      setNotice(message);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  // Page chỉ ghép các component feature và truyền callback nghiệp vụ xuống.
  return (
    <div className={`adm-surface adm-live adm-rest adm-users ${density.page}`}>
      <PageHead
        eyebrow="QUẢN TRỊ TÀI KHOẢN"
        title="Người dùng"
        description="Tra cứu tài khoản, quản lý quyền truy cập và trạng thái hoạt động."
      />
      {notice && (
        <Alert kind="success" onDismiss={() => setNotice("")}>
          {notice}
        </Alert>
      )}
      <section className={`adm-card adm-rest-heading ${density.directoryToolbar}`} aria-labelledby="user-directory-title">
        <div>
          <p className="adm-eyebrow">DANH SÁCH TÀI KHOẢN</p>
          <h2 id="user-directory-title">Hồ sơ & quyền truy cập</h2>
          <span>{list.length} / {query.data?.total ?? "—"} người dùng khớp bộ lọc</span>
        </div>
        <div className={density.directoryControls}>
          <UserFilters
            search={search}
            role={role}
            status={status}
            list={list}
            selected={selectedIds}
            page={page}
            onSearch={(v) => filter(setSearch, v)}
            onRole={(v) => filter(setRole, v)}
            onStatus={(v) => filter(setStatus, v)}
          />
        </div>
      </section>
      <div className="adm-rest-split"><section className="adm-card adm-rest-list">
        <UserBulkBar
          count={selectedIds.length}
          onBan={() => open("bulk-ban")}
          onUnban={() => open("bulk-unban")}
          onClear={() => setSelected([])}
        />
        <UserTable
          query={query}
          list={list}
          selected={selectedIds}
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
              checked ? validSelection([...ids, id], list, me.data?.id) : ids.filter((i) => i !== id),
            )
          }
          onDetail={setDetail}
        />
      </section><UserInspector userId={activeId} query={userDetail} meId={me.data?.id} canManageRoles={canManageRoles} onAction={open} onClose={() => setDetail(null)} /></div>

      <UserActionModal
        action={action}
        target={target}
        selectedCount={bulkTargets.length}
        form={form}
        busy={busy}
        error={error}
        onClose={() => { if (!pending.current) setAction(null); }}
        onSubmit={submit}
        onChange={(patch) => {
          if (patch._clearError) { setError(""); return; }
          setForm((f) => ({ ...f, ...patch }));
        }}
      />
    </div>
  );
}
