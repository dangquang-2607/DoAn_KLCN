/**
 * ============================================================================
 * TÊN FILE: notificationText.ts
 * MÀN HÌNH / PHÂN HỆ: Trung tâm Thông báo hệ thống
 * NHÓM VỆ TINH: dung-chung (Tiện ích định dạng thông điệp)
 * MỤC ĐÍCH CỤ THỂ:
 *   Định dạng lại các con số thô trong chuỗi nội dung thông báo thành dạng tiền tệ VND
 *   chuẩn hóa (ví dụ: '500000 VND' -> '500.000 ₫') để người dùng dễ đọc.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Hàm money từ finance utility.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Hàm notificationText.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Sử dụng regex an toàn; không làm thay đổi các giá trị văn bản phi tiền tệ.
 * ============================================================================
 */
import { money } from "../tien-ich/finance";

/**
 * Chuẩn hóa chuỗi văn bản thông báo: thay thế các con số thô bằng định dạng tiền tệ.
 * 
 * @param text - Nội dung thông báo gốc từ server.
 * @param currency - Đơn vị tiền tệ (mặc định VND).
 * @returns Nội dung đã được định dạng đẹp mắt.
 */
export function notificationText(text: string, currency = "VND") {
  return text
    .replace(/(-?\d+(?:\.\d+)?)\s*VND/g, (_, amount: string) => money(amount, currency))
    .replace(/(-?\d+(?:\.\d+)?)(?=\s*→)/g, (amount) => money(amount, currency));
}
