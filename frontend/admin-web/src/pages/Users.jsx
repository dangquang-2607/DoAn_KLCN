import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, RefreshCw } from "lucide-react";
import api from "../services/api";
import { PageHead, Panel, Alert } from "../components/design";
import { errorMessage } from "../services/format";
import {
  UserFilters,
  UserBulkBar,
  UserTable,
  UserActionModal,
  UserDetailModal,
  protectedAccount,
} from "../components/users";

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
      deletion_mode: "soft",
      release_email: true,
      confirmation: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");

  // ── Queries ────────────────────────────────────────────────
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
      !u.is_deleted &&
      u.role?.toUpperCase() !== "ADMIN",
  );

  // ── Helpers ────────────────────────────────────────────────
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
      reason: kind === "restore" ? "Khoi phuc boi Quan tri vien" : "",
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

  // ── Submit ─────────────────────────────────────────────────
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      let message = "Da cap nhat tai khoan.";
      if (action === "create") {
        await api.post("/admin/users", {
          full_name: form.full_name.trim(),
          email: form.email,
          role: form.role,
        });
        message = "Da tao tai khoan. Yeu cau gui thong tin kich hoat da duoc ghi nhan.";
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
            ? `Da khoa tai khoan. Yeu cau xoa ${data.deletion?.id || ""} dang duoc worker xu ly.`
            : "Da xoa mem tai khoan va thu hoi toan bo phien dang nhap.";
      } else if (action === "restore") {
        await api.post("/admin/users/" + target.id + "/restore", {
          reason: form.reason.trim(),
        });
        message = "Da khoi phuc tai khoan. Nguoi dung can dang nhap lai.";
      } else if (action === "retry-delete") {
        const filePhase = target.deletion?.checkpoint === "DB_PURGED";
        await api.post(
          `/admin/user-deletions/${target.deletion.id}/${filePhase ? "retry-files" : "retry-purge"}`,
        );
        message = "Da xep lai tac vu xoa de worker tiep tuc xu ly.";
      } else if (action === "role")
        await api.patch("/admin/users/" + target.id + "/role", { role: form.role });
      else if (action === "reset-password") {
        await api.post("/admin/users/" + target.id + "/reset-password");
        message = "Da cap mat khau tam thoi moi. Kiem tra nhat ky email de xem trang thai gui.";
      } else if (action === "bulk-delete") {
        const { data } = await api.post("/admin/users/bulk-delete", {
          user_ids: selected,
          reason: form.reason.trim(),
          release_email: true,
        });
        message = `Da xoa mem ${data.deleted_count ?? 0} / ${selected.length} tai khoan.`;
      } else if (action?.startsWith("bulk-")) {
        const { data } = await api.post("/admin/users/" + action, {
          user_ids: selected,
          ...(action === "bulk-ban"
            ? { reason: form.reason.trim() || "Tai khoan bi tam ngung boi quan tri vien" }
            : {}),
        });
        message = `Da xu ly ${data.banned_count ?? data.unbanned_count ?? 0} / ${selected.length} tai khoan.`;
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

  // ── Computed ───────────────────────────────────────────────
  const hardDelete = action === "delete" && form.deletion_mode === "hard";
  const hardConfirmed =
    !hardDelete ||
    [target?.email, "XOA VINH VIEN"].some(
      (value) =>
        value &&
        value.toLocaleLowerCase("vi") === form.confirmation.trim().toLocaleLowerCase("vi"),
    );
  const deletionReasonRequired = ["delete", "bulk-delete"].includes(action);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="QUAN TRI TAI KHOAN"
        title="Nguoi dung"
        description="Tra cuu tai khoan, quan ly quyen truy cap va trang thai hoat dong."
        actions={
          <>
            <button
              className="cf-btn"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw />
              Lam moi
            </button>
            <button className="cf-btn cf-btn-primary" onClick={() => open("create")}>
              <UserPlus />
              Tao nguoi dung
            </button>
          </>
        }
      />
      {notice && (
        <Alert kind="success" onDismiss={() => setNotice("")}>
          {notice}
        </Alert>
      )}
      <Panel>
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
          onPageChange={(p) => { setPage(p); setSelected([]); }}
          onSelectAll={(checked) =>
            setSelected(checked ? selectable.map((u) => u.id) : [])
          }
          onSelectOne={(id, checked) =>
            setSelected((ids) =>
              checked ? [...ids, id] : ids.filter((i) => i !== id),
            )
          }
          onDetail={setDetail}
          onAction={open}
        />
      </Panel>

      <UserActionModal
        action={action}
        target={target}
        form={form}
        busy={busy}
        error={error}
        hardDelete={hardDelete}
        hardConfirmed={hardConfirmed}
        deletionReasonRequired={deletionReasonRequired}
        onClose={() => setAction(null)}
        onSubmit={submit}
        onChange={(patch) => {
          if (patch._clearError) { setError(""); return; }
          setForm((f) => ({ ...f, ...patch }));
        }}
      />
      <UserDetailModal
        userId={detail}
        query={userDetail}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}