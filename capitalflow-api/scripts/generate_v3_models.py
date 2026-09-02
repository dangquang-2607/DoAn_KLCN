import os

models_dir = r"d:\code\DoAn_KLCN\capitalflow-api\app\models"

base_py = """import uuid
from datetime import datetime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import DateTime, func, Uuid

class Base(DeclarativeBase):
    pass
"""

user_py = """import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(500), nullable=False)
    role: Mapped[UserRole] = mapped_column(String(20), default=UserRole.USER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())
"""

category_py = """import enum
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, func, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class CategoryType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"

class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[CategoryType] = mapped_column(String(20), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_categories_owner_user", "owner_user_id", "is_active", "type", "sort_order"),
        Index("UX_categories_global_name_type", "name", "type", unique=True, postgresql_where=(owner_user_id.is_(None)), mssql_where=None), 
        # mssql_where will be manually handled or we just let it be, SQLAlchemy supports dialect specific where.
        # Actually in V3 SQL, the user manually defined filtered unique indexes. We don't strictly need them in SQLAlchemy if we don't auto-gen them.
    )
"""

account_py = """import enum
import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import String, Boolean, Numeric, DateTime, ForeignKey, func, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class AccountType(str, enum.Enum):
    BANK = "BANK"
    CASH = "CASH"
    CRYPTO = "CRYPTO"
    E_WALLET = "E_WALLET"
    CREDIT_CARD = "CREDIT_CARD"
    SAVINGS = "SAVINGS"
    INVESTMENT = "INVESTMENT"
    OTHER = "OTHER"

class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(String(30), nullable=False)
    institution_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    balance: Mapped[Decimal] = mapped_column(Numeric(19, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="VND")
    icon: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_accounts_user_type", "user_id", "account_type", "is_active"),
    )
"""

invoice_py = """import uuid
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import String, Numeric, DateTime, Date, BigInteger, ForeignKey, func, Uuid, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    
    source: Mapped[str] = mapped_column(String(20), default="UPLOAD")
    status: Mapped[str] = mapped_column(String(30), default="UPLOADED")
    
    merchant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    merchant_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    merchant_tax_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    
    subtotal_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    tax_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    discount_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="VND")
    
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    
    ocr_provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ocr_model: Mapped[str | None] = mapped_column(String(150), nullable=True)
    ocr_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    ocr_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index("IX_invoices_user", "user_id", "created_at"),
        Index("IX_invoices_parent", "parent_id", "created_at"),
        Index("IX_invoices_user_status_date", "user_id", "status", "invoice_date", "created_at"),
        Index("IX_invoices_account", "account_id"),
        Index("IX_invoices_category", "category_id"),
    )
"""

invoice_item_py = """import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import String, Numeric, DateTime, ForeignKey, func, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"))
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(19, 4), nullable=True)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    total_price: Mapped[Decimal | None] = mapped_column(Numeric(19, 2), nullable=True)
    sku_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_invoice_items_invoice", "invoice_id"),
    )
"""

ocr_job_py = """import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func, Uuid, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class OcrJob(Base):
    __tablename__ = "ocr_jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"))
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_ocr_jobs_user_created", "user_id", "created_at"),
        Index("IX_ocr_jobs_status_created", "status", "created_at"),
        Index("IX_ocr_jobs_invoice", "invoice_id", "created_at"),
    )
"""

transaction_py = """import enum
import uuid
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import String, Numeric, DateTime, Date, ForeignKey, func, Uuid, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class TransactionType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"

class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    type: Mapped[TransactionType] = mapped_column(String(20), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())

    __table_args__ = (
        Index("UX_transactions_invoice", "invoice_id", unique=True, mssql_where=None),
        Index("IX_transactions_user_date", "user_id", "transaction_date", "created_at"),
        Index("IX_transactions_date", "transaction_date"),
        Index("IX_transactions_user_account_date", "user_id", "account_id", "transaction_date"),
        Index("IX_transactions_user_category_date", "user_id", "category_id", "transaction_date"),
        Index("IX_transactions_user_type_date", "user_id", "type", "transaction_date"),
    )
"""

budget_py = """import enum
import uuid
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import String, Numeric, DateTime, Date, ForeignKey, func, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class BudgetPeriod(str, enum.Enum):
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"
    CUSTOM = "CUSTOM"

class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    period: Mapped[BudgetPeriod] = mapped_column(String(20), default=BudgetPeriod.MONTHLY)
    
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime(), onupdate=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_budgets_user", "user_id", "start_date", "end_date"),
        Index("IX_budgets_user_category_period", "user_id", "category_id", "period", "start_date"),
    )
"""

refresh_token_py = """import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func, Uuid, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    token_hash: Mapped[str] = mapped_column(String(500), nullable=False)
    family_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_refresh_tokens_user_expiry", "user_id", "expires_at"),
        Index("IX_refresh_tokens_family", "family_id", "created_at"),
        Index("IX_refresh_tokens_active", "user_id", "family_id", "revoked_at", "expires_at"),
    )
"""

audit_log_py = """import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func, Uuid, Index, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False)
    
    old_values: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_values: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.sysutcdatetime())

    __table_args__ = (
        Index("IX_audit_logs_user", "user_id", "created_at"),
        Index("IX_audit_logs_created_at", "created_at"),
        Index("IX_audit_logs_entity", "entity_type", "entity_id", "created_at"),
        Index("IX_audit_logs_request", "request_id"),
    )
"""

init_py = """from app.models.base import Base
from app.models.user import User, UserRole
from app.models.category import Category, CategoryType
from app.models.account import Account, AccountType
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.ocr_job import OcrJob
from app.models.transaction import Transaction, TransactionType
from app.models.budget import Budget, BudgetPeriod
from app.models.refresh_token import RefreshToken
from app.models.audit_log import AuditLog

__all__ = [
    "Base", "User", "UserRole", "Category", "CategoryType", "Account", "AccountType",
    "Invoice", "InvoiceItem", "OcrJob", "Transaction", "TransactionType", "Budget", "BudgetPeriod",
    "RefreshToken", "AuditLog"
]
"""

models = {
    "base.py": base_py,
    "user.py": user_py,
    "category.py": category_py,
    "account.py": account_py,
    "invoice.py": invoice_py,
    "invoice_item.py": invoice_item_py,
    "ocr_job.py": ocr_job_py,
    "transaction.py": transaction_py,
    "budget.py": budget_py,
    "refresh_token.py": refresh_token_py,
    "audit_log.py": audit_log_py,
    "__init__.py": init_py,
}

for filename, content in models.items():
    filepath = os.path.join(models_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Generated {filename}")
