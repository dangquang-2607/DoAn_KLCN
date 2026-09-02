//Mục đích: Toàn bộ logic gọi AI (OCR chính). Module này chỉ biết về Gemini, không biết về Ollama hay CSV.

import fs from "fs";
import path from "path";
import { UPLOADS_DIR } from "./paths";
import { extractJson, toInvoiceRow } from "./ocr-parse";

// ─── Đọc cấu hình từ biến môi trường ──────────────────────────────────────

export const GEMINI_ENDPOINT =
  process.env.GOOGLE_AI_ENDPOINT ||
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export const GEMINI_MODEL = process.env.GOOGLE_AI_MODEL || "gemini-2.0-flash";

export function hasGeminiCredentials(): boolean {
  return Boolean(process.env.GOOGLE_AI_ENDPOINT && process.env.GOOGLE_AI_API_KEY);
}

// ─── MIME types được hỗ trợ ────────────────────────────────────────────────

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// ─── Prompt OCR tiếng Việt ─────────────────────────────────────────────────

const OCR_PROMPT = `Bạn là trợ lý kế toán chuyên đọc hoá đơn doanh nghiệp Việt Nam.
Phân tích hoá đơn trong tệp đính kèm và trả về DUY NHẤT một đối tượng JSON với đúng các khoá sau:
- mau_so_ky_hieu: Mẫu số / Ký hiệu hoá đơn
- so_hoa_don: Số hoá đơn
- ngay_lap: Ngày lập hoá đơn, định dạng dd/MM/yyyy
- ma_so_thue: Mã số thuế (MST) của người bán
- ten_nguoi_ban_mua: Tên người bán / Người mua
- doanh_so_chua_thue: Doanh số chưa có thuế, chỉ gồm chữ số
- thue_suat_gtgt: Thuế suất GTGT (%), chỉ gồm chữ số (ví dụ "8")
- tien_thue_gtgt: Tiền thuế GTGT, chỉ gồm chữ số
- tong_thanh_toan: Tổng tiền thanh toán, chỉ gồm chữ số
- hinh_thuc_thanh_toan: Hình thức thanh toán (tiền mặt / chuyển khoản...)
- tinh_trang_hoa_don: Tình trạng hoá đơn (hoá đơn gốc / điều chỉnh / thay thế / huỷ...)
- phan_loai_chi_phi: Phân loại chi phí phù hợp (văn phòng phẩm, dịch vụ, vận chuyển...)
- ghi_chu_hop_le: Ghi chú về tính hợp lệ của hoá đơn (thiếu MST, mờ, nghi ngờ sai lệch...)
- ma_tra_cuu: Mã tra cứu hoá đơn điện tử hoặc link tra cứu nếu có
Thông tin không có trên hoá đơn thì để chuỗi rỗng "".
Không thêm bất kỳ văn bản, giải thích hay code fence nào ngoài đối tượng JSON.`;

// ─── Helper: build nội dung đính kèm file ─────────────────────────────────

/**
 * Gemini API (OpenAI-compatible endpoint) nhận ảnh qua image_url dạng base64,
 * và PDF qua file attachment base64.
 * Đây là kiểu union để TypeScript kiểm tra đúng structure.
 */
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

function buildFilePart(fileName: string, buffer: Buffer): ContentPart {
  const ext = path.extname(fileName).toLowerCase();

  if (ext === ".pdf") {
    // PDF: gửi dạng file attachment với base64
    return {
      type: "file",
      file: {
        filename: fileName,
        file_data: `data:application/pdf;base64,${buffer.toString("base64")}`,
      },
    };
  }

  const mime = MIME[ext];
  if (!mime) throw new Error(`Định dạng không hỗ trợ: ${ext}`);

  // Ảnh: gửi dạng image_url với data URL base64
  return {
    type: "image_url",
    image_url: { url: `data:${mime};base64,${buffer.toString("base64")}` },
  };
}

// ─── Gọi Gemini để OCR ────────────────────────────────────────────────────

async function callGemini(fileName: string, buffer: Buffer): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("Chưa cấu hình GOOGLE_AI_API_KEY trong file .env");

  const body = {
    model: GEMINI_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: OCR_PROMPT },
          buildFilePart(fileName, buffer),
        ],
      },
    ],
  };

  const res = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data as { error?: { message?: string } } | null)?.error?.message ??
      `HTTP ${res.status}`;
    throw new Error(
      `Lỗi Google Gemini (model ${GEMINI_MODEL}): ${message}. ` +
        `Kiểm tra GOOGLE_AI_ENDPOINT, GOOGLE_AI_API_KEY và GOOGLE_AI_MODEL trong .env.`
    );
  }

  const text = (
    data as { choices?: { message?: { content?: unknown } }[] } | null
  )?.choices?.[0]?.message?.content;

  if (typeof text !== "string" || !text.trim()) {
    throw new Error(`Model ${GEMINI_MODEL} không trả về nội dung`);
  }

  return text;
}

// ─── Entry point: OCR một file ────────────────────────────────────────────

/**
 * Đọc file từ data/uploads/, gọi Gemini OCR, trả về mảng 15 phần tử
 * (14 trường dữ liệu + tên file nguồn).
 *
 * Hàm này KHÔNG biết về Ollama hay CSV — chỉ biết Gemini.
 * Orchestration (có bật Ollama không) do lib/ocr-pipeline.ts xử lý.
 */
export async function ocrWithGemini(fileName: string): Promise<string> {
  const safeName = path.basename(fileName); // bảo mật: chỉ lấy tên file, bỏ path
  const buffer = fs.readFileSync(path.join(UPLOADS_DIR, safeName));
  return callGemini(safeName, buffer);
}

export async function runOcrOnFile(fileName: string): Promise<string[]> {
  const rawText = await ocrWithGemini(fileName);
  return toInvoiceRow(extractJson(rawText), path.basename(fileName));
}
