import { Empty } from "../../../dung-chung/UI-chung/design";
import { number } from "../../../dung-chung/tien-ich/adminPresentation";

const colors = ["coral", "amber", "teal", "violet", "slate"];
export default function TopCategoriesChart({ data, total, context }) {
  const max = Math.max(1, ...data.map((item) => item.transaction_count));
  const remainder = Math.max(0, total - data.reduce((sum, item) => sum + item.transaction_count, 0));
  return <section className="sa-demo__panel"><div className="sa-demo__panel-heading"><div><p className="sa-demo__section-label">01 / DANH MỤC</p><h2>Danh mục được sử dụng nhiều</h2><p>5 danh mục theo số bản ghi trong kỳ</p></div><span className="sa-demo__panel-context">{context}</span></div>
    {!data.length ? <Empty title="Chưa có dữ liệu danh mục" /> : <ol className="sa-demo__category-list">{data.map((item, index) => <li className="sa-demo__category" key={item.name}><span className="sa-demo__rank">{String(index + 1).padStart(2, "0")}</span><div className="sa-demo__category-main"><div className="sa-demo__category-meta"><span>{item.name}</span><strong>{number.format(item.transaction_count)}</strong></div><div className="sa-demo__bar-track" aria-hidden="true"><span className={`sa-demo__bar sa-demo__bar--${colors[index]}`} style={{ width: `${item.transaction_count / max * 100}%` }} /></div></div></li>)}</ol>}
    <p className="sa-demo__panel-footnote">{number.format(remainder)} bản ghi nằm ngoài 5 nhóm này. Xếp hạng theo tần suất sử dụng, không theo số tiền.</p>
  </section>;
}
