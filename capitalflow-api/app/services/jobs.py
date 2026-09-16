"""Transactional encrypted outbox. Worker delivery is at-least-once."""
import json
import uuid
from datetime import datetime, timedelta, timezone
from cryptography.fernet import Fernet
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select, func, text
from app.core.config import settings
from app.models.background_job import BackgroundJob


def now(): return datetime.now(timezone.utc).replace(tzinfo=None)


def _payload_owner(payload):
    value = payload.get("user_id") if isinstance(payload, dict) else None
    try:
        return uuid.UUID(str(value)) if value else None
    except (TypeError, ValueError):
        return None


def enqueue(db, kind, payload, dedupe_key=None, owner_user_id=None):
    key = dedupe_key or str(uuid.uuid4())
    # Serialize queue capacity/deduplication across API processes on SQL Server.
    if db.bind.dialect.name == "mssql":
        db.execute(text("DECLARE @r INT; EXEC @r=sys.sp_getapplock @Resource='capitalflow_outbox_enqueue', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=5000; IF @r<0 THROW 51010,'Queue busy',1;"))
    existing = db.scalar(select(BackgroundJob).where(BackgroundJob.dedupe_key==key))
    if existing: return existing
    count=db.scalar(select(func.count()).select_from(BackgroundJob).where(BackgroundJob.status.in_(["PENDING","RUNNING"])))
    if count >= settings.worker_queue_limit:
        raise HTTPException(status_code=503, detail="Hàng đợi đang đầy. Vui lòng thử lại sau.")
    encrypted=Fernet(settings.job_encryption_key.encode()).encrypt(json.dumps(jsonable_encoder(payload)).encode()).decode()
    owner = owner_user_id or _payload_owner(payload)
    job=BackgroundJob(id=uuid.uuid4(),kind=kind,payload=encrypted,dedupe_key=key,status="PENDING",attempts=0,available_at=now(),owner_user_id=owner)
    db.add(job);db.flush()
    return job


def enqueue_email(db, function, *args, dedupe_key=None, owner_user_id=None, **kwargs):
    return enqueue(
        db,
        "EMAIL",
        {"function":function.__name__,"args":args,"kwargs":kwargs},
        dedupe_key,
        owner_user_id=owner_user_id,
    )


def decode(job):
    return json.loads(Fernet(settings.job_encryption_key.encode()).decrypt(job.payload.encode()))


def claim(db):
    instant=now()
    job=db.scalar(select(BackgroundJob).where(
        ((BackgroundJob.status=="PENDING") & (BackgroundJob.available_at<=instant)) |
        ((BackgroundJob.status=="RUNNING") & (BackgroundJob.lease_until<instant))
    ).order_by(BackgroundJob.available_at,BackgroundJob.id).with_hint(
        BackgroundJob,"WITH (UPDLOCK, READPAST, ROWLOCK)",dialect_name="mssql").limit(1))
    if not job:return None
    job.status="RUNNING";job.attempts+=1;job.lease_token=uuid.uuid4();job.lease_until=instant+timedelta(seconds=180)
    db.commit();db.refresh(job)
    try:
        payload = decode(job)
        if not isinstance(payload, dict):raise ValueError("Invalid job payload")
    except Exception:
        payload = {"_invalid_payload": True}
    return job.id,job.lease_token,job.kind,payload
