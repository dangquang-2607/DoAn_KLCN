"use client";

import { useState, type ReactNode } from "react";
import CardAction from "./CardAction";
import { CategoryIcon } from "@/dung-chung/UI-chung/CategoryIcon";
import { SPENDING_REPORT_ID } from "@/dung-chung/nghiep-vu/report";
import { Modal } from "@/dung-chung/UI-chung/ui";
import { money, percent } from "@/dung-chung/tien-ich/finance";
import {
  resolveReportPeriod,
  shiftReportPeriod,
} from "@/dung-chung/nghiep-vu/report";
import type {
  MonthlyTrend,
  SpendingCategory,
  SpendingPeriod,
} from "../monthlyTrend";
import OverviewCharts from "./OverviewCharts";
import RecentTransactions, {
  type RecentTransaction,
} from "./RecentTransactions";
import styles from "../CSS/overview.module.css";

const periods = { week: "Tuần", month: "Tháng" } as const;

function PeriodSwitch({
  value,
  onChange,
  label,
}: {
  value: SpendingPeriod;
  onChange: (value: SpendingPeriod) => void;
  label: string;
}) {
  return (
    <div className={styles.periodSwitch} role="group" aria-label={label}>
      {(["week", "month"] as const).map((period) => (
        <button
          type="button"
          key={period}
          aria-pressed={period === value}
          onClick={() => onChange(period)}
        >
          {periods[period]}
        </button>
      ))}
    </div>
  );
}

function comparisonTotals(data: MonthlyTrend, period: SpendingPeriod) {
  const start = resolveReportPeriod(
    period,
    data.through,
    "",
    "",
    data.through,
  ).start;
  const previousStart = shiftReportPeriod(period, start, -1);
  let previous = 0,
    current = 0;
  for (const day of data.days) {
    if (day.date < previousStart || day.date > data.through) continue;
    if (day.date < start) previous += day.expense;
    else current += day.expense;
  }
  return { previous, current };
}

function Comparison({
  data,
  period,
}: {
  data: MonthlyTrend;
  period: SpendingPeriod;
}) {
  const { previous, current } = comparisonTotals(data, period);
  const maximum = Math.max(current, previous);
  const delta = previous > 0 ? ((current - previous) * 100) / previous : null;
  const unit = periods[period].toLocaleLowerCase("vi");
  return (
    <>
      <div className={styles.spendSummary}>
        <strong>{money(current)}</strong>
        <p>Tổng đã chi {unit} này</p>
        {delta !== null && (
          <p
            className={
              delta < 0
                ? styles.decrease
                : delta > 0
                  ? styles.increase
                  : undefined
            }
          >
            {delta === 0
              ? "Bằng"
              : (delta < 0 ? "↓ Giảm " : "↑ Tăng ") +
                percent(Math.abs(delta)) +
                "% so với"}{" "}
            {unit} trước
          </p>
        )}
        {delta === null && <p>{periods[period]} trước chưa có chi tiêu.</p>}
      </div>
      <div
        className={styles.barChart}
        role="group"
        aria-label="So sánh tổng chi tiêu"
      >
        {[
          { amount: previous, suffix: "trước" },
          { amount: current, suffix: "này" },
        ].map(({ amount, suffix }) => (
          <div key={suffix} className={styles.barColumn}>
            <strong>{money(amount)}</strong>
            <div className={styles.barTrack} aria-hidden="true">
              <i
                style={{ height: maximum ? (amount / maximum) * 100 + "%" : 0 }}
              />
            </div>
            <span>
              {periods[period]} {suffix}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function CategoryList({
  categories,
  period,
  total,
}: {
  categories: SpendingCategory[];
  period: SpendingPeriod;
  total: number;
}) {
  return (
    <ol className={styles.categoryList}>
      {categories.map((category) => (
        <li key={category.id}>
          <CategoryIcon icon={category.icon} color={category.color} size={36} />
          <div>
            <strong>{category.name}</strong>
            <small>{money(category[period])}</small>
          </div>
          <span>{percent((category[period] * 100) / total)}%</span>
        </li>
      ))}
    </ol>
  );
}

export default function SpendingReports({
  data,
  state,
  transactions,
}: {
  data?: MonthlyTrend;
  state?: ReactNode;
  transactions: RecentTransaction[];
}) {
  const [comparison, setComparison] = useState<SpendingPeriod>("month");
  const [ranking, setRanking] = useState<SpendingPeriod>("week");
  const [details, setDetails] = useState(false);
  const categories = (data?.expense_categories ?? [])
    .filter((category) => category[ranking] > 0)
    .sort(
      (a, b) => b[ranking] - a[ranking] || a.name.localeCompare(b.name, "vi"),
    );
  const total = categories.reduce(
    (sum, category) => sum + category[ranking],
    0,
  );
  return (
    <div className={styles.reportGrid}>
      <OverviewCharts
        key={data?.through.slice(0, 7)}
        data={data}
        state={state}
      />
      <section className={`${styles.panel} ${styles.monthlyCard}`}>
        <header className={styles.monthlyHead}>
          <h2>Báo cáo chi tiêu</h2>
          <CardAction href={`/analytics?period=${comparison}#${SPENDING_REPORT_ID}`}>Xem báo cáo</CardAction>
        </header>
        <PeriodSwitch
          value={comparison}
          onChange={setComparison}
          label="Kỳ so sánh chi tiêu"
        />
        {state ?? (data && <Comparison data={data} period={comparison} />)}
      </section>
      <RecentTransactions transactions={transactions} />
      <section className={`${styles.panel} ${styles.monthlyCard}`}>
        <header className={styles.monthlyHead}>
          <h2>Chi tiêu nhiều nhất</h2>
          {categories.length > 0 && (
            <CardAction aria-haspopup="dialog" onClick={() => setDetails(true)}>Xem chi tiết</CardAction>
          )}
        </header>
        <PeriodSwitch
          value={ranking}
          onChange={setRanking}
          label="Kỳ xếp hạng danh mục"
        />
        {state ??
          (categories.length ? (
            <CategoryList
              categories={categories.slice(0, 3)}
              period={ranking}
              total={total}
            />
          ) : (
            <p className={styles.noSpending}>
              {periods[ranking]} này chưa có khoản chi.
            </p>
          ))}
        {details && (
          <Modal
            title={`Chi tiêu theo danh mục · ${periods[ranking]} này`}
            onClose={() => setDetails(false)}
          >
            <p className={styles.detailTotal}>
              Tổng đã chi <strong>{money(total)}</strong>
            </p>
            <CategoryList
              categories={categories}
              period={ranking}
              total={total}
            />
          </Modal>
        )}
      </section>
    </div>
  );
}
