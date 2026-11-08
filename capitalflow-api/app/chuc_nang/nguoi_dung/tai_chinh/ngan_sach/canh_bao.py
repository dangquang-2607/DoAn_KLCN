"""Shared budget alerts; notification and queued email commit with the caller's transaction."""
from decimal import Decimal

from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.dich_vu import emit_notification
from app.dung_chung.email.dich_vu import EmailService
from app.dung_chung.money import format_vnd, format_percent
from app.dung_chung.tac_vu_nen.hang_doi import enqueue_email
from .ky_han import current_progress, today_vn


def emit_budget_alert(db, budget, progress, user):
    spent = Decimal(progress['spent_amount'])
    limit = Decimal(progress['amount_limit'])
    warning = Decimal(progress['warning_percent'])
    if limit <= 0:
        return
    percent = spent / limit * 100
    if percent < warning:
        return
    # Match existing keys from persisted Numeric(5, 2) thresholds, including
    # when a PATCH contains an unscaled Decimal such as Decimal('10').
    threshold = '100' if percent >= 100 else f'{warning:.2f}'
    key = f"budget:{budget.id}:{progress['start_date']}:{progress['end_date']}:{threshold}"
    title = ('Ngân sách đã vượt hạn mức' if percent > 100 else
             'Ngân sách đã đạt hạn mức' if percent == 100 else 'Ngân sách đã đạt ngưỡng cảnh báo')
    emit_notification(
        db, user_id=budget.user_id, kind='BUDGET', severity='WARNING', title=title,
        message=f"{progress['budget_name']}: đã chi {format_vnd(spent)} / {format_vnd(limit)} ({format_percent(percent)}%). Ngưỡng cảnh báo: {format_percent(warning, 2).rstrip("0").rstrip(",")}%.",
        source_type='BUDGET', source_id=budget.id, action_url='/budgets',
        metadata={'spent': str(spent), 'limit': str(limit), 'percent': float(round(percent, 2)),
                  'warning_percent': str(warning)},
        dedupe_key=key,
    )
    if user and user.email:
        enqueue_email(
            db, EmailService.send_budget_alert_email,
            recipient=user.email, full_name=user.full_name or 'Quý khách',
            category_name=progress['budget_name'], budget_amount=float(limit),
            spent_amount=float(spent), percentage=float(percent), warning_percent=float(warning),
            owner_user_id=user.id, dedupe_key=key,
        )


def check_current_budget_alert(db, budget, user):
    today = today_vn()
    if budget.start_date > today:
        return
    progress = current_progress(db, budget, today)
    if progress and progress['period_state'] == 'CURRENT':
        emit_budget_alert(db, budget, progress, user)
