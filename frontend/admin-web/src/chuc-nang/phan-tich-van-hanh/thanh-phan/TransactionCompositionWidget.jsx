/**
 * ============================================================================
 * TÊN FILE: TransactionCompositionWidget.jsx
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Phân tích & Vận hành hệ thống
 * MỤC ĐÍCH CỤ THỂ:
 *   Widget phân tích cơ cấu giao dịch: tỷ trọng giữa thu nhập và chi phí,
 *   tỷ lệ giao dịch tự nhập thủ công so với giao dịch quét từ hóa đơn AI.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props compositionData, định dạng số tiền number.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export TransactionCompositionWidget component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Hỗ trợ theo dõi mức độ áp dụng tính năng OCR của người dùng hệ thống.
 * ============================================================================
 */
import { ChartPie } from "lucide-react";
import { decimal, number } from "../../../dung-chung/tien-ich/adminPresentation";

/**
 * Khung widget hiển thị cơ cấu nguồn gốc và chủng loại giao dịch.
 */
export default function TransactionCompositionWidget({ transactions = {} }) {
  const total = transactions.total || 0;
  const rows = [
    ["Chi tiêu", transactions.expense_count || 0, "coral"],
    ["Thu nhập", transactions.income_count || 0, "teal"],
    ["Chuyển tiền / điều chỉnh", transactions.other_count || 0, "violet"],
  ];
  let offset = 0;
  const stops = rows.map(([, value, tone]) => { const start = offset; offset += total ? value / total * 100 : 0; return `var(--sa-${tone}) ${start}% ${offset}%`; });
  return <section className="sa-demo__panel"><div className="sa-demo__panel-heading"><div><p className="sa-demo__section-label">02 / CƠ CẤU</p><h2>Giao dịch theo loại</h2><p>Số lượng và tỷ trọng trong kỳ đã chọn</p></div><ChartPie className="sa-demo__corner-icon" size={22} /></div>
    <div className="sa-demo__donut-wrap"><div className="sa-demo__donut" role="img" aria-label={rows.map(([label, value]) => `${label}: ${value}`).join("; ")} style={{ background: transactions.total ? `conic-gradient(from -90deg,${stops.join(",")})` : "#e7e9ed" }}><div className="sa-demo__donut-hole"><strong>{number.format(transactions.total)}</strong><span>bản ghi</span></div></div></div>
    <ul className="sa-demo__type-list">{rows.map(([label, value, tone]) => <li key={label}><i className={`sa-demo__legend-dot sa-demo__legend-dot--${tone}`} /><span>{label}</span><strong>{number.format(value)}</strong><span className="sa-demo__type-share">{decimal.format(transactions.total ? value / transactions.total * 100 : 0)}%</span></li>)}</ul><p className="sa-demo__panel-footnote">Các nhóm loại trừ nhau và cùng phạm vi thời gian. Chuyển tiền gồm hai bản ghi đối ứng, không phản ánh doanh thu.</p>
  </section>;
}
