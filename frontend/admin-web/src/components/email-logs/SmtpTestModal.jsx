/**
 * ============================================================================
 * TÊN FILE: SmtpTestModal.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Email & cấu hình
 * MỤC ĐÍCH CỤ THỂ:
 *   Thu thập địa chỉ nhận và kích hoạt kiểm thử cấu hình email hiện tại.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Recipient, trạng thái busy/error và callback do EmailLogs quản lý.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất modal gửi thử hoặc null khi đóng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không hiển thị secret SMTP; backend quyết định chế độ queued/real/preview.
 * ============================================================================
 */
import { Mail } from "lucide-react";
import { Alert, Field, Modal } from "../design";

export default function SmtpTestModal({ open, recipient, busy, error, onRecipientChange, onDismissError, onClose, onSubmit }) {
  if (!open) return null;
  return <Modal title="Gửi email thử" onClose={onClose} busy={busy}><form className="cf-form" onSubmit={onSubmit}>{error && <Alert onDismiss={onDismissError}>{error}</Alert>}<p className="cf-muted">Gửi một email kiểm tra bằng cấu hình hiện tại.</p><Field label="Email người nhận"><input className="cf-input" type="email" required value={recipient} onChange={(event) => onRecipientChange(event.target.value)} /></Field><div className="cf-form-actions"><button type="button" className="cf-btn" disabled={busy} onClick={onClose}>Hủy</button><button className="cf-btn cf-btn-primary" disabled={busy}><Mail />{busy ? "Đang gửi…" : "Gửi email thử"}</button></div></form></Modal>;
}
