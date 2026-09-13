import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, RefreshCw, Eye } from "lucide-react";
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
import { errorMessage } from "../services/format";
const types = {
  PASSWORD_RESET_OTP: "Mã khôi phục mật khẩu",
  WELCOME_ONBOARDING: "Chào mừng",
  ACCOUNT_CREATED: "Tạo tài khoản",
  RESET_PASSWORD_TEMP: "Mật khẩu tạm thời",
  BUDGET_ALERT_80: "Cảnh báo ngân sách",
  BUDGET_ALERT_100: "Vượt ngân sách",
  ACCOUNT_BANNED: "Khóa tài khoản",
  ACCOUNT_UNBANNED: "Mở khóa tài khoản",
  ROLE_UPDATED: "Thay đổi vai trò",
  SYSTEM_TEST: "Kiểm thử",
};
export default function EmailLogs() {
  const cache = useQueryClient(),
    [params] = useSearchParams();
  const [tab, setTab] = useState(
      params.get("tab") === "settings" ? "settings" : "logs",
    ),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [type, setType] = useState(""),
    [status, setStatus] = useState(""),
    [detail, setDetail] = useState(null),
    [test, setTest] = useState(false),
    [recipient, setRecipient] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [dirty, setDirty] = useState(false),
    [draft, setForm] = useState(null);
  const logs = useQuery({
    queryKey: ["email-logs", page, search, type, status],
    queryFn: async () =>
      (
        await api.get("/admin/email/logs", {
          params: {
            page,
            page_size: 15,
            search: search || undefined,
            email_type: type || undefined,
            status: status || undefined,
          },
        })
      ).data,
  });
  const settings = useQuery({
    queryKey: ["email-settings"],
    queryFn: async () => (await api.get("/admin/email/settings")).data,
  });
  const d = settings.data;
  const form = dirty
    ? draft
    : d
      ? {
          smtp_host: d.smtp_host,
          smtp_port: d.smtp_port,
          smtp_user: d.smtp_user,
          smtp_password: "",
          smtp_tls: d.smtp_tls,
          smtp_ssl: d.smtp_ssl,
          emails_from_email: d.emails_from_email,
          emails_from_name: d.emails_from_name,
        }
      : null;
  const update = (key, value) => {
    setDirty(true);
    setForm({ ...form, [key]: value });
  };
  const filter = (fn, value) => {
    fn(value);
    setPage(1);
  };
  const save = async (e) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.put("/admin/email/settings", {
        ...form,
        smtp_port: Number(form.smtp_port),
      });
      await cache.invalidateQueries({ queryKey: ["email-settings"] });
      setDirty(false);
      setNotice("Đã lưu cấu hình gửi thư vào hệ thống.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const send = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/admin/email/test", {
        recipient_email: recipient,
      });
      if (!data.success) {
        setError("Gửi thử thất bại. Kiểm tra cấu hình và nhật ký email.");
        return;
      }
      setTest(false);
      setNotice(
        data.mode === "QUEUED"
          ? "Đã xếp hàng gửi thư. Kiểm tra nhật ký chuyển phát để xem kết quả."
          : data.mode === "REAL_SMTP"
          ? "Đã gửi email thử qua máy chủ SMTP."
          : "Đã lưu email thử ở chế độ xem trước. Chưa gửi đến hộp thư người nhận.",
      );
      await cache.invalidateQueries({ queryKey: ["email-logs"] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const list = logs.data?.items || [];
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="THÔNG BÁO & GỬI THƯ"
        title="Email & cấu hình"
        description="Kiểm tra lịch sử chuyển phát và quản lý máy chủ gửi thư."
        actions={
          <>
            <button
              className="cf-btn"
              onClick={() => logs.refetch()}
              disabled={logs.isFetching}
            >
              <RefreshCw />
              Làm mới
            </button>
            <button
              className="cf-btn cf-btn-primary"
              onClick={() => {
                setTest(true);
                setError("");
              }}
            >
              <Send />
              Gửi email thử
            </button>
          </>
        }
      />
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      {error && !test && <Alert onDismiss={() => setError("")}>{error}</Alert>}
      <div className="cf-tabs" role="tablist" aria-label="Quản lý email">
        <button
          role="tab"
          aria-selected={tab === "logs"}
          onClick={() => setTab("logs")}
        >
          Nhật ký gửi thư
        </button>
        <button
          role="tab"
          aria-selected={tab === "settings"}
          onClick={() => setTab("settings")}
        >
          Cấu hình gửi thư
        </button>
      </div>
      {tab === "logs" ? (
        <Panel>
          <div className="cf-toolbar">
            <Field label="Người nhận">
              <input
                className="cf-input"
                placeholder="Tìm theo email…"
                value={search}
                onChange={(e) => filter(setSearch, e.target.value)}
              />
            </Field>
            <Field label="Loại email">
              <select
                className="cf-input"
                value={type}
                onChange={(e) => filter(setType, e.target.value)}
              >
                <option value="">Tất cả loại</option>
                {Object.entries(types).map(([v, l]) => (
                  <option value={v} key={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Trạng thái">
              <select
                className="cf-input"
                value={status}
                onChange={(e) => filter(setStatus, e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="SENT">Đã gửi</option>
                <option value="LOGGED_DEV">Lưu xem trước</option>
                <option value="FAILED">Thất bại</option>
              </select>
            </Field>
          </div>
          {logs.isPending ? (
            <Loading />
          ) : logs.isError ? (
            <ErrorState retry={() => logs.refetch()} />
          ) : !list.length ? (
            <Empty
              title="Chưa có email phù hợp"
              description="Các lần gửi thư sẽ được ghi nhận tại đây."
            />
          ) : (
            <div className="cf-table-wrap">
              <table className="cf-table">
                <thead>
                  <tr>
                    <th>Người nhận / tiêu đề</th>
                    <th>Loại</th>
                    <th>Trạng thái</th>
                    <th>Thời gian</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <strong>{l.recipient}</strong>
                        <div className="cf-sub">{l.subject}</div>
                      </td>
                      <td>{types[l.email_type] || l.email_type}</td>
                      <td>
                        <span
                          className={`cf-badge ${l.status === "SENT" ? "success" : l.status === "FAILED" ? "danger" : "warning"}`}
                        >
                          {l.status === "SENT"
                            ? "Đã gửi"
                            : l.status === "LOGGED_DEV"
                              ? "Lưu xem trước"
                              : "Thất bại"}
                        </span>
                      </td>
                      <td>{new Date(l.created_at).toLocaleString("vi-VN")}</td>
                      <td>
                        <button
                          className="cf-icon-btn"
                          aria-label="Chi tiết email"
                          onClick={() => setDetail(l)}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={page}
            pageSize={15}
            total={logs.data?.total || 0}
            onChange={setPage}
          />
        </Panel>
      ) : settings.isPending ? (
        <Loading />
      ) : settings.isError ? (
        <ErrorState retry={() => settings.refetch()} />
      ) : (
        form && (
          <Panel
            title="Máy chủ gửi thư"
            description={
              settings.data.is_dual_mode
                ? "Chế độ xem trước: thư được lưu cục bộ, chưa gửi ra ngoài."
                : "Đang sử dụng máy chủ SMTP để gửi thư."
            }
          >
            <form className="cf-panel-body cf-form" onSubmit={save}>
              <Alert kind="info">
                Cấu hình được lưu trong hệ thống. Để trống mật khẩu ứng dụng để
                giữ mật khẩu đang dùng.
              </Alert>
              <div className="cf-form-grid">
                <Field label="Máy chủ SMTP">
                  <input
                    className="cf-input"
                    required
                    value={form.smtp_host}
                    onChange={(e) => update("smtp_host", e.target.value)}
                  />
                </Field>
                <Field label="Cổng">
                  <input
                    className="cf-input"
                    type="number"
                    min="1"
                    max="65535"
                    required
                    value={form.smtp_port}
                    onChange={(e) => update("smtp_port", e.target.value)}
                  />
                </Field>
                <Field label="Tài khoản gửi thư">
                  <input
                    className="cf-input"
                    value={form.smtp_user}
                    onChange={(e) => update("smtp_user", e.target.value)}
                  />
                </Field>
                <Field
                  label="Mật khẩu ứng dụng"
                  hint={
                    settings.data.has_password
                      ? "Đã có mật khẩu. Để trống để giữ nguyên."
                      : "Chưa có mật khẩu gửi thư."
                  }
                >
                  <input
                    className="cf-input"
                    type="password"
                    autoComplete="new-password"
                    value={form.smtp_password}
                    onChange={(e) => update("smtp_password", e.target.value)}
                  />
                </Field>
                <Field label="Địa chỉ người gửi">
                  <input
                    className="cf-input"
                    required
                    type="email"
                    value={form.emails_from_email}
                    onChange={(e) =>
                      update("emails_from_email", e.target.value)
                    }
                  />
                </Field>
                <Field label="Tên người gửi">
                  <input
                    className="cf-input"
                    required
                    value={form.emails_from_name}
                    onChange={(e) => update("emails_from_name", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Bảo mật kết nối">
                <select
                  className="cf-input"
                  value={form.smtp_ssl ? "ssl" : form.smtp_tls ? "tls" : "none"}
                  onChange={(e) => {
                    setDirty(true);
                    setForm({
                      ...form,
                      smtp_ssl: e.target.value === "ssl",
                      smtp_tls: e.target.value === "tls",
                    });
                  }}
                >
                  <option value="tls">STARTTLS</option>
                  <option value="ssl">SSL / TLS</option>
                  <option value="none">Không mã hóa</option>
                </select>
              </Field>
              <div className="cf-form-actions">
                <button
                  type="button"
                  className="cf-btn"
                  onClick={() => {
                    setDirty(false);
                    setForm({ ...settings.data, smtp_password: "" });
                  }}
                  disabled={!dirty || busy}
                >
                  Bỏ thay đổi
                </button>
                <button
                  className="cf-btn cf-btn-primary"
                  disabled={busy || !dirty}
                >
                  {busy ? "Đang lưu…" : "Lưu cấu hình"}
                </button>
              </div>
            </form>
          </Panel>
        )
      )}
      {test && (
        <Modal title="Gửi email thử" onClose={() => setTest(false)} busy={busy}>
          <form className="cf-form" onSubmit={send}>
            {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
            <p className="cf-muted">
              Gửi một email kiểm tra bằng cấu hình hiện tại.
            </p>
            <Field label="Email người nhận">
              <input
                className="cf-input"
                type="email"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </Field>
            <div className="cf-form-actions">
              <button
                type="button"
                className="cf-btn"
                disabled={busy}
                onClick={() => setTest(false)}
              >
                Hủy
              </button>
              <button className="cf-btn cf-btn-primary" disabled={busy}>
                <Mail />
                {busy ? "Đang gửi…" : "Gửi email thử"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal title="Chi tiết chuyển phát" onClose={() => setDetail(null)}>
          <div className="cf-form">
            <div>
              <div className="cf-eyebrow">Người nhận</div>
              {detail.recipient}
            </div>
            <div>
              <div className="cf-eyebrow">Tiêu đề</div>
              {detail.subject}
            </div>
            <div>
              <div className="cf-eyebrow">Trạng thái</div>
              {detail.status}
            </div>
            {detail.error_message && <Alert persistent>{detail.error_message}</Alert>}
            <p className="cf-muted">
              {new Date(detail.created_at).toLocaleString("vi-VN")}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
