"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import Link from "next/link";
import {
  ArrowDownUp,
  ArrowLeftRight,
  Check,
  Copy,
  Pencil,
  Plus,
  QrCode,
  Trash2,
  Wallet as WalletIcon,
  ScanLine,
  History,
  ReceiptText,
} from "lucide-react";
import api, { sessionOwner } from "@/dung-chung/connect-api/api";
import {
  Alert,
  Empty,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHead,
  Panel,
} from "@/dung-chung/UI-chung/ui";
import { errorMessage, money } from "@/dung-chung/tien-ich/finance";
import styles from "./CSS/WalletWorkspace.module.css";
import TopupWithdrawModal from "./nap-rut/TopupWithdrawModal";
import modalStyles from "./CSS/TopupWithdrawModal.module.css";
import MockInvoiceModal from "./thanh-phan/MockInvoiceModal";
import AmountInput from "./thanh-phan/AmountInput";
import WalletCards from "./thanh-phan/WalletCards";
import dialogStyles from "./CSS/WalletDialog.module.css";
import BillReceipt from "./thanh-toan/BillReceipt";
import { normalizeDemoAccountNumber } from "@/dung-chung/tien-ich/formValidation";
import {
  billPaymentStatus,
  resolveBillQR,
  type BillInfo,
  type PaidBill,
} from "./xu-ly/billQr";
import WalletQrScanner from "./thanh-phan/WalletQrScanner";
import qrStyles from "./CSS/BillPayment.module.css";
import WalletHistoryDialog from "./WalletHistoryDialog";
import BankLinksDialog, { type BankLink } from "./thanh-phan/BankLinksDialog";

type PaymentReceipt = {
  bill: BillInfo;
  displayedAt: string;
};

const pendingBillKey = (bill: BillInfo) =>
  `cf-pending-money:bill:${sessionOwner()}:${bill.bill_reference}`;
const unresolvedPayment =
  "Chưa xác định được kết quả thanh toán. Hãy kiểm tra lại khi có kết nối.";
const transferQrPrefix = "capitalflow://transfer?";

export type Wallet = {
  id: string;
  name: string;
  balance: string;
  currency: string;
  is_active: boolean;
  is_default: boolean;
  receive_code: string;
  created_at: string;
};
type ReceiveInfo = {
  wallet_id: string;
  wallet_name: string;
  recipient_name: string;
  receive_code: string;
  qr_payload: string;
  qr_image_data_url: string;
};
type Provider = { name: string; demo_number: string; label: string };
type BankMoneyTab = "topup" | "withdraw";
type Recipient = {
  id: string;
  name: string;
  recipient_name: string;
  receive_code: string;
  is_own: boolean;
};
type TransferReview = {
  source: Wallet;
  recipient: Recipient;
  amount: string;
  note: string;
};
/**
 * Không gian quản trị tổng thể hệ thống ví tài chính độc lập và giao dịch chuyển khoản.
 */
