// shared/finance.ts — canonical finance utilities, source of truth
// Synced to: user-web/lib/finance.ts (TS), admin-web/src/services/format.js (JS)

// ── Types ─────────────────────────────────────────────────────────────────────
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
  keywords?: string | null;
  sort_order: number;
  is_active: boolean;
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
  category_confidence?: Money | null;
  category_source?: string | null;
  category_was_auto?: boolean;
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

// ── Formatters ────────────────────────────────────────────────────────────────

export function money(value: Money = 0, currency = "VND"): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(Number(value) || 0);
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateLabel(value?: string | null): string {
  return value
    ? new Date(
        value.length === 10 ? `${value}T12:00:00` : value,
      ).toLocaleDateString("vi-VN")
    : "-";
}

export function errorMessage(error: unknown): string {
  const e = error as {
    response?: { status?: number; data?: { detail?: unknown } };
  };
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((d: { msg?: string }) => d.msg).join(". ");
  if (e?.response?.status === 429)
    return "Ban thao tac qua nhanh. Vui long cho mot phut roi thu lai.";
  return "Khong the hoan tat thao tac. Vui long thu lai.";
}

export const accountTypes: Record<string, string> = {
  CASH: "Tien mat",
  BANK: "Ngan hang",
  E_WALLET: "Vi dien tu",
  CREDIT_CARD: "The tin dung",
  SAVINGS: "Tiet kiem",
  INVESTMENT: "Dau tu",
  CRYPTO: "Tai san so",
  OTHER: "Khac",
};

export function exportCsv(name: string, rows: unknown[][]): void {
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