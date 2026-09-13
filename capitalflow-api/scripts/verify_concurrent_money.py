"""Bounded SQL Server concurrency check using only a temporary synthetic user.

Commits synthetic rows to permit independent connections, deletes them in finally.
Never calls email/OCR providers or changes existing users.
"""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from uuid import uuid4
from sqlalchemy import select, delete, func
from starlette.requests import Request
from app.core.database import SessionLocal, engine
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.idempotency import IdempotencyRecord
from app.api.routes.transactions import transfer_tx
from app.schemas.transaction import TransactionTransfer
from app.services.transaction_service import record_balance_adjustment


def verify():
    if engine.dialect.name != "mssql":raise RuntimeError("Requires SQL Server")
    uid = uuid4()
    try:
        with SessionLocal() as db:
            user = User(id=uid, email=f"concurrency-{uid}@example.invalid", full_name="Synthetic concurrency check", password_hash="not-a-login-hash", role="USER", is_active=True)
            db.add(user); db.flush()
            a = Account(user_id=uid, name="A", account_type="BANK", balance=0, currency="VND")
            b = Account(user_id=uid, name="B", account_type="BANK", balance=0, currency="VND")
            db.add_all([a, b]); db.flush()
            record_balance_adjustment(db, a, uid, Decimal("1000"))
            record_balance_adjustment(db, b, uid, Decimal("1000"))
            db.commit(); aid, bid = a.id, b.id

        def transfer(index):
            with SessionLocal() as db:
                db.info["request"] = Request({"type": "http", "method": "POST", "path": "/api/v1/transactions/transfer", "headers": [(b"idempotency-key", f"concurrency-{index}".encode())], "query_string": b""})
                payload = TransactionTransfer(from_account_id=aid if index % 2 else bid, to_account_id=bid if index % 2 else aid, amount=Decimal("1"))
                return index, transfer_tx(payload=payload, db=db, user=db.get(User, uid))

        # Four connections, twenty distinct operations, every request delivered twice.
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(transfer, [i for i in range(20) for _ in range(2)]))
        grouped = {}
        for index, response in results:
            if index in grouped:assert grouped[index] == response
            grouped[index] = response
        with SessionLocal() as db:
            assert db.get(Account, aid).balance == 1000
            assert db.get(Account, bid).balance == 1000
            assert db.scalar(select(func.count()).select_from(Transaction).where(Transaction.user_id == uid, Transaction.kind == "TRANSFER")) == 40
            assert db.scalar(select(func.count()).select_from(IdempotencyRecord).where(IdempotencyRecord.user_id == uid)) == 20
    finally:
        with SessionLocal() as db:
            for model in (IdempotencyRecord, Transaction, Account):
                db.execute(delete(model).where(model.user_id == uid))
            db.execute(delete(User).where(User.id == uid)); db.commit()
        with SessionLocal() as db:
            assert db.get(User, uid) is None
    print("SQL Server: 4 concurrent connections, 40 requests, 20 transfers, no duplicate money; synthetic rows removed.")


if __name__ == "__main__":verify()
