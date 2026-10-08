// Presentation-only helpers. No fixtures, requests or business mutations here.
export const number = new Intl.NumberFormat("vi-VN");

export const decimal = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export const tones = ["blue", "teal", "amber", "violet", "coral"];

export function timestamp(value) {
  if (!value) return "Chưa ghi nhận";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa ghi nhận" : new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date);
}
