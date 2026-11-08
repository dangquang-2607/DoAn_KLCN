type TrendDay = { date: string; income: number; expense: number };
export type SpendingPeriod = "week" | "month";
export type SpendingCategory = { id: string; name: string; icon: string | null; color: string | null; week: number; month: number };
export type MonthlyTrend = { through: string; days: TrendDay[]; expense_categories: SpendingCategory[] };
export type Metric = "expense" | "income";

export function monthlyTotals({ through, days }: MonthlyTrend) {
  const start = through.slice(0, 7) + "-01";
  let income = 0, expense = 0;
  for (const point of days) {
    if (point.date < start || point.date > through) continue;
    income += point.income;
    expense += point.expense;
  }
  return { start, income, expense, net: income - expense };
}

export function monthlyComparison({ through, days }: MonthlyTrend, metric: Metric) {
  const year = Number(through.slice(0, 4));
  const month = Number(through.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const currents = [0, 0, 0, 0];
  const amounts = new Map(days.map(point => [point.date, point[metric]]));
  const months = currents.map((_, offset) => new Date(Date.UTC(year, month - 1 - offset, 1)).toISOString().slice(0, 7));

  return Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    const suffix = "-" + String(day).padStart(2, "0");
    months.forEach((prefix, offset) => { currents[offset] += amounts.get(prefix + suffix) ?? 0; });
    const date = months[0] + suffix;
    return { day, date, actual: date <= through ? currents[0] : null,
      average: (currents[1] + currents[2] + currents[3]) / 3 };
  });
}
