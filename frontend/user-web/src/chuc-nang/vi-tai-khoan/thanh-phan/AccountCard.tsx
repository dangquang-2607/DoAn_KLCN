/** Thẻ ví gọn: nhận diện, số dư và các thao tác nhanh; dữ liệu dài nằm trong modal chi tiết. */
import Link from "next/link";
import { ArrowRight, Eye, Pencil, Trash2, Wallet } from "lucide-react";
import { Panel } from "@/dung-chung/UI-chung/ui";
import { accountTypes, type Account } from "@/dung-chung/nghiep-vu/finance";
import { money } from "@/dung-chung/tien-ich/finance";
import { accountStyles } from "../CSS/accounts.styles";
import styles from "./AccountCard.module.css";

export default function AccountCard({ account, onDetails, onEdit, onDelete }: {
  account: Account;
  onDetails: (account: Account) => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  const isSavings = account.account_type === "SAVINGS";
  const isLinked = ["LINKED", "BANK", "E_WALLET"].includes(account.account_type);

  return (
    <Panel className="cf-wallet-card">
      <div className={`cf-panel-body ${styles.cardBody}`}>
        <div className="cf-row cf-between">
          <span className="cf-icon"><Wallet /></span>
          <span className="cf-badge">{accountTypes[account.account_type] || account.account_type}</span>
        </div>
        <h2 className={styles.cardName}>{account.name}</h2>
        {isLinked && account.institution_name && <p className={styles.cardSubtitle}>{account.institution_name}</p>}
        <div className={styles.cardSummary}>
          <span className={styles.label}>{isSavings ? "Đã tiết kiệm" : "Số dư hiện tại"}</span>
          <div className="cf-number" style={accountStyles.balance}>
            {money(account.balance, account.currency)}
          </div>
        </div>
        <div className={styles.cardFooter}>
          <div className="cf-row cf-between">
            <Link href={`/transactions?account_id=${account.id}`} className="cf-inline-link">
              Giao dịch <ArrowRight size={14} style={{ display: "inline" }} />
            </Link>
            <div className="cf-row">
              <button type="button" className="cf-icon-btn" aria-label={`Xem chi tiết ${account.name}`} onClick={() => onDetails(account)}>
                <Eye size={16} />
              </button>
              <button type="button" className="cf-icon-btn" aria-label={`Sửa ${account.name}`} onClick={() => onEdit(account)}>
                <Pencil size={16} />
              </button>
              <button type="button" className="cf-icon-btn" aria-label={`Xóa ${account.name}`} onClick={() => onDelete(account)}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
