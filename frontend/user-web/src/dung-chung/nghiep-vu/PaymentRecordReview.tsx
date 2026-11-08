"use client";
import { useQuery } from "@tanstack/react-query";
import api from "@/dung-chung/connect-api/api";
import { money } from "@/dung-chung/tien-ich/finance";
import { Alert } from "@/dung-chung/UI-chung/ui";

type Payment = { wallet_entry_id: string; transaction_id: string; merchant_name: string | null; bill_reference: string | null; paid_amount: string; recorded_amount: string; include_in_reports: boolean; invoice_id: string | null; created_at: string };

export default function PaymentRecordReview({ amount, paidOn, selected, separate, invoice = false, busy, onSelect, onSeparate }: {
  amount: string; paidOn: string; selected: string; separate: boolean; invoice?: boolean; busy: boolean;
  onSelect: (id: string) => void; onSeparate: (value: boolean) => void;
}) {
  const query = useQuery<Payment[]>({
    queryKey: ["payment-candidates", amount, paidOn],
    queryFn: async () => (await api.get("/bookkeeping/payments", { params: { amount, paid_on: paidOn } })).data,
    enabled: Number(amount) > 0 && !!paidOn,
    staleTime: 0,
  });
  return <section className="cf-stack" aria-label="Đối chiếu thanh toán ví">
    <strong>Đối chiếu khoản thanh toán đã có</strong>
    <p className="cf-muted">Chọn khoản cùng ngày và số tiền để dùng lại khoản chi của ví. Thông tin thanh toán và lựa chọn tính vào báo cáo được giữ nguyên.</p>
    {query.isPending ? <p role="status">Đang tìm khoản thanh toán…</p> : query.isError ? <Alert>Không tải được khoản thanh toán. <button type="button" disabled={busy} onClick={() => query.refetch()}>Thử lại</button></Alert> : !query.data?.length ? <p>Không còn khoản thanh toán khớp. Hãy kiểm tra lại ngày và số tiền.</p> : query.data.map(payment => <div key={payment.wallet_entry_id} className="cf-stack">
      <span><strong>{payment.merchant_name || "Thanh toán ví"}</strong> · {money(payment.paid_amount, "VND")}</span>
      <small>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(payment.created_at))} · Mã tham chiếu: {payment.bill_reference || "—"} · {payment.include_in_reports ? "Có tính vào thu chi" : "Không tính vào thu chi"}</small>
      <small>Mã giao dịch: {payment.transaction_id}</small>
      {payment.invoice_id && <a className="cf-inline-link" href={`/transactions?invoice_id=${payment.invoice_id}`}>Xem khoản đã gắn hóa đơn</a>}
      <button type="button" className="cf-btn cf-btn-sm" disabled={busy || (invoice && !!payment.invoice_id)} aria-pressed={selected === payment.wallet_entry_id} onClick={() => { onSelect(payment.wallet_entry_id); onSeparate(false); }}>
        {selected === payment.wallet_entry_id ? "Đã chọn khoản thanh toán" : invoice && payment.invoice_id ? "Đã gắn hóa đơn khác" : "Liên kết khoản thanh toán này"}
      </button>
    </div>)}
    {selected && <button type="button" className="cf-btn cf-btn-ghost cf-btn-sm" disabled={busy} onClick={() => onSelect("")}>Bỏ lựa chọn liên kết</button>}
    <label><input type="checkbox" disabled={busy} checked={separate} onChange={e => { onSeparate(e.target.checked); if (e.target.checked) onSelect(""); }} /> Tôi đã đối chiếu và xác nhận đây là khoản khác với khoản thanh toán ví.</label>
  </section>;
}
