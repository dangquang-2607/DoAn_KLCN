import density from "../../dung-chung/CSS/operations.module.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Mail, ServerCog } from "lucide-react";
import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert } from "../../dung-chung/UI-chung/ui";
import PageHead from "../../dung-chung/UI-chung/WorkspaceHead";
import { EmailInspector, EmailLogFilters, EmailLogTable } from "./thanh-phan/EmailLogWorkspace";
import { SmtpModePanel, SmtpSettingsForm } from "./thanh-phan/SmtpSettingsForm";
import { useDebouncedValue } from "../../dung-chung/tien-ich/hooks";
import { number, errorMessage } from "../../dung-chung/tien-ich/format";
import SmtpTestModal from "./thanh-phan/SmtpTestModal";
import api from "../../dung-chung/connect-api/api";

const EMAIL_TYPES = {
  // Các mã phải khớp EmailService; cảnh báo ngưỡng và vượt ngân sách cùng một loại.
  PASSWORD_RESET: "Mã khôi phục mật khẩu",
  WELCOME: "Chào mừng",
  RESET_PASSWORD_TEMP: "Mật khẩu tạm thời",
  BUDGET_ALERT: "Cảnh báo ngân sách",
  ACCOUNT_BANNED: "Khóa tài khoản",
  ACCOUNT_UNBANNED: "Mở khóa tài khoản",
  ROLE_UPDATED: "Thay đổi vai trò",
  TEST_EMAIL: "Kiểm thử",
  SUPPORT_REPLY: "Phản hồi hỗ trợ",
};

