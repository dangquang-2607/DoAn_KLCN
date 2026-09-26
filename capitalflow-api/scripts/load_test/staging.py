"""Chạy kiểm thử tải staging trên SQL Server cô lập và luôn dọn CSDL thử.

Vai trò: điều phối API local nhiều worker, tạo CSDL thử và phát tải có đo telemetry.
Đầu vào: cấu hình SQL Server staging, worker/RPS/thời lượng và khóa kiểm thử tải.
Đầu ra/side effect: CSDL tạm, log và báo cáo JSON/Markdown trong vùng artifact.
Ràng buộc an toàn: chỉ dùng staging; tài nguyên tạm được dọn trong khối ``finally``.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import secrets
import statistics
import subprocess
import sys
import time
import uuid
from collections import Counter
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

import httpx
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.shared.config import settings
from app.shared.security.tokens import create_access_token
from app.modules.taichinh.persistence.account import Account
from app.shared.database.base import Base
from app.modules.danhmuc.persistence.category import Category
from app.modules.taichinh.persistence.transaction import Transaction
from app.modules.dangnhap.persistence.user import User
import app.shared.database.model_registry  # noqa: F401 - register all tables


def percentile(values: list[float], quantile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(quantile * len(ordered)) - 1))
    return ordered[index]


def master_engine():
    url = make_url(settings.database_url)
    if not url.drivername.startswith("mssql"):
        raise RuntimeError("Load test requires SQL Server")
    return create_engine(
        url.set(database="master"),
        isolation_level="AUTOCOMMIT",
        connect_args={"timeout": 5},
        pool_pre_ping=True,
        hide_parameters=True,
    )


def deadlock_counter(engine) -> int | None:
    try:
        with engine.connect() as connection:
            return int(
                connection.scalar(
                    text(
                        """
                        SELECT COALESCE(SUM(cntr_value), 0)
                        FROM sys.dm_os_performance_counters
                        WHERE counter_name = 'Number of Deadlocks/sec'
                          AND instance_name = '_Total'
                        """
                    )
                )
                or 0
            )
    except Exception:
        return None


async def wait_ready(base_url: str, process: subprocess.Popen, timeout: float = 30) -> None:
    deadline = time.monotonic() + timeout
    async with httpx.AsyncClient(timeout=1) as client:
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError("Staging API exited during startup")
            try:
                response = await client.get(base_url + "/ready")
                if response.status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            await asyncio.sleep(0.2)
    raise TimeoutError("Staging API did not become ready")


async def execute_load(
    base_url: str,
    token: str,
    load_key: str,
    account_ids: tuple[str, str],
    rps: int,
    duration: int,
    warmup_seconds: int,
) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    limits = httpx.Limits(max_connections=600, max_keepalive_connections=300)
    timeout = httpx.Timeout(15.0, connect=3.0, pool=10.0)
    latencies: list[float] = []
    statuses: Counter[str] = Counter()
    routes: Counter[str] = Counter()
    route_latencies: dict[str, list[float]] = {}
    pool_samples: list[dict] = []
    semaphore = asyncio.Semaphore(600)
    started = time.perf_counter()

    async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
        async def request(index: int, measured: bool) -> None:
            slot = index % 100
            if slot < 30:
                method, path, body, route = "GET", "/api/v1/transactions?page=1&page_size=20", None, "transactions"
            elif slot < 55:
                method, path, body, route = "GET", "/api/v1/dashboard", None, "dashboard"
            elif slot < 70:
                method, path, body, route = "GET", "/api/v1/accounts", None, "accounts"
            elif slot < 85:
                method, path, body, route = "GET", "/api/v1/categories", None, "categories"
            elif slot < 95:
                method, path, body, route = "GET", "/api/v1/budgets", None, "budgets"
            else:
                source, target = account_ids if index % 2 else account_ids[::-1]
                method, path, route = "POST", "/api/v1/transactions/transfer", "transfer"
                body = {
                    "from_account_id": source,
                    "to_account_id": target,
                    "amount": "1.00",
                    "transaction_date": str(date.today()),
                    "note": "isolated staging load test",
                }
            request_headers = headers
            if method == "POST":
                request_headers = {**headers, "Idempotency-Key": f"load-{uuid.uuid4().hex}"}
            async with semaphore:
                before = time.perf_counter()
                try:
                    response = await client.request(method, base_url + path, headers=request_headers, json=body)
                    status = str(response.status_code)
                except Exception as exc:
                    status = "EXC:" + type(exc).__name__
                elapsed_ms = (time.perf_counter() - before) * 1000
            if measured:
                latencies.append(elapsed_ms)
                statuses[status] += 1
                routes[route] += 1
                route_latencies.setdefault(route, []).append(elapsed_ms)

        async def fixed_rate(seconds: int, measured: bool) -> None:
            count = rps * seconds
            phase_start = time.perf_counter()
            tasks = []
            for index in range(count):
                target = phase_start + index / rps
                delay = target - time.perf_counter()
                if delay > 0:
                    await asyncio.sleep(delay)
                tasks.append(asyncio.create_task(request(index, measured)))
            await asyncio.gather(*tasks)

        stop_monitor = asyncio.Event()

        async with httpx.AsyncClient(
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=2),
            timeout=httpx.Timeout(3.0),
        ) as monitor_client:
            async def isolated_monitor_pool() -> None:
                monitor_headers = {"X-Load-Test-Key": load_key}
                while not stop_monitor.is_set():
                    try:
                        response = await monitor_client.get(
                            base_url + "/__loadtest/pool", headers=monitor_headers
                        )
                        if response.status_code == 200:
                            pool_samples.append(response.json())
                    except httpx.HTTPError:
                        pass
                    await asyncio.sleep(0.1)

            monitor = asyncio.create_task(isolated_monitor_pool())
            if warmup_seconds:
                await fixed_rate(warmup_seconds, measured=False)
            measured_start = time.perf_counter()
            await fixed_rate(duration, measured=True)
            measured_elapsed = time.perf_counter() - measured_start
            stop_monitor.set()
            await monitor

    success = sum(count for status, count in statuses.items() if status.startswith("2"))
    total = sum(statuses.values())
    return {
        "target_rps": rps,
        "duration_seconds": duration,
        "warmup_seconds": warmup_seconds,
        "requests": total,
        "successful": success,
        "errors": total - success,
        "achieved_rps": round(total / measured_elapsed, 2),
        "successful_rps": round(success / measured_elapsed, 2),
        "latency_ms": {
            "mean": round(statistics.fmean(latencies), 2) if latencies else 0,
            "p50": round(percentile(latencies, 0.50), 2),
            "p95": round(percentile(latencies, 0.95), 2),
            "p99": round(percentile(latencies, 0.99), 2),
            "max": round(max(latencies), 2) if latencies else 0,
        },
        "statuses": dict(statuses),
        "route_requests": dict(routes),
        "route_latency_ms": {
            route: {
                "p50": round(percentile(values, 0.50), 2),
                "p95": round(percentile(values, 0.95), 2),
                "p99": round(percentile(values, 0.99), 2),
            }
            for route, values in sorted(route_latencies.items())
        },
        "pool": {
            "samples": len(pool_samples),
            "size": max((sample["size"] for sample in pool_samples), default=None),
            "max_checked_out": max((sample["checked_out"] for sample in pool_samples), default=None),
            "max_overflow": max((sample["overflow"] for sample in pool_samples), default=None),
            "min_checked_in": min((sample["checked_in"] for sample in pool_samples), default=None),
            "max_database_sessions": max(
                (sample["database_sessions"] for sample in pool_samples if sample.get("database_sessions") is not None),
                default=None,
            ),
            "observed_worker_pids": sorted({sample["pid"] for sample in pool_samples}),
        },
        "wall_seconds_including_warmup": round(time.perf_counter() - started, 2),
    }


def render_markdown(report: dict) -> str:
    latency = report["latency_ms"]
    pool = report["pool"]
    verdict = "PASS" if report["errors"] == 0 and report["successful_rps"] >= report["target_rps"] * 0.95 else "FAIL"
    return f"""# Staging load test — {report['timestamp_utc']}

