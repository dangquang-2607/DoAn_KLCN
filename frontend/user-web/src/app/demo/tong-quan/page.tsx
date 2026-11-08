"use client";

import { useQuery } from "@tanstack/react-query";
import type { Budget } from "@/dung-chung/nghiep-vu/finance";
import { resolveReportPeriod, shiftReportPeriod } from "@/dung-chung/nghiep-vu/report";
import BudgetsWidget from "@/chuc-nang/tong-quan/thanh-phan/BudgetsWidget";
import { useVietnamDay } from "@/chuc-nang/tong-quan/useVietnamDay";
import { dateLabel } from "@/dung-chung/tien-ich/finance";
import { Loading } from "@/dung-chung/UI-chung/ui";
import SpendingReports from "@/chuc-nang/tong-quan/thanh-phan/SpendingReports";
import { MonthlySummary } from "@/chuc-nang/tong-quan/thanh-phan/OverviewStats";
import type { MonthlyTrend } from "@/chuc-nang/tong-quan/monthlyTrend";
import styles from "@/chuc-nang/tong-quan/CSS/overview.module.css";

function exampleBudget(name: string, limit: number, spent: number, today: string): Budget {
  const start = today.slice(0, 7) + "-01";
  const end = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const usage = spent * 100 / limit;
  const elapsed = Number(today.slice(8));
  const totalDays = Number(end.slice(8));
  const remainingDays = totalDays - elapsed + 1;
  return { budget_id: name, budget_name: name, category_id: null, amount_limit: limit, spent_amount: spent,
    remaining_amount: limit - spent, usage_percent: usage, progress_status: usage > 100 ? "EXCEEDED" : "WARNING",
    currency: "VND", period_state: "CURRENT", warning_percent: 85, period_type: "MONTH", is_active: true,
    start_date: start, applies_from: start, end_date: end, is_recurring: false,
    recurrence_end_date: null, configured_name: name, configured_amount_limit: limit,
    period_days: totalDays, elapsed_days: elapsed, remaining_days: remainingDays, active_elapsed_days: elapsed,
    daily_allowance: Math.floor(Math.max(0, limit - spent) / remainingDays), average_daily_spent: spent / elapsed,
    configured_warning_percent: 85, configured_is_active: true, next_effective_date: null, next_state_date: null };
}

function exampleTrend(today: string): MonthlyTrend {
  const days = [];
  const weights = [0.04, 0.08, 0.12, 0.04, 0.38, 0.16, 0.08, 0.10];
  for (let offset = 0; offset < 4; offset++) {
    const prefix = shiftReportPeriod("month", today, -offset).slice(0, 7);
    const expense = offset === 0 ? 31394000 : 19758500;
    const income = offset === 0 ? 11970000 : 9287500;
    weights.forEach((weight, index) => days.push({
      date: prefix + "-" + String(index + 1).padStart(2, "0"), expense: Math.round(weight * expense),
      income: index === 0 ? 320000 : index === 3 ? income - 320000 : 0,
    }));
    for (const day of [11, 16, 20, 25, 28])
      days.push({ date: prefix + "-" + day, expense: 5800000, income: day === 25 ? 25100000 : 1300000 });
  }
  const recorded = days.filter(point => point.date <= today);
  const expense_categories = [
    { id: "bills", name: "Hóa đơn & Tiện ích", icon: "receipt", color: "slate", month: 0, week: 0 },
    { id: "family", name: "Gia đình", icon: "home", color: "teal", month: 0, week: 0 },
    { id: "fun", name: "Giải trí", icon: "gamepad", color: "sky", month: 0, week: 0 },
    { id: "food", name: "Ăn uống", icon: "utensils", color: "orange", month: 0, week: 0 },
  ];
  const weekStart = resolveReportPeriod("week", today, "", "", today).start;
  const monthStart = today.slice(0, 7) + "-01";
  for (const day of recorded) {
    const weights = Number(day.date.slice(-2)) % 2 ? [43, 35, 12] : [35, 42, 15];
    let remainder = day.expense;
    expense_categories.forEach((category, index) => {
      const amount = index < weights.length ? Math.round(day.expense * weights[index] / 100) : remainder;
      remainder -= amount;
      if (day.date >= weekStart) category.week += amount;
      if (day.date >= monthStart) category.month += amount;
    });
  }
  return { through: today, days: recorded, expense_categories };
}

export default function OverviewDemo() {
  const today = useVietnamDay();
  return today ? <DemoContent today={today} /> : <Loading />;
}

function DemoContent({ today }: { today: string }) {
  const report = exampleTrend(today);
  const descriptions = ["Hóa đơn điện", "Mua thực phẩm", "Cà phê", "Vé xem phim", "Đi chợ"];
  const transactions = report.days.filter(day => day.expense > 0).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
    .map((day, index) => ({ id: day.date, description: descriptions[index], type: "EXPENSE", amount: -day.expense, transaction_date: day.date }));
  const budgets = [exampleBudget("Ăn uống", 3000000, 3750000, today), exampleBudget("Mua sắm", 2000000, 2200000, today),
    exampleBudget("Đi lại", 1000000, 900000, today)];
  const budgetQuery = useQuery({ queryKey: ["demo", "overview-budgets", today.slice(0, 7)], queryFn: () => budgets, initialData: budgets, enabled: false });
  return <main className={styles.demoPage}>
    <div className={styles.canvas}>
      <header><h1>Demo Tổng quan</h1><p>Dữ liệu minh họa ngày {dateLabel(today)}</p></header>
      <MonthlySummary report={report} />
      <SpendingReports data={report} transactions={transactions} />
      <BudgetsWidget query={budgetQuery} />
    </div>
  </main>;
}
