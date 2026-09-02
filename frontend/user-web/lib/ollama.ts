// Cấu hình Ollama từ biến môi trường
export const OLLAMA_REFINE =
  process.env.OLLAMA_REFINE?.trim().toLowerCase() === "true";
export const OLLAMA_ENDPOINT =
  process.env.OLLAMA_ENDPOINT || "http://localhost:11434/v1/chat/completions";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:4b";

const OLLAMA_REFINE_PROMPT = `Bạn là trợ lý kế toán Việt Nam. Nhiệm vụ của bạn là kiểm tra và chuẩn hoá lại JSON hoá đơn sau đây.

Yêu cầu:
1. Kiểm tra tính nhất quán: nếu doanh_so_chua_thue + tien_thue_gtgt ≠ tong_thanh_toan thì ghi chú vào ghi_chu_hop_le
2. Đảm bảo ngay_lap đúng định dạng dd/MM/yyyy
3. Đảm bảo các trường số (doanh_so_chua_thue, tien_thue_gtgt, tong_thanh_toan, thue_suat_gtgt) chỉ chứa chữ số thuần
4. Nếu thấy trường nào có vẻ sai hoặc bất thường, ghi chú vào ghi_chu_hop_le
5. Giữ nguyên tất cả các khoá JSON, không thêm khoá mới
6. Trả về DUY NHẤT đối tượng JSON đã chuẩn hoá, không thêm bất kỳ văn bản hay giải thích nào

JSON cần kiểm tra:
`;

/**
 * Gửi JSON thô qua Ollama để kiểm tra và chuẩn hoá.
 * Nếu Ollama không chạy hoặc lỗi → trả về JSON gốc (không throw).
 * Thiết kế "graceful degradation": pipeline không bị hỏng khi Ollama tắt.
 */
export async function refineWithOllama(rawJson: string): Promise<string> {
  const body = {
    model: OLLAMA_MODEL,
    messages: [{ role: "user", content: OLLAMA_REFINE_PROMPT + rawJson }],
    stream: false,
  };

  let res: Response;
  try {
    res = await fetch(OLLAMA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000), // 60s timeout cho model local
    });
  } catch (err) {
    // Ollama không chạy → log cảnh báo, dùng kết quả Gemini gốc
    console.warn(`[Ollama] Không kết nối được tới ${OLLAMA_ENDPOINT}:`, err);
    return rawJson;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    console.warn(`[Ollama] Lỗi refine (${res.status}):`, errText);
    return rawJson; // fallback
  }

  const data: unknown = await res.json().catch(() => null);
  const refined = (
    data as { choices?: { message?: { content?: unknown } }[] } | null
  )?.choices?.[0]?.message?.content;

  if (typeof refined !== "string" || !refined.trim()) {
    console.warn("[Ollama] Không nhận được nội dung từ Ollama, dùng kết quả OCR gốc.");
    return rawJson;
  }

  return refined;
}
