"""Chạy kiểm thử tải tăng bậc từ host tách biệt với API và SQL Server.

Vai trò: phát tải theo nhiều mức RPS và thu telemetry/toàn vẹn tài chính qua API staging.
Đầu vào: base URL, LOAD_TEST_KEY, dãy RPS, thời lượng và kích thước dữ liệu seed.
Đầu ra/side effect: fixture staging tạm và báo cáo JSON trong ``artifacts/load-tests``.
Ràng buộc an toàn: generator không nhận secret CSDL/JWT và luôn yêu cầu xóa fixture.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import socket
import statistics
import time
import uuid
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import psutil


ROOT = Path(__file__).resolve().parents[1]


def percentile(values: list[float], quantile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(quantile * len(ordered)) - 1))
    return ordered[index]


def histogram_percentile(histogram: dict[str, Any], quantile: float) -> float | None:
    count = int(histogram.get("count", 0))
    if not count:
        return None
    target = math.ceil(count * quantile)
    cumulative = 0
    for bound, bucket_count in histogram.get("buckets_ms", {}).items():
        cumulative += int(bucket_count)
        if cumulative >= target:
            return None if bound == "+Inf" else float(bound)
    return None


async def run_stage(
    client: httpx.AsyncClient,
    base_url: str,
    token: str,
    load_key: str,
    account_ids: list[str],
    rps: int,
    duration: int,
    stage_drain_timeout: float,
) -> dict[str, Any]:
    auth_headers = {"Authorization": f"Bearer {token}"}
    monitor_headers = {"X-Load-Test-Key": load_key}
    latencies: list[float] = []
    statuses: Counter[str] = Counter()
    route_latencies: dict[str, list[float]] = {}
    telemetry_samples: list[dict[str, Any]] = []
    generator_samples: list[dict[str, Any]] = []
    generator_process = psutil.Process()
    generator_process.cpu_percent(interval=None)
    semaphore = asyncio.Semaphore(max(600, rps * 4))

    async def request(index: int) -> None:
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
                "note": "distributed staging load test",
            }
        headers = auth_headers
        if method == "POST":
            headers = {**auth_headers, "Idempotency-Key": f"distributed-{uuid.uuid4().hex}"}
        async with semaphore:
            started = time.perf_counter()
            try:
                response = await client.request(method, base_url + path, headers=headers, json=body)
                status = str(response.status_code)
            except Exception as exc:
                status = f"EXC:{type(exc).__name__}"
            elapsed_ms = (time.perf_counter() - started) * 1000
        latencies.append(elapsed_ms)
        statuses[status] += 1
        route_latencies.setdefault(route, []).append(elapsed_ms)

    stop_monitor = asyncio.Event()

    async def monitor() -> None:
        async with httpx.AsyncClient(timeout=5.0) as monitor_client:
            while not stop_monitor.is_set():
                memory = generator_process.memory_info()
                generator_samples.append({
                    "cpu_percent": generator_process.cpu_percent(interval=None),
                    "rss_bytes": memory.rss,
                })
                try:
                    response = await monitor_client.get(
                        base_url + "/__loadtest/pool",
                        headers=monitor_headers,
                    )
                    if response.status_code == 200:
                        telemetry_samples.append(response.json())
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(0.25)

    monitor_task = asyncio.create_task(monitor())
    stage_started = time.perf_counter()
    tasks: list[asyncio.Task] = []
    for index in range(rps * duration):
        target = stage_started + index / rps
        delay = target - time.perf_counter()
        if delay > 0:
            await asyncio.sleep(delay)
        tasks.append(asyncio.create_task(request(index)))
    _done, pending = await asyncio.wait(tasks, timeout=stage_drain_timeout)
    if pending:
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
        statuses["EXC:StageDrainTimeout"] += len(pending)
    elapsed = time.perf_counter() - stage_started
    stop_monitor.set()
    await monitor_task

    success = sum(count for status, count in statuses.items() if status.startswith("2"))
    total = sum(statuses.values())
    latest = telemetry_samples[-1] if telemetry_samples else {}
    runtime = latest.get("telemetry", {})
    sql_wait_first = telemetry_samples[0].get("waits_ms", {}) if telemetry_samples else {}
    sql_wait_last = latest.get("waits_ms", {})
    deadlock_first = telemetry_samples[0].get("deadlocks") if telemetry_samples else None
    deadlock_last = latest.get("deadlocks")

    return {
        "target_rps": rps,
        "duration_seconds": duration,
        "requests": total,
        "successful": success,
        "errors": total - success,
        "achieved_rps": round(total / elapsed, 2),
        "successful_rps": round(success / elapsed, 2),
        "latency_ms": {
            "mean": round(statistics.fmean(latencies), 2) if latencies else 0,
            "p50": round(percentile(latencies, 0.50), 2),
            "p95": round(percentile(latencies, 0.95), 2),
            "p99": round(percentile(latencies, 0.99), 2),
            "max": round(max(latencies), 2) if latencies else 0,
        },
        "statuses": dict(statuses),
        "route_latency_ms": {
            route: {
                "p95": round(percentile(values, 0.95), 2),
                "p99": round(percentile(values, 0.99), 2),
            }
            for route, values in sorted(route_latencies.items())
        },
        "api": {
            "observed_pids": sorted({sample.get("pid") for sample in telemetry_samples if sample.get("pid")}),
            "cpu_percent_max": max(
                (sample.get("telemetry", {}).get("process", {}).get("cpu_percent", 0) for sample in telemetry_samples),
                default=0,
            ),
            "rss_bytes_max": max(
                (sample.get("telemetry", {}).get("process", {}).get("rss_bytes", 0) for sample in telemetry_samples),
                default=0,
            ),
            "event_loop_lag_p95_ms_upper_bound": histogram_percentile(runtime.get("event_loop_lag", {}), 0.95),
            "event_loop_lag_max_ms": runtime.get("event_loop_lag", {}).get("max_ms"),
            "anyio_thread_tokens_total": max(
                (sample.get("anyio_thread_tokens_total", 0) for sample in telemetry_samples),
                default=None,
            ),
            "anyio_thread_tokens_borrowed_max": max(
                (sample.get("anyio_thread_tokens_borrowed", 0) for sample in telemetry_samples),
                default=None,
            ),
        },
        "generator": {
            "cpu_percent_max": round(max(
                (sample["cpu_percent"] for sample in generator_samples),
                default=0,
            ), 2),
            "rss_bytes_max": max(
                (sample["rss_bytes"] for sample in generator_samples),
                default=0,
            ),
        },
        "pool": {
            "max_checked_out": max((sample.get("checked_out", 0) for sample in telemetry_samples), default=None),
            "max_overflow": max((sample.get("overflow", 0) for sample in telemetry_samples), default=None),
            "max_database_sessions": max(
                (sample.get("database_sessions") or 0 for sample in telemetry_samples),
                default=None,
            ),
            "wait_p95_ms_upper_bound": histogram_percentile(runtime.get("pool_wait", {}), 0.95),
            "wait_max_ms": runtime.get("pool_wait", {}).get("max_ms"),
        },
        "sql": {
            "query_count": runtime.get("sql_query", {}).get("count"),
            "query_p95_ms_upper_bound": histogram_percentile(runtime.get("sql_query", {}), 0.95),
            "query_max_ms": runtime.get("sql_query", {}).get("max_ms"),
            "query_errors": runtime.get("query_errors"),
            "operations": runtime.get("query_operations", {}),
            "wait_delta_ms": {
                wait_type: max(0, int(value) - int(sql_wait_first.get(wait_type, 0)))
                for wait_type, value in sql_wait_last.items()
            },
            "deadlock_delta": (
                None if deadlock_first is None or deadlock_last is None
                else max(0, int(deadlock_last) - int(deadlock_first))
            ),
        },
        "telemetry_samples": len(telemetry_samples),
    }


async def main_async(args: argparse.Namespace) -> dict[str, Any]:
    load_key = os.environ.get("LOAD_TEST_KEY", "")
    if not load_key:
        raise RuntimeError("Set LOAD_TEST_KEY in the load-generator environment")
    base_url = args.base_url.rstrip("/")
    load_headers = {"X-Load-Test-Key": load_key}
    limits = httpx.Limits(max_connections=max(800, max(args.stages) * 4), max_keepalive_connections=600)
    timeout = httpx.Timeout(args.request_timeout, connect=5.0, pool=15.0)

    async with httpx.AsyncClient(limits=limits, timeout=timeout) as client:
        # Chỉ bắt đầu phát tải sau khi API sẵn sàng và đã tạo fixture riêng trên
    # CSDL staging. Bộ phát tải không nhận thông tin đăng nhập CSDL hoặc khóa JWT.
        ready = await client.get(base_url + "/ready")
        ready.raise_for_status()
        bootstrap = await client.post(
            base_url + "/__loadtest/bootstrap",
            headers=load_headers,
            params={"seed_transactions": args.seed_transactions},
            timeout=max(args.request_timeout, 180.0),
        )
        bootstrap.raise_for_status()
        fixture = bootstrap.json()

        async def execute_steps() -> list[dict[str, Any]]:
            if args.warmup:
                await client.post(base_url + "/__loadtest/telemetry/reset", headers=load_headers)
                await run_stage(
                    client,
                    base_url,
                    fixture["access_token"],
                    load_key,
                    fixture["account_ids"],
                    args.stages[0],
                    args.warmup,
                    args.stage_drain_timeout,
                )

            results = []
            for index, rps in enumerate(args.stages):
                # Reset telemetry trước từng bậc tải để số liệu không bị cộng dồn;
                # sau mỗi bậc phải xác minh số dư và cặp chuyển khoản vẫn toàn vẹn.
                reset = await client.post(base_url + "/__loadtest/telemetry/reset", headers=load_headers)
                reset.raise_for_status()
                await asyncio.sleep(0.25)
                stage = await run_stage(
                    client,
                    base_url,
                    fixture["access_token"],
                    load_key,
                    fixture["account_ids"],
                    rps,
                    args.duration,
                    args.stage_drain_timeout,
                )
                integrity = await client.get(
                    base_url + f"/__loadtest/integrity/{fixture['user_id']}",
                    headers=load_headers,
                )
                integrity.raise_for_status()
                integrity_data = integrity.json()
                stage["financial_consistency"] = (
                    "PASS"
                    if integrity_data["balance_total"] == fixture["initial_balance_total"]
                    and integrity_data["malformed_transfer_pairs"] == 0
                    else "FAIL"
                )
                stage["integrity"] = integrity_data
                results.append(stage)
                print(json.dumps(stage, ensure_ascii=False, indent=2), flush=True)
                if index < len(args.stages) - 1 and args.cooldown:
                    await asyncio.sleep(args.cooldown)
            return results

        cleanup_status: dict[str, Any] = {"status": "not_attempted"}
        try:
            stages = await execute_steps()
        finally:
            # Luôn yêu cầu API xóa fixture kể cả khi một bậc tải thất bại. Chỉ lưu
            # loại lỗi cleanup, không đưa payload hoặc secret vào báo cáo.
            try:
                cleanup = await client.delete(
                    base_url + f"/__loadtest/fixture/{fixture['user_id']}",
                    headers=load_headers,
                    timeout=max(args.request_timeout, 180.0),
                )
                cleanup.raise_for_status()
                cleanup_status = {"status": "complete", **cleanup.json()}
            except Exception as exc:
                cleanup_status = {"status": "failed", "error_type": type(exc).__name__}

    return {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "topology": {
            "load_generator_host": socket.gethostname(),
            "api_base_url": base_url,
            "sql_server": "configured only on API host; credentials not exposed to generator",
        },
        "duration_seconds_per_stage": args.duration,
        "seeded_transactions": fixture["seeded_transactions"],
        "fixture_cleanup": cleanup_status,
        "stages": stages,
    }


def parse_stages(value: str) -> list[int]:
    stages = [int(item.strip()) for item in value.split(",") if item.strip()]
    if not stages or any(stage < 1 or stage > 2000 for stage in stages):
        raise argparse.ArgumentTypeError("stages must be comma-separated values between 1 and 2000")
    return stages


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=os.environ.get("LOAD_TEST_BASE_URL", ""))
    parser.add_argument("--stages", type=parse_stages, default=parse_stages("100,150,200,300,400,500"))
    parser.add_argument("--duration", type=int, default=30)
    parser.add_argument("--warmup", type=int, default=5)
    parser.add_argument("--cooldown", type=int, default=10)
    parser.add_argument("--request-timeout", type=float, default=30.0)
    parser.add_argument("--stage-drain-timeout", type=float, default=90.0)
    parser.add_argument("--seed-transactions", type=int, default=0)
    args = parser.parse_args()
    if not args.base_url:
        parser.error("--base-url or LOAD_TEST_BASE_URL is required")
    if not 5 <= args.duration <= 600:
        parser.error("duration must be between 5 and 600 seconds")
    if not 0 <= args.seed_transactions <= 500_000:
        parser.error("seed-transactions must be between 0 and 500000")

    report = asyncio.run(main_async(args))
    suffix = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    # Raw output là artifact sinh tự động nên ghi vào thư mục đã git-ignore,
    # không trộn với runbook và báo cáo chuẩn trong docs/.
    output_dir = ROOT / "artifacts" / "load-tests"
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / f"distributed-load-test-{suffix}.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"REPORT={output}")


if __name__ == "__main__":
    main()
