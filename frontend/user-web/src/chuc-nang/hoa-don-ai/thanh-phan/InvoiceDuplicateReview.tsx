import Link from "next/link";
import { money } from "@/dung-chung/tien-ich/finance";
import type { DuplicateCheck } from "../xu-ly/InvoiceTypes";

const reasons: Record<string, string> = {
  SAME_FILE: "Cùng nội dung tệp",
  SAME_IDENTITY: "Cùng định danh hóa đơn",
  IDENTITY_DATA_CONFLICT: "Cùng định danh nhưng ngày hoặc số tiền khác — cần sửa thông tin",
  SAME_MERCHANT_DATE_AMOUNT: "Cùng cửa hàng, ngày và số tiền",
  SAME_RECEIPT_NUMBER_ADDRESS_DATE_AMOUNT: "Cùng số phiếu, địa chỉ, ngày và số tiền",
};
export default function InvoiceDuplicateReview({ check, busy, accepted, onAccept, onOpen, onSame }: {
  check: DuplicateCheck; busy: boolean; accepted: boolean;
  onAccept: (value: boolean) => void; onOpen: (id: string) => void; onSame: (id: string) => void;
}) {
  if (check.level === "NONE") return <p role="status" className="cf-muted">Chưa thấy hóa đơn trùng với thông tin hiện tại.</p>;
  return <section className="cf-duplicate-review" aria-label="Đối chiếu hóa đơn">
    <strong>{check.level === "EXACT" ? "Hóa đơn trùng — không thể ghi thêm khoản chi" : "Có hóa đơn tương đồng — cần đối chiếu"}</strong>
    <p>Kiểm tra bản cũ trước khi quyết định. {check.candidate_count > check.candidates.length && `Hiển thị ${check.candidates.length}/${check.candidate_count} hóa đơn.`}</p>
    {check.candidates.map(c => <article key={c.invoice_id} className="cf-duplicate-candidate">
      <strong>{c.merchant_name || "Hóa đơn"}</strong>
      <p>{c.invoice_date || "Chưa rõ ngày"} · {money(c.total_amount || 0, c.currency)} · {c.transaction_id ? "Đã ghi sổ" : "Bản nháp"}{c.deleted_at ? " · Đã ẩn" : ""}</p>
      <p>{reasons[c.reason] || "Thông tin hóa đơn tương đồng"}</p>
      <div className="cf-row" style={{ flexWrap: "wrap" }}>
        <button type="button" className="cf-btn cf-btn-sm" disabled={busy} onClick={() => onOpen(c.invoice_id)}>Mở bản cũ</button>
        {c.transaction_id && <Link className="cf-inline-link" href={`/transactions?invoice_id=${c.invoice_id}`}>Xem khoản chi</Link>}
        {check.level === "SUSPECTED" && <button type="button" className="cf-btn cf-btn-sm" disabled={busy} onClick={() => onSame(c.invoice_id)}>Đây là cùng hóa đơn</button>}
      </div>
    </article>)}
    {check.level === "SUSPECTED" && check.can_override && <label className="cf-row">
      <input type="checkbox" checked={accepted} disabled={busy} onChange={e => onAccept(e.target.checked)} />
      Tôi đã đối chiếu, đây là khoản chi khác
    </label>}
    <p className="cf-muted">Bạn có thể kiểm tra sau; chưa có khoản chi mới được tạo ở bước này.</p>
  </section>;
}
