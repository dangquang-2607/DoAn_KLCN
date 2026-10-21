/**
 * ============================================================================
 * TÊN FILE: InvoiceTypes.ts
 * MÀN HÌNH / PHÂN HỆ: Hóa đơn AI / OCR
 * NHÓM VỆ TINH: thanh-phan (Chức năng con)
 * MỤC ĐÍCH CỤ THỂ:
 *   Khai báo kiểu dữ liệu và nhãn trạng thái của miền hóa đơn.
 * ĐẦU VÀO & PHỤ THUỘC (Inputs / Dependencies):
 *   Props từ component cha, kiểu nghiệp vụ và các primitive UI liên quan.
 * ĐẦU RA & CUNG CẤP (Outputs / Exports):
 *   Xuất kiểu dữ liệu, hằng số và hàm tiện ích cho các module liên quan.
 * LƯU Ý AN TOÀN & NGHIỆP VỤ (Security / Business Notes):
 *   Giới hạn định dạng/kích thước/số lượng tệp; chỉ tạo khoản chi sau bước người dùng xác nhận.
 * ============================================================================
 */
import type { Money } from "@/dung-chung/nghiep-vu/finance";

// Kiểu dòng hàng giữ Money linh hoạt vì backend có thể tuần tự số thập phân thành chuỗi.
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
  revision: number;
  deleted_at?: string | null;
  invoice_time?: string | null;
  transaction_id?: string | null;
  duplicate_of_invoice_id?: string | null;
  duplicate_level?: "NONE" | "SUSPECTED" | "EXACT";
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

export interface DuplicateCandidate {
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
}

// Ánh xạ mã backend sang nhãn tiếng Việt; không dùng nhãn hiển thị để gửi ngược API.
export const STATUSES: Record<string, string> = {
  UPLOADED: "Chưa quét",
  PROCESSING: "Đang xử lý",
  REVIEW_REQUIRED: "Chờ kiểm tra",
  CONFIRMED: "Đã xác nhận",
  FAILED: "Thất bại",
};
