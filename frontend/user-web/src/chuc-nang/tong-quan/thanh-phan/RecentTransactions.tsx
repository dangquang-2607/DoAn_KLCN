/**
 * ============================================================================
 * TÊN FILE: RecentTransactions.tsx
 * MÀN HÌNH / PHÂN HỆ: Tổng quan tài chính
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Hiển thị danh sách giao dịch gần nhất trên dashboard.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất RecentTransactions để route hoặc component khác sử dụng.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự thay đổi dữ liệu tài chính; giữ hành vi runtime và khả năng truy cập hiện có.
 * ============================================================================
 */
/** Năm giao dịch gần nhất trong thẻ hoạt động của dashboard. */
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import { dateLabel, money } from "@/dung-chung/tien-ich/finance";
import { type Transaction } from "@/dung-chung/nghiep-vu/finance";
import styles from "../CSS/overview.module.css";

export default function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <section className={`${styles.panel} ${styles.overviewCard} ${styles.activityPanel}`}>
      <header className={styles.overviewCardHead}><div><span className={styles.overline}>HOẠT ĐỘNG GẦN ĐÂY</span><h2>Vừa ghi nhận</h2><p>5 giao dịch mới nhất của bạn</p></div><Link href="/transactions">Xem tất cả →</Link></header>
      {!transactions.length ? (
        <div className={styles.overviewEmpty}>Chưa có giao dịch nào. <Link href="/transactions?new=1">Ghi nhận giao dịch đầu tiên →</Link></div>
      ) : (
        <div className={styles.activityList}>{transactions.map((transaction) => {
          const transfer = transaction.kind === "TRANSFER";
          const income = transaction.type === "INCOME";
          const iconClass = transfer ? styles.activityIconTransfer : income ? styles.activityIconIncome : styles.activityIconExpense;
          const amountClass = transfer ? "" : income ? styles.amountIncome : styles.amountExpense;
          return <div className={styles.activityRow} key={transaction.id}>
            <span className={`${styles.activityIcon} ${iconClass}`} aria-hidden="true">{transfer ? <ArrowLeftRight size={18} /> : income ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span>
            <span className={styles.activityInfo}><strong>{transaction.description || "Giao dịch"}</strong><small>{transfer ? "Chuyển tiền" : income ? "Thu nhập" : "Chi tiêu"} · {dateLabel(transaction.transaction_date)}</small></span>
            <span className={`${styles.activityAmount} ${amountClass}`}>{Number(transaction.amount) > 0 ? "+" : ""}{money(transaction.amount)}</span>
          </div>;
        })}</div>
      )}
    </section>
  );
}