export default function WalletWorkspace() {
  const cache = useQueryClient();
  const [showClosed, setShowClosed] = useState(false);
  const [historyWallet, setHistoryWallet] = useState<Wallet | null>(null);
  const wallets = useQuery<Wallet[]>({
    queryKey: ["wallets", "all", "receiving-v2"],
    queryFn: async () =>
      (await api.get("/wallets", { params: { include_closed: true } })).data,
  });
  const providers = useQuery<Record<string, Provider>>({
    queryKey: ["wallet-providers"],
    queryFn: async () => (await api.get("/wallets/providers")).data,
  });
  const [selected, setSelected] = useState<Wallet | null>(null);
  const [mode, setMode] = useState("");
  const bankReturnTab = useRef<BankMoneyTab>("topup");
  const linkReturnMode = useRef<BankMoneyTab | "banks">("topup");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [linkId, setLinkId] = useState("");
  const [provider, setProvider] = useState("VCB");
  const [number, setNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [challenge, setChallenge] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [target, setTarget] = useState("");
  const [transferScannerOpen, setTransferScannerOpen] = useState(false);
  const recipientInputId = useId();
  const transferScannerButton = useRef<HTMLButtonElement>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [resolvedTarget, setResolvedTarget] = useState("");
  const [resolving, setResolving] = useState(false);
  const [recipientError, setRecipientError] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferReview, setTransferReview] = useState<TransferReview | null>(
    null,
  );
  const profile = useQuery<{ full_name: string }>({
    queryKey: ["user-me"],
    enabled: mode === "transfer",
    queryFn: async () => (await api.get("/auth/me")).data,
  });
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrBill, setQrBill] = useState<BillInfo | null>(null);
  const [billDisplayedAt, setBillDisplayedAt] = useState("");
  const [paymentPending, setPaymentPending] = useState(false);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const banks = useQuery<BankLink[]>({
    queryKey: ["wallet-banks"],
    enabled: ["topup", "withdraw", "link", "banks"].includes(mode),
    queryFn: async () => (await api.get("/wallets/banks")).data,
  });
  // Each user has one assigned demo account per provider.
  const connectedProviders = new Set(
    banks.data
      ?.filter((bank) => bank.status === "CONNECTED")
      .map((bank) => bank.provider),
  );
  const bankAlreadyLinked = connectedProviders.has(provider);
  useEffect(() => {
    if (!resendAvailableAt) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((resendAvailableAt - Date.now()) / 1000),
      );
      setResendSeconds(remaining);
      if (remaining === 0) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);
  const startResendCountdown = (seconds: number) => {
    setResendAvailableAt(Date.now() + seconds * 1000);
    setResendSeconds(seconds);
  };
  const receive = useQuery<ReceiveInfo>({
    queryKey: ["wallet-receive", selected?.id],
    enabled: !!selected?.is_active && mode === "receive",
    queryFn: async () =>
      (await api.get(`/wallets/${selected!.id}/receive`)).data,
  });
  const refresh = () =>
    Promise.all(
      [
        "wallets",
        "wallet-banks",
        "wallet-history",
        "dashboard",
        "notifications",
        "transactions",
        "analytics",
        "budgets",
        "payment-records",
      ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
    );
  useEffect(() => {
    const value = target.trim();
    if (mode !== "transfer" || transferReview || transferScannerOpen || !value) return;
    const controller = new AbortController();
    let cancelled = false;
    const timer = setTimeout(async () => {
      setResolving(true);
      setRecipientError("");
      try {
        const { data } = await api.post<Recipient>(
          "/wallets/recipients/resolve",
          { recipient: value },
          { signal: controller.signal },
        );
        if (cancelled) return;
        if (data.id === selected?.id) {
          setRecipientError("Chọn ví nhận khác ví gửi.");
          return;
        }
        setRecipient(data);
        setResolvedTarget(value);
      } catch (error) {
        if (!cancelled) setRecipientError(errorMessage(error));
      } finally {
        if (!cancelled) setResolving(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [mode, target, selected?.id, transferReview, transferScannerOpen]);
  const changeTarget = (value: string) => {
    setTarget(value);
    setRecipient(null);
    setResolvedTarget("");
    setRecipientError("");
    setResolving(false);
    setTransferReview(null);
    setError("");
  };
  const readTransferQr = (value: string) => {
    if (!value.startsWith(transferQrPrefix)) {
      throw new Error("Hãy dùng mã QR nhận tiền CapitalFlow.");
    }
    changeTarget(value);
    setTransferScannerOpen(false);
    transferScannerButton.current?.focus({ preventScroll: true });
  };
  const open = (next: string, wallet: Wallet | null = null) => {
    setSelected(wallet);
    setMode(next);
    setName(wallet?.name || "");
    setAmount("");
    setLinkId("");
    setChallenge("");
    setOtp("");
    setNumber("");
    setTarget("");
    setTransferScannerOpen(false);
    setRecipient(null);
    setError("");
    setResolvedTarget("");
    setResolving(false);
    setRecipientError("");
    setTransferNote("");
    setTransferReview(null);
    setQrBill(null);
    setBillDisplayedAt("");
    setPaymentPending(false);
    setCopied(false);
  };
  const bankMoneyTab = mode === "withdraw" ? "withdraw" : "topup";
  const openBankLink = (returnTo: BankMoneyTab | "banks") => {
    linkReturnMode.current = returnTo;
    setChallenge("");
    setOtp("");
    setNumber("");
    setError("");
    setMode("link");
  };
  const closeWalletDialog = () => {
    setMode(mode === "link" ? linkReturnMode.current : "");
  };
  const showPaidBill = (
    bill: BillInfo,
    result: PaidBill,
    storageKey: string,
  ) => {
    sessionStorage.removeItem(storageKey);
    setMode("");
    setReceipt({
      bill: { ...bill, amount: result.paid_amount },
      displayedAt: result.paid_at,
    });
    void refresh().catch(() => {});
  };
  const readBill = async (value: string, signal: AbortSignal) => {
    try {
      const data = await resolveBillQR(value, signal);
      const result = await billPaymentStatus(data.qr_payload, signal);
      if (signal.aborted) return;
      const storageKey = pendingBillKey(data);
      if (result.status === "SUCCEEDED") {
        showPaidBill(data, result, storageKey);
        return;
      }
      open("pay", defaultSourceWallet);
      setQrBill(data);
      setBillDisplayedAt(new Date().toISOString());
      if (sessionStorage.getItem(storageKey)) {
        setPaymentPending(true);
        setError(unresolvedPayment);
      }
    } catch (failure) {
      throw new Error(errorMessage(failure));
    }
  };
  const checkPayment = async (bill: BillInfo, storageKey: string) => {
    setPaymentPending(true);
    try {
      const result = await billPaymentStatus(bill.qr_payload);
      if (result.status === "SUCCEEDED") {
        showPaidBill(bill, result, storageKey);
        return;
      }
    } catch {
      // A read failure leaves the previous attempt unresolved.
    }
    setError(unresolvedPayment);
  };
  const submit = async (event: FormEvent, resendCode = false) => {
    event.preventDefault();
    if (busy || submitting.current) return;
    if (["create", "rename"].includes(mode) && !name.trim()) {
      setError("Vui lòng nhập tên ví.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const root = `/wallets/${selected?.id}`;
      if (mode === "pay") {
        if (!qrBill)
          throw new Error("Vui lòng quét QR hóa đơn trước khi thanh toán.");
        const storageKey = pendingBillKey(qrBill);
        if (paymentPending || sessionStorage.getItem(storageKey)) {
          await checkPayment(qrBill, storageKey);
          return;
        }
      }
      if (mode === "transfer" || mode === "pay") {
        const debitAmount = mode === "pay" ? qrBill?.amount : amount;
        const source = wallets.data?.find(
          (w) => w.id === selected?.id && w.is_active,
        );
        if (!source)
          throw new Error("Vui lòng chọn ví đang hoạt động để trích tiền.");
        if (!Number.isFinite(Number(debitAmount)) || Number(debitAmount) <= 0)
          throw new Error("Vui lòng nhập số tiền lớn hơn 0.");
        if (Number(debitAmount) > Number(source.balance))
          throw new Error("Số dư ví đã chọn không đủ.");
      }
      if (mode === "create") await api.post("/wallets", { name: name.trim() });
      if (mode === "rename") await api.patch(root, { name: name.trim() });
      if (mode === "archive") await api.delete(root);
      if (mode === "topup" || mode === "withdraw") {
        if (
          !banks.data?.some(
            (bank) => bank.id === linkId && bank.status === "CONNECTED",
          )
        ) {
          throw new Error("Vui lòng chọn ngân hàng còn liên kết.");
        }
        await api.post(`${root}/${mode}`, { link_id: linkId, amount });
      }
      if (mode === "pay" && qrBill) {
        const storageKey = pendingBillKey(qrBill);
        sessionStorage.setItem(storageKey, "pending");
        try {
          const { data } = await api.post<PaidBill>(
            `${root}/payments/create`,
            { qr_payload: qrBill.qr_payload },
            { timeout: 15000 },
          );
          showPaidBill(qrBill, data, storageKey);
        } catch (failure) {
          if (
            isAxiosError(failure) &&
            failure.code !== "ERR_CANCELED" &&
            (!failure.response ||
              failure.response.status >= 500 ||
              failure.response.status === 408)
          ) {
            await checkPayment(qrBill, storageKey);
            return;
          }
          if (isAxiosError(failure) && failure.response)
            sessionStorage.removeItem(storageKey);
          throw failure;
        }
        return;
      }
      if (mode === "transfer") {
        if (!transferReview) {
          if (transferScannerOpen)
            throw new Error("Hãy đọc mã QR hoặc đóng trình quét trước khi tiếp tục.");
          if (!recipient || resolving || resolvedTarget !== target.trim())
            throw new Error("Vui lòng xác minh người nhận bằng email, mã ví hoặc QR nhận tiền.");
          if (!transferNote.trim() && !profile.data)
            throw new Error("Chưa tải được tên người gửi. Vui lòng thử lại.");
          const source = wallets.data!.find((w) => w.id === selected?.id)!;
          const senderName = (
            profile.data?.full_name?.trim() || "Người dùng CapitalFlow"
          )
            .slice(0, 188)
            .replace(/[\uD800-\uDBFF]$/, "");
          setTransferReview({
            source,
            recipient,
            amount,
            note: transferNote.trim() || `${senderName} chuyển tiền`,
          });
          return;
        }
        if (
          transferReview.source.id !== selected?.id ||
          transferReview.recipient.id === selected?.id
        )
          throw new Error("Vui lòng kiểm tra lại ví gửi và ví nhận.");
        await api.post(`${root}/transfers/create`, {
          to_wallet_id: transferReview.recipient.id,
          amount: transferReview.amount,
          note: transferReview.note,
        });
      }
      if (mode === "link") {
        const accountNumber = normalizeDemoAccountNumber(number);
        const demo = providers.data?.[provider];
        if (!demo)
          throw new Error("Chưa tải được ngân hàng. Vui lòng thử lại.");
        if (accountNumber !== demo.demo_number)
          throw new Error(
            `Hãy dùng số tài khoản được cấp riêng ${demo.demo_number} của ${demo.name}.`,
          );
        const currentBanks = await banks.refetch();
        if (currentBanks.isError || !currentBanks.data)
          throw new Error(
            "Chưa kiểm tra được liên kết ngân hàng. Vui lòng thử lại.",
          );
        if (
          currentBanks.data.some(
            (bank) => bank.provider === provider && bank.status === "CONNECTED",
          )
        )
          throw new Error(
            "Tài khoản ngân hàng này đã được liên kết và có thể dùng cho tất cả ví của bạn.",
          );
        setNumber(accountNumber);
        if (!challenge || resendCode) {
          if (Date.now() < resendAvailableAt)
            throw new Error(
              "Vui lòng chờ hết thời gian đếm ngược trước khi gửi lại mã.",
            );
          const { data } = await api.post("/wallets/banks/send-otp", {
            provider,
            account_number: accountNumber,
          });
          setChallenge(data.otp_request_id);
          setOtp("");
          startResendCountdown(data.resend_after_seconds ?? 120);
          return;
        }
        await api.post("/wallets/banks", {
          provider,
          account_number: accountNumber,
          otp,
          otp_request_id: challenge,
        });
      }
      await refresh();
      closeWalletDialog();
      setNotice("Đã hoàn tất thao tác.");
    } catch (e) {
      if (mode === "link" && isAxiosError(e) && e.response?.status === 429) {
        const retryAfter = Number(e.response.headers["retry-after"]);
        startResendCountdown(
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 120,
        );
      }
      setError(
        e instanceof Error && !("response" in e) ? e.message : errorMessage(e),
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const titles: Record<string, string> = {
    receive: "QR nhận tiền",
    create: "Tạo ví mới",
    rename: "Đổi tên ví",
    archive: "Đóng ví",
    topup: "Nạp tiền",
    withdraw: "Rút tiền",
    transfer: "Chuyển tiền",
    link: "Liên kết ngân hàng",
    pay: "Thanh toán hóa đơn",
  };
  const current = wallets.data?.find((w) => w.id === selected?.id) || selected;
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
  const visibleWallets = wallets.data?.filter((w) =>
    showClosed ? !w.is_active : w.is_active,
  );
  const activeWallets = wallets.data?.filter((w) => w.is_active) || [];
  const defaultSourceWallet =
    activeWallets.find((w) => w.is_default) || activeWallets[0] || null;
  const selectSourceWallet = (wallet: Wallet) => {
    if (busy || wallet.id === current?.id) return;
    setSelected(wallet);
    setError("");
    setRecipient(null);
    setResolvedTarget("");
    setTransferReview(null);
    setResolving(false);
    setRecipientError("");
    if (
      recipient?.id === wallet.id ||
      target === wallet.id ||
      target === wallet.receive_code
    )
      setTarget("");
  };
  return (
    <div className={`cf-stack ${styles.workspace}`}>
      <PageHead
        eyebrow="VÍ CỦA TÔI"
        title="Ví cá nhân"
        description="Nạp, rút, chuyển tiền và thanh toán hóa đơn. Theo dõi số dư, quản lý ví cá nhân."
      />

      <div className={styles.walletContent}>
        <div className={styles.workspaceToolbar}>
          <div
            className={styles.walletTabs}
            role="tablist"
            aria-label="Bộ lọc trạng thái ví"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!showClosed}
              onClick={() => setShowClosed(false)}
            >
              {" "}
              Ví đang dùng
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showClosed}
              onClick={() => setShowClosed(true)}
            >
              {" "}
              Ví đã đóng
            </button>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.headerBtn}
              onClick={() => open("topup", defaultSourceWallet)}
            >
              <ArrowDownUp size={15} />
              <span>Nạp / Rút</span>
            </button>
            <button
              type="button"
              className={styles.headerBtn}
              onClick={() => open("transfer", defaultSourceWallet)}
            >
              <ArrowLeftRight size={15} className={styles.iconTransfer} />
              <span>Chuyển tiền</span>
            </button>
            <button
              type="button"
              className={`${styles.headerBtn} ${styles.headerBtnPrimary} ${styles.scanAction}`}
              onClick={() => open("scan", defaultSourceWallet)}
            >
              <ScanLine size={15} />
              <span>Quét QR</span>
            </button>
            <button
              type="button"
              className={styles.headerBtn}
              onClick={() => open("demo_checkout")}
            >
              <ReceiptText size={15} className={styles.iconInvoice} />
              <span>Tạo hóa đơn</span>
            </button>
          </div>
        </div>
        {notice && (
          <Alert kind="success" onDismiss={() => setNotice("")}>
            {notice}
          </Alert>
        )}
        {wallets.isPending ? (
          <Loading />
        ) : wallets.isError ? (
          <ErrorState retry={() => wallets.refetch()} />
        ) : !visibleWallets?.length ? (
          !showClosed ? (
            <div className={styles.walletGrid}>
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
                <span className={styles.addWalletSubtitle}>
                  Tạo ví bằng tên bạn muốn. Số dư ban đầu luôn là 0đ.
                </span>
              </button>
            </div>
          ) : (
            <Empty
              title="Chưa có ví đã đóng"
              description="Lịch sử của ví đã đóng vẫn được lưu để tra cứu."
            />
          )
        ) : (
          <div className={styles.walletGrid}>
            {visibleWallets.map((wallet) => (
              <Panel key={wallet.id} className="cf-wallet-card">
                <div className={`cf-panel-body ${styles.cardBody}`}>
                  <div className="cf-row cf-between">
                    <span className="cf-icon">
                      <WalletIcon />
                    </span>
                    <span className="cf-badge">
                      {wallet.is_default
                        ? "Ví mặc định"
                        : wallet.is_active
                          ? "Ví cá nhân"
                          : "Đã đóng"}
                    </span>
                  </div>
                  <h2 className={styles.cardName}>{wallet.name}</h2>
                  <div className={styles.cardSummary}>
                    <span className={styles.label}>Số dư hiện tại</span>
                    <div className={`cf-number ${styles.walletBalance}`}>
                      {money(wallet.balance)}
                    </div>
                  </div>
                  <div className={styles.cardFooter}>
                    <div
                      className="cf-row"
                      style={{ justifyContent: "flex-end" }}
                    >
                      <div className="cf-row">
                        <button
                          type="button"
                          className="cf-icon-btn"
                          aria-label={`Lịch sử ${wallet.name}`}
                          onClick={() => setHistoryWallet(wallet)}
                        >
                          <History size={16} />
                        </button>
                        {wallet.is_active && (
                          <button
                            type="button"
                            className="cf-icon-btn"
                            aria-label={`QR nhận tiền ${wallet.name}`}
                            onClick={() => open("receive", wallet)}
                          >
                            <QrCode size={16} />
                          </button>
                        )}
                        {wallet.is_active && (
                          <>
                            <button
                              type="button"
                              className="cf-icon-btn"
                              aria-label={`Đổi tên ${wallet.name}`}
                              onClick={() => open("rename", wallet)}
                            >
                              <Pencil size={16} />
                            </button>
                            {!wallet.is_default && (
                              <button
                                type="button"
                                className="cf-icon-btn"
                                aria-label={`Đóng ví ${wallet.name}`}
                                onClick={() => open("archive", wallet)}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            ))}
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
                <span className={styles.addWalletSubtitle}>
                  Thêm ví để quản lý riêng dòng tiền
                </span>
              </button>
            )}
          </div>
        )}
      </div>
      {["topup", "withdraw"].includes(mode) && (
        <TopupWithdrawModal
          activeTab={bankMoneyTab}
          onTabChange={(tab) => {
            setMode(tab);
            setError("");
          }}
          currentWallet={current || null}
          wallets={activeWallets}
          onSelectWallet={(w) => setSelected(w)}
          banks={banks.data}
          banksLoading={banks.isPending}
          banksError={banks.isError}
          onRetryBanks={() => banks.refetch()}
          selectedBankId={linkId}
          onSelectBankId={(id) => setLinkId(id)}
          onOpenBankManagement={() => {
            bankReturnTab.current = bankMoneyTab;
            setError("");
            setMode("banks");
          }}
          onOpenLinkBank={() => openBankLink(bankMoneyTab)}
          amount={amount}
          onAmountChange={(val) => setAmount(val)}
          busy={busy}
          error={error}
          onDismissError={() => setError("")}
          onSubmit={submit}
          onClose={() => setMode("")}
        />
      )}
      {historyWallet && (
        <WalletHistoryDialog
          key={historyWallet.id}
          wallet={historyWallet}
          onClose={() => setHistoryWallet(null)}
        />
      )}
      {mode === "banks" && (
        <BankLinksDialog
          banks={banks.data}
          loading={banks.isPending}
          failed={banks.isError}
          onRetry={() => void banks.refetch()}
          onLink={() => openBankLink("banks")}
          onClose={() => setMode(bankReturnTab.current)}
          onChanged={() =>
            cache.invalidateQueries({ queryKey: ["wallet-banks"] })
          }
        />
      )}
      {mode === "scan" && (
        <Modal
          title="Quét QR hóa đơn"
          className={dialogStyles.compact}
          onClose={() => setMode("")}
        >
          <WalletQrScanner kind="bill" onRead={readBill} />
        </Modal>
      )}
      {mode === "demo_checkout" && (
        <MockInvoiceModal onClose={() => setMode("")} />
      )}
      {receipt && (
        <Modal
          title="Thanh toán thành công"
          className={`${dialogStyles.dialog} ${qrStyles.paymentDialog}`}
          onClose={() => setReceipt(null)}
        >
          <div className={dialogStyles.fields}>
            <BillReceipt
              bill={receipt.bill}
              displayedAt={receipt.displayedAt}
              status="paid"
            />
          </div>
          <div className={dialogStyles.actions}>
            <Link
              className="cf-btn"
              href="/transactions"
              onClick={() => setReceipt(null)}
            >
              Xem lịch sử giao dịch
            </Link>
            <button
              type="button"
              className="cf-btn cf-btn-primary"
              onClick={() => setReceipt(null)}
            >
              Hoàn tất
            </button>
          </div>
        </Modal>
      )}
      {mode &&
        !["topup", "withdraw", "scan", "demo_checkout", "banks"].includes(
          mode,
        ) && (
          <Modal
            className={`${dialogStyles.dialog} ${mode === "pay" ? qrStyles.paymentDialog : ""} ${["create", "rename", "archive", "receive"].includes(mode) ? dialogStyles.compact : ""}`}
            title={
              mode === "transfer" && transferReview
                ? "Kiểm tra thông tin chuyển tiền"
                : titles[mode]
            }
            onClose={closeWalletDialog}
            busy={busy}
          >
            <form
              className={dialogStyles.form}
              onSubmit={submit}
              aria-busy={busy}
            >
              <div className={dialogStyles.fields}>
                {mode === "pay" && paymentPending && busy && (
                  <p role="status">Đang kiểm tra kết quả thanh toán…</p>
                )}
                {error && (
                  <Alert persistent onDismiss={() => setError("")}>
                    {error}
                  </Alert>
                )}

                {((mode === "transfer" && !transferReview) ||
                  mode === "pay") && (
                  <section className={modalStyles.section}>
                    <div className={modalStyles.sectionHeader}>
                      <h3 className={modalStyles.sectionTitle}>
                        {mode === "transfer"
                          ? "Chuyển tiền từ ví"
                          : "Thanh toán từ ví"}
                      </h3>
                      <span className={modalStyles.sectionSubtitle}>
                        Chọn ví trích tiền
                      </span>
                    </div>
                    <WalletCards
                      wallets={activeWallets}
                      selectedId={current?.id}
                      onSelect={selectSourceWallet}
                      label="Ví trích tiền"
                      disabled={busy || (mode === "pay" && paymentPending)}
                    />
                    {!activeWallets.length && (
                      <p>Chưa có ví đang hoạt động để trích tiền.</p>
                    )}
                  </section>
                )}

                {mode === "receive" &&
                  (receive.isPending ? (
                    <Loading />
                  ) : receive.isError ? (
                    <ErrorState retry={() => receive.refetch()} />
                  ) : (
                    receive.data && (
                      <div className={dialogStyles.qrContent}>
                        <div className={dialogStyles.qrIdentity}>
                          <strong>
                            {receive.data.recipient_name ||
                              "Tài khoản CapitalFlow"}
                          </strong>
                          <p>{receive.data.wallet_name}</p>
                        </div>
                        {/* QR SVG generated by our API must retain its exact modules and quiet zone. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={receive.data.qr_image_data_url}
                          alt={`QR nhận tiền vào ${receive.data.wallet_name}`}
                          width={224}
                          height={224}
                          className={dialogStyles.qrImage}
                        />
                        <div
                          className={`${styles.receiveCodeBox} ${styles.qrReceiveCode} ${dialogStyles.qrCode}`}
                        >
                          <span className={styles.receiveCodeText}>
                            {receive.data.receive_code}
                          </span>
                          <button
                            type="button"
                            className={styles.copyCodeBtn}
                            disabled={!receive.data.receive_code}
                            aria-label="Sao chép mã nhận tiền"
                            title={
                              copied ? "Đã sao chép!" : "Sao chép mã nhận tiền"
                            }
                            onClick={copyReceiveCode}
                          >
                            {copied ? (
                              <Check
                                size={16}
                                className={styles.copySuccessIcon}
                              />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                        </div>
                        <p className={dialogStyles.qrDescription}>
                          {" "}
                          QR này nhận tiền vào đúng ví trên. Người gửi cần kiểm
                          tra tên người nhận và xác nhận số tiền.{" "}
                        </p>
                      </div>
                    )
                  ))}
                {(mode === "create" || mode === "rename") && (
                  <Field label="Tên ví">
                    <input
                      className="cf-input"
                      required
                      maxLength={150}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                )}
                {mode === "create" && (
                  <p>
                    {" "}
                    Ví bắt đầu với 0đ. Nạp tiền từ ngân hàng hoặc nhận tiền từ
                    ví khác để sử dụng.{" "}
                  </p>
                )}
                {mode === "archive" && (
                  <p>
                    Chỉ đóng được ví có số dư 0đ. Lịch sử vẫn xem được trong mục
                    Ví đã đóng. Bạn không thể khôi phục ví này; ví sẽ không thể
                    nạp, rút, nhận hoặc chuyển tiền. Nếu cần sử dụng lại, hãy
                    tạo ví mới với mã ví mới.
                  </p>
                )}
                {mode === "pay" && qrBill && (
                  <BillReceipt bill={qrBill} displayedAt={billDisplayedAt} />
                )}
                {mode === "transfer" && !transferReview && (
                  <>
                    <div className="cf-field">
                      <label htmlFor={recipientInputId}>Chuyển tiền đến ví</label>
                      <div className={dialogStyles.recipientInput}>
                        <input
                          id={recipientInputId}
                          className="cf-input"
                          placeholder="Nhập email hoặc mã người nhận"
                          required
                          maxLength={512}
                          disabled={busy || transferScannerOpen}
                          value={target.trim().startsWith(transferQrPrefix)
                            ? recipient?.receive_code ?? ""
                            : target}
                          onChange={(e) => changeTarget(e.target.value)}
                        />
                        <button
                          ref={transferScannerButton}
                          type="button"
                          className={`cf-icon-btn ${dialogStyles.scanButton}`}
                          aria-label={transferScannerOpen ? "Đóng camera quét QR" : "Quét QR nhận tiền"}
                          title={transferScannerOpen ? "Đóng camera quét QR" : "Quét QR nhận tiền"}
                          aria-expanded={transferScannerOpen}
                          aria-controls="wallet-transfer-qr"
                          disabled={busy}
                          onClick={() => setTransferScannerOpen(!transferScannerOpen)}
                        >
                          <ScanLine size={20} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div id="wallet-transfer-qr" hidden={!transferScannerOpen}>
                      {transferScannerOpen && <WalletQrScanner kind="transfer" onRead={readTransferQr} />}
                    </div>
                    <div
                      className={dialogStyles.recipientStatus}
                      aria-live="polite"
                      hidden={transferScannerOpen}
                    >
                      {resolving && <small>Đang tìm người nhận…</small>}
                      {!resolving &&
                        recipient &&
                        resolvedTarget === target.trim() && (
                          <p className={modalStyles.recipientName}>
                            Người nhận:{" "}
                            <strong>{recipient.recipient_name}</strong>
                          </p>
                        )}
                      {recipientError && (
                        <small className={modalStyles.amountError}>
                          {recipientError}
                        </small>
                      )}
                    </div>
                  </>
                )}
                {mode === "transfer" && !transferReview && (
                  <>
                    <AmountInput
                      amount={amount}
                      disabled={busy}
                      onAmountChange={(val) => {
                        setAmount(val);
                      }}
                      maxBalance={Number(current?.balance || 0)}
                      showAllBalanceChip={true}
                      errorText="Số dư ví không đủ hoặc vượt giới hạn"
                    />
                    <Field label="Nội dung chuyển tiền">
                      <textarea
                        className="cf-input"
                        aria-label="Nội dung chuyển tiền"
                        rows={3}
                        style={{ resize: "vertical" }}
                        maxLength={200}
                        disabled={busy}
                        value={transferNote}
                        onChange={(e) => setTransferNote(e.target.value)}
                        placeholder="Nhập nội dung chuyển tiền (không bắt buộc)"
                      />
                      <small>{transferNote.length}/200 ký tự</small>
                    </Field>
                  </>
                )}
                {mode === "transfer" && transferReview && (
                  <>
                    <dl className={dialogStyles.summary}>
                      <div>
                        <dt>Ví gửi</dt>
                        <dd>{transferReview.source.name}</dd>
                      </div>
                      <div>
                        <dt>Tên người nhận</dt>
                        <dd>{transferReview.recipient.recipient_name}</dd>
                      </div>
                      <div>
                        <dt>Mã ví / email người nhận</dt>
                        <dd>{transferReview.recipient.receive_code}</dd>
                      </div>
                      <div>
                        <dt>Số tiền</dt>
                        <dd className={dialogStyles.summaryAmount}>
                          {money(transferReview.amount)}
                        </dd>
                      </div>
                      <div>
                        <dt>Nội dung</dt>
                        <dd>{transferReview.note}</dd>
                      </div>
                    </dl>
                  </>
                )}
                {mode === "link" && (
                  <>
                    <p>
                      Liên kết một lần để nạp/rút cho tất cả ví của bạn, kể cả
                      ví tạo sau này. OTP xác nhận liên kết được gửi qua email.
                    </p>
                    {providers.isError && (
                      <ErrorState retry={() => providers.refetch()} />
                    )}
                    {banks.isPending && <Loading />}
                    {banks.isError && (
                      <ErrorState retry={() => banks.refetch()} />
                    )}
                    {bankAlreadyLinked && (
                      <Alert kind="info">
                        Tài khoản ngân hàng này đã được liên kết và có thể dùng
                        cho tất cả ví của bạn. Vui lòng chọn ngân hàng khác.
                      </Alert>
                    )}
                    <Field label="Ngân hàng">
                      <select
                        className="cf-input"
                        required
                        value={provider}
                        disabled={busy}
                        onChange={(e) => {
                          setProvider(e.target.value);
                          setChallenge("");
                          setOtp("");
                          setNumber("");
                          setError("");
                        }}
                      >
                        {Object.entries(providers.data || {}).map(([id, p]) => (
                          <option key={id} value={id}>
                            {p.name}
                            {connectedProviders.has(id) ? " — Đã liên kết" : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Số tài khoản ngân hàng">
                      <input
                        className="cf-input"
                        inputMode="numeric"
                        autoComplete="off"
                        required
                        value={number}
                        disabled={busy || bankAlreadyLinked}
                        onChange={(e) => {
                          setNumber(normalizeDemoAccountNumber(e.target.value));
                          setChallenge("");
                          setOtp("");
                          setError("");
                        }}
                      />
                    </Field>
                    <small>
                      Tài khoản cấp riêng cho bạn:{" "}
                      {providers.data?.[provider]?.demo_number}
                    </small>

                    {challenge && !bankAlreadyLinked && (
                      <>
                        <Field label="OTP email">
                          <input
                            className="cf-input"
                            autoComplete="one-time-code"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            required
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                          />
                        </Field>
                        <button
                          type="button"
                          className="cf-btn"
                          disabled={busy || resendSeconds > 0}
                          onClick={(event) => void submit(event, true)}
                        >
                          {resendSeconds > 0
                            ? `Gửi lại mã sau ${resendSeconds}s`
                            : "Gửi lại mã"}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
              <div
                className={`${dialogStyles.actions} ${mode === "pay" ? qrStyles.confirmActions : ""}`}
              >
                {mode === "receive" ? (
                  receive.data && (
                    <a
                      className="cf-btn"
                      href={receive.data.qr_image_data_url}
                      download={`capitalflow-${receive.data.wallet_id}.svg`}
                    >
                      Tải QR
                    </a>
                  )
                ) : (
                  <>
                    <button
                      className="cf-btn"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (mode === "transfer" && transferReview) {
                          setTransferReview(null);
                          setError("");
                        } else closeWalletDialog();
                      }}
                    >
                      {mode === "transfer" && transferReview
                        ? "Sửa thông tin"
                        : "Hủy"}
                    </button>
                    <button
                      className="cf-btn cf-btn-primary"
                      disabled={
                        busy ||
                        (mode === "pay" &&
                          (!qrBill ||
                            (!paymentPending && !current?.is_active))) ||
                        (mode === "link" &&
                          (!providers.data ||
                            banks.isPending ||
                            banks.isError ||
                            bankAlreadyLinked ||
                            (!challenge && resendSeconds > 0))) ||
                        (mode === "transfer" &&
                          !transferReview &&
                          (transferScannerOpen ||
                            resolving ||
                            !recipient ||
                            resolvedTarget !== target.trim()))
                      }
                    >
                      {busy
                        ? mode === "pay" && paymentPending
                          ? "Đang kiểm tra…"
                          : "Đang xử lý…"
                        : mode === "pay"
                          ? paymentPending
                            ? "Kiểm tra lại kết quả"
                            : "Xác nhận thanh toán"
                          : mode === "link" && !challenge
                            ? resendSeconds > 0
                              ? `Gửi OTP sau ${resendSeconds}s`
                              : "Gửi OTP"
                            : mode === "transfer"
                              ? transferReview
                                ? "Xác nhận chuyển tiền"
                                : "Chuyển tiền"
                              : "Xác nhận"}
                    </button>
                  </>
                )}
              </div>
            </form>
          </Modal>
        )}
    </div>
  );
}
