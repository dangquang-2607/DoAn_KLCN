import { ChartNoAxesCombined, UsersRound, TrendingUp, ChartPie } from "lucide-react";
import { decimal, number } from "../../../dung-chung/tien-ich/format";
import { Empty } from "../../../dung-chung/UI-chung/ui";

/**
 * Nhóm thẻ hiển thị chỉ số sức khỏe và hiệu năng vận hành hệ thống.
 */
export function SystemMetricCards({ data }) {
  const cards = [
    ["lead", ChartNoAxesCombined, "Giao dịch trong kỳ", number.format(data.metrics.total), "bản ghi"],
    ["teal", UsersRound, "Người dùng có giao dịch", number.format(data.metrics.active_users), "User ID khác nhau"],
    ["violet", TrendingUp, "So với kỳ đối chiếu", data.comparison.change_pct == null ? "—" : `${data.comparison.change_pct > 0 ? "+" : ""}${decimal.format(data.comparison.change_pct)}%`, data.comparison.previous ? `${number.format(data.comparison.current)} / ${number.format(data.comparison.previous)} bản ghi` : "Kỳ trước = 0, không tính %"],
  ];
  return <section className="adm-analytics__metrics" aria-label="Chỉ số phân tích">{cards.map(([tone, Icon, label, value, note]) => <article className={`adm-analytics__metric adm-analytics__metric--${tone}`} key={tone}><span className="adm-analytics__metric-icon"><Icon size={21} /></span><div className="adm-analytics__metric-bottom"><div><p>{label}</p><strong>{value}</strong></div><span>{note}</span></div></article>)}</section>;
}

const colors = ["coral", "amber", "teal", "violet", "slate"];
/**
 * Biểu đồ xếp hạng các danh mục thu chi chiếm tỷ trọng lớn nhất.
 */
export function TopCategoriesChart({ data = [], total = 0, context }) {
  const items = Array.isArray(data) ? data : [];
  const max = Math.max(1, ...items.map((item) => item.transaction_count || 0));
  const remainder = Math.max(0, total - items.reduce((sum, item) => sum + (item.transaction_count || 0), 0));
  return <section className="adm-analytics__panel"><div className="adm-analytics__panel-heading"><div><p className="adm-analytics__section-label">01 / DANH MỤC</p><h2>Danh mục được sử dụng nhiều</h2><p>5 danh mục theo số bản ghi trong kỳ</p></div><span className="adm-analytics__panel-context">{context}</span></div>
    {!data.length ? <Empty title="Chưa có dữ liệu danh mục" /> : <ol className="adm-analytics__category-list">{data.map((item, index) => <li className="adm-analytics__category" key={item.name}><span className="adm-analytics__rank">{String(index + 1).padStart(2, "0")}</span><div className="adm-analytics__category-main"><div className="adm-analytics__category-meta"><span>{item.name}</span><strong>{number.format(item.transaction_count)}</strong></div><div className="adm-analytics__bar-track" aria-hidden="true"><span className={`adm-analytics__bar adm-analytics__bar--${colors[index]}`} style={{ width: `${item.transaction_count / max * 100}%` }} /></div></div></li>)}</ol>}
    <p className="adm-analytics__panel-footnote">{number.format(remainder)} bản ghi nằm ngoài 5 nhóm này. Xếp hạng theo tần suất sử dụng, không theo số tiền.</p>
  </section>;
}

/**
 * Khung widget hiển thị cơ cấu nguồn gốc và chủng loại giao dịch.
 */
export function TransactionCompositionWidget({ transactions = {} }) {
  const total = transactions.total || 0;
  const rows = [
    ["Chi tiêu", transactions.expense_count || 0, "coral"],
    ["Thu nhập", transactions.income_count || 0, "teal"],
    [
      "Nạp/rút, chuyển tiền, điều chỉnh",
      transactions.other_count || 0,
      "violet",
    ],
  ];
  let offset = 0;
  const stops = rows.map(([, value, tone]) => {
    const start = offset;
    offset += total ? (value / total) * 100 : 0;
    return `var(--sa-${tone}) ${start}% ${offset}%`;
  });
  return (
    <section className="adm-analytics__panel">
      <div className="adm-analytics__panel-heading">
        <div>
          <p className="adm-analytics__section-label">02 / CƠ CẤU</p>
          <h2>Giao dịch theo loại</h2>
          <p>Số lượng và tỷ trọng trong kỳ đã chọn</p>
        </div>
        <ChartPie className="adm-analytics__corner-icon" size={22} />
      </div>
      <div className="adm-analytics__donut-wrap">
        <div
          className="adm-analytics__donut"
          role="img"
          aria-label={rows
            .map(([label, value]) => `${label}: ${value}`)
            .join("; ")}
          style={{
            background: transactions.total
              ? `conic-gradient(from -90deg,${stops.join(",")})`
              : "#e7e9ed",
          }}
        >
          <div className="adm-analytics__donut-hole">
            <strong>{number.format(transactions.total)}</strong>
            <span>bản ghi</span>
          </div>
        </div>
      </div>
      <ul className="adm-analytics__type-list">
        {rows.map(([label, value, tone]) => (
          <li key={label}>
            <i className={`adm-analytics__legend-dot adm-analytics__legend-dot--${tone}`} />
            <span>{label}</span>
            <strong>{number.format(value)}</strong>
            <span className="adm-analytics__type-share">
              {decimal.format(
                transactions.total ? (value / transactions.total) * 100 : 0,
              )}
              %
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
