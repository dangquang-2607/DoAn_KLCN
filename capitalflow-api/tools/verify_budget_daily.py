"""Run budget daily-metric regressions without connecting to the live database."""
from datetime import date
from decimal import Decimal
from pathlib import Path
import sys
import unittest
from uuid import uuid4

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.dung_chung.database import dang_ky_mo_hinh  # noqa: F401
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.ky_han import (
    format_progress, progress_for_period, progress_for_periods,
)
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.luu_tru.ngan_sach import Budget, BudgetChange
from app.chuc_nang.nguoi_dung.tai_chinh.ngan_sach.schemas import BudgetProgressOut


class DailyBudgetTests(unittest.TestCase):
    def budget(self, **changes):
        values = dict(id=uuid4(), user_id=uuid4(), category_id=uuid4(), name="Mua sắm",
                      amount_limit=Decimal("8000000"), warning_percent=Decimal("80"),
                      currency="VND", period_type="MONTHLY", is_active=True,
                      start_date=date(2026, 11, 1), end_date=date(2026, 11, 30),
                      is_recurring=False, recurrence_end_date=None, changes=[])
        values.update(changes)
        return Budget(**values)

    def progress(self, budget=None, today=date(2026, 11, 8), spent="3300000"):
        budget = budget or self.budget()
        result = format_progress(budget, budget.start_date, budget.end_date, today, Decimal(spent))
        BudgetProgressOut.model_validate(result)
        return result

    def test_current_month_includes_today_and_zero_spend_days(self):
        result = self.progress()
        self.assertEqual((result["period_days"], result["elapsed_days"], result["remaining_days"]), (30, 8, 23))
        self.assertEqual(result["average_daily_spent"], Decimal("412500.00"))
        self.assertEqual(result["daily_allowance"], Decimal("204347"))
        self.assertLessEqual(result["daily_allowance"] * 23, result["remaining_amount"])

    def test_first_last_and_single_day(self):
        for day, elapsed, remaining in [(1, 1, 30), (30, 30, 1)]:
            with self.subTest(day=day):
                result = self.progress(today=date(2026, 11, day), spent="0")
                self.assertEqual((result["elapsed_days"], result["remaining_days"]), (elapsed, remaining))
                self.assertEqual(result["average_daily_spent"], 0)
        single = self.budget(start_date=date(2026, 11, 8), end_date=date(2026, 11, 8))
        result = self.progress(single)
        self.assertEqual((result["period_days"], result["elapsed_days"], result["remaining_days"]), (1, 1, 1))
        self.assertEqual(result["daily_allowance"], Decimal("4700000"))

    def test_upcoming_and_completed(self):
        upcoming = self.progress(today=date(2026, 10, 31), spent="0")
        self.assertEqual((upcoming["elapsed_days"], upcoming["remaining_days"]), (0, 30))
        self.assertIsNone(upcoming["daily_allowance"])
        self.assertIsNone(upcoming["average_daily_spent"])
        completed = self.progress(today=date(2026, 12, 1))
        self.assertEqual((completed["elapsed_days"], completed["remaining_days"]), (30, 0))
        self.assertIsNone(completed["daily_allowance"])
        self.assertEqual(completed["average_daily_spent"], Decimal("110000"))

    def test_exceeded_and_exactly_at_limit(self):
        result = self.progress(spent="8100000")
        self.assertEqual(result["remaining_amount"], Decimal("-100000"))
        self.assertEqual(result["daily_allowance"], 0)
        self.assertEqual(result["progress_status"], "EXCEEDED")
        self.assertEqual(self.progress(spent="8000000")["daily_allowance"], 0)

    def test_leap_february(self):
        result = self.progress(self.budget(start_date=date(2024, 2, 1), end_date=date(2024, 2, 29)),
                               today=date(2024, 2, 28), spent="0")
        self.assertEqual((result["period_days"], result["elapsed_days"], result["remaining_days"]), (29, 28, 2))

    def test_paused_and_resumed_average_uses_active_days(self):
        budget = self.budget(is_recurring=True, is_active=False)
        def setting(day, active):
            return BudgetChange(effective_date=date(2026, 11, day), name=budget.name,
                                amount_limit=budget.amount_limit, warning_percent=budget.warning_percent,
                                is_active=active)
        budget.changes = [setting(1, True), setting(4, False)]
        paused = self.progress(budget, spent="300000")
        self.assertEqual(paused["active_elapsed_days"], 3)
        self.assertEqual(paused["average_daily_spent"], Decimal("100000"))
        self.assertIsNone(paused["daily_allowance"])
        budget.changes.append(setting(7, True))
        resumed = self.progress(budget, spent="500000")
        self.assertEqual(resumed["active_elapsed_days"], 5)
        self.assertEqual(resumed["average_daily_spent"], Decimal("100000"))
        self.assertEqual(resumed["period_state"], "CURRENT")
        budget.recurrence_end_date = date(2026, 11, 30)
        budget.changes.append(setting(30, False))
        ended = self.progress(budget, today=date(2026, 11, 30))
        self.assertEqual(ended["period_state"], "COMPLETED")
        self.assertEqual(ended["remaining_days"], 0)

    def test_single_and_batch_queries_preserve_budget_scope(self):
        budget = self.budget()
        with Session(create_engine("sqlite://")) as db:
            db.execute(text("CREATE TABLE transactions (user_id text, category_id text, transaction_date date, "
                            "type text, amount numeric, kind text, include_in_reports boolean)"))
            rows = [
                (budget.user_id, budget.category_id, "2026-11-01", "NORMAL", 1, "-100000"),
                (budget.user_id, budget.category_id, "2026-11-08", "NORMAL", 1, "-200000"),
                (uuid4(), budget.category_id, "2026-11-08", "NORMAL", 1, "-1000000"),
                (budget.user_id, uuid4(), "2026-11-08", "NORMAL", 1, "-1000000"),
                (budget.user_id, budget.category_id, "2026-11-09", "NORMAL", 1, "-1000000"),
                (budget.user_id, budget.category_id, "2026-11-08", "TRANSFER", 1, "-1000000"),
                (budget.user_id, budget.category_id, "2026-11-08", "NORMAL", 0, "-1000000"),
                (budget.user_id, budget.category_id, "2026-11-08", "NORMAL", 1, "1000000"),
            ]
            for owner, category, day, kind, included, amount in rows:
                db.execute(text("INSERT INTO transactions VALUES (:owner, :category, :day, :type, :amount, :kind, :included)"),
                           dict(owner=owner.hex, category=category.hex, day=day, amount=amount,
                                type="EXPENSE" if amount.startswith("-") else "INCOME", kind=kind, included=included))
            today = date(2026, 11, 8)
            single = progress_for_period(db, budget, budget.start_date, budget.end_date, today)
            batch = progress_for_periods(db, budget.user_id, [(budget, budget.start_date, budget.end_date)], today)[0]
            self.assertEqual(single, batch)
            self.assertEqual(single["spent_amount"], Decimal("300000"))
            self.assertEqual(single["average_daily_spent"], Decimal("37500"))


if __name__ == "__main__":
    unittest.main()
