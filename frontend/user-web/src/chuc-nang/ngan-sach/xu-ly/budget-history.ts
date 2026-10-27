/**
 * ============================================================================
 * TÊN FILE: budget-history.ts
 * MÀN HÌNH / PHÂN HỆ: Quản lý Ngân sách chi tiêu
 * NHÓM VỆ TINH: xu-ly (Xử lý nghiệp vụ & lọc dữ liệu)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp các hàm tiện ích lọc và phân loại lịch sử các kỳ ngân sách đã kết thúc
 *   theo tháng chỉ định để hiển thị trong giao diện lịch sử ngân sách.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Mảng các mục có trường end_date định dạng ISO (YYYY-MM-DD), giá trị tháng (1-12 hoặc 0).
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Hàm filterBudgetHistoryByMonth.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Gắn kỳ ngân sách theo tháng của ngày kết thúc kỳ để đối soát chính xác với báo cáo tài chính.
 * ============================================================================
 */
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
