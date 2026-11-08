"""Hạn mức theo tài khoản. Mọi thao tác cấp thêm giữ khóa user đến khi commit."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import exists, func, select, update

from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.tac_vu_ocr import OcrJob
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet
from .luu_tru import AiUsage, Subscription

LIMITS = {"FREE": {"wallets": 2, "budgets": 3, "ai": 5}, "PREMIUM": {"wallets": 10, "budgets": 20, "ai": 100}}


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def lock_owner(db, user_id):
    return db.scalar(select(User).where(User.id == user_id).with_hint(
        User, "WITH (UPDLOCK, ROWLOCK)", dialect_name="mssql").execution_options(populate_existing=True))


def plan_for(db, user_id, instant=None):
    subscription = db.get(Subscription, user_id, populate_existing=True)
    until = subscription.premium_until if subscription else None
    return ("PREMIUM" if until and until > (instant or utcnow()) else "FREE"), until


def month_vn():
    return datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date().replace(day=1)


def live_budget(budget, today):
    end = budget.recurrence_end_date if budget.is_recurring else budget.end_date
    return bool(budget.is_active is not False and (end is None or end >= today))


def counts(db, user_id, exclude_budget_id=None, usage_month=None):
    today = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    reserved = exists(select(OcrJob.id).where(OcrJob.id == AiUsage.job_id, OcrJob.status.in_(["QUEUED", "PROCESSING"])))
    usage = select(func.count()).select_from(AiUsage).where(AiUsage.user_id == user_id, AiUsage.month == (usage_month or month_vn()))
    consumed = db.scalar(usage.where(AiUsage.consumed == True))
    pending = db.scalar(usage.where(AiUsage.consumed == False, reserved))
    return {
        "wallets": db.scalar(select(func.count()).select_from(Wallet).where(Wallet.user_id == user_id, Wallet.is_active == True)),
        "budgets": sum(live_budget(b, today) for b in db.scalars(select(Budget).where(Budget.user_id == user_id)) if b.id != exclude_budget_id),
        "ai": consumed, "ai_pending": pending,
    }


def require_capacity(db, user_id, resource, exclude_budget_id=None, usage_month=None):
    lock_owner(db, user_id)
    plan, _ = plan_for(db, user_id)
    usage = counts(db, user_id, exclude_budget_id, usage_month)
    used = usage[resource] + (usage["ai_pending"] if resource == "ai" else 0)
    if used >= LIMITS[plan][resource]:
        label = {"wallets": "ví đang hoạt động", "budgets": "ngân sách đang áp dụng", "ai": "lượt quét AI trong tháng"}[resource]
        raise HTTPException(403, detail={"code": "PLAN_LIMIT_REACHED", "resource": resource,
            "message": f"Đã đạt hạn mức {LIMITS[plan][resource]} {label} của gói {plan}. Xem gói sử dụng tại Cài đặt & bảo mật.",
            "plan": plan, "limit": LIMITS[plan][resource]})


def reserve_ai(db, user_id, job_id):
    if db.get(AiUsage, job_id):
        return
    period = month_vn()
    require_capacity(db, user_id, "ai", usage_month=period)
    db.add(AiUsage(job_id=job_id, user_id=user_id, month=period, consumed=False))
    db.flush()


def consume_ai(db, job_id):
    db.execute(update(AiUsage).where(AiUsage.job_id == job_id).values(consumed=True))
