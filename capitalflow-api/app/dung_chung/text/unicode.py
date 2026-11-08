"""Chuẩn hóa Unicode tại mọi ranh giới nhận dữ liệu văn bản bên ngoài."""

import unicodedata


def normalize_unicode_text(value: str, *, strip: bool = False) -> str:
    """Trả về văn bản NFC và từ chối ký tự chứng minh dữ liệu đã bị lỗi giải mã."""
    if not isinstance(value, str):
        raise ValueError("Dữ liệu văn bản phải là chuỗi")
    normalized = unicodedata.normalize("NFC", value)
    if "\ufffd" in normalized:
        raise ValueError("Dữ liệu chứa ký tự Unicode không hợp lệ")
    if "\x00" in normalized:
        raise ValueError("Dữ liệu chứa ký tự null không hợp lệ")
    return normalized.strip() if strip else normalized


def validate_utf16_length(value: str | None, max_length: int, label: str) -> str | None:
    """Kiểm tra giới hạn lưu trữ NVARCHAR của SQL Server."""
    if value is not None and len(value.encode("utf-16-le")) > max_length * 2:
        raise ValueError(f"{label} vượt giới hạn lưu trữ {max_length} ký tự.")
    return value


def truncate_utf16(value: str, max_length: int) -> str:
    """Giới hạn văn bản OCR theo sức chứa NVARCHAR, giữ nguyên cặp surrogate."""
    return value.encode("utf-16-le")[:max_length * 2].decode("utf-16-le", errors="ignore")


def normalize_unicode_tree(value):
    """Chuẩn hóa mọi chuỗi bên trong một giá trị tương thích JSON đã giải mã."""
    if isinstance(value, str):
        return normalize_unicode_text(value)
    if isinstance(value, list):
        return [normalize_unicode_tree(item) for item in value]
    if isinstance(value, dict):
        return {key: normalize_unicode_tree(item) for key, item in value.items()}
    return value
