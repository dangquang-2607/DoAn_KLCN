/** Lịch sử gắn một kỳ ngân sách với tháng chứa ngày kết thúc của kỳ. */
/**
 * Lọc danh sách lịch sử ngân sách theo tháng kết thúc của kỳ.
 * 
 * @param items - Danh sách các mục ngân sách có trường end_date.
 * @param month - Số thứ tự tháng (1-12) cần lọc; truyền 0 để lấy toàn bộ.
 * @returns Mảng các mục ngân sách thỏa mãn điều kiện tháng.
 */
export function filterBudgetHistoryByMonth<T extends { end_date: string }>(items: T[], month: number): T[] {
  if (month === 0) return items;
  return items.filter((item) => Number(item.end_date.slice(5, 7)) === month);
}
