"""API thông báo chung: phân trang, đếm chưa đọc và xác nhận từng mục theo owner."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.dich_vu import utc_now_naive
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.luu_tru.thong_bao import Notification
from app.dung_chung.http.phu_thuoc import get_current_user, get_db

router = APIRouter(prefix="/notifications", tags=["Notifications"])


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
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    owned = Notification.user_id == user.id
    total = db.scalar(select(func.count()).select_from(Notification).where(owned)) or 0
    unread_count = db.scalar(select(func.count()).select_from(Notification).where(
        owned, Notification.read_at.is_(None),
    )) or 0
    items = db.scalars(select(Notification).where(owned)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset((page - 1) * page_size).limit(page_size)).all()
    return NotificationPage(items=items, unread_count=unread_count,
                            total=total, page=page, page_size=page_size)


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
