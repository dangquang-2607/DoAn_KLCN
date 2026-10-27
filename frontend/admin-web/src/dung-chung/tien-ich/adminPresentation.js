/**
 * ============================================================================
 * TÊN FILE: adminPresentation.js
 * DỰ ÁN: CapitalFlow — Cổng Quản Trị Hệ Thống (admin-web)
 * MÀN HÌNH / PHÂN HỆ: Tiện ích hiển thị dùng chung
 * NHÓM VỆ TINH: dung-chung (Định dạng số liệu & ngày tháng)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp các bộ định dạng chuẩn cho cổng quản trị: định dạng số nguyên number,
 *   định dạng tiền tệ currency, định dạng ngày giờ datetime và nhãn thời gian tương đối.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Intl.NumberFormat('vi-VN'), Intl.DateTimeFormat('vi-VN').
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Các đối tượng number, currency, datetime, relativeTime.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Bảo đảm định dạng thống nhất xuyên suốt mọi bảng dữ liệu quản trị.
 * ============================================================================
 */
// Presentation-only helpers. No fixtures, requests or business mutations here.
export const number = new Intl.NumberFormat("vi-VN");

export const decimal = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export function timestamp(value) {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa ghi nhận" : new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date);
}
