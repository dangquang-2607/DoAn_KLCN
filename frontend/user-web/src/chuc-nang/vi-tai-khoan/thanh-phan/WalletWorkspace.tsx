"use client";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownUp, ArrowLeftRight, ArrowRight, Check, Copy, Eye, Landmark, Pencil, Plus, QrCode, Receipt, Trash2, Wallet as WalletIcon } from "lucide-react";
import api from "@/dung-chung/connect-api/api";
import { Alert, Empty, ErrorState, Field, Loading, Modal, PageHead, Pagination, Panel } from "@/dung-chung/UI-chung/ui";
import { errorMessage, money } from "@/dung-chung/tien-ich/finance";
import type { Transaction, Category } from "@/dung-chung/nghiep-vu/finance";
import styles from "./AccountCard.module.css";
import TopupWithdrawModal from "./TopupWithdrawModal";
import modalStyles from "./TopupWithdrawModal.module.css";
import AmountInput from "./AmountInput";
import { normalizeDemoAccountNumber } from "../xu-ly/accountNumber";

export type Wallet = { id: string; name: string; balance: string; currency: string; is_active: boolean; is_default: boolean; receive_code: string; created_at: string };
type ReceiveInfo = { wallet_id: string; wallet_name: string; recipient_name: string; receive_code: string; qr_payload: string; qr_image_data_url: string };
type Bank = { id: string; provider: string; account_number_masked: string; status: string };
type Provider = { name: string; demo_number: string; label: string };
type Recipient = { id: string; name: string; recipient_name: string; is_own: boolean };
type Entry = { id: string; operation_id: string; kind: string; amount: string; balance_after: string; created_at: string; merchant_name?: string; bill_reference?: string; bookkeeping_id?: string; recorded_amount?: string; include_in_reports?: boolean; category_id?: string; category_name?: string };
const labels: Record<string, string> = { TOPUP: "Nạp từ ngân hàng", WITHDRAW: "Rút về ngân hàng", TRANSFER_IN: "Nhận chuyển tiền", TRANSFER_OUT: "Chuyển tiền", PAYMENT: "Thanh toán hóa đơn" };

