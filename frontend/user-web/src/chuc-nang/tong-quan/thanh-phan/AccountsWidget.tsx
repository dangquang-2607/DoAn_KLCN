/**
 * ============================================================================
 * TÊN FILE: AccountsWidget.tsx
 * MÀN HÌNH / PHÂN HỆ: Tổng quan tài chính
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Tóm tắt danh sách ví và số dư trên dashboard.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất AccountsWidget để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
/** Widget tóm tắt tối đa bốn tài khoản và giữ nguyên trạng thái query/retry. */
import Link from "next/link";
import type { UseQueryResult } from "@tanstack/react-query";
import { Banknote, Landmark, Wallet } from "lucide-react";
import { ErrorState, Loading } from "@/dung-chung/UI-chung/ui";
import { money } from "@/dung-chung/tien-ich/finance";
import { type Account } from "@/dung-chung/nghiep-vu/finance";
import styles from "../CSS/overview.module.css";

export default function AccountsWidget({ query }: { query: UseQueryResult<Account[]> }) {
  return (
    <section className={`${styles.panel} ${styles.overviewCard} ${styles.walletPanel}`}>
      <header className={styles.overviewCardHead}><div><span className={styles.overline}>NGUỒN TIỀN</span><h2>Ví & tài khoản</h2><p>Số dư ở từng nơi</p></div><Link href="/accounts">Xem tất cả →</Link></header>
      {query.isPending ? <Loading /> : query.isError ? <ErrorState retry={() => query.refetch()} /> : !query.data?.length ? (
        <div className={styles.overviewEmpty}>Chưa có ví nào. <Link href="/accounts">Thêm ví để bắt đầu →</Link></div>
      ) : <div className={styles.walletList}>{query.data.slice(0, 4).map((account) => {
        const Icon = account.account_type === "CASH" ? Banknote : ["LINKED", "BANK"].includes(account.account_type) ? Landmark : Wallet;
        return <div className={styles.walletRow} key={account.id}><span className={styles.walletIcon} aria-hidden="true"><Icon size={18} /></span><div className={styles.walletCopy}><strong>{account.name}</strong><small>{["LINKED", "BANK", "E_WALLET"].includes(account.account_type) && account.institution_name ? account.institution_name : account.currency}</small><b>{money(account.balance, account.currency)}</b></div></div>;
      })}</div>}
    </section>
  );
}
