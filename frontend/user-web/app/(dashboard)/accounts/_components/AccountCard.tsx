/**
 * ============================================================================
 * TÊN FILE: AccountCard.tsx
 * MÀN HÌNH / PHÂN HỆ: Ví & tài khoản
 * NHÓM VỆ TINH: _components (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị thông tin, số dư và thao tác của một tài khoản.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất AccountCard để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Bảo toàn số dư và lịch sử; không cho ngừng tài khoản khi số dư khác 0.
 * ============================================================================
 */
import Link from "next/link";
import { ArrowRight, Pencil, Trash2, Wallet } from "lucide-react";
import { Panel } from "@/components/ui/ui";
import { accountTypes, money, type Account } from "@/lib/finance";
import { accountStyles } from "../_styles/accounts.styles";

/** Thẻ hiển thị số dư và các thao tác trực tiếp của một ví/tài khoản. */
export default function AccountCard({
  account,
  onEdit,
  onDelete,
}: {
  account: Account;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  return (
    <Panel className="cf-wallet-card">
      <div className="cf-panel-body">
        <div className="cf-row cf-between">
          <span className="cf-icon"><Wallet /></span>
          <span className="cf-badge">
            {accountTypes[account.account_type] || account.account_type}
          </span>
        </div>
        <h2 style={{ margin: "24px 0 4px", fontSize: 19 }}>{account.name}</h2>
        <p className="cf-muted" style={{ fontSize: 13 }}>
          {account.institution_name || "Tài khoản theo dõi thủ công"}
        </p>
        <div className="cf-number" style={accountStyles.balance}>
          {money(account.balance, account.currency)}
        </div>
        <div className="cf-row cf-between">
          <Link href={`/transactions?account_id=${account.id}`} className="cf-inline-link">
            Giao dịch <ArrowRight size={14} style={{ display: "inline" }} />
          </Link>
          <div className="cf-row">
            <button className="cf-icon-btn" aria-label={`Sửa ${account.name}`} onClick={() => onEdit(account)}>
              <Pencil size={16} />
            </button>
            <button className="cf-icon-btn" aria-label={`Ngừng sử dụng ${account.name}`} onClick={() => onDelete(account)}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
