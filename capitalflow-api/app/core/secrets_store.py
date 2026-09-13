from cryptography.fernet import Fernet
from app.core.config import settings

PREFIX="fernet:"

def seal(value):
    return PREFIX+Fernet(settings.job_encryption_key.encode()).encrypt(value.encode()).decode() if value else ""

def unseal(value):
    if not value:return ""
    if not value.startswith(PREFIX):raise ValueError("Unmigrated secret")
    return Fernet(settings.job_encryption_key.encode()).decrypt(value[len(PREFIX):].encode()).decode()
