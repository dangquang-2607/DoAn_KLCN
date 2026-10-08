"""QA-only fault injection and worker sink. Never use as deployment entrypoint."""
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock, AsyncMock
from pathlib import Path
import jwt
import serve_fixture as fixture
from fastapi.responses import JSONResponse
from app.dung_chung.config import settings
from app.chuc_nang.nguoi_dung.dang_nhap.api import routes as auth
from app.dung_chung.tac_vu_nen.trinh_chay import run_once
from app.dung_chung.email import dich_vu as email
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob
from app.dung_chung.email.luu_tru.nhat_ky_email import EmailLog
from sqlalchemy import select

app=fixture.app
ROOT=Path(__file__).resolve().parent
CONTROL=ROOT/'qa-control.json'
TRACE=ROOT/'ui-api-trace.jsonl'
assert settings.app_env=='qa-local-isolated'
original=auth.create_access_token
def control():return json.loads(CONTROL.read_text()) if CONTROL.exists() else {}
def token(user_id,role,token_version=0):
    if not control().get('short_token'):return original(user_id,role,token_version)
    return jwt.encode({'sub':user_id,'role':role,'type':'access','ver':token_version,'exp':datetime.now(timezone.utc)+timedelta(seconds=15)},settings.jwt_secret_key,algorithm=settings.jwt_algorithm)
auth.create_access_token=token

@app.middleware('http')
async def observe(request,call_next):
    path=request.url.path
    if control().get('refresh_unavailable') and request.method=='POST' and path.endswith('/auth/refresh'):
        response=JSONResponse({'detail':'QA simulated service outage'},status_code=503,headers={'Access-Control-Allow-Origin':request.headers.get('origin','http://localhost:3018'),'Access-Control-Allow-Credentials':'true'})
    else:response=await call_next(request)
    if path.startswith('/api/'):
        with TRACE.open('a',encoding='utf-8') as f:
            f.write(json.dumps({'time':datetime.now(timezone.utc).isoformat(),'method':request.method,'path':path,'status':response.status_code})+'\n')
    return response

@app.post('/__qa/process')
def process():
    # Loopback QA only. SMTP transport never connects; all captured mail stays local.
    cfg={'smtp_host':'qa.invalid','smtp_port':587,'smtp_user':'qa@example.com','smtp_password':'qa-only','smtp_tls':True,'smtp_ssl':False,'emails_from_email':'qa@example.com','emails_from_name':'QA'}
    ocr={'ten_nguoi_ban':'QA STORE','ngay_lap':'08/10/2026','doanh_so_chua_thue':'100000','tien_thue_gtgt':'10000','tong_thanh_toan':'110000','items':[{'ten_hang':'Notebook','so_luong':'2','don_gia':'50000','thanh_tien':'100000'}]}
    smtp=MagicMock()
    with patch.object(email,'_get_effective_smtp',return_value=cfg),patch.object(email.smtplib,'SMTP',smtp),patch('app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr',AsyncMock(return_value=ocr)):
        count=0
        while count<40 and run_once(fixture.SessionLocal,kinds={'BUDGET','EMAIL','OCR'}):count+=1
    with fixture.SessionLocal() as db:
        result={'processed':count,'external_emails_sent':0,'smtp_sink_calls':smtp.return_value.__enter__.return_value.sendmail.call_count,
          'jobs':[{'kind':j.kind,'status':j.status,'error':j.error_code} for j in db.scalars(select(BackgroundJob)).all()],
          'email_logs':[{'type':e.email_type,'status':e.status} for e in db.scalars(select(EmailLog)).all()]}
    (ROOT/'ui-worker-sink.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    return result

if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=8018)
