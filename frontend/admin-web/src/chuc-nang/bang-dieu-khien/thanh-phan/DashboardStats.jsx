import { ArrowUpRight, CircleAlert, FileScan, UsersRound } from "lucide-react";
import { number } from "../../../dung-chung/tien-ich/adminPresentation";

export default function DashboardStats({ data, monitor }) {
  const { users } = data;
  const invoices = monitor?.invoices;
  const cards = [
    ["teal", ArrowUpRight, "Giao dịch tháng này", data.transactions_this_month, "Từ đầu tháng đến hôm nay · theo ngày giao dịch"],
    ["violet", FileScan, "Chờ đưa vào OCR", invoices?.uploaded, "Hóa đơn chưa quét · cần theo dõi"],
    ["amber", CircleAlert, "Hóa đơn OCR lỗi", invoices?.failed, "Trạng thái hóa đơn · không phải số lượt OCR lỗi"],
  ];
  return <div><div className="adm-kpi-heading"><p className="adm-eyebrow">CHỈ SỐ NHANH</p><span>Tài khoản, giao dịch và khối lượng hóa đơn tại thời điểm xem.</span></div><section className="adm-dashboard-kpis" aria-label="Chỉ số tổng quan">
    <article className="adm-feature-kpi"><div className="adm-feature-kpi-top"><span className="adm-feature-icon"><UsersRound size={21} /></span><span>TRẠNG THÁI HIỆN TẠI</span></div><div><p>Tài khoản sẵn sàng</p><strong>{number.format(users.active)}</strong></div><div className="adm-feature-health"><div className="adm-feature-health-track" aria-hidden="true"><span style={{ width: `${users.total ? users.active / users.total * 100 : 0}%` }} /></div><span><b>{number.format(users.active)}/{number.format(users.total)} có thể truy cập</b> · {number.format(users.banned)} bị khóa</span></div></article>
    {cards.map(([tone, Icon, label, value, note]) => <article key={label} className={`adm-small-kpi adm-small-kpi--${tone}`}><span className="adm-small-kpi-icon"><Icon size={21} /></span><div><p>{label}</p><strong>{value == null ? "—" : number.format(value)}</strong><span>{note}</span></div></article>)}
  </section></div>;
}
