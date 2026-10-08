"""Thu thập telemetry có số lượng nhãn hữu hạn cho kiểm thử tải staging.

Bộ thu chỉ giữ bộ đếm và histogram có giới hạn. Nội dung SQL, tham số bind,
token và định danh người dùng không bao giờ được lưu giữ.
"""

from __future__ import annotations

import asyncio
import os
import threading
import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

import psutil


BUCKETS_MS = (0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000)


@dataclass
class Histogram:
    count: int = 0
    total_ms: float = 0.0
    max_ms: float = 0.0
    buckets: list[int] = field(default_factory=lambda: [0] * (len(BUCKETS_MS) + 1))

    def observe(self, value_ms: float) -> None:
        self.count += 1
        self.total_ms += value_ms
        self.max_ms = max(self.max_ms, value_ms)
        for index, upper_bound in enumerate(BUCKETS_MS):
            if value_ms <= upper_bound:
                self.buckets[index] += 1
                return
        self.buckets[-1] += 1

    def as_dict(self) -> dict[str, Any]:
        return {
            "count": self.count,
            "mean_ms": round(self.total_ms / self.count, 3) if self.count else 0.0,
            "max_ms": round(self.max_ms, 3),
            "buckets_ms": {
                **{str(bound): self.buckets[index] for index, bound in enumerate(BUCKETS_MS)},
                "+Inf": self.buckets[-1],
            },
        }


class RuntimeTelemetry:
    def __init__(self) -> None:
        self.enabled = os.getenv("TELEMETRY_ENABLED", "false").lower() in {"1", "true", "yes", "on"}
        self._lock = threading.Lock()
        self._pool_wait = Histogram()
        self._query = Histogram()
        self._request = Histogram()
        self._event_loop_lag = Histogram()
        self._query_operations: Counter[str] = Counter()
        self._request_routes: Counter[str] = Counter()
        self._query_errors = 0
        self._request_errors = 0
        self._process = psutil.Process()
        self._process.cpu_percent(interval=None)
        self._lag_task: asyncio.Task | None = None
        self._stop_event: asyncio.Event | None = None

    def observe_pool_wait(self, duration_ms: float) -> None:
        if self.enabled:
            with self._lock:
                self._pool_wait.observe(duration_ms)

    def observe_query(self, duration_ms: float, operation: str, *, failed: bool = False) -> None:
        if self.enabled:
            with self._lock:
                self._query.observe(duration_ms)
                self._query_operations[operation[:16] or "UNKNOWN"] += 1
                self._query_errors += int(failed)

    def observe_request(self, duration_ms: float, route: str, *, failed: bool = False) -> None:
        if self.enabled:
            with self._lock:
                self._request.observe(duration_ms)
                self._request_routes[route[:160] or "unknown"] += 1
                self._request_errors += int(failed)

    async def start(self) -> None:
        if not self.enabled or self._lag_task is not None:
            return
        self._stop_event = asyncio.Event()
        self._lag_task = asyncio.create_task(self._sample_event_loop_lag(), name="runtime-telemetry-lag")

    async def stop(self) -> None:
        if self._lag_task is None or self._stop_event is None:
            return
        self._stop_event.set()
        await self._lag_task
        self._lag_task = None
        self._stop_event = None

    async def _sample_event_loop_lag(self) -> None:
        assert self._stop_event is not None
        interval = 0.1
        while not self._stop_event.is_set():
            expected = time.perf_counter() + interval
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=interval)
            except TimeoutError:
                lag_ms = max(0.0, (time.perf_counter() - expected) * 1000)
                with self._lock:
                    self._event_loop_lag.observe(lag_ms)

    def reset(self) -> None:
        with self._lock:
            self._pool_wait = Histogram()
            self._query = Histogram()
            self._request = Histogram()
            self._event_loop_lag = Histogram()
            self._query_operations.clear()
            self._request_routes.clear()
            self._query_errors = 0
            self._request_errors = 0
        self._process.cpu_percent(interval=None)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            metrics = {
                "pool_wait": self._pool_wait.as_dict(),
                "sql_query": self._query.as_dict(),
                "http_request": self._request.as_dict(),
                "event_loop_lag": self._event_loop_lag.as_dict(),
                "query_operations": dict(self._query_operations),
                "request_routes": dict(self._request_routes),
                "query_errors": self._query_errors,
                "request_errors": self._request_errors,
            }
        memory = self._process.memory_info()
        metrics["process"] = {
            "pid": os.getpid(),
            "cpu_percent": round(self._process.cpu_percent(interval=None), 2),
            "rss_bytes": memory.rss,
            "threads": self._process.num_threads(),
        }
        return metrics


telemetry = RuntimeTelemetry()


def sql_operation(statement: str) -> str:
    stripped = statement.lstrip()
    if not stripped:
        return "UNKNOWN"
    return stripped.split(None, 1)[0].upper()
