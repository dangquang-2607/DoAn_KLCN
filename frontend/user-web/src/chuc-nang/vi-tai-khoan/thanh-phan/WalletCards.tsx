"use client";

import { Wallet as WalletIcon } from "lucide-react";
import { money } from "@/dung-chung/tien-ich/finance";
import type { Wallet } from "../WalletWorkspace";
import styles from "../CSS/TopupWithdrawModal.module.css";

export default function WalletCards({ wallets, selectedId, onSelect, label, disabled = false }: {
  wallets: Wallet[];
  selectedId?: string;
  onSelect: (wallet: Wallet) => void;
  label: string;
  disabled?: boolean;
}) {
  return <div className={styles.walletCardsRow} role="group" aria-label={label}>
    {wallets.map(wallet => <button
      type="button"
      key={wallet.id}
      className={`${styles.walletCard} ${wallet.id === selectedId ? styles.walletCardActive : ""}`}
      aria-pressed={wallet.id === selectedId}
      disabled={disabled}
      onClick={() => onSelect(wallet)}
    >
      <div className={styles.walletAvatar}><WalletIcon size={18} aria-hidden="true" /></div>
      <div className={styles.walletInfo}>
        <span className={styles.walletName} title={wallet.name}>{wallet.name}</span>
        <span className={styles.cardBalance}>{money(wallet.balance)}</span>
      </div>
    </button>)}
  </div>;
}
