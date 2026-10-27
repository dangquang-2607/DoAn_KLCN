"""Run explicitly: .venv/Scripts/python.exe tests/retail_invoice_sql_integration.py.

SQL Server + production HTTP routes and ledger; all fixtures/writes live inside
one outer transaction that is rolled back, including commits made by endpoints.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import json
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import select, func, text
from sqlalchemy.orm import Session
import app.dung_chung.database.dang_ky_mo_hinh
from app.dung_chung.database.ket_noi import engine
from app.dung_chung.http.phu_thuoc import get_db, get_current_user
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.account import Account
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice import Invoice
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.invoice_item import InvoiceItem
from app.chuc_nang.nguoi_dung.hoa_don_ai.luu_tru.lich_su import InvoiceEvent
from app.chuc_nang.nguoi_dung.hoa_don_ai.api.routes import router
from test_retail_invoice_duplicates import receipt, lines


def snapshot(conn):
    tables = [User.__table__, Account.__table__, Invoice.__table__, InvoiceItem.__table__,
              Transaction.__table__, InvoiceEvent.__table__]
    return [conn.scalar(select(func.count()).select_from(table)) for table in tables] + [
        str(conn.scalar(select(func.sum(Account.balance))))]


def main():
    with engine.connect() as conn:
        before = snapshot(conn)
        conn.rollback()
        outer = conn.begin()
        user_id, other_id, wallet_id, other_wallet = (uuid4() for _ in range(4))
        original_id, copy_id, third_id, other_receipt = (uuid4() for _ in range(4))
        missing_number_id = uuid4()
        active = [user_id]
        try:
            with Session(conn, join_transaction_mode='create_savepoint') as db:
                for uid, wid in [(user_id, wallet_id), (other_id, other_wallet)]:
                    db.add(User(id=uid, email=f'retail-qa-{uid.hex}@example.invalid', full_name='Retail QA',
                                password_hash='unusable', token_version=0))
                    db.flush()
                    db.add(Account(id=wid, user_id=uid, name='QA only', account_type='BASIC',
                                   balance=Decimal('5000000'), currency='VND'))
                db.flush()
                for index, (iid, uid) in enumerate([(original_id, user_id), (copy_id, user_id), (third_id, user_id), (other_receipt, other_id), (missing_number_id, user_id)]):
                    values = vars(receipt(id=iid, user_id=uid, created_at=datetime(2026, 10, 22, 10) + timedelta(seconds=index)))
                    values['file_sha256'] = f'{index + 1:064x}'
                    if iid == copy_id:
                        values['merchant_name'] = 'HẢI BÉO 1 - BIA HƠI HÀ NỘI HẢI BÉO'
                    if iid == third_id:
                        values['merchant_name'] = 'Bia Hơi Hà Nội Hải Béo 1'
                        values['invoice_time'] = None
                    if iid == missing_number_id:
                        values['merchant_name'] = 'HẢI BÉO 1'
                        values['invoice_number'] = None
                    db.add(Invoice(**values))
                    db.flush()
                    db.add_all([InvoiceItem(invoice_id=iid, line_no=n, **item) for n, item in enumerate(lines(), 1)])
                db.commit()

            app = FastAPI()
            app.include_router(router, prefix='/api/v1')
            def db_override(request: Request):
                with Session(conn, autoflush=False, join_transaction_mode='create_savepoint') as db:
                    db.info['request'] = request
                    yield db
            def user_override():
                return User(id=active[0], token_version=0)
            app.dependency_overrides[get_db] = db_override
            app.dependency_overrides[get_current_user] = user_override
            with TestClient(app) as client:
                def post(iid, action, body, status, key=None):
                    response = client.post(f'/api/v1/invoices/{iid}/{action}', json=body,
                        headers={'Idempotency-Key': key or uuid4().hex})
                    assert response.status_code == status, (action, response.status_code, response.text)
                    return response.json()
                first = post(original_id, 'confirm', {'account_id': str(wallet_id)}, 201, 'retail-first-confirm')
                repeated = post(original_id, 'confirm', {'account_id': str(wallet_id)}, 201, 'retail-first-confirm')
                assert first['transaction_id'] == repeated['transaction_id']
                print('PASS: first draft posts once; same request replays same transaction')
                result = post(copy_id, 'duplicate-check', {}, 200)
                assert result['level'] == 'EXACT' and not result['can_override']
                denied = post(copy_id, 'confirm', {'account_id': str(wallet_id), 'accept_distinct': True,
                    'duplicate_review_token': result['review_token']}, 409)
                assert denied['detail']['code'] == 'INVOICE_DUPLICATE_EXACT'
                print('PASS: second photo rejected even with accept_distinct and current token')

                result = post(missing_number_id, 'duplicate-check', {}, 200)
                assert result['level'] == 'EXACT' and not result['can_override']
                assert result['candidates'][0]['reason'] == 'SAME_RETAIL_TIME_ITEMS'
                denied = post(missing_number_id, 'confirm', {'account_id': str(wallet_id),
                    'accept_distinct': True, 'duplicate_review_token': result['review_token']}, 409)
                assert denied['detail']['code'] == 'INVOICE_DUPLICATE_EXACT'
                detail = client.get(f'/api/v1/invoices/{missing_number_id}')
                assert detail.status_code == 200 and detail.json()['duplicate_check']['level'] == 'EXACT'
                listing = client.get('/api/v1/invoices').json()
                assert next(i for i in listing['items'] if i['id'] == str(missing_number_id))['duplicate_level'] == 'EXACT'
                print('PASS: missing number detected by time/items in list/detail/preview and blocked on confirm')

                result = post(third_id, 'duplicate-check', {}, 200)
                assert result['candidates'][0]['reason'] == 'SAME_RETAIL_RECEIPT_ITEMS'
                result = post(third_id, 'duplicate-check', {'items': []}, 200)
                assert result['level'] == 'SUSPECTED'
                with Session(conn) as db:
                    assert db.scalar(select(func.count()).select_from(InvoiceItem).where(InvoiceItem.invoice_id == third_id)) == 3
                print('PASS: missing-time basket hard block; edited preview does not mutate stored rows')

                # A stale preview after changing items must not authorize posting.
                denied = post(third_id, 'confirm', {'account_id': str(wallet_id), 'items': lines(),
                    'accept_distinct': True, 'duplicate_review_token': result['review_token']}, 409)
                assert denied['detail']['code'] == 'INVOICE_DUPLICATE_EXACT'
                with Session(conn) as db:
                    assert db.scalar(select(func.count()).select_from(Transaction).where(Transaction.user_id == user_id)) == 1
                    assert db.get(Account, wallet_id).balance == Decimal('3880000')
                print('PASS: blocked confirmations leave exactly one expense and balance 3,880,000')

                # Inadequate evidence still permits a genuine different purchase.
                body = {'invoice_number': '120023', 'invoice_time': '21:57:00', 'items': lines()}
                check = post(copy_id, 'duplicate-check', body, 200)
                assert check['level'] == 'SUSPECTED'
                post(copy_id, 'confirm', {**body, 'account_id': str(wallet_id), 'accept_distinct': True,
                    'duplicate_review_token': check['review_token']}, 201)
                print('PASS: different receipt number/time can be reviewed and posted')

                active[0] = other_id
                check = post(other_receipt, 'duplicate-check', {}, 200)
                assert check['level'] == 'NONE' and check['candidates'] == []
                post(other_receipt, 'confirm', {'account_id': str(other_wallet)}, 201)
                print('PASS: other personal account remains independent')
        finally:
            outer.rollback()
        assert snapshot(conn) == before, 'Data changed after outer rollback'
        print('PASS: outer rollback restored invoice/transaction/event counts and total account balance')


if __name__ == '__main__':
    main()
