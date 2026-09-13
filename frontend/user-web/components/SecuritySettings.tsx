"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { errorMessage, dateLabel, type Profile } from "@/lib/finance";
import {
  Panel,
  Field,
  Password,
  Alert,
  Loading,
  ErrorState,
  Empty,
} from "./ui";
export default function SecuritySettings({
  firstTime = false,
  onComplete,
}: {
  firstTime?: boolean;
  onComplete?: () => void;
}) {
  const [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const profile = useQuery<Profile>({
    queryKey: ["user-me"],
    queryFn: async () => (await api.get("/auth/me")).data,
  });
  const sessions = useQuery<
    Array<{
      id: string;
      device_name: string;
      ip_address: string;
      created_at: string;
      expires_at: string;
    }>
  >({
    queryKey: ["sessions"],
    queryFn: async () => (await api.get("/auth/sessions")).data,
    enabled: !firstTime,
  });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirm) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setBusy(true);
    try {
      await api.post(
        firstTime ? "/auth/first-time-password" : "/auth/change-password",
        { current_password: current, new_password: password },
      );
      setSuccess("Đã cập nhật mật khẩu.");
      setCurrent("");
      setPassword("");
      setConfirm("");
      sessionStorage.removeItem("user_access_token");
      sessionStorage.removeItem("user_refresh_token");
      window.location.href = "/login";
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cf-stack">
      {!firstTime && (
        <Panel title="Thông tin tài khoản">
          <div className="cf-panel-body cf-grid-2">
            <div>
              <div className="cf-eyebrow">Họ và tên</div>
              {profile.data?.full_name || "—"}
            </div>
            <div>
              <div className="cf-eyebrow">Email đăng nhập</div>
              {profile.data?.email || "—"}
            </div>
          </div>
        </Panel>
      )}
      <Panel
        title={firstTime ? "Thiết lập mật khẩu" : "Đổi mật khẩu"}
        description="Sử dụng ít nhất 6 ký tự. Nên kết hợp chữ, số và ký tự đặc biệt."
      >
        <form
          onSubmit={submit}
          className="cf-panel-body cf-form"
          style={{ maxWidth: 540 }}
        >
          {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
          {success && <Alert kind="success" onDismiss={() => setSuccess("")}>{success}</Alert>}
          {!firstTime && (
            <Field label="Mật khẩu hiện tại">
              <Password
                value={current}
                onChange={setCurrent}
                autoComplete="current-password"
                minLength={1}
              />
            </Field>
          )}
          <Field label="Mật khẩu mới">
            <Password value={password} onChange={setPassword} />
          </Field>
          <Field label="Xác nhận mật khẩu mới">
            <Password value={confirm} onChange={setConfirm} />
          </Field>
          <div>
            <button className="cf-btn cf-btn-primary" disabled={busy}>
              {busy ? "Đang lưu…" : "Cập nhật mật khẩu"}
            </button>
          </div>
        </form>
      </Panel>
      {!firstTime && (
        <Panel
          title="Phiên đăng nhập"
          description="Các phiên còn hiệu lực của tài khoản."
        >
          {sessions.isPending ? (
            <Loading />
          ) : sessions.isError ? (
            <ErrorState retry={() => sessions.refetch()} />
          ) : !sessions.data?.length ? (
            <Empty title="Chưa có phiên đăng nhập" />
          ) : (
            sessions.data.map((s) => (
              <div className="cf-list-row" key={s.id}>
                <div>
                  <strong>{s.device_name || "Thiết bị chưa xác định"}</strong>
                  <small>
                    {s.ip_address || "Không có địa chỉ IP"} · Bắt đầu{" "}
                    {dateLabel(s.created_at)}
                  </small>
                </div>
                <span className="cf-muted">
                  Hết hạn {dateLabel(s.expires_at)}
                </span>
              </div>
            ))
          )}
        </Panel>
      )}
    </div>
  );
}
