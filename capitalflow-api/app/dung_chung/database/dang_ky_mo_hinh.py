"""Đăng ký các ánh xạ ORM với metadata SQLAlchemy.

Vai trò: import tập trung để migration và khởi tạo schema nhìn thấy đầy đủ bảng.
Đầu vào: các lớp model trong package.
Đầu ra: namespace model dùng chung cho app và công cụ CSDL.
Ràng buộc: không bỏ import model đang tồn tại nếu chưa kiểm tra metadata/migration.
"""

from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.ban_ghi_luy_dang import IdempotencyRecord
from app.dung_chung.email.luu_tru.cau_hinh_he_thong import SystemSetting
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.dat_lai_mat_khau import PasswordResetOTP
from app.dung_chung.email.luu_tru.nhat_ky_email import EmailLog
from app.dung_chung.database.nen_tang import Base
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User, UserRole
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category, CategoryType
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account, AccountType
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.luu_tru.thong_bao import Notification
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction, TransactionType
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget, BudgetPeriod, BudgetChange
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.refresh_token import RefreshToken
from app.chuc_nang.quan_tri.nhat_ky_quan_tri.luu_tru.nhat_ky import AuditLog
from app.chuc_nang.quan_tri.nguoi_dung.luu_tru.xoa_nguoi_dung import UserDeletionRequest, UserDeletionFile

__all__ = [
    "Base", "User", "UserRole", "Category", "CategoryType", "Account", "AccountType",
    "Invoice", "InvoiceItem", "OcrJob", "Transaction", "TransactionType", "Budget", "BudgetPeriod", "BudgetChange",
    "RefreshToken", "AuditLog", "SystemSetting", "UserDeletionRequest", "UserDeletionFile", "Notification"
]
