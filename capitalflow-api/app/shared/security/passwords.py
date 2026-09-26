"""Cung cấp hàm nền tảng bảo vệ mật khẩu cho toàn hệ thống.

Vai trò: băm mật khẩu mới và kiểm tra mật khẩu với giá trị đã lưu.
Đầu vào: mật khẩu dạng rõ tại biên xác thực và chuỗi băm trong CSDL.
Đầu ra: chuỗi băm an toàn hoặc kết quả kiểm tra đúng/sai.
Ràng buộc: dùng cấu hình Argon2 được thư viện khuyến nghị; không log mật khẩu.
"""

from pwdlib import PasswordHash


# Tầng kỹ thuật: một instance dùng chung giúp thuật toán và tham số băm nhất quán.
password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Băm mật khẩu bằng cấu hình Argon2 được khuyến nghị."""
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Kiểm tra mật khẩu dạng rõ với chuỗi băm đã lưu."""
    return password_hash.verify(password, hashed_password)
