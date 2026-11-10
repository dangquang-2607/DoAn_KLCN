"""API thông báo chung: phân trang, đếm chưa đọc và xác nhận từng mục theo owner."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, field_serializer
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.dich_vu import utc_now_naive
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.luu_tru.thong_bao import Notification
from app.dung_chung.http.phu_thuoc import get_current_user, get_db
from app.dung_chung.money import normalize_money_message
from .luu_tru.push import PushRegistration
from .push import PushInput, configuration, register

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/push/config")
def push_config(_user: User = Depends(get_current_user)):
    return configuration()


@router.post("/push/subscriptions")
def subscribe_push(payload: PushInput, request: Request, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    return {"id": register(db, user, request.state.session_family_id, payload)}


@router.delete("/push/subscriptions/{registration_id}", status_code=204)
def unsubscribe_push(registration_id: uuid.UUID, request: Request, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    db.execute(delete(PushRegistration).where(PushRegistration.id == registration_id,
        PushRegistration.user_id == user.id, PushRegistration.session_id == request.state.session_family_id))
    db.commit()


class NotificationOut(BaseModel):
    id: uuid.UUID
    kind: str
    severity: str
    title: str
    message: str
    source_type: str | None
    source_id: uuid.UUID | None
    action_url: str | None
    read_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer('message')
    def formatted_message(self, value: str) -> str:
        return normalize_money_message(value)


class NotificationPage(BaseModel):
    items: list[NotificationOut]
    unread_count: int
    total: int
    page: int
    page_size: int


@router.get("", response_model=NotificationPage)
def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    owned = Notification.user_id == user.id
    unread = owned & Notification.read_at.is_(None)
    count = select(func.count()).select_from(Notification)
    unread_count = db.scalar(count.where(unread)) or 0
    total = unread_count if unread_only else (db.scalar(count.where(owned)) or 0)
    items = db.scalars(select(Notification).where(unread if unread_only else owned)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset((page - 1) * page_size).limit(page_size)).all()
    return NotificationPage(items=items, unread_count=unread_count,
                            total=total, page=page, page_size=page_size)


@router.post("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    db.execute(update(Notification).where(
        Notification.user_id == user.id, Notification.read_at.is_(None),
    ).values(read_at=utc_now_naive()))
    db.commit()
    return {"success": True}


@router.delete("", status_code=204)
def clear_read_notifications(
    only_read: bool = Query(True),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    # This endpoint only clears read items; unread alerts require individual deletion.
    if not only_read:
        raise HTTPException(400, "Chỉ hỗ trợ xóa thông báo đã đọc")
    db.execute(delete(Notification).where(
        Notification.user_id == user.id, Notification.read_at.is_not(None),
    ))
    db.commit()
    return Response(status_code=204)


@router.delete("/{notification_id}", status_code=204)
def delete_notification(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    notification = db.scalar(select(Notification).where(
        Notification.id == notification_id, Notification.user_id == user.id,
    ))
    if notification is None:
        raise HTTPException(404, "Không tìm thấy thông báo")
    db.delete(notification)
    db.commit()
    return Response(status_code=204)


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notification = db.scalar(select(Notification).where(
        Notification.id == notification_id, Notification.user_id == user.id,
    ))
    if not notification:
        raise HTTPException(404, "Không tìm thấy thông báo")
    if notification.read_at is None:
        notification.read_at = utc_now_naive()
        db.commit()
        db.refresh(notification)
    return notification
