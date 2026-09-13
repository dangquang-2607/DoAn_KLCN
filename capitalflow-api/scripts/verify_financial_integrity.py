"""Verify against configured SQL Server with synthetic rows, then roll back all rows."""
from datetime import date
from decimal import Decimal
from uuid import uuid4
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from app.core.database import engine
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.services.transaction_service import create_transaction, update_transaction, transfer_money, record_balance_adjustment
from app.services.reporting import monthly_cashflow, budget_progress, budgets_progress
from app.services.jobs import enqueue
from app.schemas.transaction import TransactionUpdate


def verify():
    user_id = uuid4()
    with engine.connect() as connection:
        outer = connection.begin()
        session = Session(bind=connection, autoflush=False, join_transaction_mode="rollback_only")
        try:
            user = User(id=user_id, email=f"verification-{user_id}@example.invalid", full_name="Rollback verification", password_hash="not-a-login-hash", role="USER")
            session.add(user)
            session.flush()
            a = Account(user_id=user_id, name="A", account_type="BANK", balance=Decimal("0"), currency="VND")
            b = Account(user_id=user_id, name="B", account_type="BANK", balance=Decimal("0"), currency="VND")
            session.add_all([a, b]); session.flush()
            record_balance_adjustment(session, a, user_id, Decimal("1000"))
            session.commit()
            out, incoming = transfer_money(session, user_id, a.id, b.id, Decimal("200"))
            assert out.transfer_id == incoming.transfer_id
            assert session.scalar(select(Account.balance).where(Account.id == a.id)) == 800
            assert session.scalar(select(Account.balance).where(Account.id == b.id)) == 200
            tx = create_transaction(session, user_id, account_id=a.id, amount=Decimal("100"), type="EXPENSE", transaction_date=date.today())
            update_transaction(session, tx.id, user_id, TransactionUpdate(amount=Decimal("50")))
            assert session.scalar(select(Account.balance).where(Account.id == a.id)) == 750
            budget = Budget(user_id=user_id, name="Audit", amount_limit=Decimal("500"), currency="VND", start_date=date.today(), end_date=date.today())
            session.add(budget); session.flush()
            assert budget_progress(session, budget)["spent_amount"] == 50
            assert budgets_progress(session, user_id)[0]["spent_amount"] == 50
            queued = enqueue(session, "BUDGET", {"transaction_id": str(tx.id), "user_id": str(user_id)}, "verification:" + str(user_id))
            session.commit()
            # Verify encrypted payload round-trip without running SMTP or OCR.
            from app.services.jobs import decode
            assert decode(queued)["transaction_id"] == str(tx.id)
            report = monthly_cashflow(session, user_id, date.today().month, date.today().year)[0]
            assert report["income"] == 0 and report["expense"] == 50
            sql_report = session.execute(text("SELECT total_income,total_expense FROM dbo.vw_monthly_cashflow WHERE user_id=:u"), {"u": user_id}).one()
            assert sql_report.total_income == 0 and sql_report.total_expense == 50
            assert session.scalar(select(Account.balance).where(Account.id == a.id)) + session.scalar(select(Account.balance).where(Account.id == b.id)) == 950
            assert outer.is_active, "Verification must not commit the outer transaction"
        finally:
            session.close()
            if outer.is_active:
                outer.rollback()
    with engine.connect() as connection:
        assert connection.scalar(select(User.id).where(User.id == user_id)) is None
    print("SQL Server verification passed; all synthetic rows rolled back.")


if __name__ == "__main__":
    verify()
