"""Serve the real API with an isolated disposable SQL Server database for UI tests."""
from __future__ import annotations
import argparse
import re
import smtplib
import sys
import uuid
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import uvicorn
from fastapi import HTTPException, Request
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.dung_chung.config import settings
from app.dung_chung.database.ket_noi import engine
from app.dung_chung.database.nen_tang import Base
import app.dung_chung.database.dang_ky_mo_hinh as model_registry
from app.dung_chung.http.phu_thuoc import get_db
from app.dung_chung.http.gioi_han_tan_suat import limiter
from app.dung_chung.email.dich_vu import EmailService, _get_effective_smtp
from app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini import run_gemini_ocr as real_gemini_ocr
from app.dung_chung.security.passwords import hash_password
from app.chuc_nang.nguoi_dung.dang_nhap.luu_tru.nguoi_dung import User
from app.chuc_nang.nguoi_dung.danh_muc.luu_tru.danh_muc import Category
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.receiving import ensure_default_wallet
from app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.luu_tru.wallet import Wallet
from app.chuc_nang.nguoi_dung.tai_chinh.giao_dich.luu_tru.giao_dich import Transaction
from app.dung_chung.tac_vu_nen.luu_tru.tac_vu_nen import BackgroundJob

def main():
 parser=argparse.ArgumentParser()
 parser.add_argument("--real-email-recipient")
 parser.add_argument("--real-gemini",action="store_true")
 parser.add_argument("--existing-database",help="Resume a disposable GUI test database after a controlled API restart")
 args=parser.parse_args()
 if args.real_email_recipient and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+",args.real_email_recipient):
  raise RuntimeError("Valid approved email recipient required")
 real_reset=EmailService.send_password_reset_otp
 real_smtp,real_smtp_ssl=smtplib.SMTP,smtplib.SMTP_SSL
 smtp_config=_get_effective_smtp() if args.real_email_recipient else None
 live_services={"smtp_sent":0,"smtp_failed":0,"gemini_calls":0,"gemini_succeeded":0}
 if settings.app_env!="development" or "odbc_connect" in engine.url.query:
  raise RuntimeError("Unsupported test configuration")
 database=args.existing_database or "cf_userweb_test_"+uuid.uuid4().hex[:12]
 assert re.fullmatch(r"cf_userweb_test_[0-9a-f]{12}",database)
 admin_engine=create_engine(engine.url.set(database="master"),isolation_level="AUTOCOMMIT",hide_parameters=True)
 isolated=None
 with admin_engine.connect() as admin:
  if args.existing_database:
   if admin.scalar(text("SELECT DB_ID(:name)"),{"name":database}) is None:
    raise RuntimeError("Disposable database to resume does not exist")
  else:
   admin.execute(text(f"CREATE DATABASE [{database}]"))
 try:
  isolated=create_engine(engine.url.set(database=database),hide_parameters=True)
  Base.metadata.create_all(isolated)
  sessions=sessionmaker(bind=isolated,expire_on_commit=False)
  with engine.connect() as original,sessions() as db:
   if not args.existing_database:
    for row in original.execute(select(Category.__table__).where(Category.owner_user_id.is_(None))).mappings():
     db.add(Category(**{str(key):value for key,value in row.items()}))
   accounts=[("quanghong5742@gmail.com","Kiểm thử User Web"),("quanghong5742+userweb@gmail.com","Người nhận kiểm thử")]
   if args.real_email_recipient and args.real_email_recipient not in {email for email,_ in accounts}:
    accounts.append((args.real_email_recipient,"Kiểm thử SMTP thật"))
   for email,name in accounts:
    if db.scalar(select(User.id).where(User.email==email)):
     continue
    user=User(email=email,full_name=name,password_hash=hash_password("UserWebTest!2026"))
    db.add(user);db.flush();ensure_default_wallet(db,user)
   db.commit()
  captured={};scenario={"ocr":"complete"}
  def get_test_db(request:Request):
   with sessions() as db:
    db.info["request"]=request
    try:yield db
    except Exception:db.rollback();raise
  app.dependency_overrides[get_db]=get_test_db
  limiter.enabled=False
  def record_reset(email,name,code,**kwargs):
   captured[email]={"purpose":"RESET_PASSWORD","code":code}
   if args.real_email_recipient and email==args.real_email_recipient:
    with patch("smtplib.SMTP",real_smtp),patch("smtplib.SMTP_SSL",real_smtp_ssl),patch("app.dung_chung.email.dich_vu._get_effective_smtp",return_value=smtp_config):
     delivered=real_reset(email,name,code,**kwargs)
    live_services["smtp_sent" if delivered else "smtp_failed"]+=1
    if not delivered:raise RuntimeError("Approved real SMTP delivery failed")
   return True
  async def record_bank(to_email,otp_code,**kwargs):captured[to_email]={"purpose":"LINK_BANK","code":otp_code}
  async def fake_ocr(*args,**kwargs):
   if scenario["ocr"]=="real":
    live_services["gemini_calls"]+=1
    result=await real_gemini_ocr(*args,**kwargs)
    live_services["gemini_succeeded"]+=1
    return result
   if scenario["ocr"]=="unavailable":raise RuntimeError("Simulated OCR unavailable")
   if scenario["ocr"]=="incomplete":return {"items":[],"tien_te":None}
   today=datetime.now(timezone(timedelta(hours=7))).date()
   return {"ten_nguoi_ban":"Mì Cay Shin 6","dia_chi_nguoi_ban":"11B Bùi Xuân Phái, Tân Phú",
    "so_hoa_don":"03124986","ngay_lap":today.strftime("%d/%m/%Y"),"tien_te":None,"tong_thanh_toan":"184000",
    "do_tin_cay":0.98,"items":[
     {"ten_hang":"Tokboki hải sản","so_luong":"1","don_gia":"49000","thanh_tien":"49000"},
     {"ten_hang":"Mì Cay Bò","so_luong":"2","don_gia":"49000","thanh_tien":"98000"},
     {"ten_hang":"CoCa","so_luong":"2","don_gia":"17000","thanh_tien":"34000"},
     {"ten_hang":"Khăn Lạnh","so_luong":"3","don_gia":"1000","thanh_tien":"3000"}]}
  @app.get("/api/v1/__test/status",include_in_schema=False)
  def status():
   with sessions() as db:
    return {"database":database,"otps":captured,"scenario":scenario,"live_services":live_services,
     "wallets":[{"id":str(w.id),"user_id":str(w.user_id),"name":w.name,"balance":str(w.balance)} for w in db.scalars(select(Wallet))],
     "records":[{"id":str(t.id),"type":t.type,"amount":str(t.amount),"source":t.source,"include_in_reports":t.include_in_reports} for t in db.scalars(select(Transaction))],
     "queued_jobs":[j.kind for j in db.scalars(select(BackgroundJob))]}
  @app.post("/api/v1/__test/scenario",include_in_schema=False)
  def set_scenario(payload:dict[str,str]):
   mode=payload.get("ocr")
   if mode not in {"complete","incomplete","unavailable","real"}:raise HTTPException(422,"Invalid test scenario")
   if mode=="real" and not args.real_gemini:raise HTTPException(422,"Real Gemini not enabled")
   scenario["ocr"]=mode
   return scenario
  server=uvicorn.Server(uvicorn.Config(app,host="127.0.0.1",port=8011,log_level="warning"))
  @app.post("/api/v1/__test/shutdown",include_in_schema=False)
  def shutdown():
   server.should_exit=True
   return {"stopping":True}
  import tempfile
  with tempfile.TemporaryDirectory(prefix="capitalflow-userweb-files-") as uploads,ExitStack() as stack:
   stack.enter_context(patch.object(settings,"upload_dir",uploads))
   stack.enter_context(patch("app.dung_chung.http.trung_gian.kiem_toan.SessionLocal",sessions))
   stack.enter_context(patch("app.dung_chung.email.dich_vu.SessionLocal",sessions))
   stack.enter_context(patch.object(EmailService,"send_password_reset_otp",side_effect=record_reset))
   stack.enter_context(patch("app.chuc_nang.nguoi_dung.tai_chinh.vi_tai_khoan.wallet_api.send_otp_email",side_effect=record_bank))
   stack.enter_context(patch("app.chuc_nang.nguoi_dung.hoa_don_ai.nghiep_vu.kiem_tra_tai_len.run_gemini_ocr",side_effect=fake_ocr))
   stack.enter_context(patch("app.chuc_nang.nguoi_dung.hoa_don_ai.ha_tang.gemini.run_gemini_ocr",side_effect=fake_ocr))
   stack.enter_context(patch("smtplib.SMTP",side_effect=AssertionError("Unexpected SMTP")))
   stack.enter_context(patch("smtplib.SMTP_SSL",side_effect=AssertionError("Unexpected SMTP")))
   print("Isolated test API:",database,"at http://127.0.0.1:8011",flush=True)
   server.run()
 finally:
  if isolated is not None:isolated.dispose()
  with admin_engine.connect() as admin:
   admin.execute(text(f"ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE"))
   admin.execute(text(f"DROP DATABASE [{database}]"))
  admin_engine.dispose()
  print("Isolated test database removed",flush=True)
if __name__=="__main__":main()
