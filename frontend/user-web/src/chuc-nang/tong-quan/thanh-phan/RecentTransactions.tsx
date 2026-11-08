/** Năm giao dịch gần nhất trong thẻ hoạt động của dashboard. */
import CardAction from "./CardAction";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import { dateLabel, money, transactionListDescription } from "@/dung-chung/tien-ich/finance";
import { type Transaction } from "@/dung-chung/nghiep-vu/finance";
import styles from "../CSS/overview.module.css";

export type RecentTransaction = Pick<
  Transaction,
  "id" | "description" | "wallet_entry_id" | "kind" | "type" | "amount" | "transaction_date"
>;

export default function RecentTransactions({
  transactions,
}: {
  transactions: RecentTransaction[];
}) {
  return (
    <section
      className={`${styles.panel} ${styles.monthlyCard} ${styles.activityPanel}`}
    >
      <header className={styles.overviewCardHead}>
        <div>
          <h2>Giao dịch gần đây</h2>
          <p>5 giao dịch mới nhất</p>
        </div>
        <CardAction href="/transactions">Xem tất cả</CardAction>
      </header>
      {!transactions.length ? (
        <div className={styles.overviewEmpty}>
          Chưa có giao dịch nào.{" "}
          <CardAction href="/transactions?new=1">Ghi nhận giao dịch đầu tiên</CardAction>
        </div>
      ) : (
        <div className={styles.activityList}>
          {transactions.map((transaction) => {
            const description = transactionListDescription(transaction);
            const transfer = transaction.kind === "TRANSFER";
            const income = transaction.type === "INCOME";
            const iconClass = transfer
              ? styles.activityIconTransfer
              : income
                ? styles.activityIconIncome
                : styles.activityIconExpense;
            const amountClass = transfer
              ? ""
              : income
                ? styles.amountIncome
                : styles.amountExpense;
            return (
              <div className={styles.activityRow} key={transaction.id}>
                <span
                  className={`${styles.activityIcon} ${iconClass}`}
                  aria-hidden="true"
                >
                  {transfer ? (
                    <ArrowLeftRight size={18} />
                  ) : income ? (
                    <ArrowDownLeft size={18} />
                  ) : (
                    <ArrowUpRight size={18} />
                  )}
                </span>
                <span className={styles.activityInfo}>
                  <strong title={description !== transaction.description ? transaction.description : undefined}>{description || "Giao dịch"}</strong>
                  <small>
                    {transfer
                      ? "Chuyển tiền"
                      : income
                        ? "Thu nhập"
                        : "Chi tiêu"}{" "}
                    · {dateLabel(transaction.transaction_date)}
                  </small>
                </span>
                <span className={`${styles.activityAmount} ${amountClass}`}>
                  {Number(transaction.amount) > 0 ? "+" : ""}
                  {money(transaction.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
