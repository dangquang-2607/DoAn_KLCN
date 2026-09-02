import os

routes_dir = r"d:\code\DoAn_KLCN\capitalflow-api\app\api\routes"

invoices_py = """import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.config import settings
from app.models.invoice import Invoice
from app.models.ocr_job import OcrJob
from app.models.user import User
from app.models.transaction import TransactionType
from app.services.gemini_service import run_gemini_ocr
from app.services.transaction_service import create_transaction
from app.schemas.invoice import InvoiceConfirm, InvoiceOut
from decimal import Decimal
import json

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])

ALLOWED_MIME = {
    "image/jpeg", "image/png", "image/webp",
    "application/pdf",
}
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}

@router.post("", status_code=201)
async def upload_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Định dạng không hỗ trợ: {ext}")

    contents = await file.read()
    stored_name = f"{uuid.uuid4()}{ext}"
    upload_path = Path(settings.upload_dir) / stored_name
    upload_path.parent.mkdir(parents=True, exist_ok=True)
    upload_path.write_bytes(contents)

    invoice = Invoice(
        user_id=user.id,
        original_filename=file.filename,
        storage_key=stored_name,
        mime_type=file.content_type or "application/octet-stream",
        file_size_bytes=len(contents),
        source="UPLOAD",
        status="UPLOADED",
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return {"id": str(invoice.id), "filename": invoice.original_filename, "status": invoice.status}

@router.get("", response_model=list[InvoiceOut])
def list_invoices(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invoices = db.scalars(
        select(Invoice).where(Invoice.user_id == user.id).order_by(Invoice.created_at.desc())
    ).all()
    return invoices

@router.post("/{invoice_id}/ocr")
async def run_ocr(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")
    if invoice.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Hóa đơn đã được xử lý")

    ocr_job = OcrJob(
        user_id=user.id,
        invoice_id=invoice.id,
        status="PROCESSING",
        provider="gemini-2.0-flash",
        started_at=datetime.now(timezone.utc)
    )
    invoice.status = "PROCESSING"
    db.add(ocr_job)
    db.commit()

    try:
        file_path = Path(settings.upload_dir) / (invoice.storage_key or "")
        file_bytes = file_path.read_bytes()
        ocr_data = await run_gemini_ocr(file_bytes, invoice.mime_type)

        # Mapping data to Invoice model
        if "ngay_lap" in ocr_data:
            try:
                day, month, year = map(int, ocr_data["ngay_lap"].split("/"))
                invoice.invoice_date = datetime(year, month, day).date()
            except:
                pass
        
        amt_str = "".join(filter(str.isdigit, str(ocr_data.get("tong_thanh_toan", "0"))))
        invoice.total_amount = Decimal(amt_str) if amt_str else Decimal("0")
        
        invoice.merchant_name = ocr_data.get("ten_nguoi_ban_mua")
        invoice.invoice_number = ocr_data.get("so_hoa_don")
        invoice.extracted_json = json.dumps(ocr_data, ensure_ascii=False)
        invoice.status = "REVIEW_REQUIRED"
        
        ocr_job.status = "COMPLETED"
        ocr_job.completed_at = datetime.now(timezone.utc)
        ocr_job.raw_response = invoice.extracted_json
        
        db.commit()
        return {"success": True, "invoice_id": str(invoice.id), "result": ocr_data}

    except Exception as e:
        invoice.status = "FAILED"
        ocr_job.status = "FAILED"
        ocr_job.error_message = str(e)
        ocr_job.completed_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(status_code=500, detail=f"OCR thất bại: {str(e)}")

@router.delete("/{invoice_id}", status_code=204)
def delete_invoice(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")
    try:
        if invoice.storage_key:
            Path(settings.upload_dir, invoice.storage_key).unlink(missing_ok=True)
    except Exception:
        pass
    
    # Delete related ocr jobs
    jobs = db.scalars(select(OcrJob).where(OcrJob.invoice_id == invoice.id)).all()
    for job in jobs:
        db.delete(job)
        
    db.delete(invoice)
    db.commit()

@router.post("/{invoice_id}/confirm", status_code=201)
def confirm_invoice(
    invoice_id: uuid.UUID,
    payload: InvoiceConfirm,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id)
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")
    if invoice.status not in ["REVIEW_REQUIRED", "UPLOADED"]:
        raise HTTPException(status_code=400, detail="Hóa đơn chưa ở trạng thái có thể xác nhận")

    desc = invoice.merchant_name or f"Hóa đơn {invoice.invoice_number or ''}".strip() or "Hóa đơn OCR"
    
    txn = create_transaction(
        db=db,
        user_id=user.id,
        account_id=payload.account_id,
        category_id=payload.category_id,
        description=desc,
        amount=invoice.total_amount or Decimal("0"),
        type=TransactionType.EXPENSE,
        transaction_date=invoice.invoice_date or datetime.now().date(),
        note=payload.note,
    )
    
    invoice.status = "COMPLETED"
    invoice.confirmed_at = datetime.now(timezone.utc)
    invoice.account_id = payload.account_id
    invoice.category_id = payload.category_id
    db.commit()
    
    return {"success": True, "transaction_id": str(txn.id)}
"""

