/**
 * ============================================================================
 * TÊN FILE: SmtpSettingsForm.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Email & cấu hình
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị và chỉnh sửa cấu hình máy chủ gửi thư.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Query settings, bản nháp form và callback do EmailLogs sở hữu.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất form SMTP; submit được chuyển lên page để gọi API.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Mật khẩu để trống nghĩa là giữ secret hiện tại; UI không đọc lại secret đã lưu.
 * ============================================================================
 */
import { Alert, ErrorState, Field, Loading } from "../../../dung-chung/UI-chung/design";
import { ServerCog } from "lucide-react";

export default function SmtpSettingsForm({ query, form, dirty, busy, onUpdate, onSecurityChange, onReset, onSubmit }) {
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState retry={() => query.refetch()} />;
  if (!form) return null;
  return (
    <section className="adm-card adm-email-config">
      <div className="adm-card-head"><div><p className="adm-eyebrow">CẤU HÌNH CHUYỂN PHÁT</p><h2>Máy chủ gửi thư</h2><p>{query.data.is_dual_mode ? "Chế độ xem trước: thư được lưu cục bộ, chưa gửi ra ngoài." : "Đang sử dụng SMTP để gửi thư."}</p></div><ServerCog size={21} /></div>
      <form className="cf-form" onSubmit={onSubmit}>
        <div style={{ padding: "0 24px" }}>
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
      </form>
    </section>
  );
}
