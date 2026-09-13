"""Add durable jobs/idempotency and protect persisted secrets. Defaults to rollback."""
import argparse
from sqlalchemy import text
from app.core.database import engine
from app.models.idempotency import IdempotencyRecord
from app.models.background_job import BackgroundJob
from app.core.secrets_store import seal

VERSION="20260910_resilience"

def migrate(apply=False):
    if engine.dialect.name!="mssql":raise RuntimeError("Requires SQL Server")
    with engine.connect() as conn:
        tx=conn.begin()
        try:
            conn.exec_driver_sql("SET XACT_ABORT ON; SET LOCK_TIMEOUT 15000;")
            conn.exec_driver_sql("DECLARE @r INT; EXEC @r=sys.sp_getapplock @Resource='capitalflow_schema_migration',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000; IF @r<0 THROW 51000,'Migration busy',1;")
            if conn.scalar(text("SELECT COUNT(*) FROM dbo.schema_migrations WHERE version=:v"),{"v":VERSION}):
                tx.rollback();return "already_applied"
            IdempotencyRecord.__table__.create(conn,checkfirst=True)
            BackgroundJob.__table__.create(conn,checkfirst=True)
            conn.exec_driver_sql("ALTER TABLE dbo.password_reset_otps ALTER COLUMN otp_code VARCHAR(64) NOT NULL;")
            conn.exec_driver_sql("UPDATE dbo.password_reset_otps SET is_used=1 WHERE is_used=0;")
            rows=conn.execute(text("SELECT [key],value FROM dbo.system_settings WHERE [key]='smtp_password'")).all()
            for key,value in rows:
                if value and not value.startswith("fernet:"):
                    conn.execute(text("UPDATE dbo.system_settings SET value=:v WHERE [key]=:k"),{"v":seal(value),"k":key})
            conn.exec_driver_sql("IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.transactions') AND name='IX_transactions_reporting') CREATE INDEX IX_transactions_reporting ON dbo.transactions(user_id,kind,transaction_date) INCLUDE(type,amount,category_id);")
            conn.execute(text("INSERT dbo.schema_migrations(version) VALUES (:v)"),{"v":VERSION})
            if apply:tx.commit();return "applied"
            tx.rollback();return "validated_and_rolled_back"
        except Exception:
            tx.rollback();raise

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--apply",action="store_true");args=parser.parse_args()
    print(migrate(args.apply))
