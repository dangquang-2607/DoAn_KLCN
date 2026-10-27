/**
 * ============================================================================
 * TÊN FILE: DashboardStats.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Bảng điều khiển quản trị (Dashboard)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị các khối thẻ chỉ số nhanh (KPI): trạng thái tài khoản người dùng,
 *   số lượng giao dịch trong tháng, hàng đợi hóa đơn chờ OCR và hóa đơn lỗi.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props data (thống kê hệ thống) và monitor (thống kê giám sát OCR).
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export DashboardStats component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Hiển thị dữ liệu tổng hợp thời gian thực; xử lý an toàn khi giá trị null/undefined.
 * ============================================================================
 */
import { ArrowUpRight, CircleAlert, FileScan, UsersRound } from "lucide-react";
import { number } from "../../../dung-chung/tien-ich/adminPresentation";

/**
 * Component thẻ chỉ số KPI tổng quan trạng thái vận hành hệ thống.
 */
export default function DashboardStats({ data, monitor }) {
  const users = data?.users || {};
  const activeUsers = users.active || 0;
  const totalUsers = users.total || 0;
  const bannedUsers = users.banned || 0;
  const invoices = monitor?.invoices;
  const cards = [
    ["teal", ArrowUpRight, "Giao dịch tháng này", data?.transactions_this_month, "Từ đầu tháng đến hôm nay · theo ngày giao dịch"],
    ["violet", FileScan, "Chờ đưa vào OCR", invoices?.uploaded, "Hóa đơn chưa quét · cần theo dõi"],
    ["amber", CircleAlert, "Hóa đơn OCR lỗi", invoices?.failed, "Trạng thái hóa đơn · không phải số lượt OCR lỗi"],
  ];
  return <div><div className="adm-kpi-heading"><p className="adm-eyebrow">CHỈ SỐ NHANH</p><span>Tài khoản, giao dịch và khối lượng hóa đơn tại thời điểm xem.</span></div><section className="adm-dashboard-kpis" aria-label="Chỉ số tổng quan">
    <article className="adm-feature-kpi"><div className="adm-feature-kpi-top"><span className="adm-feature-icon"><UsersRound size={21} /></span><span>TRẠNG THÁI HIỆN TẠI</span></div><div><p>Tài khoản sẵn sàng</p><strong>{number.format(activeUsers)}</strong></div><div className="adm-feature-health"><div className="adm-feature-health-track" aria-hidden="true"><span style={{ width: `${totalUsers ? activeUsers / totalUsers * 100 : 0}%` }} /></div><span><b>{number.format(activeUsers)}/{number.format(totalUsers)} có thể truy cập</b> · {number.format(bannedUsers)} bị khóa</span></div></article>
    {cards.map(([tone, Icon, label, value, note]) => <article key={label} className={`adm-small-kpi adm-small-kpi--${tone}`}><span className="adm-small-kpi-icon"><Icon size={21} /></span><div><p>{label}</p><strong>{value == null ? "—" : number.format(value)}</strong><span>{note}</span></div></article>)}
  </section></div>;
}
