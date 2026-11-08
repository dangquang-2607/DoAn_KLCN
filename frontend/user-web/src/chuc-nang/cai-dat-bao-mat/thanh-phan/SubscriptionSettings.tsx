"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, ChevronRight, CreditCard, RefreshCw } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, ErrorState, Loading, PageHead, Pagination, Panel } from "@/dung-chung/UI-chung/ui";
import { errorMessage, money } from "@/dung-chung/tien-ich/finance";
import { newRequestId } from "@/dung-chung/tien-ich/browserCrypto";
import styles from "../CSS/subscription.module.css";
import { checkoutPath, dateTime, validPaymentId, type PaymentOrder as Order, type Subscription } from "../xu-ly/subscription";
const statusLabels: Record<string, string> = {
  CREATING: "Đang tạo thanh toán", PENDING: "Chờ thanh toán", PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy", EXPIRED: "Đã hết hạn", REVIEW: "Cần kiểm tra thanh toán",
};
const resources = [
  { key: "wallets", label: "Ví đang hoạt động" },
  { key: "budgets", label: "Ngân sách đang áp dụng" },
  { key: "ai", label: "Lượt AI trong tháng" },
] as const;
const tabs = [
  { key: "usage", label: "Hạn mức của tôi" },
  { key: "pricing", label: "Bảng giá" },
  { key: "history", label: "Lịch sử thanh toán" },
] as const;
type Tab = typeof tabs[number]["key"];

