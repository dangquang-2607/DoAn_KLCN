"""Khởi tạo kết nối SQLAlchemy và quản lý vòng đời phiên CSDL.

Vai trò: cấu hình engine, connection pool và telemetry truy vấn.
Đầu vào: URL cùng thông số pool từ settings.
Đầu ra: engine cho API, worker và công cụ vận hành.
Ràng buộc: đo thời gian chờ pool nhưng không để lộ chuỗi kết nối hay tham số nhạy cảm.
"""

import time

from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.pool import QueuePool

from app.shared.config import settings
from app.shared.observability.telemetry import sql_operation, telemetry


class InstrumentedQueuePool(QueuePool):
    """Đo toàn bộ thời gian chờ QueuePool mà không ghi credential vào log."""

    def _do_get(self):
        started = time.perf_counter()
        try:
            return super()._do_get()
        finally:
            telemetry.observe_pool_wait((time.perf_counter() - started) * 1000)

engine = create_engine(
    settings.database_url,
    poolclass=InstrumentedQueuePool,
    connect_args={"timeout": 5} if make_url(settings.database_url).drivername == "mssql+pyodbc" else {},
    pool_timeout=5,
    hide_parameters=True,
    pool_pre_ping=True,       # tự ping lại nếu connection bị drop
    pool_size=10,             # số connection pool thường trực
    max_overflow=20,          # số connection tối đa có thể tạo thêm
    pool_recycle=3600,        # recycle connection sau 1 giờ (tránh stale connection)
)


@event.listens_for(engine, "before_cursor_execute")
def query_started(_connection, _cursor, statement, _parameters, context, _executemany):
    if telemetry.enabled:
        context._capitalflow_query_started = time.perf_counter()
        context._capitalflow_query_operation = sql_operation(statement)


@event.listens_for(engine, "after_cursor_execute")
def query_completed(_connection, _cursor, _statement, _parameters, context, _executemany):
    started = getattr(context, "_capitalflow_query_started", None)
    if started is not None:
        telemetry.observe_query(
            (time.perf_counter() - started) * 1000,
            getattr(context, "_capitalflow_query_operation", "UNKNOWN"),
        )


@event.listens_for(engine, "handle_error")
def query_failed(exception_context):
    context = exception_context.execution_context
    started = getattr(context, "_capitalflow_query_started", None) if context is not None else None
    if started is not None:
        telemetry.observe_query(
            (time.perf_counter() - started) * 1000,
            getattr(context, "_capitalflow_query_operation", "UNKNOWN"),
            failed=True,
        )

if engine.dialect.name == "mssql" and engine.dialect.driver == "pyodbc":
    @event.listens_for(engine, "connect")
    def configure_sql_deadlines(connection, _):
        connection.timeout = 10
        cursor = connection.cursor()
        try:
            cursor.execute("SET LOCK_TIMEOUT 5000")
        finally:
            cursor.close()
