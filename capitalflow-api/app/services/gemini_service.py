"""
Gemini Vision Service — trích xuất dữ liệu hóa đơn bằng Google Gemini AI.
Chỉ gọi từ server-side. KHÔNG bao giờ expose API key ra client.

Tích hợp:
  - Tự động Fallback: Ưu tiên gemini-3.5-flash-lite (500 RPD), nếu quá tải tự động chuyển sang gemini-3.6-flash.
  - Xử lý JSON an toàn, dọn dẹp markdown code fence và encoding UTF-8.
"""
import base64
import json
import re
import logging
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── Prompt chuẩn hóa cho hóa đơn Việt Nam ──────────────────────────────────
_OCR_PROMPT = """Bạn là chuyên gia kế toán đọc hóa đơn VAT và hóa đơn bán lẻ Việt Nam.
Hãy phân tích hình ảnh/tài liệu đính kèm và trả về DUY NHẤT một đối tượng JSON hợp lệ theo đúng cấu trúc bên dưới.
Chỉ trả về JSON thuần (không markdown, không giải thích, không bọc ```json).
Nếu không đọc được trường nào, hãy để chuỗi rỗng "" hoặc null.

{
  "so_hoa_don": "số hóa đơn (VD: 0012489)",
  "mau_so_ky_hieu": "mẫu số / ký hiệu hóa đơn (VD: 1C24TKK)",
  "ngay_lap": "dd/MM/yyyy (VD: 24/10/2023)",
  "ma_so_thue": "mã số thuế người bán (chỉ gồm số và dấu gạch nếu có)",
  "ten_nguoi_ban": "tên công ty / cửa hàng người bán",
  "dia_chi_nguoi_ban": "địa chỉ người bán",
  "ten_nguoi_mua": "tên người mua hoặc công ty người mua",
  "doanh_so_chua_thue": "số tiền chưa có thuế (chỉ chữ số, VD: 1500000)",
  "thue_suat_gtgt": "thuế suất % (VD: 8 hoặc 10)",
  "tien_thue_gtgt": "tiền thuế GTGT (chỉ chữ số, VD: 120000)",
  "tong_thanh_toan": "tổng tiền thanh toán (chỉ chữ số, VD: 1620000)",
  "hinh_thuc_thanh_toan": "tiền mặt / chuyển khoản / thẻ",
  "tien_te": "VND",
  "tinh_trang_hoa_don": "Gốc hoặc Điều chỉnh hoặc Thay thế hoặc Hủy",
  "phan_loai_chi_phi": "loại chi phí phù hợp (VD: Ăn uống & Tiếp khách, Văn phòng phẩm, Thiết bị, Di chuyển...)",
  "ma_tra_cuu": "mã tra cứu hóa đơn điện tử hoặc link tra cứu nếu có",
  "do_tin_cay": 0.95,
  "items": [
    {
      "line_no": 1,
      "ten_hang": "tên hàng hóa / dịch vụ",
      "ma_hang": "mã hàng hóa (nếu có)",
      "don_vi": "đơn vị tính (cái, hộp, ram, kg, lít...)",
      "so_luong": "số lượng (chỉ chữ số)",
      "don_gia": "đơn giá (chỉ chữ số)",
      "giam_gia": "số tiền giảm giá (chỉ chữ số hoặc null)",
      "thue": "tiền thuế dòng này (chỉ chữ số hoặc null)",
      "thanh_tien": "thành tiền (chỉ chữ số)",
      "do_tin_cay": 0.95,
      "raw_text": "văn bản gốc của dòng này"
    }
  ]
}

Lưu ý quan trọng:
- Tất cả các trường tiền tệ PHẢI là số thuần túy (không dấu chấm, không dấu phẩy ngăn cách nghìn, không kèm chữ đ hoặc VNĐ).
- Nếu không có bảng chi tiết từng món hàng, trả về items là mảng rỗng [].
- do_tin_cay là số thực từ 0.0 đến 1.0 phản ánh độ chính xác bóc tách.
"""


async def _call_gemini_model(model_name: str, file_bytes: bytes, mime_type: str) -> dict:
    """Gọi một model Gemini cụ thể."""
    encoded = base64.b64encode(file_bytes).decode()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": _OCR_PROMPT},
                    {"inline_data": {"mime_type": mime_type, "data": encoded}},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
            "maxOutputTokens": 8192,
        },
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            url, headers={"x-goog-api-key": settings.google_ai_api_key}, json=payload
        )
        resp.raise_for_status()
        data = resp.json()

    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
    raw_text = re.sub(r"```(?:json)?", "", raw_text).strip().rstrip("```").strip()

    # Tìm json object {}
    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start >= 0 and end > start:
        raw_text = raw_text[start : end + 1]

    result = json.loads(raw_text)
    if "items" not in result or not isinstance(result["items"], list):
        result["items"] = []

    return result


async def run_gemini_ocr(file_bytes: bytes, mime_type: str) -> dict:
    """
    Gửi hóa đơn sang Google Gemini Vision với cơ chế tự động Fallback:
    1. Ưu tiên model chính: settings.google_ai_model (mặc định gemini-3.5-flash-lite)
    2. Nếu gặp sự cố, tự động fallback sang gemini-3.6-flash
    """
    if not settings.google_ai_api_key:
        raise ValueError("GOOGLE_AI_API_KEY chưa được cấu hình trong file .env")

    primary_model = settings.google_ai_model or "gemini-3.5-flash-lite"
    fallback_model = "gemini-3.6-flash" if primary_model != "gemini-3.6-flash" else "gemini-3.5-flash-lite"

    try:
        return await _call_gemini_model(primary_model, file_bytes, mime_type)
    except Exception as primary_err:
        logger.warning("Primary OCR provider failed (%s)", type(primary_err).__name__)
        try:
            return await _call_gemini_model(fallback_model, file_bytes, mime_type)
        except Exception as fallback_err:
            logger.error("Fallback OCR provider failed (%s)", type(fallback_err).__name__)
            raise RuntimeError("Dịch vụ OCR tạm thời không khả dụng") from None