export default function SubscriptionSettings({ asPage = false }: { asPage?: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const cache = useQueryClient();
  const id = useId();
  const [tab, setTab] = useState<Tab>(() => params.has("payment_order") ? "usage" : "pricing");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [page, setPage] = useState(1);
  const requestId = useRef<string | null>(null);
  const sending = useRef(false);
  const subscription = useQuery<Subscription>({ queryKey: ["subscription"], queryFn: async () => (await api.get("/billing/subscription")).data });
  const history = useQuery<{ items: Order[]; total: number }>({ queryKey: ["payment-orders", page], queryFn: async () => (await api.get("/billing/orders", { params: { page } })).data });
  const returnedId = params.get("payment_order");
  const validReturnedId = validPaymentId(returnedId);
  const activeId = validReturnedId || history.data?.items.find(item => ["CREATING", "PENDING"].includes(item.status))?.id;
  const order = useQuery<Order>({
    queryKey: ["payment-order", activeId],
    queryFn: async () => (await api.post(`/billing/orders/${activeId}/refresh`)).data,
    enabled: Boolean(activeId), retry: false,
    refetchInterval: query => query.state.data && ["CREATING", "PENDING"].includes(query.state.data.status)
      && Date.now() < new Date(query.state.data.expires_at).getTime() + 60_000 ? 10_000 : false,
    refetchIntervalInBackground: false,
  });
  useEffect(() => {
    if (order.data?.status !== "PAID") return;
    requestId.current = null;
    void cache.invalidateQueries({ queryKey: ["subscription"] });
    void cache.invalidateQueries({ queryKey: ["payment-orders"] });
  }, [order.data?.id, order.data?.status, cache]);
  const purchase = useMutation({
    mutationFn: async () => {
      requestId.current ??= newRequestId();
      return (await api.post<Order>("/billing/checkout", { request_id: requestId.current })).data;
    },
    onSuccess: item => {
      if (["PAID", "CANCELLED", "EXPIRED", "REVIEW"].includes(item.status)) requestId.current = null;
      void cache.invalidateQueries({ queryKey: ["payment-orders"] });
      router.push(checkoutPath(item.id));
    },
    onSettled: () => { sending.current = false; void cache.invalidateQueries({ queryKey: ["payment-orders"] }); },
  });
  const buy = () => {
    if (sending.current) return;
    sending.current = true;
    purchase.mutate();
  };
  if (subscription.isPending) return <Panel title="Gói sử dụng"><Loading /></Panel>;
  if (subscription.isError) return <Panel title="Gói sử dụng"><ErrorState retry={() => subscription.refetch()} /></Panel>;
  const current = subscription.data;
  const premium = current.plan === "PREMIUM";
  const pendingCheckout = order.data && ["CREATING", "PENDING"].includes(order.data.status) ? checkoutPath(order.data.id) : null;
  return (
    <section className={styles.workspace} aria-labelledby={asPage ? undefined : `${id}-heading`} aria-label={asPage ? "Gói sử dụng" : undefined}>
      {asPage ? <PageHead title="Gói sử dụng" description="Quản lý hạn mức, nâng cấp Premium và lịch sử thanh toán."
        actions={<span className={`cf-badge${premium ? " info" : ""}`}>Đang dùng {premium ? "Premium" : "Free"}</span>} /> : <header className={styles.heading}>
        <h2 id={`${id}-heading`}>Gói sử dụng</h2>
        <span className={`cf-badge${premium ? " info" : ""}`}>Đang dùng {premium ? "Premium" : "Free"}</span>
      </header>}
      <div className={styles.tabs} role="tablist" aria-label="Quản lý gói sử dụng">
        {tabs.map((item, index) => <button key={item.key} type="button" role="tab" id={`${id}-${item.key}-tab`}
          ref={element => { tabRefs.current[index] = element; }}
          aria-controls={`${id}-${item.key}-panel`} aria-selected={tab === item.key} tabIndex={tab === item.key ? 0 : -1}
          onClick={() => setTab(item.key)} onKeyDown={event => {
            const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
              : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
              : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
            if (next === null) return;
            event.preventDefault();
            setTab(tabs[next].key);
            tabRefs.current[next]?.focus();
          }}>{item.label}{item.key === "history" && history.data && history.data.total > 0 && <span className={styles.count}>{history.data.total}</span>}</button>)}
      </div>
      <div className={styles.body}>
        <div role="tabpanel" id={`${id}-${tab}-panel`} aria-labelledby={`${id}-${tab}-tab`} tabIndex={0} className={styles.tabPanel}>
          {tab === "pricing" && <>
            <div className={styles.plans}>
              {(["FREE", "PREMIUM"] as const).map(plan => {
                const paid = plan === "PREMIUM";
                const selected = current.plan === plan;
                const limits = current.plans[plan];
                return <article key={plan} className={`${styles.plan}${paid ? ` ${styles.premium}` : ""}`} aria-label={`Gói ${paid ? "Premium" : "Free"}`}>
                  <div className={styles.planHeading}><h3>{paid ? "Premium" : "Free"}</h3>
                    {selected ? <span className={`cf-badge${paid ? " info" : ""}`}>Đang sử dụng</span> : paid && <span className="cf-badge info">Nâng hạn mức</span>}
                  </div>
                  <p className={styles.note}>{paid ? "Thêm hạn mức cho nhu cầu sử dụng nhiều hơn." : "Theo dõi thu chi cá nhân mỗi ngày."}</p>
                  <div className={styles.price}>
                    <strong>{paid ? money(current.price) : "Miễn phí"}</strong>
                    {paid && <span>/ {current.days} ngày</span>}
                  </div>
                  <p className={styles.note}>{paid ? "Thanh toán một lần, không tự động gia hạn." : "Không cần thanh toán để bắt đầu sử dụng."}</p>
                  {paid ? pendingCheckout && current.payment_available
                    ? <a className={`cf-btn cf-btn-primary ${styles.purchase}`} href={pendingCheckout}>Tiếp tục thanh toán<ArrowUpRight size={15} aria-hidden="true" /></a>
                    : <button type="button" className={`cf-btn cf-btn-primary ${styles.purchase}`} onClick={buy} disabled={purchase.isPending || !current.payment_available}>
                      <CreditCard size={16} aria-hidden="true" />{purchase.isPending ? "Đang tạo thanh toán…" : premium ? `Gia hạn ${current.days} ngày` : "Nâng cấp Premium"}
                    </button>
                    : <button type="button" className={`cf-btn ${styles.purchase}`} disabled>{selected ? "Đang sử dụng" : "Gói mặc định"}</button>}
                  <ul className={styles.features}>
                    <li><Check size={15} aria-hidden="true" /><span><strong>{limits.wallets}</strong> ví đang hoạt động</span></li>
                    <li><Check size={15} aria-hidden="true" /><span><strong>{limits.budgets}</strong> ngân sách đang áp dụng</span></li>
                    <li><Check size={15} aria-hidden="true" /><span><strong>{limits.ai}</strong> lượt quét hóa đơn AI/tháng</span></li>
                    <li><Check size={15} aria-hidden="true" /><span>Ghi thu chi, xem lịch sử và báo cáo</span></li>
                  </ul>
                </article>;
              })}
            </div>
            <details className={styles.comparisonDetails}>
              <summary>So sánh chi tiết quyền lợi<ChevronRight size={16} aria-hidden="true" /></summary>
              <table className={styles.comparison}>
                <caption className={styles.srOnly}>Quyền lợi Free và Premium</caption>
                <thead><tr><th scope="col">Tính năng</th><th scope="col">Free</th><th scope="col">Premium</th></tr></thead>
                <tbody>
                  {resources.map(({ key, label }) => <tr key={key}><th scope="row">{label}</th><td>{current.plans.FREE[key]}</td><td>{current.plans.PREMIUM[key]}</td></tr>)}
                  {["Ghi thu chi và xem lịch sử", "Báo cáo tài chính, xuất Excel", "Gửi yêu cầu hỗ trợ"].map(label => <tr key={label}><th scope="row">{label}</th><td><Check size={16} aria-label="Có" /></td><td><Check size={16} aria-label="Có" /></td></tr>)}
                </tbody>
              </table>
              <p className={styles.note}>Hết Premium vẫn giữ dữ liệu cũ; chỉ giới hạn tạo thêm và quét AI. Gia hạn cộng tiếp vào thời gian còn lại.</p>
            </details>
          </>}
          {tab === "usage" && <div className={styles.current}>
            <div className={styles.usageHeading}>
              <div><h3>{premium ? "Hạn mức Premium" : "Hạn mức Free"}</h3><p className={styles.note}>{premium && current.premium_until ? `Hiệu lực đến ${dateTime(current.premium_until)}` : "Các hạn mức đang áp dụng cho tài khoản của bạn."}</p></div>
              <button type="button" className="cf-btn cf-btn-sm" onClick={() => setTab("pricing")}>{premium ? "Xem gói và gia hạn" : "Xem gói Premium"}<ArrowUpRight size={15} aria-hidden="true" /></button>
            </div>
            <dl className={styles.usage}>
              {resources.map(({ key, label }) => {
                const used = current.usage[key];
                const limit = current.limits[key];
                const exceeded = used > limit;
                return <div key={key} className={exceeded ? styles.exceeded : undefined}>
                  <dt>{label}</dt>
                  <dd><strong>{used}</strong><span>/ {limit}</span>{exceeded && <span className={styles.overLimit}>Vượt {used - limit}</span>}</dd>
                  <progress className={styles.usageProgress} value={Math.min(used, limit)} max={limit} aria-label={`${label}: ${used} trên ${limit}`} />
                </div>;
              })}
            </dl>
            <p className={styles.note}>AI tính khi quét thành công, dùng chung trên mọi thiết bị và đặt lại đầu tháng theo giờ Việt Nam. Quét lại chủ động tính lượt mới.{current.usage.ai_pending > 0 ? ` ${current.usage.ai_pending} lượt đang xử lý.` : ""}</p>
            <p className={styles.note}>Ví và ngân sách cũ vẫn được giữ. Hạn mức tạo thêm tính theo số đang hoạt động.</p>
          </div>}
          {tab === "history" && <div className={styles.historyPanel}>
            {history.isPending ? <Loading /> : history.isError ? <ErrorState retry={() => history.refetch()} /> : !history.data.items.length ? <div className={styles.emptyHistory}><CreditCard size={24} aria-hidden="true" /><h3>Chưa có thanh toán</h3><p className={styles.note}>Các đơn nâng cấp và gia hạn Premium sẽ xuất hiện tại đây.</p></div> : <>
              <div className={styles.historyScroll}><table className={styles.history}>
                <caption className={styles.caption}>Các đơn nâng cấp và gia hạn Premium</caption>
                <thead><tr><th scope="col">Ngày tạo</th><th scope="col">Số tiền</th><th scope="col">Trạng thái</th><th scope="col"><span className={styles.srOnly}>Thao tác</span></th></tr></thead>
                <tbody>{history.data.items.map(item => <tr key={item.id}><td>{dateTime(item.created_at)}</td><td>{money(item.amount)}</td><td>{statusLabels[item.status] || item.status}</td><td><button type="button" className="cf-btn cf-btn-sm" aria-label={`Xem đơn ${item.order_code}`} onClick={() => router.push(checkoutPath(item.id))}>Xem</button></td></tr>)}</tbody>
              </table></div>
              {history.data.total > 10 && <Pagination page={page} total={history.data.total} pageSize={10} onChange={setPage} />}
            </>}
          </div>}
        </div>
        {!current.payment_available && <p className={styles.note}>Thanh toán Premium hiện chưa sẵn sàng. Vui lòng thử lại sau.</p>}
        {purchase.isError && <Alert persistent>{errorMessage(purchase.error)}</Alert>}
        {activeId && <div className={styles.payment} data-status={order.data?.status} aria-live="polite">
          <div className={styles.paymentInfo}>
            <strong><span className={styles.statusDot} aria-hidden="true" />{order.data ? statusLabels[order.data.status] || order.data.status : order.isFetching ? "Đang xác nhận thanh toán…" : "Chưa xác nhận được thanh toán"}</strong>
            {order.isError && <p className={styles.note}>{errorMessage(order.error)} Bạn có thể kiểm tra lại kết quả.</p>}
            {order.data?.status === "PAID" && order.data.premium_until && <p className={styles.note}>Premium đã kích hoạt đến {dateTime(order.data.premium_until)}.</p>}
            {order.data?.status === "PENDING" && <p className={styles.note}>Đơn {money(order.data.amount)} · Hết hạn {dateTime(order.data.expires_at)}</p>}
            {order.data?.status === "CREATING" && <p className={styles.note}>Đơn đã được lưu. Nếu chờ lâu, mở Bảng giá để tiếp tục cùng đơn.</p>}
            {order.data?.status === "REVIEW" && <p className={styles.note}>Gửi mã đơn {order.data.order_code} tại Trung tâm hỗ trợ để đối chiếu số tiền.</p>}
          </div>
          <div className={styles.paymentActions}>
            {pendingCheckout && current.payment_available && tab !== "pricing" && <a className="cf-btn cf-btn-sm" href={pendingCheckout}>Tiếp tục thanh toán<ArrowUpRight size={15} aria-hidden="true" /></a>}
            <button type="button" className="cf-btn cf-btn-sm" disabled={order.isFetching} onClick={() => order.refetch()}><RefreshCw size={14} aria-hidden="true" />Kiểm tra</button>
          </div>
        </div>}
      </div>
    </section>
  );
}
