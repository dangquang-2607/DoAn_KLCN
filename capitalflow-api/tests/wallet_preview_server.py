"""Loopback-only browser acceptance server. Temporary SQL schema/data rollback on exit.
Never deploy this module: it deliberately replaces login/OTP for isolated QA.
"""
import base64
import threading
from unittest.mock import AsyncMock, patch
from independent_wallet_integration import *
from app.chuc_nang.nguoi_dung.danh_muc.api import router as categories_router
from app.chuc_nang.nguoi_dung.tai_chinh.thong_bao.api import router as notifications_router
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category
import uvicorn


def main():
    engine = create_engine(settings.database_url, hide_parameters=True)
    with engine.connect() as conn:
        before=snapshot(conn); conn.rollback(); outer=conn.begin()
        try:
            if 'wallets' not in inspect(conn).get_table_names():
                with Operations.context(MigrationContext.configure(conn)): migration().upgrade()
            ensure_spending(conn)
            uid=uuid4(); iid=uuid4(); receiver=uuid4(); wid=uuid4(); category_id=uuid4()
            with Session(conn,join_transaction_mode='create_savepoint') as db:
                db.add_all([User(id=uid,email='wallet-browser@example.invalid',full_name='Wallet Browser QA',password_hash='unusable',token_version=0),
                    User(id=receiver,email='receiver-browser@example.invalid',full_name='Recipient Browser QA',password_hash='unusable',token_version=0)])
                db.flush()
                db.add(Wallet(id=wid,user_id=receiver,name='Recipient Wallet',balance=0))
                db.add(Category(id=category_id,owner_user_id=uid,name='Mua sắm QA',type='EXPENSE',keywords='Siêu thị QA'))
                db.add(Invoice(id=iid,user_id=uid,status='REVIEW_REQUIRED',merchant_name='Browser receipt',
                    invoice_date=bookkeeping.today_vn(),total_amount=Decimal('400000'),currency='VND',file_sha256=uuid4().hex*2))
                db.commit()
            app=FastAPI(); lock=threading.Lock()
            for router in (wallet_api.router,bookkeeping.router,budgets.router,phan_tich.router,invoice_router,categories_router,notifications_router):
                app.include_router(router,prefix='/api/v1')
            def database(request: Request):
                with lock, Session(conn,autoflush=False,join_transaction_mode='create_savepoint') as db:
                    db.info['request']=request; yield db
            def current(db=Depends(get_db)): return db.get(User,uid)
            app.dependency_overrides[get_db]=database; app.dependency_overrides[get_current_user]=current
            token='qa.'+base64.urlsafe_b64encode(json.dumps({'sub':str(uid)}).encode()).decode().rstrip('=')+'.qa'
            @app.get('/api/v1/auth/me')
            def profile(): return {'id':str(uid),'full_name':'Wallet Browser QA','email':'wallet-browser@example.invalid','role':'USER','is_active':True,'must_change_password':False}
            @app.get('/__fixture')
            def fixture(): return {'token':token,'invoice_id':str(iid),'receiver_wallet':str(wid),'category_id':str(category_id),'today':bookkeeping.today_vn().isoformat()}
            @app.post('/__shutdown')
            def shutdown(): server.should_exit=True; return {'ok':True}
            server=uvicorn.Server(uvicorn.Config(app,host='127.0.0.1',port=8011,log_level='warning'))
            with patch.object(wallet_api,'send_otp_email',AsyncMock()), patch.object(wallet_api.secrets,'randbelow',return_value=123456):
                print('QA server ready on 127.0.0.1:8011; all SQL changes uncommitted',flush=True)
                server.run()
        finally:
            outer.rollback()
        after = snapshot(conn)
        changed = sorted(name for name in before.keys() | after.keys() if before.get(name) != after.get(name))
        assert not changed, f'Database snapshot changed during QA (check concurrent services): {changed}'
        print('PASS: browser QA rollback restored all existing data and schema',flush=True)
    engine.dispose()


if __name__=='__main__': main()