budgets_py = """from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text, select
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.budget import Budget
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetOut, BudgetUpdate, BudgetProgressOut

router = APIRouter(prefix="/api/budgets", tags=["Budgets"])

@router.get("", response_model=list[BudgetProgressOut])
def list_budgets(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Query view V3 vw_budget_progress via raw SQL for fastest performance
    query = text("SELECT * FROM dbo.vw_budget_progress WHERE user_id = :u_id")
    result = db.execute(query, {"u_id": user.id}).mappings().all()
    
    return [BudgetProgressOut(**row) for row in result]

@router.post("", response_model=BudgetOut, status_code=201)
def create_budget(
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    budget = Budget(user_id=user.id, **payload.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget

@router.patch("/{budget_id}", response_model=BudgetOut)
def update_budget(
    budget_id: UUID,
    payload: BudgetUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    budget = db.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngân sách")
        
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(budget, k, v)
        
    db.commit()
    db.refresh(budget)
    return budget

@router.delete("/{budget_id}", status_code=204)
def delete_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    budget = db.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngân sách")
    db.delete(budget)
    db.commit()
"""

transactions_py = """import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionOut, TransactionPage, TransactionUpdate
from app.services.transaction_service import create_transaction, update_transaction, delete_transaction

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

@router.get("", response_model=TransactionPage)
def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: str | None = None,
    account_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Transaction).where(Transaction.user_id == user.id)
    
    if type:
        q = q.where(Transaction.type == type)
    if account_id:
        q = q.where(Transaction.account_id == account_id)
    if category_id:
        q = q.where(Transaction.category_id == category_id)
    if start_date:
        q = q.where(Transaction.transaction_date >= start_date)
    if end_date:
        q = q.where(Transaction.transaction_date <= end_date)
        
    # V3 schema prioritizes user_id and transaction_date DESC index
    q = q.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
    
    total = len(db.scalars(q).all()) # Not perfectly optimized but ok for now
    items = db.scalars(q.offset((page - 1) * page_size).limit(page_size)).all()
    
    return TransactionPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size
    )

@router.post("", response_model=TransactionOut, status_code=201)
def create_tx(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    txn = create_transaction(db, user.id, **payload.model_dump())
    return txn

@router.patch("/{tx_id}", response_model=TransactionOut)
def update_tx(
    tx_id: uuid.UUID,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    txn = update_transaction(db, tx_id, user.id, payload)
    return txn

@router.delete("/{tx_id}", status_code=204)
def delete_tx(
    tx_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    delete_transaction(db, tx_id, user.id)
"""

services_dir = r"d:\code\DoAn_KLCN\capitalflow-api\app\services"
transaction_service_py = """import uuid
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.transaction import Transaction, TransactionType
from app.schemas.transaction import TransactionUpdate

def _adjust_balance(db: Session, account_id: uuid.UUID, amount: Decimal, tx_type: TransactionType, is_revert=False):
    acc = db.scalar(select(Account).where(Account.id == account_id).with_for_update())
    if not acc:
        raise HTTPException(status_code=404, detail="Tài khoản không tồn tại")
        
    # V3 Rule: INCOME >= 0, EXPENSE <= 0
    # The frontend/api should ideally pass positive numbers and we negate for expense, or they pass negative.
    # Let's ensure amount is handled properly:
    # If type is EXPENSE and amount > 0, make it negative.
    actual_amount = abs(amount) if tx_type == TransactionType.INCOME else -abs(amount)
    
    if is_revert:
        acc.balance -= actual_amount
    else:
        acc.balance += actual_amount

def create_transaction(db: Session, user_id: uuid.UUID, **kwargs) -> Transaction:
    amount = kwargs.get("amount", Decimal("0"))
    tx_type = kwargs.get("type", TransactionType.EXPENSE)
    
    # Ensure amount rules
    if tx_type == TransactionType.EXPENSE and amount > 0:
        kwargs["amount"] = -amount
    elif tx_type == TransactionType.INCOME and amount < 0:
        kwargs["amount"] = abs(amount)
        
    txn = Transaction(user_id=user_id, **kwargs)
    db.add(txn)
    
    _adjust_balance(db, txn.account_id, txn.amount, txn.type)
    
    db.commit()
    db.refresh(txn)
    return txn

def update_transaction(db: Session, tx_id: uuid.UUID, user_id: uuid.UUID, payload: TransactionUpdate) -> Transaction:
    txn = db.scalar(select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id))
    if not txn:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")
        
    # Revert old
    _adjust_balance(db, txn.account_id, txn.amount, txn.type, is_revert=True)
    
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(txn, k, v)
        
    # Enforce amount rules after update
    if txn.type == TransactionType.EXPENSE and txn.amount > 0:
        txn.amount = -txn.amount
    elif txn.type == TransactionType.INCOME and txn.amount < 0:
        txn.amount = abs(txn.amount)
        
    # Apply new
    _adjust_balance(db, txn.account_id, txn.amount, txn.type, is_revert=False)
    
    db.commit()
    db.refresh(txn)
    return txn

def delete_transaction(db: Session, tx_id: uuid.UUID, user_id: uuid.UUID):
    txn = db.scalar(select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == user_id))
    if not txn:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")
        
    # Revert
    _adjust_balance(db, txn.account_id, txn.amount, txn.type, is_revert=True)
    
    db.delete(txn)
    db.commit()
"""

routes = {
    "invoices.py": invoices_py,
    "budgets.py": budgets_py,
    "transactions.py": transactions_py,
}

for filename, content in routes.items():
    filepath = os.path.join(routes_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Generated {filename}")

with open(os.path.join(services_dir, "transaction_service.py"), "w", encoding="utf-8") as f:
    f.write(transaction_service_py)
print("Generated transaction_service.py")
