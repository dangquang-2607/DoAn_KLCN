import type { Money } from "@/lib/finance";

export interface InvoiceItem {
  id: string;
  name: string;
  sku?: string | null;
  unit?: string | null;
  quantity: Money | null;
  unit_price: Money | null;
  discount_amount?: Money | null;
  tax_amount?: Money | null;
  line_total: Money | null;
}

export interface Invoice {
  id: string;
  merchant_name: string | null;
  merchant_address: string | null;
  merchant_tax_code: string | null;
  invoice_number: string | null;
  invoice_symbol: string | null;
  invoice_date: string | null;
  vat_rate: string | null;
  payment_method: string | null;
  subtotal_amount: Money | null;
  total_amount: Money | null;
  tax_amount: Money | null;
  currency: string;
  original_filename: string;
  mime_type: string;
  status: string;
  account_id?: string;
  category_id?: string;
  note?: string;
  is_duplicate?: boolean;
  duplicate_reason?: string;
  items?: InvoiceItem[];
}

export const STATUSES: Record<string, string> = {
  UPLOADED: "Chua quet",
  PROCESSING: "Dang xu ly",
  REVIEW_REQUIRED: "Cho kiem tra",
  CONFIRMED: "Da xac nhan",
  FAILED: "That bai",
};