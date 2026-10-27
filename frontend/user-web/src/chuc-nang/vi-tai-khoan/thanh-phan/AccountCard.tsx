/**
 * ============================================================================
 * TÊN FILE: AccountCard.tsx
 * MÀN HÌNH / PHÂN HỆ: Quản lý Ví & Tài khoản
 * NHÓM VỆ TINH: thanh-phan (Thành phần giao diện con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị thẻ tóm tắt thông tin ví/tài khoản: nhận diện loại ví, số dư hiện tại,
 *   trạng thái mặc định và các nút thao tác nhanh (xem chi tiết, chỉnh sửa, xóa).
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Đối tượng Account, các hàm callback (onDetails, onEdit, onDelete).
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Default export AccountCard component.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Định dạng chuẩn tiền tệ VND; che dấu các thông tin nhạy cảm ở màn hình thu gọn.
 * ============================================================================
 */
/** Thẻ ví gọn: nhận diện, số dư và các thao tác nhanh; dữ liệu dài nằm trong modal chi tiết. */
import Link from "next/link";
import { ArrowRight, Eye, Pencil, Trash2, Wallet } from "lucide-react";
import { Panel } from "@/dung-chung/UI-chung/ui";
import { accountTypes, type Account } from "@/dung-chung/nghiep-vu/finance";
import { money } from "@/dung-chung/tien-ich/finance";
import styles from "./AccountCard.module.css";

/**
 * Thẻ giao diện hiển thị thông tin tổng quan và thao tác nhanh cho một ví tài khoản.
 */
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
          <div className="cf-number" style={{ fontSize: "clamp(22px, 2vw, 30px)", fontWeight: 650, margin: "4px 0 0", overflowWrap: "anywhere" }}>
            {account.balance_available === false ? "Chưa có dữ liệu số dư" : money(account.balance, account.currency)}
          </div>
        </div>
        {isLinked && <p className={styles.cardSubtitle}>
          {account.bank_last_sync ? `Cập nhật thành công lần cuối: ${new Date(account.bank_last_sync + "Z").toLocaleString("vi-VN")}` : "Chưa đồng bộ số dư"}
        </p>}
        {account.bank_sync_error && <p role="status">{account.bank_sync_error}</p>}
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
