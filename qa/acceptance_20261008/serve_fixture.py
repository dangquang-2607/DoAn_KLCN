"""Local QA server. Only a new SQLite file under this QA directory is used.
No background worker is started and no real SMTP/AI credentials are used.
"""
import os
from pathlib import Path
from datetime import datetime, timezone
from cryptography.fernet import Fernet

ROOT=Path(__file__).resolve().parent
DB=ROOT/'ui-fixture.sqlite'
os.environ['DATABASE_URL']='sqlite:///'+DB.as_posix()
os.environ['JWT_SECRET_KEY']='qa-only-nonproduction-signing-key-ui-20261008'
KEYFILE=ROOT/'.qa-worker.key'
if not KEYFILE.exists():
    KEYFILE.write_bytes(Fernet.generate_key())
os.environ['JOB_ENCRYPTION_KEY']=KEYFILE.read_text().strip()
os.environ['UPLOAD_DIR']=str(ROOT/'ui-uploads')
os.environ['SMTP_USER']=''
os.environ['SMTP_PASSWORD']=''
os.environ['GOOGLE_AI_API_KEY']=''
os.environ['APP_ENV']='qa-local-isolated'
os.environ['FRONTEND_URL']='http://localhost:3018'
os.environ['ADMIN_URL']='http://localhost:5188'

from sqlalchemy import event, select
from app.dung_chung.database.ket_noi import engine
from app.dung_chung.database.dang_ky_mo_hinh import Base,User,Category
from app.dung_chung.database.session import SessionLocal
from app.dung_chung.security.passwords import hash_password
from app.main import app

@event.listens_for(engine,'connect')
def sqlite_functions(conn,_):
    conn.create_function('sysutcdatetime',0,lambda:datetime.now(timezone.utc).replace(tzinfo=None).isoformat(' '))
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('PRAGMA journal_mode=WAL')

Path(os.environ['UPLOAD_DIR']).mkdir(exist_ok=True)
Base.metadata.create_all(engine)
with SessionLocal() as db:
    for email,role,name in [('qa-user@example.com','USER','Người dùng kiểm thử'),('qa-admin@example.com','ADMIN','Quản trị kiểm thử')]:
        if not db.scalar(select(User).where(User.email==email)):
            db.add(User(email=email,full_name=name,role=role,is_active=True,password_hash=hash_password('QA-local-only-2026!')))
    if not db.scalar(select(Category)):
        db.add_all([Category(name='Ăn uống',type='EXPENSE',keywords='cà phê,ăn trưa',icon='utensils',color='orange'),Category(name='Lương',type='INCOME',icon='wallet',color='green')])
    db.commit()

if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=8018)
