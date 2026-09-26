"""Dựng baseline trên CSDL tạm và đối chiếu với schema nguồn.

Vai trò: chứng minh baseline Alembic có thể dựng lại schema SQL Server đang chạy.
Đầu vào: tên CSDL kiểm chứng mới và cấu hình kết nối của ``personal_finance``.
Đầu ra: CSDL kiểm chứng được giữ lại cùng báo cáo sai khác schema.
Ràng buộc an toàn: chỉ được CREATE database mới; từ chối database đã có bảng và
không DROP database sau kiểm tra vì thao tác đó cần chủ dự án xác nhận.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Any

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.pool import NullPool


DATABASE_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = DATABASE_ROOT.parent
API_ROOT = REPOSITORY_ROOT / "capitalflow-api"
sys.path.insert(0, str(API_ROOT))

import app.models  # noqa: E402,F401
from app.core.config import settings  # noqa: E402
from app.models.base import Base  # noqa: E402


def normalize(value: Any) -> str:
    """Chuẩn hóa metadata phản chiếu để so sánh ổn định giữa hai database."""

    if value is None:
        return ""
    return " ".join(str(value).lower().replace("[", "").replace("]", "").split())


def schema_signature(engine: Engine) -> dict[str, Any]:
    """Thu chữ ký cột, khóa và index của đúng các bảng nghiệp vụ."""

    inspector = inspect(engine)
    signature: dict[str, Any] = {}
    with engine.connect() as connection:
        for table in sorted(Base.metadata.tables):
            columns = [
                (
                    item["name"],
                    normalize(item["type"]),
                    bool(item["nullable"]),
                    normalize(item.get("default")),
                    normalize(item.get("identity")),
                )
                for item in inspector.get_columns(table)
            ]
            foreign_keys = sorted(
                (
                    tuple(item["constrained_columns"]),
                    item["referred_table"],
                    tuple(item["referred_columns"]),
                    normalize(item.get("options")),
                )
                for item in inspector.get_foreign_keys(table)
            )
            indexes = sorted(
                (
                    item["name"],
                    tuple(item["column_names"]),
                    bool(item["unique"]),
                    normalize(item.get("dialect_options")),
                )
                for item in inspector.get_indexes(table)
            )
            # SQLAlchemy chưa triển khai get_check_constraints cho dialect này;
            # đọc trực tiếp catalog hệ thống nhưng vẫn hoàn toàn read-only.
            checks = sorted(
                normalize(row[0])
                for row in connection.execute(
                    text(
                        "SELECT cc.definition FROM sys.check_constraints cc "
                        "JOIN sys.tables t ON t.object_id=cc.parent_object_id "
                        "WHERE t.name=:table ORDER BY cc.name"
                    ),
                    {"table": table},
                )
            )
            signature[table] = {
                "columns": columns,
                "primary_key": tuple(inspector.get_pk_constraint(table).get("constrained_columns") or ()),
                "foreign_keys": foreign_keys,
                "indexes": indexes,
                "checks": checks,
            }
    return signature


def create_empty_database(source_url: str, database_name: str, reuse_existing: bool) -> str:
    """Tạo CSDL kiểm chứng mới hoặc mở lại đúng CSDL tạm do công cụ đã tạo."""

    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{2,62}", database_name):
        raise ValueError("Tên database kiểm chứng không hợp lệ")

    parsed = make_url(source_url)
    master_url = parsed.set(database="master")
    target_url = parsed.set(database=database_name)
    master_engine = create_engine(master_url, poolclass=NullPool, isolation_level="AUTOCOMMIT")

    with master_engine.connect() as connection:
        exists = connection.scalar(
            text("SELECT COUNT(*) FROM sys.databases WHERE name=:name"),
            {"name": database_name},
        )
        if not exists:
            # Tên đã được giới hạn bằng regex nên có thể quote bằng dấu ngoặc vuông.
            connection.exec_driver_sql(f"CREATE DATABASE [{database_name}]")
            print(f"TEMP_DATABASE_CREATED={database_name}")
        else:
            print(f"TEMP_DATABASE_EXISTS={database_name}")

    target_engine = create_engine(target_url, poolclass=NullPool)
    with target_engine.connect() as connection:
        table_count = connection.scalar(
            text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
                "WHERE TABLE_TYPE='BASE TABLE'"
            )
        )
    target_engine.dispose()
    master_engine.dispose()

    if table_count and not reuse_existing:
        raise RuntimeError(
            f"CSDL {database_name} đã có {table_count} bảng; từ chối ghi đè hoặc dọn dữ liệu"
        )
    if table_count and reuse_existing:
        print(f"TEMP_DATABASE_REUSED={database_name};TABLES={table_count}")
    return target_url.render_as_string(hide_password=False)


def main() -> None:
    """Tạo CSDL tạm, nâng baseline rồi so sánh toàn bộ chữ ký schema."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", default="capitalflow_baseline_verify_20260924")
    parser.add_argument(
        "--reuse-existing",
        action="store_true",
        help="Chỉ dùng lại database kiểm chứng đã tạo ở lần chạy trước; không dọn bảng.",
    )
    args = parser.parse_args()

    source_url = settings.database_url
    target_url = create_empty_database(source_url, args.database, args.reuse_existing)

    # env.py ưu tiên biến môi trường này, nhờ đó không phải ghi credential ra file.
    os.environ["DATABASE_URL"] = target_url
    alembic_config = Config(str(DATABASE_ROOT / "alembic.ini"))
    command.upgrade(alembic_config, "head")

    source_engine = create_engine(source_url, poolclass=NullPool)
    target_engine = create_engine(target_url, poolclass=NullPool)
    try:
        source_signature = schema_signature(source_engine)
        target_signature = schema_signature(target_engine)
    finally:
        source_engine.dispose()
        target_engine.dispose()

    mismatches = [
        table
        for table in sorted(source_signature)
        if source_signature[table] != target_signature.get(table)
    ]
    print(f"BASELINE_TABLES={len(target_signature)}")
    print(f"SCHEMA_MISMATCHES={len(mismatches)}")
    if mismatches:
        print("MISMATCH_TABLES=" + ",".join(mismatches))
        for table in mismatches:
            for section in source_signature[table]:
                source_value = source_signature[table][section]
                target_value = target_signature[table][section]
                if source_value != target_value:
                    print(f"DIFF={table}.{section}")
                    print(f"SOURCE={source_value!r}")
                    print(f"TARGET={target_value!r}")
        raise SystemExit(1)
    print("BASELINE_VERIFICATION=PASS")
    print("TEMP_DATABASE_RETAINED_FOR_API_TESTS=" + args.database)


if __name__ == "__main__":
    main()
