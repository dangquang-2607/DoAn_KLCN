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
export function normalizeDemoAccountNumber(value: string): string {
  return value.replace(/[\s\u200b-\u200d\ufeff]/g, "");
}

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