export default function EmailLogs() {
  const cache = useQueryClient();
  const pending = useRef(false);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "settings" ? "settings" : "logs";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState(undefined);
  const [test, setTest] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [draft, setForm] = useState(null);
  const term = useDebouncedValue(search);
  const logs = useQuery({ queryKey: ["email-logs", page, term, type, status], queryFn: async ({ signal }) => (await api.get("/admin/email/logs", { params: { page, page_size: 15, search: term || undefined, email_type: type || undefined, status: status || undefined }, signal })).data, enabled: tab === "logs" });
  const settings = useQuery({ queryKey: ["email-settings"], queryFn: async ({ signal }) => (await api.get("/admin/email/settings", { signal })).data });
  const data = settings.data;
  const form = dirty ? draft : data ? { smtp_host: data.smtp_host, smtp_port: data.smtp_port, smtp_user: data.smtp_user, smtp_password: "", smtp_tls: data.smtp_tls, smtp_ssl: data.smtp_ssl, emails_from_email: data.emails_from_email, emails_from_name: data.emails_from_name } : null;
  const list = logs.data?.items || [];
  const selectedLog = detail === undefined ? list[0] : list.find((item) => item.id === detail?.id);

  const setTab = (value) => {
    if (pending.current || value === tab) return;
    const next = new URLSearchParams(params);
    if (value === "settings") next.set("tab", "settings");
    else next.delete("tab");
    setParams(next);
  };
  const openTest = () => {
    if (pending.current) return;
    setRecipient("");
    setError("");
    setTest(true);
  };

  const update = (key, value) => { if (pending.current) return; setDirty(true); setForm({ ...form, [key]: value }); };
  const filter = (setter, value) => { setter(value); setPage(1); setDetail(undefined); };

  // Chỉ gửi mật khẩu mới khi quản trị viên nhập; chuỗi rỗng giữ secret hiện hành ở backend.
  const save = async (event) => {
    event.preventDefault();
    if (!form || pending.current) return;
    if (!form.smtp_host.trim() || /\s|:\/\//.test(form.smtp_host.trim())) {
      setError("Nhập tên máy chủ SMTP hợp lệ, không kèm giao thức hoặc khoảng trắng."); return;
    }
    const port = Number(form.smtp_port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) { setError("Cổng SMTP phải là số nguyên từ 1 đến 65535."); return; }
    pending.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      await api.put("/admin/email/settings", { ...form, smtp_host: form.smtp_host.trim(), smtp_port: port });
      await cache.invalidateQueries({ queryKey: ["email-settings"] });
      setDirty(false); setForm(null); setNotice("Đã lưu cấu hình gửi thư vào hệ thống.");
    } catch (caught) { setError(errorMessage(caught)); } finally { pending.current = false; setBusy(false); }
  };

  // Backend quyết định gửi thật, xếp hàng hay chỉ lưu bản xem trước theo cấu hình môi trường.
  const send = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setError(""); setBusy(true);
    try {
      const { data: result } = await api.post("/admin/email/test", { recipient_email: recipient.trim() });
      await cache.invalidateQueries({ queryKey: ["email-logs"] });
      if (!result.success) { setError("Gửi thử thất bại. Kiểm tra cấu hình và nhật ký email."); return; }
      setTest(false);
      setNotice(result.mode === "QUEUED" ? "Đã xếp hàng gửi thư. Kiểm tra nhật ký chuyển phát để xem kết quả." : result.mode === "REAL_SMTP" ? "Đã gửi email thử qua máy chủ SMTP." : "Đã lưu email thử ở chế độ xem trước. Chưa gửi đến hộp thư người nhận.");
    } catch (caught) { setError(errorMessage(caught)); } finally { pending.current = false; setBusy(false); }
  };

  return (
    <div className={`adm-surface adm-live adm-rest adm-email ${density.page}`}>
      <PageHead eyebrow="THÔNG BÁO & GỬI THƯ" title="Email & cấu hình" description="Kiểm tra lịch sử chuyển phát và quản lý máy chủ gửi thư." actions={tab === "settings" && <button className="cf-btn cf-btn-primary" disabled={busy} onClick={openTest}><Send />Gửi email thử</button>} />
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      {error && !test && <Alert onDismiss={() => setError("")}>{error}</Alert>}
      {tab === "logs" && <div className="adm-email-top"><div className="adm-email-metrics">{[["Đã gửi", "sent"], ["Cần kiểm tra", "needs_attention"], ["Chỉ xem trước", "preview"]].map(([label, key]) => <div key={key}><span>{label}</span><strong>{logs.isError || !logs.data?.summary ? "—" : number.format(logs.data.summary[key] ?? (key === "needs_attention" ? logs.data.summary.failed : 0))}</strong><small>khớp bộ lọc hiện tại</small></div>)}</div><button className="cf-btn cf-btn-primary" disabled={busy} onClick={openTest}><Send />Gửi email thử</button></div>}
      <div className="adm-email-tabs" role="group" aria-label="Quản lý email"><button aria-pressed={tab === "logs"} className={tab === "logs" ? "is-active" : ""} onClick={() => setTab("logs")}><Mail size={16} />Nhật ký gửi thư</button><button aria-pressed={tab === "settings"} className={tab === "settings" ? "is-active" : ""} onClick={() => setTab("settings")}><ServerCog size={16} />Cấu hình máy chủ</button></div>
      {tab === "logs" ? <>
        <div className="adm-rest-heading"><div><p className="adm-eyebrow">LỊCH SỬ CHUYỂN PHÁT</p><h2>Kiểm tra từng lần gửi</h2><span>{list.length} / {logs.data?.total ?? "—"} bản ghi</span></div><EmailLogFilters search={search} type={type} status={status} types={EMAIL_TYPES} onSearchChange={(value) => filter(setSearch, value)} onTypeChange={(value) => filter(setType, value)} onStatusChange={(value) => filter(setStatus, value)} /></div>
        <div className="adm-email-layout"><section className="adm-card adm-email-list"><EmailLogTable query={logs} list={list} page={page} onPageChange={(value) => { setPage(value); setDetail(undefined); }} onDetail={setDetail} selectedId={selectedLog?.id} /></section><EmailInspector detail={selectedLog} types={EMAIL_TYPES} onClose={() => setDetail(null)} /></div>
      </> : <div className="adm-email-settings"><SmtpSettingsForm query={settings} form={form} dirty={dirty} busy={busy} onUpdate={update} onSecurityChange={(value) => { setDirty(true); setForm({ ...form, smtp_ssl: value === "ssl", smtp_tls: value === "tls" }); }} onReset={() => { setDirty(false); setForm({ ...settings.data, smtp_password: "" }); }} onSubmit={save} /><SmtpModePanel query={settings} /></div>}
      <SmtpTestModal open={test} recipient={recipient} busy={busy} error={error} onRecipientChange={setRecipient} onDismissError={() => setError("")} onClose={() => setTest(false)} onSubmit={send} />
    </div>
  );
}
