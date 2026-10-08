/**
 * ============================================================================
 * TÊN FILE: EmailSettingsLink.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Cài đặt & bảo mật
 * MỤC ĐÍCH CỤ THỂ:
 *   Điều hướng quản trị viên đến tab cấu hình máy chủ email.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React Router và Panel dùng chung.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất khối liên kết cấu hình email.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự đọc hoặc ghi thông tin SMTP tại màn hình Settings.
 * ============================================================================
 */
import { Link } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";

export default function EmailSettingsLink() {
  return <section className="adm-settings-link-card"><Mail size={20} aria-hidden="true" /><div><strong>Email & cấu hình</strong><p>Quản lý máy chủ gửi thư và lịch sử chuyển phát tại một nơi.</p><Link to="/email-logs?tab=settings">Mở cấu hình email <ArrowRight size={15} aria-hidden="true" /></Link></div></section>;
}