export default function WalletWorkspace() {
  const cache = useQueryClient();
  const [showClosed, setShowClosed] = useState(false);
  const wallets = useQuery<Wallet[]>({ queryKey: ["wallets", "all", "receiving-v2"], queryFn: async () => (await api.get("/wallets", { params: { include_closed: true } })).data });
  const providers = useQuery<Record<string, Provider>>({ queryKey: ["wallet-providers"], queryFn: async () => (await api.get("/wallets/providers")).data });
  const [selected, setSelected] = useState<Wallet | null>(null);
  const [mode, setMode] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [linkId, setLinkId] = useState("");
  const [provider, setProvider] = useState("VCB");
  const [number, setNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState("");
  const [target, setTarget] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [resolvedTarget, setResolvedTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [merchant, setMerchant] = useState("");
  const [billReference, setBillReference] = useState("");
  const [includeInReports, setIncludeInReports] = useState(true);
  const [bookkeepingId, setBookkeepingId] = useState("");
  const [paymentReviewed, setPaymentReviewed] = useState(false);
  const [spendingEntry, setSpendingEntry] = useState<Entry | null>(null);
  const [spendingCategory, setSpendingCategory] = useState("");
  const [pendingSpending, setPendingSpending] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const banks = useQuery<Bank[]>({ queryKey: ["wallet-banks"], enabled: ["banks", "topup", "withdraw"].includes(mode),
    queryFn: async () => (await api.get("/wallets/banks")).data });
  const history = useQuery<{ items: Entry[]; total: number }>({ queryKey: ["wallet-history", selected?.id, page], enabled: !!selected && mode === "history",
    queryFn: async () => (await api.get(`/wallets/${selected!.id}/history`, { params: { page } })).data });
  const receive = useQuery<ReceiveInfo>({ queryKey: ["wallet-receive", selected?.id], enabled: !!selected?.is_active && ["details", "receive"].includes(mode),
    queryFn: async () => (await api.get(`/wallets/${selected!.id}/receive`)).data });
  const records = useQuery<{ items: Transaction[] }>({ queryKey: ["transactions", "payment-link"], enabled: mode === "pay", queryFn: async () => (await api.get("/bookkeeping", { params: { type: "EXPENSE", page_size: 100 } })).data });
  const categories = useQuery<Category[]>({ queryKey: ["categories", "all"], enabled: mode === "spending", queryFn: async () => (await api.get("/categories", { params: { status: "all" } })).data });
  const refresh = () => Promise.all(["wallets", "wallet-banks", "wallet-history", "dashboard", "notifications", "transactions", "analytics", "budgets", "payment-records"].map(key => cache.invalidateQueries({ queryKey: [key] })));
  const open = (next: string, wallet: Wallet | null = null) => {
    setSelected(wallet); setMode(next); setName(wallet?.name || ""); setAmount(""); setLinkId("");
    setChallenge(""); setOtp(""); setNumber(""); setTarget(""); setRecipient(null); setError(""); setPage(1);
    setMerchant(""); setBillReference(""); setIncludeInReports(true); setBookkeepingId(""); setPaymentReviewed(false); setSpendingEntry(null);
    setCopied(false);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const root = `/wallets/${selected?.id}`;
      if (mode === "create") await api.post("/wallets", { name: name.trim() });
      if (mode === "rename") await api.patch(root, { name: name.trim() });
      if (mode === "archive") await api.delete(root);
      if (mode === "topup" || mode === "withdraw") await api.post(`${root}/${mode}`, { link_id: linkId, amount });
      if (mode === "pay") {
        if (!paymentReviewed) { setPaymentReviewed(true); return; }
        await api.post(`${root}/payments/create`, { merchant_name: merchant.trim(), bill_reference: billReference.trim(), amount, bookkeeping_id: bookkeepingId || null });
      }
      if (mode === "spending") await api.patch(`/bookkeeping/${spendingEntry!.bookkeeping_id}`, { amount, include_in_reports: includeInReports, category_id: spendingCategory || null });
      if (mode === "transfer") {
        if (!recipient || resolvedTarget !== target.trim()) {
          const { data } = await api.post<Recipient>("/wallets/recipients/resolve", { recipient: target.trim() });
          if (data.id === selected?.id) throw new Error("Chọn ví nhận khác ví gửi.");
          setResolvedTarget(target.trim()); setRecipient(data); return;
        }
        await api.post(`${root}/transfers/create`, { to_wallet_id: recipient.id, amount });
      }
      if (mode === "link") {
        const accountNumber = normalizeDemoAccountNumber(number);
        const demo = providers.data?.[provider];
        if (!demo) throw new Error("Chưa tải được ngân hàng. Vui lòng thử lại.");
        if (accountNumber !== demo.demo_number) throw new Error(`Hãy dùng số tài khoản được cấp riêng ${demo.demo_number} của ${demo.name}.`);
        setNumber(accountNumber);
        if (!challenge) {
          const { data } = await api.post("/wallets/banks/send-otp", { provider, account_number: accountNumber });
          setChallenge(data.otp_request_id); setOtp(""); return;
        }
        await api.post("/wallets/banks", { provider, account_number: accountNumber, otp, otp_request_id: challenge });
      }
      await refresh(); setMode(mode === "pay" ? "history" : ""); setNotice("Đã hoàn tất thao tác.");
    } catch (e) { setError(e instanceof Error && !("response" in e) ? e.message : errorMessage(e)); } finally { setBusy(false); }
  };
  const unlink = async (id: string) => {
    setBusy(true); setError("");
    try { await api.delete(`/wallets/banks/${id}`); await refresh(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const toggleSpending = async (entry: Entry, included: boolean) => {
    setBusy(true); setError(""); setPendingSpending({ [entry.id]: included });
    try { await api.patch(`/bookkeeping/${entry.bookkeeping_id}`, { include_in_reports: included }); await refresh(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); setPendingSpending({}); }
  };
  const titles: Record<string, string> = { receive: "QR nhận tiền", details: "Chi tiết ví", create: "Tạo ví mới", rename: "Đổi tên ví", archive: "Đóng ví", topup: "Nạp tiền", withdraw: "Rút tiền", transfer: "Chuyển tiền", link: "Liên kết ngân hàng", banks: "Ngân hàng liên kết", history: "Lịch sử tiền trong ví", pay: "Thanh toán hóa đơn mô phỏng", spending: "Ghi nhận chi tiêu cá nhân" };
  const current = wallets.data?.find(w => w.id === selected?.id) || selected;
  const receiveCode = receive.data?.receive_code || current?.receive_code;
  const copyReceiveCode = async () => {
    if (!receiveCode) return;
    try {
      await navigator.clipboard.writeText(receiveCode);
      setCopied(true);
      setNotice("Đã sao chép mã nhận tiền.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Hãy chọn và sao chép mã nhận tiền hiển thị phía trên.");
    }
  };
  const visibleWallets = wallets.data?.filter(w => showClosed ? !w.is_active : w.is_active);
  return <div className="cf-stack">
    <PageHead
      eyebrow="VÍ CỦA BẠN"
      title="Ví"
      description="Nạp, rút, chuyển tiền và thanh toán hóa đơn mô phỏng. Quản lý riêng lịch sử tiền và phần chi tiêu cá nhân."
    />
    
    <div className={styles.workspaceToolbar}>
      <div className={styles.walletTabs} role="tablist" aria-label="Bộ lọc trạng thái ví">
        <button
          type="button"
          role="tab"
          
          aria-selected={!showClosed}
          onClick={() => setShowClosed(false)}
        >
          Ví đang dùng
        </button>
        <button
          type="button"
          role="tab"
          
          aria-selected={showClosed}
          onClick={() => setShowClosed(true)}
        >
          Ví đã đóng
        </button>
      </div>

      <div className={styles.headerActions}>
        <button
          type="button"
          className={`${styles.headerBtn} ${styles.headerBtnPrimary}`}
          onClick={() => open("topup", current || visibleWallets?.[0] || null)}
        >
          <ArrowDownUp size={15} />
          <span>Nạp / Rút tiền</span>
        </button>
        <button
          type="button"
          className={styles.headerBtn}
          onClick={() => open("transfer", current || visibleWallets?.[0] || null)}
        >
          <ArrowLeftRight size={15} className={styles.iconTransfer} />
          <span>Chuyển tiền</span>
        </button>
        <button
          type="button"
          className={styles.headerBtn}
          onClick={() => open("pay", current || visibleWallets?.[0] || null)}
        >
          <Receipt size={15} className={styles.iconBill} />
          <span>Thanh toán hóa đơn</span>
        </button>
        <button
          type="button"
          className={styles.headerBtn}
          onClick={() => open("banks")}
        >
          <Landmark size={15} className={styles.iconBank} />
          <span>Ngân hàng của tôi</span>
        </button>
      </div>
    </div>
    {notice && <Alert kind="success" onDismiss={() => setNotice("")}>{notice}</Alert>}
    {wallets.isPending ? <Loading /> : wallets.isError ? <ErrorState retry={() => wallets.refetch()} /> : !visibleWallets?.length ? (
      !showClosed ? (
        <div className="cf-grid">
          <button
            type="button"
            className={styles.addWalletCard}
            onClick={() => open("create")}
            aria-label="Tạo ví"
          >
            <div className={styles.addWalletIconCircle}>
              <Plus size={26} />
            </div>
            <strong className={styles.addWalletTitle}>Tạo ví mới</strong>
            <span className={styles.addWalletSubtitle}>Tạo ví bằng tên bạn muốn. Số dư ban đầu luôn là 0đ.</span>
          </button>
        </div>
      ) : (
        <Empty title="Chưa có ví đã đóng" description="Lịch sử của ví đã đóng vẫn được lưu để tra cứu." />
      )
    ) : (
      <div className="cf-grid">
        {visibleWallets.map(wallet => <Panel key={wallet.id} className="cf-wallet-card"><div className={`cf-panel-body ${styles.cardBody}`}>
          <div className="cf-row cf-between"><span className="cf-icon"><WalletIcon /></span><span className="cf-badge">{wallet.is_default ? "Ví mặc định" : wallet.is_active ? "Ví cá nhân" : "Đã đóng"}</span></div>
          <h2 className={styles.cardName}>{wallet.name}</h2>
          <div className={styles.cardSummary}><span className={styles.label}>Số dư hiện tại</span><div className="cf-number" style={{ fontSize: "clamp(22px, 2vw, 30px)", fontWeight: 650, margin: "4px 0 0", overflowWrap: "anywhere" }}>{money(wallet.balance)}</div></div>
          <div className={styles.cardFooter}><div className="cf-row cf-between">
            <button type="button" className="cf-inline-link" onClick={() => open("history", wallet)}>Giao dịch <ArrowRight size={14} style={{ display: "inline" }} /></button>
            <div className="cf-row">
              <button type="button" className="cf-icon-btn" aria-label={`Xem chi tiết ${wallet.name}`} onClick={() => open("details", wallet)}><Eye size={16} /></button>
              {wallet.is_active && <button type="button" className="cf-icon-btn" aria-label={`QR nhận tiền ${wallet.name}`} onClick={() => open("receive", wallet)}><QrCode size={16} /></button>}
              {wallet.is_active && <><button type="button" className="cf-icon-btn" aria-label={`Đổi tên ${wallet.name}`} onClick={() => open("rename", wallet)}><Pencil size={16} /></button>
              {!wallet.is_default && <button type="button" className="cf-icon-btn" aria-label={`Đóng ví ${wallet.name}`} onClick={() => open("archive", wallet)}><Trash2 size={16} /></button>}</>}
            </div>
          </div>
          </div>
        </div></Panel>)}
        {!showClosed && (
          <button
            type="button"
            className={styles.addWalletCard}
            onClick={() => open("create")}
            aria-label="Tạo ví"
          >
            <div className={styles.addWalletIconCircle}>
              <Plus size={26} />
            </div>
            <strong className={styles.addWalletTitle}>Tạo ví mới</strong>
            <span className={styles.addWalletSubtitle}>Thêm ví để quản lý riêng dòng tiền</span>
          </button>
        )}
      </div>
    )}
    {["topup", "withdraw"].includes(mode) && (
      <TopupWithdrawModal
        activeTab={mode as "topup" | "withdraw"}
        onTabChange={(tab) => {
          setMode(tab);
          setError("");
        }}
        currentWallet={current || null}
        wallets={visibleWallets || []}
        onSelectWallet={(w) => setSelected(w)}
        banks={banks.data}
        banksLoading={banks.isPending}
        banksError={banks.isError}
        onRetryBanks={() => banks.refetch()}
        selectedBankId={linkId}
        onSelectBankId={(id) => setLinkId(id)}
        onOpenLinkBank={() => open("link", selected)}
        amount={amount}
        onAmountChange={(val) => setAmount(val)}
        busy={busy}
        error={error}
        onDismissError={() => setError("")}
        onSubmit={submit}
        onClose={() => setMode("")}
      />
    )}
    {mode && !["topup", "withdraw"].includes(mode) && <Modal title={titles[mode]} onClose={() => setMode("")} busy={busy}>
      <form className="cf-form" onSubmit={submit}>
        {error && <Alert persistent onDismiss={() => setError("")}>{error}</Alert>}
        {current && mode !== "details" && <p>{current.name} · Số dư {money(current.balance)}</p>}
        {mode === "details" && current && <div className={styles.details}>
          <div className={styles.detailHero}><span className="cf-icon"><WalletIcon /></span><h3>{current.name}</h3><span className={styles.label}>Số dư hiện tại</span><strong className={styles.detailBalance}>{money(current.balance)}</strong></div>
          <div>
            <span className={styles.label}>{current.is_default ? "Email nhận tiền vào ví mặc định" : current.is_active ? "Mã ví để nhận tiền" : "Mã ví để đối chiếu"}</span>
            <div className={styles.receiveCodeBox}>
              <span className={styles.receiveCodeText}>{receiveCode || "Đang tải mã nhận tiền…"}</span>
              <button
                type="button"
                className={styles.copyCodeBtn}
                disabled={!receiveCode}
                aria-label="Sao chép mã nhận tiền"
                title={copied ? "Đã sao chép!" : "Sao chép mã nhận tiền"}
                onClick={copyReceiveCode}
              >
                {copied ? <Check size={16} className={styles.copySuccessIcon} /> : <Copy size={16} />}
              </button>
            </div>
            {receive.isError && <ErrorState retry={() => receive.refetch()} />}
          </div>
          {!current.is_active && <p>Ví đã đóng, không thể khôi phục. Lịch sử giao dịch vẫn được lưu để tra cứu.</p>}
          {!current.is_active && (
            <div className={styles.detailActions}>
              <button type="button" className="cf-btn" onClick={() => open("history", current)}>Lịch sử</button>
            </div>
          )}
        </div>}
        {mode === "receive" && (receive.isPending ? <Loading /> : receive.isError ? <ErrorState retry={() => receive.refetch()} /> : receive.data && <div style={{ textAlign: "center", overflowWrap: "anywhere" }}>
          <strong>{receive.data.recipient_name || "Tài khoản CapitalFlow"}</strong>
          <p>{receive.data.wallet_name}</p>
          {/* QR SVG generated by our API must retain its exact modules and quiet zone. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={receive.data.qr_image_data_url} alt={`QR nhận tiền vào ${receive.data.wallet_name}`} width={256} height={256} style={{ display: "block", margin: "16px auto", maxWidth: "100%", height: "auto", background: "white" }} />
          <p>{receive.data.receive_code}</p>
          <p>QR này nhận tiền vào đúng ví trên. Người gửi cần kiểm tra tên người nhận và xác nhận số tiền.</p>
          <a className="cf-btn" href={receive.data.qr_image_data_url} download={`capitalflow-${receive.data.wallet_id}.svg`}>Tải QR</a>
        </div>)}
        {(mode === "create" || mode === "rename") && <Field label="Tên ví"><input className="cf-input" required maxLength={150} value={name} onChange={e => setName(e.target.value)} /></Field>}
        {mode === "create" && <p>Ví bắt đầu với 0đ. Nạp tiền từ ngân hàng hoặc nhận tiền từ ví khác để sử dụng.</p>}
        {mode === "archive" && <p>Chỉ đóng được ví có số dư 0đ. Lịch sử vẫn xem được trong mục Ví đã đóng. Bạn không thể khôi phục ví này; ví sẽ không thể nạp, rút, nhận hoặc chuyển tiền. Nếu cần sử dụng lại, hãy tạo ví mới với mã ví mới.</p>}
        {mode === "pay" && <>
          <p>Thanh toán mô phỏng sẽ trừ tiền trong ví. Mỗi mã hóa đơn chỉ thanh toán một lần cho cùng nhà cung cấp.</p>
          <Field label="Nhà cung cấp"><input className="cf-input" required maxLength={150} disabled={paymentReviewed} value={merchant} onChange={e => setMerchant(e.target.value)} /></Field>
          <Field label="Mã hóa đơn / kỳ thanh toán"><input aria-label="Mã hóa đơn / kỳ thanh toán" className="cf-input" required maxLength={100} disabled={paymentReviewed} value={billReference} onChange={e => setBillReference(e.target.value)} /><small>Dùng mã riêng cho từng hóa đơn/kỳ, ví dụ DIEN-2026-10-001.</small></Field>
          <Field label="Khoản chi đã ghi trước đó (nếu có)"><select aria-label="Khoản chi đã ghi trước đó (nếu có)" className="cf-input" disabled={paymentReviewed || records.isPending || records.isError} value={bookkeepingId} onChange={e => { setBookkeepingId(e.target.value); const record = records.data?.items.find(t => t.id === e.target.value); if (record) setAmount(String(Math.abs(Number(record.amount)))); }}><option value="">Tạo khoản ghi nhận mới</option>{records.data?.items.filter(t => !t.wallet_entry_id && t.type === "EXPENSE").map(t => <option key={t.id} value={t.id}>{t.description} · {money(Math.abs(Number(t.amount)))}</option>)}</select><small>Chọn khoản đã nhập tay/OCR để tránh ghi chi hai lần. Phần chi cá nhân và lựa chọn tính thu chi của khoản đó được giữ nguyên.</small></Field>
          {records.isError && <ErrorState retry={() => records.refetch()} />}
          {paymentReviewed && <><Alert persistent kind="info">Xác nhận trả <strong>{money(amount)}</strong> từ ví {current?.name} cho {merchant}, mã {billReference}. Số tiền này sẽ được trừ khỏi ví.</Alert><button className="cf-btn" type="button" onClick={() => setPaymentReviewed(false)}>Sửa thông tin thanh toán</button></>}
        </>}
        {mode === "spending" && <>
          <p>Đã thanh toán: <strong>{money(Math.abs(Number(spendingEntry?.amount)))}</strong> cho {spendingEntry?.merchant_name}. Đây là số tiền cố định trong lịch sử ví.</p>
          <label className="cf-switch-row"><input className="cf-switch-input" type="checkbox" role="switch" checked={includeInReports} onChange={e => setIncludeInReports(e.target.checked)} />Tính vào chi tiêu</label>
          <p>Tắt chỉ loại khỏi báo cáo và ngân sách. Không hoàn tiền, không xóa lịch sử thanh toán.</p>
          <Field label="Danh mục chi tiêu"><select className="cf-input" disabled={categories.isPending || categories.isError} value={spendingCategory} onChange={e => setSpendingCategory(e.target.value)}><option value="">Chưa phân loại</option>{categories.data?.filter(c => c.type === "EXPENSE" && (c.is_active || c.id === spendingCategory)).map(c => <option key={c.id} value={c.id} disabled={!c.is_active}>{c.name}{!c.is_active ? " (đã ẩn)" : ""}</option>)}</select></Field>
          {categories.isError && <ErrorState retry={() => categories.refetch()} />}
        </>}
        {mode === "transfer" && <>
          <Field label="Email, mã ví hoặc nội dung QR người nhận"><input aria-label="Email, mã ví hoặc nội dung QR người nhận" className="cf-input" placeholder="Email hoặc CF-7K9M2P4R" required maxLength={512} disabled={busy} value={target} onChange={e => { setTarget(e.target.value); setRecipient(null); }} /><small>Email nhận vào ví mặc định; mã CF- nhận vào ví phụ tương ứng.</small></Field>
          {(() => {
            const otherWallets = wallets.data?.filter(w => w.is_active && w.id !== selected?.id) || [];
            if (!otherWallets.length) return null;
            return (
              <div className={modalStyles.section}>
                <div className={modalStyles.sectionHeader}>
                  <span className={modalStyles.inputLabel}>Hoặc chọn ví khác của bạn</span>
                  <span className={modalStyles.sectionSubtitle}>Chuyển nội bộ</span>
                </div>
                <div className={modalStyles.walletCardsRow}>
                  {otherWallets.map(w => {
                    const isSelected = target === w.id;
                    return (
                      <button
                        type="button"
                        key={w.id}
                        disabled={busy}
                        className={`${modalStyles.walletCard} ${isSelected ? modalStyles.walletCardActive : ""}`}
                        onClick={() => {
                          setTarget(w.id);
                          setRecipient(null);
                        }}
                      >
                        <div className={modalStyles.walletAvatar}>
                          <WalletIcon size={18} />
                        </div>
                        <div className={modalStyles.walletInfo}>
                          <span className={modalStyles.walletName}>{w.name}</span>
                          <span className={modalStyles.walletBalance}>{money(w.balance)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <select
                  aria-label="Hoặc chọn ví khác của bạn"
                  disabled={busy}
                  className={modalStyles.srOnly}
                  value={otherWallets.some(w => w.id === target) ? target : ""}
                  onChange={e => { setTarget(e.target.value); setRecipient(null); }}
                >
                  <option value="">Chọn ví</option>
                  {otherWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            );
          })()}
          {recipient && <Alert kind="info">Người nhận: <strong>{recipient.recipient_name}</strong><br />Ví: {recipient.name}<br />Số tiền: {money(amount)}. Kiểm tra trước khi xác nhận.</Alert>}
        </>}
        {mode === "transfer" && (
          <AmountInput
            amount={amount}
            disabled={busy}
            onAmountChange={val => {
              setAmount(val);
              setRecipient(null);
            }}
            maxBalance={Number(current?.balance || 0)}
            showAllBalanceChip={true}
            errorText="Số dư ví không đủ hoặc vượt giới hạn"
          />
        )}
        {mode === "pay" && (
          <AmountInput
            amount={amount}
            onAmountChange={val => setAmount(val)}
            maxBalance={Number(current?.balance || 0)}
            disabled={paymentReviewed}
            errorText="Số dư ví không đủ để thanh toán"
          />
        )}
        {mode === "spending" && (
          <AmountInput
            label="Số tiền ghi nhận cá nhân (VND)"
            ariaLabel="Số tiền ghi nhận cá nhân (VND)"
            amount={amount}
            onAmountChange={val => setAmount(val)}
            maxBalance={Math.abs(Number(spendingEntry?.amount || 0))}
            chips={[]}
            errorText="Số tiền vượt quá giá trị hóa đơn"
          />
        )}
        {mode === "link" && <>
          <p>Liên kết một lần để nạp/rút cho tất cả ví của bạn, kể cả ví tạo sau này. OTP xác nhận liên kết được gửi qua email.</p>
          {providers.isError && <ErrorState retry={() => providers.refetch()} />}
          <Field label="Ngân hàng"><select className="cf-input" required value={provider} onChange={e => { setProvider(e.target.value); setChallenge(""); setOtp(""); setNumber(""); setError(""); }}>
            {Object.entries(providers.data || {}).map(([id, p]) => <option key={id} value={id}>{p.name}</option>)}</select></Field>
          <Field label="Số tài khoản demo của bạn"><input className="cf-input" inputMode="numeric" autoComplete="off" required value={number} onChange={e => { setNumber(normalizeDemoAccountNumber(e.target.value)); setChallenge(""); setOtp(""); setError(""); }} /></Field>
          <small>Tài khoản cấp riêng cho bạn: {providers.data?.[provider]?.demo_number}</small>
          
          {challenge && <><Field label="OTP email"><input className="cf-input" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={e => setOtp(e.target.value)} /></Field>
            <button type="button" className="cf-btn" disabled={busy} onClick={() => { setChallenge(""); setOtp(""); }}>Gửi mã khác (cách nhau ít nhất 30 giây)</button></>}
        </>}
        {mode === "banks" && <>
          <p>Liên kết dùng chung cho mọi ví. Ngắt liên kết sẽ dừng nạp/rút qua ngân hàng này ở tất cả ví.</p>
          {banks.isPending ? <Loading /> : banks.isError ? <ErrorState retry={() => banks.refetch()} /> : banks.data?.map(b => <div key={b.id} className="cf-form-actions"><span>{b.provider} · {b.account_number_masked} · {b.status === "CONNECTED" ? "Đã liên kết" : b.status === "EXPIRED" ? "Hết hạn" : "Đã ngắt"}</span>
            {b.status === "CONNECTED" && <button type="button" className="cf-btn" disabled={busy} onClick={() => unlink(b.id)}>Ngắt liên kết</button>}</div>)}
          <button type="button" className="cf-btn cf-btn-primary" onClick={() => open("link", selected)}>Liên kết ngân hàng</button>
        </>}
        {mode === "history" && <>
          {history.isPending ? <Loading /> : history.isError ? <ErrorState retry={() => history.refetch()} /> : <>
            {!history.data?.items.length && <p>Chưa có giao dịch tiền trong ví.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "12px 0" }}>
              {history.data?.items.map(e => <div key={e.id} style={{ padding: "12px 14px", border: "1px solid var(--cf-line)", borderRadius: "10px", background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <strong>{labels[e.kind]}</strong>
                  <strong style={{ color: ["TOPUP", "TRANSFER_IN"].includes(e.kind) ? "var(--cf-green, #16a34a)" : "var(--cf-ink)" }}>
                    {["TOPUP", "TRANSFER_IN"].includes(e.kind) ? `+${money(e.amount)}` : `-${money(e.amount)}`}
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--cf-muted)" }}>{new Date(e.created_at + "Z").toLocaleString("vi-VN")} · Số dư sau GD: {money(e.balance_after)}</p>
                {e.kind === "PAYMENT" && <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed var(--cf-line)" }}>
                  <p style={{ margin: "2px 0", fontSize: "13px" }}>Thành công (mô phỏng) · {e.merchant_name} · {e.bill_reference}</p>
                  <small style={{ color: "var(--cf-muted)" }}>Mã GD: {e.operation_id} · Danh mục: {e.category_name || "Chưa phân loại"}</small>
                  <p style={{ margin: "4px 0", fontSize: "13px" }}>Ghi nhận cá nhân: {money(e.recorded_amount || 0)}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px" }}>
                    <label className="cf-switch-row" style={{ margin: 0 }}>
                      <input className="cf-switch-input" type="checkbox" role="switch" aria-label={`Tính vào chi tiêu ${e.bill_reference}`} disabled={busy} checked={pendingSpending[e.id] ?? !!e.include_in_reports} onChange={event => toggleSpending(e, event.target.checked)} />
                      Tính vào chi tiêu
                    </label>
                    <button type="button" className="cf-btn cf-btn-sm" onClick={() => { setSpendingEntry(e); setSpendingCategory(e.category_id || ""); setAmount(e.recorded_amount || ""); setIncludeInReports(!!e.include_in_reports); setMode("spending"); setError(""); }}>Quản lý chi tiêu</button>
                  </div>
                </div>}
              </div>)}
            </div>
            <Pagination page={page} total={history.data?.total || 0} pageSize={20} onChange={setPage} />
          </>}
        </>}
        {!["receive", "details", "banks", "history"].includes(mode) && <button className="cf-btn cf-btn-primary" disabled={busy || (mode === "link" && !providers.data)}>
          {busy ? "Đang xử lý…" : mode === "pay" && !paymentReviewed ? "Kiểm tra thanh toán" : mode === "link" && !challenge ? "Gửi OTP" : mode === "transfer" && !recipient ? "Kiểm tra người nhận" : "Xác nhận"}
        </button>}
      </form>
    </Modal>}
  </div>;
}
