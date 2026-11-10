"""Session-bound Android business push delivery through the durable worker."""
import hashlib
import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

import httpx
import jwt
from cryptography.fernet import Fernet
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, false, func, select, true
from sqlalchemy.exc import IntegrityError

from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.refresh_token import RefreshToken
from app.chuc_nang.nguoi_dung.dang_nhap.nghiep_vu.session_management import locked_user
from app.dung_chung.config import settings
from app.dung_chung.tac_vu_nen.hang_doi import enqueue, now

from .luu_tru.push import PushRegistration
from .luu_tru.thong_bao import Notification

TTL_SECONDS = 3600


class PushInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    android_token: str = Field(min_length=20, max_length=4096, pattern=r"^[a-zA-Z0-9_:\-]+$")
    android_own_actions: bool = False


def configuration():
    return {"android_enabled": bool(settings.fcm_credentials_file)}


def register(db, user, family, payload: PushInput):
    if not settings.fcm_credentials_file:
        raise HTTPException(503, "Máy chủ chưa bật thông báo Android.")
    identity = payload.android_token
    data = {"token": identity, "own_actions": payload.android_own_actions}
    locked_user(db, user.id, user.token_version)
    digest = hashlib.sha256(f"android:{identity}".encode()).hexdigest()
    db.execute(delete(PushRegistration).where(PushRegistration.user_id == user.id,
                                               PushRegistration.expires_at <= now()))
    entry = db.scalar(select(PushRegistration).where(PushRegistration.target_hash == digest)
                      .with_hint(PushRegistration, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql"))
    if entry and (entry.user_id != user.id or entry.session_id != family):
        db.delete(entry)
        db.flush()
        entry = None
    if entry is None:
        count = db.scalar(select(func.count()).select_from(PushRegistration)
                          .where(PushRegistration.user_id == user.id, PushRegistration.provider == "android"))
        if count >= 12:
            raise HTTPException(409, "Đã đạt giới hạn thiết bị nhận thông báo.")
        entry = PushRegistration(user_id=user.id, session_id=family, provider="android", target_hash=digest)
        db.add(entry)
    entry.token_version = user.token_version
    entry.expires_at = now() + timedelta(days=7)
    entry.destination = Fernet(settings.job_encryption_key.encode()).encrypt(json.dumps(data).encode()).decode()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Thiết bị đang được đăng ký. Hãy thử lại.") from None
    return entry.id


def queue_notification(db, notification):
    if not settings.fcm_credentials_file:
        return
    request = db.info.get("request")
    mobile_actor = None
    if (request is not None and request.headers.get("X-Client-Platform") == "mobile" and
            getattr(request.state, "user_id", None) == notification.user_id):
        mobile_actor = getattr(request.state, "session_family_id", None)
    # emit_notification also runs from an account before_flush listener.
    # Append outbox rows without flushing or opening a savepoint in that hook.
    with db.no_autoflush:
        targets = db.scalars(select(PushRegistration.id).where(
            PushRegistration.user_id == notification.user_id,
            PushRegistration.provider == "android", PushRegistration.expires_at > now(),
            _active_session(),
        )).all()
        try:
            for target in targets:
                enqueue(db, "PUSH", {"notification_id": notification.id, "registration_id": target,
                                     "user_id": notification.user_id, "mobile_actor_session": mobile_actor},
                        f"push:{notification.id}:{target}", defer_flush=True)
        except HTTPException as exc:
            # The inbox entry remains available if the worker queue is full.
            if exc.status_code != 503:
                raise


def _active_session():
    return select(RefreshToken.id).where(
        RefreshToken.user_id == PushRegistration.user_id,
        RefreshToken.family_id == PushRegistration.session_id,
        RefreshToken.revoked_at.is_(None), RefreshToken.expires_at > datetime.now(timezone.utc),
    ).exists()


def deliver(payload, sessions):
    registration_id = uuid.UUID(payload["registration_id"])
    notification_id = uuid.UUID(payload["notification_id"])
    owner = uuid.UUID(payload["user_id"])
    with sessions() as db:
        entry = db.scalar(select(PushRegistration).join(User, User.id == PushRegistration.user_id).where(
            PushRegistration.id == registration_id, PushRegistration.user_id == owner,
            PushRegistration.provider == "android",
            PushRegistration.expires_at > now(), User.is_active == true(),
            User.must_change_password == false(), User.token_version == PushRegistration.token_version,
            _active_session(),
        ))
        notification = db.get(Notification, notification_id)
        if (entry is None or notification is None or notification.user_id != owner or notification.read_at
                or notification.created_at.replace(tzinfo=None) < now() - timedelta(seconds=TTL_SECONDS)):
            return
        encrypted, expires_at = entry.destination, entry.expires_at
        device_session = str(entry.session_id)
        is_alert = notification.severity in {"WARNING", "CRITICAL"}
    # Only identifiers cross the provider boundary. Financial content stays in the inbox.
    message = {"registration_id": str(registration_id), "notification_id": str(notification_id)}
    data = json.loads(Fernet(settings.job_encryption_key.encode()).decrypt(encrypted.encode()))
    if payload.get("mobile_actor_session") == device_session and not is_alert and not data.get("own_actions"):
        return
    if _send_android(data, message):
        with sessions() as db:
            db.execute(delete(PushRegistration).where(PushRegistration.id == registration_id,
                                                       PushRegistration.expires_at == expires_at))
            db.commit()


@lru_cache(maxsize=2)
def _firebase_credentials(filename):
    data = json.loads(Path(filename).read_text(encoding="utf-8"))
    if data.get("type") != "service_account" or not re.fullmatch(r"[a-z0-9-]{1,64}", data.get("project_id", "")):
        raise ValueError("Invalid FCM credentials")
    return data["project_id"], data["client_email"], data["private_key"]


@lru_cache(maxsize=2)
def _firebase_access(filename, time_bucket):
    project, email, private_key = _firebase_credentials(filename)
    now_utc = datetime.now(timezone.utc)
    url = "https://oauth2.googleapis.com/token"
    assertion = jwt.encode({"iss": email, "aud": url, "iat": now_utc,
                            "exp": now_utc + timedelta(minutes=45),
                            "scope": "https://www.googleapis.com/auth/firebase.messaging"},
                           private_key, algorithm="RS256")
    response = httpx.post(url, data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion}, timeout=10)
    response.raise_for_status()
    return project, response.json()["access_token"]


def _send_android(data, message):
    filename = settings.fcm_credentials_file
    if not filename:
        return False
    project, token = _firebase_access(filename, int(datetime.now(timezone.utc).timestamp()) // 1800)
    response = httpx.post(f"https://fcm.googleapis.com/v1/projects/{project}/messages:send",
                          headers={"Authorization": f"Bearer {token}"}, timeout=10,
                          json={"message": {"token": data["token"], "data": message,
                                            "android": {"priority": "HIGH", "ttl": f"{TTL_SECONDS}s"}}})
    if response.status_code == 401:
        _firebase_access.cache_clear()
    if response.status_code == 404 and any(item.get("errorCode") == "UNREGISTERED"
            for item in response.json().get("error", {}).get("details", [])):
        return True
    response.raise_for_status()
    return False
