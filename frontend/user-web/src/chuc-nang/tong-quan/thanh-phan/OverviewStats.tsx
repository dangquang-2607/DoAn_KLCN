import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { dateLabel, money } from "@/dung-chung/tien-ich/finance";
import { type Account, type Transaction } from "@/dung-chung/nghiep-vu/finance";
import { monthlyTotals, type MonthlyTrend } from "../monthlyTrend";
import AccountsWidget from "./AccountsWidget";
import styles from "../CSS/overview.module.css";

export interface OverviewData {
  net_worth: number | string;
  recent_transactions: Transaction[];
}

export default function OverviewStats({ data, report, reportState, accountsQuery }: {
  data: OverviewData;
  report?: MonthlyTrend;
  reportState?: ReactNode;
  accountsQuery: UseQueryResult<Account[]>;
}) {
  return (
    <div className={styles.topCards}>
      <section className={styles.balance}>
        <div className={styles.balanceTop}>
          <h2>Số dư ví</h2>
          <Wallet size={19} aria-hidden="true" />
        </div>
        <strong>{money(data.net_worth)}</strong>
        <AccountsWidget query={accountsQuery} />
      </section>
      <MonthlySummary report={report} state={reportState} />
    </div>
  );
}

export function MonthlySummary({ report, state }: { report?: MonthlyTrend; state?: ReactNode }) {
  const summary = report && monthlyTotals(report);
  return (
      <section className={styles.summaryCard}>
        <header className={styles.summaryHead}>
          <h2>{report ? `Thu chi tháng ${Number(report.through.slice(5, 7))}/${report.through.slice(0, 4)}` : "Thu chi tháng này"}</h2>
          {report && summary && <p>Từ {dateLabel(summary.start)} đến {dateLabel(report.through)}</p>}
        </header>
        {state ?? (summary && (
          <dl className={styles.overallMetrics}>
            <div><dt>Tổng thu</dt><dd className={styles.metricIncome}>{money(summary.income)}</dd></div>
            <div><dt>Tổng chi</dt><dd>{money(summary.expense)}</dd></div>
            <div><dt>Chênh lệch thu chi</dt><dd className={summary.net < 0 ? styles.negative : ""}>{money(summary.net)}</dd></div>
          </dl>
        ))}
      </section>
  );
}
