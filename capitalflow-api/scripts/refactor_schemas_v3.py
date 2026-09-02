import os

schemas_dir = r"d:\code\DoAn_KLCN\capitalflow-api\app\schemas"

account_py = """from decimal import Decimal
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel

from app.models.account import AccountType


class AccountCreate(BaseModel):
    name: str
    account_type: AccountType
    institution_name: str | None = None
    balance: Decimal = Decimal("0")
    currency: str = "VND"
    icon: str | None = None
    color: str | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    account_type: AccountType | None = None
    institution_name: str | None = None
    balance: Decimal | None = None
    currency: str | None = None
    icon: str | None = None
    color: str | None = None
    is_active: bool | None = None


class AccountOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    account_type: AccountType
    institution_name: str | None
    balance: Decimal
    currency: str
    icon: str | None
    color: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
"""

budget_py = """from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.budget import BudgetPeriod


class BudgetCreate(BaseModel):
    category_id: UUID | None = None
    amount: Decimal
    period: BudgetPeriod = BudgetPeriod.MONTHLY
    start_date: date
    end_date: date


class BudgetUpdate(BaseModel):
    amount: Decimal | None = None
    period: BudgetPeriod | None = None
    start_date: date | None = None
    end_date: date | None = None


class BudgetOut(BaseModel):
    id: UUID
    user_id: UUID
    category_id: UUID | None
    amount: Decimal
    period: BudgetPeriod
    start_date: date
    end_date: date
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class BudgetProgressOut(BaseModel):
    budget_id: UUID
    user_id: UUID
    category_id: UUID | None
    budget_amount: Decimal
    period: str
    start_date: date
    end_date: date
    spent_amount: Decimal
    remaining_amount: Decimal
    usage_percent: float
    status: str
"""

category_py = """from uuid import UUID
from datetime import datetime

from pydantic import BaseModel

from app.models.category import CategoryType


class CategoryCreate(BaseModel):
    name: str
    type: CategoryType
    icon: str | None = None
    color: str | None = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = None
    type: CategoryType | None = None
    icon: str | None = None
    color: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CategoryOut(BaseModel):
    id: UUID
    name: str
    type: CategoryType
    icon: str | None
    color: str | None
    sort_order: int
    is_active: bool
    owner_user_id: UUID | None  # None = global category
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
"""

transaction_py = """from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.transaction import TransactionType


class TransactionCreate(BaseModel):
    account_id: UUID
    category_id: UUID | None = None
    invoice_id: UUID | None = None
    amount: Decimal
    type: TransactionType
    transaction_date: date
    description: str | None = None
    note: str | None = None


class TransactionUpdate(BaseModel):
    account_id: UUID | None = None
    category_id: UUID | None = None
    invoice_id: UUID | None = None
    amount: Decimal | None = None
    type: TransactionType | None = None
    transaction_date: date | None = None
    description: str | None = None
    note: str | None = None


class TransactionOut(BaseModel):
    id: UUID
    user_id: UUID
    account_id: UUID
    category_id: UUID | None
    invoice_id: UUID | None
    amount: Decimal
    type: TransactionType
    transaction_date: date
    description: str | None
    note: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    page_size: int
"""

invoice_py = """from decimal import Decimal
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class InvoiceItemOut(BaseModel):
    id: UUID
    item_name: str
    quantity: Decimal | None
    unit_price: Decimal | None
    total_price: Decimal | None
    sku_code: str | None

    model_config = {"from_attributes": True}


class InvoiceOut(BaseModel):
    id: UUID
    user_id: UUID
    parent_id: UUID | None
    account_id: UUID | None
    category_id: UUID | None
    source: str
    status: str
    merchant_name: str | None
    merchant_address: str | None
    merchant_tax_code: str | None
    invoice_number: str | None
    invoice_date: date | None
    subtotal_amount: Decimal | None
    tax_amount: Decimal | None
    discount_amount: Decimal | None
    total_amount: Decimal | None
    currency: str
    original_filename: str | None
    mime_type: str | None
    ocr_provider: str | None
    ocr_confidence: Decimal | None
    note: str | None
    created_at: datetime
    updated_at: datetime
    confirmed_at: datetime | None

    model_config = {"from_attributes": True}


class InvoiceConfirm(BaseModel):
    account_id: UUID
    category_id: UUID | None = None
    note: str | None = None
"""

ocr_job_py = """from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

class OcrJobOut(BaseModel):
    id: UUID
    user_id: UUID
    invoice_id: UUID
    status: str
    provider: str | None
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
"""

schemas = {
    "account.py": account_py,
    "budget.py": budget_py,
    "category.py": category_py,
    "transaction.py": transaction_py,
    "invoice.py": invoice_py,
    "ocr_job.py": ocr_job_py,
}

for filename, content in schemas.items():
    filepath = os.path.join(schemas_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Generated {filename}")
