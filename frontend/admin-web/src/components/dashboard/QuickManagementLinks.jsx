/**
 * ============================================================================
 * TÊN FILE: QuickManagementLinks.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Bảng điều khiển
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp ba lối tắt tới các khu vực quản trị thường dùng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   React Router, icon Lucide và Panel dùng chung.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất nhóm liên kết điều hướng không giữ state nghiệp vụ.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Quyền truy cập vẫn do ProtectedRoute và backend kiểm soát.
 * ============================================================================
 */
import { ArrowRight, ScanLine, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Panel } from "../design";

const LINKS = [["/users", "Quản lý người dùng", "Kiểm tra tài khoản và điều chỉnh quyền truy cập.", Users], ["/ocr-monitor", "Giám sát xử lý hóa đơn", "Theo dõi trạng thái và xem các lần xử lý lỗi.", ScanLine], ["/email-logs", "Email & thông báo", "Xem lịch sử gửi thư và cấu hình máy chủ.", ShieldCheck]];

export default function QuickManagementLinks() {
  return <div className="cf-grid">{LINKS.map(([href, title, description, Icon]) => <Panel key={href}><div className="cf-panel-body cf-stack" style={{ gap: 14 }}><span className="cf-icon"><Icon /></span><h2>{title}</h2><p className="cf-muted" style={{ fontSize: 14, margin: 0 }}>{description}</p><Link className="cf-inline-link" to={href}>Mở quản lý <ArrowRight size={14} style={{ display: "inline" }} /></Link></div></Panel>)}</div>;
}