- Verdict: **{verdict}**
- API workers: **{report['api_workers']}**
- Target: **{report['target_rps']} RPS** for **{report['duration_seconds']} seconds** after warmup
- Achieved: **{report['achieved_rps']} RPS**, successful: **{report['successful_rps']} RPS**
- Requests: **{report['requests']}**, errors: **{report['errors']}**
- Latency: mean **{latency['mean']} ms**, p50 **{latency['p50']} ms**, p95 **{latency['p95']} ms**, p99 **{latency['p99']} ms**, max **{latency['max']} ms**
- Pool: max checked out per observed worker **{pool['max_checked_out']}**, max overflow **{pool['max_overflow']}**, minimum checked in **{pool['min_checked_in']}**, max SQL sessions **{pool['max_database_sessions']}**
- SQL deadlock delta: **{report['deadlock_delta']}**; deadlock victims observed: **{report['deadlock_victims']}**
- Pool timeout messages: **{report['pool_timeout_messages']}**
- Financial consistency: **{report['financial_consistency']}**

The run used a randomly named database created on the configured SQL Server and deleted it in `finally`. It did not use existing application rows or alter server authentication.
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rps", type=int, default=500)
    parser.add_argument("--duration", type=int, default=30)
    parser.add_argument("--warmup", type=int, default=5)
    parser.add_argument("--port", type=int, default=8011)
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()
    if not 1 <= args.rps <= 2000 or not 1 <= args.duration <= 300:
        parser.error("rps or duration outside safety bounds")

    suffix = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S") + "_" + secrets.token_hex(3)
    database_name = "CapitalFlow_LoadTest_" + suffix
    load_key = secrets.token_urlsafe(24)
    base_url = f"http://127.0.0.1:{args.port}"
    master = master_engine()
    target_engine = None
    process = None
    report_dir = ROOT / "artifacts" / "load-tests"
    report_dir.mkdir(parents=True, exist_ok=True)
    log_path = report_dir / "load-test-server.log"
    report_path = report_dir / f"load-test-{suffix}.json"
    markdown_path = report_path.with_suffix(".md")
    deadlocks_before = deadlock_counter(master)

    try:
        with master.connect() as connection:
            connection.exec_driver_sql(f"CREATE DATABASE [{database_name}]")
        target_url = make_url(settings.database_url).set(database=database_name)
        target_engine = create_engine(
            target_url,
            connect_args={"timeout": 5},
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=5,
            hide_parameters=True,
        )
        Base.metadata.create_all(target_engine)
        user_id = uuid.uuid4()
        account_a, account_b = uuid.uuid4(), uuid.uuid4()
        with Session(target_engine) as session:
            session.add(User(
                id=user_id,
                email=f"load-{suffix}@example.invalid",
                full_name="Staging Load Test",
                password_hash="not-used",
                role="USER",
                token_version=0,
                is_active=True,
            ))
            session.flush()
            session.add_all([
                Account(id=account_a, user_id=user_id, name="Load A", account_type="BANK", balance=Decimal("1000000000"), currency="VND"),
                Account(id=account_b, user_id=user_id, name="Load B", account_type="BANK", balance=Decimal("1000000000"), currency="VND"),
                Category(owner_user_id=user_id, name="Load Expense", type="EXPENSE", icon="receipt"),
            ])
            session.commit()

        child_env = os.environ.copy()
        child_env.update({
            "DATABASE_URL": target_url.render_as_string(hide_password=False),
            "APP_ENV": "staging-load-test",
            "DEBUG": "false",
            "LOAD_TEST_KEY": load_key,
            "TELEMETRY_ENABLED": "true",
        })
        with log_path.open("w", encoding="utf-8") as log:
            process = subprocess.Popen(
                [str(ROOT / ".venv" / "Scripts" / "python.exe"), "-m", "uvicorn", "scripts.load_test.target:app", "--host", "127.0.0.1", "--port", str(args.port), "--workers", str(args.workers), "--no-access-log"],
                cwd=ROOT,
                env=child_env,
                stdout=log,
                stderr=subprocess.STDOUT,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            asyncio.run(wait_ready(base_url, process))
            token = create_access_token(str(user_id), "USER", 0)
            report = asyncio.run(
                execute_load(
                    base_url,
                    token,
                    load_key,
                    (str(account_a), str(account_b)),
                    args.rps,
                    args.duration,
                    args.warmup,
                )
            )

        with Session(target_engine) as session:
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
                select(func.count(Transaction.id)).where(Transaction.user_id == user_id, Transaction.kind == "TRANSFER")
            ) or 0
            balance_total = sum(balances, Decimal("0"))
            consistent = malformed_pairs == 0 and balance_total == Decimal("2000000000.00")

        log_text = log_path.read_text(encoding="utf-8", errors="replace")
        deadlocks_after = deadlock_counter(master)
        report.update({
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "database_isolated": True,
            "api_workers": args.workers,
            "deadlock_counter_before": deadlocks_before,
            "deadlock_counter_after": deadlocks_after,
            "deadlock_delta": None if deadlocks_before is None or deadlocks_after is None else max(0, deadlocks_after - deadlocks_before),
            "deadlock_victims": log_text.lower().count("deadlock victim") + log_text.count("1205"),
            "pool_timeout_messages": log_text.count("QueuePool limit") + log_text.count("TimeoutError"),
            "transfer_rows": int(transfer_rows),
            "malformed_transfer_pairs": int(malformed_pairs),
            "balance_total": str(balance_total),
            "financial_consistency": "PASS" if consistent else "FAIL",
        })
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        markdown_path.write_text(render_markdown(report), encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print(f"REPORT={markdown_path}")
    finally:
        if process is not None:
            if os.name == "nt" and args.workers > 1 and process.poll() is None:
                # Tiến trình Uvicorn được tạo trên Windows có thể còn sống sau terminate() của
                # supervisor. Chỉ kết thúc cây process vừa được script này tạo.
                subprocess.run(
                    ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                )
            elif process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
        if target_engine is not None:
            target_engine.dispose()
        try:
            with master.connect() as connection:
                connection.exec_driver_sql(
                    f"IF DB_ID(N'{database_name}') IS NOT NULL BEGIN "
                    f"ALTER DATABASE [{database_name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; "
                    f"DROP DATABASE [{database_name}]; END"
                )
        finally:
            master.dispose()
        for _ in range(20):
            try:
                log_path.unlink(missing_ok=True)
                break
            except PermissionError:
                time.sleep(0.25)


if __name__ == "__main__":
    main()
