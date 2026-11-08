import { Alert, ErrorState, Field, Loading } from "../../../dung-chung/UI-chung/ui";
import { ServerCog, CheckCircle2, ShieldCheck } from "lucide-react";
import density from "../../../dung-chung/CSS/operations.module.css";

export function SmtpSettingsForm({ query, form, dirty, busy, onUpdate, onSecurityChange, onReset, onSubmit }) {
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState retry={() => query.refetch()} />;
  if (!form) return null;
  return (
    <section className="adm-card adm-email-config">
      <div className="adm-card-head"><div><p className="adm-eyebrow">CẤU HÌNH CHUYỂN PHÁT</p><h2>Máy chủ gửi thư</h2><p>{query.data.is_dual_mode ? "Chưa có SMTP: chỉ email thử được lưu để xem trước trong nhật ký. Thư nghiệp vụ chưa thể gửi." : "Đang sử dụng SMTP để gửi thư."}</p></div><ServerCog size={21} /></div>
      <form className="cf-form" onSubmit={onSubmit} aria-busy={busy}>
        <fieldset className={density.fieldset} disabled={busy}>
        <div className={density.smtpNotice}>
        <Alert kind="info">Cấu hình được lưu trong hệ thống. Để trống mật khẩu ứng dụng để giữ mật khẩu đang dùng.</Alert>
        </div>
        <div className="adm-email-config-grid">
          <Field label="Máy chủ SMTP"><input className="cf-input" required value={form.smtp_host} onChange={(event) => onUpdate("smtp_host", event.target.value)} /></Field>
          <Field label="Cổng"><input className="cf-input" type="number" min="1" max="65535" required value={form.smtp_port} onChange={(event) => onUpdate("smtp_port", event.target.value)} /></Field>
          <Field label="Tài khoản gửi thư"><input className="cf-input" value={form.smtp_user} onChange={(event) => onUpdate("smtp_user", event.target.value)} /></Field>
          <Field label="Mật khẩu ứng dụng" hint={query.data.has_password ? "Đã có mật khẩu. Để trống để giữ nguyên." : "Chưa có mật khẩu gửi thư."}><input className="cf-input" type="password" autoComplete="new-password" value={form.smtp_password} onChange={(event) => onUpdate("smtp_password", event.target.value)} /></Field>
          <Field label="Địa chỉ người gửi"><input className="cf-input" required type="email" value={form.emails_from_email} onChange={(event) => onUpdate("emails_from_email", event.target.value)} /></Field>
          <Field label="Tên người gửi"><input className="cf-input" required value={form.emails_from_name} onChange={(event) => onUpdate("emails_from_name", event.target.value)} /></Field>
        </div>
        <div className="adm-email-security"><Field label="Bảo mật kết nối"><select className="cf-input" value={form.smtp_ssl ? "ssl" : form.smtp_tls ? "tls" : "none"} onChange={(event) => onSecurityChange(event.target.value)}><option value="tls">STARTTLS</option><option value="ssl">SSL / TLS</option><option value="none">Không mã hóa</option></select></Field><small>Mật khẩu để trống khi lưu nghĩa là giữ secret hiện tại.</small></div>
        <div className="adm-email-config-foot"><button type="button" onClick={onReset} disabled={!dirty || busy}>Bỏ thay đổi</button><button disabled={busy || !dirty}>{busy ? "Đang lưu…" : "Lưu cấu hình"}</button></div>
        </fieldset>
      </form>
    </section>
  );
}

/**
 * Bảng hiển thị thông số kết nối SMTP và công cụ gửi thử nghiệm email.
 */
export function SmtpModePanel({ query }) {
  if (query.isPending) return <section className="adm-card"><Loading /></section>;
  if (query.isError) return <section className="adm-card"><ErrorState retry={() => query.refetch()} /></section>;
  const data = query.data;
  return <aside className="adm-email-mode"><CheckCircle2 size={22} /><p className="adm-eyebrow">CHẾ ĐỘ ĐÃ LƯU</p><h2>{data.is_dual_mode ? "Lưu xem trước" : "Gửi qua SMTP"}</h2><p>{data.is_dual_mode ? "Thiếu thông tin xác thực SMTP: thư được lưu để kiểm tra, chưa gửi ra ngoài." : "Email được worker gửi qua máy chủ SMTP đã cấu hình. Theo dõi kết quả tại nhật ký chuyển phát."}</p><dl className="adm-rest-dl"><div><dt>Nguồn cấu hình</dt><dd>{data.source === "database" ? "Cơ sở dữ liệu" : "Môi trường máy chủ"}</dd></div><div><dt>Mật khẩu ứng dụng</dt><dd>{data.has_password ? "Đã lưu · không đọc lại" : "Chưa thiết lập"}</dd></div><div><dt>Kết nối</dt><dd>{data.smtp_ssl ? "SSL / TLS" : data.smtp_tls ? "STARTTLS" : "Không mã hóa"}</dd></div></dl><p className="cf-data-note"><ShieldCheck size={15} /> Gửi thử dùng cấu hình đã lưu, không dùng bản nháp. Gửi thành công không đồng nghĩa thư đã được đọc.</p></aside>;
}
