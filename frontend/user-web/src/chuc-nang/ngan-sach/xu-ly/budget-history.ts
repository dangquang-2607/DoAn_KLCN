/** Lịch sử gắn một kỳ ngân sách với tháng chứa ngày kết thúc của kỳ. */
export function filterBudgetHistoryByMonth<T extends { end_date: string }>(items: T[], month: number): T[] {
  if (month === 0) return items;
  return items.filter((item) => Number(item.end_date.slice(5, 7)) === month);
}
