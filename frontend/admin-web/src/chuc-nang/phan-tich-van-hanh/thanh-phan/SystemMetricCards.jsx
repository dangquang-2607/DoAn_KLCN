/**
 * ============================================================================
 * TÊN FILE: SystemMetricCards.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Phân tích & Vận hành hệ thống
 * MỤC ĐÍCH CỤ THỂ:
 *   Các thẻ số liệu đo lường hiệu năng hệ thống: tổng số tiền giao dịch xử lý,
 *   tỷ lệ thành công OCR, thời gian xử lý trung bình và số lượng lỗi phát sinh.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props metrics (tổng hợp các chỉ số vận hành).
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export SystemMetricCards component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Hiển thị chỉ số tăng/giảm phần trăm so sánh với chu kỳ trước đó.
 * ============================================================================
 */
import { ChartNoAxesCombined, UsersRound, TrendingUp } from "lucide-react";
import { decimal, number } from "../../../dung-chung/tien-ich/adminPresentation";

/**
 * Nhóm thẻ hiển thị chỉ số sức khỏe và hiệu năng vận hành hệ thống.
 */
export default function SystemMetricCards({ data }) {
  const cards = [
    ["lead", ChartNoAxesCombined, "Giao dịch trong kỳ", number.format(data.metrics.total), "bản ghi"],
    ["teal", UsersRound, "Người dùng có giao dịch", number.format(data.metrics.active_users), "User ID khác nhau"],
    ["violet", TrendingUp, "So với kỳ đối chiếu", data.comparison.change_pct == null ? "—" : `${data.comparison.change_pct > 0 ? "+" : ""}${decimal.format(data.comparison.change_pct)}%`, data.comparison.previous ? `${number.format(data.comparison.current)} / ${number.format(data.comparison.previous)} bản ghi` : "Kỳ trước = 0, không tính %"],
  ];
  return <section className="sa-demo__metrics" aria-label="Chỉ số phân tích">{cards.map(([tone, Icon, label, value, note]) => <article className={`sa-demo__metric sa-demo__metric--${tone}`} key={tone}><span className="sa-demo__metric-icon"><Icon size={21} /></span><div className="sa-demo__metric-bottom"><div><p>{label}</p><strong>{value}</strong></div><span>{note}</span></div></article>)}</section>;
}
