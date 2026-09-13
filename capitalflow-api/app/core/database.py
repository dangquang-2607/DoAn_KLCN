from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"timeout": 5} if make_url(settings.database_url).drivername == "mssql+pyodbc" else {},
    pool_timeout=5,
    hide_parameters=True,
    pool_pre_ping=True,       # tự ping lại nếu connection bị drop
    pool_size=10,             # số connection pool thường trực
    max_overflow=20,          # số connection tối đa có thể tạo thêm
    pool_recycle=3600,        # recycle connection sau 1 giờ (tránh stale connection)
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

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)
