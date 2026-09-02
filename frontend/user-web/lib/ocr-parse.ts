//Mục đích: Tách biệt logic parse khỏi logic gọi API.
//Module này không gọi bất kỳ API nào, chỉ xử lý string → object → array.

// 14 khoá JSON mà ta yêu cầu model trả về (đúng thứ tự với cột CSV)
export const JSON_KEYS = [
  "mau_so_ky_hieu",      // → cột 0
  "so_hoa_don",          // → cột 1
  "ngay_lap",            // → cột 2
  "ma_so_thue",          // → cột 3
  "ten_nguoi_ban_mua",   // → cột 4
  "doanh_so_chua_thue",  // → cột 5 (số tiền)
  "thue_suat_gtgt",      // → cột 6 (số tiền)
  "tien_thue_gtgt",      // → cột 7 (số tiền)
  "tong_thanh_toan",     // → cột 8 (số tiền)
  "hinh_thuc_thanh_toan",// → cột 9
  "tinh_trang_hoa_don",  // → cột 10
  "phan_loai_chi_phi",   // → cột 11
  "ghi_chu_hop_le",      // → cột 12
  "ma_tra_cuu",          // → cột 13
] as const;

// Các khoá cần chuẩn hoá về số thuần (bỏ dấu phẩy, dấu chấm phân cách)
const AMOUNT_KEYS = new Set<string>([
  "doanh_so_chua_thue",
  "thue_suat_gtgt",
  "tien_thue_gtgt",
  "tong_thanh_toan",
]);

/**
 * Bóc JSON khỏi response của AI (có thể có code fence ```json ... ```)
 * Throw nếu không tìm thấy hoặc JSON không hợp lệ
 */
export function extractJson(text: string): Record<string, unknown> {
  // Xoá code fence nếu có (model hay bọc JSON trong ```)
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Model không trả về JSON — hãy thử chạy lại hoặc đổi model");
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error("JSON từ model không hợp lệ — hãy thử chạy lại hoặc đổi model");
  }
}

/**
 * Chuẩn hoá số tiền:
 * "1.234.567" → "1234567"   (phong cách VN)
 * "1,234,567" → "1234567"   (phong cách US)
 * "1.234.567 đ" → "1234567"
 * "8%" → "8"
 * "10.5" → "10.5"           (số thập phân giữ nguyên)
 */
export function normalizeAmount(raw: string): string {
  const v = raw.trim().replace(/[^\d.,-]/g, "");
  if (!v) return "";
  // Pattern: số nguyên với dấu phân cách nghìn (1.234.567 hoặc 1,234,567)
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(v)) return v.replace(/[.,]/g, "");
  // Pattern: số thập phân (10,5 hoặc 10.5)
  if (/^-?\d+[.,]\d{1,2}$/.test(v)) return v.replace(",", ".");
  // Mặc định: bỏ dấu phẩy
  return v.replace(/,/g, "");
}

/**
 * Map JSON object từ AI → mảng 15 phần tử (14 trường dữ liệu + tên file nguồn)
 */
export function toInvoiceRow(json: Record<string, unknown>, sourceFile: string): string[] {
  const row = JSON_KEYS.map((key) => {
    const value = json[key];
    // null/undefined → chuỗi rỗng; các giá trị khác → String()
    const text = value === null || value === undefined ? "" : String(value).trim();
    // Chuẩn hoá các trường số tiền
    return AMOUNT_KEYS.has(key) ? normalizeAmount(text) : text;
  });
  // Thêm cột thứ 15: tên file gốc (dùng để đối chiếu CSV ↔ file upload)
  row.push(sourceFile);
  return row;
}
