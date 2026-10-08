import { Activity, ArrowRight, CheckCircle2, CircleAlert, Clock3, FileClock, LockKeyhole, ScanLine, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { decimal, number } from "../../../dung-chung/tien-ich/adminPresentation";

export default function OperationsCenter({ users, data }) {
  const { invoices, ocr_jobs: jobs } = data;
  const needsAttention = invoices.failed > 0;
  const rows = [
    { Icon: FileClock, tone: "slate", label: "Hàng đợi đầu vào", value: invoices.uploaded, noun: "hóa đơn chưa quét", note: "Chưa đồng nghĩa với lỗi; theo dõi tốc độ xử lý", status: "THEO DÕI", to: "/ocr-monitor", link: "Xem hàng đợi" },
    { Icon: ShieldCheck, tone: "teal", label: "Chờ người dùng", value: invoices.review_required, noun: "hóa đơn chờ xác nhận", note: "Người dùng kiểm tra kết quả OCR", status: "CHỜ PHẢN HỒI", to: "/ocr-monitor", link: "Xem trạng thái" },
    { Icon: LockKeyhole, tone: "violet", label: "Quyền truy cập", value: users.banned, noun: "tài khoản bị khóa", note: "Rà soát khi có yêu cầu hỗ trợ mở khóa", status: "THEO DÕI", to: "/users?status=banned", link: "Quản lý người dùng" },
  ];
  return <section className="adm-ops" aria-labelledby="adm-ops-title">
    <header className="adm-ops-head"><div><p className="adm-eyebrow">ƯU TIÊN HIỆN TẠI</p><h2 id="adm-ops-title">Trung tâm xử lý</h2><span>Sự cố cần can thiệp tách khỏi các trạng thái chỉ cần theo dõi.</span></div><span className={`adm-ops-count ${needsAttention ? "is-warning" : "is-healthy"}`}><Activity size={14} aria-hidden="true" />{number.format(invoices.failed)} hóa đơn cần admin</span></header>
    <div className="adm-ops-grid">
      <article className={`adm-ops-primary ${needsAttention ? "is-alert" : "is-clear"}`}><span className="adm-ops-primary-icon">{needsAttention ? <CircleAlert size={23} /> : <CheckCircle2 size={23} />}</span><div><p>{needsAttention ? "CẦN CAN THIỆP" : "TRẠNG THÁI HIỆN TẠI"}</p><strong>{number.format(invoices.failed)}</strong><h3>{needsAttention ? "Hóa đơn OCR cần kiểm tra" : "Không ghi nhận hóa đơn thất bại"}</h3><span>{needsAttention ? "Kiểm tra nguyên nhân và gửi lại tác vụ phù hợp." : "Hàng đợi và các yêu cầu chờ người dùng vẫn được theo dõi ở bên cạnh."}</span></div><Link to="/ocr-monitor">Mở giám sát hóa đơn <ArrowRight size={15} /></Link></article>
      <div className="adm-ops-queue">{rows.map(({ Icon, tone, label, value, noun, note, status, to, link }) => <article key={label}><span className={`adm-ops-item-icon is-${tone}`}><Icon size={18} /></span><div><p>{label}</p><strong>{number.format(value)} {noun}</strong><small>{note}</small><Link to={to}>{link} <ArrowRight size={13} /></Link></div><span className={`adm-ops-state is-${tone}`}>{status}</span></article>)}</div>
    </div>
    <footer className="adm-ops-health"><div><ScanLine size={16} /><span>Lịch sử OCR</span><strong>{number.format(jobs.failed)} / {number.format(jobs.total)} lượt lỗi</strong></div><div><Clock3 size={16} /><span>Thời gian xử lý TB</span><strong>{jobs.average_processing_ms == null ? "Chưa đo" : `${decimal.format(jobs.average_processing_ms / 1000)} giây`}</strong></div><div><Activity size={16} /><span>Đang xử lý</span><strong>{number.format(invoices.processing)} hóa đơn</strong></div></footer>
  </section>;
}
