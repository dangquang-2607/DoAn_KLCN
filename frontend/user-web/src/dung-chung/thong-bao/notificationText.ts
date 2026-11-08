import { money } from "../tien-ich/finance";

/**
 * Chuẩn hóa chuỗi văn bản thông báo: thay thế các con số thô bằng định dạng tiền tệ.
 * 
 * @param text - Nội dung thông báo gốc từ server.
 * @param currency - Đơn vị tiền tệ (mặc định VND).
 * @returns Nội dung đã được định dạng đẹp mắt.
 */
export function notificationText(text: string, currency = "VND") {
  // Compatibility with stored messages from older APIs. New APIs return ₫ text.
  // Capture the entire US-grouped token, not just the final group of zeroes.
  const number = String.raw`[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;
  const legacy = new RegExp(String.raw`(?<![\w.,+\-])(${number})(?:\s*(→|/)\s*(${number}))?\s*VND\b`, "g");
  const format = (raw: string) => `${raw.startsWith("+") ? "+" : ""}${money(raw.replaceAll(",", ""), currency)}`;
  return text.replace(/(?<![\d.,])(\d+)\.(\d{1,2})%/g, "$1,$2%").replace(legacy, (_, first: string, separator: string, second?: string) =>
    second ? `${format(first)} ${separator} ${format(second)}` : format(first));
}
