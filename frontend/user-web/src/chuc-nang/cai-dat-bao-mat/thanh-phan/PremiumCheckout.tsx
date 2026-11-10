"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeft, ArrowUpRight, CheckCircle2, CircleAlert, Clock3, Copy, Download, Info, Landmark, LoaderCircle, RefreshCw, TimerOff } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, Loading, PageHead, Panel } from "@/dung-chung/UI-chung/ui";
import { errorMessage, money } from "@/dung-chung/tien-ich/finance";
import { newRequestId } from "@/dung-chung/tien-ich/browserCrypto";
import { checkoutPath, dateTime, validPaymentId, type PaymentOrder } from "../xu-ly/subscription";
import styles from "../CSS/checkout.module.css";

type Snapshot = { order: PaymentOrder; verificationError: string | null };

export default function PremiumCheckout() {
  const params = useSearchParams();
  const router = useRouter();
  const cache = useQueryClient();
  const id = validPaymentId(params.get("payment_order"));
  const [clock, setClock] = useState(() => Date.now());
  const [notice, setNotice] = useState("");
  const requestId = useRef<string | null>(null);
  const payment = useQuery<Snapshot>({
    queryKey: ["premium-checkout", id], enabled: Boolean(id), retry: false, staleTime: 0,
    queryFn: async () => {
      try {
        return { order: (await api.post<PaymentOrder>(`/billing/orders/${id}/refresh`)).data, verificationError: null };
      } catch (error) {
        // A temporary provider outage must not discard a still-valid saved QR.
        const stored = (await api.get<PaymentOrder>(`/billing/orders/${id}`)).data;
        return { order: stored, verificationError: errorMessage(error) };
      }
    },
    refetchInterval: query => {
      const current = query.state.data?.order;
      if (!current || !["CREATING", "PENDING"].includes(current.status)) return false;
      return Date.now() > Date.parse(current.expires_at) ? 30_000 : 10_000;
    },
    refetchIntervalInBackground: false,
  });
  const order = payment.data?.order;
  useEffect(() => {
    if (!id) return;
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [id]);
  useEffect(() => {
    if (order?.status !== "PAID") return;
    requestId.current = null;
    void cache.invalidateQueries({ queryKey: ["subscription"] });
    void cache.invalidateQueries({ queryKey: ["payment-orders"] });
  }, [order?.id, order?.status, cache]);

  const create = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("Chưa tải được thông tin thanh toán.");
      // Reconcile before replacing an expired order: it may have just been paid.
      const checked = order.status === "CREATING"
        ? (await api.post<PaymentOrder>("/billing/checkout", { request_id: order.id })).data
        : (await api.post<PaymentOrder>(`/billing/orders/${order.id}/refresh`)).data;
      if (["PAID", "REVIEW", "CREATING"].includes(checked.status)) return checked;
      const providerNow = checked.server_time ? Date.parse(checked.server_time) : Date.now();
      if (checked.status === "PENDING" && Date.parse(checked.expires_at) > providerNow) return checked;
      requestId.current ??= newRequestId();
      return (await api.post<PaymentOrder>("/billing/checkout", { request_id: requestId.current })).data;
    },
    onSuccess: item => {
      setNotice("");
      cache.setQueryData<Snapshot>(["premium-checkout", item.id], { order: item, verificationError: null });
      void cache.invalidateQueries({ queryKey: ["payment-orders"] });
      if (["PAID", "REVIEW", "CANCELLED", "EXPIRED"].includes(item.status)) requestId.current = null;
      if (item.id !== id) router.replace(checkoutPath(item.id));
    },
  });

  const copy = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); setNotice(`Đã sao chép ${label}.`); }
    catch { setNotice("Không sao chép tự động được. Bạn có thể chọn và sao chép thông tin đang hiển thị."); }
  };
  const check = async () => {
    setNotice("");
    const result = await payment.refetch();
    if (result.data?.order.status === "PENDING" && !result.data.verificationError) {
      setNotice("Chưa ghi nhận thanh toán. Hệ thống sẽ tiếp tục kiểm tra.");
    }
  };
  const serverStamp = order?.server_time ? Date.parse(order.server_time) : NaN;
  const offset = Number.isFinite(serverStamp) ? serverStamp - payment.dataUpdatedAt : 0;
  const expiry = order ? Date.parse(order.expires_at) : NaN;
  const remaining = Number.isFinite(expiry) ? Math.max(0, Math.ceil((expiry - clock - offset) / 1000)) : 0;
  const expired = Boolean(order && (order.status === "EXPIRED" || (["CREATING", "PENDING"].includes(order.status) && remaining === 0)));
  const paid = order?.status === "PAID";
  const cancelled = order?.status === "CANCELLED";
  const review = order?.status === "REVIEW";
  const creating = order?.status === "CREATING" && !expired;
  const waiting = order?.status === "PENDING" && !expired;
  const transfer = waiting && order?.checkout?.amount === order.amount && order.checkout.qr_image.startsWith("data:image/png;base64,") ? order.checkout : null;
  const countdown = `${Math.floor(remaining / 60).toString().padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;
  const checkButton = <button type="button" className={`cf-btn${waiting ? " cf-btn-primary" : ""}`} disabled={payment.isFetching || create.isPending} onClick={() => void check()}><RefreshCw size={15} aria-hidden="true" />{payment.isFetching ? "Đang kiểm tra…" : "Kiểm tra thanh toán"}</button>;

  return <div className={styles.workspace}>
    <Link className={`cf-inline-link ${styles.back}`} href="/settings/subscription"><ArrowLeft size={15} aria-hidden="true" />Gói sử dụng</Link>
    <Panel className={styles.checkout}>
      <div className={styles.chrome}>
        <Link href="/settings/subscription" className={styles.brand}><span><Activity size={18} aria-hidden="true" /></span>CapitalFlow.</Link>
        <span className={styles.powered}>Thanh toán qua <strong>payOS</strong></span>
      </div>
      {!id ? <div className={styles.body}><h1 className={styles.errorTitle}>Đường dẫn thanh toán không hợp lệ</h1><p className={styles.note}>Mở đơn từ mục Gói sử dụng để tiếp tục.</p></div>
        : payment.isPending ? <Loading />
        : payment.isError || !order ? <div className={styles.body}><h1 className={styles.errorTitle}>Chưa tải được đơn thanh toán</h1><p className={styles.note} role="alert">{errorMessage(payment.error)}</p><button type="button" className="cf-btn" onClick={() => void payment.refetch()}>Thử lại</button></div>
        : <>
          <div className={styles.body}>
            <div className={styles.heading}>
              <PageHead title="Thanh toán Premium" description={`${order.days} ngày sử dụng · Gia hạn thủ công`}
                actions={waiting || creating ? <div className={styles.paymentMeta}>
                  <div className={styles.amountRow}><strong>{money(order.amount)}</strong><button className={`cf-icon-btn ${styles.copy}`} type="button" aria-label="Sao chép số tiền" onClick={() => void copy(String(order.amount), "số tiền")}><Copy size={14} aria-hidden="true" /></button></div>
                  <span className={styles.expiry} role="timer" aria-live="off" aria-label={`Hết hạn ${dateTime(order.expires_at)}`}><Clock3 size={14} aria-hidden="true" />Hiệu lực <strong>{countdown}</strong></span>
                </div> : undefined} />
            </div>
            {payment.data.verificationError && <Alert kind="info">Chưa đồng bộ được trạng thái thanh toán. Bạn có thể kiểm tra lại sau.</Alert>}
            {create.isError && <Alert persistent>{errorMessage(create.error)}</Alert>}
            {transfer ? <div className={styles.grid}>
              <div className={styles.qrColumn}>
                <h2>Quét mã VietQR</h2><p className={styles.note}>Bằng ứng dụng ngân hàng của bạn</p>
                <Image unoptimized className={styles.qrImage} src={transfer.qr_image} width={248} height={248} alt={`Mã VietQR thanh toán Premium ${money(order.amount)}`} />
                <a className="cf-btn" href={transfer.qr_image} download={`capitalflow-premium-${order.order_code}.png`}><Download size={15} aria-hidden="true" />Tải mã QR</a>
              </div>
              <div className={styles.summary}>
                <h2>Thông tin chuyển khoản</h2>
                <div className={styles.bank}><Landmark size={18} aria-hidden="true" /><strong>{transfer.bank_name}</strong></div>
                <dl className={styles.details}>
                  <div><div><dt>Người nhận</dt><dd>{transfer.account_name}</dd></div></div>
                  <div><div><dt>Số tài khoản</dt><dd>{transfer.account_number}</dd></div><button className={`cf-icon-btn ${styles.copy}`} type="button" aria-label="Sao chép số tài khoản" onClick={() => void copy(transfer.account_number, "số tài khoản")}><Copy size={14} aria-hidden="true" /></button></div>
                  <div><div><dt>Nội dung chuyển khoản</dt><dd>{transfer.description}</dd></div><button className={`cf-icon-btn ${styles.copy}`} type="button" aria-label="Sao chép nội dung chuyển khoản" onClick={() => void copy(transfer.description, "nội dung chuyển khoản")}><Copy size={14} aria-hidden="true" /></button></div>
                </dl>
                <p className={styles.transferNote}><Info size={14} aria-hidden="true" />Chuyển đúng số tiền và nội dung để được xác nhận tự động.</p>
              </div>
            </div> : paid ? <div className={styles.outcome}>
              <span className={`${styles.outcomeMark} ${styles.success}`}><CheckCircle2 size={26} aria-hidden="true" /></span>
              <h2>Thanh toán thành công</h2><p className={styles.note}>Premium đã được kích hoạt cho tài khoản của bạn.</p>
              <dl className={styles.receipt}>
                <div><dt>Gói sử dụng</dt><dd>Premium · {order.days} ngày</dd></div>
                <div><dt>Đã thanh toán</dt><dd>{money(order.amount)}</dd></div>
                {order.premium_until && <div><dt>Sử dụng đến</dt><dd>{dateTime(order.premium_until)}</dd></div>}
                <div><dt>Mã đơn</dt><dd>{order.order_code}</dd></div>
              </dl>
              <Link className="cf-btn cf-btn-primary" href="/settings/subscription">Xem gói sử dụng<ArrowUpRight size={15} aria-hidden="true" /></Link>
            </div> : expired || cancelled ? <div className={styles.outcome}>
              <span className={`${styles.outcomeMark} ${styles.warning}`}><TimerOff size={26} aria-hidden="true" /></span>
              <h2>{cancelled ? "Thanh toán đã được hủy" : "Mã QR đã hết hạn"}</h2>
              <p className={styles.note}>Tạo mã mới để tiếp tục thanh toán Premium.</p>
              <p className={styles.note}>Nếu đã chuyển khoản, hãy kiểm tra trạng thái trước.</p>
              <div className={styles.outcomeActions}><button type="button" className="cf-btn cf-btn-primary" disabled={create.isPending || payment.isFetching} onClick={() => create.mutate()}><RefreshCw size={15} aria-hidden="true" />{create.isPending ? "Đang tạo thanh toán…" : "Tạo mã mới"}</button>{checkButton}</div>
            </div> : review ? <div className={styles.outcome}>
              <span className={`${styles.outcomeMark} ${styles.warning}`}><CircleAlert size={26} aria-hidden="true" /></span>
              <h2>Thanh toán cần đối chiếu</h2><p className={styles.note}>Gửi mã đơn {order.order_code} tại Trung tâm hỗ trợ để được kiểm tra số tiền thanh toán.</p>
              <Link className="cf-btn cf-btn-primary" href="/support">Trung tâm hỗ trợ<ArrowUpRight size={15} aria-hidden="true" /></Link>{checkButton}
            </div> : creating ? <div className={styles.outcome}>
              <span className={styles.outcomeMark}><LoaderCircle size={26} aria-hidden="true" /></span>
              <h2>Đang chuẩn bị mã QR</h2><p className={styles.note}>Đơn đã được lưu. Thông tin thanh toán sẽ tự cập nhật khi mã QR sẵn sàng.</p>
              <div className={styles.outcomeActions}>{checkButton}<button type="button" className="cf-btn cf-btn-primary" disabled={create.isPending || payment.isFetching} onClick={() => create.mutate()}>{create.isPending ? "Đang tạo thanh toán…" : "Tiếp tục tạo thanh toán"}</button></div>
            </div> : waiting ? <div className={styles.outcome}>
              <span className={styles.outcomeMark}><Info size={26} aria-hidden="true" /></span><h2>Mở đơn trên payOS để thanh toán</h2>
              <p className={styles.note}>Thông tin QR của đơn này chưa có sẵn. Bạn có thể tiếp tục thanh toán trên trang payOS.</p>
              {order.checkout_url && <a className="cf-btn cf-btn-primary" href={order.checkout_url}>Mở trang thanh toán payOS<ArrowUpRight size={15} aria-hidden="true" /></a>}
            </div> : <p className={styles.note}>Chưa xác nhận được trạng thái. Hãy kiểm tra lại đơn thanh toán.</p>}
            {notice && <p className={styles.feedback} role="status">{notice}</p>}
          </div>
          {waiting && <footer className={styles.footer}>
            <div className={styles.status}><Clock3 size={17} aria-hidden="true" /><div><strong>Chờ thanh toán</strong><p>Tự động cập nhật khi nhận được tiền.</p></div></div>
            {checkButton}
          </footer>}
        </>}
    </Panel>
  </div>;
}
