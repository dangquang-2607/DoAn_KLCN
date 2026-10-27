/**
 * ============================================================================
 * TÊN FILE: TopupWithdrawModal.tsx
 * MÀN HÌNH / PHÂN HỆ: Quản lý Ví & Tài khoản
 * NHÓM VỆ TINH: thanh-phan (Hộp thoại thao tác nghiệp vụ)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp hộp thoại modal toàn diện để thực hiện nạp tiền vào ví hoặc rút tiền về
 *   tài khoản ngân hàng liên kết, đồng thời hỗ trợ quản lý danh sách tài khoản ngân hàng.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Ví hiện tại (currentWallet), danh sách ngân hàng liên kết, chế độ thao tác (TOPUP / WITHDRAW).
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export TopupWithdrawModal component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Kiểm tra số dư trước khi rút tiền; xác thực số tài khoản ngân hàng trước khi lưu liên kết.
 * ============================================================================
 */
"use client";

import { useEffect, useRef, useId, type FormEvent } from "react";
import {
  LogIn,
  LogOut,
  X,
  Wallet,
  Building2,
  Check,
  Plus,
  Loader2,
  AlertCircle
} from "lucide-react";
import { money } from "@/dung-chung/tien-ich/finance";
import { Alert, ErrorState, Loading } from "@/dung-chung/UI-chung/ui";
import type { Wallet as WalletType } from "./WalletWorkspace";
import styles from "./TopupWithdrawModal.module.css";

export type BankItem = {
  id: string;
  provider: string;
  account_number_masked: string;
  status: string;
};

const TOPUP_CHIPS = [
  { label: "50.000đ", value: "50000" },
  { label: "100.000đ", value: "100000" },
  { label: "200.000đ", value: "200000" },
  { label: "500.000đ", value: "500000" },
];

const WITHDRAW_CHIPS = [
  { label: "50.000đ", value: "50000" },
  { label: "100.000đ", value: "100000" },
  { label: "200.000đ", value: "200000" },
  { label: "500.000đ", value: "500000" },
];

/**
 * Hộp thoại modal xử lý quy trình nạp tiền, rút tiền và liên kết tài khoản ngân hàng.
 */
