"""ASGI wrapper chỉ dành cho staging, cung cấp endpoint phục vụ kiểm thử tải.

Vai trò: bootstrap fixture, đo pool/SQL telemetry và kiểm tra toàn vẹn sau từng bậc tải.
Đầu vào: request có X-Load-Test-Key và CSDL staging chuyên dụng.
Đầu ra/side effect: dữ liệu giả tạm, metric giới hạn cardinality và kết quả integrity.
Ràng buộc an toàn: từ chối production, bảo vệ bằng secret và có endpoint cleanup fixture.
"""

import hmac
import os
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import TypedDict, cast

import anyio.to_thread
from fastapi import Header, HTTPException, Query
from sqlalchemy import delete, func, select, text
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session
from sqlalchemy.pool import QueuePool
from starlette.concurrency import run_in_threadpool

from app.shared.config import settings
from app.shared.database.engine import engine
from app.shared.security.tokens import create_access_token
from app.shared.observability.telemetry import telemetry
from app.main import app
from app.modules.taichinh.persistence.account import Account
from app.modules.admin.persistence.audit_log import AuditLog
from app.modules.taichinh.persistence.idempotency_record import IdempotencyRecord
from app.modules.taichinh.persistence.transaction import Transaction
from app.modules.dangnhap.persistence.user import User


def require_load_test_key(x_load_test_key: str) -> None:
    expected = os.environ.get("LOAD_TEST_KEY", "")
    if (
        settings.app_env.lower() == "production"
        or not expected
        or not hmac.compare_digest(x_load_test_key, expected)
    ):
        raise HTTPException(status_code=404)


class SqlRuntimeSnapshot(TypedDict):
    """Snapshot nhỏ, không chứa câu SQL, credential hoặc định danh người dùng."""

    database_sessions: int | None
    deadlocks: int | None
    waits_ms: dict[str, int]


def sql_runtime_snapshot(connection: Connection) -> SqlRuntimeSnapshot:
    result: SqlRuntimeSnapshot = {
        "database_sessions": None,
        "deadlocks": None,
        "waits_ms": {},
    }
    try:
        result["database_sessions"] = int(connection.scalar(text(
            "SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE database_id = DB_ID()"
        )) or 0)
        result["deadlocks"] = int(connection.scalar(text(
            "SELECT COALESCE(SUM(cntr_value), 0) FROM sys.dm_os_performance_counters "
            "WHERE counter_name='Number of Deadlocks/sec' AND instance_name='_Total'"
        )) or 0)
        rows = connection.execute(text(
            "SELECT wait_type, wait_time_ms FROM sys.dm_os_wait_stats "
            "WHERE wait_type IN ('LCK_M_S','LCK_M_U','LCK_M_X','PAGEIOLATCH_SH',"
            "'PAGEIOLATCH_EX','WRITELOG','RESOURCE_SEMAPHORE','THREADPOOL')"
        ))
        result["waits_ms"] = {str(row[0]): int(row[1]) for row in rows}
    except Exception:
        # Quyền đọc DMV có thể bị hạn chế trên SQL Server staging đã harden.
        pass
    return result


@app.get("/__loadtest/pool", include_in_schema=False)
async def load_test_pool(x_load_test_key: str = Header(default="")):
    require_load_test_key(x_load_test_key)
    pool = cast(QueuePool, engine.pool)
    limiter = anyio.to_thread.current_default_thread_limiter()
    sql_metrics: SqlRuntimeSnapshot = {
        "database_sessions": None,
        "deadlocks": None,
        "waits_ms": {},
    }

    def read_sql_metrics() -> SqlRuntimeSnapshot:
        try:
            with engine.connect() as connection:
                return sql_runtime_snapshot(connection)
        except Exception:
            return {"database_sessions": None, "deadlocks": None, "waits_ms": {}}

    sql_metrics = await run_in_threadpool(read_sql_metrics)
    return {
        "pid": os.getpid(),
        "size": pool.size(),
        "checked_out": pool.checkedout(),
        "checked_in": pool.checkedin(),
        "overflow": pool.overflow(),
        "anyio_thread_tokens_total": limiter.total_tokens,
        "anyio_thread_tokens_borrowed": limiter.borrowed_tokens,
        **sql_metrics,
        "telemetry": telemetry.snapshot(),
    }


@app.post("/__loadtest/telemetry/reset", include_in_schema=False)
def reset_load_test_telemetry(x_load_test_key: str = Header(default="")):
    require_load_test_key(x_load_test_key)
    telemetry.reset()
    return {"status": "reset", "pid": os.getpid()}


