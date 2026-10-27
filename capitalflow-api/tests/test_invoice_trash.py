from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu import deletion


def test_exact_30_day_boundary():
    start = datetime(2026, 10, 1, 10)
    invoice = SimpleNamespace(deleted_at=start)
    assert deletion.trash_expires_at(invoice) == start + timedelta(days=30)
    assert not deletion.trash_expired(invoice, start + timedelta(days=30) - timedelta(microseconds=1))
    assert deletion.trash_expired(invoice, start + timedelta(days=30))
    assert not deletion.trash_expired(SimpleNamespace(deleted_at=None))
    assert deletion.trash_expires_at(SimpleNamespace(deleted_at=start.replace(tzinfo=timezone.utc))) == start + timedelta(days=30)


def test_restore_winning_race_prevents_purge():
    db = MagicMock()
    sessions = MagicMock()
    sessions.return_value.__enter__.return_value = db
    db.execute.return_value.all.return_value = [('user', 'invoice')]
    db.scalar.side_effect = [object(), SimpleNamespace(deleted_at=None)]
    with patch.object(deletion, 'purge_invoice') as purge:
        assert deletion.purge_expired_invoices(sessions) == 0
    purge.assert_not_called()
    db.commit.assert_not_called()
