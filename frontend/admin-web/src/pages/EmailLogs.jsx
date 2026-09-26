/**
 * ============================================================================
 * TÊN FILE: EmailLogs.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Email & cấu hình
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều phối nhật ký chuyển phát, cấu hình SMTP và thao tác gửi email thử.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React Query, URL search params, admin API client và các component email-logs.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất route EmailLogs gồm hai tab logs/settings và hai modal nghiệp vụ.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không đọc lại mật khẩu SMTP; để trống mật khẩu khi lưu nghĩa là giữ secret hiện tại.
 * ============================================================================
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, PageHead, Panel } from "../components/design";
import EmailDeliveryDetailModal from "../components/email-logs/EmailDeliveryDetailModal";
import EmailLogFilters from "../components/email-logs/EmailLogFilters";
import EmailLogTable from "../components/email-logs/EmailLogTable";
import SmtpSettingsForm from "../components/email-logs/SmtpSettingsForm";
import SmtpTestModal from "../components/email-logs/SmtpTestModal";
import api from "../services/api";
import { errorMessage } from "../services/format";

const EMAIL_TYPES = {
  PASSWORD_RESET_OTP: "Mã khôi phục mật khẩu", WELCOME_ONBOARDING: "Chào mừng", ACCOUNT_CREATED: "Tạo tài khoản", RESET_PASSWORD_TEMP: "Mật khẩu tạm thời", BUDGET_ALERT_80: "Cảnh báo ngân sách", BUDGET_ALERT_100: "Vượt ngân sách", ACCOUNT_BANNED: "Khóa tài khoản", ACCOUNT_UNBANNED: "Mở khóa tài khoản", ROLE_UPDATED: "Thay đổi vai trò", SYSTEM_TEST: "Kiểm thử",
};

export default function EmailLogs() {
  const cache = useQueryClient();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "settings" ? "settings" : "logs");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState(null);
  const [test, setTest] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [draft, setForm] = useState(null);
  const logs = useQuery({ queryKey: ["email-logs", page, search, type, status], queryFn: async () => (await api.get("/admin/email/logs", { params: { page, page_size: 15, search: search || undefined, email_type: type || undefined, status: status || undefined } })).data });
  const settings = useQuery({ queryKey: ["email-settings"], queryFn: async () => (await api.get("/admin/email/settings")).data });
  const data = settings.data;
  const form = dirty ? draft : data ? { smtp_host: data.smtp_host, smtp_port: data.smtp_port, smtp_user: data.smtp_user, smtp_password: "", smtp_tls: data.smtp_tls, smtp_ssl: data.smtp_ssl, emails_from_email: data.emails_from_email, emails_from_name: data.emails_from_name } : null;
  const list = logs.data?.items || [];

  const update = (key, value) => { setDirty(true); setForm({ ...form, [key]: value }); };
  const filter = (setter, value) => { setter(value); setPage(1); };

  // Chỉ gửi mật khẩu mới khi quản trị viên nhập; chuỗi rỗng giữ secret hiện hành ở backend.
  const save = async (event) => {
    event.preventDefault();
    if (!form) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api.put("/admin/email/settings", { ...form, smtp_port: Number(form.smtp_port) });
      await cache.invalidateQueries({ queryKey: ["email-settings"] });
      setDirty(false); setNotice("Đã lưu cấu hình gửi thư vào hệ thống.");
    } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };

  // Backend quyết định gửi thật, xếp hàng hay chỉ lưu bản xem trước theo cấu hình môi trường.
  const send = async (event) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const { data: result } = await api.post("/admin/email/test", { recipient_email: recipient });
      if (!result.success) { setError("Gửi thử thất bại. Kiểm tra cấu hình và nhật ký email."); return; }
      setTest(false);
      setNotice(result.mode === "QUEUED" ? "Đã xếp hàng gửi thư. Kiểm tra nhật ký chuyển phát để xem kết quả." : result.mode === "REAL_SMTP" ? "Đã gửi email thử qua máy chủ SMTP." : "Đã lưu email thử ở chế độ xem trước. Chưa gửi đến hộp thư người nhận.");
      await cache.invalidateQueries({ queryKey: ["email-logs"] });
    } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };

  return (
    <div className="cf-stack">
      <PageHead eyebrow="THÔNG BÁO & GỬI THƯ" title="Email & cấu hình" description="Kiểm tra lịch sử chuyển phát và quản lý máy chủ gửi thư." actions={<><button className="cf-btn" onClick={() => logs.refetch()} disabled={logs.isFetching}><RefreshCw />Làm mới</button><button className="cf-btn cf-btn-primary" onClick={() => { setTest(true); setError(""); }}><Send />Gửi email thử</button></>} />
      {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
      {error && !test && <Alert onDismiss={() => setError("")}>{error}</Alert>}
      <div className="cf-tabs" role="tablist" aria-label="Quản lý email"><button role="tab" aria-selected={tab === "logs"} onClick={() => setTab("logs")}>Nhật ký gửi thư</button><button role="tab" aria-selected={tab === "settings"} onClick={() => setTab("settings")}>Cấu hình gửi thư</button></div>
      {tab === "logs" ? <Panel><EmailLogFilters search={search} type={type} status={status} types={EMAIL_TYPES} onSearchChange={(value) => filter(setSearch, value)} onTypeChange={(value) => filter(setType, value)} onStatusChange={(value) => filter(setStatus, value)} /><EmailLogTable query={logs} list={list} types={EMAIL_TYPES} page={page} onPageChange={setPage} onDetail={setDetail} /></Panel> : <SmtpSettingsForm query={settings} form={form} dirty={dirty} busy={busy} onUpdate={update} onSecurityChange={(value) => { setDirty(true); setForm({ ...form, smtp_ssl: value === "ssl", smtp_tls: value === "tls" }); }} onReset={() => { setDirty(false); setForm({ ...settings.data, smtp_password: "" }); }} onSubmit={save} />}
      <SmtpTestModal open={test} recipient={recipient} busy={busy} error={error} onRecipientChange={setRecipient} onDismissError={() => setError("")} onClose={() => setTest(false)} onSubmit={send} />
      <EmailDeliveryDetailModal detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
