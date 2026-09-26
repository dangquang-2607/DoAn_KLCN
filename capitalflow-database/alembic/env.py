"""Cấu hình Alembic độc lập cho project CapitalFlow Database.

Vai trò: kết nối migration với SQL Server và metadata ORM của API.
Đầu vào: ``DATABASE_URL`` hoặc cấu hình ``capitalflow-api/.env``.
Đầu ra: ngữ cảnh migration online/offline với kiểm tra kiểu dữ liệu.
Ràng buộc an toàn: không tự chạy migration khi API khởi động và không quản lý
các bảng version legacy hoặc ``sysdiagrams``.
"""

from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlalchemy.dialects import mssql
from sqlalchemy.sql.sqltypes import DateTime, SmallInteger, String


DATABASE_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = DATABASE_ROOT.parent
API_ROOT = REPOSITORY_ROOT / "capitalflow-api"
sys.path.insert(0, str(API_ROOT))

# Import tập trung đăng ký đủ 17 bảng nghiệp vụ vào Base.metadata.
import app.models  # noqa: E402,F401
from app.core.config import settings  # noqa: E402
from app.models.base import Base  # noqa: E402


config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

# Cho phép pipeline kiểm chứng trỏ tới CSDL tạm mà không sửa file .env.
database_url = os.environ.get("DATABASE_URL", settings.database_url)
config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
target_metadata = Base.metadata

EXCLUDED_TABLES = {"alembic_version", "schema_migrations", "sysdiagrams"}


def include_object(obj, name, type_, reflected, compare_to):
    """Loại các bảng điều khiển khỏi autogenerate của schema nghiệp vụ."""

    if type_ == "table" and name in EXCLUDED_TABLES:
        return False
    return True


def compare_type(context_, inspected_column, metadata_column, inspected_type, metadata_type):
    """Chuẩn hóa các kiểu ORM tương đương vật lý trên SQL Server."""

    equivalent_pairs = (
        (isinstance(inspected_type, mssql.DATETIME2), isinstance(metadata_type, DateTime)),
        (isinstance(inspected_type, mssql.TINYINT), isinstance(metadata_type, SmallInteger)),
        (
            isinstance(inspected_type, mssql.CHAR)
            and isinstance(metadata_type, String)
            and inspected_type.length == metadata_type.length,
            True,
        ),
    )
    if any(left and right for left, right in equivalent_pairs):
        return False
    return None


def configure_context(**kwargs) -> None:
    """Áp dụng một cấu hình so sánh thống nhất cho online và offline."""

    context.configure(
        target_metadata=target_metadata,
        include_object=include_object,
        compare_type=compare_type,
        compare_server_default=False,
        render_as_batch=False,
        **kwargs,
    )


def run_migrations_offline() -> None:
    """Sinh SQL mà không mở kết nối database."""

    configure_context(
        url=config.get_main_option("sqlalchemy.url"),
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Chạy migration bằng kết nối riêng, không dùng pool của API runtime."""

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        configure_context(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