@app.post("/__loadtest/bootstrap", include_in_schema=False)
def bootstrap_load_test(
    seed_transactions: int = Query(default=0, ge=0, le=500_000),
    x_load_test_key: str = Header(default=""),
):
    """Tạo user giả lập duy nhất trong database staging dành riêng cho load test."""
    require_load_test_key(x_load_test_key)
    run_id = uuid.uuid4().hex
    user_id = uuid.uuid4()
    account_a = uuid.uuid4()
    account_b = uuid.uuid4()
    initial_total = Decimal("2000000000.00")
    with Session(engine) as session:
        session.add(User(
            id=user_id,
            email=f"distributed-load-{run_id}@example.invalid",
            full_name="Distributed Staging Load Test",
            password_hash="not-used",
            role="USER",
            token_version=0,
            is_active=True,
        ))
        session.flush()
        session.add_all([
            Account(
                id=account_a,
                user_id=user_id,
                name="Distributed Load A",
                account_type="BANK",
                balance=initial_total / 2,
                currency="VND",
            ),
            Account(
                id=account_b,
                user_id=user_id,
                name="Distributed Load B",
                account_type="BANK",
                balance=initial_total / 2,
                currency="VND",
            ),
        ])
        session.commit()

        seeded = seed_transactions - (seed_transactions % 2)
        batch: list[dict] = []
        for index in range(seeded):
            is_income = index % 2 == 0
            batch.append({
                "id": uuid.uuid4(),
                "user_id": user_id,
                "account_id": account_a,
                "category_id": None,
                "invoice_id": None,
                "description": "Synthetic historical load-test transaction",
                "amount": Decimal("100.00") if is_income else Decimal("-100.00"),
                "type": "INCOME" if is_income else "EXPENSE",
                "source": "SYSTEM",
                "transaction_date": date.today() - timedelta(days=index % 730),
                "kind": "NORMAL",
                "transfer_id": None,
                "note": None,
                "category_confidence": None,
                "category_source": None,
                "category_was_auto": False,
            })
            if len(batch) == 2_000:
                session.bulk_insert_mappings(Transaction, batch)
                session.commit()
                batch.clear()
        if batch:
            session.bulk_insert_mappings(Transaction, batch)
            session.commit()
    return {
        "run_id": run_id,
        "user_id": str(user_id),
        "account_ids": [str(account_a), str(account_b)],
        "access_token": create_access_token(str(user_id), "USER", 0),
        "initial_balance_total": str(initial_total),
        "seeded_transactions": seeded,
    }


@app.get("/__loadtest/integrity/{user_id}", include_in_schema=False)
def load_test_integrity(user_id: uuid.UUID, x_load_test_key: str = Header(default="")):
    require_load_test_key(x_load_test_key)
    with Session(engine) as session:
        balances = session.scalars(select(Account.balance).where(Account.user_id == user_id)).all()
        malformed_pairs = session.scalar(
            select(func.count()).select_from(
                select(Transaction.transfer_id)
                .where(Transaction.user_id == user_id, Transaction.kind == "TRANSFER")
                .group_by(Transaction.transfer_id)
                .having(func.count(Transaction.id) != 2)
                .subquery()
            )
        ) or 0
        transfer_rows = session.scalar(
            select(func.count(Transaction.id)).where(
                Transaction.user_id == user_id,
                Transaction.kind == "TRANSFER",
            )
        ) or 0
        balance_total = sum(balances, Decimal("0"))
    return {
        "balance_total": str(balance_total),
        "transfer_rows": int(transfer_rows),
        "malformed_transfer_pairs": int(malformed_pairs),
    }


@app.delete("/__loadtest/fixture/{user_id}", include_in_schema=False)
def delete_load_test_fixture(user_id: uuid.UUID, x_load_test_key: str = Header(default="")):
    require_load_test_key(x_load_test_key)
    with Session(engine) as session:
        transaction_count = session.scalar(
            select(func.count(Transaction.id)).where(Transaction.user_id == user_id)
        ) or 0
        session.execute(delete(AuditLog).where(AuditLog.user_id == user_id))
        session.execute(delete(IdempotencyRecord).where(IdempotencyRecord.user_id == user_id))
        session.execute(delete(Transaction).where(Transaction.user_id == user_id))
        session.execute(delete(Account).where(Account.user_id == user_id))
        delete_result = session.execute(delete(User).where(User.id == user_id))
        user_count = getattr(delete_result, "rowcount", 0) or 0
        session.commit()
    return {
        "deleted_users": int(user_count),
        "deleted_transactions": int(transaction_count),
    }
