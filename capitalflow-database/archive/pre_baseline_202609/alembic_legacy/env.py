from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# ── Import app config + models ───────────────────────────────────────────────
from app.core.config import settings
from app.models.base import Base

# Import tất cả models để Alembic detect được schema
import app.models.user          # noqa: F401
import app.models.account       # noqa: F401
import app.models.category      # noqa: F401
import app.models.transaction   # noqa: F401
import app.models.budget        # noqa: F401
import app.models.invoice       # noqa: F401
import app.models.invoice_item  # noqa: F401
import app.models.ocr_job       # noqa: F401
import app.models.refresh_token # noqa: F401
import app.models.audit_log     # noqa: F401

# ── Alembic Config ───────────────────────────────────────────────────────────
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override URL từ .env thay vì alembic.ini
config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
