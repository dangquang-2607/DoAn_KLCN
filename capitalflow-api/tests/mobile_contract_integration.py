"""Real HTTP/SQL contracts for Flutter. All SQL writes roll back; files use a temp dir.

Run: .venv/Scripts/python.exe tests/mobile_contract_integration.py
The exported responses contain only generated QA users/receipts, never user data.
"""
import json
import sys
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from retail_invoice_sql_integration import (
    engine, User, Account, Invoice, InvoiceItem, Transaction, router,
    get_db, get_current_user, receipt, lines, snapshot,
)
from app.dung_chung.config import settings
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.api import router as notifications
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.luu_tru.thong_bao import Notification


def main():
    captured = {}
    with engine.connect() as conn, TemporaryDirectory(prefix='capitalflow-contract-') as upload_dir:
        before = snapshot(conn)
        notification_count = conn.scalar(select(func.count()).select_from(Notification))
        conn.rollback()
        outer = conn.begin()
        old_upload_dir = settings.upload_dir
        settings.upload_dir = upload_dir
        uid, other_uid, wallet, original, reshot = [uuid4() for _ in range(5)]
        nids = [uuid4() for _ in range(4)]
        active = [uid]
        try:
            with Session(conn, join_transaction_mode='create_savepoint') as db:
                for user_id in [uid, other_uid]:
                    db.add(User(id=user_id, email=f'mobile-qa-{user_id.hex}@example.invalid',
                                full_name='Mobile QA', password_hash='unusable', token_version=0))
                db.flush()
                db.add(Account(id=wallet, user_id=uid, name='QA', account_type='BASIC',
                               balance=Decimal('5000000'), currency='VND'))
                for index, iid in enumerate([original, reshot]):
                    db.add(Invoice(**vars(receipt(id=iid, user_id=uid,
                        file_sha256=uuid4().hex * 2,
                        created_at=datetime(2026, 10, 22, 10) + timedelta(seconds=index)))))
                    db.flush()
                    db.add_all(InvoiceItem(invoice_id=iid, line_no=i, **item)
                               for i, item in enumerate(lines(), 1))
                for index, nid in enumerate(nids):
                    db.add(Notification(id=nid, user_id=other_uid if index == 3 else uid,
                        kind='BUDGET_WARNING', severity='WARNING', title='QA ngân sách',
                        message='Chi tiêu đã đạt 80% hạn mức.', source_type='BUDGET',
                        source_id=wallet, action_url='/budgets',
                        read_at=datetime(2026, 10, 22) if index == 2 else None,
                        created_at=datetime(2026, 10, 22, 11) + timedelta(seconds=index)))
                db.commit()
            app = FastAPI()
            app.include_router(router, prefix='/api/v1')
            app.include_router(notifications, prefix='/api/v1')
            def db_override(request: Request):
                with Session(conn, autoflush=False, join_transaction_mode='create_savepoint') as db:
                    db.info['request'] = request
                    yield db
            app.dependency_overrides[get_db] = db_override
            app.dependency_overrides[get_current_user] = lambda: User(id=active[0], token_version=0)
            with TestClient(app) as client:
                def call(name, method, path, status=200, **kwargs):
                    response = client.request(method, '/api/v1' + path, **kwargs)
                    assert response.status_code == status, (name, response.status_code, response.text)
                    body = response.json() if response.content else None
                    if name:
                        captured[name] = body
                    return body
                def post(name, iid, action, body, status=200, key=None):
                    return call(name, 'POST', f'/invoices/{iid}/{action}', status,
                        json=body, headers={'Idempotency-Key': key or uuid4().hex})
                page = call('notifications', 'GET', '/notifications')
                assert page['total'] == 3 and page['unread_count'] == 2
                call('notification_read', 'POST', f'/notifications/{nids[0]}/read')
                assert call('notifications_after_read', 'GET', '/notifications')['unread_count'] == 1
                call(None, 'POST', f'/notifications/{nids[0]}/read')
                assert call(None, 'GET', '/notifications')['unread_count'] == 1
                call(None, 'POST', f'/notifications/{nids[3]}/read', 404)
                call(None, 'DELETE', f'/notifications/{nids[3]}', 404)
                call(None, 'DELETE', '/notifications?only_read=false', 400)
                call('notifications_clear_read', 'DELETE', '/notifications?only_read=true', 204)
                assert call(None, 'GET', '/notifications')['total'] == 1
                call('notifications_read_all', 'POST', '/notifications/read-all')
                assert call(None, 'GET', '/notifications')['unread_count'] == 0
                call('notification_delete', 'DELETE', f'/notifications/{nids[1]}', 204)
                assert call(None, 'GET', '/notifications')['total'] == 0
                active[0] = other_uid
                assert call(None, 'GET', '/notifications')['unread_count'] == 1
                active[0] = uid
                print('PASS notifications: pagination, idempotent read, read-all, delete, clear-read, owner isolation')

                confirm_body = {'account_id': str(wallet), 'expected_revision': 1}
                first = post('invoice_confirm', original, 'confirm', confirm_body, 201, 'confirm-response-lost')
                replay = post('invoice_confirm_replay', original, 'confirm', confirm_body, 201, 'confirm-response-lost')
                assert first['transaction_id'] == replay['transaction_id']
                exact = post('duplicate_exact', reshot, 'duplicate-check', {})
                assert exact['level'] == 'EXACT' and not exact['can_override']
                post('duplicate_exact_error', reshot, 'confirm', {**confirm_body,
                     'accept_distinct': True, 'duplicate_review_token': exact['review_token']}, 409)
                edit = {'invoice_number': '120023', 'invoice_time': '21:57:00'}
                suspected = post('duplicate_suspected', reshot, 'duplicate-check', edit)
                assert suspected['level'] == 'SUSPECTED' and suspected['can_override']
                post('invoice_distinct_confirm', reshot, 'confirm', {**confirm_body, **edit,
                     'accept_distinct': True, 'duplicate_review_token': suspected['review_token']}, 201)
                call('invoice_detail', 'GET', f'/invoices/{original}')
                call('invoice_page', 'GET', '/invoices')
                call(None, 'DELETE', f'/invoices/{original}', 204)
                hidden = call('invoice_hidden', 'GET', f'/invoices/{original}')
                call('invoice_hidden_page', 'GET', '/invoices?visibility=hidden')
                post('restore_stale_error', original, 'restore', {'expected_revision': hidden['revision'] - 1}, 409)
                post('invoice_restore', original, 'restore', {'expected_revision': hidden['revision']})
                restored = call('invoice_restored', 'GET', f'/invoices/{original}')
                assert restored['deleted_at'] is None and restored['transaction_id'] == first['transaction_id']
                with Session(conn) as db:
                    assert db.scalar(select(func.count()).select_from(Transaction).where(Transaction.user_id == uid)) == 2
                    assert db.get(Account, wallet).balance == Decimal('2760000')
                print('PASS invoices: reshot exact, distinct purchase, lost confirmation replay, hide/restore preserve ledger')

                # Production upload route and file store; no OCR provider is called.
                png = b'\x89PNG\r\n\x1a\n' + b'mobile-contract-image'
                def upload(name, key, status):
                    return call(name, 'POST', '/invoices', status,
                        files={'file': ('qa.png', png, 'image/png')}, data={'source': 'CAMERA'},
                        headers={'Idempotency-Key': key})
                created = upload('upload_created', 'upload-response-lost', 201)
                again = upload('upload_replayed', 'upload-response-lost', 200)
                same = upload('upload_same_bytes', 'upload-another-key', 200)
                assert created['id'] == again['id'] == same['id']
                assert same['outcome'] == 'REUSED_DRAFT'
                call(None, 'DELETE', f"/invoices/{created['id']}", 204)
                hidden_upload = upload('upload_hidden', 'upload-hidden', 200)
                assert hidden_upload['outcome'] == 'RESTORE_REQUIRED'
                post(None, created['id'], 'restore', {'expected_revision': hidden_upload['revision']})
                assert upload('upload_restored', 'upload-restored', 200)['id'] == created['id']
                print('PASS upload: exact bytes reused across request keys, lost response, hidden requires explicit restore')
        finally:
            outer.rollback()
            settings.upload_dir = old_upload_dir
        assert snapshot(conn) == before
        assert conn.scalar(select(func.count()).select_from(Notification)) == notification_count
        print('PASS rollback: original counts and account balance preserved')
    target = Path(__file__).resolve().parents[2] / 'capitalflow-mobile/test/fixtures/backend_contract.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(captured, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Exported {len(captured)} HTTP responses to {target.name}')


if __name__ == '__main__':
    main()
