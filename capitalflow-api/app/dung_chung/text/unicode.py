"""Chuẩn hóa Unicode tại mọi ranh giới nhận dữ liệu văn bản bên ngoài."""

import unicodedata


def normalize_unicode_text(value: str, *, strip: bool = False) -> str:
    """Trả về văn bản NFC và từ chối ký tự chứng minh dữ liệu đã bị lỗi giải mã."""
    normalized = unicodedata.normalize("NFC", value)
    if "\ufffd" in normalized:
        raise ValueError("Dữ liệu chứa ký tự Unicode không hợp lệ")
    if "\x00" in normalized:
        raise ValueError("Dữ liệu chứa ký tự null không hợp lệ")
    return normalized.strip() if strip else normalized


def normalize_unicode_tree(value):
    """Chuẩn hóa mọi chuỗi bên trong một giá trị tương thích JSON đã giải mã."""
    if isinstance(value, str):
        return normalize_unicode_text(value)
    if isinstance(value, list):
        return [normalize_unicode_tree(item) for item in value]
    if isinstance(value, dict):
        return {key: normalize_unicode_tree(item) for key, item in value.items()}
    return value
