/**
 * ============================================================================
 * TÊN FILE: SmtpModePanel.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Cấu hình Email & Nhật ký gửi
 * MỤC ĐÍCH CỤ THỂ:
 *   Bảng điều khiển trạng thái cấu hình máy chủ gửi thư SMTP: chế độ hoạt động
 *   (Mock / Production), host, port, mã hóa TLS, và nút gửi email thử nghiệm (Test Email).
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props config, onTestSend callback, trạng thái loading.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export SmtpModePanel component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Tuyệt đối không để lộ mật khẩu SMTP trong giao diện hoặc phản hồi API.
 * ============================================================================
 */
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { ErrorState, Loading } from "../../../dung-chung/UI-chung/design";

/**
 * Bảng hiển thị thông số kết nối SMTP và công cụ gửi thử nghiệm email.
 */
export default function SmtpModePanel({ query }) {
  if (query.isPending) return <section className="adm-card"><Loading /></section>;
  if (query.isError) return <section className="adm-card"><ErrorState retry={() => query.refetch()} /></section>;
  const data = query.data;
  return <aside className="adm-email-mode"><CheckCircle2 size={22} /><p className="adm-eyebrow">CHẾ ĐỘ ĐÃ LƯU</p><h2>{data.is_dual_mode ? "Lưu xem trước" : "Gửi qua SMTP"}</h2><p>{data.is_dual_mode ? "Thiếu thông tin xác thực SMTP: thư được lưu để kiểm tra, chưa gửi ra ngoài." : "Email được worker gửi qua máy chủ SMTP đã cấu hình. Theo dõi kết quả tại nhật ký chuyển phát."}</p><dl className="adm-rest-dl"><div><dt>Nguồn cấu hình</dt><dd>{data.source === "database" ? "Cơ sở dữ liệu" : "Môi trường máy chủ"}</dd></div><div><dt>Mật khẩu ứng dụng</dt><dd>{data.has_password ? "Đã lưu · không đọc lại" : "Chưa thiết lập"}</dd></div><div><dt>Kết nối</dt><dd>{data.smtp_ssl ? "SSL / TLS" : data.smtp_tls ? "STARTTLS" : "Không mã hóa"}</dd></div></dl><p className="cf-data-note"><ShieldCheck size={15} /> Gửi thử dùng cấu hình đã lưu, không dùng bản nháp. Gửi thành công không đồng nghĩa thư đã được đọc.</p></aside>;
}
