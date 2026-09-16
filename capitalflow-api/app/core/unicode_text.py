"""Unicode normalization at external text boundaries."""

import unicodedata


def normalize_unicode_text(value: str, *, strip: bool = False) -> str:
    """Return canonical NFC text and reject characters that prove decoding loss."""
    normalized = unicodedata.normalize("NFC", value)
    if "\ufffd" in normalized:
        raise ValueError("Dữ liệu chứa ký tự Unicode không hợp lệ")
    if "\x00" in normalized:
        raise ValueError("Dữ liệu chứa ký tự null không hợp lệ")
    return normalized.strip() if strip else normalized


def normalize_unicode_tree(value):
    """Normalize every string in a decoded JSON-compatible value."""
    if isinstance(value, str):
        return normalize_unicode_text(value)
    if isinstance(value, list):
        return [normalize_unicode_tree(item) for item in value]
    if isinstance(value, dict):
        return {key: normalize_unicode_tree(item) for key, item in value.items()}
    return value
