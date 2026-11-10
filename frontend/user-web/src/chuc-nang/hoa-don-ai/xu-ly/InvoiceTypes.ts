import type { Money } from "@/dung-chung/nghiep-vu/finance";

// Kiểu dòng hàng giữ Money linh hoạt vì backend có thể tuần tự số thập phân thành chuỗi.
interface InvoiceItem {
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
  revision: number;
  deleted_at?: string | null;
  trash_expires_at?: string | null;
  can_restore?: boolean;
  invoice_time?: string | null;
  transaction_id?: string | null;
  duplicate_of_invoice_id?: string | null;
  duplicate_level?: "NONE" | "SUSPECTED" | "EXACT";
  duplicate_similarity_percent?: number;
  duplicate_match_id?: string | null;
  duplicate_check?: DuplicateCheck;
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

interface DuplicateCandidate {
  purged?: boolean;
  similarity_percent?: number;
  level?: "EXACT" | "SUSPECTED";
  invoice_id: string;
  transaction_id: string | null;
  merchant_name: string | null;
  invoice_date: string | null;
  total_amount: Money | null;
  currency: string;
  status: string;
  reason: string;
  deleted_at: string | null;
}
export interface DuplicateCheck {
  similarity_percent?: number;
  score_version?: number;
  level: "NONE" | "SUSPECTED" | "EXACT";
  review_token: string;
  candidate_count: number;
  candidates: DuplicateCandidate[];
  can_override: boolean;
}
export interface UploadResult {
  id: string;
  outcome: "CREATED" | "REUSED_DRAFT" | "ALREADY_CONFIRMED" | "RESTORE_REQUIRED";
  revision: number;
  transaction_id?: string | null;
  match_kind?: "SHA256" | "DATA" | null;
  duplicate_check?: DuplicateCheck | null;
}

export interface UploadIssue {
  transaction_id?: string;
  matched_invoice_id?: string;
  code?: string;
  message: string;
  upload_ticket?: string;
  duplicate_check?: DuplicateCheck;
  blockers?: Array<{ id: string; filename: string; status: string }>;
  revision?: number;
}
export interface UploadEntry { file: File; result?: UploadResult; error?: string; issue?: UploadIssue }

// Ánh xạ mã backend sang nhãn tiếng Việt; không dùng nhãn hiển thị để gửi ngược API.
export const STATUSES: Record<string, string> = {
  UPLOADED: "Chưa quét",
  PROCESSING: "Đang xử lý",
  REVIEW_REQUIRED: "Chờ kiểm tra",
  CONFIRMED: "Đã xác nhận",
  FAILED: "Thất bại",
};
