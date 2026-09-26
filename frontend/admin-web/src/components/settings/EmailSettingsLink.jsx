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
import { Panel } from "../design";

export default function EmailSettingsLink() {
  return <Panel title="Cấu hình gửi thư" description="Máy chủ email và nhật ký chuyển phát"><div className="cf-panel-body"><Link to="/email-logs?tab=settings" className="cf-btn cf-btn-primary">Mở cấu hình email →</Link></div></Panel>;
}
