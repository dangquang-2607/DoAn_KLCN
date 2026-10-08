/**
 * ============================================================================
 * TÊN FILE: finance.ts
 * MÀN HÌNH / PHÂN HỆ: Hạ tầng và tiện ích cốt lõi
 * NHÓM VỆ TINH: dung-chung (Dịch vụ và tiện ích cốt lõi)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp kiểu dữ liệu tài chính, thông báo và nhãn loại tài khoản dùng chung.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Hợp đồng dữ liệu API; formatter nằm tại dung-chung/tien-ich/finance.ts.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất kiểu dữ liệu, hằng số và hàm tiện ích cho các module liên quan.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không đồng bộ đè từ admin-web vì hợp đồng API của hai portal khác nhau.
 * ============================================================================
 */
export type Money = number | string;

export interface Account {
  bank_managed?: boolean;
  bank_status?: string;
  bank_last_sync?: string | null;
  id: string;
  name: string;
  account_type: string;
  institution_name?: string | null;
  account_number_masked?: string | null;
  target_amount?: Money | null;
  target_date?: string | null;
  exclude_from_total?: boolean;
  is_notification_enabled?: boolean;
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
  bank_reference?: string | null;
  invoice_id?: string | null;
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
  applies_from: string;
  warning_percent: Money;
  currency: string;
  is_active: boolean;
  is_recurring: boolean;
  recurrence_end_date: string | null;
  period_state: "CURRENT" | "PAUSED" | "UPCOMING" | "COMPLETED";
  configured_name: string;
  configured_amount_limit: Money;
  configured_warning_percent: Money;
  configured_is_active: boolean;
  next_effective_date: string | null;
  next_state_date: string | null;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
}

export interface Notification {
  id: string;
  kind: "ACCOUNT" | "SAVINGS" | "BUDGET" | "TRANSACTION" | "BANK" | "SECURITY" | string;
  severity: "INFO" | "WARNING" | "CRITICAL" | string;
  title: string;
  message: string;
  source_type: string | null;
  source_id: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPage {
  items: Notification[];
  unread_count: number;
  total: number;
  page: number;
  page_size: number;
}

export const accountTypes: Record<string, string> = {
  BASIC: "Ví cơ bản",
  LINKED: "Ví liên kết",
  CASH: "Tiền mặt",
  BANK: "Ngân hàng",
  E_WALLET: "Ví điện tử",
  CREDIT_CARD: "Thẻ tín dụng",
  SAVINGS: "Ví tiết kiệm",
  INVESTMENT: "Đầu tư",
  CRYPTO: "Tài sản số",
  OTHER: "Khác",
};
