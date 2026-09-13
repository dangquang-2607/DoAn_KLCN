export type Money = number | string;
export interface Account {
  id: string;
  name: string;
  account_type: string;
  institution_name?: string | null;
  balance: Money;
  currency: string;
  is_active: boolean;
}
export interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  owner_user_id: string | null;
  icon?: string;
  color?: string;
}
export interface Transaction {
  id: string;
  account_id: string;
  category_id: string | null;
  amount: Money;
  type: string;
  source: string;
  kind?: "NORMAL" | "TRANSFER" | "ADJUSTMENT";
  transfer_id?: string | null;
  transaction_date: string;
  description: string;
  note?: string;
}
export interface Budget {
  budget_id: string;
  budget_name: string;
  category_id: string | null;
  amount_limit: Money;
  spent_amount: Money;
  remaining_amount: Money;
  usage_percent: Money;
  progress_status: string;
  period_type: string;
  start_date: string;
  end_date: string;
  warning_percent: Money;
  currency: string;
  is_active: boolean;
}
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
}
export function money(value: Money = 0, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(Number(value) || 0);
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function dateLabel(value?: string | null) {
  return value
    ? new Date(
        value.length === 10 ? `${value}T12:00:00` : value,
      ).toLocaleDateString("vi-VN")
    : "—";
}
export function errorMessage(error: unknown) {
  const e = error as {
    response?: { status?: number; data?: { detail?: unknown } };
  };
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((d: { msg?: string }) => d.msg).join(". ");
  if (e?.response?.status === 429)
    return "Bạn thao tác quá nhanh. Vui lòng chờ một phút rồi thử lại.";
  return "Không thể hoàn tất thao tác. Vui lòng thử lại.";
}
export const accountTypes: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK: "Ngân hàng",
  E_WALLET: "Ví điện tử",
  CREDIT_CARD: "Thẻ tín dụng",
  SAVINGS: "Tiết kiệm",
  INVESTMENT: "Đầu tư",
  CRYPTO: "Tài sản số",
  OTHER: "Khác",
};
export function exportCsv(name: string, rows: unknown[][]) {
  const escape = (value: unknown) => {
    let s = String(value ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
