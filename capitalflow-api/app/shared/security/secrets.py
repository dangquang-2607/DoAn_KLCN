"""Mã hóa và giải mã bí mật cần lưu bền vững trong CSDL.

Vai trò: bảo vệ các giá trị như mật khẩu SMTP bằng Fernet.
Đầu vào: khóa mã hóa từ cấu hình và chuỗi bí mật dạng rõ.
Đầu ra: ciphertext để lưu trữ hoặc plaintext cho đúng luồng nghiệp vụ được phép.
Ràng buộc: không log plaintext, khóa mã hóa hoặc ciphertext đầy đủ.
"""

from cryptography.fernet import Fernet
from app.shared.config import settings

PREFIX="fernet:"

def seal(value):
    return PREFIX+Fernet(settings.job_encryption_key.encode()).encrypt(value.encode()).decode() if value else ""

def unseal(value):
    if not value:return ""
    if not value.startswith(PREFIX):raise ValueError("Unmigrated secret")
    return Fernet(settings.job_encryption_key.encode()).decrypt(value[len(PREFIX):].encode()).decode()
