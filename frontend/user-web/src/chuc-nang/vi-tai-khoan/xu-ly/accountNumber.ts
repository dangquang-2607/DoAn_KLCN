/**
 * ============================================================================
 * TÊN FILE: accountNumber.ts
 * MÀN HÌNH / PHÂN HỆ: Quản lý Ví & Tài khoản
 * NHÓM VỆ TINH: xu-ly (Tiện ích chuẩn hóa & kiểm tra số tài khoản)
 * MỤC ĐÍCH CỤ THỂ:
 *   Chuẩn hóa số tài khoản ngân hàng khi người dùng dán hoặc nhập, loại bỏ các ký tự
 *   phân cách, khoảng trắng hoặc ký tự unicode ẩn không hợp lệ.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Chuỗi số tài khoản thô, thông tin Account hiện tại, tên nhà cung cấp (ngân hàng).
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Các hàm normalizeDemoAccountNumber, canKeepStoredNumber.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không tự ý thay đổi chữ cái thành số; giữ nguyên độ dài và định dạng số tài khoản chuẩn.
 * ============================================================================
 */
import { type Account } from "@/dung-chung/nghiep-vu/finance";

export type BankNumberRule = {
  name: string;
  demo_number: string;
  lengths: number[];
  pattern: string;
  label: string;
  hint: string;
  max_length: number;
};
export type BankNumberRules = Record<string, BankNumberRule>;

// Remove copy/paste separators only; never silently turn letters into a bank number.
/**
 * Chuẩn hóa số tài khoản: loại bỏ khoảng trắng và các ký tự điều khiển ẩn.
 * 
 * @param value - Chuỗi số tài khoản thô do người dùng nhập hoặc sao chép.
 * @returns Chuỗi số tài khoản đã làm sạch ký tự lạ.
 */
export function normalizeDemoAccountNumber(value: string): string {
  return value.replace(/[\s\u200b-\u200d\ufeff]/g, "");
}

/**
 * Kiểm tra xem có thể giữ lại số tài khoản đã lưu nếu không thay đổi ngân hàng.
 */
export function canKeepStoredNumber(editing: Account | null, provider: string, number: string) {
  return Boolean(editing && provider === editing.institution_name
    && number === (editing.account_number_masked || ""));
}

export function accountNumberError(rules: BankNumberRules | undefined, provider: string,
  number: string, editing: Account | null): string {
  if (canKeepStoredNumber(editing, provider, number)) return "";
  if (!rules) return "Chưa tải được định dạng tài khoản. Vui lòng thử lại.";
  const rule = rules[provider];
  if (!rule) return "Vui lòng chọn ngân hàng hoặc ví điện tử được hỗ trợ.";
  if (!new RegExp(`^(?:${rule.pattern})$`).test(number)) return rule.hint;
  return number === rule.demo_number ? "" : `Hãy dùng số tài khoản mẫu ${rule.demo_number} của ${rule.name}.`;
}
