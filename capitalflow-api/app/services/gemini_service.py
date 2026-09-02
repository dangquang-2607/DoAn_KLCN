"""
Gemini Vision Service — trích xuất dữ liệu hóa đơn bằng Gemini AI.
Chỉ gọi từ server-side. KHÔNG bao giờ expose API key ra client.

Prompt được thiết kế để trả về:
  - Thông tin tổng hợp hóa đơn (người bán, tổng tiền, thuế...)
  - Danh sách chi tiết từng dòng sản phẩm (items[])
"""
import base64
import json
import re

import httpx

from app.core.config import settings

# ─── Prompt chuẩn hóa cho hóa đơn Việt Nam ─────────────────────────────────
_OCR_PROMPT = """Bạn là chuyên gia đọc hóa đơn VAT Việt Nam.
Hãy phân tích ảnh hóa đơn và trả về JSON với cấu trúc chính xác như dưới đây.
Chỉ trả về JSON thuần (không markdown, không giải thích, không ```json).
Nếu không đọc được trường nào, để giá trị null hoặc chuỗi rỗng "".

{
  "so_hoa_don": "số hóa đơn",
  "mau_so_ky_hieu": "mẫu số/ký hiệu hóa đơn",
  "ngay_lap": "dd/MM/yyyy",
  "ma_so_thue": "mã số thuế người bán",
  "ten_nguoi_ban": "tên công ty/cửa hàng người bán",
  "dia_chi_nguoi_ban": "địa chỉ người bán",
  "ten_nguoi_mua": "tên người mua (nếu có)",
  "doanh_so_chua_thue": "số tiền chưa có thuế (chỉ số, không đơn vị)",
  "thue_suat_gtgt": "thuế suất % (VD: 10)",
  "tien_thue_gtgt": "tiền thuế GTGT (chỉ số)",
  "tong_thanh_toan": "tổng tiền thanh toán (chỉ số)",
  "hinh_thuc_thanh_toan": "tiền mặt/chuyển khoản/thẻ",
  "tien_te": "VND",
  "tinh_trang_hoa_don": "Gốc hoặc Điều chỉnh hoặc Thay thế hoặc Huỷ",
  "phan_loai_chi_phi": "loại chi phí suy ra từ nội dung (VD: Ăn uống, Di chuyển, Y tế...)",
  "ma_tra_cuu": "mã tra cứu hóa đơn điện tử (nếu có)",
  "do_tin_cay": 0.95,
  "items": [
    {
      "line_no": 1,
      "ten_hang": "tên hàng hóa/dịch vụ",
      "ma_hang": "mã hàng hóa (nếu có)",
      "don_vi": "đơn vị tính (cái/kg/lít/chiếc/gói...)",
      "so_luong": "số lượng (chỉ số)",
      "don_gia": "đơn giá (chỉ số)",
      "giam_gia": "số tiền giảm giá (chỉ số, null nếu không có)",
      "thue": "tiền thuế riêng dòng này (chỉ số, null nếu không có)",
      "thanh_tien": "thành tiền = số lượng × đơn giá (chỉ số)",
      "do_tin_cay": 0.95,
      "raw_text": "văn bản gốc OCR đọc được của dòng này"
    }
  ]
}

Lưu ý quan trọng:
- Tất cả giá trị tiền tệ CHỈ là số (không có dấu chấm, phẩy phân cách, không có đồng/VNĐ).
- Nếu hóa đơn không có danh sách sản phẩm cụ thể, trả về items là mảng rỗng [].
- Trường do_tin_cay là số thực từ 0.0 đến 1.0, phản ánh độ chính xác bạn đọc được.
"""


async def run_gemini_ocr(file_bytes: bytes, mime_type: str) -> dict:
    """
    Gọi Gemini Vision API để phân tích hóa đơn.
    Trả về dict gồm thông tin tổng hợp và mảng items chi tiết.
    """
    if not settings.google_ai_api_key:
        raise ValueError("GOOGLE_AI_API_KEY chưa được cấu hình trong .env")

    encoded = base64.b64encode(file_bytes).decode()
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.google_ai_model}:generateContent"
    )

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
            "temperature": 0.1,        # Nhiệt độ thấp → kết quả ổn định, ít sáng tạo
            "responseMimeType": "application/json",  # Yêu cầu Gemini trả JSON trực tiếp
        },
    }

    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            url, params={"key": settings.google_ai_api_key}, json=payload
        )
        resp.raise_for_status()
        data = resp.json()

    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
    # Loại bỏ markdown code block nếu Gemini vẫn wrap kết quả
    raw_text = re.sub(r"```(?:json)?", "", raw_text).strip().rstrip("```").strip()

    result = json.loads(raw_text)

    # Đảm bảo items luôn là list
    if "items" not in result or not isinstance(result["items"], list):
        result["items"] = []

    return result
