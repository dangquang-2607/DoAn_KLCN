import { ChartPie } from "lucide-react";
import { decimal, number } from "../../../dung-chung/tien-ich/adminPresentation";

export default function TransactionCompositionWidget({ transactions }) {
  const rows = [["Chi tiêu", transactions.expense_count, "coral"], ["Thu nhập", transactions.income_count, "teal"], ["Chuyển tiền / điều chỉnh", transactions.other_count, "violet"]];
  let offset = 0;
  const stops = rows.map(([, value, tone]) => { const start = offset; offset += transactions.total ? value / transactions.total * 100 : 0; return `var(--sa-${tone}) ${start}% ${offset}%`; });
  return <section className="sa-demo__panel"><div className="sa-demo__panel-heading"><div><p className="sa-demo__section-label">02 / CƠ CẤU</p><h2>Giao dịch theo loại</h2><p>Số lượng và tỷ trọng trong kỳ đã chọn</p></div><ChartPie className="sa-demo__corner-icon" size={22} /></div>
    <div className="sa-demo__donut-wrap"><div className="sa-demo__donut" role="img" aria-label={rows.map(([label, value]) => `${label}: ${value}`).join("; ")} style={{ background: transactions.total ? `conic-gradient(from -90deg,${stops.join(",")})` : "#e7e9ed" }}><div className="sa-demo__donut-hole"><strong>{number.format(transactions.total)}</strong><span>bản ghi</span></div></div></div>
    <ul className="sa-demo__type-list">{rows.map(([label, value, tone]) => <li key={label}><i className={`sa-demo__legend-dot sa-demo__legend-dot--${tone}`} /><span>{label}</span><strong>{number.format(value)}</strong><span className="sa-demo__type-share">{decimal.format(transactions.total ? value / transactions.total * 100 : 0)}%</span></li>)}</ul><p className="sa-demo__panel-footnote">Các nhóm loại trừ nhau và cùng phạm vi thời gian. Chuyển tiền gồm hai bản ghi đối ứng, không phản ánh doanh thu.</p>
  </section>;
}
