import { Eye, Mail } from "lucide-react";
import Inspector from "../../../dung-chung/UI-chung/Inspector";
import { Alert } from "../../../dung-chung/UI-chung/design";
import { emailStatus } from "../xu-ly/emailStatus";
import { timestamp } from "../../../dung-chung/tien-ich/adminPresentation";

export default function EmailInspector({ detail, types, onClose }) {
  const status = emailStatus(detail?.status);
  return <Inspector selectedId={detail?.id} title={detail?.subject || "Chi tiết chuyển phát"} eyebrow="LẦN GỬI ĐANG XEM" className="adm-email-inspector" icon={Mail} onClose={onClose}>{detail && <>
    <span className={`cf-label cf-tone-${status.tone}`}>{status.label}</span>
    <dl className="adm-rest-dl"><div><dt>Người nhận</dt><dd>{detail.recipient}</dd></div><div><dt>Loại email</dt><dd>{types[detail.email_type] || detail.email_type}</dd></div><div><dt>Thời gian</dt><dd>{timestamp(detail.created_at)}</dd></div><div><dt>Mã bản ghi</dt><dd>{detail.id}</dd></div></dl>
    {detail.error_message && <Alert persistent>{detail.error_message}</Alert>}
    <div className="adm-rest-guidance"><Eye size={17} /><span>{detail.status === "LOGGED_DEV" ? "Chỉ lưu xem trước, chưa gửi đến hộp thư." : detail.status === "SENT" ? "Máy chủ đã chấp nhận gửi; không đồng nghĩa người nhận đã đọc." : "Kiểm tra chi tiết lỗi trước khi điều chỉnh SMTP."} Không hiển thị nội dung thư hoặc mật khẩu tạm thời.</span></div>
  </>}</Inspector>;
}