export default function TopupWithdrawModal({
  activeTab,
  onTabChange,
  currentWallet,
  wallets,
  onSelectWallet,
  banks,
  banksLoading,
  banksError,
  onRetryBanks,
  selectedBankId,
  onSelectBankId,
  onOpenLinkBank,
  amount,
  onAmountChange,
  busy,
  error,
  onDismissError,
  onSubmit,
  onClose,
}: {
  activeTab: "topup" | "withdraw";
  onTabChange: (tab: "topup" | "withdraw") => void;
  currentWallet: WalletType | null;
  wallets: WalletType[];
  onSelectWallet: (wallet: WalletType) => void;
  banks: BankItem[] | undefined;
  banksLoading: boolean;
  banksError: boolean;
  onRetryBanks: () => void;
  selectedBankId: string;
  onSelectBankId: (id: string) => void;
  onOpenLinkBank: () => void;
  amount: string;
  onAmountChange: (val: string) => void;
  busy: boolean;
  error: string;
  onDismissError: () => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  const dialogId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tự động chọn ngân hàng đã liên kết đầu tiên nếu chưa chọn
  useEffect(() => {
    if (!selectedBankId && banks && banks.length > 0) {
      const firstConnected = banks.find((b) => b.status === "CONNECTED");
      if (firstConnected) {
        onSelectBankId(firstConnected.id);
      }
    }
  }, [banks, selectedBankId, onSelectBankId]);

  // Xử lý phím Escape để đóng modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  // Format số tiền khi hiển thị
  const formatDisplayAmount = (val: string) => {
    if (!val) return "";
    const cleanNum = val.replace(/\D/g, "");
    if (!cleanNum) return "";
    return new Intl.NumberFormat("vi-VN").format(Number(cleanNum));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    onAmountChange(raw);
  };

  const currentBalNum = Number(currentWallet?.balance || 0);
  const enteredAmountNum = Number(amount || 0);
  const isInsufficient = activeTab === "withdraw" && enteredAmountNum > currentBalNum;
  const connectedBanks = banks?.filter((b) => b.status === "CONNECTED") || [];

  const isFormValid =
    enteredAmountNum > 0 &&
    Boolean(selectedBankId) &&
    !isInsufficient &&
    !busy;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        ref={cardRef}
      >
        {/* Header với Tabs chuyển đổi Nạp / Rút và nút đóng chuẩn CapitalFlow */}
        <div className={`cf-dialog-head ${styles.modalHead}`}>
          <div className={`cf-tabs ${styles.tabGroup}`} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "topup"}
              className={`${styles.tabBtn} ${activeTab === "topup" ? styles.tabBtnActive : ""}`}
              onClick={() => onTabChange("topup")}
            >
              <LogIn size={16} />
              <span>Nạp tiền</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "withdraw"}
              className={`${styles.tabBtn} ${activeTab === "withdraw" ? styles.tabBtnActive : ""}`}
              onClick={() => onTabChange("withdraw")}
            >
              <LogOut size={16} />
              <span>Rút tiền</span>
            </button>
          </div>

          <button
            type="button"
            className="cf-icon-btn"
            aria-label="Đóng"
            onClick={onClose}
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nội dung cửa sổ */}
        <form className={styles.modalBody} onSubmit={onSubmit}>
          {error && (
            <Alert persistent onDismiss={onDismissError}>
              {error}
            </Alert>
          )}

          {/* Phần 1: Chọn ví đích/nguồn (Nạp vào ví + tên ví / Rút từ ví + tên ví) */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle} id={dialogId}>
                {activeTab === "topup"
                  ? (currentWallet
                      ? (currentWallet.name.toLowerCase().startsWith("ví")
                          ? `Nạp vào ${currentWallet.name}`
                          : `Nạp vào ví ${currentWallet.name}`)
                      : "Nạp tiền vào ví")
                  : (currentWallet
                      ? (currentWallet.name.toLowerCase().startsWith("ví")
                          ? `Rút từ ${currentWallet.name}`
                          : `Rút từ ví ${currentWallet.name}`)
                      : "Rút tiền từ ví")}
              </h3>
              {wallets.length > 1 && (
                <span className={styles.sectionSubtitle}>
                  {activeTab === "topup" ? "Chọn ví nhận" : "Chọn ví trích tiền"}
                </span>
              )}
            </div>

            {/* Danh sách thẻ ví nằm ngang cuộn mượt */}
            <div className={styles.walletCardsRow}>
              {/* Thẻ ví người dùng đang chọn */}
              {wallets.map((w) => {
                const isSelected = w.id === currentWallet?.id;
                return (
                  <button
                    type="button"
                    key={w.id}
                    className={`${styles.walletCard} ${
                      isSelected ? styles.walletCardActive : ""
                    }`}
                    onClick={() => onSelectWallet(w)}
                  >
                    <div className={styles.walletAvatar}>
                      <Wallet size={18} />
                    </div>
                    <div className={styles.walletInfo}>
                      <span className={styles.walletName}>{w.name}</span>
                      <span className={styles.walletBalance}>{money(w.balance)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Phần 2: Nguồn tiền nạp / Rút về ngân hàng */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                {activeTab === "topup" ? "Từ nguồn tiền" : "Rút về tài khoản"}
              </h3>
              <button
                type="button"
                className={styles.linkBankBtn}
                onClick={onOpenLinkBank}
              >
                <Plus size={14} /> Thêm liên kết
              </button>
            </div>

            {banksLoading ? (
              <Loading />
            ) : banksError ? (
              <ErrorState retry={onRetryBanks} />
            ) : connectedBanks.length === 0 ? (
              <div className={styles.bankEmptyBox}>
                <Building2 size={28} color="#94a3b8" />
                <span style={{ fontSize: "13px", color: "#64748b" }}>
                  Chưa có tài khoản ngân hàng liên kết để {activeTab === "topup" ? "nạp" : "rút"} tiền.
                </span>
                <button
                  type="button"
                  className="cf-btn cf-btn-sm cf-btn-primary"
                  onClick={onOpenLinkBank}
                  style={{ marginTop: 4 }}
                >
                  Liên kết ngân hàng ngay
                </button>
              </div>
            ) : (
              <div className={styles.bankGrid}>
                {connectedBanks.map((b) => {
                  const isSelected = selectedBankId === b.id;
                  return (
                    <div
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      className={`${styles.bankCard} ${
                        isSelected ? styles.bankCardActive : ""
                      }`}
                      onClick={() => onSelectBankId(b.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          onSelectBankId(b.id);
                        }
                      }}
                    >
                      <div className={styles.bankLeft}>
                        <div className={styles.bankIconWrapper}>
                          {b.provider}
                        </div>
                        <div className={styles.bankMeta}>
                          <span className={styles.bankTitle}>{b.provider}</span>
                          <span className={styles.bankSubtitle}>
                            {b.account_number_masked}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={styles.bankBadge}>Miễn phí</span>
                        {isSelected && (
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: "#2563eb",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Check size={13} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Accessible native select để tương thích tốt với screen readers và automated tests */}
            <select
              aria-label="Ngân hàng liên kết"
              className={styles.srOnly}
              value={selectedBankId}
              onChange={(e) => onSelectBankId(e.target.value)}
            >
              <option value="">Chọn ngân hàng</option>
              {connectedBanks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.provider} · {b.account_number_masked}
                </option>
              ))}
            </select>
          </section>

          {/* Phần 3: Số tiền cần nạp / Rút */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                {activeTab === "topup" ? "Số tiền cần nạp" : "Số tiền cần rút"}
              </h3>
              {activeTab === "withdraw" && (
                <span className={styles.sectionSubtitle}>
                  Khả dụng: <strong>{money(currentWallet?.balance || 0)}</strong>
                </span>
              )}
            </div>

            <div className={styles.amountContainer}>
              <div className={styles.amountInputWrapper}>
                <input
                  ref={inputRef}
                  className={styles.amountInput}
                  aria-label="Số tiền"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatDisplayAmount(amount)}
                  onChange={handleInputChange}
                  required
                />
                <span className={styles.currencySuffix}>đ</span>
                {amount && (
                  <button
                    type="button"
                    className={styles.clearAmountBtn}
                    aria-label="Xóa số tiền"
                    onClick={() => {
                      onAmountChange("");
                      inputRef.current?.focus();
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {isInsufficient && (
                <div className={styles.amountError}>
                  <AlertCircle size={14} style={{ display: "inline", marginRight: 4 }} />
                  Số dư ví không đủ hoặc vượt giới hạn
                </div>
              )}

              {/* Dãy chip chọn nhanh số tiền */}
              <div className={styles.chipsRow}>
                {(activeTab === "topup" ? TOPUP_CHIPS : WITHDRAW_CHIPS).map((chip) => {
                  const isActive = amount === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
                      onClick={() => onAmountChange(chip.value)}
                    >
                      {chip.label}
                    </button>
                  );
                })}

                {/* Nút rút tất cả số dư nếu đang ở tab Rút tiền */}
                {activeTab === "withdraw" && currentBalNum > 0 && (
                  <button
                    type="button"
                    className={`${styles.chip} ${styles.chipSpecial} ${
                      amount === String(Math.floor(currentBalNum)) ? styles.chipActive : ""
                    }`}
                    onClick={() => onAmountChange(String(Math.floor(currentBalNum)))}
                  >
                    Tất cả số dư
                  </button>
                )}
              </div>

              <div className={styles.amountHint}>
                {activeTab === "topup"
                  ? "✓ Miễn phí giao dịch nạp tiền · Hạn mức 50.000.000đ/lần"
                  : "✓ Tiền chuyển về tài khoản ngân hàng ngay lập tức (mô phỏng)"}
              </div>
            </div>
          </section>

          {/* Phần 4: Nút Xác nhận hành động */}
          <div className={styles.submitContainer}>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!isFormValid}
              aria-label="Xác nhận"
            >
              {busy ? (
                <>
                  <Loader2 className={styles.spinner} size={18} />
                  <span>Đang xử lý…</span>
                </>
              ) : (
                <span>
                  {activeTab === "topup" ? "Nạp tiền" : "Rút tiền"}
                  {enteredAmountNum > 0
                    ? ` · ${new Intl.NumberFormat("vi-VN").format(enteredAmountNum)}đ`
                    : ""}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
