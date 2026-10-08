/**
 * ============================================================================
 * TÊN FILE: finance.ts
 * MÀN HÌNH / PHÂN HỆ: Hạ tầng và tiện ích cốt lõi
 * NHÓM VỆ TINH: dung-chung (Dịch vụ và tiện ích cốt lõi)
 * MỤC ĐÍCH CỤ THỂ:
 *   Cung cấp kiểu tài chính và nhãn loại tài khoản của cổng quản trị.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Hợp đồng dữ liệu API; formatter nằm tại dung-chung/tien-ich/format.ts.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất kiểu dữ liệu, hằng số và hàm tiện ích cho các module liên quan.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Không đồng bộ đè từ user-web vì hợp đồng API của hai portal khác nhau.
 * ============================================================================
 */
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
