"""Đăng ký các ánh xạ ORM với metadata SQLAlchemy.

Vai trò: import tập trung để migration và khởi tạo schema nhìn thấy đầy đủ bảng.
Đầu vào: các lớp model trong package.
Đầu ra: namespace model dùng chung cho app và công cụ CSDL.
Ràng buộc: không bỏ import model đang tồn tại nếu chưa kiểm tra metadata/migration.
"""

from app.modules.jobs.persistence.background_job import BackgroundJob
from app.modules.taichinh.persistence.idempotency_record import IdempotencyRecord
from app.modules.email.persistence.system_setting import SystemSetting
from app.modules.dangnhap.persistence.password_reset import PasswordResetOTP
from app.modules.email.persistence.email_log import EmailLog
from app.shared.database.base import Base
from app.modules.dangnhap.persistence.user import User, UserRole
from app.modules.danhmuc.persistence.category import Category, CategoryType
from app.modules.taichinh.persistence.account import Account, AccountType
from app.modules.hoadon.persistence.invoice import Invoice
from app.modules.hoadon.persistence.invoice_item import InvoiceItem
from app.modules.hoadon.persistence.ocr_job import OcrJob
from app.modules.taichinh.persistence.transaction import Transaction, TransactionType
from app.modules.taichinh.persistence.budget import Budget, BudgetPeriod
from app.modules.dangnhap.persistence.refresh_token import RefreshToken
from app.modules.admin.persistence.audit_log import AuditLog
from app.modules.admin.persistence.user_deletion import UserDeletionRequest, UserDeletionFile

__all__ = [
    "Base", "User", "UserRole", "Category", "CategoryType", "Account", "AccountType",
    "Invoice", "InvoiceItem", "OcrJob", "Transaction", "TransactionType", "Budget", "BudgetPeriod",
    "RefreshToken", "AuditLog", "SystemSetting", "UserDeletionRequest", "UserDeletionFile"
]
